import { NextResponse } from 'next/server';
import { createServer } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/api-security';
import { SYSTEM_SECRET_NAME } from '@/lib/vault-constants';

/**
 * GET /api/secrets/unlock-meta
 * Vault unlock helpers: count, verification token id, migration sample id, KDF config.
 */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request, 'unlock-meta', 30, 60_000);
  if (limited) return limited;

  try {
    const supabase = await createServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [
      { count: total, error: countError },
      { data: verification, error: verificationError },
      { data: firstSecret, error: firstSecretError },
      { data: vaultConfig, error: vaultConfigError },
    ] = await Promise.all([
      supabase
        .from('secrets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .neq('name', SYSTEM_SECRET_NAME),
      supabase
        .from('secrets')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', SYSTEM_SECRET_NAME)
        .maybeSingle(),
      supabase
        .from('secrets')
        .select('id')
        .eq('user_id', user.id)
        .neq('name', SYSTEM_SECRET_NAME)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('user_vault_config')
        .select('kdf_version, kdf_salt')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    if (verificationError) return NextResponse.json({ error: verificationError.message }, { status: 500 });
    if (firstSecretError) return NextResponse.json({ error: firstSecretError.message }, { status: 500 });

    // Gracefully handle deployments that have not run the user_vault_config migration yet.
    let resolvedVaultConfig = vaultConfig ?? null;
    if (vaultConfigError) {
      const message = vaultConfigError.message ?? '';
      const missingTable =
        message.includes('user_vault_config') &&
        (message.includes('does not exist') || message.includes('schema cache'));
      if (!missingTable) {
        return NextResponse.json({ error: vaultConfigError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      total: total ?? 0,
      verificationId: verification?.id ?? null,
      migrationSecretId: firstSecret?.id ?? null,
      vaultConfig: resolvedVaultConfig,
    });
  } catch (error: unknown) {
    console.error('Error fetching unlock meta:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
