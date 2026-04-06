/**
 * Turn a backend error response body into a plain object for JSON serialization.
 * Parses Spring (and similar) JSON errors instead of nesting the raw string under `{ error }`.
 */
export function backendErrorPayloadFromText(text: string, fallbackMessage: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { message: fallbackMessage };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* non-JSON body */
  }
  return { message: trimmed || fallbackMessage };
}
