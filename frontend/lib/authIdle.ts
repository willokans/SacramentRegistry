/** Two hours without user interaction before the client signs out (see IdleSessionManager). */
export const IDLE_SESSION_MS = 2 * 60 * 60 * 1000;

/** Set at login when the user checks "Remember device"; cleared on explicit sign-out (see clearAuth). */
export const REMEMBER_DEVICE_STORAGE_KEY = 'church_registry_remember_device';

/** Longer inactivity window when "Remember device" was chosen (trusted workstation). */
export const REMEMBER_DEVICE_IDLE_MS = 7 * 24 * 60 * 60 * 1000;

export function getIdleSessionLimitMs(): number {
  if (typeof window === 'undefined') return IDLE_SESSION_MS;
  try {
    return localStorage.getItem(REMEMBER_DEVICE_STORAGE_KEY) === '1'
      ? REMEMBER_DEVICE_IDLE_MS
      : IDLE_SESSION_MS;
  } catch {
    return IDLE_SESSION_MS;
  }
}

export function setRememberDevicePreference(remember: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (remember) localStorage.setItem(REMEMBER_DEVICE_STORAGE_KEY, '1');
    else localStorage.removeItem(REMEMBER_DEVICE_STORAGE_KEY);
  } catch {
    // private mode / quota
  }
}

export function clearRememberDevicePreference(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(REMEMBER_DEVICE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isIdleSessionExpired(
  lastActivityMs: number,
  nowMs: number,
  idleLimitMs: number = IDLE_SESSION_MS,
): boolean {
  return nowMs - lastActivityMs >= idleLimitMs;
}
