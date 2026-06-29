import { NextResponse } from 'next/server';
import { createServer, createAdminClient } from '@/lib/supabase/server';
import { generateSecretValue, encrypt } from '@/lib/crypto';

/**
 * GET /api/secrets
 * Retrieves a list of secrets belonging to the authenticated user.
 * Note: It does not return the actual encrypted secrets, only metadata.
 */
export async function GET() {
  try {
    const supabase = await createServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('secrets')
      .select('id, name, prefix, created_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching secrets:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/secrets
 * Generates a new secret, encrypts it on the server using AES-256-GCM,
 * stores it in the database via the admin client, and returns the plaintext version once.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Secret name is required.' }, { status: 400 });
    }

    // Generate, prefix, and encrypt the secret key
    const plaintextSecret = generateSecretValue();
    const prefix = plaintextSecret.substring(0, 8); // e.g. 'sec_abcd'
    const { encryptedText, ivHex, authTagHex } = encrypt(plaintextSecret);

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('secrets')
      .insert({
        user_id: user.id,
        name: name.trim(),
        encrypted_secret: encryptedText,
        iv: ivHex,
        auth_tag: authTagHex,
        prefix,
      })
      .select('id, name, prefix, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return the inserted metadata AND the one-time plaintext key to display
    return NextResponse.json({
      ...data,
      plaintext: plaintextSecret,
    });
  } catch (error: any) {
    console.error('Error generating secret:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
