module.exports = (app, express, callbacks) => {
    const bodyParser = require('body-parser');
    var exphbs = require('express-handlebars')
    var path = require('path')
    var packageInfo = require('../../package.json')
    var config = (app.get('np_config'))
    var pc = require('../controllers/payment_controller.js')(app, callbacks)
    var router = express.Router()
    app.set('view_path', __dirname + config.view_path)
    var vp = app.get('view_path')
    if (config.db_url !== undefined) {

        const mongoose = require('mongoose');

        console.log('PaytmPG : Using MongoDB');

        mongoose.Promise = global.Promise;

        mongoose.connect(config.db_url, {
            useUnifiedTopology: true,
            useNewUrlParser: true
        }).then(() => {
            console.log("Successfully connected to the database");
        }).catch(err => {
            console.log('Could not connect to the database. Exiting now...', err);
            process.exit();
        });

    } else if (app.multidborm !== undefined) {

        console.log('PaytmPG : Using MultiDB ORM');

    }



    app.engine('hbs', exphbs({
        extname: 'hbs',
        defaultLayout: vp + '/layouts/index.hbs',
        helpers: {
            theme_color: function () {
                return config.theme_color;
            },
            logo: function () {
                return config.logo;
            }
        }
    }))

    app.set('view engine', 'handlebars');

    let saveRawBody = function (req, res, buf, encoding) {      
        req.rawBody = buf.toString();
    }
    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json({ verify: saveRawBody }))

    app.use("/" + config.path_prefix, express.static(path.join(__dirname, '../../public')));
    app.use('/' + config.path_prefix, router);

    router.all('/', pc.init);
    router.all('/init', pc.init);

    // router.all('/home', pc.home)
    router.all('/callback', pc.callback)
    router.all('/api/webhook', pc.webhook)
    router.all('/api/status', pc.status)
    router.all('/api/createTxn/token', pc.createTxnToken)
    router.all('/api/createTxn', pc.createTxn)


    return router
}
