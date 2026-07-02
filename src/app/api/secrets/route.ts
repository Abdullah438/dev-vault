import { NextResponse } from 'next/server';
import { createServer } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/api-security';
import { SYSTEM_SECRET_NAME } from '@/lib/vault-constants';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&');
}

function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  const parsed = parseInt(value ?? '', 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

/**
 * GET /api/secrets?page=1&limit=10&search=stripe
 * Paginated secret metadata (excludes system verification token).
 */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request, 'secrets-get', 120, 60_000);
  if (limited) return limited;

  try {
    const supabase = await createServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const limit = parsePositiveInt(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
    const search = searchParams.get('search')?.trim() ?? '';
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('secrets')
      .select('id, name, prefix, category, created_at, last_used_at', { count: 'exact' })
      .eq('user_id', user.id)
      .neq('name', SYSTEM_SECRET_NAME)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('name', `%${escapeIlike(search)}%`);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const total = count ?? 0;

    return NextResponse.json({
      data: data ?? [],
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error: unknown) {
    console.error('Error fetching secrets:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/secrets
 * Saves a client-side encrypted secret payload along with its category.
 */
export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'secrets-post', 30, 60_000);
  if (limited) return limited;

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

    const { data, error } = await supabase
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
  } catch (error: unknown) {
    console.error('Error saving encrypted secret:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
