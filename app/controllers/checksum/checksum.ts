import * as crypto from 'crypto';
import util from 'util';
import * as crypt from './crypt';
import PaytmChecksum from './PaytmChecksum';

// Note: some code referenced a `mandatoryParams` variable in the original JS. If your app
// defines it globally, this will pick it up; otherwise default to empty array.
const mandatoryParams: string[] = (global as any).mandatoryParams || [];

function paramsToString(params: Record<string, any>, mandatoryflag?: boolean): string {
    let data = '';
    const tempKeys = Object.keys(params);
    tempKeys.sort();
    tempKeys.forEach(function (key) {
        if (!params[key]) {
            return;
        }
        try {
            const n = String(params[key]).includes('REFUND');
            const m = String(params[key]).includes('|');
            if (n === true) {
                params[key] = '';
            }
            if (m === true) {
                params[key] = '';
            }
        } catch (e) {
            params[key] = '';
            console.log(e);
        }


        if (key !== 'CHECKSUMHASH') {
            if (params[key] === 'null') params[key] = '';
            if (!mandatoryflag || mandatoryParams.indexOf(key) !== -1) {
                data += (params[key] + '|');
            }
        }
    });
    return data;
}

export function genchecksum(params: Record<string, any>, key: string, cb: (err: any, checksum?: string) => void) {
    const checksumPromise = PaytmChecksum.generateSignature(params, key).then(checksum => {
        cb(undefined, checksum);
    }).catch(err => cb(err));
    return checksumPromise;
}

export function genchecksumbystring(params: string, key: string, cb: (err: any, checksum?: string) => void) {
    crypt.gen_salt(4).then(salt => {
        const sha256 = crypto.createHash('sha256').update(params + '|' + salt).digest('hex');
        const check_sum = sha256 + salt;
        const encrypted = crypt.encrypt(check_sum, key);
        const CHECKSUMHASH = encrypted;
        cb(undefined, CHECKSUMHASH);
    }).catch(err => cb(err));
}

export function verifychecksum(params: Record<string, any>, key: string, checksumhash?: string) {
    return PaytmChecksum.verifySignature(params, key, checksumhash as string);
}

export function verifychecksumbystring(params: string, key: string, checksumhash: string) {
    const checksum = crypt.decrypt(checksumhash, key);
    const salt = checksum.substr(checksum.length - 4);
    const sha256 = checksum.substr(0, checksum.length - 4);
    const hash = crypto.createHash('sha256').update(params + '|' + salt).digest('hex');
    if (hash === sha256) {
        return true;
    } else {
        console.log('checksum is wrong');
        return false;
    }
}

export function genchecksumforrefund(params: Record<string, any>, key: string, cb: (err: any, result?: any) => void) {
    const data = paramsToStringrefund(params);
    crypt.gen_salt(4).then(salt => {
        const sha256 = crypto.createHash('sha256').update(data + salt).digest('hex');
        const check_sum = sha256 + salt;
        const encrypted = crypt.encrypt(check_sum, key);
        params.CHECKSUM = encodeURIComponent(encrypted);
        cb(undefined, params);
    }).catch(err => cb(err));
}

function paramsToStringrefund(params: Record<string, any>, mandatoryflag?: boolean): string {
    let data = '';
    const tempKeys = Object.keys(params);
    tempKeys.sort();
    tempKeys.forEach(function (key) {
        const m = String(params[key]).includes('|');
        if (m == true) {
            params[key] = '';
        }
        if (key !== 'CHECKSUMHASH') {
            if (params[key] === 'null') params[key] = '';
            if (!mandatoryflag || mandatoryParams.indexOf(key) !== -1) {
                data += (params[key] + '|');
            }
        }
    });
    return data;
}

export function checkRazorSignature(razorpayOrderId: string, razorpayPaymentId: string, secret: string, razorpay_signature: string) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpayOrderId + '|' + razorpayPaymentId);
    const generatedSignature = hmac.digest('hex');
    const isSignatureValid = generatedSignature == razorpay_signature;
    return isSignatureValid;
}

// CommonJS compatibility
export default {
    genchecksum,
    verifychecksum,
    verifychecksumbystring,
    genchecksumbystring,
    genchecksumforrefund,
    checkRazorSignature,
};
