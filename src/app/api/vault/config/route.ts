import { NextResponse } from 'next/server';
import { createServer } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/api-security';
import { KDF_VERSION_ARGON2 } from '@/lib/vault-constants';

const HEX_SALT_PATTERN = /^[0-9a-f]{64}$/i;

/**
 * GET /api/vault/config
 * Returns the user's KDF configuration (salt + version).
 */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request, 'vault-config-get', 60, 60_000);
  if (limited) return limited;

  try {
    const supabase = await createServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_vault_config')
      .select('kdf_version, kdf_salt')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ config: null });
    }

    return NextResponse.json({ config: data });
  } catch (error: unknown) {
    console.error('Error fetching vault config:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/vault/config
 * Stores KDF salt and version for Argon2id-based vault encryption.
 */
export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'vault-config-post', 10, 60_000);
  if (limited) return limited;

  try {
    const supabase = await createServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { kdf_salt, kdf_version } = body;

    if (kdf_version !== KDF_VERSION_ARGON2) {
      return NextResponse.json({ error: 'Unsupported KDF version.' }, { status: 400 });
    }
    if (!kdf_salt || typeof kdf_salt !== 'string' || !HEX_SALT_PATTERN.test(kdf_salt)) {
      return NextResponse.json({ error: 'Invalid KDF salt. Expected 64-character hex string.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_vault_config')
      .upsert(
        {
          user_id: user.id,
          kdf_version: KDF_VERSION_ARGON2,
          kdf_salt: kdf_salt.toLowerCase(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('kdf_version, kdf_salt')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: data });
  } catch (error: unknown) {
    console.error('Error saving vault config:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
