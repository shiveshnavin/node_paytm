import axios, { AxiosRequestConfig } from 'axios';
import * as crypto from 'crypto';
const reqpost: any = require('request');

export interface OpenMoneyConfig {
  accesskey: string;
  secretkey: string;
  url: string;
  script_url: string;
  KEY?: string;
  SECRET?: string;
  open_money_url?: string;
}

type AnyObject = { [k: string]: any };

export default class OpenMoney {
  config: OpenMoneyConfig;

  constructor(npconfig: AnyObject) {
    npconfig.accesskey = npconfig.KEY;
    npconfig.secretkey = npconfig.SECRET;
    npconfig.url = npconfig.open_money_url;
    npconfig.script_url = (npconfig.url && npconfig.url.indexOf('sandbox') === -1)
      ? 'https://payments.open.money/layer'
      : 'https://sandbox-payments.open.money/layer';
    this.config = npconfig as OpenMoneyConfig;
  }

  generatePaymentToken(params: AnyObject): Promise<AnyObject> {
    const config = this.config;
    return new Promise((resolve, reject) => {
      const open_txn = {
        amount: params['TXN_AMOUNT'],
        currency: params['CURRENCY'] || 'INR',
        name: params['NAME'],
        email_id: params['EMAIL'],
        contact_number: ('' + params['MOBILE_NO']).replace('+91', ''),
        mtx: params['ORDER_ID'],
      };

      create_payment_token(open_txn, config.accesskey, config.secretkey, config.url, (layer_payment_token_data: AnyObject) => {
        if (typeof layer_payment_token_data['error'] !== 'undefined')
          return reject(JSON.stringify('E55 Payment error. ' + layer_payment_token_data['error']));

        if (typeof layer_payment_token_data['id'] === 'undefined' || !layer_payment_token_data['id'])
          return reject(JSON.stringify('Payment error. ' + 'Layer token ID cannot be empty.'));

        if (typeof layer_payment_token_data['id'] !== 'undefined') {
          get_payment_token(layer_payment_token_data['id'], config.accesskey, config.secretkey, config.url, (payment_token_data_raw: any) => {
            if (payment_token_data_raw && payment_token_data_raw.error) {
              return reject({ error: payment_token_data_raw.error });
            }

            let payment_token_data: AnyObject;
            try {
              payment_token_data = JSON.parse(payment_token_data_raw);
            } catch (e) {
              return reject({ error: 'Invalid payment token response' });
            }

            if (typeof payment_token_data['error'] !== 'undefined')
              return reject({ error: JSON.stringify('E56 Payment error. ' + payment_token_data['error']) });
            if (typeof payment_token_data['status'] !== 'undefined' && payment_token_data['status'] === 'paid')
              return reject({ error: JSON.stringify('Layer: this order has already been paid.') });
            if (parseFloat(payment_token_data['amount']) !== parseFloat(params['TXN_AMOUNT']))
              return reject({ error: JSON.stringify('Layer: an amount mismatch occurred.') });

            const hash = create_hash({
              layer_pay_token_id: payment_token_data['id'],
              layer_order_amount: payment_token_data['amount'],
              tranid: params['ORDER_ID'],
            }, config.accesskey, config.secretkey);
            params['CHECKSUM'] = hash;

            let html = `<form action='${params['CALLBACK_URL']}' method='post' style='display: none' name='layer_payment_int_form'>`;
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
              html,
              params,
              data: config,
              tokenid: payment_token_data['id'],
              amount: payment_token_data['amount'],
              hash,
            });
          });
        }
      });
    });
  }

  verifyResult(req: AnyObject): Promise<AnyObject> {
    const config = this.config;
    return new Promise((resolve) => {
      let txnid = '';
      let amount = '';
      let tokenid = '';
      let paymentid = '';
      let payment_data: AnyObject = {};

      if (!req.body.layer_payment_id) {
        return resolve({ STATUS: 'TXN_FAILURE', ORDERID: txnid, TXNID: paymentid, reason: 'invalid response' });
      } else {
        txnid = req.body.tranid;
        amount = req.body.layer_order_amount;
        tokenid = req.body.layer_pay_token_id;
        paymentid = req.body.layer_payment_id;
      }

      const data = {
        layer_pay_token_id: tokenid,
        layer_order_amount: amount,
        tranid: txnid,
      };

      if (verify_hash(data, req.body.hash, config.accesskey, config.secretkey)) {
        get_payment_details(paymentid, config.accesskey, config.secretkey, config.url, (response: any) => {
          if (response === '{}') {
            return resolve({ STATUS: 'TXN_FAILURE', ORDERID: txnid, TXNID: paymentid, message: 'Invalid Response', data: payment_data });
          } else {
            payment_data = JSON.parse(response);
            if (!payment_data['payment_token'] || payment_data['payment_token']['id'] != tokenid) {
              return resolve({ STATUS: 'TXN_FAILURE', ORDERID: txnid, TXNID: paymentid, message: 'received layer_pay_token_id and collected layer_pay_token_id doesnt match', data: payment_data });
            } else {
              let status = '';
              if (payment_data.status == 'captured' || payment_data.status == 'late_authorized') {
                status = 'TXN_SUCCESS';
              } else if (payment_data.status == 'pending') {
                status = 'TXN_PENDING';
              } else {
                status = 'TXN_FAILURE';
              }

              return resolve({ STATUS: status, ORDERID: txnid, TXNID: paymentid, data: payment_data });
            }
          }
        });
      } else {
        return resolve({ STATUS: 'TXN_FAILURE', ORDERID: txnid, TXNID: paymentid, message: 'Invalid Response' });
      }
    });
  }

  processWebhook(req: AnyObject, res: AnyObject, updateTransaction: Function) {
    const config = this.config;
    const events = ['payment_captured', 'payment_pending', 'payment_failed', 'payment_cancelled'];
    if (req.body.event && events.indexOf(req.body.event) > -1) {
      if (req.body.payment_token) {
        const payment_token = req.body.payment_token;
        const orderId = payment_token.mtx;
        const paymentid = req.body.id;
        const tokenid = payment_token.id;
        let payment_data: AnyObject = {};
        const amount = req.body.amount;

        setTimeout(() => {
          req.body.layer_pay_token_id = tokenid;
          get_payment_details(paymentid, config.accesskey, config.secretkey, config.url, (response: any) => {
            if (response === '{}') {
              req.body.STATUS = 'TXN_FAILURE';
              req.body.ORDERID = orderId;
              req.body.TXNID = paymentid;
            } else {
              payment_data = JSON.parse(response);
              if (!payment_data['payment_token'] || payment_data['payment_token']['id'] != tokenid) {
                req.body.STATUS = 'TXN_FAILURE';
                req.body.ORDERID = orderId;
                req.body.TXNID = paymentid;
              } else {
                let status = 'INITIATED';
                if (payment_data.status == 'captured' || payment_data.status == 'late_authorized') {
                  status = 'TXN_SUCCESS';
                } else if (payment_data.status == 'pending') {
                  status = 'TXN_PENDING';
                }

                if (status != 'TXN_SUCCESS') {
                  if (req.body.status == 'paid' || req.body.status == 'captured') {
                    status = 'TXN_SUCCESS';
                  } else if (req.body.status == 'pending') {
                    status = 'TXN_PENDING';
                  }
                }
                console.log(`Open Money ${req.body.event} webhook for order=${payment_token.mtx} payid=${paymentid} status=${req.body.status} || ${status}`);

                req.body.STATUS = status;
                req.body.ORDERID = orderId;
                req.body.TXNID = paymentid;
              }
            }
            updateTransaction(req, res);
          });
        }, 3000);
      } else {
        res.status(401);
        res.send({ message: 'Missing payment_token' });
      }
    } else {
      res.status(201);
      res.send({ message: 'Webhook not supported' });
    }
  }

  getPaymentStatus(paymentTokenId: string, cb?: (data: any) => void): Promise<any> {
    return new Promise((resolve) => {
      get_payment_token_details(paymentTokenId, this.config.accesskey, this.config.secretkey, this.config.url, (data: any) => {
        resolve(data);
        if (cb) cb(data);
      });
    });
  }

  renderProcessingPage(params: AnyObject, pmttoken: AnyObject, res: AnyObject, loadingSVG: string) {
    const headScript = `<script src="${this.config.script_url}"></script>`;
    const bodyScript = `<script>triggerLayer();</script>`;
    const html = require('../htmlhelper').buildProcessingPageHtml(pmttoken.html, loadingSVG, 'Merchant Checkout Page', headScript, bodyScript);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(html);
    res.end();
  }

  renderError(params: AnyObject, error: any, res: AnyObject) {
    console.log('ERROR:::', error, '\n');
    res.status(500);
    const errorResp = { TXNID: 'na', STATUS: 'TXN_FAILURE', CANCELLED: 'cancelled', ORDERID: params['ORDER_ID'], CHECKSUMHASH: params['CHECKSUM'] };
    const html = require('../htmlhelper').buildAutoPostFormHtml(params['CALLBACK_URL'], errorResp);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(html);
    res.end();
  }
}

