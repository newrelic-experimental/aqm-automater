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
##### example :    node main.js -c yourconfig.json 
<br /> 

There are two schemas for the config files, single and master sub depending on what you are targeting.
Example config files are located in the  **config_templates**  sub dir


**single accounts:**  use the example **config_single_account.json** template for you config.
>
config file details:
 - account_id(required):  target account number, must be integer
 
 - api_key(required): 
    - NR CUSTOMERS: Please use a NR USER KEY for this value
     
    - NR ADMINS: If you don't have access to a customers NR USER KEY, use a NR Insights Insert key here, and include a browser cookie below.
    
 - cookie: NR admin cookie(from gql request header via browser).  
 
<br />

**master/sub accounts:**  use the example **config_master_sub.json** template for you config.

This template is used when you want to apply the aqm to both master and sub(child) accounts.  
config file details:
 
 - masteraccount(requied)  -- same as above
 - subaccounts(requied)-- for each sub account you want to apply, add a apikey and account number.  
    NR CUSTOMERS use NR user key for api key 
    NR ADMINS use same as above . 
 
 
<br /> 

**Testing the results**
<br />
Its a good idea to test if the script worked.  Go to your notification channels and find the AQMEvents channel, open it and 
hit Test.  Make sure you get back a status 200. 
Also,  check that the Alerts Quality Managment Dashboard is present in your account.  
 
 
## Building

before running the script install the required modules :  npm install

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
