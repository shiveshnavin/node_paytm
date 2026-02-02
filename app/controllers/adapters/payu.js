const crypto = require('crypto');
const axios = require('axios');

class PayU {
    config
    constructor(npconfig) {
        const baseUrl = (npconfig.payu_url || '').replace(/\/$/, '');
        const isSandbox = baseUrl.indexOf('test.payu.in') > -1;
        const verifyUrl = npconfig.payu_verify_url || (isSandbox
            ? 'https://test.payu.in/merchant/postservice.php?form=2'
            : 'https://info.payu.in/merchant/postservice.php?form=2');
        this.config = {
            key: npconfig.KEY,
            salt: npconfig.SECRET,
            baseUrl: baseUrl,
            paymentUrl: npconfig.payu_payment_url || (baseUrl ? baseUrl + '/_payment' : ''),
            verifyUrl: verifyUrl
        };
    }

    normalizeAmount(amount) {
        const value = parseFloat(amount || 0);
        return value.toFixed(2);
    }

    buildRequestHash(payload) {
        const parts = [
            payload.key,
            payload.txnid,
            this.normalizeAmount(payload.amount),
            payload.productinfo,
            payload.firstname,
            payload.email,
            payload.udf1 || '',
            payload.udf2 || '',
            payload.udf3 || '',
            payload.udf4 || '',
            payload.udf5 || '',
            payload.udf6 || '',
            payload.udf7 || '',
            payload.udf8 || '',
            payload.udf9 || '',
            payload.udf10 || '',
            this.config.salt
        ];
        return crypto.createHash('sha512').update(parts.join('|')).digest('hex');
    }

    buildResponseHash(data) {
        const amount = this.normalizeAmount(data.amount);
        const sequence = [
            data.additionalCharges || null,
            this.config.salt,
            data.status || '',
            '', '', '', '', '', '', '', '', '', '',
            data.udf5 || '',
            data.udf4 || '',
            data.udf3 || '',
            data.udf2 || '',
            data.udf1 || '',
            data.email || '',
            data.firstname || '',
            data.productinfo || '',
            amount,
            data.txnid || '',
            data.key || ''
        ];
        const filtered = sequence.filter((v) => v !== null);
        return crypto.createHash('sha512').update(filtered.join('|')).digest('hex');
    }

    generatePaymentRequest(params) {
        const payload = {
            key: this.config.key,
            txnid: params['ORDER_ID'],
            amount: this.normalizeAmount(params['TXN_AMOUNT']),
            productinfo: params['PRODUCT_NAME'],
            firstname: params['NAME'],
            email: params['EMAIL'],
            phone: params['MOBILE_NO'],
            surl: params['CALLBACK_URL'],
            furl: params['CALLBACK_URL'],
            udf1: params['CUST_ID'] || '',
            udf2: params['ORDER_ID'] || '',
            service_provider: 'payu_paisa'
        };

        payload.hash = this.buildRequestHash(payload);

        const formFields = Object.keys(payload).map((key) => {
            return "<input type='hidden' name='" + key + "' value='" + payload[key] + "' />";
        }).join('');
        const html = `<form action='${this.config.paymentUrl}' method='post' id='payu_payment_form' style='display:none'>${formFields}</form><script>document.getElementById('payu_payment_form').submit();</script>`;

        return { html: html, payload: payload };
    }
    decodeTransactionResponse(txnDataBase64FromPayu) {
        const txnDataJson = Buffer.from(txnDataBase64FromPayu, 'base64').toString('utf-8');
        return JSON.parse(txnDataJson);
    }
    async verifyResult(req) {
        const originalBody = req.body || {};
        const lookupId = originalBody.txnid || req.query.order_id;
        const statusResp = await this.checkBqrTxnStatus(lookupId);

        let resData = null;
        if (!resData && statusResp && statusResp.transaction_details) {
            const td = statusResp.transaction_details;
            // try direct lookup by lookupId
            if (td[lookupId]) {
                resData = td[lookupId];
            }
            else {
                // find entry where txnid matches lookupId or key ends with lookupId
                for (const k of Object.keys(td)) {
                    const t = td[k];
                    if (!t) continue;
                    if ((t.txnid && t.txnid.toString() === lookupId) || k.toString().endsWith(lookupId)) {
                        resData = t;
                        break;
                    }
                }
            }
        }

        // Determine source for status and mapping (prefer decoded resData)
        const source = resData || (statusResp || {}) || originalBody;

        const msg = (statusResp?.msg || '').toString();
        const statusText = (source.status || source.unmappedstatus || msg || '').toString().toLowerCase();
        let status = 'TXN_FAILURE';
        if (statusText.includes('success') || statusText.includes('completed') || statusText.includes('captured')) {
            status = 'TXN_SUCCESS';
        }
        else if (statusText.includes('pending')) {
            status = 'TXN_PENDING';
        }

        const orderId = (source.udf2 || source.order_id || source.txnid || lookupId).toString();
        const txnId = source.mihpayid || source.txnid || null;

        return {
            STATUS: status,
            ORDERID: orderId,
            TXNID: txnId,
            data: resData || statusResp || originalBody,
            cancelled: source.unmappedstatus?.toLowerCase()?.includes('cancelled') || false
        };
    }

