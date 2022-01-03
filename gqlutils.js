
var axios = require('axios');
var fs = require('fs');
var fsp = require('fs').promises;
const DB_TEMPLATE = './alert-quality-mgt-template.json';

var utils = module.exports = {

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
    dispatchToNewRelic: async function(api_key, datapayload, callback)
    {
        var config = {
            method: 'post',
            url: 'https://api.newrelic.com/graphql',
            headers: {
                'Content-Type': 'application/json',
                'API-Key': api_key
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


        await this.dispatchToNewRelic(api_key, datapayload2, function(result, data){
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
        await this.dispatchToNewRelic(api_key, datapayload_getpolicys, function (result, data) {

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
        await this.dispatchToNewRelic(api_key, datapayload_alertwebhook, function (result, data) {
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
            await this.dispatchToNewRelic(api_key, datapayload_addchannel, function (result, data) {
                console.log("add channel to policy " + result);
            })
        }
    }


}