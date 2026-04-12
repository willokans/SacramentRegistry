'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getStoredToken, getStoredUser, clearAuth } from '@/lib/api';
import { sameNumericId } from '@/lib/sameNumericId';
import { canSeeDioceseDashboard, normalizeAppRole } from '@/lib/appRoles';
import { useParish } from '@/context/ParishContext';
import { getChurchBranding } from '@/lib/church-branding';
import { useNetworkStatus } from '@/lib/offline/network';
import { useOfflineQueueReplayer } from '@/lib/offline/useOfflineQueueReplayer';
import {
  UNSPECIFIED_COUNTRY_KEY,
  countryFilterLabelForKey,
  dioceseSidebarCountryKey,
} from '@/lib/sidebarCountryFilter';
import RetryFailedSubmissionsBanner from '@/components/offline/RetryFailedSubmissionsBanner';
import OfflineStorageHygieneBanner from '@/components/offline/OfflineStorageHygieneBanner';
import ConflictResolutionDialog from '@/components/offline/ConflictResolutionDialog';

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 32" fill="currentColor" aria-hidden>
      <path d="M9 0L15 0 14 4 14 11 20 11 22 12 22 14 20 15 14 15 14 28 15 32 9 32 10 28 10 15 4 15 2 14 2 12 4 11 10 11 10 4z" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M3 12h18M3 6h18M3 18h18" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function HelpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

