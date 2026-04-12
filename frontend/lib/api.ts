import { clearRememberDevicePreference } from '@/lib/authIdle';
import { getIsOnline } from '@/lib/offline/network';
import { parseErrorResponse } from '@/lib/parseErrorResponse';
import {
  loadCachedBaptisms,
  loadCachedCommunions,
  loadCachedConfirmations,
  saveCachedBaptisms,
  saveCachedCommunions,
  saveCachedConfirmations,
} from '@/lib/offline/referenceCache';

/**
 * Frontend runs as a UI-only client: all API traffic must go to Spring Boot.
 * NEXT_PUBLIC_API_URL must be an absolute URL (e.g. http://localhost:8080).
 */
function getBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) {
    throw new Error('Missing NEXT_PUBLIC_API_URL. Configure the Spring Boot API URL for the frontend runtime.');
  }

  try {
    return new URL(raw).toString().replace(/\/$/, '');
  } catch {
    throw new Error('Invalid NEXT_PUBLIC_API_URL. Provide an absolute URL like http://localhost:8080');
  }
}

/** Shown when the browser cannot complete the sign-in request (network, CORS, wrong URL, etc.). */
const LOGIN_COULD_NOT_CONNECT =
  "We couldn't connect to sign you in. Check your internet connection and try again. If this keeps happening, contact your parish administrator.";

const LOGIN_SITE_NOT_CONFIGURED =
  'This site is not fully set up for sign-in yet. Please contact your parish administrator.';

const LOGIN_COULD_NOT_COMPLETE =
  "We couldn't complete sign-in. Please try again in a moment. If this keeps happening, contact your parish administrator.";

const LOGIN_BLOCKED_OR_POLICY =
  "We couldn't complete sign-in from this browser. Please try again later. If this continues, contact your parish administrator.";

const LOGIN_UNEXPECTED_SERVICE_RESPONSE =
  "We couldn't complete sign-in because something went wrong. Please try again later. If this continues, contact your parish administrator.";

/** Prefer a short JSON API message when safe; otherwise use fallback (avoid HTML / stack traces in the UI). */
function loginSafeApiMessage(responseText: string, fallback: string): string {
  const raw = parseErrorResponse(responseText, '').trim();
  if (!raw) return fallback;
  if (raw.length > 160) return fallback;
  if (/<!DOCTYPE|<html[\s>]/i.test(raw)) return fallback;
  return raw;
}

/** Maps network / configuration errors from fetch to a message suitable for the sign-in form. */
function loginNetworkUserMessage(error: unknown): string {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[login] Request did not reach the server:', error);
  }
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed') ||
    lower.includes('fetch failed') ||
    lower.includes('loadfail') ||
    lower.includes('access control') ||
    lower.includes('cors') ||
    lower.includes('blocked by cors') ||
    lower.includes('cross-origin') ||
    (lower.includes('network') && lower.includes('error'))
  ) {
    return LOGIN_COULD_NOT_CONNECT;
  }
  if (msg.includes('NEXT_PUBLIC_API_URL') || msg.includes('Missing NEXT_PUBLIC_API_URL')) {
    return LOGIN_SITE_NOT_CONFIGURED;
  }
  return LOGIN_COULD_NOT_CONNECT;
}

/** Shape of POST /api/auth/login success JSON (fields optional where older APIs omit them). */
export type LoginApiResponse = {
  token?: string;
  refreshToken?: string;
  username?: string;
  displayName?: string | null;
  role?: string | null;
  defaultParishId?: number | null;
  mustResetPassword?: boolean;
  user?: { username: string; displayName?: string | null; role?: string | null };
};

export async function login(username: string, password: string): Promise<LoginApiResponse> {
  let res: Response;
  try {
    res = await fetchWithRetry(`${getBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch (e) {
    throw new Error(loginNetworkUserMessage(e));
  }
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      throw new Error(
        'The username or password you entered is not correct. Please try again, or use Forgot password if you need help.',
      );
    }
    if (res.status === 429) {
      const detail = parseErrorResponse(text, '').trim();
      throw new Error(
        detail ||
          'Too many sign-in attempts from this network. Please wait about 15 minutes, then try again.',
      );
    }
    if (res.status >= 500) {
      throw new Error('The sign-in service is temporarily unavailable. Please try again in a few minutes.');
    }
    if (res.status === 403) {
      throw new Error(LOGIN_BLOCKED_OR_POLICY);
    }
    if (res.status === 400) {
      throw new Error(
        loginSafeApiMessage(
          text,
          'Sign-in could not start. Please check your username and password, then try again.',
        ),
      );
    }
    throw new Error(loginSafeApiMessage(text, LOGIN_COULD_NOT_COMPLETE));
  }
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[login] Response was not valid JSON (check API URL / proxy).');
    }
    throw new Error(LOGIN_UNEXPECTED_SERVICE_RESPONSE);
  }
  return payload as LoginApiResponse;
}

const TOKEN_STORAGE_KEY = 'church_registry_token';
const REFRESH_TOKEN_STORAGE_KEY = 'church_registry_refresh_token';
const USER_STORAGE_KEY = 'church_registry_user';

/** Fired after login or token refresh updates storage; ParishProvider refetches directory data. */
export const AUTH_SIGNED_IN_EVENT = 'church-registry-auth-signed-in';
/** Fired after logout clears storage; ParishProvider clears diocese/parish state. */
export const AUTH_SIGNED_OUT_EVENT = 'church-registry-auth-signed-out';

function dispatchAuthSignedIn(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_SIGNED_IN_EVENT));
}

function dispatchAuthSignedOut(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_SIGNED_OUT_EVENT));
}
/** Updated on user interaction and on explicit login — not on silent JWT refresh. */
const AUTH_LAST_ACTIVITY_KEY = 'church_registry_last_activity_ms';
let refreshInFlight: Promise<boolean> | null = null;

function persistAuthCredentials(
  token: string,
  refreshToken: string,
  user: { username: string; displayName: string | null; role: string | null },
  emitSignedIn = false,
) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  if (emitSignedIn) {
    dispatchAuthSignedIn();
  }
}

/** Call when the user does something in the app (also called from login via storeAuth). */
export function touchAuthActivity(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // private mode / quota
  }
}

export function readAuthLastActivityMs(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(AUTH_LAST_ACTIVITY_KEY);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getStoredUser(): { username: string; displayName: string | null; role: string | null } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeAuth(token: string, refreshToken: string, user: { username: string; displayName: string | null; role: string | null }) {
  persistAuthCredentials(token, refreshToken, user, true);
  touchAuthActivity();
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(AUTH_LAST_ACTIVITY_KEY);
  localStorage.removeItem(SIDEBAR_COUNTRY_STORAGE_KEY);
  clearRememberDevicePreference();
  dispatchAuthSignedOut();
}

/** Default copy when the API returns 200 without a usable `message` field (matches server ForgotPasswordResponse.MESSAGE). */
export const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "If an account exists for this username, we've sent password reset instructions to the email on file.";

export interface ForgotPasswordResponse {
  message: string;
}

/** Request password reset by username. Always 200 + generic message when identifier is valid; reset link is only sent by email. Uses Next.js proxy to avoid CORS. */
export async function forgotPassword(identifier: string): Promise<ForgotPasswordResponse> {
  const res = await fetchWithRetry('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: identifier.trim() }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) {
      const detail = parseErrorResponse(text, '').trim();
      throw new Error(
        detail ||
          'Too many password reset requests from this network. Please wait about 15 minutes, then try again.',
      );
    }
    throw new Error(parseErrorResponse(text, 'Failed to request password reset'));
  }
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
  }
  const message =
    typeof (payload as { message?: unknown })?.message === 'string' &&
    String((payload as { message: string }).message).trim() !== ''
      ? String((payload as { message: string }).message)
      : FORGOT_PASSWORD_SUCCESS_MESSAGE;
  return { message };
}

/** Reset password using token from forgot-password. No JWT required. Uses Next.js proxy. */
export async function resetPasswordByToken(token: string, newPassword: string): Promise<void> {
  const res = await fetchWithRetry('/api/auth/reset-password-by-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseErrorResponse(text, 'Invalid or expired reset token'));
  }
}

export interface AcceptInviteRequest {
  token: string;
  newPassword: string;
  firstName: string;
  lastName: string;
  title?: string;
}

export interface InviteProfileResponse {
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  invitedEmail?: string | null;
  expiresAt?: string | null;
}

/** Reads invite profile defaults (title/first/last) for prefill by token. */
export async function fetchInviteProfile(token: string): Promise<InviteProfileResponse> {
  const normalizedToken = token.trim();
  const res = await fetchWithRetry(`${getBaseUrl()}/api/auth/invite-profile?token=${encodeURIComponent(normalizedToken)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseErrorResponse(text, 'Invalid or expired invitation token'));
  }
  const payload = await res.json();
  return {
    title: payload?.title == null ? null : String(payload.title),
    firstName: payload?.firstName == null ? null : String(payload.firstName),
    lastName: payload?.lastName == null ? null : String(payload.lastName),
    invitedEmail: payload?.invitedEmail == null ? null : String(payload.invitedEmail),
    expiresAt: payload?.expiresAt == null ? null : String(payload.expiresAt),
  };
}

/** Accept invite token and complete first-time account setup. */
export async function acceptInvite(request: AcceptInviteRequest): Promise<void> {
  const body: Record<string, unknown> = {
    token: request.token.trim(),
    newPassword: request.newPassword,
    firstName: request.firstName.trim(),
    lastName: request.lastName.trim(),
  };
  if (request.title != null && request.title.trim() !== '') {
    body.title = request.title.trim();
  }
  const res = await fetchWithRetry(`${getBaseUrl()}/api/auth/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseErrorResponse(text, 'Invalid or expired invitation token'));
  }
}

/** Reset password for authenticated user (first-login flow). Requires valid JWT. */
export async function resetPassword(newPassword: string): Promise<void> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/auth/reset-password`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ newPassword }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseErrorResponse(text, 'Failed to reset password'));
  }
}

