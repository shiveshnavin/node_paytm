
export type Callback = (err?: any, res?: any) => void;

export interface NPUser {
    id: string;
    name: string;
    email: string;
    phone: string;
    createdAt?: number;
}

/**
 * NPTransaction is the interface for the transaction object stored in the database. It contains all the details of a transaction, including the order ID, customer ID, time of transaction, status, name, email, phone number, amount, product name, and any extra information.
 * time: in miliseconds
 * status: can be 'TXN_SUCCESS', 'TXN_FAILURE', 'PENDING', 'INITIATED'
 * extra: json can be used to store any extra information related to the transaction, such as the payment method used, the bank name, etc.
 */
export interface NPTransaction {
    id: string
    orderId: string,
    cusId: string,
    time: Number,
    status: string,
    name: string,
    email: string,
    phone: string,
    amount: Number,
    pname: string,
    extra: string
    readonly?: string,
    txnId?: string,
    clientId: string,
    returnUrl: string
    webhookUrl: string
}

export interface NPCallbacks {
    onStart: (orderId: string, paymentData?: NPTransaction) => void;
    onFinish: (orderId: string, paymentData?: NPTransaction) => void;
}

export type NPConfig = {
    KEY: string;
    SECRET: string;
    MID?: string;
    WEBSITE?: string;
    CHANNEL_ID?: string;
    INDUSTRY_TYPE_ID?: string;
    CALLBACK_URL?: string;

    paytm_url?: string;
    mode?: string; // Only used for paytm, pass JSON stringified array of enabled payment modes. Example: '["UPI","CARD"]'

    razor_url?: string;
    open_money_url?: string;
    payu_url?: string;

    templateDir?: string;
    view_path: string;
    theme_color?: string;
    brand?: string;
    logo?: string;
    host_url?: string;
    path_prefix: string;

    id_length?: number; // Length of the generated order ID and customer ID. Default is 10.

}

export type NPTableNames = {
    USER: string,
    TRANSACTION: string
}

export type NPParam = {
    ORDER_ID?: string,
    CUST_ID?: string,
    TXN_AMOUNT: string,
    CALLBACK_URL?: string,
    EMAIL?: string,
    MOBILE_NO?: string,
    NAME?: string,
    PRODUCT_NAME?: string,
    RETURN_URL?: string

    MID?: string,
    WEBSITE?: string,
    CHANNEL_ID?: string,
    INDUSTRY_TYPE_ID?: string,
    CURRENCY?: string

}