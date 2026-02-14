import { NPConfig, NPParam } from "../../models";
import { LoadingSVG } from "../static/loadingsvg";

export function createPaytmJsCheckoutHtml(params: NPParam, config: NPConfig) {

    let paytmJsCheckouHtml = `<html>
                <head>
                <title>Merchant Checkout</title>
                <meta name="viewport" content="width=device-width, height=device-height, initial-scale=1.0, maximum-scale=1.0"/>
                
                </head>
                <body>
                <center>
                <h1>Please donot close this page or press the back button. Processing...</h1>
               ${LoadingSVG}
                </center>
                <form id="cancelform" action="${params['CALLBACK_URL']}" method="post">
                    <input type="hidden" name="TXNID" value="na"/>
                    <input type="hidden" name="STATUS" value="TXN_FAILURE"/>
                    <input type="hidden" name="CANCELLED" value="cancelled"/>
                    <input id="RESPMSG" type="hidden" name="RESPMSG" value=""/>
                    <input type="hidden" name="ORDERID" value="${params["ORDER_ID"]}"/>
                </form>
                
                <script>
                // (omitted for brevity in patch) script will use token from server
                </script>
                <script type="application/javascript" crossorigin="anonymous" src="${config.paytm_url}/merchantpgpui/checkoutjs/merchants/${params['MID']}.js" onload="onScriptLoad();" crossorigin="anonymous"></script>


                </body>
                </html>`;

    return paytmJsCheckouHtml
}