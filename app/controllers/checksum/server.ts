import * as http from 'http';
import * as https from 'https';
import * as qs from 'querystring';
import { genchecksum, verifychecksum } from './checksum';

const port = 8080;

const PaytmConfig = {
    mid: 'XXXXXXXXXXXXXXXXXXXX',
    key: 'XXXXXXXXXXXXXXXX',
    website: 'XXXXXXXXXX',
};

http.createServer(function (req, res) {
    switch (req.url) {
        case '/': {
            const params: Record<string, any> = {};
            params['MID'] = PaytmConfig.mid;
            params['WEBSITE'] = PaytmConfig.website;
            params['CHANNEL_ID'] = 'WEB';
            params['INDUSTRY_TYPE_ID'] = 'Retail';
            params['ORDER_ID'] = 'TEST_' + new Date().getTime();
            params['CUST_ID'] = 'Customer001';
            params['TXN_AMOUNT'] = '1.00';
            params['CALLBACK_URL'] = 'http://localhost:' + port + '/callback';
            params['EMAIL'] = 'abc@mailinator.com';
            params['MOBILE_NO'] = '7777777777';

            genchecksum(params, PaytmConfig.key, function (err, checksum) {
                const txn_url = 'https://securegw-stage.paytm.in/theia/processTransaction';
                let form_fields = '';
                for (const x in params) {
                    form_fields += "<input type='hidden' name='" + x + "' value='" + params[x] + "' >";
                }
                form_fields += "<input type='hidden' name='CHECKSUMHASH' value='" + checksum + "' >";

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.write('<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' + txn_url + '" name="f1">' + form_fields + '</form><script type="text/javascript">document.f1.submit();</script></body></html>');
                res.end();
            });
            break;
        }
        case '/callback': {
            let body = '';
            req.on('data', function (data) {
                body += data;
            });
            req.on('end', function () {
                let html = '';
                const post_data = qs.parse(body as string) as Record<string, any>;
                console.log('Callback Response: ', post_data, '\n');
                html += '<b>Callback Response</b><br>';
                for (const x in post_data) {
                    html += x + ' => ' + post_data[x] + '<br/>';
                }
                html += '<br/><br/>';

                const checksumhash = post_data.CHECKSUMHASH as string;
                const result = verifychecksum(post_data, PaytmConfig.key, checksumhash);
                console.log('Checksum Result => ', result, '\n');
                html += '<b>Checksum Result</b> => ' + (result ? 'True' : 'False');
                html += '<br/><br/>';

                const params = { MID: PaytmConfig.mid, ORDERID: post_data.ORDERID } as Record<string, any>;

                genchecksum(params, PaytmConfig.key, function (err, checksum) {
                    params.CHECKSUMHASH = checksum;
                    const postData = 'JsonData=' + JSON.stringify(params);

                    const options = {
                        hostname: 'securegw-stage.paytm.in',
                        port: 443,
                        path: '/merchant-status/getTxnStatus',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Content-Length': Buffer.byteLength(postData),
                        },
                    } as https.RequestOptions;

                    let response = '';
                    const post_req = https.request(options, function (post_res) {
                        post_res.on('data', function (chunk) {
                            response += chunk;
                        });
                        post_res.on('end', function () {
                            console.log('S2S Response: ', response, '\n');
                            const _result = JSON.parse(response);
                            html += '<b>Status Check Response</b><br>';
                            for (const x in _result) {
                                html += x + ' => ' + _result[x] + '<br/>';
                            }
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.write(html);
                            res.end();
                        });
                    });

                    post_req.write(postData);
                    post_req.end();
                });
            });
            break;
        }
    }
}).listen(port);
