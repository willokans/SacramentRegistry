'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStoredToken, resetPassword, resetPasswordByToken } from '@/lib/api';

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 32" fill="currentColor" aria-hidden>
      <path d="M9 0L15 0 14 4 14 11 20 11 22 12 22 14 20 15 14 15 14 28 15 32 9 32 10 28 10 15 4 15 2 14 2 12 4 11 10 11 10 4z" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M10 4C5.5 4 2 10 2 10s3.5 6 8 6 8-6 8-6-3.5-6-8-6z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 3l14 14M11 11a2 2 0 01-2.8-2.8M7 5C4 6.5 2 10 2 10s2 4 5 5M13 15c2.5-1 4-4 4-4s-1.5-3-4-4" />
    </svg>
  );
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 min-h-[44px] text-base text-gray-900 placeholder-gray-500 transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-sancta-maroon focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 focus:ring-offset-0';

const primaryButtonClass =
  'w-full min-h-[44px] rounded-lg bg-sancta-maroon px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-[background-color,transform,filter] duration-150 hover:bg-sancta-maroon-dark hover:shadow active:scale-[0.99] active:brightness-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-sancta-maroon focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-65 disabled:active:scale-100 inline-flex items-center justify-center gap-2';

const backToSignInLinkClass =
  'text-sm font-medium text-sancta-maroon underline-offset-2 decoration-transparent transition-colors duration-150 hover:text-sancta-maroon-dark hover:underline hover:decoration-sancta-maroon/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sancta-maroon/30 focus-visible:ring-offset-2 rounded-sm';

function AuthShell({ children }: { children: React.ReactNode }) {
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
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-10">{children}</main>
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRequired = searchParams.get('required') === '1';
  const tokenFromUrl = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isTokenFlow = Boolean(tokenFromUrl);
  const isFirstLoginFlow = isRequired && !isTokenFlow;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (isTokenFlow) return;
    if (isFirstLoginFlow) {
      const jwt = getStoredToken();
      if (!jwt) router.push('/login');
    } else {
      router.push('/login');
    }
  }, [mounted, router, isTokenFlow, isFirstLoginFlow]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      if (isTokenFlow && tokenFromUrl) {
        await resetPasswordByToken(tokenFromUrl, newPassword);
        window.location.href = '/login';
      } else {
        await resetPassword(newPassword);
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
      setSubmitting(false);
    }
  }

  if (!mounted) {
    return (
      <AuthShell>
        <p className="text-sm text-gray-600">Loading…</p>
      </AuthShell>
    );
  }

  if (!isTokenFlow && !getStoredToken()) {
    return (
      <AuthShell>
        <p className="text-sm text-gray-600">Redirecting to login…</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="w-full max-w-md rounded-lg border border-gray-300/90 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_28px_rgba(0,0,0,0.075)] sm:p-9">
        <div className="mb-6">
          <h1 className="font-serif text-xl font-semibold text-sancta-maroon sm:text-2xl">
            {isFirstLoginFlow ? 'Set password' : 'Reset password'}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {isFirstLoginFlow
              ? 'You must set a new password before continuing.'
              : 'Enter your new password below.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-xs font-medium text-gray-500">
              New password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-2 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sancta-maroon/25 sm:min-h-0 sm:min-w-0 sm:p-2"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-xs font-medium text-gray-500">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Confirm your new password"
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
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {submitting ? 'Setting password…' : 'Set password'}
            </button>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="text-center">
              <Link
                href="/login"
                className={`${backToSignInLinkClass} inline-flex min-h-[44px] items-center justify-center py-1`}
              >
                Back to Sign In
              </Link>
            </p>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-gray-500">
          Need help? Contact your parish administrator for access, invitations, or account questions.
        </p>
      </div>
    </AuthShell>
  );
}
