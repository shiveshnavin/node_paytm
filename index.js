module.exports = (app, express, callbacks) => {

    var module = {};

    if (app && express) {
        require('./app/routes/payment_route.js')(app, express, callbacks)
        var config = (app.get('np_config'))
        if (config.db_url) {

            module.Transaction = require('./app/models/np_transaction.model.js')
            module.User = require('./app/models/np_user.model.js')

        } else if (app.multidborm) {

            module.Transaction = app.NPTransaction;
            module.User = app.NPUser;

        }
    }

    return module;
};

