/** Two hours without user interaction before the client signs out (see IdleSessionManager). */
export const IDLE_SESSION_MS = 2 * 60 * 60 * 1000;

export function isIdleSessionExpired(
  lastActivityMs: number,
  nowMs: number,
  idleLimitMs: number = IDLE_SESSION_MS,
): boolean {
  return nowMs - lastActivityMs >= idleLimitMs;
}
