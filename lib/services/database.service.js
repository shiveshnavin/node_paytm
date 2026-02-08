/**
 * Database Service
 * Abstracts database operations to support both MongoDB (legacy) and MultiDB ORM
 */
class DatabaseService {
    constructor(db, config) {
        this.db = db;
        this.config = config;
        this.usingMultiDbOrm = this.detectDbType();

        // Will be initialized later
        this.Transaction = null;
        this.User = null;
    }

    /**
     * Detects whether we're using MultiDB ORM or MongoDB
     */
    detectDbType() {
        // Using MultiDB ORM if db instance provided and no db_url in config
        return !!this.db && !this.config.db_url;
    }

    /**
     * Initializes transaction model
     */
    initTransactionModel() {
        if (this.config.db_url) {
            // Legacy MongoDB mode
            this.Transaction = require('../models/transaction.model');
        } else if (this.db) {
            // MultiDB ORM mode
            const sample = {
                orderId: "string",
                cusId: "string",
                time: 1770051201752,
                timeStamp: 1770051201752,
                status: "string",
                name: "string",
                email: "string",
                phone: "string",
                amount: 1,
                pname: "string",
                extra: "stringlarge",
                TXNID: "27118670199",
                returnUrl: "string"
            };

            const multiDbPlugin = require('../models/np_multidbplugin');
            this.Transaction = multiDbPlugin('nptransactions', this.db, sample);
            this.Transaction.db = this.db;
            this.Transaction.modelname = 'nptransactions';
            this.Transaction.idFieldName = 'orderId';
        }

        return this.Transaction;
    }

    /**
     * Initializes user model
     */
    initUserModel() {
        if (this.config.db_url) {
            // Legacy MongoDB mode
            this.User = require('../models/user.model');
        } else if (this.db) {
            // MultiDB ORM mode
            const sample = {
                id: "string",
                name: "string",
                email: "string",
                phone: "string"
            };

            const multiDbPlugin = require('../models/np_multidbplugin');
            this.User = multiDbPlugin('npusers', this.db, sample);
            this.User.db = this.db;
            this.User.modelname = 'npusers';
            this.User.idFieldName = 'id';
        }

        return this.User;
    }

    /**
     * Finds one document
     * @param {Object} model - Mongoose model or MultiDB model
     * @param {Object} query - Query object
     * @param {Function} callback - Callback function (err, doc)
     */
    findOne(model, query, callback) {
        if (this.usingMultiDbOrm) {
            model.findOne(query, callback, model);
        } else {
            model.findOne(query, callback);
        }
    }

    /**
     * Creates  and saves a new document
     * @param {Object} modelClass - Model constructor
     * @param {Object} data - Data to save
     * @returns {Promise} Promise that resolves with saved document
     */
    create(modelClass, data) {
        const doc = new modelClass(data);
        return doc.save();
    }

    /**
     * Updates one document
     * @param {Object} model - Mongoose model or MultiDB model
     * @param {Object} query - Query object
     * @param {Object} update - Update object
     * @param {Function} callback - Callback function (err, result)
     */
    updateOne(model, query, update, callback) {
        if (this.usingMultiDbOrm) {
            model.updateOne(query, update, callback);
        } else {
            model.updateOne(query, update, callback);
        }
    }

    /**
     * Gets the Transaction model
     */
    getTransactionModel() {
        if (!this.Transaction) {
            this.initTransactionModel();
        }
        return this.Transaction;
    }

    /**
     * Gets the User model
     */
    getUserModel() {
        if (!this.User) {
            this.initUserModel();
        }
        return this.User;
    }

    /**
     * Returns whether using MultiDB ORM
     */
    isUsingMultiDbOrm() {
        return this.usingMultiDbOrm;
    }
}

module.exports = DatabaseService;
