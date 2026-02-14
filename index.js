const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');
const mongoose = require('mongoose');

const buildConfig = require('./lib/config/buildConfig');

/**
 * Creates an isolated payment middleware that can be mounted on any Express app.
 * This keeps the payment creation/verification logic intact while exposing a cleaner API.
 *
 * @param {object} userConfig - configuration overrides (gateway keys, branding, hooks, etc.)
 * @param {object} db - optional multi-db-orm instance; if omitted and db_url is provided, MongoDB is used
 * @returns {import('express').Application} configured sub-application ready to mount
 */
function createPaymentMiddleware(userConfig = {}, db, authenticationMiddleware) {
    const config = buildConfig(userConfig);
    const subApp = express();
    if(!authenticationMiddleware) {
        authenticationMiddleware = (req, res, next) => next();
    }

    // expose config + optional db handle for downstream controllers
    subApp.set('np_config', config);
    subApp.locals.theme = config.theme || {};
    subApp.locals.brand = config.brand || 'Secure Pay';
    subApp.locals.logo = config.logo;
    subApp.locals.themeName = config.themeName || (config.theme && config.theme.name) || 'dark';
    if (config.db_url) {
        mongoose.Promise = global.Promise;
        mongoose.connect(config.db_url, {
            useUnifiedTopology: true,
            useNewUrlParser: true,
        }).then(() => {
            console.log('PaytmPG : Connected to MongoDB');
        }).catch(err => {
            console.log('PaytmPG : Failed to connect MongoDB', err);
        });
    } else if (db) {
        subApp.multidborm = db;
    }

    // view engine + theming
    const viewRoot = config.templateDir
        ? path.resolve(config.templateDir)
        : path.join(__dirname, 'app', 'views');
    const layoutPath = path.join(viewRoot, 'layouts', 'index.hbs');

    subApp.engine('hbs', exphbs({
        extname: 'hbs',
        defaultLayout: layoutPath,
        helpers: {
            theme_color: () => config.theme_color,
            logo: () => config.logo,
            brand: () => config.brand || 'Secure Pay',
        },
    }));
    subApp.set('view engine', 'handlebars');

    // body parsing with raw body capture (needed for webhooks)
    const saveRawBody = (req, res, buf) => {
        req.rawBody = buf.toString();
    };
    subApp.use(bodyParser.urlencoded({ extended: true }));
    subApp.use(bodyParser.json({ verify: saveRawBody }));
    // wire routes against existing payment controller (logic unchanged)
     const callbacks = config.callbacks || userConfig.callbacks;
    const pc = require('./app/controllers/payment_controller')(subApp, callbacks);
    subApp.use((req, res, next) => {
        console.log('Received request at', req.originalUrl);
        next();
    });
    subApp.all('/init',authenticationMiddleware, pc.init);
    subApp.all('/callback',authenticationMiddleware, pc.callback);
    subApp.all('/api/webhook',authenticationMiddleware, pc.webhook);
    subApp.all('/api/status',authenticationMiddleware, pc.status);
    subApp.all('/api/transactions',authenticationMiddleware, pc.getTransactions);
    subApp.all('/api/createTxn/token',authenticationMiddleware, pc.createTxnToken);
    subApp.all('/api/createTxn',authenticationMiddleware, pc.createTxn);
    subApp.all('/', authenticationMiddleware, pc.init);

    subApp.use(express.static(path.join(__dirname, 'public')), authenticationMiddleware, pc.init);

    return subApp;
}

module.exports = { createPaymentMiddleware };


