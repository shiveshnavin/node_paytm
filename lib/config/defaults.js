module.exports = {
    // Server configuration
    host_url: 'http://localhost:3000',
    path_prefix: '_pay',
    homepage: '/',

    // Template configuration
    templateDir: null, // null = use built-in views, or provide path to custom templates
    templateEngine: 'handlebars',

    // UI Customization
    theme_color: '#3399cc',
    logo: '/favicon.ico',

    // Transaction ID configuration
    id_length: 10,

    // Database
    db_url: null, // MongoDB URL (legacy), leave null to use multidborm

    // Payment Gateway URLs
    // paytm_url: null,        // e.g., 'https://securegw-stage.paytm.in' for test, 'https://securegw.paytm.in' for production
    // razor_url: null,        // e.g., 'https://api.razorpay.com/v1/'
    // payu_url: null,         // e.g., 'https://test.payu.in' for test, 'https://secure.payu.in' for production
    // open_money_url: null,   // e.g., 'https://sandbox-icp-api.bankopen.co/api' for sandbox, 'https://icp-api.bankopen.co/api' for live

    // Gateway Credentials (must be provided by user)
    // MID: null,
    // WEBSITE: null,
    // KEY: null,
    // SECRET: null,
    // CHANNEL_ID: 'WEB',
    // INDUSTRY_TYPE_ID: 'Retail',

    // Payment mode configuration (optional)
    // mode: null  // JSON string of enabled payment modes for Paytm
};
