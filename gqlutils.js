var axios = require('axios');
var fs = require('fs');
var fsp = require('fs').promises;
var fetch = require('node-fetch');


const DB_TEMPLATE = './alert-quality-mgt-template.json';
var mycookie = undefined; // 'TSNGUID=dc3b186d-01cd-4208-8a38-dcf76b1940dc; optimizelyEndUserId=oeu1606362483890r0.2878838515427362; _biz_uid=51b45e80f4b840678d03b9bbb00e3a38; intercom-id-cyym0u3i=4b4a833e-9a8c-46e1-bc54-48d25130e213; _rdt_uuid=1629397232608.c156b743-2231-4959-89fd-65059e92510c; _biz_flagsA=%7B%22Version%22%3A1%2C%22ViewThrough%22%3A%221%22%2C%22XDomain%22%3A%221%22%2C%22Mkto%22%3A%221%22%7D; __qca=P0-1749433150-1629397232730; campaign_f=Brand-Beta-NORAM; source_f=google; medium_f=cpc; content_f=PRO_LP; gclid_f=Cj0KCQjwwNWKBhDAARIsAJ8HkhcqiknCd70zkqadZVHVsgc1M3tYZhXTYTSc2dlpf1IwOP153QB54HcaAnNGEALw_wcB; _biz_ABTestA=%5B1801634327%2C611651109%5D; ref_page_sub_cat=signup; ref_page_cat=public; _gcl_au=1.1.712260161.1637086880; intercom-id-nj08vq9l=753416d5-f8a0-4e7a-83a8-de062017e387; intercom-session-cyym0u3i=; __zlcmid=17KkWTcx4dOvTm3; _CEFT=EgNwlgpg7hAmBcBZAmgDlhA-gVgJxQGEBVAaGQBEBBAWiNmQAUAtVAZwCAxYAEWAcwBssVAA8A7LgDGAWwBSRIgBYATADMgA; ab_test_homepage_codestream=a; content_l=PRICE_LP; _gcl_aw=GCL.1640050973.Cj0KCQiA8ICOBhDmARIsAEGI6o2S0xm_bgGLMhhy-KbXJCoxMwi4OYmf0pni7AgAySdtAuY3oeLkv1gaAtHNEALw_wcB; _ga=GA1.1.2089718515.1629389637; _mkto_trk=id:341-XKP-310&token:_mch-newrelic.com-1629396557500-97215; nr_zd_logged_in=true; JSESSIONID=78c5128a-54db-4197-89c4-3d38bf1d857c; service-gateway_0=rO0ABXNyADZyYXRwYWNrLnNlc3Npb24uaW50ZXJuYWwuRGVmYXVsdFNlc3Npb24kU2VyaWFsaXplZEZvcm0AAAAAAAAAAgwAAHhwegAABAAAAQABAQAQcGFjNGpVc2VyUHJvZmlsZQEAJG9yZy5wYWM0ai5jb3JlLnByb2ZpbGUuQ29tbW9uUHJvZmlsZQAABGGs7QAFc3IAI29yZy5wYWM0ai5zYW1sLnByb2ZpbGUuU0FNTDJQcm9maWxlk5cl3rB1DHkMAAB4cgAkb3JnLnBhYzRqLmNvcmUucHJvZmlsZS5Db21tb25Qcm9maWxl5j2Ybq91JMsMAAB4cgAib3JnLnBhYzRqLmNvcmUucHJvZmlsZS5Vc2VyUHJvZmlsZX0t4lPmLJbSDAAAeHB0ABVucHJlaXNlckBuZXdyZWxpYy5jb21zcgARamF2YS51dGlsLkhhc2hNYXAFB9rBwxZg0QMAAkYACmxvYWRGYWN0b3JJAAl0aHJlc2hvbGR4cD9AAAAAAAAMdwgAAAAQAAAABnQACWxhc3RfbmFtZXNyABNqYXZhLnV0aWwuQXJyYXlMaXN0eIHSHZnHYZ0DAAFJAARzaXpleHAAAAABdwQAAAABdAAHUHJlaXNlcnh0AAxub3RPbk9yQWZ0ZXJzcgAWb3JnLmpvZGEudGltZS5EYXRlVGltZbg8eGRqW935AgAAeHIAH29yZy5qb2RhLnRpbWUuYmFzZS5CYXNlRGF0ZVRpbWX///nhT10uowIAAkoAB2lNaWxsaXNMAAtpQ2hyb25vbG9neXQAGkxvcmcvam9kYS90aW1lL0Nocm9ub2xvZ3k7eHAAAAF+JoIT/HNyACdvcmcuam9kYS50aW1lLmNocm9uby5JU09DaHJvbm9sb2d5JFN0dWKpyBFmcTdQJwMAAHhwc3IAH29yZy5qb2RhLnRpbWUuRGF0ZVRpbWVab25lJFN0dWKmLwGafDIa4wMAAHhwdwUAA1VUQ3h4dAAKZmlyc3RfbmFtZXQAAHQADHNlc3Npb25pbmRleHQAKF80MWU0OWIyNTM4YzU0MDA4OWRmMTc3NTQyMzQ1ZTgwZDUyNTAyZTF0AAVlbWFpbHQAFW5wcmVpc2VyQG5ld3JlbGljLmNvbXQACW5vdEJlZm9yZXNxAH4ADAAAAX4meOw8cQB+ABF4c3EAfgAFP0AAAAAAAAx3CAAAABAAAAAGdAAIaXNzdWVySWR0AChodHRwOi8vd3d3Lm9rdGEuY29tL2V4a2J0azl1MW4wa3JFQ2JRMHg3dAAMYXV0aG5Db250ZXh0c3EAfgAIAAAAAXcEAAAAAXQAQXVybjpvYXNpczpuYW1lczp0YzpTQU1MOjIuMDphYzpjbGFzc2VzOlBhc3N3b3JkUHJvdGVjdGVkVHJhbnNwb3J0eHEAfgALcQB+AA90ABBzYW1sTmFtZUlkRm9ybWF0dAA2dXJud6M6b2FzaXM6bmFtZXM6dGM6U0FNTDoxLjE6bmFtZWlkLWZvcm1hdDplbWFpbEFkZHJlc3NxAH4AFnEAfgAXcQB+ABpxAH4AG3h3AQBzcgARamF2YS51dGlsLkhhc2hTZXS6RIWVlri3NAMAAHhwdwwAAAAQP0AAAAAAAAB4c3EAfgAkdwwAAAAQP0AAAAAAAAB4dAANTkVXUkVMSUNfU0FNTHB4eA==:u4eT6BwkiSea+GFBqYmLvdLFNf8=; gclid_l=Cj0KCQiA_c-OBhDFARIsAIFg3exp31drEb7mluydO539HCtymlCs3MPc8KAXeLHcmbtbq7TuUSnNijMaAl25EALw_wcB; campaign_l=zoom; medium_l=zoom; source_l=zoom; ref_page_url=https://newrelic.zoom.us/; intercom-session-b6xguukl=dytWNGJVWTZsblBlTElnby9odTZCQzRNREVUMklWM1I3V21CaDgrMmp0T1REbG83Y3pSaGkvWTJmRFRIUkQrbS0tdWdLMlkxcVpmOEgwTnlScFNUMHp0UT09--d6ed369d1c50d1410de4687c64385166716d9918; ratpack_lat_0=AAABfis61LY=:lc3Yt4btQKj/IFsqC8K0VKeNmSY=; ajs_group_id=3352843; ajs_user_id=2702726; _clck=1riv7lj|1|exw|0; _biz_sid=42f46e; _biz_nA=217; _uetsid=c9c799006f1411ec9d5e571e42eb710f; _uetvid=33c6804091b211eb82a57f3dc370f57e; _biz_pendingA=%5B%5D; _clsk=jm5f75|1641506189247|3|1|b.clarity.ms/collect; login_service_login_newrelic_com_tokens=%7B%22token%22%3A+%22gamhgZ2vKSPiOdjNxlo4atuMbgbJjNpBg10XrsEZFgU9y9F%2F%2BZAdCfJY0mBjCpIigmP9kTPSRXo7IkULJmSDv5N%2BXR2qVZuf9K865HQ7fE6Nrtt7l4tx%2BLVdcxXKbN7sOOEHoQXFT6k4SRWDPPjUZQMvCM%2FTUxfEKHCpvdL6uJdBn1%2FItlvig7o4cmnfn1saVXSPlIdCXY%2BYHSnjtBA3tEuKht41Af4AP0erdGmzi8Y%2BDXzOlyAuvBX0Mp%2FhxefI%2BVP5Z1FL%2B6NuL1ClZGLQeuHcGxrqa1cVnLHiz9NWBlqcqiXQ6Bjl4Vm1GBsBQj0UBCbN8XzBzQmgfDc4kQpzMw%3D%3D%22%2C+%22refresh_token%22%3A+%22F8JcI4AK6hz1jDDLhyls5vuOQAtQPQ%2FNoKyds0QJuKeosrnr8vUGWNzr%2FyxHV3XpZuVote6ADPwPDI0DukZt7u3Poh40RYjo%2BCgoZ4bfCZELX7kid%2BZ0wcPCFvMEhLuOzrSI2g4pATXIWTFipLi4HAl89RX%2BxKbBeBAyX2GgirPqA16BJQs4iH71ht7I07K1Hm5ji89UxuBJi3yP1gnHzJwg4SroFfLFeHFwIRFxGfBQkJHJ18KX7YO5y7jeaaGNXLTblISAIxzcMBSPQQnxLzlEWWrtbwPYf8VbbI5LGIZ1rAUSQ0xXSdv9O%2FkA10lGBQS8JQqQNeCJ4w92V34Ofw%3D%3D%22%7D; _ga_GZEX285W2X=GS1.1.1641504028.97.1.1641506193.0; _ce.s=v~5fefb48978a0897ad33cab2e97b4d2df7a2abcf5~vpv~2~ir~1~v11ls~7feaf160-6f3b-11ec-a23a-ef00ddf23ad0~v11.sla~1641506193171~gtrk.la~ky3iekut~v11.send~1641506192820; login_idle_session_timeout={"lastInteractionAt":1641506197,"warningTime":180,"lastIdleLimitCheck":1641505015,"idleLimit":1209600}; TessenSessionId=1641506186297,1641506199378; ajs_anonymous_id=%22a22c763b-0fd0-405b-b69c-cedefc75064d%22';

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