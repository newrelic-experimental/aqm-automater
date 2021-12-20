var accountidval = undefined;
var API_KEY = undefined;
var axios = require('axios');
var fs = require('fs');
var fsp = require('fs').promises;

var current_policies = []
var webhook_notification_channelid = "";  // the id of the new wh channel we created.
const commandLineArgs = require('command-line-args')

const DB_TEMPLATE = './alert-quality-mgt-template.json';
const optionDefinitions = [
    { name: 'key', alias: 'k', type: String },
    { name: 'account', alias: 'a', type: Number }
]

var customized_db = "";  // holder
// args are account number (rpm id)   -a
// key  -k
// both must be present. so we need 4 arguments total.

const options = commandLineArgs(optionDefinitions)

if(options != undefined)
{
    //validate here.
    if(options.account == undefined)
    {
        console.log("error, no account number ")
        return
    }
    if(options.key == undefined)
    {
        console.log("error, no key number ")
        return
    }
}


accountidval = options.account;
API_KEY = options.key;

async function  dispatchToNewRelic(datapayload, callback)
{
    var config = {
        method: 'post',
        url: 'https://api.newrelic.com/graphql',
        headers: {
            'Content-Type': 'application/json',
            'API-Key': API_KEY
        },
        data: datapayload
    };

    await axios(config)
        .then(function (response) {
            if (response.status == 200) {
                if(response.data.errors != null)
                {
                    callback("failed: " + JSON.stringify(response.data.errors), response.data.data);
                }
                else
                    callback("success", response.data.data);
            }
            else {
                callback("failed", undefined);
            }
        })
        .catch(function (error) {
            callback("exception:" + error );
        });
}

async function streamToFile (inputStream, filePath)  {
    await new Promise((resolve, reject) => {
        const fileWriteStream = fs.createWriteStream(filePath)
        inputStream
            .pipe(fileWriteStream)
            .on('finish', resolve)
            .on('error', reject)
    })
}

async function  downloadTemplate(callback)
{

    var config = {
        method: 'get',
        url: 'https://raw.githubusercontent.com/newrelic/oma-resource-center/main/src/content/docs/oma/value-drivers/uptime-performance-and-reliability/use-cases/alert-quality-management/alert-quality-management.json',
        responseType: "stream"
    };

    await axios(config)
        .then(function (response) {

            streamToFile(response.data, DB_TEMPLATE);
          // response.data.pipe(fs.createWriteStream(DB_TEMPLATE));
            if (response.status == 200) {
                if(response.data.errors != null)
                {
                    callback("failed: " + JSON.stringify(response.data.errors), response.data.data);
                }
                else
                    callback("success", response.data.data);
            }
            else {
                callback("failed", undefined);
            }
        })
        .catch(function (error) {
            callback("exception:" + error );
        });
}

async function customize_db()
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
    await downloadTemplate(function(result){
        console.log("dashboard template download: " + result);
        // if success,  else fail out.
    })

    // customize the template.
    await customize_db();

    console.log("Uploading dashboard to your account")
    var datapayload2 = JSON.stringify({
        query: `mutation ($accountidval: Int!, $dashboardval: DashboardInput!) {
            dashboardCreate(accountId: $accountidval, dashboard: $dashboardval) {
                    errors {
                        description
                    }
                }
             }`,
        variables: { "accountidval": accountidval, "dashboardval": customized_db }
    });


    await dispatchToNewRelic(datapayload2, function(result, data){
        console.log("dashboard import result: " + result);
    })




        //  *************** get policies ids ***************************************
        var datapayload_getpolicys = JSON.stringify({
            query: `query ($accountidval: Int!) {
               actor {
                   account(id: $accountidval) {
                    alerts {
                        policiesSearch {
                            policies {
                                id
                                name
                                incidentPreference
                            }
                        }
                    }
                    }
                }
             }`,
            variables: { "accountidval": accountidval}
        });

        console.log("Fetching list of polcies in account: " + accountidval)
        await dispatchToNewRelic(datapayload_getpolicys, function (result, data) {

            if (data.actor.account.alerts.policiesSearch != undefined) {

                for (var i = 0; i < data.actor.account.alerts.policiesSearch.policies.length; i++) {
                    current_policies.push(data.actor.account.alerts.policiesSearch.policies[i].id)
                }
            }

            console.log("get policies " + result + JSON.stringify(current_policies));
        })


    // ******************************* create webhook *************************************

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

        var datapayload_alertwebhook = JSON.stringify({
            query: `mutation ($accountidval: Int!, $alertchannel: AlertsNotificationChannelCreateConfiguration!) {
            alertsNotificationChannelCreate(accountId: $accountidval, notificationChannel: $alertchannel) {
                    notificationChannel {
                    ... on AlertsWebhookNotificationChannel {
                        id
                    name
                      }
                    }

                    error {
                        description
                        errorType

                    }
                }
             }`,
            variables: {"accountidval": accountidval, "alertchannel": wh1}
        });

        console.log("Creating webhook in account: " + accountidval)
        await dispatchToNewRelic(datapayload_alertwebhook, function (result, data) {
            if (data.alertsNotificationChannelCreate.notificationChannel != undefined) {
                webhook_notification_channelid = data.alertsNotificationChannelCreate.notificationChannel.id;
            }
            console.log("webhook create: " + result + "  channel id: " + webhook_notification_channelid)
            //   console.log("alert webhook setup " + result  + webhook_notification_channelid);
        })

    // **************************** END Webhook **********************/




        /*************************** add notification channel to all policies **************/

       console.log("Applying webhook to each policly")
        for(var pidx = 0 ; pidx < current_policies.length; pidx++ ) {

            const targetpolid = current_policies[pidx];

            var datapayload_addchannel = JSON.stringify({
                query: `mutation ($accountidval: Int!, $channelidval: ID!, $policyidval: ID!) {
            alertsNotificationChannelsAddToPolicy(accountId: $accountidval, notificationChannelIds: [$channelidval], policyId: $policyidval) {
                 errors {
                      description
                      errorType
                      notificationChannelId
                    }
                }
             }`,
                variables: {
                    "accountidval": accountidval,
                    "channelidval": webhook_notification_channelid,
                    "policyidval": targetpolid
                }
            });

            console.log("Attaching webhook to policy: " + targetpolid)
            await dispatchToNewRelic(datapayload_addchannel, function (result, data) {
                console.log("add channel to policy " + result);
            })
        }

}


runner();