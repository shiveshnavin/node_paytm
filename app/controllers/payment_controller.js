var packageInfo=require('../../package.json')
var config=require('../../config.json')
var packageInfo=require('../../package.json')
var packageInfo=require('../../package.json')
var useController=require('./np_user.controller.js');
var Transaction=require('../models/np_transaction.model.js');
const checksum_lib = require('./checksum/checksum.js'); 

function makeid(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  
    for (var i = 0; i < length; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return text;
}

var vp=__dirname+config.view_path

exports.home=(req,res)=>{

    packageInfo.repository.url=packageInfo.repository.url.replace('git+','')
    res.render(vp+"home.hbs",packageInfo)


}

exports.init=(req,res)=>{
 

			

 
    let gotAllParams=true;

    if(req.body!==undefined)
    {
        let checks=[req.body.TXN_AMOUNT,req.body.PRODUCT_NAME,
            req.body.MOBILE_NO,req.body.NAME,req.body.EMAIL]
    
            for(var i=0;i<checks.length;i++)  {
                
                if(checks[i]===undefined)
                {   
                    gotAllParams=false;
                    break;
                }
    
            }
    }
    else
    { 
        gotAllParams=false;
    }
    
    //console.log(req.body)

    if(req.body.ORDER_ID!==undefined && req.body.ORDER_ID.length>2)
    {
       // console.log(req.body)
        var params 						= {};
        params['MID'] 					= req.body.MID;
        params['WEBSITE']				= req.body.WEBSITE;
        params['CHANNEL_ID']			=  req.body.CHANNEL_ID;
        params['INDUSTRY_TYPE_ID']	=  req.body.INDUSTRY_TYPE_ID;
        params['ORDER_ID']			= req.body.ORDER_ID;
        params['CUST_ID'] 			= req.body.CUST_ID;
        params['TXN_AMOUNT']			= req.body.TXN_AMOUNT;
        params['CALLBACK_URL']		= req.body.CALLBACK_URL;
        params['EMAIL']				= req.body.EMAIL;
        params['MOBILE_NO']			= req.body.MOBILE_NO;

        checksum_lib.genchecksum(params, config.KEY, function (err, checksum) {

            var txn_url = "https://securegw-stage.paytm.in/theia/processTransaction"; // for staging
            // var txn_url = "https://securegw.paytm.in/theia/processTransaction"; // for production
           // console.log(checksum)
            var form_fields = "";
            for(var x in params){
                form_fields += "<input type='hidden' name='"+x+"' value='"+params[x]+"' >";
            }
            form_fields += "<input type='hidden' name='CHECKSUMHASH' value='"+checksum+"' >";

            res.writeHead(200, {'Content-Type': 'text/html'});
            res.write('<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Processing ! Please do not refresh this page...</h1></center><form method="post" action="'+txn_url+'" name="f1">'+form_fields+'</form><script type="text/javascript">document.f1.submit();</script></body></html>');
            res.end();
        });
    }
    else if(!gotAllParams)
        {

            res.render(vp+"init.hbs",{

                action:'',
                readonly:'',
                check:true,
                BUTTON:'Submit',
                NAME:(req.body.NAME===undefined?'':req.body.NAME),
                EMAIL:(req.body.EMAIL===undefined?'':req.body.EMAIL),
                MOBILE_NO:(req.body.MOBILE_NO===undefined?'':req.body.MOBILE_NO),
                PRODUCT_NAME:(req.body.PRODUCT_NAME===undefined?'':req.body.PRODUCT_NAME),
                TXN_AMOUNT:(req.body.TXN_AMOUNT===undefined?'':req.body.TXN_AMOUNT),
                MID:config.MID,
                WEBSITE:config.WEBSITE,
                ORDER_ID:'',
                CUST_ID:'',
                INDUSTRY_TYPE_ID:config.INDUSTRY_TYPE_ID,
                CHANNEL_ID:config.CHANNEL_ID, 
                CALLBACK_URL:config.CALLBACK_URL,
                CHECKSUMHASH:'' 

            })
        }
        else{


            useController.create({name:req.body.NAME,email:req.body.EMAIL,phone:req.body.MOBILE_NO},
                function(user)
                {

                    //console.log(user)
 

                        var txn_url = "https://securegw-stage.paytm.in/theia/processTransaction";
                        // var txn_url = "https://securegw.paytm.in/theia/processTransaction"; 
                        
                        var txnTask=new Transaction({

                                orderId:makeid(6),
                                cusId:user.id,
                                time:Date.now(),
                                status:'INITIATED',
                                name:user.name,
                                email:user.email,
                                phone:user.phone,
                                amount:req.body.TXN_AMOUNT,
                                pname:req.body.PRODUCT_NAME,
                                extra:''

                        });

                        txnTask.save().then(data => {
                             
 


            var params 						= {};
			params['MID'] 					= config.MID;
			params['WEBSITE']				= config.WEBSITE;
			params['CHANNEL_ID']			= config.CHANNEL_ID;
			params['INDUSTRY_TYPE_ID']	= config.INDUSTRY_TYPE_ID;
			params['ORDER_ID']			= data.orderId;
			params['CUST_ID'] 			= data.cusId;
			params['TXN_AMOUNT']			= JSON.stringify(data.amount);
			params['CALLBACK_URL']		= 'http://localhost:'+config.port+'/'+config.path_prefix+'/callback' 
			params['EMAIL']				= data.email;
            params['MOBILE_NO']			= data.phone;
             



                    checksum_lib.genchecksum(params, config.KEY, function (err, checksum) {
                            res.render(vp+"init.hbs",{

                                action:'',
                                readonly:'readonly',
                                BUTTON:'Pay',
                                NAME:params['NAME'],
                                EMAIL:params['EMAIL'],
                                MOBILE_NO:params['MOBILE_NO'],
                                PRODUCT_NAME:params['PRODUCT_NAME'],
                                TXN_AMOUNT:params['TXN_AMOUNT'],
                                MID:params['MID'],
                                WEBSITE:params['WEBSITE'],
                                ORDER_ID:params['ORDER_ID'],
                                CUST_ID:params['CUST_ID'],
                                INDUSTRY_TYPE_ID:params['INDUSTRY_TYPE_ID'],
                                CHANNEL_ID:params['CHANNEL_ID'], 
                                CALLBACK_URL:params['CALLBACK_URL'],
                                CHECKSUMHASH:checksum 
                            })

                        });

                        }).catch(err => {
                           
                            console.log(err)

                            res.redirect('')


                        });

                       
                         
            

                });
                    
                   
        }
 
}


exports.callback=(req,res)=>{


    var checksumhash = req.body.CHECKSUMHASH; 
    var result = checksum_lib.verifychecksum(req.body, config.KEY, checksumhash);
    console.log("Checksum Result => ", result, "\n");

    if(result===true)
    {

        var myquery = { orderId: req.body.ORDERID };
        Transaction.findOne(myquery,function(err,objForUpdate)
        {

            if(err)
            {
                res.send({message:"Transaction Not Found !",ORDERID:req.body.ORDERID,TXNID:req.body.TXNID})
                return;
            }
            objForUpdate.status = req.body.STATUS;  
            objForUpdate.extra = req.body;  
        
                var newvalues = { $set: objForUpdate };  
                Transaction.updateOne(myquery, newvalues, function(err, saveRes) {
        
                    if (err)
                    {
                        res.send({message:"Error Occured !",ORDERID:req.body.ORDERID,TXNID:req.body.TXNID})
                    }
                    else{
                        objForUpdate.readonly="readonly"
                        objForUpdate.action='/'+config.path_prefix+'/home'
                    res.render(vp+"result.hbs",objForUpdate);
                }
                });
        
        }) 
     
    }
    else{

        res.send({message:"Invalid Checksum !",ORDERID:req.body.ORDERID,TXNID:req.body.TXNID})
  
    }
 
}


exports.status=(req,res)=>{


}