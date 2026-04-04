'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getStoredToken, getStoredUser, clearAuth } from '@/lib/api';
import { useParish } from '@/context/ParishContext';
import { getChurchBranding } from '@/lib/church-branding';
import { useNetworkStatus } from '@/lib/offline/network';
import { useOfflineQueueReplayer } from '@/lib/offline/useOfflineQueueReplayer';
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

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { parishId, setParishId, dioceseId, setDioceseId, parishes = [], dioceses = [], loading: parishLoading, error: parishError, refetch } = useParish();

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
  const isAdmin = user.role === 'ADMIN';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const currentParish = parishId != null ? parishes.find((p) => p.id === parishId) : undefined;
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
                {(isAdmin || isSuperAdmin) && dioceses.length > 0 && (
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
                      {dioceses.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.dioceseName}
                        </option>
                      ))}
                    </select>
                  </div>
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
                    {(isAdmin || isSuperAdmin) ? 'No parish selected' : 'No parish assigned. Contact admin.'}
                  </p>
                )}
                {(isAdmin || isSuperAdmin) && (
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
            <nav className="flex-1 p-4">
              <ul className="space-y-1">
                {[
                  ...(isAdmin || isSuperAdmin ? [{ href: '/dashboard/diocese', label: 'Diocese Dashboard' }] : []),
                  { href: '/dashboard', label: 'Parish Dashboard' },
                  ...(isAdmin || isSuperAdmin
                    ? [
                        { href: '/settings', label: 'Administration' },
                      ]
                    : []),
                  { href: '/baptisms', label: 'Baptisms' },
                  { href: '/communions', label: 'Holy Communion' },
                  { href: '/confirmations', label: 'Confirmation' },
                  { href: '/marriages', label: 'Marriage' },
                  { href: '/holy-orders', label: 'Holy Order' },
                  { href: '/offline-outbox', label: 'Pending Sync' },
                  { href: '/help', label: 'Help' },
                  { href: '/privacy', label: 'Privacy Notice' },
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
            {(isAdmin || isSuperAdmin) && dioceses.length > 0 && (
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
                  {dioceses.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.dioceseName}
                    </option>
                  ))}
                </select>
              </div>
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
                {(isAdmin || isSuperAdmin) ? 'No parish selected' : 'No parish assigned. Contact admin.'}
              </p>
            )}
            {(isAdmin || isSuperAdmin) && (
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
            {(isAdmin || isSuperAdmin) && (
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
            <li>
              <Link
                href="/help"
                className="block px-3 py-2 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10 flex items-center gap-2"
              >
                <HelpIcon className="w-4 h-4 shrink-0" />
                Help
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="block px-3 py-2 rounded-lg text-sancta-maroon font-medium hover:bg-sancta-maroon/10"
              >
                Privacy Notice
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
          <Link href="/privacy" prefetch={false} className="text-sm text-sancta-maroon hover:underline">
            Privacy Notice
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
      </div>
    </div>
  );
}
