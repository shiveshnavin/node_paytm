import crypto from 'crypto';
import axios from 'axios';

type Dict = Record<string, any>;

interface PayUConfig {
    key: string;
    salt: string;
    baseUrl: string;
    paymentUrl: string;
    verifyUrl: string;
}

interface PayURequestLike {
    body?: Dict;
    query?: Dict;
    rawBody?: any;
    headers?: Dict;
}

interface PayUResponseLike {
    writeHead: (status: number, headers: Dict) => void;
    write: (chunk: string) => void;
    end: () => void;
    status: (code: number) => void;
    send: (body: any) => void;
}

class PayU {
    config: PayUConfig;

    constructor(npconfig: Dict) {
        const baseUrl = (npconfig.payu_url || '').replace(/\/$/, '');
        const isSandbox = baseUrl.indexOf('test.payu.in') > -1;
        const verifyUrl = npconfig.payu_verify_url || (isSandbox
            ? 'https://test.payu.in/merchant/postservice.php?form=2'
            : 'https://info.payu.in/merchant/postservice.php?form=2');

        this.config = {
            key: npconfig.KEY,
            salt: npconfig.SECRET,
            baseUrl,
            paymentUrl: npconfig.payu_payment_url || (baseUrl ? `${baseUrl}/_payment` : ''),
            verifyUrl,
        };
    }

    normalizeAmount(amount: any): string {
        const value = parseFloat(amount || 0);
        return value.toFixed(2);
    }

    buildRequestHash(payload: Dict): string {
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
            this.config.salt,
        ];
        return crypto.createHash('sha512').update(parts.join('|')).digest('hex');
    }

    buildResponseHash(data: Dict): string {
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
            data.key || '',
        ];
        const filtered = sequence.filter((value) => value !== null);
        return crypto.createHash('sha512').update(filtered.join('|')).digest('hex');
    }

    generatePaymentRequest(params: Dict): { html: string; payload: Dict } {
        const payload: Dict = {
            key: this.config.key,
            txnid: params.ORDER_ID,
            amount: this.normalizeAmount(params.TXN_AMOUNT),
            productinfo: params.PRODUCT_NAME,
            firstname: params.NAME,
            email: params.EMAIL,
            phone: params.MOBILE_NO,
            surl: params.CALLBACK_URL,
            furl: params.CALLBACK_URL,
            udf1: params.CUST_ID || '',
            udf2: params.ORDER_ID || '',
            service_provider: 'payu_paisa',
        };

        payload.hash = this.buildRequestHash(payload);

        const formFields = Object.keys(payload)
            .map((key) => `<input type='hidden' name='${key}' value='${payload[key]}' />`)
            .join('');

        const html = `<form action='${this.config.paymentUrl}' method='post' id='payu_payment_form' style='display:none'>${formFields}</form><script>document.getElementById('payu_payment_form').submit();</script>`;
        return { html, payload };
    }

    decodeTransactionResponse(txnDataBase64FromPayu: string): Dict {
        const txnDataJson = Buffer.from(txnDataBase64FromPayu, 'base64').toString('utf-8');
        return JSON.parse(txnDataJson);
    }

    async verifyResult(req: PayURequestLike): Promise<Dict> {
        const originalBody = req.body || {};
        const lookupId = originalBody.txnid || req.query?.order_id;
        const statusResp = await this.checkBqrTxnStatus(lookupId);

        let resData: Dict | null = null;
        if (!resData && statusResp && statusResp.transaction_details) {
            const td = statusResp.transaction_details;
            if (td[lookupId]) {
                resData = td[lookupId];
            } else {
                for (const key of Object.keys(td)) {
                    const txn = td[key];
                    if (!txn) continue;
                    if ((txn.txnid && txn.txnid.toString() === lookupId) || key.toString().endsWith(lookupId)) {
                        resData = txn;
                        break;
                    }
                }
            }
        }

        const source = resData || statusResp || originalBody;
        const msg = (statusResp?.msg || '').toString();
        const statusText = (source.status || source.unmappedstatus || msg || '').toString().toLowerCase();

        let status = 'TXN_FAILURE';
        if (statusText.includes('success') || statusText.includes('completed') || statusText.includes('captured')) {
            status = 'TXN_SUCCESS';
        } else if (statusText.includes('pending')) {
            status = 'TXN_PENDING';
        }

        const orderId = (source.udf2 || source.order_id || source.txnid || lookupId).toString();
        const txnId = source.mihpayid || source.txnid || null;

        return {
            STATUS: status,
            ORDERID: orderId,
            TXNID: txnId,
            data: resData || statusResp || originalBody,
            cancelled: source.unmappedstatus?.toLowerCase?.().includes('cancelled') || false,
        };
    }

    async getPaymentStatus(txnId: string): Promise<Dict> {
        const verifyPayload = new URLSearchParams();
        verifyPayload.append('key', this.config.key || '');
        verifyPayload.append('command', 'verify_payment');
        verifyPayload.append('var1', txnId || '');

        const hashString = [this.config.key, 'verify_payment', txnId, this.config.salt].join('|');
        verifyPayload.append('hash', crypto.createHash('sha512').update(hashString).digest('hex'));

        try {
            const response = await axios.post(this.config.verifyUrl, verifyPayload.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            return response.data;
        } catch (error: any) {
            return { error: error.message };
        }
    }

    async postCommand(command: string, transactionId: string): Promise<Dict> {
        const payload = new URLSearchParams();
        payload.append('key', this.config.key || '');
        payload.append('command', command || '');
        payload.append('var1', transactionId || '');

        const hashString = [this.config.key, command, transactionId, this.config.salt].join('|');
        payload.append('hash', crypto.createHash('sha512').update(hashString).digest('hex'));

        try {
            const response = await axios.post(this.config.verifyUrl, payload.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            return response.data;
        } catch (error: any) {
            return { error: error.message };
        }
    }

    async checkBqrTxnStatus(transactionId: string): Promise<Dict> {
        return this.postCommand('verify_payment', transactionId);
    }

    renderProcessingPage(params: Dict, paymentReq: Dict, res: PayUResponseLike, loadingSVG: string): void {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(`<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Processing ! Please do not refresh this page...</h1><br>${paymentReq.html}<br><br>${loadingSVG}</center></body></html>`);
        res.end();
    }

    renderError(params: Dict, error: any, res: PayUResponseLike): void {
        console.log('ERROR:::', error, '\n');
        res.status(500);

        let formFields = '';
        const errorResp: Dict = {
            TXNID: 'na',
            STATUS: 'TXN_FAILURE',
            CANCELLED: 'cancelled',
            ORDERID: params.ORDER_ID,
        };

        Object.keys(errorResp).forEach((key) => {
            formFields += `<input type='hidden' name='${key}' value='${errorResp[key]}' >`;
        });
        formFields += `<input type='hidden' name='CHECKSUMHASH' value='${params.CHECKSUM || ''}' >`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(`<html>

                    <head>
                        <title>Merchant Checkout Error</title>
                    </head>
                    
                    <body>
                        <center>
                            <h1>Something went wrong. Please wait you will be redirected automatically...</h1>
                        </center>
                        <form method='post' action='${params.CALLBACK_URL}' name='f1'>${formFields}</form>
                        <script type='text/javascript'>document.f1.submit();</script>
                    </body>
        
        </html>`);
        res.end();
    }

    processWebhook(req: PayURequestLike, res: PayUResponseLike, updateTransaction: Function): void {
        res.status(201);
        res.send({ message: 'Webhook not implemented for PayU' });
    }
}

export default PayU;
module.exports = PayU;
