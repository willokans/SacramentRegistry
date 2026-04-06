'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import {
  getStoredUser,
  createUser,
  issueUserInvitation,
  resendUserInvitation,
  fetchDiocesesWithParishes,
  type IssueUserInvitationResponse,
  type DioceseResponse,
  type ParishResponse,
} from '@/lib/api';
import { USER_SETUP_ROLE_OPTIONS } from '@/lib/appRoles';

const TITLE_OPTIONS = ['Mr', 'Mrs', 'Miss', 'Ms', 'Sir', 'Fr.', 'Rev.', 'Dr.', 'Prof.'];

export default function UserSetupPage() {
  const router = useRouter();
  const [dioceses, setDioceses] = useState<DioceseResponse[]>([]);
  const [parishesByDiocese, setParishesByDiocese] = useState<Record<number, ParishResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{
    displayName: string;
    invitationId: number;
    invitedEmail: string;
    emailDeliveryStatus: 'PENDING' | 'SENT' | 'FAILED' | null;
    deliveryMessage: string | null;
  } | null>(null);
  const [resendingInvitation, setResendingInvitation] = useState(false);

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
      const dioceseListWithParishes = await fetchDiocesesWithParishes();
      const dioceseList: DioceseResponse[] = dioceseListWithParishes.map((d) => ({
        id: d.id,
        name: d.dioceseName,
        dioceseName: d.dioceseName,
      }));
      const byDiocese: Record<number, ParishResponse[]> = {};
      for (const d of dioceseListWithParishes) {
        byDiocese[d.id] = d.parishes ?? [];
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
        ← Administration
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

      {inviteResult?.emailDeliveryStatus === 'FAILED' && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <p className="text-sm font-semibold">Invite delivery issue</p>
          <p className="mt-1 text-sm">Invite created, but email delivery failed. Please resend.</p>
          <p className="mt-1 text-xs text-amber-800">
            Recipient: {inviteResult.invitedEmail || 'unknown recipient'}
          </p>
          {inviteResult.deliveryMessage && (
            <p className="mt-1 text-xs text-amber-800">{inviteResult.deliveryMessage}</p>
          )}
          <button
            type="button"
            onClick={async () => {
              if (!inviteResult?.invitationId || resendingInvitation) return;
              setResendingInvitation(true);
              setError(null);
              setSuccessMessage(null);
              try {
                const resent = await resendUserInvitation(inviteResult.invitationId);
                if (!resent.invitationId || Number.isNaN(resent.invitationId)) {
                  throw new Error('Resend completed but no invitation ID was returned.');
                }
                const nextStatus = resent.emailDeliveryStatus ?? null;
                setInviteResult((prev) => ({
                  displayName: prev?.displayName ?? inviteResult.displayName,
                  invitationId: resent.invitationId,
                  invitedEmail: resent.invitedEmail || prev?.invitedEmail || inviteResult.invitedEmail,
                  emailDeliveryStatus: nextStatus,
                  deliveryMessage: resent.deliveryMessage ?? null,
                }));
                if (nextStatus === 'SENT') {
                  setSuccessMessage(`Invitation email resent successfully for "${inviteResult.displayName}".`);
                } else if (nextStatus === 'PENDING') {
                  setSuccessMessage(`Resend started for "${inviteResult.displayName}". Email delivery is pending.`);
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to resend invitation');
              } finally {
                setResendingInvitation(false);
              }
            }}
            disabled={resendingInvitation}
            className="mt-3 rounded-lg bg-sancta-maroon px-4 py-2 text-sm font-medium text-white hover:bg-sancta-maroon-dark disabled:opacity-50"
          >
            {resendingInvitation ? 'Resending…' : 'Resend invitation email'}
          </button>
        </div>
      )}

      <div className="mt-6">
        <CreateUserForm
          dioceses={dioceses}
          parishesByDiocese={parishesByDiocese}
          onSuccess={({ displayName, invitation }) => {
            const deliveryStatus = invitation.emailDeliveryStatus ?? null;
            if (deliveryStatus === 'SENT') {
              setSuccessMessage(`User "${displayName}" created and invitation email sent successfully.`);
            } else if (deliveryStatus === 'PENDING') {
              setSuccessMessage(`User "${displayName}" created. Invitation email delivery is pending.`);
            } else {
              setSuccessMessage(`User "${displayName}" created.`);
            }
            setInviteResult({
              displayName,
              invitationId: invitation.invitationId,
              invitedEmail: invitation.invitedEmail,
              emailDeliveryStatus: deliveryStatus,
              deliveryMessage: invitation.deliveryMessage ?? null,
            });
            setError(null);
          }}
          onError={(msg) => {
            setError(msg);
            setSuccessMessage(null);
            setInviteResult(null);
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
  onSuccess: (payload: { displayName: string; invitation: IssueUserInvitationResponse }) => void;
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
  const [parishSearch, setParishSearch] = useState('');

  const allParishes = Object.values(parishesByDiocese).flat();
  const selectedParishes = allParishes
    .filter((p) => parishIds.has(p.id))
    .sort((a, b) => a.parishName.localeCompare(b.parishName));
  const dioceseNameById = useMemo(
    () =>
      Object.fromEntries(
        dioceses.map((d) => [d.id, d.name || d.dioceseName || `Diocese ${d.id}`])
      ) as Record<number, string>,
    [dioceses],
  );
  const filteredAvailableParishes = useMemo(() => {
    const normalizedQuery = parishSearch.trim().toLowerCase();
    return allParishes
      .filter((p) => !parishIds.has(p.id))
      .filter((p) => {
        if (!normalizedQuery) return true;
        const dioceseName = (dioceseNameById[p.dioceseId] ?? '').toLowerCase();
        return (
          p.parishName.toLowerCase().includes(normalizedQuery) ||
          dioceseName.includes(normalizedQuery)
        );
      })
      .sort((a, b) => a.parishName.localeCompare(b.parishName));
  }, [allParishes, parishIds, parishSearch, dioceseNameById]);
  const availableDioceseLabel = useMemo(() => {
    const dioceseIds = Array.from(new Set(filteredAvailableParishes.map((p) => p.dioceseId)));
    if (dioceseIds.length === 1) {
      const name = dioceseNameById[dioceseIds[0]] ?? 'Selected Diocese';
      return `${name} Diocese`;
    }
    return 'Multiple Dioceses';
  }, [filteredAvailableParishes, dioceseNameById]);
  const defaultMustBeAssigned =
    defaultParishId != null && defaultParishId > 0 && !parishIds.has(defaultParishId);
  const passwordsMatch = defaultPassword === confirmPassword;
  const passwordValid = defaultPassword.length >= 8;
  const selectedRoleOption = useMemo(
    () => USER_SETUP_ROLE_OPTIONS.find((r) => r.value === role),
    [role],
  );
  const roleDescriptionId = selectedRoleOption?.description ? 'role-field-description' : undefined;

  const addParish = (id: number) => {
    setParishIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setDefaultParishId((prev) => prev ?? id);
    onError('');
  };

  const removeParish = (id: number) => {
    setParishIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDefaultParishId((prev) => (prev === id ? null : prev));
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
      if (!invitation.invitationId || Number.isNaN(invitation.invitationId)) {
        throw new Error('Invitation was created but no invitation ID was returned.');
      }
      const displayName = created.displayName || created.username;
      onSuccess({
        displayName,
        invitation,
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
      className="max-w-3xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-3xl font-serif font-semibold text-sancta-maroon">User Setup</h2>
      <p className="mt-1 text-gray-500">Create new users. The user must reset their password on first login.</p>

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
          aria-describedby={roleDescriptionId}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
        >
          {USER_SETUP_ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {selectedRoleOption?.description && (
          <p id="role-field-description" className="mt-2 text-xs text-gray-600">
            {selectedRoleOption.description}
          </p>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-3xl font-serif font-semibold text-sancta-maroon">Parish Access</h3>
        <p className="mt-1 text-gray-600">
          Search parishes, add them to this user, then pick a default parish.
        </p>

        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
          <label htmlFor="parish-search" className="sr-only">
            Search parish
          </label>
          <div className="relative">
            <input
              id="parish-search"
              type="search"
              value={parishSearch}
              onChange={(e) => setParishSearch(e.target.value)}
              placeholder="Search parish..."
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
          </div>

          <div className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white">
            {dioceses.length === 0 ? (
              <p className="p-3 text-sm text-gray-500">No parishes available. Add dioceses and parishes first.</p>
            ) : filteredAvailableParishes.length === 0 ? (
              <p className="p-3 text-sm text-gray-500">No available parishes match your search.</p>
            ) : (
              <div className="p-3">
                <p className="mb-2 text-sm font-semibold text-gray-700">
                  Available Parishes <span className="font-normal text-gray-500">({availableDioceseLabel})</span>
                </p>
                <ul role="list" className="divide-y divide-gray-100">
                {filteredAvailableParishes.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <p className="min-w-0 truncate text-sm text-gray-900">{p.parishName}</p>
                    <button
                      type="button"
                      onClick={() => addParish(p.id)}
                      className="shrink-0 rounded-md border border-sancta-maroon/40 px-3 py-1 text-xs font-medium text-sancta-maroon hover:bg-sancta-maroon/5"
                    >
                      + Add
                    </button>
                  </li>
                ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3">
          <h4 className="text-3xl font-serif font-semibold text-sancta-maroon">Selected Parishes</h4>
          {selectedParishes.length === 0 ? (
            <p className="mt-1 text-xs text-gray-500">No parish selected yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-white p-2">
              {selectedParishes.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2">
                  <span className="min-w-0 truncate text-sm text-gray-900">{p.parishName}</span>
                  <button
                    type="button"
                    onClick={() => removeParish(p.id)}
                    className="shrink-0 rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedParishes.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-3xl font-serif font-semibold text-sancta-maroon">Default Parish</h4>
          <p className="mt-0.5 text-xs text-gray-500">
            Select the parish shown when this user logs in.
          </p>
          <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-white p-3">
            {selectedParishes.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-50">
                <input
                  type="radio"
                  name="default-parish-radio"
                  checked={defaultParishId === p.id}
                  onChange={() => setDefaultParishId(p.id)}
                  className="border-gray-300 text-sancta-maroon focus:ring-sancta-maroon"
                />
                <span className="text-sm text-gray-900">{p.parishName}</span>
              </label>
            ))}
          </div>
          {defaultMustBeAssigned && (
            <p className="mt-1 text-xs text-red-600">
              Default parish must be one of the assigned parishes.
            </p>
          )}
        </div>
      ) : null}

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
