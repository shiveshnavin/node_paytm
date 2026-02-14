import { MultiDbORM } from 'multi-db-orm';
import packageInfo from '../../package.json';
import checksum_lib from './checksum/checksum';
import PaytmChecksum from './checksum/PaytmChecksum';
import * as crypto from 'crypto';
import path from 'path';
import axios from 'axios';
import RazorPay from 'razorpay';
import OpenMoney from './adapters/open_money';
import PayU from './adapters/payu';
import { NPUserController } from './user.controller';
import { Request, Response } from 'express';
import { Utils } from '../utils/utils';
import { LoadingSVG } from './static/loadingsvg';
import { NPConfig, NPParam, NPTableNames, NPUser, NPTransaction } from '../models';
import { sendAutoPostForm, renderRazorpayCheckout, renderPaytmJsCheckout, renderView } from './htmlhelper';

const IDLEN = 14;

function makeid(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}


export class PaymentController {
    private config: NPConfig;
    private callbacks: any;
    private db: MultiDbORM;
    private tableNames: NPTableNames = { USER: 'npusers', TRANSACTION: 'nptransactions' };
    private useController: NPUserController;
    private viewPath = ''
    private payuInstance: PayU
    private openMoneyInstance: OpenMoney
    private razorPayInstance: typeof RazorPay

    constructor(config: NPConfig, db: MultiDbORM, callbacks?: any, tableNames?: NPTableNames) {
        this.config = config;
        this.callbacks = callbacks;
        this.db = db;
        if (tableNames) {
            this.tableNames = tableNames;
        }
        this.useController = new NPUserController(this.db, this.tableNames.USER);
        this.configure(config);

    }

