var accountidval = undefined;
var API_KEY = undefined;
var mycookie = undefined;

var cfgpath = undefined;
var configobj = undefined; //obj used to hold parsed cfg file.
var fs = require('fs');
var fsp = require('fs').promises;
const Ajv = require("ajv")
var gqlutils = require('./gqlutils')

var current_policies = []
var webhook_notification_channelid = "";  // the id of the new wh channel we created.
const commandLineArgs = require('command-line-args')

const DB_TEMPLATE = './alert-quality-mgt-template.json';
const optionDefinitions = [
    { name: 'config', alias: 'c', type: String }
]

const ajv = new Ajv() // options can be passed, e.g. {allErrors: true}

const schema_single = {
    type: "object",
    properties: {
        account: {
            type: "object",
            properties: {
                account_id: { type: "integer" },
                api_key: { type: "string" },
                webhook_key: { type: "string" },
                cookie: { type: "string" }
            },
            required: ["account_id", "api_key", "webhook_key"]
        }
    },
    required: ["account"],
    additionalProperties: false,
}


const schema_master_sub = {
    type: "object",
    properties: {
        masteraccount: {
            type: "object",
            properties: {
                account_id: { type: "integer" },
                api_key: { type: "string" },
                webhook_key: { type: "string" },
                cookie: { type: "string" }
            },
            required: ["account_id", "api_key", "webhook_key"]
        },
        subaccounts: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    account_id: { type: "integer" },
                    api_key: { type: "string" }
                },
                required: ["account_id", "api_key"]
            }
        }
    },
    required: ["masteraccount", "subaccounts"],
    additionalProperties: false,
}


var customized_db = "";  // holder

const options = commandLineArgs(optionDefinitions)

// quick arguments check,  bomb out if not valid.
if (options != undefined) {
    //validate here.
    if (options.config == undefined) {
        console.log("error, no config file specified")
        return
    }
}

cfgpath = options.config;

// Simple Case -- cli one account
// function that reads in the template and replaces all the occurances of 000000 with account ID val
async function customize_db(accountidval) {
    // fixup the downloaded db template.. with account number
    console.log('Customizing dashboard template')
    const data = await fsp.readFile(DB_TEMPLATE, 'utf8');  // note this is using the promises version.
    // console.log("readfile" + data)
    var fixedup = data.replace(/0000000/g, accountidval);
    customized_db = JSON.parse(fixedup);
    console.log("created custom dashboard with account: " + accountidval)
    // console.log("cust_db" + JSON.stringify(customized_db));
};


function parseConfig(filepath) {
    var cfg = undefined;
    var fixedup = undefined;
    try {
        console.log('Parsing Your Config File')
        const data = fs.readFileSync(filepath, 'utf8');
        //const data = await fsp.readFile(filepath, 'utf8');  // note this is using the promises version.
        // cleanup the double quotes in the cookie string, by adding escapes
        const usingSplit = data.split(''); //convert to array.
        var start = data.indexOf('cookie'); // find search start
        if (start == -1)
            fixedup = data;
        else {
            //  var endstop = data.lastIndexOf("\"");  //find the last quote,
            var endstop = data.indexOf("\r\n", start) - 2; //find first crlf after start point.

            var quotecnt = 0;
            for (var i = start + 10; i < endstop; i++) {

                if (usingSplit[i] == "\"" && usingSplit[i - 1] != "\\")  // if we find a quote, and there is no \ at the prev index...
                {
                    usingSplit.splice(i, 0, "\\"); // insert \
                    quotecnt++;
                    endstop++; // every time we add a char, inc the last index.
                    i++;
                }
            }
            // console.log("quote count: "+ quotecnt);
            fixedup = usingSplit.join("");  // convert array back to string
        }
        cfg = JSON.parse(fixedup);  // if you get here its valid json..

        // now figure out if its valid schema.
        const validate_single = ajv.compile(schema_single)
        var valid = validate_single(cfg)

        if (valid) {

            return cfg;
        }
        else {
            const validate_ms = ajv.compile(schema_master_sub)  // check master /sub
            valid = validate_ms(cfg)
            if (valid)
                return cfg;
            else {
                console.log("config is not for valid, please check schema")
                console.log("Single Account Schema Errors");
                console.log(validate_single.errors);
                console.log("Master/Sub Account Schema Errors");
                console.log(validate_ms.errors);
                return undefined;
            }
        }

    } catch (ex1) {
        console.log("config parse exception: " + ex1.message);
    }
}

function keysAreValid(api_key, webhook_key, cookie) {
    
    //wh key
    console.log("checking webhook_key format")
    if (webhook_key.startsWith('NRII') || webhook_key.endsWith('NRAL'))  //wh key is either insights insert or license ingest.
    {
        if (cookie == undefined || cookie.length <= 0)  // if no cookie we must have valid api key
        {
            console.log("cookie is not present, checking api_key format")
            if (api_key.startsWith('NRAK')) {
                return true;
            }
            else
            {
                console.log('api_key is the incorrect format,  must start with NRAK (NR user key)')
               return false;
            }
        }
        else {
            // assume cookie is valid,  
            console.log("cookie is present , assumed to be valid, api_key will be ignored")
            return true;
        }
    }

    console.log("Webhook key is not the correct format, must be insights insert or license ingest key");
    return false;
}

