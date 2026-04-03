'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import {
  getStoredUser,
  createUser,
  issueUserInvitation,
  fetchDioceses,
  fetchParishes,
  type DioceseResponse,
  type ParishResponse,
} from '@/lib/api';

const TITLE_OPTIONS = ['Mr', 'Mrs', 'Miss', 'Ms', 'Sir', 'Fr.', 'Rev.', 'Dr.', 'Prof.'];

const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'PRIEST', label: 'Priest' },
  { value: 'PARISH_PRIEST', label: 'Parish Priest' },
  { value: 'PARISH_SECRETARY', label: 'Parish Secretary' },
  { value: 'PARISH_VIEWER', label: 'Parish Viewer' },
];

export default function UserSetupPage() {
  const router = useRouter();
  const [dioceses, setDioceses] = useState<DioceseResponse[]>([]);
  const [parishesByDiocese, setParishesByDiocese] = useState<Record<number, ParishResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    const user = getStoredUser();
    if (user && user.role !== 'SUPER_ADMIN') {
      router.replace('/');
    }
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dioceseList = await fetchDioceses();
      const byDiocese: Record<number, ParishResponse[]> = {};
      for (const d of dioceseList) {
        const parishes = await fetchParishes(d.id);
        byDiocese[d.id] = parishes;
      }
      setDioceses(dioceseList);
      setParishesByDiocese(byDiocese);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    if (user?.role !== 'SUPER_ADMIN') return;
    loadData();
  }, [loadData]);

  const user = getStoredUser();
  if (user && user.role !== 'SUPER_ADMIN') {
    return (
      <AuthenticatedLayout>
        <p className="text-gray-600">Redirecting…</p>
      </AuthenticatedLayout>
    );
  }

  if (loading) {
    return (
      <AuthenticatedLayout>
        <p className="text-gray-600">Loading…</p>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <Link href="/settings" prefetch={false} className="text-sm font-medium text-sancta-maroon hover:underline">
        ← Settings
      </Link>
      <h1 className="mt-3 text-2xl font-serif font-semibold text-sancta-maroon">
        User Setup
      </h1>
      <p className="mt-2 text-gray-600">
        Create new users. The user must reset their password on first login.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-red-600">
          {error}
        </p>
      )}

      {successMessage && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"
        >
          {successMessage}
        </div>
      )}

      {inviteLink && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-sm font-semibold">Invite link</p>
          <p className="mt-1 text-xs">
            Share this one-time link with the user. It expires {inviteExpiresAt ?? 'soon'}.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={inviteLink}
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-gray-800"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteLink);
                  setCopyState('copied');
                } catch {
                  setCopyState('failed');
                }
              }}
              className="rounded-lg bg-sancta-maroon px-4 py-2 text-sm font-medium text-white hover:bg-sancta-maroon-dark"
            >
              Copy link
            </button>
          </div>
          {copyState === 'copied' && <p className="mt-2 text-xs text-green-700">Copied to clipboard.</p>}
          {copyState === 'failed' && <p className="mt-2 text-xs text-red-700">Could not copy. Copy manually.</p>}
        </div>
      )}

      <div className="mt-6">
        <CreateUserForm
          dioceses={dioceses}
          parishesByDiocese={parishesByDiocese}
          onSuccess={({ displayName, inviteLink: createdInviteLink, expiresAt }) => {
            setSuccessMessage(
              `User "${displayName}" created and invite issued successfully.`
            );
            setInviteLink(createdInviteLink);
            setInviteExpiresAt(new Date(expiresAt).toLocaleString());
            setCopyState('idle');
            setError(null);
          }}
          onError={(msg) => {
            setError(msg);
            setSuccessMessage(null);
            setInviteLink(null);
            setInviteExpiresAt(null);
            setCopyState('idle');
          }}
        />
      </div>
    </AuthenticatedLayout>
  );
}

