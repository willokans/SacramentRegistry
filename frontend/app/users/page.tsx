'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import {
  getStoredUser,
  searchUsersWithParishAccess,
  replaceUserParishAccess,
  getLatestUserInvitation,
  resendUserInvitation,
  fetchDiocesesWithParishes,
  type IssueUserInvitationResponse,
  type UserParishAccessResponse,
  type DioceseResponse,
  type ParishResponse,
} from '@/lib/api';

function isAdminOrSuperAdmin(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

const USERS_PAGE_SIZE = 20;

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserParishAccessResponse[]>([]);
  const [dioceses, setDioceses] = useState<DioceseResponse[]>([]);
  const [parishesByDiocese, setParishesByDiocese] = useState<Record<number, ParishResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [usersPage, setUsersPage] = useState(0);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [latestInvitation, setLatestInvitation] = useState<IssueUserInvitationResponse | null>(null);
  const [invitationLoading, setInvitationLoading] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [resendingInvitation, setResendingInvitation] = useState(false);

  const selectedUser = users.find((u) => u.userId === selectedUserId);
  const allParishes = Object.values(parishesByDiocese).flat();

  useEffect(() => {
    const user = getStoredUser();
    if (user && !isAdminOrSuperAdmin(user.role)) {
      router.replace('/');
    }
  }, [router]);

  const loadReferenceData = useCallback(async () => {
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

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setError(null);
    try {
      const page = await searchUsersWithParishAccess(searchQuery, usersPage, USERS_PAGE_SIZE);
      setUsers(page.content);
      setUsersTotalPages(Math.max(1, page.totalPages || 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setUsersLoading(false);
    }
  }, [searchQuery, usersPage]);

  useEffect(() => {
    const user = getStoredUser();
    if (!isAdminOrSuperAdmin(user?.role)) return;
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUsersPage(0);
      setSearchQuery(searchInput.trim());
    }, 350);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    const user = getStoredUser();
    if (!isAdminOrSuperAdmin(user?.role)) return;
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (selectedUserId == null) return;
    if (!users.some((u) => u.userId === selectedUserId)) {
      setSelectedUserId(null);
      setLatestInvitation(null);
      setInvitationError(null);
    }
  }, [selectedUserId, users]);

  useEffect(() => {
    if (selectedUserId == null) {
      setLatestInvitation(null);
      setInvitationError(null);
      setInvitationLoading(false);
      return;
    }
    let cancelled = false;
    setInvitationLoading(true);
    setInvitationError(null);
    getLatestUserInvitation(selectedUserId)
      .then((invitation) => {
        if (cancelled) return;
        setLatestInvitation(invitation);
      })
      .catch((e) => {
        if (cancelled) return;
        setInvitationError(e instanceof Error ? e.message : 'Failed to load invitation');
        setLatestInvitation(null);
      })
      .finally(() => {
        if (!cancelled) {
          setInvitationLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  const user = getStoredUser();
  if (user && !isAdminOrSuperAdmin(user.role)) {
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
        User Parish Access
      </h1>
      <p className="mt-2 text-gray-600">
        Assign or revoke parish access for users. Set a default parish for each user.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-sancta-maroon">Users</h2>
          <label htmlFor="user-search" className="mt-3 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Search
          </label>
          <input
            id="user-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, username, or email"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
          />
          {usersLoading && (
            <p className="mt-2 text-xs text-gray-500">Refreshing users…</p>
          )}
          {users.length === 0 ? (
            <p className="mt-3 text-gray-500">No users found.</p>
          ) : (
            <ul className="mt-3 space-y-1" role="list">
              {users.map((u) => (
                <li key={u.userId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserId(u.userId);
                      setSaveError(null);
                      setInvitationError(null);
                    }}
                    className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      selectedUserId === u.userId
                        ? 'bg-sancta-maroon/10 font-medium text-sancta-maroon'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="block truncate">
                      {u.displayName || u.username}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {u.username} · {u.role ?? '—'} · {u.parishAccessIds.length} parish
                      {u.parishAccessIds.length !== 1 ? 'es' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
            <span>
              Page {usersPage + 1} of {usersTotalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={usersPage <= 0 || usersLoading}
                onClick={() => setUsersPage((prev) => Math.max(0, prev - 1))}
                className="rounded border border-gray-200 px-2.5 py-1 hover:bg-gray-100 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={usersPage >= usersTotalPages - 1 || usersLoading}
                onClick={() => setUsersPage((prev) => prev + 1)}
                className="rounded border border-gray-200 px-2.5 py-1 hover:bg-gray-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          {selectedUser ? (
            <UserParishAccessForm
              user={selectedUser}
              dioceses={dioceses}
              parishesByDiocese={parishesByDiocese}
              allParishes={allParishes}
              saving={saving}
              saveError={saveError}
              onSaveError={setSaveError}
              latestInvitation={latestInvitation}
              invitationLoading={invitationLoading}
              invitationError={invitationError}
              resendingInvitation={resendingInvitation}
              onResend={async () => {
                if (!latestInvitation?.invitationId || resendingInvitation) {
                  return;
                }
                setInvitationError(null);
                setResendingInvitation(true);
                try {
                  const resent = await resendUserInvitation(latestInvitation.invitationId);
                  setLatestInvitation(resent);
                } catch (e) {
                  setInvitationError(e instanceof Error ? e.message : 'Failed to resend invitation');
                } finally {
                  setResendingInvitation(false);
                }
              }}
              onSave={async (parishIds, defaultParishId) => {
                setSaveError(null);
                setSaving(true);
                const optimisticUser: UserParishAccessResponse = {
                  ...selectedUser,
                  parishAccessIds: parishIds,
                  defaultParishId: defaultParishId ?? null,
                };
                const prevUsers = [...users];
                setUsers((prev) =>
                  prev.map((u) => (u.userId === selectedUser.userId ? optimisticUser : u))
                );
                try {
                  const updated = await replaceUserParishAccess(selectedUser.userId, {
                    parishIds,
                    defaultParishId: defaultParishId ?? null,
                  });
                  setUsers((prev) =>
                    prev.map((u) => (u.userId === updated.userId ? updated : u))
                  );
                  setSelectedUserId(updated.userId);
                } catch (e) {
                  setUsers(prevUsers);
                  setSaveError(e instanceof Error ? e.message : 'Failed to save');
                } finally {
                  setSaving(false);
                }
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <p>Select a user to manage parish access.</p>
            </div>
          )}
        </section>
      </div>
    </AuthenticatedLayout>
  );
}

function UserParishAccessForm({
  user,
  dioceses,
  parishesByDiocese,
  allParishes,
  saving,
  saveError,
  onSaveError,
  latestInvitation,
  invitationLoading,
  invitationError,
  resendingInvitation,
  onResend,
  onSave,
}: {
  user: UserParishAccessResponse;
  dioceses: DioceseResponse[];
  parishesByDiocese: Record<number, ParishResponse[]>;
  allParishes: ParishResponse[];
  saving: boolean;
  saveError: string | null;
  onSaveError: (msg: string | null) => void;
  latestInvitation: IssueUserInvitationResponse | null;
  invitationLoading: boolean;
  invitationError: string | null;
  resendingInvitation: boolean;
  onResend: () => Promise<void>;
  onSave: (parishIds: number[], defaultParishId: number | null) => Promise<void>;
}) {
  const [parishIds, setParishIds] = useState<Set<number>>(
    () => new Set(user.parishAccessIds)
  );
  const [defaultParishId, setDefaultParishId] = useState<number | null>(
    user.defaultParishId
  );

  useEffect(() => {
    setParishIds(new Set(user.parishAccessIds));
    setDefaultParishId(user.defaultParishId);
  }, [user.userId, user.parishAccessIds, user.defaultParishId]);

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
    onSaveError(null);
  };

  const assignedParishes = allParishes.filter((p) => parishIds.has(p.id));
  const defaultMustBeAssigned =
    defaultParishId != null && !parishIds.has(defaultParishId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (defaultParishId != null && !parishIds.has(defaultParishId)) {
      onSaveError('Default parish must be one of the assigned parishes.');
      return;
    }
    await onSave(Array.from(parishIds), defaultParishId);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold text-sancta-maroon">
        {user.displayName || user.username}
      </h2>
      <p className="mt-0.5 text-sm text-gray-500">
        {user.username} · {user.role ?? '—'}
      </p>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-sm font-medium text-gray-800">Invitation</p>
        {invitationLoading ? (
          <p className="mt-1 text-sm text-gray-600">Loading invitation status…</p>
        ) : latestInvitation ? (
          <>
            <p className="mt-1 text-sm text-gray-700">
              Status: {latestInvitation.invitationStatus ?? 'UNKNOWN'} · Delivery: {latestInvitation.emailDeliveryStatus ?? 'UNKNOWN'}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              Email: {latestInvitation.invitedEmail || 'unknown recipient'}
            </p>
            {latestInvitation.deliveryMessage && (
              <p className="mt-1 text-xs text-gray-600">{latestInvitation.deliveryMessage}</p>
            )}
            {latestInvitation.lastEmailError && (
              <p className="mt-1 text-xs text-amber-700">Last error: {latestInvitation.lastEmailError}</p>
            )}
            <button
              type="button"
              onClick={() => {
                void onResend();
              }}
              disabled={resendingInvitation}
              className="mt-3 rounded-lg bg-sancta-maroon px-3 py-1.5 text-xs font-medium text-white hover:bg-sancta-maroon-dark disabled:opacity-50"
            >
              {resendingInvitation ? 'Resending…' : 'Resend invitation email'}
            </button>
          </>
        ) : (
          <p className="mt-1 text-sm text-gray-600">
            No invitation found for this user yet. Issue one from User Setup.
          </p>
        )}
        {invitationError && (
          <p role="alert" className="mt-2 text-sm text-red-600">{invitationError}</p>
        )}
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">
          Assigned parishes
        </label>
        <p className="mt-0.5 text-xs text-gray-500">
          Select parishes this user can access.
        </p>
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 p-2">
          {dioceses.length === 0 ? (
            <p className="text-sm text-gray-500">No parishes available.</p>
          ) : (
            dioceses.map((d) => (
              <div key={d.id} className="mb-3 last:mb-0">
                <p className="text-xs font-medium text-gray-500 mb-1">{d.name}</p>
                <ul className="space-y-1">
                  {(parishesByDiocese[d.id] ?? []).map((p) => (
                    <li key={p.id}>
                      <label className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-white/80">
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
            onSaveError(null);
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

      {saveError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {saveError}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || defaultMustBeAssigned}
        className="mt-4 rounded-lg bg-sancta-maroon px-4 py-2 text-white font-medium hover:bg-sancta-maroon-dark disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save parish access'}
      </button>
    </form>
  );
}
