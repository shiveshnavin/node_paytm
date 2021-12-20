var express=require('express')
var app=express()

var MONGOURL="mongodb+srv://username:pasws@host.net/dbname";

/*** 
 * Uncomment in case you want to use multidborm 
 * https://www.npmjs.com/package/multi-db-orm

 const { MultiDbORM, FireStoreDB, MongoDB, SQLiteDB, Sync } = require("multi-db-orm");
var mongodb = new MongoDB(MONGOURL);
app.multidborm = mongodb;

*/

app.set('np_config', {
    "host_url":"http://127.0.0.1:5542", 
    "view_path":"/../views/",
    "paytm_url":"https://securegw-stage.paytm.in",
    "MID":"XXXXX",
    "WEBSITE":"WEBSTAGING",
    "KEY":"XXXXX",
    "CHANNEL_ID":"WAP", 
    "INDUSTRY_TYPE_ID":"Retail",
    "homepage":"/",
    "path_prefix":"_pay",
    "theme_color":"#231530",
    "db_url":MONGOURL // Remove this property in case you want to use multidborm
});

if(process.env.CONFIG){

    app.set('np_config', JSON.parse(process.env.CONFIG));
    console.log('using config from env',process.env.CONFIG);
    
}

require('./index')(app,express)

app.all('/',function(req,res)
{
    res.redirect('/_pay/init')
})


app.listen(process.env.PORT  || 5542,function()
{

    console.log("Server Started At ",process.env.PORT  || 5542)

})
