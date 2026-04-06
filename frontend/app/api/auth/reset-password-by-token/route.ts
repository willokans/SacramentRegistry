import { NextResponse } from 'next/server';
import { nextJsonFromBackendErrorBody } from '@/lib/backendProxyErrorResponse';

/**
 * Proxies POST /api/auth/reset-password-by-token to the Spring Boot backend.
 * Requires NEXT_PUBLIC_API_URL (e.g. http://localhost:8080).
 */
export async function POST(request: Request) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!apiUrl) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_API_URL is not configured.' },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/auth/reset-password-by-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 204) return new NextResponse(null, { status: 204 });
    const text = await res.text();
    if (!res.ok) {
      return nextJsonFromBackendErrorBody(text, 'Invalid or expired reset token', res.status);
    }
    return new NextResponse(null, { status: res.status });
  } catch (err) {
    console.error('[auth/reset-password-by-token]', err);
    return NextResponse.json(
      { error: 'Failed to reset password. Ensure the backend is running.' },
      { status: 502 }
    );
  }
}
