'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { getStoredToken, getStoredUser } from '@/lib/api';
import { canSeeDioceseDashboard } from '@/lib/appRoles';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import { useParish } from '@/context/ParishContext';
import { getChurchBranding } from '@/lib/church-branding';
import { fetchDashboard, type BaptismResponse, type FirstHolyCommunionResponse, type ConfirmationResponse, type MarriageResponse } from '@/lib/api';
import { sameNumericId } from '@/lib/sameNumericId';

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

const SACRAMENT_CARD_CONFIG = [
  {
    icon: '💧',
    title: 'Baptisms',
    countKey: 'baptisms' as const,
    path: '/baptisms/new',
    ctaLabel: 'Register Baptism',
    guidance: 'Start by registering your first baptism',
    buttonClass: 'bg-sancta-maroon hover:bg-sancta-maroon-dark',
  },
  {
    icon: '🍞',
    title: 'Holy Communion',
    countKey: 'communions' as const,
    path: '/communions/new',
    ctaLabel: 'Register Holy Communion',
    guidance: 'Start by registering your first communion',
    buttonClass: 'bg-purple-700 hover:bg-purple-800',
  },
  {
    icon: '✝',
    title: 'Confirmations',
    countKey: 'confirmations' as const,
    path: '/confirmations/new',
    ctaLabel: 'Register Confirmation',
    guidance: 'Start by registering your first confirmation',
    buttonClass: 'bg-indigo-700 hover:bg-indigo-800',
  },
  {
    icon: '💒',
    title: 'Marriages',
    countKey: 'marriages' as const,
    path: '/marriages/new',
    ctaLabel: 'Register Marriage',
    guidance: 'Start by registering your first marriage',
    buttonClass: 'bg-amber-700 hover:bg-amber-800',
  },
] as const;

type RecentItem = {
  type: 'baptism' | 'communion' | 'confirmation' | 'marriage';
  label: string;
  date: string;
  id: number;
  href: string;
};

