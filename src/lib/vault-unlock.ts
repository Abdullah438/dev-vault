import {
  decryptClient,
  deriveMasterKeyForVersion,
  deriveSaltFromUserId,
  encryptClient,
  generateRandomSalt,
  verificationPayloadForVersion,
  type KdfVersion,
} from '@/lib/client-crypto';
import {
  KDF_VERSION_ARGON2,
  KDF_VERSION_LEGACY,
  VERIFICATION_PAYLOAD_V1,
  VERIFICATION_PAYLOAD_V2,
  type VaultConfig,
} from '@/lib/vault-constants';

export type UnlockMeta = {
  total: number;
  verificationId: string | null;
  migrationSecretId: string | null;
  vaultConfig: VaultConfig | null;
};

export type UnlockResult = {
  key: CryptoKey;
  kdfVersion: number;
  needsMigration: boolean;
};

type SecretPayload = {
  encrypted_secret: string;
  iv: string;
};

function normalizePassphrase(passphrase: string): string {
  return passphrase.trim();
}

function isArgon2Config(config: VaultConfig | null | undefined): config is VaultConfig {
  if (!config?.kdf_salt) return false;
  const version = Number(config.kdf_version);
  return version === KDF_VERSION_ARGON2 && /^[0-9a-f]{64}$/i.test(config.kdf_salt);
}

async function verifyWithSecret(
  key: CryptoKey,
  secret: SecretPayload,
  expectedPayloads: string[],
): Promise<boolean> {
  try {
    const decrypted = await decryptClient(secret.encrypted_secret, secret.iv, key);
    return expectedPayloads.includes(decrypted);
  } catch {
    return false;
  }
}

async function tryDecryptWithKey(key: CryptoKey, secret: SecretPayload): Promise<boolean> {
  try {
    await decryptClient(secret.encrypted_secret, secret.iv, key);
    return true;
  } catch {
    return false;
  }
}

async function tryV2Unlock(
  passphrase: string,
  meta: UnlockMeta,
  fetchSecret: (id: string) => Promise<SecretPayload>,
): Promise<UnlockResult | null> {
  if (!isArgon2Config(meta.vaultConfig)) return null;

  const salt = hexToUint8Array(meta.vaultConfig.kdf_salt);
  const key = await deriveMasterKeyForVersion(passphrase, KDF_VERSION_ARGON2, salt);

  if (meta.verificationId) {
    const secret = await fetchSecret(meta.verificationId);
    const valid = await verifyWithSecret(key, secret, [VERIFICATION_PAYLOAD_V2]);
    if (!valid) return null;
  }

  return { key, kdfVersion: KDF_VERSION_ARGON2, needsMigration: false };
}

async function tryLegacyUnlock(
  passphrase: string,
  userId: string,
  meta: UnlockMeta,
  fetchSecret: (id: string) => Promise<SecretPayload>,
): Promise<UnlockResult | null> {
  const legacySalt = await deriveSaltFromUserId(userId);
  const legacyKey = await deriveMasterKeyForVersion(passphrase, KDF_VERSION_LEGACY, legacySalt);

  if (meta.verificationId) {
    const secret = await fetchSecret(meta.verificationId);
    const valid = await verifyWithSecret(legacyKey, secret, [
      VERIFICATION_PAYLOAD_V1,
      VERIFICATION_PAYLOAD_V2,
    ]);
    if (valid) {
      return {
        key: legacyKey,
        kdfVersion: KDF_VERSION_LEGACY,
        needsMigration: true,
      };
    }
    return null;
  }

  if (meta.migrationSecretId) {
    const secret = await fetchSecret(meta.migrationSecretId);
    const valid = await tryDecryptWithKey(legacyKey, secret);
    if (!valid) return null;
    return {
      key: legacyKey,
      kdfVersion: KDF_VERSION_LEGACY,
      needsMigration: true,
    };
  }

  return null;
}

export async function unlockVaultKey(
  passphrase: string,
  userId: string,
  meta: UnlockMeta,
  fetchSecret: (id: string) => Promise<SecretPayload>,
): Promise<UnlockResult> {
  const normalized = normalizePassphrase(passphrase);
  if (!normalized) throw new Error('INCORRECT_PASSPHRASE');

  const isNewVault =
    !meta.verificationId && !meta.migrationSecretId && !isArgon2Config(meta.vaultConfig);
  if (isNewVault) throw new Error('NEW_VAULT');

  // Prefer Argon2id when configured, but fall back to legacy if verification is still on v1.
  const v2Result = await tryV2Unlock(normalized, meta, fetchSecret);
  if (v2Result) return v2Result;

  const legacyResult = await tryLegacyUnlock(normalized, userId, meta, fetchSecret);
  if (legacyResult) return legacyResult;

  throw new Error('INCORRECT_PASSPHRASE');
}

export async function createVaultConfigAndKey(passphrase: string): Promise<{
  key: CryptoKey;
  saltHex: string;
}> {
  const salt = generateRandomSalt();
  const key = await deriveMasterKeyForVersion(
    normalizePassphrase(passphrase),
    KDF_VERSION_ARGON2,
    salt,
  );
  return { key, saltHex: bufferToHex(salt) };
}

export async function createVerificationPayload(key: CryptoKey, kdfVersion: KdfVersion) {
  return encryptClient(verificationPayloadForVersion(kdfVersion), key);
}

function hexToUint8Array(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array(0);
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
