var packageInfo = require('../../package.json')
const checksum_lib = require('./checksum/checksum.js');
var request = require('request')
var Transaction;
var IDLEN = 10;
var nodeBase64 = require('nodejs-base64-converter');
var RazorPay = require('razorpay');
const PaytmChecksum = require('./checksum/PaytmChecksum.js');


function sanitizeRequest(body) {

    if (body.amount)
        body.amount = parseFloat(body.amount);
    if (body.TXN_AMOUNT)
        body.amount = parseFloat(body.TXN_AMOUNT);
}

module.exports = function (app, callbacks) {
    var config = (app.get('np_config'))
    var useController = require('./np_user.controller.js')(app, callbacks);

    if (config.razor_url)
        var razorPayInstance = new RazorPay({ key_id: config.KEY, key_secret: config.SECRET })

    let usingMultiDbOrm = false;
    if (config.db_url) {
        Transaction = require('../models/np_transaction.model.js');
        usingMultiDbOrm = false;

    } else if (app.multidborm) {
        Transaction = require('../models/np_multidbplugin.js')('nptransactions', app.multidborm);
        Transaction.db = app.multidborm;
        Transaction.modelname = 'nptransactions'
        Transaction.idFieldName = 'orderId'
        app.NPTransaction = Transaction;
        usingMultiDbOrm = true;

    }

    var module = {};

    var config = (app.get('np_config'))
    function makeid(length) {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (var i = 0; i < length; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    }

    var vp = __dirname + config.view_path

    module.home = (req, res) => {

        packageInfo.repository.url = packageInfo.repository.url.replace('git+', '')
        res.render(vp + "home.hbs", packageInfo)


    }

    module.init = async function (req, res) {

        if (!req.body.ORDER_ID && !req.body.EMAIL && req.query.to) {

            let toData = JSON.parse(nodeBase64.decode(req.query.to));
            req.body.NAME = toData.NAME
            req.body.EMAIL = toData.EMAIL
            req.body.MOBILE_NO = toData.MOBILE_NO
            req.body.ORDER_ID = toData.ORDER_ID
        }

        sanitizeRequest(req.body);
        let gotAllParams = true;

        if (req.body !== undefined) {
            let checks = [req.body.TXN_AMOUNT, req.body.PRODUCT_NAME,
            req.body.MOBILE_NO, req.body.NAME, req.body.EMAIL]

            for (var i = 0; i < checks.length; i++) {

                if (checks[i] === undefined) {
                    gotAllParams = false;
                    break;
                }

            }
        }
        else {
            gotAllParams = false;
        }

        // console.log(req.body) 

        if ((req.body.ORDER_ID !== undefined && req.body.ORDER_ID.length > 2)
            &&
            (req.body.CUST_ID !== undefined && req.body.CUST_ID.length > 2)) {
            //  console.log('redirect')
            // console.log(req.body)
            var params = {};

            params['MID'] = req.body.MID;
            params['WEBSITE'] = req.body.WEBSITE;
            params['CHANNEL_ID'] = req.body.CHANNEL_ID;
            params['INDUSTRY_TYPE_ID'] = req.body.INDUSTRY_TYPE_ID;
            params['ORDER_ID'] = req.body.ORDER_ID;
            params['CUST_ID'] = req.body.CUST_ID;
            params['TXN_AMOUNT'] = req.body.TXN_AMOUNT;
            params['CALLBACK_URL'] = req.body.CALLBACK_URL;
            params['EMAIL'] = req.body.EMAIL;
            params['MOBILE_NO'] = req.body.MOBILE_NO;
            params['PRODUCT_NAME'] = req.body.PRODUCT_NAME;
            params['NAME'] = req.body.NAME;

            if (config.paytm_url) {

                let paytmJsCheckouHtml = `<html>
                    <head>
                    
                    </head>
                    </html>`

                let initTxnbody = {
                    "requestType": "Payment",
                    "mid": params['MID'],
                    "websiteName": params['WEBSITE'],
                    "orderId": params['ORDER_ID'],
                    "callbackUrl": params['CALLBACK_URL'],
                    "txnAmount": {
                        "value": params['TXN_AMOUNT'],
                        "currency": params['CURRENCY'] || "INR",
                    },
                    "userInfo": {
                        "custId": params['CUST_ID'],
                        "mobile": params['MOBILE_NO'],
                        "firstName": params['NAME'],
                        "email": params['EMAIL']
                    }
                };
                let checksum = await PaytmChecksum.generateSignature(JSON.stringify(initTxnbody), config.KEY)
                let initTxnUrl = config.paytm_url + `/theia/api/v1/initiateTransaction?mid=${params['MID']}&orderId=${params['ORDER_ID']}`;

                request.post(
                    initTxnUrl,
                    {
                        json: {
                            "body": initTxnbody,
                            "head": {
                                "signature": checksum
                            }
                        }
                    },
                    function (error, response, body) {

                        if (!error &&
                            response.statusCode == 200 &&
                            body.body &&
                            body.body.resultInfo &&
                            body.body.resultInfo.resultStatus == "S") {

                            return res.send(body)

                        }
                        else {
                            console.log('ERROR:::', error, '\n', body);
                            res.status(500)
                            var form_fields = "";
                            let errorResp = {
                                TXNID: "na",
                                STATUS: "TXN_FAILURE",
                                CANCELLED: "cancelled",
                                ORDERID: params["ORDER_ID"]
                            }
                            for (var x in errorResp) {
                                form_fields += "<input type='hidden' name='" + x + "' value='" + errorResp[x] + "' >";
                            }
                            form_fields += "<input type='hidden' name='CHECKSUMHASH' value='" + checksum + "' >";

                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.write(`<html>

                                        <head>
                                            <title>Merchant Checkout Error</title>
                                        </head>
                                        
                                        <body>
                                            <center>
                                                <h1>Something went wrong. Please wait you will be redirected automatically...</h1>
                                            </center>
                                            <form method="post" action="${params['CALLBACK_URL']}" name="f1">${form_fields}</form>
                                            <script type="text/javascript">document.f1.submit();</script>
                                        </body>
                            
                            </html>`);
                            res.end();

                        }
                    }
                );

            }
            else if (config.razor_url) {



                let fail = `<div style="display:none">
                
                <form method="post" action="${params['CALLBACK_URL']}" id="fail">
                <input name="razorpay_order_id" value="${params['ORDER_ID']}" hidden="true"/>
                </form> 
                </div>`;
                let html = `
            <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
            <script>
            var options = {
                "key": "${config.KEY}", 
                "amount": "${parseFloat(params['TXN_AMOUNT']) * 100}", 
                "currency": "INR",
                "name": "${params['PRODUCT_NAME']}",
                "description": "Order # ${params['ORDER_ID']}",
                "image": "${config.logo}",
                "order_id": "${params['ORDER_ID']}",
                "callback_url": "${params['CALLBACK_URL']}",
                "prefill": {
                    "name": "${params['NAME']}",
                    "email": "${params['EMAIL']}",
                    "contact": "${params['MOBILE_NO']}"
                },
                "theme": {
                    "color": "${config.theme_color}"
                }, 
                "modal": {
                    "ondismiss": function(){
                        document.getElementById("fail").submit()
                    }
                }
            };
            var rzp1 = new Razorpay(options);
 
            rzp1.open();
            </script>`;

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.write(`<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Processing ! Please do not refresh this page...</h1><br>${html}<br>${fail}</center></body></html>`);
                res.end();

            }
            if (callbacks !== undefined)
                callbacks.onStart(params['ORDER_ID'], params);
        }
        else if ((req.body.ORDER_ID !== undefined && req.body.ORDER_ID.length > 2) || gotAllParams) {


            useController.create({ name: req.body.NAME, email: req.body.EMAIL, phone: req.body.MOBILE_NO },
                function (user) {

                    //console.log(user)

                    let onTxn = async function (txnData) {


                        //console.log(txnData)

                        var params = {};
                        params['MID'] = config.MID;
                        params['WEBSITE'] = config.WEBSITE;
                        params['CHANNEL_ID'] = config.CHANNEL_ID;
                        params['INDUSTRY_TYPE_ID'] = config.INDUSTRY_TYPE_ID;
                        params['ORDER_ID'] = txnData.orderId;
                        params['CUST_ID'] = txnData.cusId;
                        params['TXN_AMOUNT'] = JSON.stringify(txnData.amount);
                        params['CALLBACK_URL'] = config.host_url + '/' + config.path_prefix + '/callback'
                        params['EMAIL'] = txnData.email;
                        params['MOBILE_NO'] = txnData.phone;
                        params['NAME'] = txnData.name;
                        params['PRODUCT_NAME'] = txnData.pname;


                        let showConfirmation =
                            function (err, checksum) {
                                res.render(vp + "init.hbs", {
                                    action: '',
                                    readonly: 'readonly',
                                    BUTTON: 'Pay',
                                    NAME: params['NAME'],
                                    EMAIL: params['EMAIL'],
                                    MOBILE_NO: params['MOBILE_NO'],
                                    PRODUCT_NAME: params['PRODUCT_NAME'],
                                    TXN_AMOUNT: params['TXN_AMOUNT'],
                                    MID: params['MID'],
                                    WEBSITE: params['WEBSITE'],
                                    ORDER_ID: params['ORDER_ID'],
                                    CUST_ID: params['CUST_ID'],
                                    INDUSTRY_TYPE_ID: params['INDUSTRY_TYPE_ID'],
                                    CHANNEL_ID: params['CHANNEL_ID'],
                                    CALLBACK_URL: params['CALLBACK_URL'],
                                    CHECKSUMHASH: checksum
                                })
                            }


                        if (config.paytm_url)
                            checksum_lib.genchecksum(params, config.KEY, showConfirmation);
                        else if (config.razor_url) {
                            showConfirmation()
                        }

                    };



                    if ((req.body.ORDER_ID !== undefined && req.body.ORDER_ID.length > 2)) {


                        var myquery = { orderId: req.body.ORDER_ID };
                        Transaction.findOne(myquery, function (err, objForUpdate) {

                            onTxn(objForUpdate);

                        }, usingMultiDbOrm ? Transaction : undefined);



                    }
                    else {


                        function onOrder(orderId) {

                            var txnTask = new Transaction({

                                orderId: orderId,
                                cusId: user.id,
                                time: Date.now(),
                                status: 'INITIATED',
                                name: user.name,
                                email: user.email,
                                phone: user.phone,
                                amount: req.body.TXN_AMOUNT,
                                pname: req.body.PRODUCT_NAME,
                                extra: ''

                            });

                            txnTask.save().then(onTxn)
                                .catch(err => {

                                    console.log(err)

                                    res.redirect('')
                                });
                        }

                        let orderId;
                        if (config.paytm_url) {
                            orderId = "pay_" + makeid(config.id_length || IDLEN)
                            onOrder(orderId)
                        }
                        else if (config.razor_url) {

                            var options = {
                                amount: req.body.TXN_AMOUNT * 100,
                                currency: "INR",
                                receipt: user.id + '_' + Date.now()
                            };


                            razorPayInstance.orders.create(options, function (err, order) {
                                if (err) {
                                    res.send({ message: "An error occurred ! " + err.message })
                                    return;
                                }
                                orderId = order.id
                                onOrder(orderId)
                            })
                        }



                    }






                });


        }
        else {


            res.render(vp + "init.hbs", {

                action: '',
                readonly: '',
                check: true,
                BUTTON: 'Submit',
                NAME: (req.body.NAME === undefined ? '' : req.body.NAME),
                EMAIL: (req.body.EMAIL === undefined ? '' : req.body.EMAIL),
                MOBILE_NO: (req.body.MOBILE_NO === undefined ? '' : req.body.MOBILE_NO),
                PRODUCT_NAME: (req.body.PRODUCT_NAME === undefined ? '' : req.body.PRODUCT_NAME),
                TXN_AMOUNT: (req.body.TXN_AMOUNT === undefined ? '' : req.body.TXN_AMOUNT),
                MID: config.MID,
                WEBSITE: config.WEBSITE,
                ORDER_ID: '',
                CUST_ID: '',
                INDUSTRY_TYPE_ID: config.INDUSTRY_TYPE_ID,
                CHANNEL_ID: config.CHANNEL_ID,
                CALLBACK_URL: config.CALLBACK_URL,
                CHECKSUMHASH: ''

            })

        }

    }


    module.callback = (req, res) => {

        var result = false;
        let isCancelled = false;
        if (config.paytm_url) {
            var checksumhash = req.body.CHECKSUMHASH;
            result = checksum_lib.verifychecksum(req.body, config.KEY, checksumhash);
            if (req.body.STATUS == 'TXN_FAILURE' && req.body.CANCELLED == "cancelled" && req.body.TXNID) {
                isCancelled = true;
            }

        }
        else if (config.razor_url) {

            if (req.body.razorpay_payment_id) {
                result = checksum_lib.checkRazorSignature(req.body.razorpay_order_id,
                    req.body.razorpay_payment_id,
                    config.SECRET,
                    req.body.razorpay_signature)
                if (result) {
                    req.body.STATUS = 'TXN_SUCCESS'
                    req.body.ORDERID = req.body.razorpay_order_id
                    req.body.TXNID = req.body.razorpay_payment_id
                }
            }
            else {
                if (req.body.error && req.body.error.metadata && JSON.parse(req.body.error.metadata)) {
                    let orderId = JSON.parse(req.body.error.metadata).order_id
                    req.body.razorpay_order_id = orderId
                }
                req.body.STATUS = 'TXN_FAILURE'
                req.body.ORDERID = req.body.razorpay_order_id
                isCancelled = true;
            }
        }

        //console.log("Checksum Result => ", result, "\n");
        console.log("NodePayTMPG::Transaction => ", req.body.ORDERID, req.body.STATUS);
        //console.log(req.body)

        if (result || isCancelled) {

            var myquery = { orderId: req.body.ORDERID };
            Transaction.findOne(myquery, function (err, objForUpdate) {

                if (err) {
                    res.send({ message: "Transaction Not Found !", ORDERID: req.body.ORDERID, TXNID: req.body.TXNID })
                    return;
                }
                objForUpdate.status = req.body.STATUS;
                objForUpdate.TXNID = req.body.TXNID;
                objForUpdate.extra = JSON.stringify(req.body);

                var newvalues = { $set: objForUpdate };
                Transaction.updateOne(myquery, newvalues, function (err, saveRes) {

                    if (err) {
                        res.send({ message: "Error Occured !", ORDERID: req.body.ORDERID, TXNID: req.body.TXNID })
                    }
                    else {

                        if (callbacks !== undefined)
                            callbacks.onFinish(req.body.ORDERID, req.body);
                        objForUpdate.readonly = "readonly"
                        objForUpdate.action = config.homepage
                        res.render(vp + "result.hbs", objForUpdate);
                    }
                });

            }, usingMultiDbOrm ? Transaction : undefined)

        }
        else {

            res.send({ message: "Something went wrong ! Please try again later .", ORDERID: req.body.ORDERID, TXNID: req.body.TXNID })

        }

    }

    module.createTxn = (req, res) => {


        useController.create({ name: req.body.NAME, email: req.body.EMAIL, phone: req.body.MOBILE_NO },
            async function (user) {


                let id;
                if (config.paytm_url) {
                    id = "pay_" + makeid(config.id_length || IDLEN)
                }
                else if (config.razor_url) {

                    var options = {
                        amount: req.body.TXN_AMOUNT * 100,
                        currency: "INR",
                        receipt: user.id + '_' + Date.now()
                    };
                    let order = await razorPayInstance.orders.create(options);
                    id = order.id;
                }

                var txnTask = new Transaction({
                    id: id,
                    orderId: id,
                    cusId: user.id,
                    time: Date.now(),
                    status: 'INITIATED',
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    amount: req.body.TXN_AMOUNT,
                    pname: req.body.PRODUCT_NAME,
                    extra: (req.body.EXTRA || '')

                });


                txnTask.save().then(function (txn) {
                    var urlData64 = nodeBase64.encode(JSON.stringify({
                        NAME: txn.name,
                        EMAIL: txn.email,
                        MOBILE_NO: txn.phone,
                        ORDER_ID: txn.orderId
                    }))

                    txn.payurl = config.host_url + '/' + config.path_prefix + '/init?to=' + urlData64;
                    res.send(txn)
                })
                    .catch(err => {

                        console.log(err)

                        res.redirect('')
                    });


            });



    };


    module.status = (req, res) => {

        var myquery = { orderId: req.body.ORDER_ID };
        Transaction.findOne(myquery, async function (err, objForUpdate) {


            if (err) {
                res.send(err)
                return
            }
            if (objForUpdate.status === "INITIATED") {

                var params = {}
                params["MID"] = config.MID;
                params["ORDERID"] = req.body.ORDER_ID;

                async function onStatusUpdate(paytmResponse) {
                    if (paytmResponse.TXNID.length > 4) {
                        objForUpdate.status = paytmResponse.STATUS;
                        objForUpdate.extra = JSON.stringify(paytmResponse);

                        var newvalues = { $set: objForUpdate };
                        Transaction.updateOne(myquery, newvalues, function (err, saveRes) {

                            if (err) {
                                res.send({ message: "Error Occured !", ORDERID: paytmResponse.ORDERID, TXNID: paytmResponse.TXNID })
                            }
                            else {
                                if (callbacks !== undefined)
                                    callbacks.onFinish(req.body.ORDER_ID, objForUpdate);
                                res.send(paytmResponse)
                            }
                        });
                    }
                    else {
                        res.send(objForUpdate)

                    }
                }

                if (config.paytm_url) {
                    checksum_lib.genchecksum(params, config.KEY, function (err, checksum) {

                        request.post(
                            config.paytm_url + "/order/status",
                            { json: { MID: config.MID, ORDERID: req.body.ORDER_ID, CHECKSUMHASH: checksum, } },
                            function (error, response, body) {

                                if (!error && response.statusCode == 200) {
                                    // console.log(body);
                                    var paytmResponse = JSON.parse(JSON.stringify(body))
                                    onStatusUpdate(paytmResponse)
                                }
                                else {
                                    console.log('ERROR:::', error, '\n', response);
                                    res.status(500)
                                    res.send({ message: "Error Occured !", ORDERID: req.body.ORDER_ID })
                                }
                            }
                        );
                    });
                }
                else if (config.razor_url) {
                    let result = await razorPayInstance.orders.fetch(req.body.ORDER_ID)
                    result.ORDERID = req.body.ORDER_ID
                    if (result.status == 'paid' && result.amount_due == 0) {
                        result.STATUS = 'TXN_SUCCESS'
                        let payments = await razorPayInstance.orders.fetchPayments(req.body.ORDER_ID)
                        payments.items.forEach(item => {
                            if (item.status == 'captured') {
                                result.TXNID = item.id
                            }
                        });
                        result.payments = payments;

                        onStatusUpdate(result)
                    }
                    else {
                        res.send(objForUpdate);
                    }
                }

            }
            else {
                res.send(objForUpdate);
            }


        }, usingMultiDbOrm ? Transaction : undefined);


    }

    return module;
}
