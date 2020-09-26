var express=require('express')
var app=express()


app.set('np_config', {
    "host_url":"https://my-host-url.server.com", 
    "view_path":"/../views/",
    "paytm_url":"https://securegw-stage.paytm.in",
    "MID":"XXX",
    "WEBSITE":"WEBSTAGING",
    "KEY":"XXXX",
    "CHANNEL_ID":"WAP", 
    "INDUSTRY_TYPE_ID":"Retail",
    "homepage":"/",
    "path_prefix":"_pay",
    "db_url":"mongodb://heroku_szpxpx4x:cati8533i869nd5uv6scq1e11v@ds113826.mlab.com:13826/heroku_szpxpx4x"
 
});
if(process.env.CONFIG){

    app.set('np_config', JSON.parse(process.env.CONFIG));
    console.log('using config from env',process.env.CONFIG);
    
}

require('node-paytmpg')(app,express)

app.all('/',function(req,res)
{
    res.redirect('/_pay/init')
})


app.listen(process.env.PORT  || 5542,function()
{

    console.log("Server Started At ",process.env.PORT  || 5542)

})
