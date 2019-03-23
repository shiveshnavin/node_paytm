module.exports=(app,express)=>{

    return require('./app/routes/payment_route.js')(app,express) 

};
 