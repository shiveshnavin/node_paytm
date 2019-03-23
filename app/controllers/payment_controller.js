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

        if(!gotAllParams)
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
                             

                            var params  ={  
                                NAME:data.name,
                                EMAIL:data.email,
                                MOBILE_NO:data.phone, 
                                TXN_AMOUNT:data.amount,
                                MID:config.MID,
                                WEBSITE:config.WEBSITE,
                                ORDER_ID:data.orderId,
                                CUST_ID:data.cusId,
                                INDUSTRY_TYPE_ID:config.INDUSTRY_TYPE_ID,
                                CHANNEL_ID:config.CHANNEL_ID, 
                                CALLBACK_URL:'http://localhost:'+config.port+'/'+config.path_prefix+'/callback'  
                                };
            
                    var result = Object.keys(params).map(function(key) {
                                    return [Number(key), params[key]];
                                  });
                                  
                    checksum_lib.genchecksum(result, config.KEY, function (err, checksum) {
                            res.render(vp+"init.hbs",{

                                action:'http://localhost:'+config.port+'/'+config.path_prefix+'/callback',
                                readonly:'readonly',
                                BUTTON:'Pay',
                                NAME:params.NAME,
                                EMAIL:params.EMAIL,
                                MOBILE_NO:params.MOBILE_NO,
                                PRODUCT_NAME:params.PRODUCT_NAME,
                                TXN_AMOUNT:params.TXN_AMOUNT,
                                MID:params.MID,
                                WEBSITE:params.WEBSITE,
                                ORDER_ID:params.ORDER_ID,
                                CUST_ID:params.CUST_ID,
                                INDUSTRY_TYPE_ID:params.INDUSTRY_TYPE_ID,
                                CHANNEL_ID:params.CHANNEL_ID, 
                                CALLBACK_URL:params.CALLBACK_URL,
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


    console.log(req.body);
    var checksumhash = req.body.CHECKSUMHASH; 
    var result = checksum_lib.verifychecksum(req.body, config.KEY, checksumhash);
    console.log("Checksum Result => ", result, "\n");

    res.send(req.body)

}