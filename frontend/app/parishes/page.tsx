'use client';

import { useEffect, useMemo, useState } from 'react';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { useParish } from '@/context/ParishContext';
import {
  fetchDioceses,
  fetchDiocesesWithParishes,
  fetchParishes,
  createDiocese,
  createParish,
  type DioceseResponse,
  type ParishResponse,
} from '@/lib/api';
import { COUNTRY_OPTIONS } from '@/lib/location-data';

export default function ParishesPage() {
  const { refetch } = useParish();
  const [dioceses, setDioceses] = useState<DioceseResponse[]>([]);
  const [parishesByDiocese, setParishesByDiocese] = useState<Record<number, ParishResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState('');
  const [selectedDioceseId, setSelectedDioceseId] = useState<number | null>(null);
  const [selectedParishId, setSelectedParishId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDiocese, setShowCreateDiocese] = useState(false);
  const [showAddParish, setShowAddParish] = useState(false);
  const [newDioceseName, setNewDioceseName] = useState('');
  const [newParishName, setNewParishName] = useState('');
  const [addingDiocese, setAddingDiocese] = useState(false);
  const [addingParish, setAddingParish] = useState(false);

  const selectedCountryName = useMemo(
    () => COUNTRY_OPTIONS.find((country) => country.code === countryCode)?.name ?? '',
    [countryCode],
  );

  const diocesesInCountry = useMemo(() => {
    if (!countryCode) return [];
    const selectedCountryNameNormalized = selectedCountryName.trim().toLowerCase();
    const normalizeDioceseName = (name: string | undefined) => (name ?? '').trim().toLowerCase();
    const countryMatches = dioceses
      .filter((diocese) => {
        const dioceseCountryCode = (diocese.countryCode ?? '').trim().toUpperCase();
        if (dioceseCountryCode === countryCode) return true;

        // Backward compatibility: only bind legacy dioceses to this country when we can infer it safely.
        if (!dioceseCountryCode) {
          const dioceseCountryName = (diocese.countryName ?? '').trim().toLowerCase();
          if (dioceseCountryName && dioceseCountryName === selectedCountryNameNormalized) {
            return true;
          }
          const normalizedName = normalizeDioceseName(diocese.name);
          const hasSameNameInSelectedCountry = dioceses.some((candidate) => {
            const candidateCode = (candidate.countryCode ?? '').trim().toUpperCase();
            if (candidateCode !== countryCode) return false;
            return normalizeDioceseName(candidate.name) === normalizedName;
          });
          return hasSameNameInSelectedCountry;
        }
        return false;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Deduplicate same-name dioceses, preferring the record with existing parishes.
    const byName = new Map<string, DioceseResponse>();
    for (const diocese of countryMatches) {
      const key = diocese.name.trim().toLowerCase();
      const current = byName.get(key);
      if (!current) {
        byName.set(key, diocese);
        continue;
      }
      const currentCount = (parishesByDiocese[current.id] ?? []).length;
      const nextCount = (parishesByDiocese[diocese.id] ?? []).length;
      if (nextCount > currentCount) {
        byName.set(key, diocese);
      }
    }

    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [countryCode, selectedCountryName, dioceses, parishesByDiocese]);

  const selectedDiocese = useMemo(
    () => diocesesInCountry.find((diocese) => diocese.id === selectedDioceseId) ?? null,
    [diocesesInCountry, selectedDioceseId],
  );

  const selectedDioceseParishes = useMemo(
    () => (selectedDioceseId ? (parishesByDiocese[selectedDioceseId] ?? []) : []),
    [selectedDioceseId, parishesByDiocese],
  );

  const filteredDioceses = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return diocesesInCountry;
    return diocesesInCountry.filter((diocese) => diocese.name.toLowerCase().includes(normalizedQuery));
  }, [diocesesInCountry, searchQuery]);

  const filteredParishes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return selectedDioceseParishes;
    return selectedDioceseParishes.filter((parish) => parish.parishName.toLowerCase().includes(normalizedQuery));
  }, [selectedDioceseParishes, searchQuery]);

  const selectedParish = useMemo(
    () => selectedDioceseParishes.find((parish) => parish.id === selectedParishId) ?? null,
    [selectedDioceseParishes, selectedParishId],
  );

  const loadAllDiocesesAndParishes = async () => {
    const [list, withParishes] = await Promise.all([fetchDioceses(), fetchDiocesesWithParishes()]);
    setDioceses(list);

    const byDiocese: Record<number, ParishResponse[]> = {};
    for (const diocese of withParishes) {
      byDiocese[diocese.id] = diocese.parishes ?? [];
    }
    setParishesByDiocese(byDiocese);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [list, withParishes] = await Promise.all([fetchDioceses(), fetchDiocesesWithParishes()]);
        if (cancelled) return;
        setDioceses(list);
        const byDiocese: Record<number, ParishResponse[]> = {};
        for (const diocese of withParishes) {
          byDiocese[diocese.id] = diocese.parishes ?? [];
        }
        setParishesByDiocese(byDiocese);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setSelectedDioceseId(null);
    setSelectedParishId(null);
    setShowAddParish(false);
    setSearchQuery('');
  }, [countryCode]);

  useEffect(() => {
    setSelectedParishId(null);
    setShowAddParish(false);
    setSearchQuery('');
  }, [selectedDioceseId]);

  async function ensureParishesLoaded(dioceseId: number) {
    if ((parishesByDiocese[dioceseId] ?? []).length > 0) return;
    const parishes = await fetchParishes(dioceseId);
    setParishesByDiocese((prev) => ({ ...prev, [dioceseId]: parishes }));
  }

  async function handleSelectDiocese(dioceseId: number) {
    setSelectedDioceseId(dioceseId);
    setError(null);
    try {
      await ensureParishesLoaded(dioceseId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load parishes');
    }
  }

  async function handleAddDiocese(e: React.FormEvent) {
    e.preventDefault();
    const name = newDioceseName.trim();
    if (!name) return;
    setAddingDiocese(true);
    setError(null);
    try {
      const created = await createDiocese(name, {
        countryCode,
        countryName: selectedCountryName,
      });
      setNewDioceseName('');
      setShowCreateDiocese(false);
      await loadAllDiocesesAndParishes();
      if (created?.id) {
        await handleSelectDiocese(created.id);
      }
      refetch();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to add diocese';
      if (message.toLowerCase().includes('already exists')) {
        const existing = dioceses.find((diocese) => diocese.name.trim().toLowerCase() === name.toLowerCase());
        if (existing) {
          await handleSelectDiocese(existing.id);
          setShowCreateDiocese(false);
          setError('Diocese already exists. Selected it so you can add a parish.');
          return;
        }
      }
      setError(message);
    } finally {
      setAddingDiocese(false);
    }
  }

  async function handleAddParish(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDioceseId) return;
    const parishName = newParishName.trim();
    if (!parishName) return;
    setAddingParish(true);
    setError(null);
    try {
      const created = await createParish(selectedDioceseId, parishName);
      setNewParishName('');
      setShowAddParish(false);
      const parishes = await fetchParishes(selectedDioceseId);
      setParishesByDiocese((prev) => ({ ...prev, [selectedDioceseId]: parishes }));
      if (created?.id) {
        setSelectedParishId(created.id);
      }
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add parish');
    } finally {
      setAddingParish(false);
    }
  }

  if (loading) {
    return (
      <AuthenticatedLayout>
        <p className="text-gray-600">Loading…</p>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <h1 className="text-2xl font-serif font-semibold text-sancta-maroon">
        Dioceses & Parishes
      </h1>
      <p className="mt-2 text-gray-600">
        Select a country, then drill down into dioceses and parishes.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-red-600">
          {error}
        </p>
      )}

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-end">
          <div>
            <label htmlFor="diocese-country" className="block text-sm font-medium text-gray-700">
              Country
            </label>
            <select
              id="diocese-country"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.trim().toUpperCase())}
              disabled={addingDiocese}
            >
              <option value="">Select country</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
          <span className="hidden text-gray-400 md:block">›</span>
          <div>
            <label htmlFor="diocese-select" className="block text-sm font-medium text-gray-700">
              Diocese
            </label>
            <select
              id="diocese-select"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
              value={selectedDioceseId ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) {
                  setSelectedDioceseId(null);
                  return;
                }
                void handleSelectDiocese(Number(value));
              }}
              disabled={!countryCode}
            >
              <option value="">Select diocese</option>
              {diocesesInCountry.map((diocese) => (
                <option key={diocese.id} value={diocese.id}>
                  {diocese.name}
                  {(() => {
                    const parishCount = (parishesByDiocese[diocese.id] ?? []).length;
                    return parishCount > 0 ? ` (${parishCount})` : '';
                  })()}
                </option>
              ))}
            </select>
          </div>
          <span className="hidden text-gray-400 md:block">›</span>
          <div>
            <label htmlFor="parish-select" className="block text-sm font-medium text-gray-700">
              Parish
            </label>
            <select
              id="parish-select"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
              value={selectedParishId ?? ''}
              onChange={(e) => setSelectedParishId(e.target.value ? Number(e.target.value) : null)}
              disabled={!selectedDioceseId}
            >
              <option value="">Select parish (optional)</option>
              {selectedDioceseParishes.map((parish) => (
                <option key={parish.id} value={parish.id}>
                  {parish.parishName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <label htmlFor="directory-search" className="block text-sm font-medium text-gray-700">
              {selectedDiocese ? `Search parishes in ${selectedDiocese.name}` : 'Search dioceses'}
            </label>
            <input
              id="directory-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                selectedDiocese
                  ? `Search parishes in ${selectedDiocese.name}...`
                  : selectedCountryName
                    ? `Search dioceses in ${selectedCountryName}...`
                    : 'Select a country to begin'
              }
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
              disabled={!countryCode}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowCreateDiocese((previous) => !previous)}
            disabled={!countryCode || addingDiocese}
            className="rounded-lg border border-sancta-maroon px-4 py-2 font-medium text-sancta-maroon hover:bg-sancta-maroon/5 disabled:opacity-50"
          >
            + Create Diocese
          </button>
          <button
            type="button"
            onClick={() => setShowAddParish((previous) => !previous)}
            disabled={!selectedDioceseId || addingParish}
            className="rounded-lg bg-sancta-maroon px-4 py-2 text-white font-medium hover:bg-sancta-maroon-dark disabled:opacity-50"
          >
            + Add Parish
          </button>
        </div>

        {showCreateDiocese ? (
          <form onSubmit={handleAddDiocese} className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="min-w-[240px] flex-1">
              <label htmlFor="new-diocese-name" className="block text-sm font-medium text-gray-700">
                Diocese name
              </label>
              <input
                id="new-diocese-name"
                type="text"
                value={newDioceseName}
                onChange={(e) => setNewDioceseName(e.target.value)}
                placeholder={`Create diocese in ${selectedCountryName || 'selected country'}`}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
                disabled={addingDiocese}
              />
            </div>
            <button
              type="submit"
              disabled={addingDiocese || !newDioceseName.trim() || !countryCode}
              className="rounded-lg bg-sancta-maroon px-4 py-2 text-white font-medium hover:bg-sancta-maroon-dark disabled:opacity-50"
            >
              {addingDiocese ? 'Creating...' : 'Create Diocese'}
            </button>
          </form>
        ) : null}

        {showAddParish ? (
          <form onSubmit={handleAddParish} className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="min-w-[240px] flex-1">
              <label htmlFor="new-parish-name" className="block text-sm font-medium text-gray-700">
                Parish name
              </label>
              <input
                id="new-parish-name"
                type="text"
                value={newParishName}
                onChange={(e) => setNewParishName(e.target.value)}
                placeholder={selectedDiocese ? `Add parish under ${selectedDiocese.name}` : 'Select a diocese first'}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
                disabled={addingParish || !selectedDioceseId}
              />
            </div>
            <button
              type="submit"
              disabled={addingParish || !newParishName.trim() || !selectedDioceseId}
              className="rounded-lg bg-sancta-maroon px-4 py-2 text-white font-medium hover:bg-sancta-maroon-dark disabled:opacity-50"
            >
              {addingParish ? 'Adding...' : 'Add Parish'}
            </button>
          </form>
        ) : null}
      </section>

      <section className="mt-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {selectedDiocese ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-sancta-maroon">
                Parishes in {selectedDiocese.name}
              </h2>
              <span className="rounded-full bg-sancta-maroon/10 px-3 py-1 text-sm font-medium text-sancta-maroon">
                {filteredParishes.length} parish{filteredParishes.length === 1 ? '' : 'es'}
              </span>
            </div>
            <ul className="mt-4 space-y-2" role="list">
              {filteredParishes.map((parish) => (
                <li key={parish.id} className="rounded-lg border border-gray-200 px-3 py-2">
                  <p className="font-medium text-gray-900">{parish.parishName}</p>
                </li>
              ))}
            </ul>
            {filteredParishes.length === 0 ? (
              <p className="mt-3 text-sm text-gray-600">
                {selectedDioceseParishes.length === 0
                  ? 'No parishes yet for this diocese. Use Add Parish to create the first one.'
                  : 'No parishes match your search.'}
              </p>
            ) : null}
            {selectedParish ? (
              <p className="mt-3 text-sm text-gray-600">
                Selected parish: <span className="font-medium text-gray-800">{selectedParish.parishName}</span>
              </p>
            ) : null}
          </>
        ) : countryCode ? (
          <>
            <h2 className="text-xl font-semibold text-sancta-maroon">
              Dioceses in {selectedCountryName}
            </h2>
            {filteredDioceses.length === 0 ? (
              <p className="mt-3 text-sm text-gray-600">
                {searchQuery.trim()
                  ? 'No dioceses match your search.'
                  : 'No dioceses found for this country yet.'}
              </p>
            ) : (
              <ul className="mt-4 space-y-2" role="list">
                {filteredDioceses.map((diocese) => (
                  <li key={diocese.id}>
                    <button
                      type="button"
                      onClick={() => void handleSelectDiocese(diocese.id)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left transition hover:border-sancta-maroon/60"
                    >
                      <p className="font-medium text-gray-900">{diocese.name}</p>
                      {diocese.ordinaryName ? (
                        <p className="text-sm text-gray-600">
                          {diocese.ordinaryTitle ? `${diocese.ordinaryTitle} ` : ''}
                          {diocese.ordinaryName}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-gray-600">
            Select a country to start drilling down into dioceses and parishes.
          </p>
        )}
      </section>
    </AuthenticatedLayout>
  );
}
