var express=require('express')
var app=express()


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

require('./app/routes/payment_route.js')(app,express)

app.all('/',function(req,res)
{
    res.redirect('/_pay/init')
})


app.listen(process.env.PORT  || 5542,function()
{

    console.log("Server Started At ",process.env.PORT  || 5542)

})