// Helper functions
function create_payment_token(data: AnyObject, accesskey: string, secretkey: string, baseurl: string, callback: (resp: any) => void) {
  try {
    const pay_token_request_data = {
      amount: data['amount'] ? data['amount'] : null,
      currency: data['currency'] ? data['currency'] : null,
      name: data['name'] ? data['name'] : null,
      email_id: data['email_id'] ? data['email_id'] : null,
      contact_number: data['contact_number'] ? data['contact_number'] : null,
      mtx: data['mtx'] ? data['mtx'] : null,
      udf: data['udf'] ? data['udf'] : null,
    };
    http_post(pay_token_request_data, 'payment_token', accesskey, secretkey, baseurl, (response: any) => {
      return callback(response);
    });
  } catch (e) {
    return callback({ error: e });
  }
}

function get_payment_token(payment_token_id: string, accesskey: string, secretkey: string, url: string, callback: (resp: any) => void) {
  if (!payment_token_id) throw new Error('payment_token_id cannot be empty');
  try {
    http_get('payment_token/' + payment_token_id, accesskey, secretkey, url, (response: any) => {
      return callback(response);
    });
  } catch (e) {
    return callback({ error: e });
  }
}

function get_payment_token_details(payment_tokenid: string, accesskey: string, secretkey: string, baseurl: string, callback: (resp: any) => void) {
  if (!payment_tokenid) throw new Error('payment_id cannot be empty');
  try {
    http_get('payment_token/' + payment_tokenid + '/payment', accesskey, secretkey, baseurl, (response: any) => {
      return callback(response);
    });
  } catch (e) {
    callback({ error: e });
  }
}

