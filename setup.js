var prompt = require("prompt");
var colors = require("colors/safe");
var replace = require("replace-in-file");
var fs = require("fs").promises;
var https = require("request-promise");
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
        let products = getNextProduct(startKey, options);
        console.log(JSON.stringify(products));
        if(products.apiProduct.length && products.apiProduct.length == 1){
            if(startKey === '') {
                processProduct(products.apiProduct[index], options);
            }
            break;
        } else if (products.apiProduct.length && products.apiProduct.length > 1) {
            if(index == 0){
                processProduct(products.apiProduct[index], options);
            }
            index++;
            processProduct(products.apiProduct[index], options);
            startKey = products.apiProduct[index].name;
        } else {
            break;
        }
    }
  
});

function processProduct(product, options){
    console.log('Processing ' + product.name);
    writeBackupFile(product.name, JSON.stringify(product));
    if(product.proxies && product.proxies.includes('edgemicro-auth')){
        return;
    } else {
        product.proxies.push('edgemicro-auth');
        updateProduct(product, options);
    }
    
}

function setGetRequestOptions(verb, path, options){
    return {
        uri: "https://api.enterprise.apigee.com",
        path: path,
        headers : { "Authorization" : "Bearer " + options.token, 'Content-Type': 'application/json' },
        json: true
    };
    
}

function setPutRequestOptions(verb, path, options, body){
    return {
        uri: "https://api.enterprise.apigee.com",
        path: path,
        method: verb,
        body: body,
        headers : { "Authorization" : "Bearer " + options.token, 'Content-Type': 'application/json' }
    };
    
}

async function getNextProduct(startKey, options){
    return await doRequest(
        setGetRequestOptions(
        'GET', 
'https://api.enterprise.apigee.com/v1/organizations/'+options.org+'/apiproducts?expand=true&count=2' + (startKey === '' ? '' : '&startKey='+startKey),
        options)
    );
}

async function updateProduct(product, options) {
    return await doRequest(
        setPutRequestOptions(
            'PUT',
            'https://api.enterprise.apigee.com/v1/organizations/'+options.org+'/apiproducts/'+product.name,
            options,
            product
        )
    );
}

function doRequest(options) {
    return https(options);
}

async function writeBackupFile(fileName, content){
    await fs.writeFile(fileName+'.json', content);
}
