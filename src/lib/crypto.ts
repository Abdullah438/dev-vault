import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard IV length for AES-GCM

function getMasterKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_MASTER_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_MASTER_KEY is not defined in environment variables');
  }
  if (keyHex.length !== 64) {
    throw new Error('ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

export interface EncryptedData {
  encryptedText: string;
  ivHex: string;
  authTagHex: string;
}

/**
 * Encrypts plaintext using AES-256-GCM
 */
export function encrypt(text: string): EncryptedData {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    encryptedText: encrypted,
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
  };
}

/**
 * Decrypts ciphertext using AES-256-GCM
 */
export function decrypt(encryptedText: string, ivHex: string, authTagHex: string): string {
  const masterKey = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generates a secure, random API key string prefixed with 'sec_'
 */
export function generateSecretValue(length: number = 32): string {
  const bytes = crypto.randomBytes(length);
  // Using base64url encoding to ensure it is safe for URLs and headers
  return 'sec_' + bytes.toString('base64url').substring(0, length);
}