function get_payment_details(payment_id: string, accesskey: string, secretkey: string, baseurl: string, callback: (resp: any) => void) {
  if (!payment_id) throw new Error('payment_id cannot be empty');
  try {
    http_get('payment/' + payment_id, accesskey, secretkey, baseurl, (response: any) => {
      return callback(response);
    });
  } catch (e) {
    callback({ error: e });
  }
}

function http_post(data: AnyObject, route: string, accesskey: string, secretkey: string, baseurl: string, callback: (resp: any) => void) {
  Object.keys(data).forEach((key) => { if (data[key] === null) delete data[key]; });
  const url = baseurl + '/' + route;
  const options: AnyObject = {
    method: 'POST',
    uri: url,
    json: true,
    form: {
      amount: data['amount'],
      currency: data['currency'],
      name: data['name'],
      email_id: data['email_id'],
      contact_number: data['contact_number'],
      mtx: data['mtx'],
    },
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accesskey + ':' + secretkey,
    },
  };

  reqpost(options)
    .on('response', function (resp: any) {
      resp.setEncoding('utf8');
      resp.on('data', function (chunk: string) {
        const data = JSON.parse(chunk);
        let rdata = '';
        if ('error' in data) {
          Object.keys(data).forEach(function (key) {
            if (key == 'error_data') {
              const obj = data[key];
              Object.keys(obj).forEach(function (k) {
                rdata += obj[k] + ' ';
              });
            }
          });
          return callback({ error: rdata });
        } else return callback(data);
      });
    })
    .on('error', function (err: any) {
      return callback(err);
    });
}

function http_get(route: string, accesskey: string, secretkey: string, baseurl: string, callback: (resp: any) => void) {
  const url = baseurl + '/' + route;
  const options: AxiosRequestConfig = {
    method: 'GET',
    url,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accesskey + ':' + secretkey,
    },
  };

  axios(options)
    .then((d) => {
      callback(JSON.stringify(d.data));
    })
    .catch((e) => {
      callback('{}');
    });
}

function create_hash(data: AnyObject, accesskey: string, secretkey: string) {
  data = ksort(data);
  let hash_string = accesskey;
  Object.keys(data).forEach(function (key) {
    hash_string += '|' + data[key];
  });
  const cryp = crypto.createHash('sha256');
  cryp.update(hash_string);
  return cryp.digest('hex');
}

function verify_hash(data: AnyObject, rec_hash: string, accesskey: string, secretkey: string) {
  const gen_hash = create_hash(data, accesskey, secretkey);
  return gen_hash === rec_hash;
}

function ksort(obj: AnyObject) {
  const keys = Object.keys(obj).sort();
  const sortedObj: AnyObject = {};
  for (const i of keys) sortedObj[i] = obj[i];
  return sortedObj;
}
