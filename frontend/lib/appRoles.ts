export type RoleOption = { value: string; label: string; description?: string };

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

/** Human-readable role for tables and summaries (API still uses enum strings). */
export function appRoleLabel(role: string | null | undefined): string {
  if (role == null || role === '') return '—';
  return (
    LABEL_BY_VALUE[role] ??
    role
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}
