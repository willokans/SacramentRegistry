'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearAuth,
  getStoredToken,
  touchAuthActivity,
  readAuthLastActivityMs,
} from '@/lib/api';
import { getIdleSessionLimitMs, isIdleSessionExpired } from '@/lib/authIdle';

const CHECK_INTERVAL_MS = 60_000;
const ACTIVITY_THROTTLE_MS = 5_000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['keydown', 'pointerdown', 'scroll', 'wheel', 'touchstart'];

/**
 * Tracks last user activity in localStorage and signs out after idle limit (default two hours;
 * longer when the user chose "Remember device" at login). Silent JWT refresh does not reset the
 * timer (only touchAuthActivity / login does).
 */
export default function IdleSessionManager() {
  const router = useRouter();
  const lastBumpRef = useRef(0);

  const bump = useCallback(() => {
    if (!getStoredToken()) return;
    const now = Date.now();
    if (now - lastBumpRef.current < ACTIVITY_THROTTLE_MS) return;
    lastBumpRef.current = now;
    touchAuthActivity();
  }, []);

  const checkIdle = useCallback(() => {
    const token = getStoredToken();
    if (!token) return;
    const last = readAuthLastActivityMs();
    if (last == null) {
      touchAuthActivity();
      return;
    }
    if (isIdleSessionExpired(last, Date.now(), getIdleSessionLimitMs())) {
      clearAuth();
      router.replace('/login?reason=idle');
    }
  }, [router]);

  useEffect(() => {
    const onActivity = () => bump();

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true } as AddEventListenerOptions);
    }

    checkIdle();
    const intervalId = window.setInterval(checkIdle, CHECK_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkIdle();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [bump, checkIdle]);

  return null;
}
