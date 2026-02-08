const express = require('express');
const { SQLiteDB } = require('multi-db-orm');
const { createPaymentMiddleware } = require('./index');

try { require('dotenv').config(); } catch (e) { }

const app = express();

// Local SQLite sample DB via multi-db-orm; swap for your own adapter
const db = new SQLiteDB('test.db');

const payment = createPaymentMiddleware({
    host_url: process.env.NP_HOST_URL || 'http://localhost:5543',
    path_prefix: process.env.NP_PATH_PREFIX || '_pay',
    homepage: '/',
    payu_url: 'https://secure.payu.in', // use https://test.payu.in for sandbox
    MID: process.env.NP_MID || '12345',
    WEBSITE: process.env.NP_WEBSITE || 'WEBSTAGING',
    KEY: process.env.NP_KEY || 'abcdef',
    SECRET: process.env.NP_SECRET || 'abcdef', // salt for payu / razor
    CHANNEL_ID: process.env.NP_CHANNEL_ID || 'WAP',
    INDUSTRY_TYPE_ID: process.env.NP_INDUSTRY_TYPE_ID || 'Retail',
    theme: {
        primary: '#231530',
        accent: '#5ce1e6',
    },
    brand: 'DemoPay',
}, db);

app.use(payment);

app.listen(process.env.PORT || 5543, function () {
    console.log('Server started at', process.env.PORT || 5543);
});
