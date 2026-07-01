import { NextResponse } from 'next/server';
import { createServer } from '@/lib/supabase/server';
import { getSafeRedirectPath } from '@/lib/safe-redirect';

/**
 * GET /auth/callback
 * Exchanges the PKCE authorization code for a Supabase session.
 * Used during OAuth flow (Google, GitHub, etc.).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = getSafeRedirectPath(searchParams.get('next'), '/');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;

  if (code) {
    const supabase = await createServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth_failed`);
}
