module.exports=(app,express)=>{
    const bodyParser = require('body-parser');
    const mongoose = require('mongoose');
    var exphbs=require('express-handlebars')
    var path=require('path')
    var packageInfo=require('../../package.json')
    var config=require('../../config.json')
    var pc=require('../controllers/payment_controller.js')
    var router=express.Router()
    app.set('view_path',__dirname+config.view_path)
    var vp=app.get('view_path')  

    mongoose.Promise = global.Promise;
    
    mongoose.connect(config.db_url, {
        useNewUrlParser: true
    }).then(() => {
        console.log("Successfully connected to the database");    
    }).catch(err => {
        console.log('Could not connect to the database. Exiting now...', err);
        process.exit();
    });
 

    app.engine('hbs',exphbs({
        extname: 'hbs', 
        defaultLayout: vp+'/layouts/index.hbs'
    }))
    
    app.set('view engine', 'handlebars');
     
    app.use(bodyParser.urlencoded({ extended: true })) 
    app.use(bodyParser.json())
    app.use("/"+config.path_prefix,express.static(path.join(__dirname, '../../public')));  
    app.use('/'+config.path_prefix , router);
     
    router.all('/', function(req,res)
    {
        res.send({message:packageInfo.description,developer:packageInfo.author,version:packageInfo.version})

    });

    router.all('/home',pc.home)
    router.all('/init',pc.init)
    router.all('/callback',pc.callback)
    router.all('/api/status',pc.status)
    router.all('/api/createTxn',pc.createTxn)


 
}