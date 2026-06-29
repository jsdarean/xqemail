/**
 * Chrome 扩展本地加密工具
 * 使用 Web Crypto API (AES-256-GCM) 对敏感配置进行加密后再存入 chrome.storage.local。
 * 密钥从一个固定口令 + 随机盐派生，盐也保存在本地存储中。
 */

const PEPPER = 'WorkBuddyReqEmailExtractor_v2'; // 固定口令片段
const SALT_KEY = '_wb_crypto_salt_';
const ENC_PREFIX = 'enc:';

/**
 * 将字符串转换为 ArrayBuffer
 */
function strToBuf(str) {
  return new TextEncoder().encode(str);
}

/**
 * 将 ArrayBuffer 转换为 Base64
 */
function bufToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 将 Base64 转换为 ArrayBuffer
 */
function base64ToBuf(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 获取或创建盐
 */
async function getOrCreateSalt() {
  const { [SALT_KEY]: storedSalt } = await chrome.storage.local.get(SALT_KEY);
  if (storedSalt) return storedSalt;

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltBase64 = bufToBase64(salt);
  await chrome.storage.local.set({ [SALT_KEY]: saltBase64 });
  return saltBase64;
}

/**
 * 派生 AES-GCM 密钥
 */
async function deriveKey(saltBase64) {
  const salt = base64ToBuf(saltBase64);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    strToBuf(PEPPER),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密明文，返回 'enc:<base64(iv):base64(ciphertext)' 格式字符串
 */
async function encrypt(plaintext) {
  if (!plaintext) return '';
  const salt = await getOrCreateSalt();
  const key = await deriveKey(salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    strToBuf(plaintext)
  );
  return `${ENC_PREFIX}${bufToBase64(iv)}:${bufToBase64(ciphertext)}`;
}

/**
 * 解密 encrypt 生成的字符串；如果不是加密格式则原样返回
 */
async function decrypt(cipherText) {
  if (!cipherText) return '';
  if (typeof cipherText !== 'string' || !cipherText.startsWith(ENC_PREFIX)) {
    return cipherText;
  }
  const payload = cipherText.slice(ENC_PREFIX.length);
  const [ivBase64, cipherBase64] = payload.split(':');
  if (!ivBase64 || !cipherBase64) return '';

  const salt = await getOrCreateSalt();
  const key = await deriveKey(salt);
  const iv = base64ToBuf(ivBase64);
  const ciphertext = base64ToBuf(cipherBase64);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('[Crypto] 解密失败:', e);
    return '';
  }
}

/**
 * 加密对象中的指定字段
 */
async function encryptFields(obj, fields) {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field]) {
      result[field] = await encrypt(result[field]);
    }
  }
  return result;
}

/**
 * 解密对象中的指定字段
 */
async function decryptFields(obj, fields) {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field]) {
      result[field] = await decrypt(result[field]);
    }
  }
  return result;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { encrypt, decrypt, encryptFields, decryptFields };
}
