'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { getStoredUser } from '@/lib/api';

function isAdminOrSuperAdmin(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

const cardClass =
  'block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-sancta-maroon/40 hover:bg-sancta-maroon/[0.03]';

export default function SettingsHubPage() {
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    if (user && !isAdminOrSuperAdmin(user.role)) {
      router.replace('/');
    }
  }, [router]);

  const user = getStoredUser();
  if (user && !isAdminOrSuperAdmin(user.role)) {
    return (
      <AuthenticatedLayout>
        <p className="text-gray-600">Redirecting…</p>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-sancta-maroon">Administration</h1>
          <p className="mt-1 text-sm text-gray-600">
            Directory management, parish access, marriage requirements, and other admin-only options. Only <strong>ADMIN</strong> and{' '}
            <strong>SUPER_ADMIN</strong> can open these. If you are a super admin, you will also see{' '}
            <strong>User Setup</strong> below to create new accounts.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Link href="/settings/marriage-requirements" className={cardClass}>
            <span className="font-semibold text-gray-900">Marriage</span>
            <span className="mt-1 block text-sm text-gray-600">
              Baptism and Holy Communion are always required for both parties; this option adds Confirmation for both when
              enabled (per parish).
            </span>
            <span className="mt-2 text-sm font-medium text-sancta-maroon">Open →</span>
          </Link>
          <div className="flex flex-col gap-6">
            <Link href="/parishes" className={cardClass}>
              <span className="font-semibold text-gray-900">Directory Management</span>
              <span className="mt-1 block text-sm text-gray-600">
                Manage dioceses and parishes for country-based setup and assignment.
              </span>
              <span className="mt-2 text-sm font-medium text-sancta-maroon">Open →</span>
            </Link>
            <Link href="/users" className={cardClass}>
              <span className="font-semibold text-gray-900">User Access</span>
              <span className="mt-1 block text-sm text-gray-600">
                Assign or revoke parish access for users and set each user&apos;s default parish.
              </span>
              <span className="mt-2 text-sm font-medium text-sancta-maroon">Open →</span>
            </Link>
            {user?.role === 'SUPER_ADMIN' && (
              <Link href="/users/setup" className={cardClass}>
                <span className="font-semibold text-gray-900">User Setup</span>
                <span className="mt-1 block text-sm text-gray-600">
                  Create new users. They must reset their password on first login.
                </span>
                <span className="mt-2 text-sm font-medium text-sancta-maroon">Open →</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
