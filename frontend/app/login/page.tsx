'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { login, storeAuth, setStoredParishId } from '@/lib/api';

function CrossIcon({ className }: { className?: string }) {
  // Latin cross with subtly flared ends, solid fill (matches Sancta reference)
  return (
    <svg className={className} viewBox="0 0 24 32" fill="currentColor" aria-hidden>
      <path d="M9 0L15 0 14 4 14 11 20 11 22 12 22 14 20 15 14 15 14 28 15 32 9 32 10 28 10 15 4 15 2 14 2 12 4 11 10 11 10 4z" />
    </svg>
  );
}

function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2.5 6.5h15v10h-15v-10z" />
      <path d="M2.5 6.5l7.5 5 7.5-5" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="4" y="8" width="12" height="8" rx="1" />
      <path d="M6 8V5a4 4 0 018 0v3" />
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

export default function LoginPage() {
  const [inviteAccepted, setInviteAccepted] = useState(false);
  const [idleSignedOut, setIdleSignedOut] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        throw new Error('Invalid response from server');
      }
      storeAuth(token, refreshToken, user);
      // Set default parish so ParishContext shows it on first load
      const defaultParishId = res?.defaultParishId != null ? Number(res.defaultParishId) : null;
      setStoredParishId(defaultParishId);
      // First-login: must reset password before accessing the app
      if (res?.mustResetPassword) {
        window.location.href = '/reset-password?required=1';
        return;
      }
      // Full page navigation so home loads with auth in localStorage
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-pattern flex flex-col items-center justify-center px-4 pt-4 pb-8 sm:py-12">
      {/* Header: cross, title, tagline */}
      <header className="text-center mb-4 sm:mb-8">
        <CrossIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-sancta-gold mb-2" />
        <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-sancta-maroon">Sacrament Registry</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Growing in faith together.</p>
      </header>

      {/* Card */}
      <div className="w-full max-w-md bg-white/95 rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold text-sancta-maroon">Welcome back</h2>
          <p className="text-sm text-gray-600 mt-0.5">Sign in to continue your journey.</p>
        </div>

        {inviteAccepted && (
          <p role="status" className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Invitation accepted. You can now sign in with your username and password.
          </p>
        )}

        {idleSignedOut && (
          <p role="status" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You were signed out after two hours without activity. Please sign in again.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div>
            <label htmlFor="username" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <EnvelopeIcon className="w-4 h-4 text-gray-500" />
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="Enter username"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 focus:border-sancta-maroon text-gray-900 placeholder-gray-500"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <LockIcon className="w-4 h-4 text-gray-500" />
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
                placeholder="Enter your password"
                className="w-full px-4 py-3 pr-14 sm:pr-12 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 focus:border-sancta-maroon text-gray-900 placeholder-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1 flex items-center justify-center text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 rounded"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon className="w-6 h-6 sm:w-5 sm:h-5" /> : <EyeIcon className="w-6 h-6 sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 min-h-[44px] rounded-xl bg-sancta-maroon hover:bg-sancta-maroon-dark text-white font-semibold focus:outline-none focus:ring-2 focus:ring-sancta-maroon focus:ring-offset-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin h-5 w-5 text-white shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-3" role="status">
            <LockIcon className="w-3.5 h-3.5 text-sancta-gold shrink-0" aria-hidden />
            Records are securely stored and access is audited.
          </p>
        </form>

        {/* Links */}
        <div className="mt-6 pt-4 border-t border-gray-100 text-center space-y-2">
          <p>
            <Link href="/" className="text-sm text-sancta-maroon hover:underline focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 rounded">
              Home
            </Link>
            <span className="mx-2 text-gray-300">·</span>
            <Link href="/privacy" className="text-sm text-sancta-maroon hover:underline focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 rounded">
              Privacy Notice
            </Link>
            <span className="mx-2 text-gray-300">·</span>
            <Link href="/terms-of-use" className="text-sm text-sancta-maroon hover:underline focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 rounded">
              Terms of Use
            </Link>
            <span className="mx-2 text-gray-300">·</span>
            <Link href="/login/forgot-password" className="text-sm text-sancta-maroon hover:underline focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 rounded">
              Forgot password?
            </Link>
          </p>
          <p className="mt-3 text-xs text-gray-500">
            Account access is by invitation only. Contact your parish administrator to request access.
          </p>
        </div>
      </div>
    </main>
  );
}
