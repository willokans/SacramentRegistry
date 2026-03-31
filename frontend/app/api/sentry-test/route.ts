import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const isSentryTestApiEnabled = () =>
  process.env.NODE_ENV !== 'production' || process.env.ENABLE_SENTRY_TEST_PAGE === 'true';

export async function GET() {
  if (!isSentryTestApiEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const error = new Error('Manual Sentry test error from Next.js API route');
  Sentry.captureException(error);

  return NextResponse.json({ error: error.message }, { status: 500 });
}
