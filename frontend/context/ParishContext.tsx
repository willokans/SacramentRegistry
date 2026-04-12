'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AUTH_SIGNED_IN_EVENT,
  AUTH_SIGNED_OUT_EVENT,
  clearAuth,
  fetchDiocesesWithParishes,
  getStoredDioceseId,
  getStoredParishId,
  getStoredSidebarCountryKey,
  getStoredToken,
  setStoredDioceseId,
  setStoredParishId,
  setStoredSidebarCountryKey,
  type DioceseWithParishesResponse,
  type ParishResponse,
} from '@/lib/api';
import { sameNumericId } from '@/lib/sameNumericId';
import { dioceseSidebarCountryKey } from '@/lib/sidebarCountryFilter';
import { getIsOnline } from '@/lib/offline/network';
import {
  loadCachedDioceseWithParishes,
  loadCachedDioceseWithParishesByParishId,
  saveCachedDioceseWithParishes,
} from '@/lib/offline/referenceCache';

type ParishContextValue = {
  parishId: number | null;
  setParishId: (id: number | null) => void;
  dioceseId: number | null;
  setDioceseId: (id: number | null) => void;
  /** `null` = all countries (sidebar filter). */
  sidebarCountryKey: string | null;
  setSidebarCountryKey: (key: string | null) => void;
  parishes: ParishResponse[];
  dioceses: DioceseWithParishesResponse[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const ParishContext = createContext<ParishContextValue | null>(null);

export function ParishProvider({ children }: { children: React.ReactNode }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [parishId, setParishIdState] = useState<number | null>(null);
  const [dioceseId, setDioceseIdState] = useState<number | null>(null);
  const [dioceses, setDioceses] = useState<DioceseWithParishesResponse[]>([]);
  const [allParishes, setAllParishes] = useState<ParishResponse[]>([]);
  const [sidebarCountryKey, setSidebarCountryKeyState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setSidebarCountryKey = useCallback((key: string | null) => {
    const normalized = key == null || key === '' ? null : key;
    setSidebarCountryKeyState(normalized);
    setStoredSidebarCountryKey(normalized);
  }, []);

  const parishes = useMemo(() => {
    if (dioceseId != null) {
      return allParishes.filter((p) => Number(p.dioceseId) === Number(dioceseId));
    }
    if (sidebarCountryKey == null) return allParishes;
    return allParishes.filter((p) => {
      const row = dioceses.find((d) => Number(d.id) === Number(p.dioceseId));
      return row != null && dioceseSidebarCountryKey(row) === sidebarCountryKey;
    });
  }, [allParishes, dioceseId, dioceses, sidebarCountryKey]);

  const refetch = useCallback(() => {
    setRefreshTrigger((t) => t + 1);
  }, []);

  const setParishId = useCallback((id: number | null) => {
    setParishIdState(id);
    setStoredParishId(id);
  }, []);

  const setDioceseId = useCallback((id: number | null) => {
    setDioceseIdState(id);
    setStoredDioceseId(id);
  }, []);

  /** Drop stale country filter (e.g. localStorage) so the Country select never uses a value with no matching option (renders blank). */
  useEffect(() => {
    if (sidebarCountryKey == null || dioceses.length === 0) return;
    const exists = dioceses.some((d) => dioceseSidebarCountryKey(d) === sidebarCountryKey);
    if (!exists) {
      setSidebarCountryKey(null);
    }
  }, [dioceses, sidebarCountryKey, setSidebarCountryKey]);

  useEffect(() => {
    function onSignedIn() {
      setRefreshTrigger((t) => t + 1);
    }
    function onSignedOut() {
      setDioceses([]);
      setAllParishes([]);
      setParishIdState(null);
      setDioceseIdState(null);
      setSidebarCountryKeyState(null);
      setStoredSidebarCountryKey(null);
      setError(null);
      setLoading(false);
    }
    window.addEventListener(AUTH_SIGNED_IN_EVENT, onSignedIn);
    window.addEventListener(AUTH_SIGNED_OUT_EVENT, onSignedOut);
    return () => {
      window.removeEventListener(AUTH_SIGNED_IN_EVENT, onSignedIn);
      window.removeEventListener(AUTH_SIGNED_OUT_EVENT, onSignedOut);
    };
  }, []);

  useEffect(() => {
    if (!getStoredToken()) {
      setDioceses([]);
      setAllParishes([]);
      setParishIdState(null);
      setDioceseIdState(null);
      setSidebarCountryKeyState(null);
      setStoredSidebarCountryKey(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setError('Request timed out. Check the console and ensure the dev server is running.');
      }
    }, 15000);
    (async () => {
      try {
        const fetchedDioceses = await fetchDiocesesWithParishes();
        if (cancelled) return;
        const flatParishes: ParishResponse[] = fetchedDioceses.flatMap((d) => d.parishes ?? []);
        setDioceses(fetchedDioceses);
        setAllParishes(flatParishes);

        const storedDiocese = getStoredDioceseId();
        const validDiocese =
          storedDiocese != null && fetchedDioceses.some((d) => sameNumericId(d.id, storedDiocese))
            ? storedDiocese
            : null;

        let storedCountry = getStoredSidebarCountryKey();
        if (storedCountry != null && !fetchedDioceses.some((d) => dioceseSidebarCountryKey(d) === storedCountry)) {
          storedCountry = null;
        }
        if (storedCountry != null && validDiocese != null) {
          const dioceseRow = fetchedDioceses.find((d) => sameNumericId(d.id, validDiocese));
          if (dioceseRow && dioceseSidebarCountryKey(dioceseRow) !== storedCountry) {
            storedCountry = null;
          }
        }
        setSidebarCountryKeyState(storedCountry);
        setStoredSidebarCountryKey(storedCountry);

        setDioceseIdState(validDiocese);
        if (validDiocese != null) setStoredDioceseId(validDiocese);

        const parishInReconciledCountry = (p: ParishResponse) => {
          if (storedCountry == null) return true;
          const dr = fetchedDioceses.find((d) => Number(d.id) === Number(p.dioceseId));
          return dr != null && dioceseSidebarCountryKey(dr) === storedCountry;
        };
        const parishesForSelection =
          validDiocese != null
            ? flatParishes.filter((p) => Number(p.dioceseId) === Number(validDiocese))
            : flatParishes.filter(parishInReconciledCountry);
        const stored = getStoredParishId();
        let selectedParishId: number | null = null;
        if (stored !== null && parishesForSelection.some((p) => sameNumericId(p.id, stored))) {
          selectedParishId = stored;
          setParishIdState(stored);
        } else if (parishesForSelection.length > 0) {
          const first = parishesForSelection[0].id;
          selectedParishId = first;
          setParishIdState(first);
          setStoredParishId(first);
        } else {
          setParishIdState(null);
        }

        // Persist only the active diocese/parishes for offline reference (small, TTL-capped).
        const activeDioceseForCache =
          validDiocese ??
          (selectedParishId != null
            ? flatParishes.find((p) => sameNumericId(p.id, selectedParishId))?.dioceseId
            : null);
        if (activeDioceseForCache != null) {
          const dioceseEntry = fetchedDioceses.find((d) => sameNumericId(d.id, activeDioceseForCache));
          const dioceseName = dioceseEntry?.dioceseName ?? '';
          const parishesToCache = flatParishes
            .filter((p) => Number(p.dioceseId) === Number(activeDioceseForCache))
            .map((p) => ({
            id: p.id,
            parishName: p.parishName,
            dioceseId: p.dioceseId,
          }));
          saveCachedDioceseWithParishes(activeDioceseForCache, dioceseName, parishesToCache);
        }
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : 'Failed to load parishes';
          if (message === 'Unauthorized') {
            clearAuth();
            setDioceses([]);
            setAllParishes([]);
            setParishIdState(null);
            setDioceseIdState(null);
            setError('Session expired. Please sign in again.');
            return;
          }

          // Offline fallback: only load the active parish/diocese cached references.
          if (!getIsOnline()) {
            const storedDiocese = getStoredDioceseId();
            const storedParish = getStoredParishId();

            const cached =
              storedDiocese != null
                ? loadCachedDioceseWithParishes(storedDiocese)
                : null;
            const cachedByParish =
              !cached && storedParish != null ? loadCachedDioceseWithParishesByParishId(storedParish) : null;
            const entry = cached ?? cachedByParish;

            if (entry && entry.parishes.length > 0) {
              const cachedParishes: ParishResponse[] = entry.parishes.map((p) => ({
                id: p.id,
                parishName: p.parishName,
                dioceseId: p.dioceseId,
              }));

              const cachedDioceses: DioceseWithParishesResponse[] = [
                {
                  id: entry.dioceseId,
                  dioceseName: entry.dioceseName,
                  parishes: cachedParishes,
                },
              ];

              setDioceses(cachedDioceses);
              setAllParishes(cachedParishes);
              setDioceseIdState(entry.dioceseId);
              const nextParishId =
                storedParish != null && entry.parishes.some((p) => sameNumericId(p.id, storedParish))
                  ? storedParish
                  : entry.parishes[0]?.id ?? null;

              if (nextParishId != null) setStoredParishId(nextParishId);
              setParishIdState(nextParishId);
              // Keep diocese selection consistent for future loads.
              setStoredDioceseId(entry.dioceseId);
              setError(null);
              return;
            }
          }

          setError(message);
        }
      } finally {
        if (!cancelled) {
          window.clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [refreshTrigger]);

  useEffect(() => {
    if (dioceseId == null || sidebarCountryKey == null) return;
    const row = dioceses.find((d) => Number(d.id) === Number(dioceseId));
    if (!row || dioceseSidebarCountryKey(row) !== sidebarCountryKey) {
      setDioceseId(null);
    }
  }, [sidebarCountryKey, dioceseId, dioceses, setDioceseId]);

  useEffect(() => {
    if (parishes.length === 0) {
      if (parishId != null) {
        setParishIdState(null);
        setStoredParishId(null);
      }
      return;
    }
    // After an empty diocese cleared parishId, or first paint with a diocese filter, pick a default parish.
    if (parishId == null) {
      const first = parishes[0].id;
      setParishIdState(first);
      setStoredParishId(first);
      return;
    }
    if (!parishes.some((p) => sameNumericId(p.id, parishId))) {
      const first = parishes[0].id;
      setParishIdState(first);
      setStoredParishId(first);
    }
  }, [dioceseId, parishId, parishes]);

  const value: ParishContextValue = {
    parishId,
    setParishId,
    dioceseId,
    setDioceseId,
    sidebarCountryKey,
    setSidebarCountryKey,
    parishes,
    dioceses,
    loading,
    error,
    refetch,
  };

  return (
    <ParishContext.Provider value={value}>
      {children}
    </ParishContext.Provider>
  );
}

export function useParish(): ParishContextValue {
  const ctx = useContext(ParishContext);
  if (!ctx) {
    throw new Error('useParish must be used within ParishProvider');
  }
  return ctx;
}
