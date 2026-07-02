import {
  decryptClient,
  encryptClient,
  verificationPayloadForVersion,
} from '@/lib/client-crypto';
import { KDF_VERSION_ARGON2, SYSTEM_SECRET_NAME } from '@/lib/vault-constants';
import { createVaultConfigAndKey } from '@/lib/vault-unlock';

export type SecretRecord = {
  id: string;
  name: string;
  prefix: string;
  category: string;
  encrypted_secret: string;
  iv: string;
};

type MigrationCallbacks = {
  fetchAllSecrets: () => Promise<SecretRecord[]>;
  updateSecret: (
    id: string,
    payload: {
      name: string;
      encrypted_secret: string;
      iv: string;
      prefix: string;
      category: string;
    },
  ) => Promise<void>;
  createSecret: (payload: {
    name: string;
    encrypted_secret: string;
    iv: string;
    prefix: string;
    category: string;
  }) => Promise<void>;
  deleteSecret: (id: string) => Promise<void>;
  saveVaultConfig: (saltHex: string) => Promise<void>;
};

export async function migrateVaultToV2(
  passphrase: string,
  legacyKey: CryptoKey,
  verificationId: string | null,
  callbacks: MigrationCallbacks,
): Promise<CryptoKey> {
  const { key: newKey, saltHex } = await createVaultConfigAndKey(passphrase);

  // Persist salt first so a partial migration can still unlock via Argon2id fallback.
  await callbacks.saveVaultConfig(saltHex);

  const secrets = await callbacks.fetchAllSecrets();
  const userSecrets = secrets.filter(s => s.name !== SYSTEM_SECRET_NAME);

  for (const secret of userSecrets) {
    let plaintext: string;
    try {
      plaintext = await decryptClient(secret.encrypted_secret, secret.iv, legacyKey);
    } catch {
      // Secret may already be on v2 from a previous partial migration.
      try {
        await decryptClient(secret.encrypted_secret, secret.iv, newKey);
        continue;
      } catch {
        throw new Error(`Unable to decrypt "${secret.name}" during migration.`);
      }
    }

    const { ciphertext, iv } = await encryptClient(plaintext, newKey);
    await callbacks.updateSecret(secret.id, {
      name: secret.name,
      encrypted_secret: ciphertext,
      iv,
      prefix: secret.prefix,
      category: secret.category,
    });
  }

  const verificationPayload = await encryptClient(
    verificationPayloadForVersion(KDF_VERSION_ARGON2),
    newKey,
  );

  if (verificationId) {
    await callbacks.updateSecret(verificationId, {
      name: SYSTEM_SECRET_NAME,
      encrypted_secret: verificationPayload.ciphertext,
      iv: verificationPayload.iv,
      prefix: 'ver_',
      category: 'System',
    });
  } else {
    await callbacks.createSecret({
      name: SYSTEM_SECRET_NAME,
      encrypted_secret: verificationPayload.ciphertext,
      iv: verificationPayload.iv,
      prefix: 'ver_',
      category: 'System',
    });
  }

  return newKey;
}