    async getPaymentStatus(txnId) {
        const verifyPayload = new URLSearchParams();
        verifyPayload.append('key', this.config.key || '');
        verifyPayload.append('command', 'verify_payment');
        verifyPayload.append('var1', txnId || '');
        const hashString = [this.config.key, 'verify_payment', txnId, this.config.salt].join('|');
        verifyPayload.append('hash', crypto.createHash('sha512').update(hashString).digest('hex'));

        try {
            const response = await axios.post(this.config.verifyUrl, verifyPayload.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            return response.data;
        }
        catch (e) {
            return { error: e.message };
        }
    }

    async postCommand(command, transactionId) {
        const payload = new URLSearchParams();
        payload.append('key', this.config.key || '');
        payload.append('command', command || '');
        payload.append('var1', transactionId || '');

        // build hash: key|command|var1...|salt
        const hashParts = [this.config.key, command, transactionId, this.config.salt];
        const hashString = hashParts.join('|');
        payload.append('hash', crypto.createHash('sha512').update(hashString).digest('hex'));

        try {
            const response = await axios.post(this.config.verifyUrl, payload.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            return response.data;
        }
        catch (e) {
            return { error: e.message };
        }
    }

    /**
     * https://docs.payu.in/reference/transaction-status-check-api-2#sample-request
     * @param {*} transactionId mandatory
     * @param {*} paymentmode optional
     * @param {*} productype optional
     * @returns 
     */
    async checkBqrTxnStatus(transactionId) {
        return this.postCommand('verify_payment', transactionId);
    }

    renderProcessingPage(params, paymentReq, res, loadingSVG) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(`<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Processing ! Please do not refresh this page...</h1><br>${paymentReq.html}<br><br>${loadingSVG}</center></body></html>`);
        res.end();
    }

    renderError(params, error, res) {
        console.log('ERROR:::', error, '\n');
        res.status(500);
        let formFields = '';
        const errorResp = {
            TXNID: 'na',
            STATUS: 'TXN_FAILURE',
            CANCELLED: 'cancelled',
            ORDERID: params['ORDER_ID']
        };
        Object.keys(errorResp).forEach((key) => {
            formFields += "<input type='hidden' name='" + key + "' value='" + errorResp[key] + "' >";
        });
        formFields += "<input type='hidden' name='CHECKSUMHASH' value='" + (params['CHECKSUM'] || '') + "' >";

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(`<html>

                    <head>
                        <title>Merchant Checkout Error</title>
                    </head>
                    
                    <body>
                        <center>
                            <h1>Something went wrong. Please wait you will be redirected automatically...</h1>
                        </center>
                        <form method="post" action="${params['CALLBACK_URL']}" name="f1">${formFields}</form>
                        <script type="text/javascript">document.f1.submit();</script>
                    </body>
        
        </html>`);
        res.end();
    }

    processWebhook(req, res) {
        res.status(201);
        res.send({ message: 'Webhook not implemented for PayU' });
    }
}

module.exports = PayU;