const PARISH_STORAGE_KEY = 'church_registry_parish_id';
const DIOCESE_STORAGE_KEY = 'church_registry_diocese_id';
const SIDEBAR_COUNTRY_STORAGE_KEY = 'church_registry_sidebar_country';

export function getStoredParishId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(PARISH_STORAGE_KEY);
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return Number.isNaN(id) ? null : id;
}

export function setStoredParishId(parishId: number | null): void {
  if (typeof window === 'undefined') return;
  if (parishId == null) localStorage.removeItem(PARISH_STORAGE_KEY);
  else localStorage.setItem(PARISH_STORAGE_KEY, String(parishId));
}

export function getStoredDioceseId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(DIOCESE_STORAGE_KEY);
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return Number.isNaN(id) ? null : id;
}

export function setStoredDioceseId(dioceseId: number | null): void {
  if (typeof window === 'undefined') return;
  if (dioceseId == null) localStorage.removeItem(DIOCESE_STORAGE_KEY);
  else localStorage.setItem(DIOCESE_STORAGE_KEY, String(dioceseId));
}

/** Sidebar country filter: `null` means "All countries" (stored key removed). */
export function getStoredSidebarCountryKey(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SIDEBAR_COUNTRY_STORAGE_KEY);
  if (raw == null || raw === '') return null;
  return raw;
}

export function setStoredSidebarCountryKey(key: string | null): void {
  if (typeof window === 'undefined') return;
  if (key == null || key === '') localStorage.removeItem(SIDEBAR_COUNTRY_STORAGE_KEY);
  else localStorage.setItem(SIDEBAR_COUNTRY_STORAGE_KEY, key);
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  return headers;
}

/** Fetch with retry for transient failures on unstable connections (e.g. low-bandwidth). */
async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: { skipAuthRefresh?: boolean; didAuthRefresh?: boolean },
): Promise<Response> {
  const maxRetries = 2;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 401 && !options?.skipAuthRefresh && !options?.didAuthRefresh && shouldAttemptAuthRefresh(url)) {
        const refreshed = await ensureFreshAccessToken();
        if (refreshed) {
          const retryInit = withLatestAuthHeader(init);
          return fetchWithRetry(url, retryInit, { skipAuthRefresh: false, didAuthRefresh: true });
        }
      }
      if (res.ok) return res;
      if (res.status >= 500 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
        continue;
      }
      return res;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
      } else {
        throw lastError;
      }
    }
  }
  throw lastError ?? new Error('Request failed');
}

function shouldAttemptAuthRefresh(url: string): boolean {
  if (typeof window === 'undefined') return false;
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  if (!refreshToken) return false;
  return !url.includes('/api/auth/login') && !url.includes('/api/auth/refresh') && !url.includes('/api/auth/logout');
}

async function ensureFreshAccessToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  if (!refreshToken) {
    clearAuth();
    return false;
  }

  refreshInFlight = (async () => {
    try {
      const res = await fetchWithRetry(
        `${getBaseUrl()}/api/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        },
        { skipAuthRefresh: true },
      );
      if (!res.ok) {
        clearAuth();
        return false;
      }
      const payload = await res.json() as {
        token?: string;
        refreshToken?: string;
        username?: string;
        displayName?: string | null;
        role?: string | null;
      };
      if (!payload.token || !payload.refreshToken) {
        clearAuth();
        return false;
      }
      const fallbackUser = getStoredUser();
      const nextUser = {
        username: payload.username ?? fallbackUser?.username ?? '',
        displayName: payload.displayName ?? fallbackUser?.displayName ?? null,
        role: payload.role ?? fallbackUser?.role ?? null,
      };
      persistAuthCredentials(payload.token, payload.refreshToken, nextUser);
      return true;
    } catch {
      clearAuth();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function withLatestAuthHeader(init?: RequestInit): RequestInit | undefined {
  if (!init) return init;
  const token = getStoredToken();
  if (!token) return init;
  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

export interface BaptismResponse {
  id: number;
  createdAt?: string;
  baptismName: string;
  otherNames: string;
  surname: string;
  gender: string;
  dateOfBirth: string;
  fathersName: string;
  mothersName: string;
  sponsorNames: string;
  officiatingPriest: string;
  parishId: number;
  /** Parish name (for display when baptized in same church). */
  parishName?: string;
  address?: string;
  parishAddress?: string;
  parentAddress?: string;
  note?: string;
  /** Set when this baptism has an external certificate (baptized in another parish). */
  externalCertificatePath?: string | null;
  /** Issuing parish name for the external certificate. */
  externalCertificateIssuingParish?: string | null;
  /** Current birth certificate file path when available. */
  birthCertificateCurrentPath?: string | null;
  placeOfBirth?: string | null;
  placeOfBaptism?: string | null;
  dateOfBaptism?: string | null;
  liberNo?: string | null;
}

export interface BaptismDocumentVersionResponse {
  id: number;
  baptismId: number;
  documentType: string;
  originalFilename: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  uploadedAt: string;
  uploadedById?: number | null;
  uploadedByName?: string | null;
  current: boolean;
}

export interface BaptismRequest {
  baptismName: string;
  otherNames: string;
  surname: string;
  gender: string;
  dateOfBirth: string;
  fathersName: string;
  mothersName: string;
  sponsorNames: string;
  officiatingPriest: string;
  parishId?: number;
  address?: string;
  parishAddress?: string;
  parentAddress?: string;
  placeOfBirth: string;
  placeOfBaptism: string;
  dateOfBaptism: string;
  liberNo?: string;
}

export { sameNumericId } from './sameNumericId';

export interface ParishResponse {
  id: number;
  parishName: string;
  dioceseId: number;
  description?: string;
  /** Default true when omitted (older API responses). */
  requireMarriageConfirmation?: boolean;
}

export interface ParishMarriageRequirementsResponse {
  parishId: number;
  requireMarriageConfirmation: boolean;
}

export async function fetchParishMarriageRequirements(
  parishId: number
): Promise<ParishMarriageRequirementsResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/parishes/${parishId}/marriage-requirements`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to load parish marriage requirements');
  }
  return res.json();
}

export async function patchParishMarriageRequirements(
  parishId: number,
  requireMarriageConfirmation: boolean
): Promise<ParishMarriageRequirementsResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/parishes/${parishId}/marriage-requirements`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ requireMarriageConfirmation }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseErrorResponse(text, 'Failed to update marriage requirements'));
  }
  return res.json();
}

export interface DioceseResponse {
  id: number;
  name: string;
  dioceseName?: string;
  countryCode?: string;
  countryName?: string;
  jurisdictionType?: string;
  ordinaryName?: string;
  ordinaryTitle?: string;
}

export async function fetchDioceses(): Promise<DioceseResponse[]> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/dioceses`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch dioceses');
  const raw = await res.json();
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => {
    const id = Number(item?.id);
    const resolvedName = String(item?.name ?? item?.dioceseName ?? '').trim();
    return {
      id: Number.isNaN(id) ? 0 : id,
      name: resolvedName || `Diocese ${Number.isNaN(id) ? '' : id}`.trim(),
      dioceseName: item?.dioceseName,
      countryCode: typeof item?.countryCode === 'string' ? item.countryCode : undefined,
      countryName: typeof item?.countryName === 'string' ? item.countryName : undefined,
      jurisdictionType: typeof item?.jurisdictionType === 'string' ? item.jurisdictionType : undefined,
      ordinaryName: typeof item?.ordinaryName === 'string' ? item.ordinaryName : undefined,
      ordinaryTitle: typeof item?.ordinaryTitle === 'string' ? item.ordinaryTitle : undefined,
    };
  }).filter((d) => d.id > 0);
}

