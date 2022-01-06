var fs = require('fs');
var fsp = require('fs').promises;
var gqlutils = require('./gqlutils')

var current_policies = []
var webhook_notification_channelid = "";  // the id of the new wh channel we created.
const commandLineArgs = require('command-line-args')

const DB_TEMPLATE = './alert-quality-mgt-template.json';
const optionDefinitions = [
    { name: 'config', alias: 'c', type: String },
]

var customized_db = "";  // holder
// args are account number (rpm id)   -a
// key  -k
// both must be present. so we need 4 arguments total.

const options = commandLineArgs(optionDefinitions)

// quick arguments check,  bomb out if not valid.
if(options != undefined)
{
    //validate here.
    if(options.config == undefined)
    {
        console.log("error, no config ")
        return
    }
}

// set options passed in.
cfgpath = options.config;


// Simple Case -- cli one account
// function that reads in the template and replaces all the occurances of 000000 with account ID val
async function customize_db(accountidval)
{
    // fixup the downloaded db template.. with account number
    console.log('Customizing dashboard template')
    const data = await fsp.readFile(DB_TEMPLATE, 'utf8');  // note this is using the promises version.
    // console.log("readfile" + data)
    var fixedup = data.replace(/0000000/g, accountidval);
    customized_db = JSON.parse(fixedup);
    console.log("created custom dashboard with account: " + accountidval)
    console.log("cust_db" + JSON.stringify(customized_db));
};


// ************************************** Master Sub case ****************************************

async function parseMasterSubConfig(filepath, callback)
{
    // fixup the downloaded db template.. with account number
    console.log('Reading Master / Sub Config')
    const data = await fsp.readFile(filepath, 'utf8');  // note this is using the promises version.
    var cfg = JSON.parse(data);
    callback(cfg);
};


var master_sub_cfg = undefined; //obj used to hold parsed master/cfg file.

async function mastersub_runner() {

    // *************************** dashboard start, ********************************************
    // check if old template file exissts... remove it if so, we want the latest one.
    if(fs.existsSync(DB_TEMPLATE))
    {
        console.log("removing pre-existing template file if present")
        fs.unlink(DB_TEMPLATE, (err) => {
            if (err) {
                console.error(err)
            }
            console.log("File removed")
        })
    }

    // download the template from git hub.
    await gqlutils.downloadTemplate(function(result){
        console.log("dashboard template download: " + result);
        // if success,  else fail out.
    })

    await parseMasterSubConfig(cfgpath, function(mastercfgobj){
        master_sub_cfg = mastercfgobj;
    });

    // customize the template.
    await customize_db(master_sub_cfg.masteraccount.account_id);  // customize with the account id from the master account

    // add dashboard to the target account
    await gqlutils.addDashboardToAccount(master_sub_cfg.masteraccount.api_key, master_sub_cfg.masteraccount.account_id, customized_db);  // send dashboard to master account, with master account id val


    // ******************************* create webhook *************************************  using master api key and account id
    var wh1 = {
        webhook: {
            //  customPayloadType: JSON,
            name: "AQM Events",
            baseUrl: "https://insights-collector.newrelic.com/v1/accounts/"+ master_sub_cfg.masteraccount.account_id+"/events",
            customHttpHeaders: [{name: "X-Insert-Key", value: master_sub_cfg.masteraccount.api_key}],
            customPayloadBody: '{ "eventType":"nrAQMIncident", "account_id": "$ACCOUNT_ID", "account_name" : "$ACCOUNT_NAME", "closed_violations_count_critical": "$CLOSED_VIOLATIONS_COUNT_CRITICAL",  "closed_violations_count_warning": "$CLOSED_VIOLATIONS_COUNT_WARNING" }',
            customPayloadType: 'JSON'
        }
    }

    // may need to add in master?,  not sure..


    // For  each sub account defined,
    console.log("Applying webhook to all subaccounts in cfg file")
    for(var i = 0 ; i < master_sub_cfg.subaccounts.length; i++)
    {
        var subaccount = master_sub_cfg.subaccounts[i];
        sub_account_id = subaccount.account_id;
        sub_account_api_key = subaccount.api_key;
        console.log("sub account: " + sub_account_id)

        // get list of all the policies(ids) in an account
        await gqlutils.getPolicyIDlist(sub_account_api_key, sub_account_id,function(list) {
            current_policies = list;
        })

        // create webhook, in the sub account, but using the wh defined above(wh1) which reports to the master.
        await  gqlutils.createAQMWebhook(sub_account_api_key, sub_account_id, wh1, function(wh_id) {
            webhook_notification_channelid = wh_id;
        })

        // add notification channel to all policies
        await gqlutils.addWebHookToPolicyList(sub_account_api_key, sub_account_id, webhook_notification_channelid, current_policies);
    }

}

mastersub_runner(); // run it,