const trustLegalFooterLinkClass =
  'text-sm text-gray-600 underline-offset-2 decoration-transparent transition-colors duration-150 hover:text-sancta-maroon hover:underline hover:decoration-sancta-maroon/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sancta-maroon/25 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 rounded-sm';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {
    parishId,
    setParishId,
    dioceseId,
    setDioceseId,
    sidebarCountryKey,
    setSidebarCountryKey,
    parishes = [],
    dioceses = [],
    loading: parishLoading,
    error: parishError,
    refetch,
  } = useParish();

  const { isOnline } = useNetworkStatus();
  useOfflineQueueReplayer();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mounted) return;
    const token = getStoredToken();
    const user = getStoredUser();
    if (!token || !user) {
      router.push('/login');
    }
  }, [mounted, router]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const countryOptions = useMemo(() => {
    const byKey = new Map<string, (typeof dioceses)[0]>();
    for (const d of dioceses) {
      if (d == null || typeof d !== 'object') continue;
      try {
        const key = dioceseSidebarCountryKey(d);
        if (!byKey.has(key)) byKey.set(key, d);
      } catch {
        /* ignore malformed row */
      }
    }
    const opts = Array.from(byKey.entries(), ([key, sample]) => ({
      key,
      label: countryFilterLabelForKey(key, sample),
    })).sort((a, b) => {
        const byLabel = a.label.localeCompare(b.label, 'en', { sensitivity: 'base', numeric: true });
        if (byLabel !== 0) return byLabel;
        return a.key.localeCompare(b.key, 'en');
      });
    if (opts.length === 0 && dioceses.length > 0) {
      return [{ key: UNSPECIFIED_COUNTRY_KEY, label: 'Unspecified' }];
    }
    return opts;
  }, [dioceses]);

  const diocesesForSelect = useMemo(() => {
    const list =
      sidebarCountryKey == null
        ? dioceses
        : dioceses.filter((d) => dioceseSidebarCountryKey(d) === sidebarCountryKey);
    return [...list].sort((a, b) => {
      const nameA = (a.dioceseName ?? '').trim();
      const nameB = (b.dioceseName ?? '').trim();
      const byName = nameA.localeCompare(nameB, 'en', { sensitivity: 'base', numeric: true });
      if (byName !== 0) return byName;
      return Number(a.id) - Number(b.id);
    });
  }, [dioceses, sidebarCountryKey]);

  /** Avoid invalid controlled value (no matching option) which shows as an empty Country field. */
  const countrySelectValue = useMemo(() => {
    if (sidebarCountryKey == null) return '';
    return countryOptions.some((o) => o.key === sidebarCountryKey) ? sidebarCountryKey : '';
  }, [sidebarCountryKey, countryOptions]);

  function handleLogout() {
    clearAuth();
    router.push('/');
  }

  if (!mounted) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </main>
    );
  }

  const token = getStoredToken();
  const user = getStoredUser();
  if (!token || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Redirecting to login…</p>
      </main>
    );
  }

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const role = normalizeAppRole(user.role);
  const isAdmin = role === 'ADMIN';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isDioceseAdmin = role === 'DIOCESE_ADMIN';
  const isDioceseDashboardViewer = canSeeDioceseDashboard(user.role);
  const showsDioceseParishSelectors = isAdmin || isSuperAdmin || isDioceseAdmin;

  const currentParish =
    parishId != null ? parishes.find((p) => sameNumericId(p.id, parishId)) : undefined;
  const churchBranding = getChurchBranding(currentParish?.parishName);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-sancta-beige">
      {!isOnline && (
        <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-900 text-sm">
          You are offline. New submissions will be saved locally and synced automatically when you are back online.
        </div>
      )}
      <OfflineStorageHygieneBanner />
      <RetryFailedSubmissionsBanner />
      <ConflictResolutionDialog />
      {/* Mobile header with hamburger */}
      <header className="md:hidden flex items-center justify-between gap-2 py-3 px-4 border-b border-gray-200 bg-white/80">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Open menu"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CrossIcon className="w-8 h-8 text-sancta-gold shrink-0" />
            <span className="font-serif font-semibold text-sancta-maroon text-xl">
              Sacrament Registry
            </span>
          </div>
          {churchBranding ? (
            <div className="mt-1 w-[180px] h-11 flex items-center">
              <Image
                src={churchBranding.logoPath}
                alt={churchBranding.logoAlt}
                width={180}
                height={44}
                className="object-contain w-full h-full"
                priority
              />
            </div>
          ) : parishes.length > 0 && parishId != null ? (
            <span className="text-sm text-gray-500 mt-0.5 truncate">
              {currentParish?.parishName ?? 'Select parish'}
            </span>
          ) : null}
        </div>
        <div className="w-12" aria-hidden />
      </header>

      {/* Mobile menu overlay and drawer */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            aria-hidden
            onClick={closeMobileMenu}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col border-r border-gray-200 bg-white shadow-xl md:hidden overflow-y-auto"
            aria-label="Main navigation"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <CrossIcon className="w-8 h-8 text-sancta-gold shrink-0" />
                  <span className="font-serif font-semibold text-sancta-maroon text-lg">Sacrament Registry</span>
                </div>
                {churchBranding && (
                  <div className="mt-1 w-[180px] h-11 flex items-center">
                    <Image
                      src={churchBranding.logoPath}
                      alt={churchBranding.logoAlt}
                      width={180}
                      height={44}
                      className="object-contain w-full h-full"
                      priority
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-sancta-maroon/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close menu"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            {!parishLoading && (
              <div className="p-4 border-b border-gray-100 space-y-4">
                {showsDioceseParishSelectors && dioceses.length > 0 && (
                  <>
                    <div>
                      <label htmlFor="country-select-mobile" className="block text-xs font-medium text-gray-500 mb-1">
                        Country
                      </label>
                      <select
                        id="country-select-mobile"
                        value={countrySelectValue}
                        onChange={(e) =>
                          setSidebarCountryKey(e.target.value === '' ? null : e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
                      >
                        <option value="">All countries</option>
                        {countryOptions.map(({ key, label }) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="diocese-select-mobile" className="block text-xs font-medium text-gray-500 mb-1">
                        Diocese
                      </label>
                      <select
                        id="diocese-select-mobile"
                        value={dioceseId ?? ''}
                        onChange={(e) => setDioceseId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
                      >
                        <option value="">All dioceses</option>
                        {diocesesForSelect.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.dioceseName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label htmlFor="parish-select-mobile" className="block text-xs font-medium text-gray-500 mb-1">
                    Parish
                  </label>
                {parishes.length > 0 ? (
                  <select
                    id="parish-select-mobile"
                    value={parishId ?? ''}
                    onChange={(e) => {
                      setParishId(e.target.value ? Number(e.target.value) : null);
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
                  >
                    {parishes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.parishName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500 mb-1">
                    {showsDioceseParishSelectors ? 'No parish selected' : 'No parish assigned. Contact admin.'}
                  </p>
                )}
                {showsDioceseParishSelectors && (
                  <Link
                    href="/parishes"
                    prefetch={false}
                    onClick={closeMobileMenu}
                    className="text-xs text-sancta-maroon hover:underline mt-1 inline-block"
                  >
                    Directory Management
                  </Link>
                )}
                {parishError && (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                    <p className="text-xs text-amber-900">{parishError}</p>
                    <button
                      type="button"
                      onClick={refetch}
                      className="mt-1 text-xs font-medium text-sancta-maroon hover:underline"
                    >
                      Retry loading parishes
                    </button>
                  </div>
                )}
                </div>
              </div>
            )}
            <nav className="flex-1 p-4" aria-label="Main">
              <ul className="space-y-1">
                {[
                  ...(isDioceseDashboardViewer ? [{ href: '/dashboard/diocese', label: 'Diocese Dashboard' }] : []),
                  { href: '/dashboard', label: 'Parish Dashboard' },
                  ...(isAdmin || isSuperAdmin
                    ? [{ href: '/settings', label: 'Administration' }]
                    : []),
                  { href: '/baptisms', label: 'Baptisms' },
                  { href: '/communions', label: 'Holy Communion' },
                  { href: '/confirmations', label: 'Confirmation' },
                  { href: '/marriages', label: 'Marriage' },
                  { href: '/holy-orders', label: 'Holy Order' },
                  { href: '/offline-outbox', label: 'Pending Sync' },
                ].map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      prefetch={false}
                      onClick={closeMobileMenu}
                      className="block px-3 py-3 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10 min-h-[44px] flex items-center"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
                <li className="mt-2 pt-2 border-t border-gray-100">
                  <Link
                    href="/help"
                    prefetch={false}
                    onClick={closeMobileMenu}
                    className="block px-3 py-3 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10 min-h-[44px] flex items-center gap-2"
                  >
                    <HelpIcon className="w-5 h-5 shrink-0" />
                    Help
                  </Link>
                </li>
              </ul>
            </nav>
            <div className="p-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">{user.displayName || user.username}</p>
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  handleLogout();
                }}
                className="w-full text-left px-3 py-3 rounded-lg text-gray-600 hover:bg-gray-100 text-sm min-h-[44px] flex items-center"
              >
                Sign out
              </button>
            </div>
          </aside>
        </>
      )}

      <aside className="hidden md:flex md:flex-col md:w-56 md:border-r md:border-gray-200 md:bg-white/80 md:py-6 md:px-4">
        <div className="mb-4 px-2">
          <div className="flex items-center gap-2">
            <CrossIcon className="w-8 h-8 text-sancta-gold shrink-0" />
            <span className="font-serif font-semibold text-sancta-maroon text-lg">
              Sacrament Registry
            </span>
          </div>
          {churchBranding && (
            <div className="mt-2 w-[180px] h-11 flex items-center">
              <Image
                src={churchBranding.logoPath}
                alt={churchBranding.logoAlt}
                width={180}
                height={44}
                className="object-contain w-full h-full"
                priority
              />
            </div>
          )}
        </div>
        {!parishLoading && (
          <div className="mb-4 px-2 space-y-4">
            {showsDioceseParishSelectors && dioceses.length > 0 && (
              <>
                <div>
                  <label htmlFor="country-select" className="block text-xs font-medium text-gray-500 mb-1">
                    Country
                  </label>
                  <select
                    id="country-select"
                    value={countrySelectValue}
                    onChange={(e) =>
                      setSidebarCountryKey(e.target.value === '' ? null : e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
                  >
                    <option value="">All countries</option>
                    {countryOptions.map(({ key, label }) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="diocese-select" className="block text-xs font-medium text-gray-500 mb-1">
                    Diocese
                  </label>
                  <select
                    id="diocese-select"
                    value={dioceseId ?? ''}
                    onChange={(e) => setDioceseId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
                  >
                    <option value="">All dioceses</option>
                    {diocesesForSelect.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.dioceseName}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label htmlFor="parish-select" className="block text-xs font-medium text-gray-500 mb-1">
                Parish
              </label>
            {parishes.length > 0 ? (
              <select
                id="parish-select"
                value={parishId ?? ''}
                onChange={(e) => setParishId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
              >
                {parishes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.parishName}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-500 mb-1">
                {showsDioceseParishSelectors ? 'No parish selected' : 'No parish assigned. Contact admin.'}
              </p>
            )}
            {showsDioceseParishSelectors && (
              <Link
                href="/parishes"
                className="text-xs text-sancta-maroon hover:underline"
              >
                Directory Management
              </Link>
            )}
            {parishError && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                <p className="text-xs text-amber-900">{parishError}</p>
                <button
                  type="button"
                  onClick={refetch}
                  className="mt-1 text-xs font-medium text-sancta-maroon hover:underline"
                >
                  Retry loading parishes
                </button>
              </div>
            )}
            </div>
          </div>
        )}
        <nav className="flex-1" aria-label="Main">
          <ul className="space-y-1">
            {isDioceseDashboardViewer && (
              <li>
                <Link
                  href="/dashboard/diocese"
                  prefetch={false}
                  className="block px-3 py-2 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10"
                >
                  Diocese Dashboard
                </Link>
              </li>
            )}
            <li>
              <Link
                href="/dashboard"
                prefetch={false}
                className="block px-3 py-2 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10"
              >
                Parish Dashboard
              </Link>
            </li>
            {(isAdmin || isSuperAdmin) && (
              <>
                <li>
                  <Link
                    href="/settings"
                    prefetch={false}
                    className="block px-3 py-2 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10"
                  >
                    Administration
                  </Link>
                </li>
              </>
            )}
            <li>
              <Link
                href="/baptisms"
                prefetch={false}
                className="block px-3 py-2 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10"
              >
                Baptisms
              </Link>
            </li>
            <li>
              <Link
                href="/communions"
                prefetch={false}
                className="block px-3 py-2 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10"
              >
                Holy Communion
              </Link>
            </li>
            <li>
              <Link
                href="/confirmations"
                className="block px-3 py-2 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10"
              >
                Confirmation
              </Link>
            </li>
            <li>
              <Link
                href="/marriages"
                prefetch={false}
                className="block px-3 py-2 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10"
              >
                Marriage
              </Link>
            </li>
            <li>
              <Link
                href="/holy-orders"
                prefetch={false}
                className="block px-3 py-2 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10"
              >
                Holy Order
              </Link>
            </li>
            <li>
              <Link
                href="/offline-outbox"
                prefetch={false}
                className="block px-3 py-2 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10"
              >
                Pending Sync
              </Link>
            </li>
            <li className="mt-2 pt-2 border-t border-gray-100">
              <Link
                href="/help"
                className="block px-3 py-2 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10 flex items-center gap-2"
              >
                <HelpIcon className="w-4 h-4 shrink-0" />
                Help
              </Link>
            </li>
          </ul>
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-auto text-left px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 text-sm"
        >
          Sign out
        </button>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex items-center justify-end gap-4 py-3 px-4 border-b border-gray-200 bg-white/80">
          <Link href="/help" prefetch={false} className="flex items-center gap-1.5 text-sm text-sancta-maroon hover:underline">
            <HelpIcon className="w-4 h-4 shrink-0" />
            Help
          </Link>
          <span className="text-sm text-gray-600">
            {user.displayName || user.username}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-sancta-maroon hover:underline"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6 w-full min-w-0">
          {children}
        </main>
        <footer
          className="mt-auto w-full min-w-0 border-t border-gray-100 bg-gray-50/90 px-4 py-4 md:px-6 md:py-5"
          role="contentinfo"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-gray-800">Trust &amp; Legal</p>
          <p className="mt-1.5 text-xs text-gray-600 leading-snug">
            Learn how your data is handled and protected.
          </p>
          <nav aria-label="Trust and legal" className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <Link href="/data-protection" prefetch={false} className={trustLegalFooterLinkClass}>
              Data Protection &amp; Trust
            </Link>
            <Link href="/privacy" prefetch={false} className={trustLegalFooterLinkClass}>
              Privacy
            </Link>
            <Link href="/terms-of-use" prefetch={false} className={trustLegalFooterLinkClass}>
              Terms
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
