var crypto = require('crypto');
const { resolve } = require('path');
var reqpost = require('request');

class OpenMoney {
    config
    constructor(npconfig) {
        npconfig.accesskey = npconfig.KEY
        npconfig.secretkey = npconfig.SECRET
        npconfig.url = npconfig.open_money_url
        npconfig.script_url = (npconfig.url.indexOf("sandbox") == -1) ? "https://payments.open.money/layer" : "https://sandbox-payments.open.money/layer"
        this.config = npconfig;

    }

    generatePaymentToken(params) {

        let config = this.config;
        return new Promise((resolve, reject) => {
            var payment_token_data;
            let open_txn = {
                "amount": params['TXN_AMOUNT'],
                "currency": params['CURRENCY'] || "INR",
                "name": params['NAME'],
                "email_id": params['EMAIL'],
                "contact_number": ("" + params['MOBILE_NO']).replace("+91", ""),
                "mtx": params['ORDER_ID']
            }
            create_payment_token(open_txn,
                config.accesskey,
                config.secretkey,
                config.url, function (layer_payment_token_data) {
                    /*Object.keys(layer_payment_token_data).forEach(function(key) {
                        console.log(key + layer_payment_token_data[key]);
                    });*/

                    if (typeof layer_payment_token_data['error'] != 'undefined')
                        return reject(JSON.stringify('E55 Payment error. ' + layer_payment_token_data['error']));

                    if (typeof layer_payment_token_data["id"] == 'undefined' || !layer_payment_token_data["id"])
                        return reject(JSON.stringify('Payment error. ' + 'Layer token ID cannot be empty.'));

                    if (typeof layer_payment_token_data["id"] != 'undefined') {

                        get_payment_token(layer_payment_token_data["id"], config.accesskey, config.secretkey, config.url, function (payment_token_data) {

                            if (payment_token_data.error) {
                                return reject({
                                    error: payment_token_data.error
                                })
                            }
                            payment_token_data = JSON.parse(payment_token_data);

                            if (typeof payment_token_data['error'] != 'undefined')
                                return reject({ error: (JSON.stringify('E56 Payment error. ' + payment_token_data['error'])) })
                            if (typeof payment_token_data['status'] != 'undefined' && payment_token_data['status'] == "paid")
                                return reject({ error: (JSON.stringify("Layer: this order has already been paid.")) })
                            if (parseFloat(payment_token_data['amount']) != parseFloat(params['TXN_AMOUNT']))
                                return reject({ error: (JSON.stringify("Layer: an amount mismatch occurred.")) })

                            var hash = create_hash({
                                'layer_pay_token_id': payment_token_data['id'],
                                'layer_order_amount': payment_token_data['amount'],
                                'tranid': params['ORDER_ID'],
                            }, config.accesskey, config.secretkey);
                            params['CHECKSUM'] = hash;

                            var html = `<form action='${params['CALLBACK_URL']}' method='post' style='display: none' name='layer_payment_int_form'>`;
                            html += "<input type='hidden' name='layer_pay_token_id' value='" + payment_token_data['id'] + "'>";
                            html += "<input type='hidden' name='tranid' value='" + params['ORDER_ID'] + "'>";
                            html += "<input type='hidden' name='layer_order_amount' value='" + payment_token_data['amount'] + "'>";
                            html += "<input type='hidden' id='layer_payment_id' name='layer_payment_id' value=''>";
                            html += "<input type='hidden' id='fallback_url' name='fallback_url' value=''>";
                            html += "<input type='hidden' name='hash' value='" + hash + "'></form>";
                            html += "<script>";
                            html += "var layer_params = {payment_token_id:'" + payment_token_data['id'] + "',accesskey:'" + config.accesskey + "'};";
                            html += "</script>";
                            html += `<script src="layer_checkout.js"></script>`;

                            return resolve({
                                html: html,
                                params: params,
                                data: config,
                                tokenid: payment_token_data['id'],
                                amount: payment_token_data['amount'],
                                hash: hash
                            })
                        });
                    }
                });
        })
    }

