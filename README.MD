## node-paytmpg

Express middleware for integrating Paytm / Razorpay / PayU / Open Money payments with built-in checkout pages and APIs.

## Install

```bash
npm install node-paytmpg multi-db-orm
```

## Quick start (current API)

```js
const express = require("express");
const { FireStoreDB } = require("multi-db-orm");
const {
  attachRawBodyAndEngine,
  createPaymentMiddleware,
} = require("node-paytmpg");

const app = express();
const db = new FireStoreDB(require("./creds.json"));

const config = {
  host_url: "http://127.0.0.1:5544",
  path_prefix: "pay",
  homepage: "/",

  // enable one gateway
  payu_url: "https://test.payu.in/_payment",
  // paytm_url: 'https://securegw-stage.paytm.in',
  // razor_url: 'https://api.razorpay.com/',
  // open_money_url: 'https://sandbox-icp-api.bankopen.co/api',

  MID: "YOUR_MID",
  WEBSITE: "WEBSTAGING",
  KEY: "YOUR_KEY",
  SECRET: "YOUR_SECRET",
  CHANNEL_ID: "WAP",
  INDUSTRY_TYPE_ID: "Retail",
};

// Make sure to call this before adding any other body parsers
// this preserves the original body in req.rawBody so it can be used to verify
// signatures in webhooks especially for razorpay
attachRawBodyAndEngine(app, config);

const paymentRouter = createPaymentMiddleware(app, config, db);
app.use("/" + config.path_prefix, paymentRouter);

app.listen(5544, () => {
  console.log("Server started on 5544");
});
```

## `attachRawBodyAndEngine(app, config)`

> ⚠️ Caution — avoid calling this helper directly in production apps.

Use this only if your application does **not** already configure body parsing or a view engine. In most cases you should **not** call this helper; prefer one of the alternatives below.

What it does:

- Adds JSON and URL-encoded body parsing and captures `req.rawBody` (required for some gateway webhook verifications).
- Configures Handlebars (`hbs`) view engine and a default layout used by the payment pages.
- Sets `app.set('attachRawBodyAndEngine', true)` so the middleware knows the setup is present.

When _not_ to use it:

- Do **not** call this if your app already defines body-parsing middleware or a view engine — it will override or duplicate global settings and can cause conflicts.
- Instead, either let `createPaymentMiddleware` auto-attach the required parsers/engine (it logs a warning if missing) or manually ensure `req.rawBody` and a compatible view engine are configured.
- If you must call it, call it once at app startup and do not call it from sub-apps or multiple times.

If you skip this call, `createPaymentMiddleware` auto-attaches a default parser/engine and logs a warning. For custom body-parser setups, make sure raw request body is still available as `req.rawBody`.

## How to invoke `createPaymentMiddleware`

Signature:

```ts
createPaymentMiddleware(
  app,
  userConfig,
  db,
  callbacks?,
  authenticationMiddleware?,
  tableNames?
)
```

Required params:

- `app`: your Express app instance.
- `userConfig`: payment config.
- `db`: `multi-db-orm` database instance.

Optional params:

- `callbacks`: `{ onStart(orderId, txn), onFinish(orderId, txn) }`.
- `authenticationMiddleware`: middleware to protect all payment routes.
- `tableNames`: override default table/collection names.

Mounting:

- Router paths are relative (`/init`, `/callback`, `/api/createTxn`, etc.).
- Mount with `app.use('/' + config.path_prefix, router)`.
- Keep mount path aligned with `config.path_prefix` so generated `payurl` is correct.

## Request fields: `RETURN_URL` and `WEBHOOK_URL`

`RETURN_URL` and `WEBHOOK_URL` are optional fields accepted in payment-init/create APIs and stored per transaction.

### `RETURN_URL`

If provided:

- User is redirected to this URL after payment update instead of only rendering library result page.
- Query params are appended by the middleware:
  - `status` (for example `TXN_SUCCESS`, `TXN_FAILURE`, `FAILED`)
  - `ORDERID`
  - `TXNID` (when available)
  - `message` in some failure cases

Examples:

- `https://your-app.com/payment/return?status=TXN_SUCCESS&ORDERID=...&TXNID=...`
- If URL already has query string, middleware appends with `&`.

### `WEBHOOK_URL`

If provided:

- Middleware posts transaction result payload to this URL on status update.
- Also used for some error states (for example, transaction not found).

Typical payload includes transaction/order fields (`orderId`, `txnId`, `status`, etc.) depending on update stage.

## Create transaction API

Endpoint:

```http
POST /{path_prefix}/api/createTxn
```

Required body fields:

- `NAME`
- `EMAIL`
- `MOBILE_NO`
- `TXN_AMOUNT`
- `PRODUCT_NAME`

Optional body fields:

- `RETURN_URL`
- `WEBHOOK_URL`
- `EXTRA`

Response includes generated transaction info and `payurl`:

```json
{
  "orderId": "...",
  "status": "INITIATED",
  "payurl": "http://host/{path_prefix}/init?to=..."
}
```

## Core routes

All routes below are mounted under `/{path_prefix}`:

- `GET|POST /init`
- `GET|POST /callback`
- `GET|POST /api/webhook`
- `GET|POST /api/status`
- `GET|POST /api/transactions`
- `GET|POST /api/createTxn`
- `GET|POST /api/createTxn/token`

## Config summary

Common:

- `host_url`
- `path_prefix`
- `KEY`, `SECRET`

Gateway-specific:

- Paytm: `paytm_url`, `MID`, `WEBSITE`, `CHANNEL_ID`, `INDUSTRY_TYPE_ID`
  - Sandbox: https://securegw-stage.paytm.in
  - Prod: https://securegw.paytm.in
- Razorpay: `razor_url`, `KEY`, `SECRET`
  - Sandbox: https://api.razorpay.com/
  - Prod: https://api.razorpay.com/
- PayU: `payu_url`, `KEY`, `SECRET`
  - Sandbox: https://test.payu.in/_payment
  - Prod: https://secure.payu.in/_payment
- Open Money: `open_money_url`, `KEY`, `SECRET`
  - Sandbox: https://sandbox-icp-api.bankopen.co/api
  - Prod: https://icp-api.bankopen.co/api

UI / behavior:

- `brand`, `logo`, `theme`, `themeName`, `templateDir`, `id_length`

## Notes

- Configure at least one gateway URL: `paytm_url`, `razor_url`, `payu_url`, or `open_money_url`.
- `host_url` + `path_prefix` are used to build checkout links.
- This package is designed for Express apps.

## License

MIT
