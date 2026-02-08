const defaults = require('./defaults');
const { validateConfig } = require('./validator');

function pickEnv(keys) {
    const output = {};
    keys.forEach((key) => {
        if (process.env[key] !== undefined) {
            output[key] = process.env[key];
        }
    });
    return output;
}

function buildConfig(userConfig = {}) {
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
    ]);

    const merged = {
        ...defaults,
        ...normalizeEnv(envOverrides),
        ...userConfig,
    };

    // theme normalization
    const theme = {
        primary: getThemeColor(userConfig, merged),
        accent: userConfig?.theme?.accent || merged.theme_accent || '#4ae0ff',
        surface: userConfig?.theme?.surface || '#0f1021',
        text: userConfig?.theme?.text || '#e9ecf2',
        success: userConfig?.theme?.success || '#24cf5f',
        danger: userConfig?.theme?.danger || '#ff6b6b',
    };

    merged.theme = theme;
    merged.theme_color = theme.primary;
    merged.logo = userConfig.logo || merged.logo;
    merged.brand = userConfig.brand || 'Secure Pay';
    merged.callbacks = userConfig.callbacks || userConfig.hooks || merged.callbacks || {};
    merged.templateDir = userConfig.templateDir || merged.templateDir;

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

function getThemeColor(userConfig, merged) {
    if (userConfig?.theme?.primary) return userConfig.theme.primary;
    if (userConfig.theme_color) return userConfig.theme_color;
    if (merged.NP_THEME_COLOR) return merged.NP_THEME_COLOR;
    return merged.theme_color;
}

function normalizeEnv(env) {
    const mapping = {
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
    };
    return Object.keys(env).reduce((acc, key) => {
        const target = mapping[key];
        if (target) acc[target] = env[key];
        return acc;
    }, {});
}

module.exports = buildConfig;
