import { NextResponse } from 'next/server';
import { createServer } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/api-security';

/**
 * GET /api/secrets/[id]
 * Retrieves the raw encrypted secret ciphertext and IV for client-side decryption.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(request, 'secrets-id-get', 60, 60_000);
  if (limited) return limited;

  try {
    const { id } = await params;
    const supabase = await createServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('secrets')
      .select('encrypted_secret, iv, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Secret not found or unauthorized.' }, { status: 404 });
    }

    await supabase
      .from('secrets')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    return NextResponse.json({
      encrypted_secret: data.encrypted_secret,
      iv: data.iv,
    });
  } catch (error: unknown) {
    console.error('Error fetching secret payload:', error);
    const message = error instanceof Error ? error.message : 'An error occurred while retrieving the secret.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/secrets/[id]
 * Updates an existing secret's encrypted payload and metadata.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(request, 'secrets-id-put', 30, 60_000);
  if (limited) return limited;

  try {
    const { id } = await params;
    const supabase = await createServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, encrypted_secret, iv, prefix, category } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Secret name is required.' }, { status: 400 });
    }
    if (!encrypted_secret || !iv || !prefix) {
      return NextResponse.json({ error: 'Missing encryption parameters.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('secrets')
      .update({
        name: name.trim(),
        category: category || 'API Key',
        encrypted_secret,
        iv,
        prefix,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, name, prefix, category, created_at, last_used_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error updating secret:', error);
    const message = error instanceof Error ? error.message : 'An error occurred while updating the secret.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/secrets/[id]
 * Permanently deletes / revokes a secret key.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(request, 'secrets-id-delete', 30, 60_000);
  if (limited) return limited;

  try {
    const { id } = await params;
    const supabase = await createServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('secrets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting secret:', error);
    const message = error instanceof Error ? error.message : 'An error occurred while deleting the secret.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