export async function searchDioceses(countryCode: string, query?: string): Promise<DioceseResponse[]> {
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  if (!normalizedCountryCode) return [];

  const params = new URLSearchParams({ countryCode: normalizedCountryCode });
  const normalizedQuery = query?.trim();
  if (normalizedQuery) params.set('q', normalizedQuery);

  const res = await fetchWithRetry(`${getBaseUrl()}/api/dioceses/search?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to search dioceses');
  const raw = await res.json();
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => {
    const id = Number(item?.id);
    const resolvedName = String(item?.name ?? item?.dioceseName ?? '').trim();
    return {
      id: Number.isNaN(id) ? 0 : id,
      name: resolvedName || `Diocese ${Number.isNaN(id) ? '' : id}`.trim(),
      dioceseName: item?.dioceseName,
      countryCode: typeof item?.countryCode === 'string' ? item.countryCode : undefined,
      countryName: typeof item?.countryName === 'string' ? item.countryName : undefined,
      jurisdictionType: typeof item?.jurisdictionType === 'string' ? item.jurisdictionType : undefined,
      ordinaryName: typeof item?.ordinaryName === 'string' ? item.ordinaryName : undefined,
      ordinaryTitle: typeof item?.ordinaryTitle === 'string' ? item.ordinaryTitle : undefined,
    };
  }).filter((d) => d.id > 0);
}

export interface DioceseWithParishesResponse {
  id: number;
  dioceseName: string;
  code?: string;
  description?: string;
  countryCode?: string;
  countryName?: string;
  parishes: ParishResponse[];
}

/**
 * Normalizes `/api/dioceses/with-parishes` JSON so the UI always has numeric ids and each parish has a
 * {@link ParishResponse.dioceseId}. Some payloads omit {@code dioceseId} on nested parishes; we fall back to the parent diocese id.
 */
export function normalizeDiocesesWithParishesPayload(raw: unknown): DioceseWithParishesResponse[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => {
      const dioceseIdNum = Number(item?.id);
      if (!Number.isFinite(dioceseIdNum) || dioceseIdNum <= 0) return null;

      const parishesRaw = Array.isArray(item?.parishes) ? item.parishes : [];
      const parishes: ParishResponse[] = parishesRaw
        .map((p: any) => {
          const pid = Number(p?.id);
          if (!Number.isFinite(pid) || pid <= 0) return null;
          const fromPayload = Number(p?.dioceseId ?? p?.diocese_id);
          const resolvedDioceseId =
            Number.isFinite(fromPayload) && fromPayload > 0 ? fromPayload : dioceseIdNum;
          const name = String(p?.parishName ?? p?.parish_name ?? '').trim();
          return {
            id: pid,
            parishName: name || `Parish ${pid}`,
            dioceseId: resolvedDioceseId,
            description: typeof p?.description === 'string' ? p.description : undefined,
            requireMarriageConfirmation:
              p?.requireMarriageConfirmation ?? p?.require_marriage_confirmation ?? true,
          } satisfies ParishResponse;
        })
        .filter((p): p is ParishResponse => p != null);

      const dioceseName = String(item?.dioceseName ?? item?.diocese_name ?? '').trim();
      return {
        id: dioceseIdNum,
        dioceseName: dioceseName || `Diocese ${dioceseIdNum}`,
        code: typeof item?.code === 'string' ? item.code : undefined,
        description: typeof item?.description === 'string' ? item.description : undefined,
        countryCode:
          typeof item?.countryCode === 'string'
            ? item.countryCode
            : typeof item?.country_code === 'string'
              ? item.country_code
              : undefined,
        countryName:
          typeof item?.countryName === 'string'
            ? item.countryName
            : typeof item?.country_name === 'string'
              ? item.country_name
              : undefined,
        parishes,
      } satisfies DioceseWithParishesResponse;
    })
    .filter((d): d is DioceseWithParishesResponse => d != null);
}

/** Fetches all dioceses with their parishes in one request. Use for ParishContext to avoid N+1 round-trips. */
export async function fetchDiocesesWithParishes(): Promise<DioceseWithParishesResponse[]> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/dioceses/with-parishes`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch dioceses');
  const raw = await res.json();
  return normalizeDiocesesWithParishesPayload(raw);
}

export async function fetchParishes(dioceseId: number): Promise<ParishResponse[]> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/dioceses/${dioceseId}/parishes`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch parishes');
  return res.json();
}

type CreateDioceseOptions = {
  countryCode?: string;
  countryName?: string;
  jurisdictionType?: string;
  ordinaryName?: string;
  ordinaryTitle?: string;
};

export async function createDiocese(name: string, options: CreateDioceseOptions = {}): Promise<DioceseResponse> {
  const payload = {
    dioceseName: name,
    ...(options.countryCode ? { countryCode: options.countryCode } : {}),
    ...(options.countryName ? { countryName: options.countryName } : {}),
    ...(options.jurisdictionType ? { jurisdictionType: options.jurisdictionType } : {}),
    ...(options.ordinaryName ? { ordinaryName: options.ordinaryName } : {}),
    ...(options.ordinaryTitle ? { ordinaryTitle: options.ordinaryTitle } : {}),
  };

  let res = await fetchWithRetry(`${getBaseUrl()}/api/dioceses`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok && Object.keys(options).length > 0) {
    // Retry with the legacy payload so older backend deployments still accept diocese creation.
    res = await fetchWithRetry(`${getBaseUrl()}/api/dioceses`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ dioceseName: name }),
    });
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseErrorResponse(text, 'Failed to create diocese'));
  }
  return res.json();
}

export async function createParish(dioceseId: number, parishName: string): Promise<ParishResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/parishes`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ parishName, dioceseId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseErrorResponse(text, 'Failed to create parish'));
  }
  return res.json();
}

/** Dashboard counts for a parish. Use for accurate totals (avoids pagination undercount). */
export interface DashboardCountsResponse {
  baptisms: number;
  communions: number;
  confirmations: number;
  marriages: number;
  holyOrders: number;
}

