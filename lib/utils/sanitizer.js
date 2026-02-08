/**
 * Sanitizes request body by parsing amount fields to floats
 * @param {Object} body - Request body to sanitize
 * @returns {Object} Sanitized request body
 */
function sanitizeRequest(body) {
    if (!body || typeof body !== 'object') {
        return body;
    }

    // Parse amount to float if present
    if (body.amount) {
        body.amount = parseFloat(body.amount);
    }

    if (body.TXN_AMOUNT) {
        body.TXN_AMOUNT = parseFloat(body.TXN_AMOUNT);
    }

    return body;
}

module.exports = {
    sanitizeRequest
};
