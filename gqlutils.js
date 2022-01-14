var axios = require('axios');
var fs = require('fs');
var fsp = require('fs').promises;
var fetch = require('node-fetch');


const DB_TEMPLATE = './alert-quality-mgt-template.json';
var mycookie = undefined;

async function dispatchToNewRelic(api_key, datapayload, callback)
{
    var url_cust = 'https://api.newrelic.com/graphql';
    var url_product = 'https://nerd-graph.service.newrelic.com/graphql';

    // if cookie is valid,  use product url
    var url = url_product;
    if(mycookie != undefined && mycookie.length > 0)
        url = url_product
    else
        url = url_cust;

    var _headers = {
        'Content-type': 'application/json',
        'Accept': 'application/json',
        'Accept-Charset': 'utf-8',
        'x-api-key': api_key // 'dummy-required-value'
    };

    const fetch_options = {
        method: 'POST',
        headers: _headers,
        body: datapayload
    }

    if(mycookie != undefined && mycookie.length > 0)
        fetch_options.headers.Cookie = mycookie;

    const response = await fetch(url, fetch_options);
    const jsondata =  await response.json();
    var statusmsg = response.status == 200 ? 'Success': 'Failed';

    callback(statusmsg, jsondata.data);
}

var utils = module.exports = {

     setAuthCookie: function(cookie)
     {
         mycookie = cookie;
     },
     constructWebHook: function(accountnumber, api_key)
     {
         var wh_body = '{"eventType":"nrAQMIncident","account_id": "$ACCOUNT_ID","account_name": "$ACCOUNT_NAME","closed_violations_count_critical": "$CLOSED_VIOLATIONS_COUNT_CRITICAL","closed_violations_count_warning": "$CLOSED_VIOLATIONS_COUNT_WARNING","condition_description": "$DESCRIPTION","condition_family_id": "$CONDITION_FAMILY_ID","condition_name": "$CONDITION_NAME","current_state": "$EVENT_STATE", "details": "$EVENT_DETAILS", "duration": "$DURATION", "event_type": "$EVENT_TYPE", "incident_acknowledge_url": "$INCIDENT_ACKNOWLEDGE_URL", "incident_id": "$INCIDENT_ID", "incident_url": "$INCIDENT_URL", "metadata": "$METADATA", "open_violations_count_critical": "$OPEN_VIOLATIONS_COUNT_CRITICAL", "open_violations_count_warning": "$OPEN_VIOLATIONS_COUNT_WARNING", "owner": "$EVENT_OWNER", "policy_name": "$POLICY_NAME", "policy_url": "$POLICY_URL", "runbook_url": "$RUNBOOK_URL", "severity": "$SEVERITY", "targets": "$TARGETS", "timestamp": "$TIMESTAMP", "timestamp_utc_string": "$TIMESTAMP_UTC_STRING", "violation_callback_url": "$VIOLATION_CALLBACK_URL", "violation_chart_url": "$VIOLATION_CHART_URL"}';

         var wh1 = {
             webhook: {
                 name: "AQM Events",
                 baseUrl: "https://insights-collector.newrelic.com/v1/accounts/"+ accountnumber+"/events",
                 customHttpHeaders: [{name: "X-Insert-Key", value: api_key}],
                 customPayloadBody: wh_body,
                 customPayloadType: 'JSON'
             }
         }

         return wh1;

     },
    parseConfig: async function (filepath, callback)
    {
        // fixup the downloaded db template.. with account number
        console.log('Reading Config File')
        const data = await fsp.readFile(filepath, 'utf8');  // note this is using the promises version.

        // cleanup the double quotes
        const usingSplit = data.split(''); //convert to array.
        var start = data.indexOf('cookie'); // find search start
        var endstop = data.lastIndexOf("\"");  //find the last quote,
        var quotecnt = 0;
        for (var i = start+10; i < endstop; i++) {

            if(usingSplit[i] == "\"" && usingSplit[i-1] != "\\")  // if we find a quote, and there is no \ at the prev index...
            {
                usingSplit.splice(i,0,"\\"); // insert \
                quotecnt++;
                endstop++; // every time we add a char, inc the last index.
                i++;
            }
        }
        console.log("quote count: "+ quotecnt);
        var fixedup = usingSplit.join("");  // convert array back to string
        var cfg = JSON.parse(fixedup);
        callback(cfg);
    },
     downloadTemplate: async function(callback) {

        var config = {
            method: 'get',
            url: 'https://raw.githubusercontent.com/newrelic/oma-resource-center/main/src/content/docs/oma/value-drivers/uptime-performance-and-reliability/use-cases/alert-quality-management/alert-quality-management.json',
            responseType: "stream"
        };

        await axios(config)
            .then(function (response) {

                let writer = fs.createWriteStream(DB_TEMPLATE)
                // pipe the result stream into a file on disc
                response.data.pipe(writer)

                //  response.data.pipe(fs.createWriteStream(DB_TEMPLATE));

                // return a promise and resolve when download finishes
                return new Promise((resolve, reject) => {
                    writer.on('finish', () => {
                        resolve(true)
                        callback("success", response.data.data);
                    })

                    writer.on('error', (error) => {
                        reject(error)
                        callback("failed: " + JSON.stringify(response.data.errors), response.data.data);
                    })
                })
            })
            .catch(function (error) {
                callback("exception:" + error);
            });
    },
    addDashboardToAccount: async function(api_key, accountidval, customized_db)
    {
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


        await dispatchToNewRelic(api_key, datapayload2, function(result, data){
            console.log("dashboard import result: " + result);
        })
    },
    getPolicyIDlist: async function(api_key, accountidval, callback)
    {
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
        await dispatchToNewRelic(api_key, datapayload_getpolicys, function (result, data) {

            var current_policies = [];
            if (data.actor.account.alerts.policiesSearch != undefined) {

                for (var i = 0; i < data.actor.account.alerts.policiesSearch.policies.length; i++) {
                    current_policies.push(data.actor.account.alerts.policiesSearch.policies[i].id)
                }

                callback(current_policies)
            }

            console.log("get policies returned list: " + result + JSON.stringify(current_policies));
        })

    },
    createAQMWebhook: async function(api_key, accountidval, webhhook_json, callback)
    {
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
            variables: {"accountidval": accountidval, "alertchannel": webhhook_json}
        });

        console.log("Creating webhook in account: " + accountidval)
        await dispatchToNewRelic(api_key, datapayload_alertwebhook, function (result, data) {
            var webhook_notification_channelid = undefined;
            if (data.alertsNotificationChannelCreate.notificationChannel != undefined) {
                webhook_notification_channelid = data.alertsNotificationChannelCreate.notificationChannel.id
                callback(webhook_notification_channelid);
                //webhook_notification_channelid = data.alertsNotificationChannelCreate.notificationChannel.id;
            }
            console.log("webhook create: " + result + "  channel id: " + webhook_notification_channelid)
            //   console.log("alert webhook setup " + result  + webhook_notification_channelid);
        })
    },
    addWebHookToPolicyList: async function(api_key, accountidval, webhook_chan_id,  policies) {

        console.log("Applying webhook to each policly")
        for(var pidx = 0 ; pidx < policies.length; pidx++ ) {

            const targetpolid = policies[pidx];

            // construct the payload.
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
                    "channelidval": webhook_chan_id,
                    "policyidval": targetpolid
                }
            });

            console.log("Attaching webhook to policy: " + targetpolid)
            await dispatchToNewRelic(api_key, datapayload_addchannel, function (result, data) {
                console.log("add channel to policy " + result);
            })
        }
    }


}