export async function fetchDashboardCounts(parishId: number): Promise<DashboardCountsResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/parishes/${parishId}/dashboard-counts`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch dashboard counts');
  return res.json();
}

/** Consolidated dashboard: counts + recent records in one call. */
export interface DashboardResponse {
  counts: DashboardCountsResponse;
  baptisms: BaptismResponse[];
  communions: FirstHolyCommunionResponse[];
  confirmations: ConfirmationResponse[];
  marriages: MarriageResponse[];
}

/** Diocese-level dashboard: aggregated counts, parish activity, recent sacraments, monthly chart data. */
export interface DioceseDashboardResponse {
  counts: {
    parishes?: number;
    baptisms: number;
    communions: number;
    confirmations: number;
    marriages: number;
    holyOrders: number;
  };
  parishActivity: DioceseParishActivityItem[];
  recentSacraments: DioceseRecentSacraments;
  monthly: DioceseMonthlyData;
}

export interface DioceseParishActivityItem {
  parishId: number;
  parishName: string;
  baptisms: number;
  communions: number;
  confirmations: number;
  marriages: number;
}

export interface DioceseRecentSacraments {
  baptisms: BaptismResponse[];
  communions: FirstHolyCommunionResponse[];
  confirmations: ConfirmationResponse[];
  marriages: MarriageResponse[];
}

export interface DioceseMonthlyData {
  baptisms: number[];
  communions: number[];
  confirmations: number[];
  marriages: number[];
}

export async function fetchDioceseDashboard(dioceseId: number): Promise<DioceseDashboardResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/dioceses/${dioceseId}/dashboard`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch diocese dashboard');
  return res.json();
}

export async function fetchDashboard(parishId: number): Promise<DashboardResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/parishes/${parishId}/dashboard`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch dashboard');
  return res.json();
}

/** Paginated response from sacrament list endpoints. */
export interface SacramentPageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
}

/** Raw API response may be PageImpl (flat) or PagedModel (content + metadata). */
interface RawPageResponse<T> {
  content: T[];
  totalElements?: number;
  totalPages?: number;
  size?: number;
  number?: number;
  first?: boolean;
  last?: boolean;
  numberOfElements?: number;
  empty?: boolean;
  metadata?: { size: number; number: number; totalElements: number; totalPages: number };
}

function normalizePageResponse<T>(raw: RawPageResponse<T>): SacramentPageResponse<T> {
  const meta = raw.metadata;
  const size = meta?.size ?? raw.size ?? 50;
  const number = meta?.number ?? raw.number ?? 0;
  const totalElements = meta?.totalElements ?? raw.totalElements ?? 0;
  const totalPages = meta?.totalPages ?? raw.totalPages ?? Math.max(1, Math.ceil(totalElements / size));
  return {
    content: raw.content ?? [],
    totalElements,
    totalPages,
    size,
    number,
    first: raw.first ?? number === 0,
    last: raw.last ?? number >= totalPages - 1,
    numberOfElements: raw.numberOfElements ?? raw.content?.length ?? 0,
    empty: raw.empty ?? (raw.content?.length ?? 0) === 0,
  };
}

export async function fetchBaptisms(
  parishId: number,
  page = 0,
  size = 50
): Promise<SacramentPageResponse<BaptismResponse>> {
  const shouldUseReferenceCache = page === 0;

  if (shouldUseReferenceCache && !getIsOnline()) {
    const cached = loadCachedBaptisms(parishId, page);
    if (cached) {
      const empty = cached.length === 0;
      return {
        content: cached as unknown as BaptismResponse[],
        totalElements: cached.length,
        totalPages: 1,
        size,
        number: page,
        first: true,
        last: true,
        numberOfElements: cached.length,
        empty,
      };
    }
  }

  try {
    const res = await fetchWithRetry(
      `${getBaseUrl()}/api/parishes/${parishId}/baptisms?page=${page}&size=${size}`,
      { headers: getAuthHeaders() }
    );
    if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch baptisms');
    const pageData = normalizePageResponse<BaptismResponse>(await res.json() as RawPageResponse<BaptismResponse>);

    if (shouldUseReferenceCache) {
      const items = pageData.content.map((b) => ({
        id: b.id,
        baptismName: b.baptismName ?? '',
        otherNames: b.otherNames ?? '',
        surname: b.surname ?? '',
        dateOfBirth: b.dateOfBirth ?? '',
        fathersName: b.fathersName ?? '',
        mothersName: b.mothersName ?? '',
        gender: (b as any).gender ?? undefined,
      }));
      saveCachedBaptisms(parishId, page, items);
    }

    return pageData;
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'Unauthorized') throw err;

    if (shouldUseReferenceCache && !getIsOnline()) {
      const cached = loadCachedBaptisms(parishId, page);
      if (cached) {
        const empty = cached.length === 0;
        return {
          content: cached as unknown as BaptismResponse[],
          totalElements: cached.length,
          totalPages: 1,
          size,
          number: page,
          first: true,
          last: true,
          numberOfElements: cached.length,
          empty,
        };
      }
    }

    throw err;
  }
}

/** Server-side search for baptisms by name or address. Use when search query is present. */
export async function fetchBaptismsSearch(
  parishId: number,
  query: string,
  page = 0,
  size = 50
): Promise<SacramentPageResponse<BaptismResponse>> {
  const res = await fetchWithRetry(
    `${getBaseUrl()}/api/parishes/${parishId}/baptisms/search?q=${encodeURIComponent(query)}&page=${page}&size=${size}`,
    { headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to search baptisms');
  return normalizePageResponse<BaptismResponse>(await res.json() as RawPageResponse<BaptismResponse>);
}

export async function fetchBaptism(id: number): Promise<BaptismResponse | null> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/baptisms/${id}`, { headers: getAuthHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch baptism');
  return res.json();
}

/** Fetch external baptism certificate file (when baptized in another parish). Returns blob for view/download. */
export async function fetchBaptismExternalCertificate(baptismId: number): Promise<Blob> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/baptisms/${baptismId}/external-certificate`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) throw new Error('No external certificate for this baptism');
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to load certificate');
  return res.blob();
}

/** Upload an external baptism certificate when it was not provided at registration (multipart field `file`). */
export async function uploadBaptismExternalCertificate(
  baptismId: number,
  file: File
): Promise<BaptismResponse> {
  const formData = new FormData();
  formData.set('file', file);
  const token = getStoredToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>).Authorization = `Bearer ${token}`;

  const res = await fetchWithRetry(`${getBaseUrl()}/api/baptisms/${baptismId}/external-certificate`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    const text = await res.text();
    let msg = text;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string };
      if (typeof json?.error === 'string') msg = json.error;
      else if (typeof json?.message === 'string') msg = json.message;
    } catch {
      if (text && text.length < 200) msg = text;
    }
    throw new Error(msg || 'Failed to upload certificate');
  }
  return res.json();
}

/** Upload birth certificate attachment for an existing baptism (multipart field `file`). */
export async function uploadBaptismBirthCertificate(
  baptismId: number,
  file: File
): Promise<BaptismDocumentVersionResponse> {
  const formData = new FormData();
  formData.set('file', file);
  const token = getStoredToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>).Authorization = `Bearer ${token}`;

  const res = await fetchWithRetry(`${getBaseUrl()}/api/baptisms/${baptismId}/birth-certificate`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    const text = await res.text();
    let msg = text;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string; detail?: string };
      if (typeof json?.detail === 'string' && json.detail.trim()) msg = json.detail;
      else if (typeof json?.message === 'string' && json.message.trim()) msg = json.message;
      else if (typeof json?.error === 'string' && json.error.trim()) msg = json.error;
    } catch {
      if (text && text.length < 200) msg = text;
    }
    throw new Error(msg || 'Failed to upload birth certificate');
  }
  return res.json();
}

/** Fetch current birth certificate attachment for a baptism. */
export async function fetchBaptismBirthCertificate(baptismId: number): Promise<Blob> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/baptisms/${baptismId}/birth-certificate`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) throw new Error('No birth certificate for this baptism');
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to load birth certificate');
  return res.blob();
}

