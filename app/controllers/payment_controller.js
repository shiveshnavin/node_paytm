var packageInfo=require('../../package.json')
var config=require('../../config.json')
var packageInfo=require('../../package.json')
var vp=__dirname+config.view_path

exports.home=(req,res)=>{


    res.render(vp+"home.hbs",packageInfo)


}

exports.init=(req,res)=>{


    let checks=[req.body.ORDER_ID,req.body.CUST_ID,req.body.TXN_AMOUNT,req.body.PRODUCT_NAME,
        req.body.MOBILE_NO,req.body.NAME,req.body.EMAIL]

        let gotAllParams=true;
        checks.forEach(check => {
            
            if(check===undefined)
            {   
                gotAllParams=false;
                break;
            }

        });

        if(!gotAllParams)
        {

            res.render(vp+"init.hbs",{

                CUSTUMER_ID:'12334',
                MID:config.MID,
                WEBSITE:config.WEBSITE
                


            })
        }
        else{

            res.render(vp+"init.hbs",{

                CUSTUMER_ID:'12334',
                MID:config.MID,
                WEBSITE:config.WEBSITE
                


            })
            
        }

    /***
     * 
        <input type="hidden" name="MID" value="{{MID}}">
        <input type="hidden" name="WEBSITE" value="{{WEBSITE}}">
        <input type="hidden" name="ORDER_ID" value="{{ORDER_ID}}">
        <input type="hidden" name="CUST_ID" value="{{CUST_ID}}">  
        <input type="hidden" name="INDUSTRY_TYPE_ID" value="{{INDUSTRY_TYPE_ID}}">
        <input type="hidden" name="CHANNEL_ID" value="{{CHANNEL_ID}}"> 
        <input type="hidden" name="CALLBACK_URL" value="{{CALLBACK_URL}}">
        <input type="hidden" name="CHECKSUMHASH" value="{{CHECKSUMHASH}}">




     */
}