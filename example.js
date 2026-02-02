var express = require('express')
var app = express()
try { require('dotenv').config(); } catch (e) { }

// use https://www.npmjs.com/package/multi-db-orm for persistance
const { SQLiteDB } = require("multi-db-orm");
var db = new SQLiteDB("test.db");
app.multidborm = db;

// Configuration: prefer values from environment, fall back to sample defaults
app.set('np_config', {
    host_url: process.env.NP_HOST_URL || 'https://pay.example.com',
    view_path: '/../views/',
    payu_url: 'https://secure.payu.in', // for test use https://test.payu.in
    //"razor_url":"https://api.razorpay.com/v1/", // for test use https://api.razorpay.com/v1/
    //"open_money_url":"https://sandbox.openmoney, // for test use https://sandbox.openmoney
    MID: process.env.NP_MID || '12345',
    WEBSITE: process.env.NP_WEBSITE || 'WEBSTAGING',
    KEY: process.env.NP_KEY || 'abcdef',
    SECRET: process.env.NP_SECRET || 'abcdef', // salt for payu
    CHANNEL_ID: 'WAP',
    INDUSTRY_TYPE_ID: 'Retail',
    homepage: '/',
    path_prefix: '_pay',
    theme_color: '#231530',
    // "db_url":MONGOURL // Remove this property in case you want to use multidborm
});

if (process.env.CONFIG) {
    app.set('np_config', JSON.parse(process.env.CONFIG));
    console.log('using config from env', process.env.CONFIG);
}

require('./index')(app, express)

app.all('/', function (req, res) {
    res.redirect('/_pay/init')
})

app.listen(process.env.PORT || 5542, function () {
    console.log("Server Started At ", process.env.PORT || 5542)
})
