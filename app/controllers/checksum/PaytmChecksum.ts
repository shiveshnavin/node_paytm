import * as crypto from 'crypto';

export default class PaytmChecksum {

    static iv = '@@@@&&&&####$$$$';

    static encrypt(input: string, key: string): string {
        const cipher = crypto.createCipheriv('AES-128-CBC', key, PaytmChecksum.iv);
        let encrypted = cipher.update(input, 'binary', 'base64');
        encrypted += cipher.final('base64');
        return encrypted;
    }

    static decrypt(encrypted: string, key: string): string {
        const decipher = crypto.createDecipheriv('AES-128-CBC', key, PaytmChecksum.iv);
        let decrypted = decipher.update(encrypted, 'base64', 'binary');
        try {
            decrypted += decipher.final('binary');
        } catch (e) {
            console.log(e);
        }
        return decrypted;
    }

    static generateSignature(params: Record<string, any> | string, key: string): Promise<string> | Promise<never> {
        if (typeof params !== 'object' && typeof params !== 'string') {
            const error = 'string or object expected, ' + (typeof params) + ' given.';
            return Promise.reject(error);
        }
        if (typeof params !== 'string') {
            params = PaytmChecksum.getStringByParams(params as Record<string, any>);
        }
        return PaytmChecksum.generateSignatureByString(params as string, key);
    }

    static verifySignature(params: Record<string, any> | string, key: string, checksum: string): boolean | Promise<never> {
        if (typeof params !== 'object' && typeof params !== 'string') {
            const error = 'string or object expected, ' + (typeof params) + ' given.';
            return Promise.reject(error);
        }
        if (typeof params !== 'string') {
            if ((params as Record<string, any>).hasOwnProperty('CHECKSUMHASH')) {
                delete (params as Record<string, any>).CHECKSUMHASH;
            }
            params = PaytmChecksum.getStringByParams(params as Record<string, any>);
        }
        return PaytmChecksum.verifySignatureByString(params as string, key, checksum);
    }

    static async generateSignatureByString(params: string, key: string): Promise<string> {
        const salt = await PaytmChecksum.generateRandomString(4);
        return PaytmChecksum.calculateChecksum(params, key, salt);
    }

    static verifySignatureByString(params: string, key: string, checksum: string): boolean {
        const paytm_hash = PaytmChecksum.decrypt(checksum, key);
        const salt = paytm_hash.substr(paytm_hash.length - 4);
        return (paytm_hash === PaytmChecksum.calculateHash(params, salt));
    }

    static generateRandomString(length: number): Promise<string> {
        return new Promise(function (resolve, reject) {
            crypto.randomBytes((length * 3.0) / 4.0, function (err, buf) {
                if (!err) {
                    const salt = buf.toString('base64');
                    resolve(salt);
                } else {
                    console.log('error occurred in generateRandomString: ' + err);
                    reject(err);
                }
            });
        });
    }

    static getStringByParams(params: Record<string, any>): string {
        const data: Record<string, any> = {};
        Object.keys(params).sort().forEach(function (key) {
            data[key] = (params[key] !== null && String(params[key]).toLowerCase() !== 'null') ? params[key] : '';
        });
        return Object.values(data).join('|');
    }

    static calculateHash(params: string, salt: string): string {
        const finalString = params + '|' + salt;
        return crypto.createHash('sha256').update(finalString).digest('hex') + salt;
    }

    static calculateChecksum(params: string, key: string, salt: string): string {
        const hashString = PaytmChecksum.calculateHash(params, salt);
        return PaytmChecksum.encrypt(hashString, key);
    }
}
