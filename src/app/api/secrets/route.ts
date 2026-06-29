import { NextResponse } from 'next/server';
import { createServer, createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/secrets
 * Retrieves a list of secrets (metadata only, including category) belonging to the authenticated user.
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
      .select('id, name, prefix, category, created_at, last_used_at')
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
 * Saves a client-side encrypted secret payload along with its category.
 */
export async function POST(request: Request) {
  try {
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
      return NextResponse.json({ error: 'Missing client-side encryption parameters.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('secrets')
      .insert({
        user_id: user.id,
        name: name.trim(),
        category: category || 'API Key',
        encrypted_secret,
        iv,
        auth_tag: 'combined',
        prefix,
      })
      .select('id, name, prefix, category, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error saving encrypted secret:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
