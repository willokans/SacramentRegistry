'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { useParish } from '@/context/ParishContext';
import {
  getStoredUser,
  fetchDioceses,
  fetchParishes,
  fetchDiocesesWithParishes,
  fetchParishMarriageRequirements,
  patchParishMarriageRequirements,
  type DioceseResponse,
  type ParishResponse,
} from '@/lib/api';

function isAdminOrSuperAdmin(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export default function MarriageRequirementsSettingsPage() {
  const router = useRouter();
  const { parishId: contextParishId } = useParish();
  const [dioceses, setDioceses] = useState<DioceseResponse[]>([]);
  const [parishesByDiocese, setParishesByDiocese] = useState<Record<number, ParishResponse[]>>({});
  const [selectedParishId, setSelectedParishId] = useState<number | null>(null);
  const [parishSearch, setParishSearch] = useState('');
  const [requireConfirmation, setRequireConfirmation] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [loadingReq, setLoadingReq] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (user && !isAdminOrSuperAdmin(user.role)) {
      router.replace('/');
    }
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      try {
        const dioceseListWithParishes = await withTimeout(fetchDiocesesWithParishes(), 8000);
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
      } catch {
        // Staging safety: if the batched endpoint is missing/slow, fall back to legacy requests.
        const dioceseList = await fetchDioceses();
        const byDiocese: Record<number, ParishResponse[]> = {};
        await Promise.all(
          dioceseList.map(async (d) => {
            byDiocese[d.id] = await fetchParishes(d.id);
          }),
        );
        setDioceses(dioceseList);
        setParishesByDiocese(byDiocese);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    if (!isAdminOrSuperAdmin(user?.role)) return;
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedParishId == null) return;
    let cancelled = false;
    setLoadingReq(true);
    setSaveError(null);
    fetchParishMarriageRequirements(selectedParishId)
      .then((r) => {
        if (!cancelled) setRequireConfirmation(r.requireMarriageConfirmation);
      })
      .catch((e) => {
        if (!cancelled) setSaveError(e instanceof Error ? e.message : 'Failed to load requirements');
      })
      .finally(() => {
        if (!cancelled) setLoadingReq(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedParishId]);

  useEffect(() => {
    if (loading || selectedParishId != null || contextParishId == null) return;
    const ids = Object.values(parishesByDiocese)
      .flat()
      .map((p) => p.id);
    if (ids.includes(contextParishId)) {
      setSelectedParishId(contextParishId);
    }
  }, [loading, selectedParishId, contextParishId, parishesByDiocese]);

  const user = getStoredUser();
  if (user && !isAdminOrSuperAdmin(user.role)) {
    return (
      <AuthenticatedLayout>
        <p className="text-gray-600">Redirecting…</p>
      </AuthenticatedLayout>
    );
  }

  async function handleSave() {
    if (selectedParishId == null) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await patchParishMarriageRequirements(selectedParishId, requireConfirmation);
      setSaveSuccess(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const allParishes = Object.values(parishesByDiocese).flat();
  const parishOptions = dioceses.flatMap((d) => {
    const dioceseName = d.name ?? d.dioceseName ?? `Diocese ${d.id}`;
    return (parishesByDiocese[d.id] ?? []).map((p) => ({
      ...p,
      dioceseName,
    }));
  });
  const selectedParish = selectedParishId == null
    ? null
    : parishOptions.find((p) => p.id === selectedParishId) ?? null;
  const normalizedParishSearch = parishSearch.trim().toLowerCase();
  const filteredParishOptions = parishOptions
    .filter((p) => {
      if (!normalizedParishSearch) return true;
      return (
        p.parishName.toLowerCase().includes(normalizedParishSearch) ||
        p.dioceseName.toLowerCase().includes(normalizedParishSearch)
      );
    })
    .slice(0, 50);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <div>
          <Link
            href="/settings"
            prefetch={false}
            className="text-sm font-medium text-sancta-maroon hover:underline"
          >
            ← Administration
          </Link>
          <h1 className="mt-3 text-2xl font-serif font-semibold text-sancta-maroon">Marriage requirements</h1>
          <p className="mt-1 text-sm text-gray-500">
            Require Confirmation for Marriage Creation (per parish)
          </p>
        </div>
        <p className="text-sm text-gray-600">
          Only <strong>ADMIN</strong> and <strong>SUPER_ADMIN</strong> can change this. Priests and parish staff can
          still create marriages; this setting controls whether a Confirmation record must be linked for the parish.
        </p>

        {loading ? (
          <p className="text-gray-600">Loading…</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <>
            <div>
              <label htmlFor="parish-search" className="block text-sm font-medium text-gray-700">
                Parish
              </label>
              <input
                id="parish-search"
                type="search"
                value={parishSearch}
                onChange={(e) => setParishSearch(e.target.value)}
                placeholder="Search parish or diocese..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {filteredParishOptions.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">No parishes match your search.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {filteredParishOptions.map((p) => {
                      const isSelected = p.id === selectedParishId;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSaveSuccess(false);
                              setSelectedParishId(p.id);
                              setParishSearch(p.parishName);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                              isSelected ? 'bg-sancta-maroon/10 text-sancta-maroon font-medium' : 'text-gray-800'
                            }`}
                          >
                            <span className="block">{p.parishName}</span>
                            <span className="block text-xs text-gray-500">{p.dioceseName}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {selectedParish && (
                <p className="mt-2 text-xs text-gray-600">
                  Selected: <span className="font-medium">{selectedParish.parishName}</span> ({selectedParish.dioceseName})
                </p>
              )}
            </div>

            {selectedParishId != null && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
                {loadingReq ? (
                  <p className="text-sm text-gray-600">Loading current setting…</p>
                ) : (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-sancta-maroon focus:ring-sancta-maroon"
                      checked={requireConfirmation}
                      onChange={(e) => {
                        setSaveSuccess(false);
                        setRequireConfirmation(e.target.checked);
                      }}
                    />
                    <span className="text-sm text-gray-800">
                      <span className="font-semibold text-gray-900">
                        Require Confirmation for Marriage Creation
                      </span>
                      <span className="block mt-1">
                        When enabled, a Confirmation record must be linked for both parties when registering a marriage
                        for this parish.
                      </span>
                      <span className="block text-gray-600 mt-2 font-medium">
                        Always (checked or unchecked): both the groom and the bride must have{' '}
                        <strong>Baptism</strong> and <strong>Holy Communion</strong> documented to register a marriage.
                      </span>
                      <span className="block text-gray-500 mt-2">
                        <strong>If checked:</strong> both must also have <strong>Confirmation</strong> documented
                        (in-parish record and/or certificate if confirmed elsewhere) before the marriage can be
                        registered. At least one in-parish Confirmation record is needed to link the marriage in the
                        parish sacramental chain.
                      </span>
                      <span className="block text-gray-500 mt-2">
                        <strong>If unchecked:</strong> Confirmation is <strong>not</strong> required—Baptism and Holy
                        Communion for both parties are still required.
                      </span>
                    </span>
                  </label>
                )}
                {saveError && <p className="text-sm text-red-600">{saveError}</p>}
                {saveSuccess && !saveError && (
                  <p className="text-sm text-green-700" role="status">
                    Saved. New marriage records for this parish will use this rule.
                  </p>
                )}
                <button
                  type="button"
                  disabled={saving || loadingReq}
                  onClick={handleSave}
                  className="rounded-lg bg-sancta-maroon px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}

            {allParishes.length === 0 && !loading && (
              <p className="text-sm text-gray-600">No parishes found. Create dioceses and parishes first.</p>
            )}
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), timeoutMs),
    ),
  ]);
}
