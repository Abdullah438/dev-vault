/**
 * Validates post-auth redirect paths to prevent open-redirect attacks.
 */
export function getSafeRedirectPath(next: string | null, fallback = '/'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  if (next.includes('\\') || next.includes('@') || next.includes('\0')) return fallback;
  return next;
}
