import { NextResponse } from 'next/server';
import { createServer } from '@/lib/supabase/server';

/**
 * GET /auth/callback
 * Excharges the PKCE authorization code for a Supabase session.
 * Used during OAuth flow (Google, GitHub, etc.).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;

  if (code) {
    const supabase = await createServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Direct the user to the destination path (defaults to dashboard '/')
      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  }

  // If there's an error, redirect the user back to the login page with an error query param
  return NextResponse.redirect(`${siteUrl}/login?error=auth_failed`);
}
