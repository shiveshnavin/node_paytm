import * as crypto from 'crypto';
import util from 'util';

export const iv = '@@@@&&&&####$$$$';

export function encrypt(data: string, custom_key: string): string {
    const key = custom_key;
    let algo = '256';
    switch (key.length) {
        case 16:
            algo = '128';
            break;
        case 24:
            algo = '192';
            break;
        case 32:
            algo = '256';
            break;
    }
    const cipher = crypto.createCipheriv('AES-' + algo + '-CBC', key, iv);
    let encrypted = cipher.update(data, 'binary', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}

export function decrypt(data: string, custom_key: string): string {
    const key = custom_key;
    let algo = '256';
    switch (key.length) {
        case 16:
            algo = '128';
            break;
        case 24:
            algo = '192';
            break;
        case 32:
            algo = '256';
            break;
    }
    const decipher = crypto.createDecipheriv('AES-' + algo + '-CBC', key, iv);
    let decrypted = decipher.update(data, 'base64', 'binary');
    try {
        decrypted += decipher.final('binary');
    } catch (e) {
        console.log(util.inspect(e));
    }
    return decrypted;
}

export function gen_salt(length: number): Promise<string> {
    return new Promise((resolve, reject) => {
        crypto.randomBytes((length * 3.0) / 4.0, function (err, buf) {
            if (!err) {
                resolve(buf.toString('base64'));
            } else {
                reject(err);
            }
        });
    });
}

export function md5sum(salt: string, data: string): string {
    return crypto.createHash('md5').update(salt + data).digest('hex');
}

export function sha256sum(salt: string, data: string): string {
    return crypto.createHash('sha256').update(data + salt).digest('hex');
}

// CommonJS compatibility
export default {
    iv,
    encrypt,
    decrypt,
    gen_salt,
    md5sum,
    sha256sum,
};
