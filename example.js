var express=require('express')
var app=express()

var MONGOURL="mongodb+srv://username:pasws@host.net/dbname";

/*** 
 * Uncomment in case you want to use multidborm 
 * https://www.npmjs.com/package/multi-db-orm


*/
const { MultiDbORM, FireStoreDB, MongoDB, SQLiteDB, Sync } = require("multi-db-orm");
var mongodb = new SQLiteDB();
app.multidborm = mongodb;

app.set('np_config', {
    "host_url":"http://127.0.0.1:5542", 
    "view_path":"/../views/",
    "payu_url":"https://test.payu.in",
    //"razor_url":"https://api.razorpay.com/v1/",
    //"open_money_url":"https://sandbox.openmoney
    "MID":"4fd0a71ccddacdb3023063340ede80a5adce7cb305e2ca99f772aa4f846f4f12",
    "WEBSITE":"WEBSTAGING",
    "KEY":"4nuyEF",
    "SECRET":"dGZLFqrZOR9ZWsUxRV0E10EE6hE36Xda",
    "CHANNEL_ID":"WAP", 
    "INDUSTRY_TYPE_ID":"Retail",
    "homepage":"/",
    "path_prefix":"_pay",
    "theme_color":"#231530",
    // "db_url":MONGOURL // Remove this property in case you want to use multidborm
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
