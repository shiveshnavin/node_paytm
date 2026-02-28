import { Request } from "express";
import { NPConfig, NPTransaction } from "../models";

const defaults: Record<string, any> = {
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

function pickEnv(keys: any) {
    const output: Record<string, string> = {};
    keys.forEach((key: string) => {
        if (process.env[key] !== undefined) {
            output[key] = process.env[key]!;
        }
    });
    return output;
}


/**
 * Validates and merges config with defaults
 * @param {Object} userConfig - User-provided configuration
 * @returns {Object} Merged and validated configuration
 * @throws {Error} If required fields are missing
 */
function validateConfig(userConfig: Record<string, any>): NPConfig {
    if (!userConfig || typeof userConfig !== 'object') {
        throw new Error('Config must be an object');
    }

    // Merge with defaults
    const config: Record<string, any> = { ...defaults, ...userConfig };

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

    return config as NPConfig;
}

function validatePaytmConfig(config: Record<string, any>) {
    const required = ['MID', 'WEBSITE', 'KEY', 'CHANNEL_ID', 'INDUSTRY_TYPE_ID'];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
        throw new Error(
            `Paytm configuration incomplete. Missing fields: ${missing.join(', ')}`
        );
    }
}

function validateRazorpayConfig(config: Record<string, any>) {
    const required = ['KEY', 'SECRET'];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
        throw new Error(
            `Razorpay configuration incomplete. Missing fields: ${missing.join(', ')}`
        );
    }
}

function validatePayUConfig(config: Record<string, any>) {
    const required = ['KEY', 'SECRET'];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
        throw new Error(
            `PayU configuration incomplete. Missing fields: ${missing.join(', ')}`
        );
    }
}

function validateOpenMoneyConfig(config: Record<string, any>) {
    const required = ['KEY', 'SECRET'];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
        throw new Error(
            `OpenMoney configuration incomplete. Missing fields: ${missing.join(', ')}`
        );
    }
}

export function withClientConfigOverrides(config: NPConfig, req: Request, orderData?: NPTransaction): NPConfig {
    let _client = config;
    if (config.getClientConfig && (req || orderData?.clientId)) {
        const clientId = orderData?.clientId || req.headers['x-client-id'] as string || req.query.client_id as string || req.body.client_id as string || req.body.CLIENT_ID as string || req.query.CLIENT_ID as string;
        if (clientId) {
            const clientConfig = config.getClientConfig(clientId);
            if (clientConfig) {
                _client = { ...config, ...clientConfig };
            }
        }
    }
    return _client;
}


export function buildConfig(userConfig: Record<string, any> = {}) {
    const envOverrides = pickEnv([
        'NP_HOST_URL',
        'NP_PATH_PREFIX',
        'NP_HOMEPAGE',
        'NP_TEMPLATE_DIR',
        'NP_THEME_COLOR',
        'NP_LOGO',
        'NP_DB_URL',
        'NP_PAYTM_URL',
        'NP_RAZOR_URL',
        'NP_PAYU_URL',
        'NP_OPEN_MONEY_URL',
        'NP_MID',
        'NP_WEBSITE',
        'NP_KEY',
        'NP_SECRET',
        'NP_CHANNEL_ID',
        'NP_INDUSTRY_TYPE_ID',
        'NP_MODE',
        'NP_THEME_NAME',
    ]);

    const merged: Record<string, any> = {
        ...defaults,
        ...normalizeEnv(envOverrides),
        ...userConfig,
    };

    // theme normalization
    const themeName = (userConfig.themeName || userConfig.theme?.name || merged.theme_name || 'dark').toLowerCase();
    const theme = {
        primary: getThemeColor(userConfig, merged),
        accent: userConfig?.theme?.accent || merged.theme_accent || '#4ae0ff',
        surface: userConfig?.theme?.surface || '#0f1021',
        text: userConfig?.theme?.text || '#e9ecf2',
        success: userConfig?.theme?.success || '#24cf5f',
        danger: userConfig?.theme?.danger || '#ff6b6b',
        name: themeName,
    };

    merged.theme = theme;
    merged.theme_color = theme.primary;
    merged.logo = userConfig.logo || merged.logo;
    merged.brand = userConfig.brand || 'Secure Pay';
    merged.callbacks = userConfig.callbacks || userConfig.hooks || merged.callbacks || {};
    merged.templateDir = userConfig.templateDir || merged.templateDir;
    merged.themeName = themeName;

    // ensure view path remains compatible with legacy controllers
    if (!merged.view_path) {
        merged.view_path = '/../views/';
    }

    if (userConfig.host_url) {
        merged.host_url = userConfig.host_url;
    } else if (process.env.NP_HOST_URL) {
        merged.host_url = process.env.NP_HOST_URL;
    }

    return validateConfig(merged);
}

function getThemeColor(userConfig: Record<string, any>, merged: Record<string, any>) {
    if (userConfig?.theme?.primary) return userConfig.theme.primary;
    if (userConfig.theme_color) return userConfig.theme_color;
    if (merged.NP_THEME_COLOR) return merged.NP_THEME_COLOR;
    return merged.theme_color;
}

function normalizeEnv(env: Record<string, string>) {
    const mapping: Record<string, string> = {
        NP_HOST_URL: 'host_url',
        NP_PATH_PREFIX: 'path_prefix',
        NP_HOMEPAGE: 'homepage',
        NP_TEMPLATE_DIR: 'templateDir',
        NP_THEME_COLOR: 'theme_color',
        NP_LOGO: 'logo',
        NP_DB_URL: 'db_url',
        NP_PAYTM_URL: 'paytm_url',
        NP_RAZOR_URL: 'razor_url',
        NP_PAYU_URL: 'payu_url',
        NP_OPEN_MONEY_URL: 'open_money_url',
        NP_MID: 'MID',
        NP_WEBSITE: 'WEBSITE',
        NP_KEY: 'KEY',
        NP_SECRET: 'SECRET',
        NP_CHANNEL_ID: 'CHANNEL_ID',
        NP_INDUSTRY_TYPE_ID: 'INDUSTRY_TYPE_ID',
        NP_MODE: 'mode',
        NP_THEME_NAME: 'themeName',
    };
    return Object.keys(env).reduce((acc: Record<string, string>, key: any) => {
        const target = mapping[key];
        if (target) acc[target] = env[key];
        return acc;
    }, {} as Record<string, string>);
}