/** Fetch birth certificate versions for a baptism (latest first). */
export async function fetchBaptismBirthCertificateVersions(
  baptismId: number
): Promise<BaptismDocumentVersionResponse[]> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/baptisms/${baptismId}/birth-certificate/versions`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to load birth certificate history');
  return res.json();
}

/** Fetch a specific historical birth certificate version file. */
export async function fetchBaptismBirthCertificateVersion(
  baptismId: number,
  versionId: number
): Promise<Blob> {
  const res = await fetchWithRetry(
    `${getBaseUrl()}/api/baptisms/${baptismId}/birth-certificate/versions/${versionId}`,
    { headers: getAuthHeaders() }
  );
  if (res.status === 404) throw new Error('Birth certificate version not found');
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to load birth certificate version');
  return res.blob();
}

export async function createBaptism(parishId: number, body: BaptismRequest): Promise<BaptismResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/parishes/${parishId}/baptisms`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ ...body, parishId }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json?.error && typeof json.error === 'string') throw new Error(json.error);
    } catch (e) {
      if (e instanceof Error && e.message !== 'Failed to create baptism') throw e;
    }
    throw new Error(text || 'Failed to create baptism');
  }
  return res.json();
}

export async function updateBaptismNotes(id: number, note: string): Promise<BaptismResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/baptisms/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to update notes');
  }
  return res.json();
}

export interface BaptismCertificateData {
  baptism: BaptismResponse;
  parishName: string;
  dioceseName: string;
}

export async function fetchBaptismCertificateData(id: number): Promise<BaptismCertificateData> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/baptisms/${id}/certificate-data`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) throw new Error('Baptism not found');
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch certificate data');
  return res.json();
}

export interface BaptismNoteResponse {
  id: number;
  content: string;
  createdAt: string;
  createdBy?: string;
}

export async function fetchBaptismNoteHistory(baptismId: number): Promise<BaptismNoteResponse[]> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/baptisms/${baptismId}/notes`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch note history');
  return res.json();
}

export async function emailBaptismCertificate(id: number, to: string): Promise<void> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/baptisms/${id}/email-certificate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ to }),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = 'Failed to send certificate';
    try {
      const data = JSON.parse(text) as { error?: string };
      if (typeof data?.error === 'string') msg = data.error;
    } catch {
      if (text && text.length < 200) msg = text;
    }
    throw new Error(msg);
  }
}

export interface FirstHolyCommunionResponse {
  id: number;
  createdAt?: string;
  note?: string;
  baptismId: number;
  communionDate: string;
  officiatingPriest: string;
  parish: string;
  baptismCertificatePath?: string | null;
  communionCertificatePath?: string | null;
  /**
   * True when baptism was recorded as external but the certificate file is not yet uploaded.
   * Omitted in older API responses; treat as false when absent.
   */
  baptismCertificatePending?: boolean;
  /** From baptism (when loaded with communion). */
  baptismName?: string;
  otherNames?: string;
  surname?: string;
  dateOfBirth?: string;
  baptismParishName?: string;
  gender?: string;
  fathersName?: string;
  mothersName?: string;
}

export interface FirstHolyCommunionRequest {
  baptismId: number;
  communionDate: string;
  officiatingPriest: string;
  parish: string;
  /** When provided (e.g. after creating baptism with certificate), stored on communion so baptism record can show uploaded cert. */
  baptismCertificatePath?: string;
}

export async function fetchCommunions(
  parishId: number,
  page = 0,
  size = 50
): Promise<SacramentPageResponse<FirstHolyCommunionResponse>> {
  const shouldUseReferenceCache = page === 0;

  if (shouldUseReferenceCache && !getIsOnline()) {
    const cached = loadCachedCommunions(parishId, page);
    if (cached) {
      const empty = cached.length === 0;
      return {
        content: cached as unknown as FirstHolyCommunionResponse[],
        totalElements: cached.length,
        totalPages: 1,
        size,
        number: page,
        first: true,
        last: true,
        numberOfElements: cached.length,
        empty,
      };
    }
  }

  try {
    const res = await fetchWithRetry(
      `${getBaseUrl()}/api/parishes/${parishId}/communions?page=${page}&size=${size}`,
      { headers: getAuthHeaders() }
    );
    if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch communions');
    const pageData = normalizePageResponse<FirstHolyCommunionResponse>(await res.json() as RawPageResponse<FirstHolyCommunionResponse>);

    if (shouldUseReferenceCache) {
      const items = pageData.content.map((c) => ({
        id: c.id,
        baptismId: c.baptismId,
        baptismName: c.baptismName ?? '',
        otherNames: c.otherNames ?? '',
        surname: c.surname ?? '',
        communionDate: c.communionDate ?? '',
        officiatingPriest: c.officiatingPriest ?? '',
        parish: c.parish ?? undefined,
      }));
      saveCachedCommunions(parishId, page, items);
    }

    return pageData;
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'Unauthorized') throw err;

    if (shouldUseReferenceCache && !getIsOnline()) {
      const cached = loadCachedCommunions(parishId, page);
      if (cached) {
        const empty = cached.length === 0;
        return {
          content: cached as unknown as FirstHolyCommunionResponse[],
          totalElements: cached.length,
          totalPages: 1,
          size,
          number: page,
          first: true,
          last: true,
          numberOfElements: cached.length,
          empty,
        };
      }
    }

    throw err;
  }
}

export async function fetchCommunion(id: number): Promise<FirstHolyCommunionResponse | null> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/communions/${id}`, { headers: getAuthHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch communion');
  return res.json();
}

export async function fetchCommunionByBaptismId(baptismId: number): Promise<FirstHolyCommunionResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/baptisms/${baptismId}/communions`, { headers: getAuthHeaders() });
  if (res.status === 404) throw new Error('First Holy Communion not found');
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch communion');
  return res.json();
}

