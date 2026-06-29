/**
 * DevVault Client-Side Zero-Knowledge Cryptography Library
 * Uses native Web Crypto API (supported by all modern browsers).
 */

// Helper: Convert ArrayBuffer to Hex String
export function bufToHex(buffer: ArrayBuffer | Uint8Array): string {
  const array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Convert Hex String to Uint8Array
export function hexToBuf(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array(0);
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

/**
 * Derives a stable, cryptographically secure 256-bit salt from the stable User UUID.
 * Using the user's UUID ensures the derived salt is consistent across browser sessions
 * and devices for that specific user, without storing salt values in the DB.
 */
export async function deriveSaltFromUserId(userId: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(userId);
  return await window.crypto.subtle.digest('SHA-256', data);
}

/**
 * Derives a 256-bit AES-GCM key from a Master Passphrase and a unique salt.
 * Uses PBKDF2 with 100,000 iterations of SHA-256.
 */
export async function deriveMasterKey(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * The Web Crypto API automatically appends the 16-byte authentication tag
 * to the end of the ciphertext buffer, so a separate auth_tag field is not needed.
 */
export async function encryptClient(text: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12-byte IV for GCM
  
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(text)
  );

  return {
    ciphertext: bufToHex(ciphertextBuffer),
    iv: bufToHex(iv),
  };
}

/**
 * Decrypts ciphertext using AES-256-GCM and the derived key.
 */
export async function decryptClient(ciphertextHex: string, ivHex: string, key: CryptoKey): Promise<string> {
  const decoder = new TextDecoder();
  const ciphertext = hexToBuf(ciphertextHex);
  const iv = hexToBuf(ivHex);
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    ciphertext as any
  );
  
  return decoder.decode(decryptedBuffer);
}

/**
 * Generates a secure, random client-side API key (with optional prefix).
 * Uses 32 bytes of entropy encoded as base64url.
 */
export function generateClientSecretValue(length: number = 32, prefix: string = 'sec_'): string {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);

  const base64url = bytesToBase64Url(bytes);
  return prefix + base64url;
}

/** 48 bytes (384-bit) entropy — suitable for JWT signing, HMAC, webhook secrets. */
const AUTH_SECRET_BYTES = 48;

/**
 * Generates a high-entropy auth secret (384-bit random, full base64url payload).
 * No prefix — raw secret only, suitable for JWT signing, HMAC, webhook secrets.
 */
export function generateAuthSecretValue(): string {
  const bytes = new Uint8Array(AUTH_SECRET_BYTES);
  window.crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates a custom password based on user constraints.
 */
export function generateCustomPassword(length: number, options: { upper: boolean, lower: boolean, numbers: boolean, symbols: boolean }): string {
  const upperChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowerChars = "abcdefghijklmnopqrstuvwxyz";
  const numberChars = "0123456789";
  const symbolChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  let charset = "";
  if (options.upper) charset += upperChars;
  if (options.lower) charset += lowerChars;
  if (options.numbers) charset += numberChars;
  if (options.symbols) charset += symbolChars;

  if (charset === "") charset = lowerChars; // Fallback

  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);

  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[array[i] % charset.length];
  }
  return result;
}
