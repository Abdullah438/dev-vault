/** Fields we persist on auth.users.raw_user_meta_data */
export const PROFILE_METADATA_KEYS = ['full_name'] as const;

export type ProfileMetadata = {
  full_name: string;
};

type UserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  identities?: Array<{ provider?: string }>;
};

/** Resolve a display name from metadata (ours or OAuth-provided). */
export function getDisplayName(user: UserLike): string | null {
  const meta = user.user_metadata ?? {};
  const candidates = [meta.full_name, meta.name, meta.user_name];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

/** Value to pre-fill the profile name field. */
export function getProfileName(user: UserLike): string {
  const meta = user.user_metadata ?? {};
  if (typeof meta.full_name === 'string') {
    return meta.full_name.trim();
  }
  return getDisplayName(user) ?? '';
}

export function hasProfileName(user: UserLike): boolean {
  const meta = user.user_metadata ?? {};
  return typeof meta.full_name === 'string' && meta.full_name.trim().length > 0;
}

export function getAuthProviders(user: UserLike): string[] {
  if (user.identities?.length) {
    return [...new Set(user.identities.map((i) => i.provider).filter(Boolean) as string[])];
  }
  const provider = user.app_metadata?.provider;
  return typeof provider === 'string' ? [provider] : ['email'];
}

export function canChangePassword(user: UserLike): boolean {
  return getAuthProviders(user).includes('email');
}

export function formatProviderLabel(provider: string): string {
  switch (provider) {
    case 'email':
      return 'Email & password';
    case 'google':
      return 'Google';
    case 'github':
      return 'GitHub';
    default:
      return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}
