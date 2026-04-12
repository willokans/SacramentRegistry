export type RoleOption = { value: string; label: string; description?: string };

/**
 * Normalizes role strings from the API or localStorage: trim, uppercase, strip Spring-style {@code ROLE_} prefix.
 */
export function normalizeAppRole(role: string | null | undefined): string {
  if (role == null) return '';
  let r = String(role).trim().toUpperCase();
  if (r.startsWith('ROLE_')) {
    r = r.slice('ROLE_'.length);
  }
  return r;
}

/**
 * Labels for app_user.role values. ADMIN is parish-scoped; SUPER_ADMIN has full registry access.
 * Keep in sync with backend Role enum / JWT claims (values stay uppercase).
 */
export const USER_SETUP_ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'SUPER_ADMIN',
    label: 'System administrator',
    description:
      'Full access to every parish, user setup, and administration. Use only for a small set of trusted operators.',
  },
  {
    value: 'ADMIN',
    label: 'Parish administrator',
    description:
      'Manages sacraments and directory data only for parishes you assign below—not for the whole diocese.',
  },
  { value: 'PRIEST', label: 'Priest' },
  { value: 'PARISH_PRIEST', label: 'Parish Priest' },
  { value: 'PARISH_SECRETARY', label: 'Parish Secretary' },
  { value: 'PARISH_VIEWER', label: 'Parish Viewer' },
];

const LABEL_BY_VALUE = Object.fromEntries(
  USER_SETUP_ROLE_OPTIONS.map((r) => [r.value, r.label]),
) as Record<string, string>;

/** Roles that may open the diocese-wide dashboard (parish-scoped ADMIN excluded). */
export function canSeeDioceseDashboard(role: string | null | undefined): boolean {
  const r = normalizeAppRole(role);
  return r === 'SUPER_ADMIN' || r === 'DIOCESE_ADMIN';
}

/** Human-readable role for tables and summaries (API still uses enum strings). */
export function appRoleLabel(role: string | null | undefined): string {
  if (role == null || role === '') return '—';
  const r = normalizeAppRole(role);
  return (
    LABEL_BY_VALUE[r] ??
    r
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}
