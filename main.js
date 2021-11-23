var accountidval = undefined; 
var API_KEY = undefined;
var axios = require('axios');
var fs = require('fs');


var current_policies = []
var webhook_notification_channelid = "";  // the id of the new wh channel we created.
const commandLineArgs = require('command-line-args')

const optionDefinitions = [
    { name: 'key', alias: 'k', type: String },
    { name: 'account', alias: 'a', type: Number }
]

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
//console.log(options)

accountidval = options.account;
API_KEY = options.key;
const rawdata = fs.readFileSync('alert-quality-mgt.json', 'utf8');

// fixup the db template.. with account number
const replacer = new RegExp("XXXXXXX", 'g')
var fixedup = rawdata.replace(replacer, accountidval);
let dashboard_temp = JSON.parse(fixedup);

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

async function runner() {


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



    await dispatchToNewRelic(datapayload_alertwebhook, function (result, data) {

        if (data.alertsNotificationChannelCreate.notificationChannel != undefined) {
            webhook_notification_channelid = data.alertsNotificationChannelCreate.notificationChannel.id;
        }

        console.log("webhook channel id: " + webhook_notification_channelid)
        //   console.log("alert webhook setup " + result  + webhook_notification_channelid);
    })

// **************************** END Webhook **********************



// *************************** dashboard , ********************************************
    // todo:  add check for pre-existing db with that name .. if exists,  don't add.


    var datapayload2 = JSON.stringify({
        query: `mutation ($accountidval: Int!, $dashboardval: DashboardInput!) {
            dashboardCreate(accountId: $accountidval, dashboard: $dashboardval) {
                    errors {
                        description
                    }
                }
             }`,
        variables: { "accountidval": accountidval, "dashboardval": dashboard_temp }
    });


    await dispatchToNewRelic(datapayload2, function(result, data){

        console.log("dashboard setup " + result);
    })


    /*************************** add notification channel to all policies **************/

   // webhook_notification_channelid = "5727280";  // the id of the new wh channel we created.
   // current_policies.push("1254689");
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


        await dispatchToNewRelic(datapayload_addchannel, function (result, data) {
            console.log("add channel to policy " + result);
        })
    }

}


runner();