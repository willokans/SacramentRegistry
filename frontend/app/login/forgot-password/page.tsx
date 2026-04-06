'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { forgotPassword } from '@/lib/api';

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 32" fill="currentColor" aria-hidden>
      <path d="M9 0L15 0 14 4 14 11 20 11 22 12 22 14 20 15 14 15 14 28 15 32 9 32 10 28 10 15 4 15 2 14 2 12 4 11 10 11 10 4z" />
    </svg>
  );
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 min-h-[44px] text-base text-gray-900 placeholder-gray-500 transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-sancta-maroon focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 focus:ring-offset-0';

const primaryButtonClass =
  'w-full min-h-[44px] rounded-lg bg-sancta-maroon px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-[background-color,transform,filter] duration-150 hover:bg-sancta-maroon-dark hover:shadow active:scale-[0.99] active:brightness-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-sancta-maroon focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-65 disabled:active:scale-100 inline-flex items-center justify-center gap-2';

/** Same emphasis as “Forgot password” on the login page */
const backToSignInLinkClass =
  'text-sm font-medium text-sancta-maroon underline-offset-2 decoration-transparent transition-colors duration-150 hover:text-sancta-maroon-dark hover:underline hover:decoration-sancta-maroon/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sancta-maroon/30 focus-visible:ring-offset-2 rounded-sm';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token } = await forgotPassword(identifier.trim());
      router.push(`/reset-password?token=${encodeURIComponent(token)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request password reset');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-pattern">
      <header className="w-full shrink-0 border-b border-gray-300/80 bg-white/95 shadow-[0_1px_0_rgba(0,0,0,0.06),0_4px_14px_rgba(0,0,0,0.045)]">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3.5">
          <CrossIcon className="h-8 w-8 shrink-0 text-sancta-gold" aria-hidden />
          <div className="min-w-0">
            <p className="font-serif text-lg font-semibold leading-tight text-sancta-maroon">Sacrament Registry</p>
            <p className="text-xs text-gray-500">Parish sacramental records</p>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-10">
        <div className="w-full max-w-md rounded-lg border border-gray-300/90 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_28px_rgba(0,0,0,0.075)] sm:p-9">
          <div className="mb-6">
            <h1 className="font-serif text-xl font-semibold text-sancta-maroon sm:text-2xl">Forgot password</h1>
            <p className="mt-1 text-sm text-gray-600">
              Enter your username. You&apos;ll continue to the next step to choose a new password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="mb-1 block text-xs font-medium text-gray-500">
                Username
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                placeholder="Enter your username"
                className={inputClass}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-800"
              >
                {error}
              </div>
            )}

            <div className="pt-2">
              <button type="submit" disabled={submitting} className={primaryButtonClass}>
                {submitting && (
                  <svg className="h-4 w-4 shrink-0 animate-spin text-white" fill="none" viewBox="0 0 24 24" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
                {submitting ? 'Sending…' : 'Reset Password'}
              </button>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <p className="text-center">
                <Link href="/login" className={`${backToSignInLinkClass} inline-flex min-h-[44px] items-center justify-center py-1`}>
                  Back to Sign In
                </Link>
              </p>
            </div>
          </form>

          <p className="mt-4 text-center text-xs text-gray-500">
            Need help? Contact your parish administrator for access, invitations, or account questions.
          </p>
        </div>
      </main>
    </div>
  );
}