function CreateUserForm({
  dioceses,
  parishesByDiocese,
  onSuccess,
  onError,
}: {
  dioceses: DioceseResponse[];
  parishesByDiocese: Record<number, ParishResponse[]>;
  onSuccess: (payload: { displayName: string; inviteLink: string; expiresAt: string }) => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('PARISH_VIEWER');
  const [parishIds, setParishIds] = useState<Set<number>>(new Set());
  const [defaultParishId, setDefaultParishId] = useState<number | null>(null);
  const [defaultPassword, setDefaultPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const allParishes = Object.values(parishesByDiocese).flat();
  const assignedParishes = allParishes.filter((p) => parishIds.has(p.id));
  const defaultMustBeAssigned =
    defaultParishId != null && defaultParishId > 0 && !parishIds.has(defaultParishId);
  const passwordsMatch = defaultPassword === confirmPassword;
  const passwordValid = defaultPassword.length >= 8;

  const toggleParish = (id: number) => {
    setParishIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    onError('');
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onError('');

    if (!firstName.trim()) {
      onError('First name is required.');
      return;
    }
    if (!lastName.trim()) {
      onError('Last name is required.');
      return;
    }
    if (!username.trim()) {
      onError('Username is required.');
      return;
    }
    if (!email.trim()) {
      onError('Email is required to issue an invite.');
      return;
    }
    if (!passwordValid) {
      onError('Password must be at least 8 characters.');
      return;
    }
    if (!passwordsMatch) {
      onError('Passwords do not match.');
      return;
    }
    if (defaultParishId != null && defaultParishId > 0 && !parishIds.has(defaultParishId)) {
      onError('Default parish must be one of the assigned parishes.');
      return;
    }

    setSaving(true);
    try {
      const created = await createUser({
        username: username.trim(),
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        title: title.trim() || undefined,
        role,
        defaultParishId: defaultParishId ?? undefined,
        parishIds: Array.from(parishIds),
        defaultPassword,
      });
      if (!created.userId || created.userId <= 0) {
        throw new Error('User was created but no user ID was returned for invitation.');
      }
      const invitation = await issueUserInvitation(created.userId);
      if (!invitation.token) {
        throw new Error('Invitation was created but no token was returned.');
      }
      const inviteLink =
        typeof window !== 'undefined'
          ? `${window.location.origin}/accept-invite?token=${encodeURIComponent(invitation.token)}`
          : `/accept-invite?token=${encodeURIComponent(invitation.token)}`;
      const displayName = created.displayName || created.username;
      onSuccess({
        displayName,
        inviteLink,
        expiresAt: invitation.expiresAt,
      });
      setTitle('');
      setFirstName('');
      setLastName('');
      setUsername('');
      setEmail('');
      setRole('PARISH_VIEWER');
      setParishIds(new Set());
      setDefaultParishId(null);
      setDefaultPassword('');
      setConfirmPassword('');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
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
            <option value="">—</option>
            {TITLE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700">
            Username <span className="text-red-500">*</span>
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            maxLength={100}
            autoComplete="username"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={255}
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="role" className="block text-sm font-medium text-gray-700">
          Role <span className="text-red-500">*</span>
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">
          Parish access
        </label>
        <p className="mt-0.5 text-xs text-gray-500">
          Select parishes this user can access.
        </p>
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 p-2">
          {dioceses.length === 0 ? (
            <p className="text-sm text-gray-500">No parishes available. Add dioceses and parishes first.</p>
          ) : (
            dioceses.map((d) => (
              <div key={d.id} className="mb-3 last:mb-0">
                <p className="mb-1 text-xs font-medium text-gray-500">{d.name}</p>
                <ul className="space-y-1">
                  {(parishesByDiocese[d.id] ?? []).map((p) => (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/80">
                        <input
                          type="checkbox"
                          checked={parishIds.has(p.id)}
                          onChange={() => toggleParish(p.id)}
                          className="rounded border-gray-300 text-sancta-maroon focus:ring-sancta-maroon"
                        />
                        <span className="text-sm">{p.parishName}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="default-parish" className="block text-sm font-medium text-gray-700">
          Default parish
        </label>
        <p className="mt-0.5 text-xs text-gray-500">
          The parish shown when this user logs in. Must be one of the assigned parishes.
        </p>
        <select
          id="default-parish"
          value={defaultParishId ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setDefaultParishId(v ? Number(v) : null);
          }}
          className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon ${
            defaultMustBeAssigned ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
          }`}
        >
          <option value="">No default</option>
          {assignedParishes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.parishName}
            </option>
          ))}
          {parishIds.size > 0 && assignedParishes.length === 0 && (
            <option value="" disabled>
              No parishes selected
            </option>
          )}
        </select>
        {defaultMustBeAssigned && (
          <p className="mt-1 text-xs text-red-600">
            Default parish must be one of the assigned parishes.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="defaultPassword" className="block text-sm font-medium text-gray-700">
            Default password <span className="text-red-500">*</span>
          </label>
          <input
            id="defaultPassword"
            type="password"
            value={defaultPassword}
            onChange={(e) => setDefaultPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon ${
              defaultPassword.length > 0 && !passwordValid
                ? 'border-red-300 bg-red-50'
                : 'border-gray-200 bg-white'
            }`}
          />
          {defaultPassword.length > 0 && !passwordValid && (
            <p className="mt-1 text-xs text-red-600">Must be at least 8 characters</p>
          )}
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
              confirmPassword.length > 0 && !passwordsMatch
                ? 'border-red-300 bg-red-50'
                : 'border-gray-200 bg-white'
            }`}
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={
          saving ||
          !firstName.trim() ||
          !lastName.trim() ||
          !username.trim() ||
          !passwordValid ||
          !passwordsMatch ||
          defaultMustBeAssigned
        }
        className="mt-6 rounded-lg bg-sancta-maroon px-4 py-2 font-medium text-white hover:bg-sancta-maroon-dark disabled:opacity-50"
      >
        {saving ? 'Creating and issuing invite…' : 'Create user + issue invite'}
      </button>
    </form>
  );
}
