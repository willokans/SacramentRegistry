import { IDLE_SESSION_MS, isIdleSessionExpired } from '@/lib/authIdle';

describe('authIdle', () => {
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
