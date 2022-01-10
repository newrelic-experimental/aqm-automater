var accountidval = undefined;
var API_KEY = undefined;
var mycookie = undefined;

var cfgpath = undefined;
var configobj = undefined; //obj used to hold parsed cfg file.
var fs = require('fs');
var fsp = require('fs').promises;
var gqlutils = require('./gqlutils')

var current_policies = []
var webhook_notification_channelid = "";  // the id of the new wh channel we created.
const commandLineArgs = require('command-line-args')

const DB_TEMPLATE = './alert-quality-mgt-template.json';
const optionDefinitions = [
    { name: 'config', alias: 'c', type: String }
]

var customized_db = "";  // holder

const options = commandLineArgs(optionDefinitions)

// quick arguments check,  bomb out if not valid.
if(options != undefined)
{
    //validate here.
    if(options.config == undefined)
    {
        console.log("error, no config file specified")
        return
    }
}

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


async function parseConfig(filepath, callback)
{
    // fixup the downloaded db template.. with account number
    console.log('Reading Config File')
    const data = await fsp.readFile(filepath, 'utf8');  // note this is using the promises version.
    var cfg = JSON.parse(data);
    callback(cfg);
};

async function runner() {

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


    await parseConfig(cfgpath, function(cfgobj){
        configobj = cfgobj;
        accountidval = configobj.account.account_id;
        API_KEY = configobj.account.api_key; //options.key;
        mycookie = configobj.account.cookie;
    });


    gqlutils.setAuthCookie(mycookie);

    // customize the template.
    await customize_db(accountidval);

    // add dashboard to the target account
    await gqlutils.addDashboardToAccount(API_KEY, accountidval, customized_db);

    // get list of all the policies(ids) in an account
    await gqlutils.getPolicyIDlist(API_KEY, accountidval,function(list) {
        current_policies = list;
    })

    // ******************************* create webhook *************************************
    console.log("Building Webhook body")
    var wh1 = {
        webhook: {
            //  customPayloadType: JSON,
            name: "AQM Events",
            baseUrl: "https://insights-collector.newrelic.com/v1/accounts/"+ accountidval+"/events",
            customHttpHeaders: [{name: "X-Insert-Key", value: API_KEY}],
            customPayloadBody: '{ "eventType":"nrAQMIncident", "account_id": "$ACCOUNT_ID", "account_name" : "$ACCOUNT_NAME", "closed_violations_count_critical": "$CLOSED_VIOLATIONS_COUNT_CRITICAL",  "closed_violations_count_warning": "$CLOSED_VIOLATIONS_COUNT_WARNING" }',
            customPayloadType: 'JSON'
        }
    }
    await  gqlutils.createAQMWebhook(API_KEY, accountidval, wh1, function(wh_id) {
        webhook_notification_channelid = wh_id;
    })

    // add notification channel to all policies
    await gqlutils.addWebHookToPolicyList(API_KEY, accountidval, webhook_notification_channelid, current_policies);
}

runner();

