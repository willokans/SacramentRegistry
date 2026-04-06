import { NextResponse } from 'next/server';
import { nextJsonFromBackendErrorBody } from '@/lib/backendProxyErrorResponse';

/**
 * Proxies POST /api/auth/forgot-password to the Spring Boot backend.
 * Requires NEXT_PUBLIC_API_URL (e.g. http://localhost:8080).
 */
export async function POST(request: Request) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!apiUrl) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_API_URL is not configured. Set it to your Spring Boot API URL (e.g. http://localhost:8080).' },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      return nextJsonFromBackendErrorBody(text, 'Failed to request password reset', res.status);
    }
    return NextResponse.json(JSON.parse(text || '{}'));
  } catch (err) {
    console.error('[auth/forgot-password]', err);
    return NextResponse.json(
      { error: 'Failed to request password reset. Ensure the backend is running and NEXT_PUBLIC_API_URL is set.' },
      { status: 502 }
    );
  }
}
