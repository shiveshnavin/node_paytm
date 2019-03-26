module.exports=(app,express,callbacks)=>{

    return require('./app/routes/payment_route.js')(app,express,callbacks) 

};
 