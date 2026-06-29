import { NextResponse } from 'next/server';
import { createServer, createAdminClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';

/**
 * GET /api/secrets/[id]
 * Retrieves, decrypts, and returns the plaintext secret key for the owner.
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
      .select('encrypted_secret, iv, auth_tag, user_id')
      .eq('id', id)
      .eq('user_id', user.id) // Ensure security and check owner
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Secret not found or unauthorized.' }, { status: 404 });
    }

    // Decrypt the secret key on the server
    const plaintextSecret = decrypt(data.encrypted_secret, data.iv, data.auth_tag);

    // Update auditing timestamp for when the key was last revealed/used
    await adminClient
      .from('secrets')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({ plaintext: plaintextSecret });
  } catch (error: any) {
    console.error('Error decrypting secret:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while retrieving the secret.' },
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
