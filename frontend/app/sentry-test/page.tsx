import { notFound } from 'next/navigation';
import SentryTestClient from './sentry-test-client';

export const dynamic = 'force-dynamic';

const isSentryTestPageEnabled = () =>
  process.env.NODE_ENV !== 'production' || process.env.ENABLE_SENTRY_TEST_PAGE === 'true';

export default function SentryTestPage() {
  if (!isSentryTestPageEnabled()) {
    notFound();
  }

  return <SentryTestClient />;
}
