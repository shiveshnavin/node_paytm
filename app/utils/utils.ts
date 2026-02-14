import { NPTransaction } from "../models";

const IDLEN = 10;

export class Utils {
    static makeid(length: number = IDLEN): string {
        let text = "";
        const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (let i = 0; i < length; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    }

    static sanitizeRequest(body: NPTransaction | any) {
        if (body.amount)
            body.amount = parseFloat(body.amount);
        if (body.TXN_AMOUNT)
            body.amount = parseFloat(body.TXN_AMOUNT);
    }
}