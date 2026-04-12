'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { getStoredToken, getStoredUser, fetchDioceseDashboard } from '@/lib/api';
import { canSeeDioceseDashboard } from '@/lib/appRoles';
import type { DioceseParishActivityItem } from '@/lib/api';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import { useParish } from '@/context/ParishContext';

const DASHBOARD_SWR_OPTIONS = {
  revalidateOnFocus: false,
  dedupingInterval: 60_000,
  revalidateOnReconnect: true,
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const currentYear = new Date().getFullYear();
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DIOCESE_STAT_CONFIG = [
  { icon: '🏛️', title: 'Parishes', countKey: 'parishes' as const },
  { icon: '💧', title: 'Baptisms', countKey: 'baptisms' as const },
  { icon: '🍞', title: 'Holy Communion', countKey: 'communions' as const },
  { icon: '✝', title: 'Confirmations', countKey: 'confirmations' as const },
  { icon: '💒', title: 'Marriages', countKey: 'marriages' as const },
  { icon: '⛪', title: 'Holy Orders', countKey: 'holyOrders' as const },
] as const;

type ParishSortKey = 'parishName' | 'baptisms' | 'communions' | 'confirmations' | 'marriages';

function sortParishActivity(
  rows: DioceseParishActivityItem[],
  sortKey: ParishSortKey,
  sortAsc: boolean
): DioceseParishActivityItem[] {
  const sorted = [...rows].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const aNum = Number(aVal ?? 0);
    const bNum = Number(bVal ?? 0);
    return sortAsc ? aNum - bNum : bNum - aNum;
  });
  return sorted;
}

