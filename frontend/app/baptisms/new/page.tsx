'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import AddRecordDesktopOnlyMessage from '@/components/AddRecordDesktopOnlyMessage';
import { useParish } from '@/context/ParishContext';
import { createBaptism, getStoredUser, uploadBaptismBirthCertificate, type BaptismRequest } from '@/lib/api';
import {
  formatParentAddress,
  getRegionsForCountry,
  resolveCountryCode,
  searchCountries,
} from '@/lib/location-data';
import { deleteDraft, loadDraft, saveDraft, type OfflineDraftRecord } from '@/lib/offline/drafts';
import { useDebouncedDraftAutosave } from '@/lib/offline/draftAutosave';
import { useNetworkStatus } from '@/lib/offline/network';
import { enqueueOfflineSubmission } from '@/lib/offline/queue';
import { useOfflineQueueItem } from '@/lib/offline/useOfflineQueueItem';
import OfflineQueueItemStatus from '@/components/offline/OfflineQueueItemStatus';
import { deleteQueueItemAfterSync, retryOfflineQueueItem } from '@/lib/offline/replay';

type SponsorRow = { firstName: string; lastName: string };
const MAX_BIRTH_CERTIFICATE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_BIRTH_CERTIFICATE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export default function BaptismCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dioceses } = useParish();
  const parishIdParam = searchParams.get('parishId');
  const parishId = parishIdParam ? parseInt(parishIdParam, 10) : null;
  const hasSetPlaceOfBaptismDefault = useRef(false);

  const storedUser = getStoredUser();
  const draftId =
    parishId != null && !Number.isNaN(parishId) && storedUser?.username
      ? `baptism_create:${parishId}:${storedUser.username}`
      : null;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBaptismId, setCreatedBaptismId] = useState<number | null>(null);
  const [queuedItemId, setQueuedItemId] = useState<string | null>(null);
  const [draftRecord, setDraftRecord] = useState<OfflineDraftRecord<BaptismDraftPayload> | null>(null);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [birthCertificateFile, setBirthCertificateFile] = useState<File | null>(null);
  const [birthCertificateError, setBirthCertificateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    baptismName: '',
    otherNames: '',
    surname: '',
    gender: 'MALE',
    dateOfBirth: '',
    fathersName: '',
    mothersName: '',
    officiatingPriest: '',
    placeOfBirth: '',
    placeOfBaptism: '',
    dateOfBaptism: '',
  });
  const [sponsors, setSponsors] = useState<SponsorRow[]>([{ firstName: '', lastName: '' }]);
  const [parentAddressCountry, setParentAddressCountry] = useState<string>('');
  const [parentAddressRegion, setParentAddressRegion] = useState<string>('');
  const [parentAddressLine, setParentAddressLine] = useState<string>('');

  type BaptismDraftPayload = {
    form: typeof form;
    sponsors: SponsorRow[];
    parentAddressLine: string;
    parentAddressCountry: string;
    parentAddressRegion: string;
    parentAddressState?: string;
  };

  const { isOnline } = useNetworkStatus();
  const queuedItem = useOfflineQueueItem(queuedItemId);

  useEffect(() => {
    if (!queuedItem || queuedItem.status !== 'synced') return;
    void deleteQueueItemAfterSync(queuedItem.id);
    if (draftId) void deleteDraft(draftId);
    router.push('/baptisms');
  }, [queuedItem, draftId, router]);

  // Autosave off: parish prefill and other defaults would otherwise persist and show the draft banner
  // even when the user never clicked "Save Draft". Drafts are saved only via the Save Draft button.
  useDebouncedDraftAutosave<BaptismDraftPayload>({
    draftId,
    formType: 'baptism_create',
    payload: {
      form,
      sponsors,
      parentAddressLine,
      parentAddressCountry,
      parentAddressRegion,
    },
    enabled: false,
  });

  // Pre-fill Place of baptism with parish name when available; user can edit or clear
  useEffect(() => {
    if (parishId == null || Number.isNaN(parishId)) return;
    hasSetPlaceOfBaptismDefault.current = false;
  }, [parishId]);

  useEffect(() => {
    if (parishId == null || Number.isNaN(parishId) || hasSetPlaceOfBaptismDefault.current) return;
    const parish = dioceses.flatMap((d) => d.parishes ?? []).find((p) => p.id === parishId);
    if (parish?.parishName) {
      hasSetPlaceOfBaptismDefault.current = true;
      setForm((f) => ({ ...f, placeOfBaptism: parish.parishName }));
    }
  }, [parishId, dioceses]);

  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    setDraftStatus(null);
    loadDraft<BaptismDraftPayload>(draftId)
      .then((d) => {
        if (cancelled) return;
        setDraftRecord(d);
      })
      .catch(() => {
        if (cancelled) return;
        setDraftRecord(null);
      });
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  async function handleSaveDraft() {
    if (!draftId) return;
    setDraftStatus('Saving draft locally…');
    try {
      const payload: BaptismDraftPayload = {
        form,
        sponsors,
        parentAddressLine,
        parentAddressCountry,
        parentAddressRegion,
      };
      await saveDraft<BaptismDraftPayload>(draftId, 'baptism_create', payload);
      const loaded = await loadDraft<BaptismDraftPayload>(draftId);
      setDraftRecord(loaded);
      setDraftStatus('Draft saved locally on this device.');
    } catch {
      setDraftStatus('Failed to save draft locally.');
    }
  }

  function handleResumeDraft() {
    if (!draftRecord) return;
    hasSetPlaceOfBaptismDefault.current = true; // prevent default parish autopopulate from overriding restored draft
    setForm(draftRecord.payload.form);
    setSponsors(draftRecord.payload.sponsors);

    const line = draftRecord.payload.parentAddressLine ?? '';
    const country = draftRecord.payload.parentAddressCountry ?? '';
    const migratedRegion =
      draftRecord.payload.parentAddressRegion ?? draftRecord.payload.parentAddressState ?? '';
    const migratedCountry =
      country.trim() || (draftRecord.payload.parentAddressState ? 'Nigeria' : '');

    setParentAddressLine(line);
    setParentAddressCountry(migratedCountry);
    setParentAddressRegion(migratedRegion);
    setDraftStatus('Draft loaded from this device.');
  }

  async function handleDiscardDraft() {
    if (!draftId) return;
    setDraftStatus('Discarding draft…');
    try {
      await deleteDraft(draftId);
      setDraftRecord(null);
      setDraftStatus('Draft discarded.');
    } catch {
      setDraftStatus('Failed to discard draft.');
    }
  }

  if (parishId === null || Number.isNaN(parishId)) {
    return (
      <AuthenticatedLayout>
        <h1 className="text-2xl font-serif font-semibold text-sancta-maroon">New baptism</h1>
        <p className="mt-4 text-gray-600">Select a parish from the baptisms list first.</p>
        <Link href="/baptisms" className="mt-4 inline-block text-sancta-maroon hover:underline">
          Back to baptisms
        </Link>
      </AuthenticatedLayout>
    );
  }

  function buildSponsorNames(): string {
    return sponsors
      .filter((s) => s.firstName.trim() || s.lastName.trim())
      .map((s) => `${s.firstName.trim()} ${s.lastName.trim()}`.trim())
      .filter(Boolean)
      .join(', ');
  }

  function validateSponsors(): string | null {
    const filled = sponsors.filter((s) => s.firstName.trim() || s.lastName.trim());
    if (filled.length < 1) return 'Enter at least one sponsor with first and last name.';
    if (filled.length > 2) return 'Enter at most two sponsors.';
    for (const s of filled) {
      if (!s.firstName.trim() || !s.lastName.trim())
        return 'Each sponsor must have both first and last name.';
    }
    return null;
  }

  const sponsorError = validateSponsors();
  const canSave = Boolean(
    !sponsorError &&
      form.baptismName.trim() &&
      form.surname.trim() &&
      form.gender.trim() &&
      !!form.dateOfBirth &&
      form.placeOfBirth.trim() &&
      form.placeOfBaptism.trim() &&
      !!form.dateOfBaptism &&
      form.fathersName.trim() &&
      form.mothersName.trim() &&
      sponsors.length > 0 &&
      form.officiatingPriest.trim() &&
      parentAddressLine.trim() &&
      parentAddressCountry.trim() &&
      parentAddressRegion.trim(),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedBaptismId(null);
    const sponsorError = validateSponsors();
    if (sponsorError) {
      setError(sponsorError);
      return;
    }
    if (!form.placeOfBirth.trim()) {
      setError('Place of birth is required.');
      return;
    }
    if (!form.placeOfBaptism.trim()) {
      setError('Place of baptism is required.');
      return;
    }
    if (!form.dateOfBaptism) {
      setError('Baptism date is required.');
      return;
    }
    setSubmitting(true);
    try {
      const parentAddress = formatParentAddress({
        addressLine: parentAddressLine,
        region: parentAddressRegion,
        country: parentAddressCountry,
      });
      const sponsorNames = buildSponsorNames();
      const payload = {
        ...form,
        sponsorNames,
        parentAddress,
        placeOfBirth: form.placeOfBirth.trim(),
        placeOfBaptism: form.placeOfBaptism.trim(),
        dateOfBaptism: form.dateOfBaptism,
      };

      if (!isOnline) {
        const itemId = await enqueueOfflineSubmission(
          {
            kind: 'baptism_create',
            payload: {
              parishId: parishId as number,
              body: payload satisfies BaptismRequest,
            },
          },
          { draftId: draftId ?? undefined }
        );
        if (birthCertificateFile) {
          setDraftStatus(
            'Baptism queued for sync. Birth certificate was skipped while offline and can be uploaded later.'
          );
        }
        setQueuedItemId(itemId);
        return;
      }

      const created = await createBaptism(parishId as number, payload satisfies BaptismRequest);
      if (birthCertificateFile) {
        try {
          await uploadBaptismBirthCertificate(created.id, birthCertificateFile);
        } catch (uploadError) {
          setCreatedBaptismId(created.id);
          setError(
            `Baptism was created, but birth certificate upload failed. ${
              uploadError instanceof Error ? uploadError.message : 'Please try again later.'
            }`
          );
          return;
        }
      }
      router.push('/baptisms');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create baptism');
    } finally {
      setSubmitting(false);
    }
  }

  function updateSponsor(index: number, field: 'firstName' | 'lastName', value: string) {
    setSponsors((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function removeSponsor(index: number) {
    if (sponsors.length <= 1) return;
    setSponsors((prev) => prev.filter((_, i) => i !== index));
  }

  function addSponsor() {
    if (sponsors.length >= 2) return;
    setSponsors((prev) => [...prev, { firstName: '', lastName: '' }]);
  }

  function handleBirthCertificateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setBirthCertificateError(null);
    const nextFile = e.target.files?.[0] ?? null;
    if (!nextFile) {
      setBirthCertificateFile(null);
      return;
    }
    if (!ALLOWED_BIRTH_CERTIFICATE_TYPES.includes(nextFile.type)) {
      setBirthCertificateFile(null);
      setBirthCertificateError('Only PDF, JPG, or PNG files are allowed.');
      e.target.value = '';
      return;
    }
    if (nextFile.size > MAX_BIRTH_CERTIFICATE_SIZE_BYTES) {
      setBirthCertificateFile(null);
      setBirthCertificateError('File is too large. Maximum size is 2 MB.');
      e.target.value = '';
      return;
    }
    setBirthCertificateFile(nextFile);
  }

  const selectedCountryRegions = getRegionsForCountry(parentAddressCountry);
  const selectedCountryCode = resolveCountryCode(parentAddressCountry);
  const hasPredefinedRegions = selectedCountryRegions.length > 0;
  const isCountrySelected = parentAddressCountry.trim().length > 0;
  const filteredCountries = searchCountries(parentAddressCountry).slice(0, 50);
  const normalizedRegionSearch = parentAddressRegion.trim().toLowerCase();
  const filteredRegions = selectedCountryRegions
    .filter((region) => region.toLowerCase().includes(normalizedRegionSearch))
    .slice(0, 100);
  const postalCodeHint =
    selectedCountryCode === 'GB'
      ? 'Include Postcode'
      : selectedCountryCode === 'IE'
        ? 'Include Eircode'
        : selectedCountryCode === 'US'
          ? 'Include ZIP code'
          : 'Include postal code if available';

  return (
    <AuthenticatedLayout>
      <div className="md:hidden space-y-4">
        <AddRecordDesktopOnlyMessage />
        <Link href="/baptisms" className="inline-block text-sancta-maroon hover:underline">
          Back to baptisms
        </Link>
      </div>
      <div className="hidden md:block">
        <div className="mb-4">
          <Link href="/baptisms" className="text-sancta-maroon hover:underline">
            ← Back to baptisms
          </Link>
        </div>
        <h1 className="text-2xl font-serif font-semibold text-sancta-maroon">Add Baptism</h1>
        {draftRecord && (
          <div className="mt-6 max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            <p className="text-sm font-medium">
              Draft saved locally{draftRecord.updatedAt ? ` (${new Date(draftRecord.updatedAt).toLocaleString()})` : ''}.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={handleResumeDraft} className="rounded-lg bg-sancta-maroon px-3 py-2 text-sm font-medium text-white hover:bg-sancta-maroon-dark">
                Resume draft
              </button>
              <button type="button" onClick={handleDiscardDraft} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50">
                Discard
              </button>
            </div>
            <p className="mt-2 text-xs text-amber-800">
              Offline drafts are stored on this device until they are submitted successfully.
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
          <div>
            <label htmlFor="baptismName" className="block text-sm font-medium text-gray-700">
              Baptism name <span className="text-red-500">*</span>
            </label>
            <input
              id="baptismName"
              type="text"
              required
              value={form.baptismName}
              onChange={(e) => setForm((f) => ({ ...f, baptismName: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="otherNames" className="block text-sm font-medium text-gray-700">
                Other names (Optional)
              </label>
              <input
                id="otherNames"
                type="text"
                value={form.otherNames}
                onChange={(e) => setForm((f) => ({ ...f, otherNames: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
              />
            </div>
            <div>
              <label htmlFor="surname" className="block text-sm font-medium text-gray-700">
                Surname <span className="text-red-500">*</span>
              </label>
              <input
                id="surname"
                type="text"
                required
                value={form.surname}
                onChange={(e) => setForm((f) => ({ ...f, surname: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
              />
            </div>
          </div>
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
              Gender
            </label>
            <select
              id="gender"
              required
              value={form.gender}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
          <div>
            <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">
              Date of birth <span className="text-red-500">*</span>
            </label>
            <input
              id="dateOfBirth"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={form.dateOfBirth}
              onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            />
            <p className="mt-1 text-xs text-gray-500">Cannot be a future date</p>
          </div>
          <div>
            <label htmlFor="placeOfBirth" className="block text-sm font-medium text-gray-700">
              Place of birth <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mt-0.5">e.g. city, hospital</p>
            <input
              id="placeOfBirth"
              type="text"
              required
              value={form.placeOfBirth}
              onChange={(e) => setForm((f) => ({ ...f, placeOfBirth: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            />
          </div>
          <div>
            <label htmlFor="placeOfBaptism" className="block text-sm font-medium text-gray-700">
              Place of baptism <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mt-0.5">Defaults to parish name; you can edit or change it</p>
            <input
              id="placeOfBaptism"
              type="text"
              required
              value={form.placeOfBaptism}
              onChange={(e) => setForm((f) => ({ ...f, placeOfBaptism: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            />
          </div>
          <div>
            <label htmlFor="dateOfBaptism" className="block text-sm font-medium text-gray-700">
              Date of baptism <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mt-0.5">Date of the sacrament</p>
            <input
              id="dateOfBaptism"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={form.dateOfBaptism}
              onChange={(e) => setForm((f) => ({ ...f, dateOfBaptism: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            />
          </div>
          <div>
            <label htmlFor="fathersName" className="block text-sm font-medium text-gray-700">
              Father&apos;s name <span className="text-red-500">*</span>
            </label>
            <input
              id="fathersName"
              type="text"
              required
              value={form.fathersName}
              onChange={(e) => setForm((f) => ({ ...f, fathersName: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            />
          </div>
          <div>
            <label htmlFor="mothersName" className="block text-sm font-medium text-gray-700">
              Mother&apos;s name <span className="text-red-500">*</span>
            </label>
            <input
              id="mothersName"
              type="text"
              required
              value={form.mothersName}
              onChange={(e) => setForm((f) => ({ ...f, mothersName: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            />
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
            <h3 className="text-sm font-medium text-gray-800">Parents Address</h3>
            <p className="mt-0.5 text-xs text-gray-500">{postalCodeHint}</p>
            <div className="mt-3 space-y-4">
              <div>
                <label htmlFor="parentAddressLine" className="block text-sm font-medium text-gray-700">
                  Parents Address: street/town{selectedCountryCode ? ` (${postalCodeHint})` : ''}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  id="parentAddressLine"
                  type="text"
                  required
                  placeholder={
                    selectedCountryCode === 'GB'
                      ? 'e.g. 10 High Street, SW1A 1AA'
                      : selectedCountryCode === 'IE'
                        ? 'e.g. 10 OConnell Street, D01 F5P2'
                        : selectedCountryCode === 'US'
                          ? 'e.g. 10 Main St, 10001'
                          : 'e.g. town, area, street'
                  }
                  value={parentAddressLine}
                  onChange={(e) => setParentAddressLine(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
                />
              </div>
              <div>
                <label htmlFor="parentAddressCountry" className="block text-sm font-medium text-gray-700">
                  Country <span className="text-red-500">*</span>
                </label>
                <input
                  id="parentAddressCountry"
                  type="search"
                  list="parent-address-country-options"
                  required
                  placeholder="Search country"
                  value={parentAddressCountry}
                  onChange={(e) => {
                    setParentAddressCountry(e.target.value);
                    setParentAddressRegion('');
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
                />
                <datalist id="parent-address-country-options">
                  {filteredCountries.map((country) => (
                    <option key={country.code} value={country.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label htmlFor="parentAddressRegion" className="block text-sm font-medium text-gray-700">
                  State/Region <span className="text-red-500">*</span>
                </label>
                {isCountrySelected && hasPredefinedRegions ? (
                  <>
                    <input
                      id="parentAddressRegion"
                      type="search"
                      list="parent-address-region-options"
                      required
                      placeholder="Search state/region"
                      value={parentAddressRegion}
                      onChange={(e) => setParentAddressRegion(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
                    />
                    <datalist id="parent-address-region-options">
                      {filteredRegions.map((region) => (
                        <option key={region} value={region} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <input
                    id="parentAddressRegion"
                    type="text"
                    required
                    disabled={!isCountrySelected}
                    placeholder={
                      isCountrySelected ? 'Enter state/region' : 'Select country first'
                    }
                    value={parentAddressRegion}
                    onChange={(e) => setParentAddressRegion(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon disabled:bg-gray-100 disabled:text-gray-500"
                  />
                )}
              </div>
            </div>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">
              Sponsor <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-gray-500 mb-2">Maximum two sponsors; each with first and last name.</p>
            <div className="space-y-3">
              {sponsors.map((s, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[120px]">
                    <label htmlFor={`sponsor-first-${i}`} className="block text-xs font-medium text-gray-600">
                      First name
                    </label>
                    <input
                      id={`sponsor-first-${i}`}
                      type="text"
                      value={s.firstName}
                      onChange={(e) => updateSponsor(i, 'firstName', e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
                    />
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label htmlFor={`sponsor-last-${i}`} className="block text-xs font-medium text-gray-600">
                      Last name
                    </label>
                    <input
                      id={`sponsor-last-${i}`}
                      type="text"
                      value={s.lastName}
                      onChange={(e) => updateSponsor(i, 'lastName', e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSponsor(i)}
                    disabled={sponsors.length <= 1}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600 disabled:opacity-40 disabled:pointer-events-none"
                    aria-label={`Remove sponsor ${i + 1}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              {sponsors.length < 2 && (
                <button
                  type="button"
                  onClick={addSponsor}
                  className="text-sm text-sancta-maroon hover:underline"
                >
                  + Add sponsor
                </button>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="officiatingPriest" className="block text-sm font-medium text-gray-700">
              Officiating priest <span className="text-red-500">*</span>
            </label>
            <input
              id="officiatingPriest"
              type="text"
              required
              value={form.officiatingPriest}
              onChange={(e) => setForm((f) => ({ ...f, officiatingPriest: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            />
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
            <h3 className="text-sm font-medium text-gray-800">Birth Certificate (optional)</h3>
            <p className="mt-0.5 text-xs text-gray-500">Accepted formats: PDF, JPG, PNG. Max size: 2 MB.</p>
            <label htmlFor="birthCertificate" className="sr-only">
              Birth Certificate (optional)
            </label>
            <input
              id="birthCertificate"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleBirthCertificateChange}
              className="mt-3 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-sancta-maroon file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-sancta-maroon-dark"
            />
            {birthCertificateFile ? (
              <p className="mt-2 text-xs text-gray-600">
                Selected: {birthCertificateFile.name} ({Math.max(1, Math.round(birthCertificateFile.size / 1024))}{' '}
                KB)
              </p>
            ) : (
              <p className="mt-2 text-xs text-gray-500">
                Skip for now if unavailable. You can upload it later from the baptism record.
              </p>
            )}
            {birthCertificateError ? (
              <p role="alert" className="mt-2 text-xs text-red-600">
                {birthCertificateError}
              </p>
            ) : null}
          </div>
          {error && (
            <p role="alert" className="text-red-600 text-sm">
              {error}
            </p>
          )}
          {createdBaptismId ? (
            <p className="text-xs text-amber-700">
              Baptism record was saved. Continue from{' '}
              <Link href={`/baptisms/${createdBaptismId}`} className="underline hover:text-amber-800">
                baptism details
              </Link>
              .
            </p>
          ) : null}
          {draftStatus && <p className="text-xs text-gray-600">{draftStatus}</p>}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={handleSaveDraft}
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 min-h-[44px] text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 w-full sm:w-auto"
            >
              Save Draft
            </button>
            <button
              type="submit"
              disabled={submitting || !canSave}
              className="rounded-lg bg-sancta-maroon px-4 py-3 min-h-[44px] text-white font-medium hover:bg-sancta-maroon-dark disabled:opacity-50 w-full sm:w-auto"
            >
              {submitting ? 'Saving…' : 'Save Baptism'}
            </button>
          </div>
          {queuedItem ? (
            <OfflineQueueItemStatus
              status={queuedItem.status}
              error={queuedItem.lastError}
              onRetry={
                queuedItem.status === 'failed' ? () => void retryOfflineQueueItem(queuedItem.id) : undefined
              }
            />
          ) : null}
        </form>
      </div>
    </AuthenticatedLayout>
  );
}