function useDashboardData(parishId: number | null) {
  const { data, error: swrError, isLoading } = useSWR(
    parishId ? ['dashboard', parishId] : null,
    parishId ? () => fetchDashboard(parishId) : null,
    DASHBOARD_SWR_OPTIONS
  );

  const baptisms = data?.baptisms ?? [];
  const communions = data?.communions ?? [];
  const confirmations = data?.confirmations ?? [];
  const marriages = data?.marriages ?? [];
  const counts = data?.counts
    ? {
        baptisms: Number(data.counts.baptisms ?? 0),
        communions: Number(data.counts.communions ?? 0),
        confirmations: Number(data.counts.confirmations ?? 0),
        marriages: Number(data.counts.marriages ?? 0),
      }
    : { baptisms: 0, communions: 0, confirmations: 0, marriages: 0 };
  const loading = isLoading;
  const error = swrError ? (swrError instanceof Error ? swrError.message : 'Failed to load dashboard') : null;

  const recentItems: RecentItem[] = [];
  [...baptisms]
    .sort((a, b) => b.id - a.id)
    .slice(0, 15)
    .forEach((r) => {
      recentItems.push({
        type: 'baptism',
        label: `${r.baptismName} ${r.otherNames ? r.otherNames + ' ' : ''}${r.surname}`.trim(),
        date: r.dateOfBirth,
        id: r.id,
        href: `/baptisms/${r.id}`,
      });
    });
  communions.slice(0, 15).forEach((r) => {
    recentItems.push({
      type: 'communion',
      label: 'Holy Communion',
      date: r.communionDate,
      id: r.id,
      href: `/communions/${r.id}`,
    });
  });
  confirmations.slice(0, 15).forEach((r) => {
    recentItems.push({
      type: 'confirmation',
      label: 'Confirmation',
      date: r.confirmationDate,
      id: r.id,
      href: `/confirmations/${r.id}`,
    });
  });
  marriages.slice(0, 15).forEach((r) => {
    recentItems.push({
      type: 'marriage',
      label: r.partnersName,
      date: r.marriageDate,
      id: r.id,
      href: `/marriages/${r.id}`,
    });
  });
  recentItems.sort((a, b) => b.date.localeCompare(a.date));
  const recent = recentItems.slice(0, 8);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthly = {
    baptisms: new Array(12).fill(0),
    communions: new Array(12).fill(0),
    confirmations: new Array(12).fill(0),
    marriages: new Array(12).fill(0),
  };
  const getMonthIndex = (primaryDate?: string, fallbackDate?: string): number | null => {
    const source = primaryDate || fallbackDate;
    if (!source) return null;
    const isoLike = source.match(/^(\d{4})-(\d{2})/);
    if (isoLike) {
      const month = Number.parseInt(isoLike[2], 10) - 1;
      return month >= 0 && month < 12 ? month : null;
    }
    const d = new Date(source);
    if (Number.isNaN(d.getTime())) return null;
    const month = d.getMonth();
    return month >= 0 && month < 12 ? month : null;
  };

  baptisms.forEach((r) => {
    const m = getMonthIndex(r.createdAt, r.dateOfBirth);
    if (m !== null) monthly.baptisms[m]++;
  });
  confirmations.forEach((r) => {
    const m = getMonthIndex(r.createdAt, r.confirmationDate);
    if (m !== null) monthly.confirmations[m]++;
  });
  communions.forEach((r) => {
    const m = getMonthIndex(r.createdAt, r.communionDate);
    if (m !== null) monthly.communions[m]++;
  });
  marriages.forEach((r) => {
    const m = getMonthIndex(r.createdAt, r.marriageDate);
    if (m !== null) monthly.marriages[m]++;
  });
  const maxBar = Math.max(1, ...monthly.baptisms, ...monthly.communions, ...monthly.confirmations, ...monthly.marriages);

  return {
    counts,
    recent,
    monthly: {
      baptisms: monthly.baptisms,
      communions: monthly.communions,
      confirmations: monthly.confirmations,
      marriages: monthly.marriages,
    },
    monthNames,
    maxBar,
    loading,
    error,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const user = getStoredUser();
  const { parishId, dioceseId, parishes } = useParish();
  const effectiveParishId =
    parishId != null && parishes.some((p) => sameNumericId(p.id, parishId)) ? parishId : null;

  const dioceseDashboardViewer = canSeeDioceseDashboard(user?.role);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !user) {
      router.replace('/login');
    }
  }, [router, user]);

  const { counts, recent, monthly, monthNames, maxBar, loading, error } = useDashboardData(effectiveParishId);

  const parish =
    effectiveParishId != null
      ? parishes.find((p) => sameNumericId(p.id, effectiveParishId))
      : undefined;
  const parishName = parish?.parishName ?? null;
  const churchBranding = getChurchBranding(parishName);
  const welcomeTitle = churchBranding?.appTitle ?? (parishName ? `${parishName} Sacrament Registry` : null);
  const greeting = getGreeting();
  const displayName = user?.displayName || user?.username || '…';

  return (
    <AuthenticatedLayout>
      <div className="space-y-4">
        {/* Welcome + Year */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-semibold text-sancta-maroon">
              {greeting}, {displayName}
            </h1>
            <p className="mt-1 text-gray-600">
              {welcomeTitle
                ? `Welcome to ${welcomeTitle}`
                : dioceseDashboardViewer && dioceseId == null
                  ? 'Select a diocese in the sidebar to view the diocesan dashboard'
                  : 'Select a parish in the sidebar'}
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

        {effectiveParishId && loading && <DashboardSkeleton />}

        {dioceseDashboardViewer && dioceseId == null && effectiveParishId == null && !loading && (
          <p className="text-gray-600">Select a diocese in the sidebar to view the diocesan dashboard.</p>
        )}

        {effectiveParishId && !loading && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {SACRAMENT_CARD_CONFIG.map(({ icon, title, countKey, path, ctaLabel, guidance, buttonClass }) => {
                const count = counts[countKey];
                const href = `${path}?parishId=${effectiveParishId}`;
                const isPrimaryKpi = countKey === 'baptisms';
                return (
                  <div
                    key={countKey}
                    className={
                      isPrimaryKpi
                        ? 'rounded-xl border border-sancta-maroon/35 bg-white p-4 shadow-md ring-1 ring-sancta-maroon/15'
                        : 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm'
                    }
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
                    {count === 0 && (
                      <>
                        <p className="mt-1 text-sm text-gray-600">{guidance}</p>
                        <Link
                          href={href}
                          className={`mt-3 inline-block rounded-lg px-3 py-2 text-sm font-medium text-white ${buttonClass}`}
                        >
                          {ctaLabel}
                        </Link>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Actions — single primary CTA; other registrations are secondary */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Quick Actions</h2>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/baptisms/new?parishId=${effectiveParishId}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-sancta-maroon px-4 py-3 text-white font-medium shadow-sm hover:bg-sancta-maroon-dark min-h-[44px]"
                >
                  <span aria-hidden>💧</span>
                  Register Baptism
                </Link>
                <Link
                  href={`/communions/new?parishId=${effectiveParishId}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 min-h-[44px]"
                >
                  <span aria-hidden>🍞</span>
                  Register Holy Communion
                </Link>
                <Link
                  href={`/confirmations/new?parishId=${effectiveParishId}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 min-h-[44px]"
                >
                  <span aria-hidden>✝</span>
                  Register Confirmation
                </Link>
                <Link
                  href={`/marriages/new?parishId=${effectiveParishId}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 min-h-[44px]"
                >
                  <span aria-hidden>💍</span>
                  Register Marriage
                </Link>
                <Link
                  href="/baptisms"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 min-h-[44px]"
                >
                  Sacramental Register
                </Link>
              </div>
            </div>

            {/* Sacraments overview grouped (clustered) bar chart */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Sacraments overview by month</h2>
              <p className="text-xs text-gray-500 mb-2">All records grouped by month of creation</p>
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

            {/* Sacraments overview + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">Latest sacramental register entries</h2>
                {recent.length === 0 ? (
                  <p className="text-sm text-gray-500">No recent records yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {recent.slice(0, 5).map((item) => (
                      <li key={`${item.type}-${item.id}`}>
                        <Link
                          href={item.href}
                          className="flex items-center gap-2 rounded-lg py-2 px-2 -mx-2 hover:bg-gray-50 text-gray-800"
                        >
                          <span className="text-sancta-gold font-medium capitalize">{item.type}</span>
                          <span className="truncate">{item.label}</span>
                          <span className="text-xs text-gray-500 ml-auto shrink-0">{item.date}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-800">Recent Activity</h2>
                  <Link href="/baptisms" className="text-sm text-sancta-maroon hover:underline">
                    View all
                  </Link>
                </div>
                {recent.length === 0 ? (
                  <p className="text-sm text-gray-500">No recent activity.</p>
                ) : (
                  <ul className="space-y-3">
                    {recent.slice(0, 5).map((item) => (
                      <li key={`activity-${item.type}-${item.id}`} className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-sancta-maroon/10 flex items-center justify-center text-sancta-maroon text-xs font-medium shrink-0">
                          {item.type.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link href={item.href} className="font-medium text-gray-800 hover:text-sancta-maroon truncate block">
                            {item.label}
                          </Link>
                          <p className="text-xs text-gray-500">{item.date}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}

        {!effectiveParishId && parishes.length === 0 && !loading && (
          <p className="text-gray-600">Add a diocese and parish to see the dashboard (admin only).</p>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
