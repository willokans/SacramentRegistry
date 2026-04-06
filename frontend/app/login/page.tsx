'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { login, storeAuth, setStoredParishId } from '@/lib/api';
import { setRememberDevicePreference } from '@/lib/authIdle';

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

/** Privacy — soft, trust-strip style */
const privacyLinkClass =
  'text-sm text-gray-600 underline-offset-2 decoration-transparent transition-colors duration-150 hover:text-sancta-maroon hover:underline hover:decoration-sancta-maroon/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sancta-maroon/25 focus-visible:ring-offset-2 rounded-sm';

/** Forgot password — slightly stronger for discoverability */
const forgotPasswordLinkClass =
  'text-sm font-medium text-sancta-maroon underline-offset-2 decoration-transparent transition-colors duration-150 hover:text-sancta-maroon-dark hover:underline hover:decoration-sancta-maroon/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sancta-maroon/30 focus-visible:ring-offset-2 rounded-sm';

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 min-h-[44px] text-base text-gray-900 placeholder-gray-500 transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-sancta-maroon focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 focus:ring-offset-0';

export default function LoginPage() {
  const [inviteAccepted, setInviteAccepted] = useState(false);
  const [idleSignedOut, setIdleSignedOut] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInviteAccepted(params.get('inviteAccepted') === '1');
    setIdleSignedOut(params.get('reason') === 'idle');
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(username, password);
      const token = res?.token;
      const refreshToken = res?.refreshToken;
      const user = res?.user ?? (res && 'username' in res
        ? { username: res.username, displayName: res.displayName ?? null, role: res.role ?? null }
        : null);
      if (!token || !user) {
        throw new Error(
          'We could not finish signing you in because of an unexpected response. Please try again, or contact your parish administrator.',
        );
      }
      setRememberDevicePreference(rememberDevice);
      storeAuth(token, refreshToken, user);
      const defaultParishId = res?.defaultParishId != null ? Number(res.defaultParishId) : null;
      setStoredParishId(defaultParishId);
      if (res?.mustResetPassword) {
        window.location.href = '/reset-password?required=1';
        return;
      }
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in did not complete. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-pattern">
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
            <h1 className="font-serif text-xl font-semibold text-sancta-maroon sm:text-2xl">Welcome back</h1>
            <p className="mt-1 text-sm text-gray-600">Sign in to continue your work</p>
          </div>

          {inviteAccepted && (
            <p
              role="status"
              className="mb-4 rounded-md border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-900"
            >
              Your invitation is complete. Sign in with the username and password you chose.
            </p>
          )}

          {idleSignedOut && (
            <p
              role="status"
              className="mb-4 rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950"
            >
              You were signed out for inactivity. Please sign in again.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1 block text-xs font-medium text-gray-500">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="Enter your username"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-medium text-gray-500">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
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

            <div className="flex gap-3 pt-1">
              <input
                id="remember-device"
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="mt-[0.35rem] h-[1.125rem] w-[1.125rem] shrink-0 rounded border-gray-400 text-sancta-maroon focus:ring-2 focus:ring-sancta-maroon/35 focus:ring-offset-0"
              />
              <label htmlFor="remember-device" className="min-w-0 flex-1 cursor-pointer select-none leading-snug">
                <span className="text-sm font-medium text-gray-700">Remember this device</span>
                <span className="mt-1 block text-xs text-gray-500">
                  Allows a longer inactive period before you are signed out. Use only on a trusted parish computer.
                </span>
              </label>
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
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[44px] rounded-lg bg-sancta-maroon px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-[background-color,transform,filter] duration-150 hover:bg-sancta-maroon-dark hover:shadow active:scale-[0.99] active:brightness-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-sancta-maroon focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-65 disabled:active:scale-100 inline-flex items-center justify-center gap-2"
              >
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
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-center text-xs text-gray-500" role="status">
                Secure access • Audit logs • Parish-controlled data
              </p>
            </div>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-center sm:gap-8">
            <Link href="/login/forgot-password" className={forgotPasswordLinkClass}>
              Forgot password
            </Link>
            <Link href="/privacy" className={privacyLinkClass}>
              Privacy Notice
            </Link>
          </div>

          <p className="mt-4 text-center text-xs text-gray-500">
            Access is by invitation only. Contact your parish administrator if needed.
          </p>
        </div>
      </main>
    </div>
  );
}
