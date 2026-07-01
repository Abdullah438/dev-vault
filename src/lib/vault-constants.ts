export const KDF_VERSION_LEGACY = 1;
export const KDF_VERSION_ARGON2 = 2;

export const VERIFICATION_PAYLOAD_V1 = 'devvault:verified';
export const VERIFICATION_PAYLOAD_V2 = 'devvault:verified:2';

export const SYSTEM_SECRET_NAME = '__devvault_verification__';

/** Auto-lock vault after 15 minutes of inactivity. */
export const VAULT_IDLE_LOCK_MS = 15 * 60 * 1000;

export type VaultConfig = {
  kdf_version: number;
  kdf_salt: string;
};
