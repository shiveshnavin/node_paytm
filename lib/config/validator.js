const defaults = require('./defaults');

/**
 * Validates and merges config with defaults
 * @param {Object} userConfig - User-provided configuration
 * @returns {Object} Merged and validated configuration
 * @throws {Error} If required fields are missing
 */
function validateConfig(userConfig) {
    if (!userConfig || typeof userConfig !== 'object') {
        throw new Error('Config must be an object');
    }

    // Merge with defaults
    const config = { ...defaults, ...userConfig };

    // Detect which payment gateway is being used
    const hasPaytm = !!config.paytm_url;
    const hasRazorpay = !!config.razor_url;
    const hasPayU = !!config.payu_url;
    const hasOpenMoney = !!config.open_money_url;

    if (!hasPaytm && !hasRazorpay && !hasPayU && !hasOpenMoney) {
        throw new Error(
            'At least one payment gateway must be configured. ' +
            'Please provide one of: paytm_url, razor_url, payu_url, or open_money_url'
        );
    }

    // Validate required credentials based on gateway
    if (hasPaytm) {
        validatePaytmConfig(config);
    }

    if (hasRazorpay) {
        validateRazorpayConfig(config);
    }

    if (hasPayU) {
        validatePayUConfig(config);
    }

    if (hasOpenMoney) {
        validateOpenMoneyConfig(config);
    }

    // Validate common fields
    if (!config.host_url) {
        throw new Error('host_url is required');
    }

    if (!config.path_prefix) {
        throw new Error('path_prefix is required');
    }

    return config;
}

function validatePaytmConfig(config) {
    const required = ['MID', 'WEBSITE', 'KEY', 'CHANNEL_ID', 'INDUSTRY_TYPE_ID'];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
        throw new Error(
            `Paytm configuration incomplete. Missing fields: ${missing.join(', ')}`
        );
    }
}

function validateRazorpayConfig(config) {
    const required = ['KEY', 'SECRET'];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
        throw new Error(
            `Razorpay configuration incomplete. Missing fields: ${missing.join(', ')}`
        );
    }
}

function validatePayUConfig(config) {
    const required = ['KEY', 'SECRET'];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
        throw new Error(
            `PayU configuration incomplete. Missing fields: ${missing.join(', ')}`
        );
    }
}

function validateOpenMoneyConfig(config) {
    const required = ['KEY', 'SECRET'];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
        throw new Error(
            `OpenMoney configuration incomplete. Missing fields: ${missing.join(', ')}`
        );
    }
}

module.exports = { validateConfig };
