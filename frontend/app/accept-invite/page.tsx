'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { acceptInvite, fetchInviteProfile } from '@/lib/api';

const TITLE_OPTIONS = ['Mr', 'Mrs', 'Miss', 'Ms', 'Sir', 'Fr.', 'Rev.', 'Dr.', 'Prof.'];

function mapInviteError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('expired')) {
    return 'This invitation has expired. Ask your administrator to issue a new invite.';
  }
  if (normalized.includes('revoked')) {
    return 'This invitation was revoked. Ask your administrator to issue a new invite.';
  }
  if (normalized.includes('accepted') || normalized.includes('already')) {
    return 'This invitation was already used. You can sign in with your account.';
  }
  if (normalized.includes('invalid')) {
    return 'This invitation link is invalid. Check the link or request a new invite.';
  }
  return message;
}

export default function AcceptInvitePage() {
  const [token, setToken] = useState('');

  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token')?.trim() ?? '';
    setToken(tokenFromUrl);
    if (!tokenFromUrl) {
      return;
    }
    fetchInviteProfile(tokenFromUrl)
      .then((profile) => {
        setTitle((prev) => prev || profile.title?.trim() || '');
        setFirstName((prev) => prev || profile.firstName?.trim() || '');
        setLastName((prev) => prev || profile.lastName?.trim() || '');
      })
      .catch(() => {
        // Keep manual entry available even if prefill lookup fails.
      });
  }, []);

  const passwordValid = newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Missing invitation token. Use the complete invite link.');
      return;
    }
    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required.');
      return;
    }
    if (!passwordValid) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await acceptInvite({
        token,
        newPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        title: title.trim() || undefined,
      });
      window.location.href = '/login?inviteAccepted=1';
    } catch (e) {
      const rawMessage = e instanceof Error ? e.message : 'Failed to accept invite';
      setError(mapInviteError(rawMessage));
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-pattern flex flex-col items-center justify-center px-4 pt-4 pb-8 sm:py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white/95 p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-sancta-maroon">Accept invitation</h1>
          <p className="mt-1 text-sm text-gray-600">Set your password and complete your account profile.</p>
        </div>

        {!token && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Missing invitation token. Open the full link shared by your administrator.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <select
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            >
              <option value="">-</option>
              {TITLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
              First name <span className="text-red-500">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              maxLength={100}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
              Last name <span className="text-red-500">*</span>
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              maxLength={100}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
              New password <span className="text-red-500">*</span>
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon ${
                newPassword.length > 0 && !passwordValid ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
              }`}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm password <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon ${
                confirmPassword.length > 0 && !passwordsMatch ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
              }`}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !token}
            className="w-full rounded-lg bg-sancta-maroon px-4 py-3 font-medium text-white hover:bg-sancta-maroon-dark disabled:opacity-60"
          >
            {submitting ? 'Accepting invite...' : 'Accept invite'}
          </button>
        </form>

        <p className="mt-5 text-center">
          <Link href="/login" className="text-sm font-medium text-sancta-maroon hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}
