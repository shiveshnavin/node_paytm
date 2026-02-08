/**
 * Generates a random alphanumeric ID
 * @param {number} length - Length of the ID to generate
 * @returns {string} Random ID
 */
function generateId(length = 10) {
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let text = "";

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}

/**
 * Generates an order ID with a prefix
 * @param {string} prefix - Prefix for the order ID (e.g., 'pay_', 'payu_')
 * @param {number} length - Length of the random part
 * @returns {string} Order ID
 */
function generateOrderId(prefix = '', length = 10) {
    return prefix + generateId(length);
}

module.exports = {
    generateId,
    generateOrderId
};
