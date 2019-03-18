var prompt = require("prompt");
var colors = require("colors/safe");
var replace = require("replace-in-file");
var fs = require("fs").promises;
var https = require("https");
var srcDir = "./";

var schema = {
    properties: {
      org: {
        description: colors.yellow("Please provide the Apigee Edge Organization name"),
        message: colors.red("Apigee Edge Organization name cannot be empty!"),
        required: true
      },
      env: {
        description: colors.yellow("Please provide the Apigee Edge Environment name"),
        message: colors.red("Apigee Edge Environment name cannot be empty!"),
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

function setRequestOptions(verb, path, options){
    return {
        hostname: "api.enterprise.apigee.com",
        port: 443,
        path: path,
        method: verb,
        headers : { "Authorization" : "Bearer " + options.token, 'Content-Type': 'application/json' }
    };
    
}

async function getNextProduct(startKey, options){
    return await doRequest(
        setRequestOptions(
        'GET', 
'https://api.enterprise.apigee.com/v1/organizations/'+options.org+'/apiproducts?expand=true&count=2' + (startKey === '' ? '' : '&startKey='+startKey),
        options)
    );
}

async function updateProduct(product, options) {
    return await doRequest(
        setRequestOptions(
            'PUT',
            'https://api.enterprise.apigee.com/v1/organizations/'+options.org+'/apiproducts/'+product.name,
            options
        ),
        JSON.stringify(product)
    );
}

function doRequest(options, postData) {
    return new Promise(function(resolve, reject) {
        var req = http.request(options, function(res) {
            console.log('statusCode:', res.statusCode);
            console.log('headers:', res.headers);
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error('statusCode=' + res.statusCode));
            }
            var body = [];
            res.on('data', function(chunk) {
                body.push(chunk);
            });
            res.on('end', function() {
                try {
                    body = JSON.parse(Buffer.concat(body).toString());
                } catch(e) {
                    reject(e);
                }
                console.log('RESOLVED!!');
                resolve(body);
            });
        });
        req.on('error', function(err) {
            reject(err);
        });
        if (postData) {
            req.write(postData);
            req.end();
        }
    });
}

async function writeBackupFile(fileName, content){
    await fs.writeFile(fileName+'.json', content);
}
