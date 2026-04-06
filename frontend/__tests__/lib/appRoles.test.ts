/**
 * Tests for app role display labels (User Setup + User Parish Access).
 */
import { appRoleLabel, USER_SETUP_ROLE_OPTIONS } from '@/lib/appRoles';

describe('USER_SETUP_ROLE_OPTIONS', () => {
  it('has unique role values', () => {
    const values = USER_SETUP_ROLE_OPTIONS.map((r) => r.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('maps SUPER_ADMIN and ADMIN to operator-facing names', () => {
    const superAdmin = USER_SETUP_ROLE_OPTIONS.find((r) => r.value === 'SUPER_ADMIN');
    const admin = USER_SETUP_ROLE_OPTIONS.find((r) => r.value === 'ADMIN');
    expect(superAdmin?.label).toBe('System administrator');
    expect(admin?.label).toBe('Parish administrator');
  });

  it('includes descriptions for full-access vs parish-scoped admin roles', () => {
    const superAdmin = USER_SETUP_ROLE_OPTIONS.find((r) => r.value === 'SUPER_ADMIN');
    const admin = USER_SETUP_ROLE_OPTIONS.find((r) => r.value === 'ADMIN');
    expect(superAdmin?.description).toBeTruthy();
    expect(admin?.description).toBeTruthy();
    expect(superAdmin?.description).toContain('Full access');
    expect(admin?.description).toContain('parishes');
  });
});

describe('appRoleLabel', () => {
  it('returns em dash for null, undefined, or empty string', () => {
    expect(appRoleLabel(null)).toBe('—');
    expect(appRoleLabel(undefined)).toBe('—');
    expect(appRoleLabel('')).toBe('—');
  });

  it('returns mapped labels for known API role strings', () => {
    expect(appRoleLabel('SUPER_ADMIN')).toBe('System administrator');
    expect(appRoleLabel('ADMIN')).toBe('Parish administrator');
    expect(appRoleLabel('PRIEST')).toBe('Priest');
    expect(appRoleLabel('PARISH_VIEWER')).toBe('Parish Viewer');
  });

  it('title-cases unknown underscore roles as fallback', () => {
    expect(appRoleLabel('FUTURE_ROLE')).toBe('Future Role');
    expect(appRoleLabel('LOWER_UNDERSCORE')).toBe('Lower Underscore');
  });
});
