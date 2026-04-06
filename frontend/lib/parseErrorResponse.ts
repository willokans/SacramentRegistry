/** Parse error response text; prefer 'detail', 'message', or 'error' from JSON when present. */
export function parseErrorResponse(text: string, fallback: string): string {
  try {
    const j = JSON.parse(text) as { detail?: string; message?: string; error?: string };
    const msg = (j.detail ?? j.message ?? j.error ?? fallback).trim();
    return msg || fallback;
  } catch {
    return text.trim() || fallback;
  }
}