    verifyResult(req) {
        let config = this.config;
        return new Promise((resolve, reje) => {

            var txnid = "";
            var amount = "";
            var status = "";
            var msg = "";
            var tokenid = "";
            var paymentid = "";
            var payment_data = {};

            if (!req.body.layer_payment_id) {
                return resolve({
                    STATUS: 'TXN_FAILURE',
                    ORDERID: txnid,
                    TXNID: paymentid,
                    reason: 'invalid response'
                })
            }
            else {
                txnid = req.body.tranid;
                amount = req.body.layer_order_amount;
                tokenid = req.body.layer_pay_token_id;
                paymentid = req.body.layer_payment_id;
            }
            var data = {
                'layer_pay_token_id': tokenid,
                'layer_order_amount': amount,
                'tranid': txnid,
            };

            if (verify_hash(data, req.body.hash, config.accesskey, config.secretkey, config.url)) {
                get_payment_details(paymentid, config.accesskey, config.secretkey, config.url, function (response) {
                    if (response === "{}") {

                        return resolve({
                            STATUS: 'TXN_FAILURE',
                            ORDERID: txnid,
                            TXNID: paymentid,
                            message: 'Invalid Response',
                            data: payment_data
                        })

                    }
                    else {
                        payment_data = JSON.parse(response);
                        if (!payment_data['payment_token'] || payment_data['payment_token']['id'] != tokenid) {
                            return resolve({
                                STATUS: 'TXN_FAILURE',
                                ORDERID: txnid,
                                TXNID: paymentid,
                                message: 'received layer_pay_token_id and collected layer_pay_token_id doesnt match',
                                data: payment_data
                            })
                        }
                        else {
                            let status = ""
                            if (payment_data.status == "captured" ||
                                payment_data.status == "late_authorized") {
                                status = 'TXN_SUCCESS'
                            }
                            else if (payment_data.status == "pending") {
                                status = 'TXN_PENDING'
                            }
                            else {
                                status = 'TXN_FAILURE'
                            }

                            return resolve({
                                STATUS: status,
                                ORDERID: txnid,
                                TXNID: paymentid,
                                data: (payment_data)
                            })
                        }
                    }
                });

            }
            else {
                return resolve({
                    STATUS: 'TXN_FAILURE',
                    ORDERID: txnid,
                    TXNID: paymentid,
                    message: 'Invalid Response'
                })
            }
        })
    }

    processWebhook(req, res, updateTransaction) {
        let config = this.config;
        let events = [
            "payment_captured", "payment_pending", 
            "payment_failed",
            "payment_cancelled"]
        if (req.body.event && events.indexOf(req.body.event) > -1) {
            if (req.body.payment_token) {

                let payment_token = req.body.payment_token;
                let orderId = payment_token.mtx
                let paymentid = req.body.id
                let tokenid = payment_token.id
                let payment_data = {}
                let amount = req.body.amount;

                setTimeout(() => {

                    req.body.layer_pay_token_id = tokenid;
                    // var data = {
                    //     'layer_pay_token_id': tokenid,
                    //     'layer_order_amount': amount,
                    //     'tranid': orderId,
                    // };

                    // if (verify_hash(data, req.headers['x-webhook-signature'], config.accesskey, config.secretkey, config.url)) {
                    //     console.log('TODO verify signature')
                    // }
                    get_payment_details(paymentid, config.accesskey, config.secretkey, config.url, function (response) {
                        if (response === "{}") {
                            req.body.STATUS = 'TXN_FAILURE';
                            req.body.ORDERID = orderId;
                            req.body.TXNID = paymentid;
                        }
                        else {
                            payment_data = JSON.parse(response);
                            if (!payment_data['payment_token'] || payment_data['payment_token']['id'] != tokenid) {
                                req.body.STATUS = 'TXN_FAILURE';
                                req.body.ORDERID = orderId;
                                req.body.TXNID = paymentid;
                            }
                            else {
                                let status = ""
                                if (payment_data.status == "captured" ||
                                    payment_data.status == "late_authorized") {
                                    status = 'TXN_SUCCESS'
                                }
                                else if (payment_data.status == "pending") {
                                    status = 'TXN_PENDING'
                                }
                                // else {
                                //     status = 'TXN_FAILURE'
                                // }

                                if (status != 'TXN_SUCCESS') {
                                    if (req.body.status == "paid" || req.body.status == 'captured') {
                                        status = 'TXN_SUCCESS'
                                    }
                                    // else if (req.body.status == 'failed') {
                                    //     status = 'TXN_FAILURE'
                                    // }
                                    else if (req.body.status == 'pending') {
                                        status = 'TXN_PENDING'
                                    }
                                }
                                console.log(`Open Money ${req.body.event} webhook for order=${payment_token.mtx} payid=${paymentid} status=${req.body.status} || ${status}`)

                                req.body.STATUS = status;
                                req.body.ORDERID = orderId;
                                req.body.TXNID = paymentid;
                            }

                        }
                        updateTransaction(req, res)

                    });
                }, 3000)
            }
            else {
                res.status(401)
                res.send({ message: "Missing payment_token" })
            }
        }
        else {
            res.status(201)
            res.send({ message: "Webhook not supported" })
        }
    }

    getPaymentStatus(paymentTokenId, cb) {
        return new Promise((resolve, reject) => {
            get_payment_token_details(paymentTokenId, this.config.accesskey, this.config.secretkey, this.config.url, (data) => {
                resolve(data)
                if (cb) {
                    cb(data)
                }
            })
        })
    }