export default function DioceseDashboardPage() {
  const router = useRouter();
  const user = getStoredUser();
  const { dioceseId, dioceses } = useParish();

  const mayUseDioceseDashboard = canSeeDioceseDashboard(user?.role);

  const { data, error: swrError, isLoading } = useSWR(
    dioceseId && mayUseDioceseDashboard ? ['diocese-dashboard', dioceseId] : null,
    dioceseId && mayUseDioceseDashboard ? () => fetchDioceseDashboard(dioceseId) : null,
    DASHBOARD_SWR_OPTIONS
  );

  const counts = data?.counts ?? {
    parishes: 0,
    baptisms: 0,
    communions: 0,
    confirmations: 0,
    marriages: 0,
    holyOrders: 0,
  };
  const parishActivity = useMemo(() => data?.parishActivity ?? [], [data?.parishActivity]);
  const recentSacraments = data?.recentSacraments ?? {
    baptisms: [],
    communions: [],
    confirmations: [],
    marriages: [],
  };
  const monthly = data?.monthly ?? {
    baptisms: new Array(12).fill(0),
    communions: new Array(12).fill(0),
    confirmations: new Array(12).fill(0),
    marriages: new Array(12).fill(0),
  };

  const [parishSortKey, setParishSortKey] = useState<ParishSortKey>('parishName');
  const [parishSortAsc, setParishSortAsc] = useState(true);

  const diocese = dioceseId != null ? dioceses.find((d) => d.id === dioceseId) : undefined;
  const dioceseName = diocese ? diocese.dioceseName : null;
  const greeting = getGreeting();
  const displayName = user?.displayName || user?.username || '…';
  const loading = isLoading;
  const error = swrError ? (swrError instanceof Error ? swrError.message : 'Failed to load diocese dashboard') : null;

  const sortedParishActivity = useMemo(
    () => sortParishActivity(parishActivity, parishSortKey, parishSortAsc),
    [parishActivity, parishSortKey, parishSortAsc]
  );

  function handleParishSort(key: ParishSortKey) {
    setParishSortKey(key);
    setParishSortAsc((prev) => (parishSortKey === key ? !prev : true));
  }

  const recentItems: { type: string; label: string; date: string; id: number; href: string; parish?: string }[] = [];
  [...(recentSacraments.baptisms ?? [])]
    .sort((a, b) => b.id - a.id)
    .slice(0, 15)
    .forEach((r) => {
      recentItems.push({
        type: 'baptism',
        label: `${r.baptismName} ${r.otherNames ? r.otherNames + ' ' : ''}${r.surname}`.trim(),
        date: r.dateOfBirth,
        id: r.id,
        href: `/baptisms/${r.id}`,
        parish: r.parishName,
      });
    });
  (recentSacraments.communions ?? []).slice(0, 15).forEach((r) => {
    recentItems.push({
      type: 'communion',
      label: 'Holy Communion',
      date: r.communionDate,
      id: r.id,
      href: `/communions/${r.id}`,
      parish: r.parish,
    });
  });
  (recentSacraments.confirmations ?? []).slice(0, 15).forEach((r) => {
    recentItems.push({
      type: 'confirmation',
      label: 'Confirmation',
      date: r.confirmationDate,
      id: r.id,
      href: `/confirmations/${r.id}`,
      parish: r.parish,
    });
  });
  (recentSacraments.marriages ?? []).slice(0, 15).forEach((r) => {
    recentItems.push({
      type: 'marriage',
      label: r.partnersName,
      date: r.marriageDate,
      id: r.id,
      href: `/marriages/${r.id}`,
      parish: r.parish,
    });
  });
  recentItems.sort((a, b) => b.date.localeCompare(a.date));
  const recent = recentItems.slice(0, 8);

  const maxBar = Math.max(1, ...monthly.baptisms, ...monthly.communions, ...monthly.confirmations, ...monthly.marriages);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !user) {
      router.replace('/login');
    } else if (!mayUseDioceseDashboard) {
      router.replace('/dashboard');
    }
  }, [router, user, mayUseDioceseDashboard]);

  if (user && !mayUseDioceseDashboard) {
    return (
      <AuthenticatedLayout>
        <p className="text-gray-600">Redirecting…</p>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-semibold text-sancta-maroon">
              {greeting}, {displayName}
            </h1>
            <p className="mt-1 text-gray-600">
              {dioceseName ? `Welcome to ${dioceseName} Dashboard` : 'Select a diocese in the sidebar'}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            <span>Year {currentYear}</span>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {dioceseId && loading && <DashboardSkeleton />}

        {dioceseId && !loading && !error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {DIOCESE_STAT_CONFIG.map(({ icon, title, countKey }) => {
                const count = Number(counts[countKey] ?? 0);
                return (
                  <div
                    key={countKey}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="text-2xl" aria-hidden>
                        {icon}
                      </span>
                      <span className="font-medium">{title}</span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-sancta-maroon">
                      {count} records
                    </p>
                  </div>
                );
              })}
            </div>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Parish Activity</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">
                        <button
                          type="button"
                          onClick={() => handleParishSort('parishName')}
                          className="hover:text-sancta-maroon focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 rounded px-1 -ml-1"
                        >
                          Parish {parishSortKey === 'parishName' && (parishSortAsc ? '↑' : '↓')}
                        </button>
                      </th>
                      <th className="text-right py-2 px-3 font-medium text-gray-700">
                        <button
                          type="button"
                          onClick={() => handleParishSort('baptisms')}
                          className="hover:text-sancta-maroon focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 rounded px-1 -mr-1"
                        >
                          Baptisms {parishSortKey === 'baptisms' && (parishSortAsc ? '↑' : '↓')}
                        </button>
                      </th>
                      <th className="text-right py-2 px-3 font-medium text-gray-700">
                        <button
                          type="button"
                          onClick={() => handleParishSort('communions')}
                          className="hover:text-sancta-maroon focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 rounded px-1 -mr-1"
                        >
                          Communion {parishSortKey === 'communions' && (parishSortAsc ? '↑' : '↓')}
                        </button>
                      </th>
                      <th className="text-right py-2 px-3 font-medium text-gray-700">
                        <button
                          type="button"
                          onClick={() => handleParishSort('confirmations')}
                          className="hover:text-sancta-maroon focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 rounded px-1 -mr-1"
                        >
                          Confirmations {parishSortKey === 'confirmations' && (parishSortAsc ? '↑' : '↓')}
                        </button>
                      </th>
                      <th className="text-right py-2 px-3 font-medium text-gray-700">
                        <button
                          type="button"
                          onClick={() => handleParishSort('marriages')}
                          className="hover:text-sancta-maroon focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 rounded px-1 -mr-1"
                        >
                          Marriages {parishSortKey === 'marriages' && (parishSortAsc ? '↑' : '↓')}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedParishActivity.map((row) => (
                      <tr key={row.parishId} className="border-b border-gray-100">
                        <td className="py-2 px-3">
                          <Link
                            href={`/dashboard?parishId=${row.parishId}`}
                            className="text-sancta-maroon hover:underline font-medium"
                          >
                            {row.parishName}
                          </Link>
                        </td>
                        <td className="text-right py-2 px-3">{row.baptisms}</td>
                        <td className="text-right py-2 px-3">{row.communions}</td>
                        <td className="text-right py-2 px-3">{row.confirmations}</td>
                        <td className="text-right py-2 px-3">{row.marriages}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Sacraments by month</h2>
              <p className="text-xs text-gray-500 mb-3">Diocese-wide totals</p>
              <div className="w-full overflow-x-auto pb-1">
                <div className="flex items-end gap-2 h-56 w-full min-w-0 border-b border-gray-100">
                  {monthNames.map((name, i) => (
                    <div key={name} className="flex-1 min-w-[2rem] h-full flex flex-col items-center justify-end gap-1">
                      <div className="w-full h-44 flex gap-0.5 items-end justify-center">
                        <div
                          className="w-full rounded-t bg-sancta-maroon"
                          style={{ height: monthly.baptisms[i] > 0 ? `${Math.max(6, (monthly.baptisms[i] / maxBar) * 100)}%` : '0%' }}
                          title={`Baptisms: ${monthly.baptisms[i]}`}
                        />
                        <div
                          className="w-full rounded-t bg-indigo-600"
                          style={{ height: monthly.confirmations[i] > 0 ? `${Math.max(6, (monthly.confirmations[i] / maxBar) * 100)}%` : '0%' }}
                          title={`Confirmations: ${monthly.confirmations[i]}`}
                        />
                        <div
                          className="w-full rounded-t bg-purple-700"
                          style={{ height: monthly.communions[i] > 0 ? `${Math.max(6, (monthly.communions[i] / maxBar) * 100)}%` : '0%' }}
                          title={`Holy Communion: ${monthly.communions[i]}`}
                        />
                        <div
                          className="w-full rounded-t bg-amber-700"
                          style={{ height: monthly.marriages[i] > 0 ? `${Math.max(6, (monthly.marriages[i] / maxBar) * 100)}%` : '0%' }}
                          title={`Marriages: ${monthly.marriages[i]}`}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-gray-100">
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <span className="w-3 h-3 rounded bg-sancta-maroon" /> Baptisms
                </span>
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <span className="w-3 h-3 rounded bg-indigo-600" /> Confirmations
                </span>
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <span className="w-3 h-3 rounded bg-purple-700" /> Holy Communion
                </span>
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <span className="w-3 h-3 rounded bg-amber-700" /> Marriages
                </span>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Latest diocesan records</h2>
              {recent.length === 0 ? (
                <p className="text-sm text-gray-500">No recent records yet.</p>
              ) : (
                <ul className="space-y-2">
                  {recent.slice(0, 8).map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-2 rounded-lg py-2 px-2 -mx-2 hover:bg-gray-50 text-gray-800"
                      >
                        <span className="text-sancta-gold font-medium capitalize shrink-0">{item.type}</span>
                        <span className="truncate min-w-0">{item.label}</span>
                        {item.parish && (
                          <span className="text-xs text-gray-500 truncate max-w-[120px]" title={item.parish}>
                            {item.parish}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 shrink-0 ml-auto">{item.date}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {!dioceseId && !loading && (
          <p className="text-gray-600">Select a diocese in the sidebar to view the diocesan dashboard.</p>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