async function runner() {

    // *************************** dashboard start, ********************************************
    // check if old template file exissts... remove it if so, we want the latest one.
    if (fs.existsSync(DB_TEMPLATE)) {
        console.log("removing pre-existing dashboard template file if present")
        fs.unlink(DB_TEMPLATE, (err) => {
            if (err) {
                console.error(err)
            }
            console.log("File removed")
        })
    }

    // download the template from git hub.
    await gqlutils.downloadTemplate(function (result) {
        console.log("dashboard template download: " + result);
        // if success,  else fail out.
    })

    // parse config... validate its a known schema.
    configobj = parseConfig(cfgpath);

    // error out--- config is bad
    if (configobj == undefined) {
        console.log("Bad config file, bad json or format please see messages")
        return; // done,
    }


    // we have a valid config, need to figure out what kind, and go down that path.
    // schema is different on each,
    var config_type = "single";
    if (configobj.masteraccount != undefined)
        config_type = "master_sub"


    switch (config_type) {
        case "single":  // single account case.

            // double check api/webhook_key formats : 
            if (!keysAreValid(configobj.account.api_key, configobj.account.webhook_key, configobj.account.cookie))
                break;

            // set the auth and target acc,  will be used for next steps.
            gqlutils.setAuthAndTargetAccount(configobj.account.account_id, configobj.account.api_key, configobj.account.cookie);

            // customize the template using acocunt id
            await customize_db(configobj.account.account_id);

            // add dashboard to the target account
            await gqlutils.addDashboardToAccount(customized_db);

            // get list of all the policies(ids) in an account
            await gqlutils.getPolicyIDlist(function (list) {
                current_policies = list;
            })

            // ******************************* create webhook *************************************
            console.log("Building Webhook body")
            var wh1 = gqlutils.constructWebHook(configobj.account.webhook_key);

            await gqlutils.createAQMWebhook(wh1, function (wh_id) {
                webhook_notification_channelid = wh_id;
            })

            // add notification channel to all policies
            await gqlutils.addWebHookToPolicyList(webhook_notification_channelid, current_policies);
            break;
        case "master_sub":


            if (!keysAreValid(configobj.masteraccount.api_key, configobj.masteraccount.webhook_key, configobj.masteraccount.cookie))
                 break;
            // set the auth and target acc,  will be used for next steps.(NOTE,  using master acocunt params..!!!
            gqlutils.setAuthAndTargetAccount(configobj.masteraccount.account_id, configobj.masteraccount.api_key, configobj.masteraccount.cookie);

            // customize the template.
            await customize_db(configobj.masteraccount.account_id);  // customize with the account id from the master account

            // add dashboard to the target account
            await gqlutils.addDashboardToAccount(customized_db);  // send dashboard to master account, with master account id val

            // get list of all the policies(ids) in master account
            await gqlutils.getPolicyIDlist(function (list) {
                current_policies = list;
            })
            // build webhook,  tied to master account
            console.log("Building Webhook body")
            var wh1 = gqlutils.constructWebHook(configobj.masteraccount.webhook_key);  // note, this webhhook will be used both in the master, and in all the subs

            // add the webhook to the master account
            console.log("Applying webhook to master account in cfg file")

            // create webhook,in master account, store the channel id of the webhhook
            await gqlutils.createAQMWebhook(wh1, function (wh_id) {
                webhook_notification_channelid = wh_id;
            })

            // add notification channel to all policies in the master account, using the webhooks channel id,
            await gqlutils.addWebHookToPolicyList(webhook_notification_channelid, current_policies);

            console.log("Done with master account");
            // For each sub account in the config,  add the same webhook defined above.
            console.log("Applying webhook to all subaccounts in cfg file")
            for (var i = 0; i < configobj.subaccounts.length; i++) {
                var subaccount = configobj.subaccounts[i];
                sub_account_id = parseInt(subaccount.account_id);
                sub_account_api_key = subaccount.api_key;
                console.log("applying to sub account: " + sub_account_id)

                // set the auth and target acc,  will be used for next steps.(NOTE, using sub account id / api key,  but cookie is from master (if nr admin)
                gqlutils.setAuthAndTargetAccount(sub_account_id, sub_account_api_key, configobj.masteraccount.cookie);

                // get list of all the policies(ids) for the sub account
                await gqlutils.getPolicyIDlist(function (list) {
                    current_policies = list;
                })

                // create webhook, in the sub account, but using the webhook defined above(wh1) which reports to the master.< ------ NOTE THIS !!!
                await gqlutils.createAQMWebhook(wh1, function (wh_id) {
                    webhook_notification_channelid = wh_id;
                })

                // add notification channel to all policies
                await gqlutils.addWebHookToPolicyList(webhook_notification_channelid, current_policies);
            }

            break;
        default:
            break;
    }

}

runner();// kick off async runner function,  wraps async calls .

