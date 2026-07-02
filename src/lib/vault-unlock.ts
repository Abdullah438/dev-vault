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

export async function unlockVaultKey(
  passphrase: string,
  userId: string,
  meta: UnlockMeta,
  fetchSecret: (id: string) => Promise<SecretPayload>,
): Promise<UnlockResult> {
  if (meta.vaultConfig?.kdf_version === KDF_VERSION_ARGON2) {
    const salt = hexToUint8Array(meta.vaultConfig.kdf_salt);
    const key = await deriveMasterKeyForVersion(passphrase, KDF_VERSION_ARGON2, salt);

    if (meta.verificationId) {
      const secret = await fetchSecret(meta.verificationId);
      const valid = await verifyWithSecret(key, secret, [VERIFICATION_PAYLOAD_V2]);
      if (!valid) throw new Error('INCORRECT_PASSPHRASE');
    }

    return { key, kdfVersion: KDF_VERSION_ARGON2, needsMigration: false };
  }

  const legacySalt = await deriveSaltFromUserId(userId);
  const legacyKey = await deriveMasterKeyForVersion(passphrase, KDF_VERSION_LEGACY, legacySalt);

  if (!meta.verificationId && !meta.migrationSecretId) {
    throw new Error('NEW_VAULT');
  }

  if (meta.verificationId) {
    const secret = await fetchSecret(meta.verificationId);
    const valid = await verifyWithSecret(legacyKey, secret, [
      VERIFICATION_PAYLOAD_V1,
      VERIFICATION_PAYLOAD_V2,
    ]);
    if (!valid) throw new Error('INCORRECT_PASSPHRASE');
    return { key: legacyKey, kdfVersion: KDF_VERSION_LEGACY, needsMigration: true };
  }

  const secret = await fetchSecret(meta.migrationSecretId!);
  try {
    await decryptClient(secret.encrypted_secret, secret.iv, legacyKey);
  } catch {
    throw new Error('INCORRECT_PASSPHRASE');
  }
  return { key: legacyKey, kdfVersion: KDF_VERSION_LEGACY, needsMigration: true };
}

export async function createVaultConfigAndKey(passphrase: string): Promise<{
  key: CryptoKey;
  saltHex: string;
}> {
  const salt = generateRandomSalt();
  const key = await deriveMasterKeyForVersion(passphrase, KDF_VERSION_ARGON2, salt);
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