/** Fetches the uploaded communion certificate file (when communion was received in another church). */
export async function fetchCommunionCertificate(communionId: number): Promise<Blob> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/communions/${communionId}/communion-certificate`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) throw new Error('No uploaded communion certificate for this record');
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to load certificate');
  return res.blob();
}

export async function createCommunion(body: FirstHolyCommunionRequest): Promise<FirstHolyCommunionResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/communions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    const text = await res.text();
    throw new Error(text || 'Failed to create communion');
  }
  return res.json();
}

/** Payload for "Baptism from another Parish": saved into the created baptism record. */
export interface ExternalBaptismPayload {
  baptismName: string;
  surname: string;
  otherNames: string;
  gender: string;
  fathersName: string;
  mothersName: string;
  baptisedChurchAddress: string;
}

/** Create only external baptism (with certificate). Returns the created baptism id and certificate path for linking to communion. */
export async function createBaptismWithCertificate(
  parishId: number,
  certificate: File,
  externalBaptism: ExternalBaptismPayload
): Promise<{ id: number; certificatePath: string }> {
  const formData = new FormData();
  formData.set('parishId', String(parishId));
  formData.set('certificate', certificate);
  formData.set('externalBaptismName', externalBaptism.baptismName);
  formData.set('externalSurname', externalBaptism.surname);
  formData.set('externalOtherNames', externalBaptism.otherNames);
  formData.set('externalGender', externalBaptism.gender);
  formData.set('externalFathersName', externalBaptism.fathersName);
  formData.set('externalMothersName', externalBaptism.mothersName);
  formData.set('externalBaptisedChurchAddress', externalBaptism.baptisedChurchAddress);

  const token = getStoredToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetchWithRetry(`${getBaseUrl()}/api/baptisms`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    const text = await res.text();
    let msg = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (typeof json?.error === 'string') msg = json.error;
    } catch {
      if (!text) msg = 'Failed to create baptism';
    }
    throw new Error(msg);
  }
  return res.json();
}

/** Create communion with "Baptism from another Parish": uploads certificate and creates baptism with given details. */
export async function createCommunionWithCertificate(
  parishId: number,
  data: { communionDate: string; officiatingPriest: string; parish: string },
  certificate: File,
  externalBaptism: ExternalBaptismPayload
): Promise<FirstHolyCommunionResponse> {
  const formData = new FormData();
  formData.set('baptismSource', 'external');
  formData.set('parishId', String(parishId));
  formData.set('communionDate', data.communionDate);
  formData.set('officiatingPriest', data.officiatingPriest);
  formData.set('parish', data.parish);
  formData.set('certificate', certificate);
  formData.set('externalBaptismName', externalBaptism.baptismName);
  formData.set('externalSurname', externalBaptism.surname);
  formData.set('externalOtherNames', externalBaptism.otherNames);
  formData.set('externalGender', externalBaptism.gender);
  formData.set('externalFathersName', externalBaptism.fathersName);
  formData.set('externalMothersName', externalBaptism.mothersName);
  formData.set('externalBaptisedChurchAddress', externalBaptism.baptisedChurchAddress);

  const token = getStoredToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  // Do not set Content-Type; browser sets multipart/form-data with boundary

  const res = await fetchWithRetry(`${getBaseUrl()}/api/communions`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    const text = await res.text();
    let msg = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (typeof json?.error === 'string') msg = json.error;
    } catch {
      if (!text) msg = 'Failed to create communion';
    }
    throw new Error(msg);
  }
  return res.json();
}

/**
 * Create communion with "Baptism from another Parish" when the external baptism certificate is not yet available.
 * Same multipart contract as {@link createCommunionWithCertificate} but omits the `certificate` part.
 */
export async function createCommunionWithExternalBaptismPendingProof(
  parishId: number,
  data: { communionDate: string; officiatingPriest: string; parish: string },
  externalBaptism: ExternalBaptismPayload
): Promise<FirstHolyCommunionResponse> {
  const formData = new FormData();
  formData.set('baptismSource', 'external');
  formData.set('parishId', String(parishId));
  formData.set('communionDate', data.communionDate);
  formData.set('officiatingPriest', data.officiatingPriest);
  formData.set('parish', data.parish);
  formData.set('externalBaptismName', externalBaptism.baptismName);
  formData.set('externalSurname', externalBaptism.surname);
  formData.set('externalOtherNames', externalBaptism.otherNames);
  formData.set('externalGender', externalBaptism.gender);
  formData.set('externalFathersName', externalBaptism.fathersName);
  formData.set('externalMothersName', externalBaptism.mothersName);
  formData.set('externalBaptisedChurchAddress', externalBaptism.baptisedChurchAddress);

  const token = getStoredToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetchWithRetry(`${getBaseUrl()}/api/communions`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    const text = await res.text();
    let msg = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (typeof json?.error === 'string') msg = json.error;
    } catch {
      if (!text) msg = 'Failed to create communion';
    }
    throw new Error(msg);
  }
  return res.json();
}

/** Create communion when Holy Communion was in another church: upload communion certificate, link to existing baptism. Optional baptismCertificatePath when baptism was just created with certificate (e.g. from confirmation flow). */
export async function createCommunionWithCommunionCertificate(
  data: { baptismId: number; communionDate: string; officiatingPriest: string; parish: string },
  certificate: File,
  baptismCertificatePath?: string
): Promise<FirstHolyCommunionResponse> {
  const formData = new FormData();
  formData.set('communionSource', 'external');
  formData.set('baptismId', String(data.baptismId));
  formData.set('communionDate', data.communionDate);
  formData.set('officiatingPriest', data.officiatingPriest);
  formData.set('parish', data.parish);
  formData.set('communionCertificate', certificate);
  if (baptismCertificatePath) {
    formData.set('baptismCertificatePath', baptismCertificatePath);
  }

  const token = getStoredToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetchWithRetry(`${getBaseUrl()}/api/communions`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    const text = await res.text();
    let msg = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (typeof json?.error === 'string') msg = json.error;
    } catch {
      if (!text) msg = 'Failed to create communion';
    }
    throw new Error(msg);
  }
  return res.json();
}

export interface ConfirmationResponse {
  id: number;
  createdAt?: string;
  note?: string;
  baptismId: number;
  communionId: number;
  confirmationDate: string;
  officiatingBishop: string;
  parish?: string;
  /** Enriched from baptism when listing by parish */
  baptismName?: string;
  otherNames?: string;
  surname?: string;
  dateOfBirth?: string;
  gender?: string;
  fathersName?: string;
  mothersName?: string;
}

export interface ConfirmationRequest {
  baptismId: number;
  communionId: number;
  confirmationDate: string;
  officiatingBishop: string;
  parish?: string;
}

export async function fetchConfirmations(
  parishId: number,
  page = 0,
  size = 50
): Promise<SacramentPageResponse<ConfirmationResponse>> {
  const shouldUseReferenceCache = page === 0;

  if (shouldUseReferenceCache && !getIsOnline()) {
    const cached = loadCachedConfirmations(parishId, page);
    if (cached) {
      const empty = cached.length === 0;
      return {
        content: cached as unknown as ConfirmationResponse[],
        totalElements: cached.length,
        totalPages: 1,
        size,
        number: page,
        first: true,
        last: true,
        numberOfElements: cached.length,
        empty,
      };
    }
  }

  try {
    const res = await fetchWithRetry(
      `${getBaseUrl()}/api/parishes/${parishId}/confirmations?page=${page}&size=${size}`,
      { headers: getAuthHeaders() }
    );
    if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch confirmations');
    const pageData = normalizePageResponse<ConfirmationResponse>(await res.json() as RawPageResponse<ConfirmationResponse>);

    if (shouldUseReferenceCache) {
      const items = pageData.content.map((c) => ({
        id: c.id,
        baptismName: c.baptismName ?? '',
        otherNames: c.otherNames ?? '',
        surname: c.surname ?? '',
        confirmationDate: c.confirmationDate ?? '',
        officiatingBishop: c.officiatingBishop ?? undefined,
      }));
      saveCachedConfirmations(parishId, page, items);
    }

    return pageData;
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'Unauthorized') throw err;

    if (shouldUseReferenceCache && !getIsOnline()) {
      const cached = loadCachedConfirmations(parishId, page);
      if (cached) {
        const empty = cached.length === 0;
        return {
          content: cached as unknown as ConfirmationResponse[],
          totalElements: cached.length,
          totalPages: 1,
          size,
          number: page,
          first: true,
          last: true,
          numberOfElements: cached.length,
          empty,
        };
      }
    }

    throw err;
  }
}

export async function fetchConfirmation(id: number): Promise<ConfirmationResponse | null> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/confirmations/${id}`, { headers: getAuthHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch confirmation');
  return res.json();
}

