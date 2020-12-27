## Node JS PayTm Easy Integration

Does all the hardwork for you while integrating paytm with nodejs server. 

## Example 

Demo : https://node-paytm.herokuapp.com/_pay/init

Use any Card Details or Net Banking 
username : test
password : test

Git : https://github.com/shiveshnavin/payment-gateway-example

### Requirments

1. MongoDB / Firestore / SQlite
2. Your Paytm Credentials 
3. Express . This only works with NodeJS express server

You can get your paytm credentials here
https://developer.paytm.com/docs



![Alt text](public/start.png "Start")

![Alt text](public/start2.png "Start")

![Alt text](public/pay.png "Start")

![Alt text](public/stat.png "Start")
 

### Install

```code
npm install node-paytmpg --save
```

In your main nodejs file set paytm configuration in express app


```code
host_url : Host URL of your server . This will be used to redirect user after payment
view_path : Ignore and dont change unless you know what you are doing . This is the useful in case you want to modify payment init page from node_paytm_pg library
paytm_url : For Test "https://securegw-stage.paytm.in" and for Production "https://securegw.paytm.in"
MID : Your Paytm Merchant ID
Website : "WEBSTAGING" for Test and for Production , the website you entered while activation
KEY : Your Unique Key from Paytm used for hashing 
CHANNEL_ID : Know More at Paytm Docs
INDUSTRY_TYPE_ID : Know More at Paytm Docs
homepage : Homepage of your website where user can go after payment confirmation page
path_prefix : All node_paytm_pg apis/pages will be available relative to this path prefix
db_url : Your MongoDB url in case you want to use legacy mongodb connection . You can use multidborm to support MongoDB/Firestore/Sqlite
id_length: Length of Order ID and User ID

```

Place these 2 statements in your main nodejs file before calling app.listen(..)

```javascript

/*** 
 * Uncomment in case you want to use multidborm to support 
 * MongoDB / Firestore / SQlite
 * https://www.npmjs.com/package/multi-db-orm
 * Refer to example.js

 const { MultiDbORM, FireStoreDB, MongoDB, SQLiteDB, Sync } = require("multi-db-orm");
var mongodb = new MongoDB(MONGOURL);
app.multidborm = mongodb;

*/

app.set('np_config', {
    "host_url":"http://127.0.0.1:5542", 
    "view_path":"/../views/",
    "paytm_url":"https://securegw-stage.paytm.in",
    "MID":"XXXXXXXXXXX",
    "WEBSITE":"WEBSTAGING",
    "KEY":"XXXXXXXXXXX",
    "CHANNEL_ID":"WEB", 
    "INDUSTRY_TYPE_ID":"Retail",
    "homepage":"/_pay/home",
    "path_prefix":"_pay",
    "db_url":"mongodb://user:password123@db.host.com:5551/dbname_123", // Remove this property in case you want to use multidborm
    "id_length":10

});

require('node-paytmpg')(app,express)

```

### Basic Usage 
 

#### Method 1 : Ask user to enter Details
```
simply open page /_pay/init in browser
```
#### Method 2 : Post these params to /_pay/init using browser form
```
NAME
EMAIL
MOBILE_NO
PRODUCT_NAME
TXN_AMOUNT
```

####  Method 3 : Using API . Useful for Integrating on Mobile App
```
Create an Order by posting to URL /_pay/api/createTxn

NAME
EMAIL
MOBILE_NO
PRODUCT_NAME
TXN_AMOUNT

This will generate an orderId in response . 
Now Post to  /_pay/init using browser form

NAME
EMAIL
MOBILE_NO
ORDER_ID

```
APIS
```
For Checking Status

method : POST
path : /_pay/api/status
Params:
ORDER_ID

```

### Advanced  

You can use callbacks to sync node-paytmpg transactions with you own database using .

```
var PayTMPG=require('node-paytmpg')(app,express,{

    onStart:function(orderid,data)
    {
        console.log("Payment has started \n",orderid,data)
    },
    onFinish:function(orderid,data)
    {
        console.log("Payment Has finished \n",orderid,data)

    }

})

var Transaction=PayTMPG.Transaction;
var User=PayTMPG.User;

 Transaction.findOne({orderId:req.body.ORDERID},function(err,data){

	console.log(data)	

  })


```



License : GPL

Donate : 
[<img src="https://www.iconfinder.com/icons/379454/download/png/128">](https://www.instamojo.com/@shiveshnavin)


