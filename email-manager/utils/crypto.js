/**
 * 配置加密工具
 * 使用 AES-256-GCM 加密敏感字段
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

function getKey(password, salt) {
    return crypto.scryptSync(password, salt, KEY_LENGTH);
}

function isEncrypted(value) {
    return value && typeof value === 'object' && value.__encrypted === true;
}

function encrypt(plaintext, password) {
    if (!plaintext) return '';
    if (!password) {
        throw new Error('未配置 CONFIG_ENCRYPTION_KEY，无法加密');
    }

    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getKey(password, salt);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
        __encrypted: true,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        authTag: authTag.toString('hex'),
        data: encrypted
    };
}

function decrypt(encryptedObj, password) {
    if (!encryptedObj) return '';
    if (!isEncrypted(encryptedObj)) {
        // 兼容明文，直接返回
        return String(encryptedObj);
    }
    if (!password) {
        throw new Error('未配置 CONFIG_ENCRYPTION_KEY，无法解密');
    }

    const salt = Buffer.from(encryptedObj.salt, 'hex');
    const iv = Buffer.from(encryptedObj.iv, 'hex');
    const authTag = Buffer.from(encryptedObj.authTag, 'hex');
    const key = getKey(password, salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function encryptEmailConfig(config, password) {
    if (!config) return config;
    const cloned = JSON.parse(JSON.stringify(config));
    if (cloned.smtp && cloned.smtp.pass) {
        cloned.smtp.pass = encrypt(cloned.smtp.pass, password);
    }
    return cloned;
}

function decryptEmailConfig(config, password) {
    if (!config) return config;
    const cloned = JSON.parse(JSON.stringify(config));
    if (cloned.smtp && cloned.smtp.pass) {
        cloned.smtp.pass = decrypt(cloned.smtp.pass, password);
    }
    return cloned;
}

module.exports = {
    encrypt,
    decrypt,
    isEncrypted,
    encryptEmailConfig,
    decryptEmailConfig
};
