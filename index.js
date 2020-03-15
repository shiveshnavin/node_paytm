module.exports=(app,express,callbacks)=>{

    var module = {};

    module.Transaction=require('./app/models/np_transaction.model.js')
    module.User=require('./app/models/np_user.model.js')

    if(app && express)
     require('./app/routes/payment_route.js')(app,express,callbacks) 

    return module;
};
 