export async function fetchConfirmationByCommunionId(communionId: number): Promise<ConfirmationResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/communions/${communionId}/confirmation`, { headers: getAuthHeaders() });
  if (res.status === 404) throw new Error('Confirmation not found for this communion');
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch confirmation');
  return res.json();
}

export async function createConfirmation(body: ConfirmationRequest): Promise<ConfirmationResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/confirmations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    const text = await res.text();
    throw new Error(text || 'Failed to create confirmation');
  }
  return res.json();
}

export interface MarriageResponse {
  id: number;
  createdAt?: string;
  note?: string;
  baptismId?: number;
  communionId?: number;
  confirmationId?: number;
  partnersName: string;
  marriageDate: string;
  marriageTime?: string;
  churchName?: string;
  marriageRegister?: string;
  diocese?: string;
  civilRegistryNumber?: string;
  dispensationGranted?: boolean;
  canonicalNotes?: string;
  officiatingPriest: string;
  parish: string;
  /** Groom and bride when marriage was created with full form (Supabase). */
  parties?: MarriagePartyResponse[];
  witnesses?: MarriageWitnessResponse[];
  /** Enriched fields used by marriages grid view. */
  groomName?: string;
  brideName?: string;
  groomFatherName?: string;
  groomMotherName?: string;
  brideFatherName?: string;
  brideMotherName?: string;
  witnessesDisplay?: string;
}

export interface MarriagePartyResponse {
  id: number;
  marriageId: number;
  role: 'GROOM' | 'BRIDE';
  fullName: string;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  nationality?: string | null;
  residentialAddress?: string | null;
  phone?: string | null;
  email?: string | null;
  occupation?: string | null;
  maritalStatus?: string | null;
  baptismId?: number | null;
  communionId?: number | null;
  confirmationId?: number | null;
  baptismCertificatePath?: string | null;
  communionCertificatePath?: string | null;
  confirmationCertificatePath?: string | null;
  baptismChurch?: string | null;
  communionChurch?: string | null;
  confirmationChurch?: string | null;
}
export interface MarriageWitnessResponse {
  id: number;
  marriageId: number;
  fullName: string;
  phone?: string | null;
  address?: string | null;
  sortOrder: number;
}

export interface MarriageRequest {
  confirmationId: number;
  partnersName: string;
  marriageDate: string;
  officiatingPriest: string;
  parish: string;
}

/** New create marriage payload: groom, bride, marriage details, witnesses */
export interface MarriagePartyPayload {
  fullName: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  residentialAddress?: string;
  phone?: string;
  email?: string;
  occupation?: string;
  maritalStatus?: string;
  baptismId?: number;
  communionId?: number;
  confirmationId?: number;
  baptismCertificatePath?: string;
  communionCertificatePath?: string;
  confirmationCertificatePath?: string;
  baptismChurch?: string;
  communionChurch?: string;
  confirmationChurch?: string;
  baptismSource?: 'this_parish' | 'external';
  communionSource?: 'this_parish' | 'external';
  confirmationSource?: 'this_parish' | 'external';
  externalBaptism?: {
    baptismName: string;
    surname: string;
    otherNames?: string;
    gender: string;
    fathersName: string;
    mothersName: string;
    baptisedChurchAddress?: string;
  };
}

export interface CreateMarriageWithPartiesRequest {
  marriage: {
    partnersName?: string;
    parishId?: number;
    marriageDate: string;
    marriageTime?: string;
    churchName?: string;
    marriageRegister?: string;
    diocese?: string;
    civilRegistryNumber?: string;
    dispensationGranted?: boolean;
    canonicalNotes?: string;
    officiatingPriest: string;
    parish: string;
  };
  groom: MarriagePartyPayload;
  bride: MarriagePartyPayload;
  witnesses: Array<{ fullName: string; phone?: string; address?: string; sortOrder?: number }>;
}

export async function fetchMarriages(
  parishId: number,
  page = 0,
  size = 50
): Promise<SacramentPageResponse<MarriageResponse>> {
  const res = await fetchWithRetry(
    `${getBaseUrl()}/api/parishes/${parishId}/marriages?page=${page}&size=${size}`,
    { headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch marriages');
  return normalizePageResponse<MarriageResponse>(await res.json() as RawPageResponse<MarriageResponse>);
}

export async function fetchMarriage(id: number): Promise<MarriageResponse | null> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/marriages/${id}`, { headers: getAuthHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch marriage');
  return res.json();
}

export async function fetchMarriageByConfirmationId(confirmationId: number): Promise<MarriageResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/confirmations/${confirmationId}/marriage`, { headers: getAuthHeaders() });
  if (res.status === 404) throw new Error('Marriage not found for this confirmation');
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch marriage');
  return res.json();
}

export async function fetchMarriageByBaptismId(baptismId: number): Promise<MarriageResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/baptisms/${baptismId}/marriage`, { headers: getAuthHeaders() });
  if (res.status === 404) throw new Error('Marriage not found for this baptism record');
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch marriage');
  return res.json();
}

export async function updateCommunionNotes(id: number, note: string): Promise<FirstHolyCommunionResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/communions/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to update notes');
  }
  return res.json();
}

export async function fetchCommunionNoteHistory(communionId: number): Promise<BaptismNoteResponse[]> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/communions/${communionId}/notes`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch note history');
  return res.json();
}

export async function updateConfirmationNotes(id: number, note: string): Promise<ConfirmationResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/confirmations/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to update notes');
  }
  return res.json();
}

export async function fetchConfirmationNoteHistory(confirmationId: number): Promise<BaptismNoteResponse[]> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/confirmations/${confirmationId}/notes`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch note history');
  return res.json();
}

export async function updateMarriageNotes(id: number, note: string): Promise<MarriageResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/marriages/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to update notes');
  }
  return res.json();
}

export async function fetchMarriageNoteHistory(marriageId: number): Promise<BaptismNoteResponse[]> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/marriages/${marriageId}/notes`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch note history');
  return res.json();
}

export async function createMarriage(body: MarriageRequest): Promise<MarriageResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/marriages`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to create marriage');
  }
  return res.json();
}

export async function createMarriageWithParties(body: CreateMarriageWithPartiesRequest): Promise<MarriageResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/marriages/with-parties`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    const text = await res.text();
    let msg = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (typeof json?.error === 'string') msg = json.error;
    } catch {
      if (!text) msg = 'Failed to create marriage';
    }
    throw new Error(msg);
  }
  return res.json();
}

/** Upload a marriage certificate (baptism, communion, or confirmation for groom/bride). Returns path to store in form. */
export async function uploadMarriageCertificate(
  parishId: number,
  file: File,
  certificateType: 'baptism' | 'communion' | 'confirmation',
  role: 'groom' | 'bride'
): Promise<{ path: string }> {
  const formData = new FormData();
  formData.set('file', file);
  formData.set('certificateType', certificateType);
  formData.set('role', role);

  const token = getStoredToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetchWithRetry(
    `${getBaseUrl()}/api/parishes/${parishId}/marriages/upload-certificate`,
    { method: 'POST', headers, body: formData }
  );
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (typeof json?.error === 'string') msg = json.error;
    } catch {
      if (!text) msg = 'Failed to upload certificate';
    }
    throw new Error(msg);
  }
  return res.json();
}

/** Fetches uploaded marriage-party certificate (baptism, communion, confirmation) for groom/bride. */
export async function fetchMarriagePartyCertificate(
  marriageId: number,
  role: 'groom' | 'bride',
  type: 'baptism' | 'communion' | 'confirmation'
): Promise<Blob> {
  const res = await fetchWithRetry(
    `${getBaseUrl()}/api/marriages/${marriageId}/party-certificate?role=${role}&type=${type}`,
    { headers: getAuthHeaders() }
  );
  if (res.status === 404) throw new Error('No uploaded certificate for this party');
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to load certificate');
  return res.blob();
}

export interface HolyOrderResponse {
  id: number;
  baptismId: number;
  communionId: number;
  confirmationId: number;
  ordinationDate: string;
  orderType: string;
  officiatingBishop: string;
  parishId?: number;
}

export interface HolyOrderRequest {
  confirmationId: number;
  ordinationDate: string;
  orderType: string;
  officiatingBishop: string;
  parishId?: number;
}

export async function fetchHolyOrders(
  parishId: number,
  page = 0,
  size = 50
): Promise<SacramentPageResponse<HolyOrderResponse>> {
  const res = await fetchWithRetry(
    `${getBaseUrl()}/api/parishes/${parishId}/holy-orders?page=${page}&size=${size}`,
    { headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch holy orders');
  return normalizePageResponse<HolyOrderResponse>(await res.json() as RawPageResponse<HolyOrderResponse>);
}

export async function fetchHolyOrder(id: number): Promise<HolyOrderResponse | null> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/holy-orders/${id}`, { headers: getAuthHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch holy order');
  return res.json();
}

