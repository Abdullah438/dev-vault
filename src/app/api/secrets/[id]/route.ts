import { NextResponse } from 'next/server';
import { createServer, createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/secrets/[id]
 * Retrieves the raw encrypted secret ciphertext and IV for client-side decryption.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Fetch the encrypted details for this specific secret
    const { data, error } = await adminClient
      .from('secrets')
      .select('encrypted_secret, iv, user_id')
      .eq('id', id)
      .eq('user_id', user.id) // Ensure ownership
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Secret not found or unauthorized.' }, { status: 404 });
    }

    // Update auditing timestamp for when the key was last revealed/accessed
    await adminClient
      .from('secrets')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({
      encrypted_secret: data.encrypted_secret,
      iv: data.iv,
    });
  } catch (error: any) {
    console.error('Error fetching secret payload:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while retrieving the secret.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/secrets/[id]
 * Updates an existing secret's encrypted payload and metadata.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
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
  } catch (error: any) {
    console.error('Error updating secret:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while updating the secret.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/secrets/[id]
 * Permanently deletes / revokes a secret key.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Delete the secret ensuring it belongs to the logged-in user
    const { error } = await adminClient
      .from('secrets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting secret:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while deleting the secret.' },
      { status: 500 }
    );
  }
}
