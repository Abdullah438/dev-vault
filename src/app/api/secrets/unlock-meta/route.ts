import { NextResponse } from 'next/server';
import { createServer, createAdminClient } from '@/lib/supabase/server';

const SYSTEM_SECRET_NAME = '__devvault_verification__';

/**
 * GET /api/secrets/unlock-meta
 * Vault unlock helpers: user-facing count, verification token id, migration sample id.
 */
export async function GET() {
  try {
    const supabase = await createServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { count: total, error: countError } = await adminClient
      .from('secrets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('name', SYSTEM_SECRET_NAME);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const { data: verification, error: verificationError } = await adminClient
      .from('secrets')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', SYSTEM_SECRET_NAME)
      .maybeSingle();

    if (verificationError) {
      return NextResponse.json({ error: verificationError.message }, { status: 500 });
    }

    const { data: firstSecret, error: firstSecretError } = await adminClient
      .from('secrets')
      .select('id')
      .eq('user_id', user.id)
      .neq('name', SYSTEM_SECRET_NAME)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstSecretError) {
      return NextResponse.json({ error: firstSecretError.message }, { status: 500 });
    }

    return NextResponse.json({
      total: total ?? 0,
      verificationId: verification?.id ?? null,
      migrationSecretId: firstSecret?.id ?? null,
    });
  } catch (error: unknown) {
    console.error('Error fetching unlock meta:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
