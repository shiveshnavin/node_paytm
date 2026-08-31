
export type Callback = (err?: any, res?: any) => void;

export interface NPUser {
    id: string;
    name: string;
    email: string;
    phone: string;
    createdat?: number;
}

/**
 * NPTransaction is the interface for the transaction object stored in the database.
 */
export interface NPTransaction {
    id: string;
    orderid: string;
    cusid: string;
    time: number;
    timestamp?: number;
    status: string;
    name: string;
    email: string;
    phone: string;
    amount: number;
    pname: string;
    extra: string;
    state?: string;
    readonly?: string;
    txnid?: string;
    clientid: string;
    returnurl: string;
    webhookurl: string;
    issubscription?: boolean;
    subscriptionid?: string;
}

export interface NPPlan {
    id: string; // Provided by the client
    name: string;
    description?: string;
    amount: number;
    currency: string;
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
    planinterval: number;
    trialdays?: number;
    gatewayplanid?: string;
    clientid: string;
    isdeleted?: boolean;
    createdat?: number;
    updatedat?: number;
}

export interface NPSubscription {
    id: string; // Generated internally or provided by client
    planid: string; // References NPPlan.id
    cusid: string; // References NPUser.id
    status: string; // 'CREATED', 'AUTHENTICATED', 'ACTIVE', 'CANCELLED', 'HALTED', 'COMPLETED', 'EXPIRED'
    gatewaysubscriptionid?: string;
    shorturl?: string;
    clientid: string;
    returnurl?: string;
    webhookurl?: string;
    createdat?: number;
    updatedat?: number;
    expireby?: number;
    startat?: number;
    extra: string;
    state: string;
}

export interface NPCallbacks {
    onStart: (orderId: string, paymentData?: NPTransaction) => void;
    onFinish: (orderId: string, paymentData?: NPTransaction) => void;
}

export type NPConfigTheme = {
    logo: string,
    primary: string,
    accent: string,
    surface: string,
    text: string,
    success: string,
    danger: string,
    name: string,
    brand: string

}

export type NPConfig = {
    KEY: string;
    SECRET: string;
    MID?: string;
    WEBSITE?: string;
    CHANNEL_ID?: string;
    INDUSTRY_TYPE_ID?: string;
    CALLBACK_URL?: string;

    enableConfirmationPage?: boolean; // If true, user will be redirected to a confirmation page after payment, instead of directly redirecting to the returnUrl. Default is false.

    paytm_url?: string;
    mode?: string; // Only used for paytm, pass JSON stringified array of enabled payment modes. Example: '["UPI","CARD"]'

    razor_url?: string;
    open_money_url?: string;
    payu_url?: string;

    templateDir?: string;
    view_path: string;
    host_url?: string;
    path_prefix: string;

    id_length?: number; // Length of the generated order ID and customer ID. Default is 10.
    getClientConfig?: (clientId: string) => Partial<NPConfigOverrides>;

    theme?: NPConfigTheme

}

export type NPConfigOverrides = {
    theme?: NPConfigTheme
    paytm_url?: string;
    razor_url?: string;
    open_money_url?: string;
    payu_url?: string;

    KEY: string;
    SECRET: string;
    MID?: string;
    CALLBACK_URL?: string;

    host_url?: string;
    path_prefix: string;
}

export type NPTableNames = {
    USER: string,
    TRANSACTION: string,
    PLAN: string,
    SUBSCRIPTION: string,
    WEBHOOK?: string
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