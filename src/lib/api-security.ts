import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export function enforceRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const ip = getClientIp(request);
  const { success, retryAfterMs } = rateLimit(`${bucket}:${ip}`, limit, windowMs);
  if (success) return null;

  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterMs / 1000))) },
    },
  );
}