    encodeTxnDataForUrl(txnDataJson: any): string {
        // Accept either an object or a JSON string.
        const payloadStr = typeof txnDataJson === 'string' ? txnDataJson : JSON.stringify(txnDataJson);

        // Derive a 32-byte key from config.SECRET (fallback to config.KEY).
        const secret = String(this.config.SECRET || this.config.KEY || '');
        if (!secret) {
            // No secret available — fallback to url-safe base64 (not secure).
            return Buffer.from(payloadStr, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        }

        const key = crypto.createHash('sha256').update(secret).digest(); // 32 bytes
        const iv = crypto.randomBytes(12); // 12 bytes recommended for GCM
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(payloadStr, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();

        // Store as: iv (12) | tag (16) | ciphertext — then URL-safe base64
        const out = Buffer.concat([iv, tag, encrypted]).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        return out;
    }

    decodeTxnDataFromUrl(encodedStr: string): any {
        if (!encodedStr) return '';

        // Convert back to standard base64 and pad
        let b64 = encodedStr.replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4;
        if (pad) b64 += '='.repeat(4 - pad);

        const raw = Buffer.from(b64, 'base64');

        // If too short to contain iv+tag, treat as plain base64 payload
        if (raw.length < 12 + 16 + 1) {
            try { return raw.toString('utf8'); } catch (e) { return ''; }
        }

        try {
            const iv = raw.slice(0, 12);
            const tag = raw.slice(12, 28);
            const ciphertext = raw.slice(28);

            const secret = String(this.config.SECRET || this.config.KEY || '');
            if (!secret) return raw.toString('utf8');

            const key = crypto.createHash('sha256').update(secret).digest();
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(tag);
            const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
            return decrypted;
        } catch (err) {
            // Fallback: return plain base64-decoded string (best-effort)
            try { return Buffer.from(b64, 'base64').toString('utf8'); }
            catch (e) { console.log('decodeTxnDataFromUrl error', e); return ''; }
        }
    }

    private configure(config: NPConfig) {
        const viewRoot = config.templateDir
            ? config.templateDir
            : path.join(__dirname, '..', 'views');
        this.viewPath = viewRoot.endsWith(path.sep) ? viewRoot : viewRoot + path.sep

        if (config.payu_url)
            this.payuInstance = new PayU(config);

        if (config.open_money_url)
            this.openMoneyInstance = new OpenMoney(config);

        if (config.razor_url) {
            this.razorPayInstance = new RazorPay({ key_id: config.KEY, key_secret: config.SECRET })
        }


        const sample = {
            orderId: "string",
            cusId: "string",
            time: 1770051201752,
            timeStamp: 1770051201752,
            status: "string",
            name: "string",
            email: "string",
            phone: "12345678",
            amount: 1,
            pname: "string",
            extra: "stringlarge",
            TXNID: "27118670199",
            returnUrl: "string"
        }
        this.db.create(this.tableNames.TRANSACTION, sample).catch(() => { });

    }

    private async insertTransactionInDb(txnData: NPTransaction): Promise<NPTransaction> {
        await this.db.insert(this.tableNames.TRANSACTION, txnData);
        return txnData;
    }

    private async generateChecksum(params: Record<string, any>): Promise<string> {
        return await new Promise<string>((resolve, reject) => {
            checksum_lib.genchecksum(params, this.config.KEY, (err: unknown, cs: string | undefined) => {
                if (err || !cs) {
                    reject(err || new Error('Error generating checksum'));
                    return;
                }
                resolve(cs);
            });
        });
    }

    home(req: Request, res: Response) {
        packageInfo.repository.url = packageInfo.repository.url.replace('git+', '')
        return renderView(req, res, this.viewPath + "home.hbs", packageInfo);
    }


    async init(req: Request, res: Response) {

        const config = this.config;
        const callbacks = this.callbacks;
        const vp = this.viewPath;
        const razorPayInstance = this.razorPayInstance;

        if (!req.body.ORDER_ID && !req.body.EMAIL && req.query?.to) {
            let toData = JSON.parse(this.decodeTxnDataFromUrl(req.query.to as string));
            req.body.NAME = toData.NAME
            req.body.EMAIL = toData.EMAIL
            req.body.TXN_AMOUNT = toData.TXN_AMOUNT
            req.body.MOBILE_NO = toData.MOBILE_NO
            req.body.ORDER_ID = toData.ORDER_ID || toData.ORDERID
            req.body.PRODUCT_NAME = toData.PRODUCT_NAME
            req.body.RETURN_URL = toData.RETURN_URL
        }

        Utils.sanitizeRequest(req.body);
        let gotAllParams = true;
        let checkedFields = ['TXN_AMOUNT', 'PRODUCT_NAME', 'MOBILE_NO', 'NAME', 'EMAIL']
        if (req.body !== undefined) {

            for (var i = 0; i < checkedFields.length; i++) {

                if (req.body[checkedFields[i]] === undefined) {
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
            var params: NPParam = {
                TXN_AMOUNT: req.body.TXN_AMOUNT,
            };

            params['MID'] = req.body.MID;
            params['WEBSITE'] = req.body.WEBSITE;
            params['CHANNEL_ID'] = req.body.CHANNEL_ID;
            params['INDUSTRY_TYPE_ID'] = req.body.INDUSTRY_TYPE_ID;
            params['ORDER_ID'] = req.body.ORDER_ID || req.body.ORDERID;
            params['CUST_ID'] = req.body.CUST_ID;
            params['TXN_AMOUNT'] = req.body.TXN_AMOUNT;
            params['CALLBACK_URL'] = req.body.CALLBACK_URL + "?order_id=" + req.body.ORDER_ID;
            params['EMAIL'] = req.body.EMAIL;
            params['MOBILE_NO'] = req.body.MOBILE_NO;
            params['PRODUCT_NAME'] = req.body.PRODUCT_NAME;
            params['NAME'] = req.body.NAME;

            if (this.config.paytm_url) {

                let initTxnbody: Record<string, any> = {
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
                if (this.config.mode) {
                    initTxnbody["enablePaymentMode"] = JSON.parse(this.config.mode)
                }

                let checksum = await PaytmChecksum.generateSignature(JSON.stringify(initTxnbody), this.config.KEY)
                let initTxnUrl = this.config.paytm_url + `/theia/api/v1/initiateTransaction?mid=${params['MID']}&orderId=${params['ORDER_ID']}`;

                try {
                    const resp = await axios.post(initTxnUrl, {
                        body: initTxnbody,
                        head: {
                            signature: checksum,
                            channelId: params['CHANNEL_ID']
                        }
                    });

                    const body = resp.data;

                    if (resp.status === 200 && body && body.body && body.body.resultInfo && body.body.resultInfo.resultStatus === 'S') {
                        let paytmJsToken: any = {};
                        paytmJsToken.CALLBACK_URL = params['CALLBACK_URL'];
                        paytmJsToken.ORDERID = params['ORDER_ID'];
                        paytmJsToken.ORDER_ID = params['ORDER_ID'];
                        paytmJsToken.CANCELLED = 'cancelled';
                        paytmJsToken.TOKEN = body.body.txnToken;
                        paytmJsToken.TXN_AMOUNT = params['TXN_AMOUNT'];
                        paytmJsToken.MID = params['MID'];
                        paytmJsToken.CALLBACK_URL = params['CALLBACK_URL'];

                        return renderPaytmJsCheckout(req, res, paytmJsToken, this.config);
                    }
                    else {
                        console.log('ERROR:::', resp.status, '\n', body);
                        res.status(500);
                        const errorResp: Record<string, any> = {
                            TXNID: 'na',
                            STATUS: 'TXN_FAILURE',
                            CANCELLED: 'cancelled',
                            ORDERID: params['ORDER_ID'],
                            CHECKSUMHASH: checksum
                        };
                        return sendAutoPostForm(req, res, params['CALLBACK_URL'], errorResp);
                    }
                } catch (err) {
                    console.log('ERROR:::', err);
                    res.status(500);
                    const errorResp: Record<string, any> = {
                        TXNID: 'na',
                        STATUS: 'TXN_FAILURE',
                        CANCELLED: 'cancelled',
                        ORDERID: params['ORDER_ID'],
                        CHECKSUMHASH: checksum
                    };
                    return sendAutoPostForm(req, res, params['CALLBACK_URL'], errorResp);
                }

            }
            else if (this.config.razor_url) {
                return renderRazorpayCheckout(req, res, params, this.config, LoadingSVG);
            }
            else if (this.config.payu_url) {
                const payuRequest = this.payuInstance.generatePaymentRequest(params);
                this.payuInstance.renderProcessingPage(params, payuRequest, res, LoadingSVG);
            }
            else if (this.config.open_money_url) {
                try {
                    let pmttoken = await this.openMoneyInstance.generatePaymentToken(params);
                    this.openMoneyInstance.renderProcessingPage(params, pmttoken, res, LoadingSVG);

                    var myquery = { orderId: params['ORDER_ID'] };
                    const objForUpdate = await this.db.getOne(this.tableNames.TRANSACTION, myquery);
                    if (objForUpdate) {
                        objForUpdate.extra = JSON.stringify({
                            layer_pay_token_id: pmttoken.tokenid
                        });
                        await this.db.update(this.tableNames.TRANSACTION, myquery, objForUpdate);
                    }

                } catch (e) {
                    this.openMoneyInstance.renderError(params, e, res)
                }
            }
            if (this.callbacks && typeof this.callbacks.onStart === 'function') {
                this.callbacks.onStart(params['ORDER_ID'], params);
            }
        }
        else if ((req.body.ORDER_ID !== undefined && req.body.ORDER_ID.length > 2) || gotAllParams) {

            let user = await this.useController.create({ name: req.body.NAME, email: req.body.EMAIL, phone: req.body.MOBILE_NO } as NPUser)

            //console.log(user)

            const onTxn = async (txnData: NPTransaction) => {


                //console.log(txnData)

                const params: Record<string, any> = {};
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


                const showConfirmation = (checksum = '') => {
                    return renderView(req, res, vp + "init.hbs", {
                        path_prefix: config.path_prefix,
                        action: "/" + config.path_prefix + "/init",
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
                    });
                }


                if (config.paytm_url) {
                    const checksum = await this.generateChecksum(params);
                    showConfirmation(checksum);
                }
                else if (config.razor_url || config.payu_url || config.open_money_url) {
                    showConfirmation()
                }

            };




            const onOrder = async (orderId: string): Promise<void> => {

                const txnTask = {
                    id: orderId,
                    orderId: orderId,
                    cusId: user.id,
                    time: Date.now(),
                    timeStamp: Date.now(),
                    status: 'INITIATED',
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    amount: req.body.TXN_AMOUNT,
                    pname: req.body.PRODUCT_NAME,
                    extra: '',
                    returnUrl: req.body.RETURN_URL || '',
                    webhookUrl: req.body.WEBHOOK_URL || '',
                    clientId: req.body.CLIENT_ID || ''
                };

                try {
                    const txn = await this.insertTransactionInDb(txnTask as NPTransaction);
                    await onTxn(txn);
                } catch (err) {
                    console.log(err)
                    if (req.body.RETURN_URL) {
                        res.redirect(req.body.RETURN_URL + "?status=failed")
                        return;
                    }
                    res.redirect('')
                }
            }

            if ((req.body.ORDER_ID !== undefined && req.body.ORDER_ID.length > 2)) {
                const myquery = { orderId: req.body.ORDER_ID };
                const orderData = await this.db.getOne(this.tableNames.TRANSACTION, myquery).catch(() => null) as NPTransaction | null;
                if (!orderData) {
                    if (gotAllParams) {
                        console.log("Creating new order for ", req.body.ORDER_ID)
                        await onOrder(req.body.ORDER_ID)
                    }
                    else {
                        res.send({ message: "Order Not Found or missing required data: " + checkedFields.join(", "), ORDERID: req.body.ORDER_ID })
                    }
                }
                else {
                    await onTxn(orderData);
                }
            }
            else {
                let orderId;
                if (config.paytm_url) {
                    orderId = "pay_" + makeid(config.id_length || IDLEN)
                    await onOrder(orderId)
                }
                else if (config.razor_url) {

                    const options = {
                        amount: req.body.TXN_AMOUNT * 100,
                        currency: "INR",
                        receipt: user.id + '_' + Date.now()
                    };
                    try {
                        const order = await razorPayInstance.orders.create(options);
                        orderId = order.id
                        await onOrder(orderId)
                    } catch (err: any) {
                        res.send({ message: "An error occurred ! " + (err?.description || err?.message || 'unknown_error') })
                    }
                }
                else if (config.open_money_url) {
                    orderId = "pay_" + makeid(config.id_length || IDLEN)
                    await onOrder(orderId)
                } else if (config.payu_url) {
                    orderId = "payu_" + makeid(config.id_length || IDLEN)
                    await onOrder(orderId)
                }



            }


        }
        else {


            return renderView(req, res, this.viewPath + "init.hbs", {

                path_prefix: this.config.path_prefix,
                action: "/" + this.config.path_prefix + "/init",
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

            });

        }

    }

    async updateTransaction(req: Request, res: Response): Promise<void> {
        const config = this.config;
        const vp = this.viewPath;
        const callbacks = this.callbacks;

        const orderToFind = req.body.ORDERID || req.body.ORDER_ID || req.body.ORDERId || (req.query && req.query.order_id) || req.body.ORDER_ID;
        const myquery = { orderId: orderToFind };

        let objForUpdate: NPTransaction | null = null;
        try {
            objForUpdate = await this.db.getOne(this.tableNames.TRANSACTION, myquery).catch(() => null) as NPTransaction | null;
            if (!objForUpdate) objForUpdate = await this.db.getOne(this.tableNames.TRANSACTION, { id: orderToFind }).catch(() => null) as NPTransaction | null;
            if (!objForUpdate) objForUpdate = await this.db.getOne(this.tableNames.TRANSACTION, { ORDERID: orderToFind }).catch(() => null) as NPTransaction | null;
        } catch {
            objForUpdate = objForUpdate || null;
        }

        let returnUrl = objForUpdate ? (objForUpdate.returnUrl as string | null) : null;
        let webhookUrl = objForUpdate ? (objForUpdate.webhookUrl as string | null) : null;
        if (webhookUrl === 'undefined') webhookUrl = null;
        if (returnUrl === 'undefined') returnUrl = null;

        if (!objForUpdate) {

            if (webhookUrl) {
                try {
                    await axios.post(webhookUrl, {
                        status: 'FAILED',
                        message: 'Transaction Not Found',
                        ORDERID: req.body.ORDERID,
                        TXNID: req.body.TXNID
                    });
                    console.log("Sent webhook to ", webhookUrl, 'orderId:', req.body.ORDERID, 'txnId:', req.body.TXNID)
                } catch (e: any) {
                    console.log("Error sending webhook to ", webhookUrl, e?.message || e, 'orderId:', req.body.ORDERID, 'txnId:', req.body.TXNID)
                }
            }

            if (returnUrl) {
                const separator = returnUrl.indexOf('?') > -1 ? '&' : '?';
                return res.redirect(`${returnUrl}${separator}status=FAILED&message=txn_not_found&ORDERID=${req.body.ORDERID}`);
            }
            res.send({ message: "Transaction Not Found !", ORDERID: req.body.ORDERID, TXNID: req.body.TXNID });
            return;
        }

        if (!["INITIATED", "TXN_PENDING", "PENDING"].includes(String(objForUpdate.status))) {
            objForUpdate.readonly = "readonly";

            if (webhookUrl) {
                try {
                    await axios.post(webhookUrl, objForUpdate);
                    console.log("Sent webhook to ", webhookUrl, 'orderId:', req.body.ORDERID, 'txnId:', req.body.TXNID)
                } catch (e: any) {
                    console.log("Error sending webhook to ", webhookUrl, e?.message || e, 'orderId:', req.body.ORDERID, 'txnId:', req.body.TXNID)
                }
            }

            if (returnUrl) {
                const separator = returnUrl.indexOf('?') > -1 ? '&' : '?';
                return res.redirect(`${returnUrl}${separator}status=${objForUpdate.status}&ORDERID=${objForUpdate.orderId}&TXNID=${objForUpdate.txnId}`);
            }

            renderView(req, res, vp + "result.hbs", {
                path_prefix: config.path_prefix,
                ...objForUpdate
            });
            return;
        }

        if (req.body.status === "paid" && !req.body.STATUS) req.body.STATUS = "TXN_SUCCESS";
        objForUpdate.status = req.body.STATUS;
        objForUpdate.txnId = req.body.TXNID;
        objForUpdate.extra = JSON.stringify(req.body);

        try {
            await this.db.update(this.tableNames.TRANSACTION, myquery, objForUpdate);
        } catch {
            if (returnUrl) {
                const separator = returnUrl.indexOf('?') > -1 ? '&' : '?';
                return res.redirect(`${returnUrl}${separator}status=FAILED&message=update_error&ORDERID=${req.body.ORDERID}`);
            }
            res.send({ message: "Error Occured !", ORDERID: req.body.ORDERID, TXNID: req.body.TXNID });
            return;
        }

        if (callbacks && typeof callbacks.onFinish === 'function') {
            callbacks.onFinish(req.body.ORDERID, objForUpdate);
        }
        objForUpdate.readonly = "readonly";
        if (webhookUrl) {
            try {
                await axios.post(webhookUrl, objForUpdate);
                console.log("Sent webhook to ", webhookUrl, 'orderId:', req.body.ORDERID, 'txnId:', req.body.TXNID);
            }
            catch (e) {
                console.log("Error sending webhook to ", webhookUrl, (e === null || e === void 0 ? void 0 : e.message) || e, 'orderId:', req.body.ORDERID, 'txnId:', req.body.TXNID);
            }
        }
        if (returnUrl) {
            const separator = returnUrl.indexOf('?') > -1 ? '&' : '?';
            return res.redirect(`${returnUrl}${separator}status=${objForUpdate.status}&ORDERID=${objForUpdate.orderId}&TXNID=${objForUpdate.txnId}`);
        }
        renderView(req, res, vp + "result.hbs", {
            path_prefix: config.path_prefix,
            ...objForUpdate
        });
    }

    async callback(req: Request, res: Response): Promise<void> {
        const config = this.config;
        const payuInstance = this.payuInstance;
        const openMoneyInstance = this.openMoneyInstance;

        console.log("request_data ", req.originalUrl, JSON.stringify(req.body))

        // Normalize common order id and txn id field names (support ORDER_ID, ORDERID, etc.)
        try {
            if ((!req.body.ORDERID || req.body.ORDERID === '') && req.body.ORDER_ID) {
                req.body.ORDERID = req.body.ORDER_ID;
            }
            if ((!req.body.TXNID || req.body.TXNID === '') && req.body.TXN_ID) {
                req.body.TXNID = req.body.TXN_ID;
            }
            if ((!req.body.ORDERID || req.body.ORDERID === '') && req.query && req.query.order_id) {
                req.body.ORDERID = req.query.order_id;
            }
        } catch {
            // ignore
        }

        let result = false;
        let isCancelled = false;
        if (config.paytm_url) {
            const checksumhash = req.body.CHECKSUMHASH;
            if (checksumhash) {
                result = await checksum_lib.verifychecksum(req.body, config.KEY, checksumhash);
            } else {
                const liveStatus = await this.getStatusFromPaytm({ MID: config.MID, ORDERID: req.body.ORDERID }, req.body.ORDERID);
                // Merge important fields when live status is available
                if (liveStatus && typeof liveStatus === 'object') {
                    req.body.STATUS = liveStatus.STATUS || req.body.STATUS;
                    req.body.TXNID = liveStatus.TXNID || req.body.TXNID;
                }
                result = liveStatus && liveStatus.STATUS == req.body.STATUS;
            }
            if (req.body.STATUS === 'TXN_FAILURE' && req.body.CANCELLED === "cancelled" && req.body.TXNID) {
                isCancelled = true;
            }

        } else if (config.razor_url) {
            let orderid = req.body.razorpay_order_id || req.query.ORDERID || req.query.order_id;
            let liveResonse = null as any
            if (orderid) {
                liveResonse = await this.razorPayInstance.orders.fetch(orderid).catch(() => null);
                req.body.extras = liveResonse
            }
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
                    const orderId = JSON.parse(req.body.error.metadata).order_id
                    req.body.razorpay_order_id = orderId
                }
                req.body.STATUS = liveResonse?.attempts ? 'TXN_FAILURE' : 'CANCELLED';
                req.body.ORDERID = req.body.razorpay_order_id || req.query.order_id
                isCancelled = true;
            }
        }
        else if (config.payu_url) {
            const payuRest = await payuInstance.verifyResult(req);
            result = !!payuRest.STATUS;
            req.body.STATUS = payuRest.STATUS;
            req.body.TXNID = payuRest.TXNID;
            req.body.ORDERID = payuRest.ORDERID || req.query.order_id;
            req.body.extras = payuRest.data;
            isCancelled = !!payuRest.cancelled;
        }
        else if (config.open_money_url) {
            const openRest = await openMoneyInstance.verifyResult(req);
            result = true;
            req.body.STATUS = openRest.STATUS
            req.body.TXNID = openRest.TXNID
            req.body.ORDERID = openRest.ORDERID || req.query.order_id
            req.body.extras = openRest.data
        }


        console.log("NodePayTMPG::Transaction => ", req.body.ORDERID, req.body.STATUS);

        if (result || isCancelled) {
            await this.updateTransaction(req, res);
        }
        else {
            res.send({ message: "Something went wrong ! Please try again later .", ORDERID: req.body.ORDERID, TXNID: req.body.TXNID })
        }
    }

    async webhook(req: Request, res: Response): Promise<void> {
        const config = this.config;
        const payuInstance = this.payuInstance;
        const openMoneyInstance = this.openMoneyInstance;

        console.log("request_data ", req.originalUrl, JSON.stringify(req.body))
        console.log("request_data rawBody", req.originalUrl, (req as any).rawBody)
        console.log("request_headers ", req.originalUrl, JSON.stringify(req.headers));

        if (config.paytm_url) {
            await this.callback(req, res);
            return;
        }

        if (config.razor_url) {
            const events = ["payment.captured", "payment.pending", "payment.failed"];
            if (req.body.event && events.indexOf(req.body.event) > -1) {
                if (req.body.payload &&
                    req.body.payload.payment &&
                    req.body.payload.payment.entity) {

                    const entity = req.body.payload.payment.entity;
                    const razorpay_order_id = entity.order_id;
                    const razorpay_payment_id = entity.id;
                    const status = entity.status;
                    const event = req.body.event;
                    console.log(`Razorpay webhook payment order=${razorpay_order_id} payid=${razorpay_payment_id} status=${status}`)

                    const reqBody = (req as any).rawBody;
                    const signature = req.headers["x-razorpay-signature"];
                    console.log("Razorpay webhook signature:", signature);
                    if (signature === undefined) {
                        res.status(400).send({ message: "Missing Razorpay signature" });
                        return;
                    }
                    let signatureValid
                    try {
                        signatureValid = RazorPay.validateWebhookSignature(reqBody, signature, config.SECRET);
                    } catch (e) {
                        signatureValid = false
                    }
                    if (signatureValid) {
                        if (event === events[0]) {
                            req.body.STATUS = "TXN_SUCCESS";
                        }
                        else if (event === events[1]) { //pending
                            req.body.STATUS = "TXN_PENDING";
                        }
                        else { // failed
                            req.body.STATUS = "TXN_FAILURE";
                        }
                        req.body.ORDERID = razorpay_order_id;
                        req.body.TXNID = razorpay_payment_id;
                        setTimeout(() => {
                            this.updateTransaction(req, res);
                        }, 3000);
                    }
                    else {
                        res.status(401).send({ message: "Invalid Rzpay signature" });
                    }
                }
                else {
                    res.status(400).send({ message: "Invalid Payload" });
                }
            }
            else {
                res.status(400).send({ message: "Unsupported event : " + req.body.event });
            }
            return;
        }

        if (config.payu_url) {
            payuInstance.processWebhook(req, res, this.updateTransaction);
            return;
        }
        if (config.open_money_url) {
            openMoneyInstance.processWebhook(req, res, this.updateTransaction);
        }
    }

    async createTxn(req: Request, res: Response): Promise<void> {

        const config = this.config;
        const razorPayInstance = this.razorPayInstance;

        // mandayory field
        const requiredFields = ['NAME', 'EMAIL', 'MOBILE_NO', 'TXN_AMOUNT', 'PRODUCT_NAME'];
        const checkedFields: string[] = [];
        let gotAllParams = true;
        requiredFields.forEach(field => {
            if (!req.body[field]) {
                gotAllParams = false;
                checkedFields.push(field);
            }
        })
        if (!gotAllParams) {
            res.status(400).send({ message: "Missing required fields", missing: checkedFields });
            return;
        }

        try {
            const user = await this.useController.create({ name: req.body.NAME, email: req.body.EMAIL, phone: req.body.MOBILE_NO } as NPUser);

            let id = '';
            if (config.paytm_url) {
                id = "pay_" + makeid(config.id_length || IDLEN)
            }
            else if (config.razor_url) {

                const options = {
                    amount: req.body.TXN_AMOUNT * 100,
                    currency: "INR",
                    receipt: user.id + '_' + Date.now()
                };
                const order = await razorPayInstance.orders.create(options);
                id = order.id;
            }
            else if (config.payu_url) {
                id = "payu_" + makeid(config.id_length || IDLEN)
            }
            else if (config.open_money_url) {
                id = "pay_" + makeid(config.id_length || IDLEN)
            }

            const txnTask = {
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
                returnUrl: req.body.RETURN_URL || '',
                webhookUrl: req.body.WEBHOOK_URL || '',
                extra: (req.body.EXTRA || ''),
                clientId: req.body.CLIENT_ID || ''

            };


            const txn = await this.insertTransactionInDb(txnTask as NPTransaction) as NPTransaction & { payurl?: string };
            const urlData64 = this.encodeTxnDataForUrl(JSON.stringify({
                NAME: txn.name,
                EMAIL: txn.email,
                MOBILE_NO: txn.phone,
                ORDER_ID: txn.orderId,
                RETURN_URL: txn.returnUrl,
                WEBHOOK_URL: txn.webhookUrl,
                TXN_AMOUNT: txn.amount,
                PRODUCT_NAME: txn.pname,
                clientId: txn.clientId
            }))

            txn.payurl = config.host_url + '/' + config.path_prefix + '/init?to=' + urlData64;
            res.send(txn)
        } catch (err) {

            console.log(err)

            res.redirect('')
        }



    };

    async createTxnToken(req: Request, res: Response): Promise<void> {
        return this.createTxn(req, res);
    };

    // optional user
    async getTransactions(req: Request, res: Response): Promise<void> {
        // parameters can be from query or body
        // MID, MOBILE_NO, PRODUCT_NAME, EMAIL, NAME, limit, offset
        const params = { ...(req.query || {}), ...(req.body || {}) };

        // Build query map from incoming fields to db columns
        const query: Record<string, any> = {};
        const fieldMap: Record<string, string> = {
            MOBILE_NO: 'phone',
            PRODUCT_NAME: 'pname',
            EMAIL: 'email',
            NAME: 'name',
            ORDER_ID: 'orderId',
            ORDERID: 'orderId',
            STATUS: 'status',
            email: 'email',
            phone: 'phone',
            name: 'name',
            product_name: 'pname',
            order_id: 'orderId',
            status: 'status',
            mobile_no: 'phone',
            CLIENT_ID: 'clientId',
            clientId: 'clientId',
            WEBHOOK_URL: 'webhookUrl',
            webhookUrl: 'webhookUrl',
        };

        Object.keys(fieldMap).forEach((key) => {
            if (params[key]) {
                query[fieldMap[key]] = params[key];
            }
        });

        // Pagination
        const limit = Math.min(parseInt(params.limit, 10) || 20, 100);
        const offset = Math.max(parseInt(params.offset, 10) || 0, 0);

        try {

            const all = await this.db.get(this.tableNames.TRANSACTION, query, {
                sort: [{ field: 'time', order: 'desc' }],
                limit: limit,
                offset: offset
            });

            res.send({
                limit,
                offset,
                count: all.length,
                transactions: all
            });
        }
        catch (err: any) {
            console.log('getTransactions error', err);
            res.status(500).send({ message: 'Failed to fetch transactions', error: err?.message || 'unknown_error' });
        }
    }


    async status(req: Request, res: Response): Promise<void> {
        const config = this.config;
        const callbacks = this.callbacks;
        const payuInstance = this.payuInstance;
        const openMoneyInstance = this.openMoneyInstance;
        const razorPayInstance = this.razorPayInstance;

        if (!req.body.ORDERID && req.query.ORDERID) {
            req.body.ORDERID = req.query.ORDERID
        }
        if (!req.body.ORDER_ID && req.query.ORDER_ID) {
            req.body.ORDER_ID = req.query.ORDER_ID
        }
        if (!req.body.ORDER_ID && req.body.ORDERID) {
            req.body.ORDER_ID = req.body.ORDERID
        }
        if (!req.body.ORDER_ID) {
            res.status(400).send({ message: "Missing ORDER_ID" })
            return
        }
        const myquery = { orderId: req.body.ORDER_ID };
        const orderData = await this.db.getOne(this.tableNames.TRANSACTION, myquery).catch((err) => {
            res.send(err)
            return null;
        }) as NPTransaction | null;
        if (!orderData) {
            if (!res.headersSent) {
                res.send({ message: "Order Not Found or not initiated yet!", ORDER_ID: req.body.ORDER_ID })
            }
            return;
        }
        if (orderData.status === "INITIATED") {

            const params: Record<string, any> = {}
            params["MID"] = config.MID;
            params["ORDERID"] = req.body.ORDER_ID;

            const onStatusUpdate = async (paytmResponse: any) => {
                if (paytmResponse.TXNID && paytmResponse.TXNID.length > 4) {
                    orderData.status = paytmResponse.STATUS;
                    orderData.extra = JSON.stringify(paytmResponse);

                    try {
                        await this.db.update(this.tableNames.TRANSACTION, myquery, orderData);
                    } catch (err) {
                        res.send({ message: "Error Occured !", ORDERID: paytmResponse.ORDERID, TXNID: paytmResponse.TXNID })
                        return;
                    }
                    if (callbacks && typeof callbacks.onFinish === 'function') {
                        callbacks.onFinish(req.body.ORDER_ID, orderData);
                    }
                    res.send(paytmResponse)
                }
                else {
                    res.send(orderData)

                }
            }

            if (config.paytm_url) {
                const paytmResponse = await this.getStatusFromPaytm(params, req.body.ORDER_ID);
                await onStatusUpdate(paytmResponse);
            }
            else if (config.razor_url) {
                let result = await razorPayInstance.orders.fetch(req.body.ORDER_ID)
                result.ORDERID = req.body.ORDER_ID
                if (result.status == 'paid' && result.amount_due == 0) {
                    result.STATUS = 'TXN_SUCCESS'
                    let payments = await razorPayInstance.orders.fetchPayments(req.body.ORDER_ID)
                    payments.items.forEach((item: any) => {
                        if (item.status == 'captured') {
                            result.TXNID = item.id
                        }
                    });
                    result.payments = payments;

                    await onStatusUpdate(result)
                }
                else {
                    res.send(orderData);
                }
            }
            else if (config.payu_url) {
                let result = await payuInstance.getPaymentStatus(req.body.ORDER_ID)
                if (result && result.transaction_details && result.transaction_details[req.body.ORDER_ID]) {
                    let txn = result.transaction_details[req.body.ORDER_ID];
                    let status = 'TXN_FAILURE'
                    if (txn.status == 'success') {
                        status = 'TXN_SUCCESS'
                    }
                    else if (txn.status == 'pending') {
                        status = 'TXN_PENDING'
                    }
                    await onStatusUpdate({
                        STATUS: status,
                        ORDERID: req.body.ORDER_ID,
                        TXNID: txn.mihpayid || txn.txnid,
                        payu: txn
                    })
                }
                else {
                    res.send(orderData);
                }
            }
            else if (config.open_money_url) {
                let extras = JSON.parse(orderData.extra)
                if (!extras || !extras.layer_pay_token_id) {
                    res.status(500)
                    res.send({ message: 'An unexpected error occured. No payment token exists' })
                    return
                }
                let result = await openMoneyInstance.getPaymentStatus(extras.layer_pay_token_id)
                result = JSON.parse(result)
                result.ORDERID = req.body.ORDER_ID
                if (result.status == 'paid' || result.status == 'captured') {
                    result.STATUS = 'TXN_SUCCESS'
                    result.TXNID = result.id
                    await onStatusUpdate(result)
                }
                else if (result.status == 'pending' || result.status == 'attempted') {
                    result.STATUS = 'TXN_PENDING'
                    result.TXNID = result.id
                    await onStatusUpdate(result)
                }
                // else if (result.status == 'failed' || result.status == 'cancelled') {
                //     result.STATUS = 'TXN_FAILED'
                //     result.TXNID = result.id
                //     onStatusUpdate(result)
                // }
                else {
                    res.send(orderData);
                }
            }

        }
        else {
            res.send(orderData);
        }


    }

    private async getStatusFromPaytm(params: Record<string, any>, orderId: string): Promise<any> {
        const checksum = await this.generateChecksum(params);

        try {
            const resp = await axios.post(`${this.config.paytm_url}/order/status`, { MID: this.config.MID, ORDERID: orderId, CHECKSUMHASH: checksum });
            if (resp.status === 200) {
                return resp.data;
            }
            console.log('ERROR:::', resp.status, '\n', resp.data);
            return { message: 'Error Occured !', ORDERID: orderId };
        } catch (err) {
            console.log('ERROR:::', err);
            return { message: 'Error Occured !', ORDERID: orderId };
        }
    }

}

