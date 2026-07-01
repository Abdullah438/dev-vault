/**
 * DevVault Client-Side Zero-Knowledge Cryptography Library
 * Uses native Web Crypto API (supported by all modern browsers).
 */

import { argon2id } from 'hash-wasm';
import {
  KDF_VERSION_ARGON2,
  KDF_VERSION_LEGACY,
  VERIFICATION_PAYLOAD_V1,
  VERIFICATION_PAYLOAD_V2,
} from '@/lib/vault-constants';

export { KDF_VERSION_ARGON2, KDF_VERSION_LEGACY, VERIFICATION_PAYLOAD_V1, VERIFICATION_PAYLOAD_V2 };

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

/** Generates a cryptographically secure 32-byte salt for KDF v2. */
export function generateRandomSalt(): Uint8Array {
  const salt = new Uint8Array(32);
  window.crypto.getRandomValues(salt);
  return salt;
}

/**
 * Derives a stable salt from the stable User UUID (legacy KDF v1 only).
 */
export async function deriveSaltFromUserId(userId: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(userId);
  return await window.crypto.subtle.digest('SHA-256', data);
}

/**
 * Legacy KDF v1: PBKDF2 with 100,000 iterations and UUID-derived salt.
 */
export async function deriveMasterKeyLegacy(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
  return derivePbkdf2Key(passphrase, salt, 100_000);
}

/**
 * KDF v2: Argon2id (64 MiB, 3 iterations) with per-user random salt.
 */
export async function deriveMasterKeyV2(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const hash = await argon2id({
    password: passphrase,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'binary',
  });

  const keyBytes = new Uint8Array(hash);

  return window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export type KdfVersion = typeof KDF_VERSION_LEGACY | typeof KDF_VERSION_ARGON2;

export async function deriveMasterKeyForVersion(
  passphrase: string,
  kdfVersion: KdfVersion,
  salt: Uint8Array | ArrayBuffer,
): Promise<CryptoKey> {
  switch (kdfVersion) {
    case KDF_VERSION_LEGACY:
      return deriveMasterKeyLegacy(passphrase, salt as ArrayBuffer);
    case KDF_VERSION_ARGON2:
      return deriveMasterKeyV2(passphrase, salt as Uint8Array);
    default: {
      const _exhaustive: never = kdfVersion;
      throw new Error(`Unsupported KDF version: ${_exhaustive}`);
    }
  }
}

export function verificationPayloadForVersion(kdfVersion: KdfVersion): string {
  switch (kdfVersion) {
    case KDF_VERSION_LEGACY:
      return VERIFICATION_PAYLOAD_V1;
    case KDF_VERSION_ARGON2:
      return VERIFICATION_PAYLOAD_V2;
    default: {
      const _exhaustive: never = kdfVersion;
      throw new Error(`Unsupported KDF version: ${_exhaustive}`);
    }
  }
}

async function derivePbkdf2Key(passphrase: string, salt: ArrayBuffer, iterations: number): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** @deprecated Use deriveMasterKeyLegacy — kept for import compatibility. */
export async function deriveMasterKey(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
  return deriveMasterKeyLegacy(passphrase, salt);
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * The Web Crypto API automatically appends the 16-byte authentication tag
 * to the end of the ciphertext buffer, so a separate auth_tag field is not needed.
 */
export async function encryptClient(text: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text),
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
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
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
export function generateCustomPassword(
  length: number,
  options: { upper: boolean; lower: boolean; numbers: boolean; symbols: boolean },
): string {
  const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowerChars = 'abcdefghijklmnopqrstuvwxyz';
  const numberChars = '0123456789';
  const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let charset = '';
  if (options.upper) charset += upperChars;
  if (options.lower) charset += lowerChars;
  if (options.numbers) charset += numberChars;
  if (options.symbols) charset += symbolChars;

  if (charset === '') charset = lowerChars;

  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[array[i] % charset.length];
  }
  return result;
}
