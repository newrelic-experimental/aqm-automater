[![New Relic Experimental header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Experimental.png)](https://opensource.newrelic.com/oss-category/#new-relic-experimental)

# aqm-automater 

>Simple nodejs script that automate the Alert Quality Managment (AQM) steps. 

## Installation

> npm install to install all dependencies 

## Getting Started
> This script automates the following AQM steps.  
> 1.  Creation of AQM Dashboard
> 2.  Creation of Webhook notification channel
> 3.  Association of the notification channel with ALL of your accounts Alert policies. 

## Usage
##### Single Account: node main.js -c yourconfig.json 
>
For single accounts, use the example config_single_account.json template for you config.
>
config file details:
 - account_id(required):  target account number
 
 - api_key(required): either NR user key OR NR insights insert key
 >>  NR user key  will provide both authorization for the requests as well as the webhook auth. 
 >>  Insight insert key will only be used for webhook, so you must provide a cooke(see below)
 
 - cookie: NR admin cookie(from gql request header via browser).  Please make sure that all internal quotes in cookie string are escaped
 
>
> 
##### Master / Sub Account: node master_sub_main.js -c yourconfig.json
>
For master/sub accounts, use the example config_master_sub.json template for you config.
>
>
> 

## Building

before running the script install the required modules :   npm install


## Support

New Relic hosts and moderates an online forum where customers can interact with New Relic employees as well as other customers to get help and share best practices. Like all official New Relic open source projects, there's a related Community topic in the New Relic Explorers Hub. You can find this project's topic/threads here:


## Contributing
We encourage your contributions to improve aqm-automater ! Keep in mind when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.
If you have any questions, or to execute our corporate CLA, required if your contribution is on behalf of a company,  please drop us an email at opensource@newrelic.com.

**A note about vulnerabilities**

As noted in our [security policy](../../security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [HackerOne](https://hackerone.com/newrelic).

## License
aqm-automater  is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.
>[If applicable: The aqm-automater  also uses source code from third-party libraries. You can find full details on which libraries are used and the terms under which they are licensed in the third-party notices document.]
