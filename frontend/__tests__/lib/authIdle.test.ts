import {
  IDLE_SESSION_MS,
  REMEMBER_DEVICE_IDLE_MS,
  REMEMBER_DEVICE_STORAGE_KEY,
  clearRememberDevicePreference,
  getIdleSessionLimitMs,
  isIdleSessionExpired,
  setRememberDevicePreference,
} from '@/lib/authIdle';

describe('authIdle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getIdleSessionLimitMs', () => {
    it('returns default idle when remember device is not set', () => {
      expect(getIdleSessionLimitMs()).toBe(IDLE_SESSION_MS);
    });

    it('returns extended limit when remember device is set', () => {
      localStorage.setItem(REMEMBER_DEVICE_STORAGE_KEY, '1');
      expect(getIdleSessionLimitMs()).toBe(REMEMBER_DEVICE_IDLE_MS);
    });
  });

  describe('setRememberDevicePreference / clearRememberDevicePreference', () => {
    it('stores and clears the preference', () => {
      setRememberDevicePreference(true);
      expect(localStorage.getItem(REMEMBER_DEVICE_STORAGE_KEY)).toBe('1');
      clearRememberDevicePreference();
      expect(localStorage.getItem(REMEMBER_DEVICE_STORAGE_KEY)).toBeNull();
    });

    it('setRememberDevicePreference(false) removes the key', () => {
      localStorage.setItem(REMEMBER_DEVICE_STORAGE_KEY, '1');
      setRememberDevicePreference(false);
      expect(localStorage.getItem(REMEMBER_DEVICE_STORAGE_KEY)).toBeNull();
    });
  });

  describe('isIdleSessionExpired', () => {
    it('returns false when under the idle limit', () => {
      const now = 1_000_000;
      const last = now - IDLE_SESSION_MS + 1;
      expect(isIdleSessionExpired(last, now)).toBe(false);
    });

    it('returns true when exactly at the idle limit', () => {
      const now = 1_000_000;
      const last = now - IDLE_SESSION_MS;
      expect(isIdleSessionExpired(last, now)).toBe(true);
    });

    it('returns true when beyond the idle limit', () => {
      const now = 1_000_000;
      const last = now - IDLE_SESSION_MS - 1;
      expect(isIdleSessionExpired(last, now)).toBe(true);
    });

    it('respects a custom limit', () => {
      expect(isIdleSessionExpired(100, 200, 50)).toBe(true);
      expect(isIdleSessionExpired(100, 149, 50)).toBe(false);
    });
  });
});