    renderProcessingPage(params, pmttoken, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(`<html><head><title>Merchant Checkout Page</title>
        <script src="${this.config.script_url}"></script>
        </head><body><center><h1>Processing ! Please do not refresh this page...</h1><br>${pmttoken.html}<br></center><script>triggerLayer();</script></body></html>`);
        res.end();
    }

    renderError(params, error, res) {

        console.log('ERROR:::', error, '\n');
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
        form_fields += "<input type='hidden' name='CHECKSUMHASH' value='" + params["CHECKSUM"] + "' >";

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



//Layer functions
function create_payment_token(data, accesskey, secretkey, baseurl, callback) {
    try {
        var pay_token_request_data = {
            'amount': (data['amount']) ? data['amount'] : null,
            'currency': (data['currency']) ? data['currency'] : null,
            'name': (data['name']) ? data['name'] : null,
            'email_id': (data['email_id']) ? data['email_id'] : null,
            'contact_number': (data['contact_number']) ? data['contact_number'] : null,
            'mtx': (data['mtx']) ? data['mtx'] : null,
            'udf': (data['udf']) ? data['udf'] : null,
        };
        http_post(pay_token_request_data, "payment_token", accesskey, secretkey, baseurl, function (response) {
            return callback(response);
        });

    } catch (e) {
        return callback({
            'error': e
        });
    }
}

function get_payment_token(payment_token_id, accesskey, secretkey, url, callback) {
    if (!payment_token_id) {
        throw new Error("payment_token_id cannot be empty");
    }

    try {
        http_get("payment_token/" + payment_token_id, accesskey, secretkey, url, function (response) {
            return callback(response);
        });
    } catch (e) {
        return callback({
            'error': e
        });
    }
}

function get_payment_token_details(payment_tokenid, accesskey, secretkey, baseurl, callback) {

    if (!payment_tokenid) {
        throw new Error("payment_id cannot be empty");
    }
    try {
        http_get("payment_token/" + payment_tokenid + '/payment', accesskey, secretkey, baseurl, function (response) {
            return callback(response);
        });
    } catch (e) {
        callback({
            'error': e
        })
    }
}

function get_payment_details(payment_id, accesskey, secretkey, baseurl, callback) {

    if (!payment_id) {
        throw new Error("payment_id cannot be empty");
    }
    try {
        http_get("payment/" + payment_id, accesskey, secretkey, baseurl, function (response) {
            return callback(response);
        });
    } catch (e) {
        callback({
            'error': e
        })
    }
}

function http_post(data, route, accesskey, secretkey, baseurl, callback) {
    Object.keys(data).forEach(function (key) {
        if (data[key] === null)
            delete data[key];
    });

    var url = baseurl + "/" + route;

    var options = {
        method: 'POST',
        uri: url,
        json: true,
        form: {
            amount: data['amount'],
            currency: data['currency'],
            name: data['name'],
            email_id: data['email_id'],
            contact_number: data['contact_number'],
            mtx: data['mtx']
        },
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accesskey + ':' + secretkey
        }
    };

    reqpost(options)
        .on('response', function (resp) {
            //console.log('STATUS:'+resp.statusCode);
            resp.setEncoding('utf8');
            resp.on('data', function (chunk) {
                var data = JSON.parse(chunk);
                var rdata = "";
                if ("error" in data) {
                    Object.keys(data).forEach(function (key) {
                        if (key == "error_data") {
                            var obj = data[key];
                            Object.keys(obj).forEach(function (k) {
                                rdata += obj[k] + ' ';
                            });
                        }
                    });
                    return callback({ "error": rdata });
                }
                else
                    return callback(data);

            });
        })
        .on('error', function (err) {
            return callback(err);
        });
}

function http_get(route, accesskey, secretkey, baseurl, callback) {

    var url = baseurl + "/" + route;

    var options = {
        method: 'GET',
        uri: url,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accesskey + ':' + secretkey
        }
    };

    reqpost(options)
        .on('response', function (resp) {
            resp.setEncoding('utf8');
            resp.on('data', function (chunk) {
                return callback(chunk);
            });
        })
        .on('error', function (err) {
            return callback(err);
        });
}

function create_hash(data, accesskey, secretkey) {
    data = ksort(data);
    hash_string = accesskey;
    Object.keys(data).forEach(function (key) {
        hash_string += '|' + data[key];
    });
    var cryp = crypto.createHash('sha256', secretkey);
    cryp.update(hash_string);
    return cryp.digest('hex');
}

function verify_hash(data, rec_hash, accesskey, secretkey) {
    var gen_hash = create_hash(data, accesskey, secretkey);
    if (gen_hash === rec_hash) {
        return true;
    }
    return false;
}

function ksort(obj) {
    var keys = Object.keys(obj).sort(), sortedObj = {};

    for (var i in keys) {
        sortedObj[keys[i]] = obj[keys[i]];
    }

    return sortedObj;
}


module.exports = OpenMoney;