## Node JS PayTm Easy Integration

Does all the hardwork for you while integrating paytm in nodejs . 

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
Change :

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
Place these 2 statements in your main nodejs file

```javascript


app.set('np_config', {
    "host_url":"http://127.0.0.1:5542", 
    "view_path":"/../views/",
    "paytm_url":"https://securegw-stage.paytm.in",
    "MID":"hLhnoB95547314388857",
    "WEBSITE":"WEBSTAGING",
    "KEY":"&ogh@6_yhBjJkLt!",
    "CHANNEL_ID":"WEB", 
    "INDUSTRY_TYPE_ID":"Retail",
    "homepage":"/_pay/home",
    "path_prefix":"_pay",
    "db_url":"mongodb://user:password123@db.host.com:5551/dbname_123"

});

require('node_paytm_pg')(app,express)

```

![Alt text](public/start "Start")

![Alt text](public/start2 "Start")

![Alt text](public/pay "Start")

![Alt text](public/status "Start")

 