export async function fetchHolyOrderByConfirmationId(confirmationId: number): Promise<HolyOrderResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/confirmations/${confirmationId}/holy-order`, { headers: getAuthHeaders() });
  if (res.status === 404) throw new Error('Holy Order not found for this confirmation');
  if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch holy order');
  return res.json();
}

export async function createHolyOrder(body: HolyOrderRequest): Promise<HolyOrderResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/holy-orders`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    const text = await res.text();
    throw new Error(text || 'Failed to create holy order');
  }
  return res.json();
}

/** Admin: user parish access management */
export interface UserParishAccessResponse {
  userId: number;
  username: string;
  displayName: string | null;
  role: string | null;
  defaultParishId: number | null;
  parishAccessIds: number[];
}

export interface ReplaceUserParishAccessRequest {
  parishIds: number[];
  defaultParishId?: number | null;
}

export async function listUsersWithParishAccess(): Promise<UserParishAccessResponse[]> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/admin/users/parish-access`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch users');
  }
  const raw = await res.json();
  if (!Array.isArray(raw)) return [];
  return raw.map((u: any) => ({
    userId: Number(u.userId),
    username: String(u.username ?? ''),
    displayName: u.displayName ?? null,
    role: u.role ?? null,
    defaultParishId: u.defaultParishId != null ? Number(u.defaultParishId) : null,
    parishAccessIds: Array.isArray(u.parishAccessIds)
      ? u.parishAccessIds.map((id: unknown) => Number(id)).filter((n: number) => !Number.isNaN(n) && n > 0)
      : [],
  }));
}

export async function searchUsersWithParishAccess(
  query: string,
  page = 0,
  size = 20
): Promise<SacramentPageResponse<UserParishAccessResponse>> {
  const params = new URLSearchParams({
    q: query.trim(),
    page: String(page),
    size: String(size),
    sort: 'username,asc',
  });
  const res = await fetchWithRetry(`${getBaseUrl()}/api/admin/users/parish-access/search?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch users');
  }
  return normalizePageResponse<UserParishAccessResponse>(
    await res.json() as RawPageResponse<UserParishAccessResponse>
  );
}

export async function getUserParishAccess(userId: number): Promise<UserParishAccessResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/admin/users/${userId}/parish-access`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    if (res.status === 404) throw new Error('User not found');
    throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch user');
  }
  const u = await res.json();
  return {
    userId: Number(u.userId),
    username: String(u.username ?? ''),
    displayName: u.displayName ?? null,
    role: u.role ?? null,
    defaultParishId: u.defaultParishId != null ? Number(u.defaultParishId) : null,
    parishAccessIds: Array.isArray(u.parishAccessIds)
      ? u.parishAccessIds.map((id: unknown) => Number(id)).filter((n: number) => !Number.isNaN(n) && n > 0)
      : [],
  };
}

export interface CreateUserRequest {
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  title?: string;
  role: string;
  defaultParishId?: number | null;
  parishIds: number[];
  defaultPassword: string;
}

export interface IssueUserInvitationResponse {
  invitationId: number;
  userId: number;
  invitedEmail: string;
  token?: string | null;
  expiresAt: string;
  invitationStatus?: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED' | null;
  emailDeliveryStatus?: 'PENDING' | 'SENT' | 'FAILED' | null;
  lastEmailAttemptAt?: string | null;
  lastEmailError?: string | null;
  emailSentAt?: string | null;
  deliveryMessage?: string | null;
}

function mapIssueUserInvitationResponse(payload: any): IssueUserInvitationResponse {
  return {
    invitationId: Number(payload?.invitationId),
    userId: Number(payload?.userId),
    invitedEmail: String(payload?.invitedEmail ?? ''),
    token: payload?.token == null ? null : String(payload.token),
    expiresAt: String(payload?.expiresAt ?? ''),
    invitationStatus:
      payload?.invitationStatus === 'PENDING' ||
      payload?.invitationStatus === 'ACCEPTED' ||
      payload?.invitationStatus === 'REVOKED' ||
      payload?.invitationStatus === 'EXPIRED'
        ? payload.invitationStatus
        : null,
    emailDeliveryStatus:
      payload?.emailDeliveryStatus === 'PENDING' ||
      payload?.emailDeliveryStatus === 'SENT' ||
      payload?.emailDeliveryStatus === 'FAILED'
        ? payload.emailDeliveryStatus
        : null,
    lastEmailAttemptAt: payload?.lastEmailAttemptAt == null ? null : String(payload.lastEmailAttemptAt),
    lastEmailError: payload?.lastEmailError == null ? null : String(payload.lastEmailError),
    emailSentAt: payload?.emailSentAt == null ? null : String(payload.emailSentAt),
    deliveryMessage: payload?.deliveryMessage == null ? null : String(payload.deliveryMessage),
  };
}

export async function createUser(request: CreateUserRequest): Promise<UserParishAccessResponse> {
  const body: Record<string, unknown> = {
    username: request.username,
    firstName: request.firstName,
    lastName: request.lastName,
    role: request.role,
    parishIds: request.parishIds,
    defaultPassword: request.defaultPassword,
  };
  if (request.email != null && request.email.trim() !== '') {
    body.email = request.email.trim();
  }
  if (request.title != null && request.title.trim() !== '') {
    body.title = request.title.trim();
  }
  if (request.defaultParishId != null && request.defaultParishId > 0) {
    body.defaultParishId = request.defaultParishId;
  }
  const res = await fetchWithRetry(`${getBaseUrl()}/api/admin/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseErrorResponse(text, 'Failed to create user'));
  }
  const u = await res.json();
  return {
    userId: Number(u.userId),
    username: String(u.username ?? ''),
    displayName: u.displayName ?? null,
    role: u.role ?? null,
    defaultParishId: u.defaultParishId != null ? Number(u.defaultParishId) : null,
    parishAccessIds: Array.isArray(u.parishAccessIds)
      ? u.parishAccessIds.map((id: unknown) => Number(id)).filter((n: number) => !Number.isNaN(n) && n > 0)
      : [],
  };
}

export async function issueUserInvitation(userId: number): Promise<IssueUserInvitationResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/admin/users/invitations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseErrorResponse(text, 'Failed to issue invitation'));
  }
  const payload = await res.json();
  return mapIssueUserInvitationResponse(payload);
}

export async function resendUserInvitation(invitationId: number): Promise<IssueUserInvitationResponse> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/admin/users/invitations/${invitationId}/resend`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseErrorResponse(text, 'Failed to resend invitation'));
  }
  const payload = await res.json();
  return mapIssueUserInvitationResponse(payload);
}

export async function getLatestUserInvitation(userId: number): Promise<IssueUserInvitationResponse | null> {
  const res = await fetchWithRetry(`${getBaseUrl()}/api/admin/users/${userId}/invitation/latest`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseErrorResponse(text, 'Failed to load latest invitation'));
  }
  const payload = await res.json();
  return mapIssueUserInvitationResponse(payload);
}

export async function replaceUserParishAccess(
  userId: number,
  request: ReplaceUserParishAccessRequest
): Promise<UserParishAccessResponse> {
  const body: any = { parishIds: request.parishIds };
  if (request.defaultParishId != null && request.defaultParishId > 0) {
    body.defaultParishId = request.defaultParishId;
  }
  const res = await fetchWithRetry(`${getBaseUrl()}/api/admin/users/${userId}/parish-access`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const json = JSON.parse(text) as { message?: string };
      if (typeof json?.message === 'string') msg = json.message;
    } catch {
      if (!text) msg = 'Failed to update parish access';
    }
    throw new Error(msg);
  }
  const u = await res.json();
  return {
    userId: Number(u.userId),
    username: String(u.username ?? ''),
    displayName: u.displayName ?? null,
    role: u.role ?? null,
    defaultParishId: u.defaultParishId != null ? Number(u.defaultParishId) : null,
    parishAccessIds: Array.isArray(u.parishAccessIds)
      ? u.parishAccessIds.map((id: unknown) => Number(id)).filter((n: number) => !Number.isNaN(n) && n > 0)
      : [],
  };
}
