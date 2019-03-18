var prompt = require("prompt");
var colors = require("colors/safe");
var replace = require("replace-in-file");
var fsSync = require("fs");
var fs = require("fs").promises;

var rq = require("request");
const request = require("request-promise");
var srcDir = "./";

var schema = {
    properties: {
      org: {
        description: colors.yellow("Please provide the Apigee Edge Organization name"),
        message: colors.red("Apigee Edge Organization name cannot be empty!"),
        required: true
      },
      token: {
        description: colors.yellow("Please provide the Apigee Edge Access Token"),
        message: colors.red("Apigee Edge Access Token cannot b empty!"),
        hidden: true,  
        replace: '*',
        required: true
      }
    }
  };
 
//
// Start the prompt
//
prompt.start();

prompt.get(schema, async function (err, options) {
    
    let index = 0;
    let startKey = '';
    let next = true;
    while (next){
        let products = await getNextProduct(startKey, options);
        if(products.apiProduct.length && products.apiProduct.length == 1){
            if(startKey === '') {
                await processProduct(products.apiProduct[0], options);
            }
            break;
        } else if (products.apiProduct.length && products.apiProduct.length > 1) {
            if(index == 0){
                await processProduct(products.apiProduct[0], options);
            }
            index++;
            await processProduct(products.apiProduct[1], options);
            startKey = products.apiProduct[1].name;
        } else {
            break;
        }
    }
  
});

async function processProduct(product, options){
    console.log('Processing ' + product.name);
    let productString = JSON.stringify(product);
    if(product.proxies && product.proxies.includes('edgemicro-auth')){
        return;
    } else {
        let hasEdgemicroAware = false;
        product.proxies.forEach(function(proxyName){
            if(proxyName.startsWith("edgemicro_")){
                hasEdgeMicroAware = true;
            }
        });
        if(hasEdgeMicroAware){
            console.log(product.name + ' product has edgemicro aware proxies! Creating backup...');
            writeBackupFile(product.name, productString);
            console.log(product.name + ' product has edgemicro aware proxies! Updating...');
            product.proxies.push('edgemicro-auth');
            await updateProduct(product, options);
        }else {
            return;
        }
    }
    
}

function setGetRequestOptions(verb, path, startKey, options){
    return {
        uri: "https://api.enterprise.apigee.com" + path,
        qs: {
            expand: true,
            count: 2,
            startKey: startKey
        },
        headers : { "Authorization" : "Bearer " + options.token, 'Content-Type': 'application/json' },
        json: true
    };
    
}

function setPutRequestOptions(verb, path, options, body){
    return {
        uri: "https://api.enterprise.apigee.com"+path,
        method: verb,
        body: body,
        headers : { "Authorization" : "Bearer " + options.token, 'Content-Type': 'application/json' },
        json: true
    };
    
}

async function getNextProduct(startKey, options){
    return await doRequest(
        setGetRequestOptions(
        'GET', 
'/v1/organizations/'+options.org+'/apiproducts',
startKey,
        options)
    );
}

async function updateProduct(product, options) {
    return await doRequest(
        setPutRequestOptions(
            'PUT',
            '/v1/organizations/'+options.org+'/apiproducts/'+product.name,
            options,
            product
        )
    );
}

async function doRequest(options) {
    const resp = await request(options);
    //console.log(resp);
    return resp;
}

function writeBackupFile(fileName, content){
    if(!fsSync.existsSync('./backup/')){
        fsSync.mkdirSync('./backup/');
    }
    fs.writeFileSync('./backup/'+fileName+'.json', content);
}
