import { Request, Response } from 'express';
import { NPConfig } from '../models';
import { createPaytmJsCheckoutHtml } from './adapters/paytm';

function wantsJson(req: Request): boolean {
    // Return true only when the caller EXPLICITLY sets Accept to only `application/json`.
    // Examples that return true: "application/json" or "application/json; q=1"
    // Examples that return false: "application/json, */*", "text/html", missing header, etc.
    const hdr = String((req && req.headers && req.headers.accept) || '').trim().toLowerCase();
    if (!hdr) return false;
    const types = hdr.split(',').map(t => t.split(';')[0].trim()).filter(Boolean);
    return types.length > 0 && types.every(t => t === 'application/json');
}

export function renderView(req: Request, res: Response, viewFile: string, data: any) {
    if (wantsJson(req)) {
        return res.json(data);
    }
    return res.render(viewFile, data);
}

export function buildAutoPostFormHtml(action: string, fields: Record<string, any>, title = 'Merchant Checkout Error') {
    const inputs = Object.keys(fields || {}).map((k) => {
        const v = fields[k] === undefined || fields[k] === null ? '' : String(fields[k]);
        return `<input type='hidden' name='${k}' value='${v}' >`;
    }).join('');

    return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><center><h1>Something went wrong. Please wait you will be redirected automatically...</h1></center><form method="post" action="${action}" name="f1">${inputs}</form><script type="text/javascript">document.f1.submit();</script></body></html>`;
}

export function sendAutoPostForm(req: Request, res: Response, action: string, fields: Record<string, any>) {
    if (wantsJson(req)) {
        // send dynamic content as JSON instead of embedding in an HTML form
        return res.status(res.statusCode || 200).json({ action, fields });
    }

    const html = buildAutoPostFormHtml(action, fields);
    return res.status(200).contentType('text/html').send(html);
}

export function buildProcessingPageHtml(innerHtml: string, loadingSVG = '', title = 'Merchant Checkout Page', headScripts = '', bodyScripts = ''): string {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${headScripts}</head><body><center><h1>Processing ! Please do not refresh this page...</h1><br>${innerHtml}<br><br>${loadingSVG}</center>${bodyScripts}</body></html>`;
}

export function renderProcessingPage(req: Request, res: Response, innerHtml: string, loadingSVG = '', headScripts = '', bodyScripts = '') {
    if (wantsJson(req)) {
        return res.json({ provider: 'processing', html: innerHtml, loadingSVG, headScripts, bodyScripts });
    }
    const html = buildProcessingPageHtml(innerHtml, loadingSVG, 'Merchant Checkout Page', headScripts, bodyScripts);
    return res.status(200).contentType('text/html').send(html);
}

export function renderPaytmJsCheckout(req: Request, res: Response, paytmJsToken: any, config: NPConfig) {
    if (wantsJson(req)) {
        // return the dynamic payload which would otherwise be embedded into the generated HTML
        return res.json({ provider: 'paytm', token: paytmJsToken });
    }

    const html = createPaytmJsCheckoutHtml(paytmJsToken, config);
    return res.send(html);
}

export function renderRazorpayCheckout(req: Request, res: Response, params: Record<string, any>, config: NPConfig, loadingSVG: string) {
    const options = {
        key: String(config.KEY),
        amount: Number(params['TXN_AMOUNT']) * 100,
        currency: 'INR',
        name: params['PRODUCT_NAME'],
        description: `Order # ${params['ORDER_ID']}`,
        image: config.theme?.logo || '',
        order_id: params['ORDER_ID'],
        callback_url: params['CALLBACK_URL'],
        prefill: {
            name: params['NAME'],
            email: params['EMAIL'],
            contact: params['MOBILE_NO']
        },
        theme: {
            color: config.theme?.accent || '#086cfe'
        }
    };

    if (wantsJson(req)) {
        return res.json({ provider: 'razorpay', options, failForm: { action: params['CALLBACK_URL'], fields: { razorpay_order_id: params['ORDER_ID'] } }, loadingSVG });
    }

    const fail = `<div style="display:none"><form method="post" action="${params['CALLBACK_URL']}" id="fail"><input name="razorpay_order_id" value="${params['ORDER_ID']}" hidden="true"/></form></div>`;

    const scriptOptions = `
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <script>
        var options = ${JSON.stringify(options, null, 4)};
        options.modal = options.modal || {};
        options.modal.ondismiss = function(){ document.getElementById('fail').submit(); };
        var rzp1 = new Razorpay(options);
        rzp1.open();
        </script>`;

    const html = `<!doctype html><html><head><title>Merchant Checkout Page</title></head><body><center><h1>Processing ! Please do not refresh this page...</h1><br>${scriptOptions}<br>${fail}<br>${loadingSVG}</center></body></html>`;

    return res.status(200).contentType('text/html').send(html);
}
