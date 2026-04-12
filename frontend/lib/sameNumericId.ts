/** True when both values denote the same numeric entity id (tolerates string vs number from JSON/storage). */
export function sameNumericId(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return na === nb;
}
