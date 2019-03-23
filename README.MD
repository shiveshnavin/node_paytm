## Node JS PayTm Easy Integration

Does all the hardwork for you while integrating paytm with nodejs server. 

#### Requirments

1. MongoDB
2. Your Paytm Credentials 
3. Express . This only works with NodeJS express server

You can get your paytm credentials here
https://developer.paytm.com/docs

#### Install

```code
npm install node_paytm_pg
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
db_url : Your MongoDB url

```
Place these 2 statements in your main nodejs file before calling app.listen(..)

```javascript


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
    "db_url":"mongodb://user:password123@db.host.com:5551/dbname_123"

});

require('node_paytm_pg')(app,express)

```

#### Using 

Pages
```
Method 1 : Ask user to enter Details

simple open page /_pay/init in browser

Method 2 : Post these params to /_pay/init using form

NAME
EMAIL
MOBILE_NO
PRODUCT_NAME
TXN_AMOUNT

Method 3 : Using API . Useful for Integrating on Mobile App

NAME
EMAIL
MOBILE_NO
PRODUCT_NAME
TXN_AMOUNT

This will generate an orderId in response . 
Now Post to  /_pay/init  using form

NAME
EMAIL
MOBILE_NO
ORDER_ID

```
APIS
```
For Checking Status

method : POST
path : /_pay/status
Params:
ORDER_ID

```


Create an Order by posting to URL /_pay/init


![Alt text](public/start.png "Start")

![Alt text](public/start2.png "Start")

![Alt text](public/pay.png "Start")

![Alt text](public/stat.png "Start")

 
