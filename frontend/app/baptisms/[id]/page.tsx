'use client';

import { useEffect, useState, useCallback, useRef, type ChangeEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import {
  fetchBaptism,
  updateBaptismNotes,
  emailBaptismCertificate,
  fetchBaptismNoteHistory,
  fetchBaptismExternalCertificate,
  uploadBaptismExternalCertificate,
  type BaptismResponse,
  type BaptismNoteResponse,
} from '@/lib/api';
import { saveNotesOptimistically } from '@/lib/optimistic-notes';

function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function sanitizeFilenamePart(value: string | null | undefined): string {
  if (value == null || String(value).trim() === '') return '';
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || '';
}

/** External baptism: certificate on file, or issuing parish recorded (pending proof), or legacy placeholder row. */
function isExternalBaptismRecord(b: BaptismResponse): boolean {
  if ((b.externalCertificatePath ?? '').trim()) return true;
  if ((b.externalCertificateIssuingParish ?? '').trim()) return true;
  return Boolean(
    (b.parishAddress ?? '').trim() &&
      b.sponsorNames === 'See Certificate' &&
      b.officiatingPriest === 'See Certificate'
  );
}

const cardClass = 'rounded-xl border border-gray-200 bg-white p-5 shadow-sm';

export default function BaptismViewPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? parseInt(params.id, 10) : NaN;
  const [baptism, setBaptism] = useState<BaptismResponse | null | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [noteHistory, setNoteHistory] = useState<BaptismNoteResponse[]>([]);
  const [noteHistoryLoading, setNoteHistoryLoading] = useState(false);
  const [certificateObjectUrl, setCertificateObjectUrl] = useState<string | null>(null);
  const [certificateIsPdf, setCertificateIsPdf] = useState<boolean>(true);
  const certificateUrlRef = useRef<string | null>(null);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [certificateModalOpen, setCertificateModalOpen] = useState(false);
  const [externalCertUploadFile, setExternalCertUploadFile] = useState<File | null>(null);
  const [externalCertUploading, setExternalCertUploading] = useState(false);
  const [externalCertUploadError, setExternalCertUploadError] = useState<string | null>(null);
  const externalCertFileInputRef = useRef<HTMLInputElement>(null);

  const isExternalBaptism = baptism != null ? isExternalBaptismRecord(baptism) : false;
  const hasUploadedExternalCertificate =
    baptism != null ? Boolean((baptism.externalCertificatePath ?? '').trim()) : false;
  const externalCertificatePending = isExternalBaptism && !hasUploadedExternalCertificate;
  const canViewExternalCertificate = isExternalBaptism && hasUploadedExternalCertificate;

  const openCertificateModal = useCallback(() => {
    if (canViewExternalCertificate) setCertificateModalOpen(true);
  }, [canViewExternalCertificate]);

  const handleExternalCertFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setExternalCertUploadFile(f ?? null);
    setExternalCertUploadError(null);
  }, []);

  const handleUploadExternalCertificate = useCallback(async () => {
    if (!externalCertUploadFile || baptism == null) return;
    const maxBytes = 2 * 1024 * 1024;
    if (externalCertUploadFile.size > maxBytes) {
      setExternalCertUploadError('Certificate file is too large. Maximum size is 2 MB.');
      return;
    }
    setExternalCertUploading(true);
    setExternalCertUploadError(null);
    try {
      const updated = await uploadBaptismExternalCertificate(baptism.id, externalCertUploadFile);
      setBaptism(updated);
      setExternalCertUploadFile(null);
      if (externalCertFileInputRef.current) externalCertFileInputRef.current.value = '';
    } catch (e) {
      setExternalCertUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setExternalCertUploading(false);
    }
  }, [externalCertUploadFile, baptism]);

  useEffect(() => {
    if (Number.isNaN(id)) {
      setBaptism(null);
      return;
    }
    let cancelled = false;
    fetchBaptism(id).then((b) => {
      if (!cancelled) {
        setBaptism(b ?? null);
        if (b?.note != null) setNotes(b.note);
      }
    }).catch(() => {
      if (!cancelled) setBaptism(null);
    });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (baptism == null || Number.isNaN(id)) {
      setNoteHistory([]);
      return;
    }
    let cancelled = false;
    setNoteHistoryLoading(true);
    fetchBaptismNoteHistory(id).then((list) => {
      if (!cancelled) setNoteHistory(list);
    }).catch(() => {
      if (!cancelled) setNoteHistory([]);
    }).finally(() => {
      if (!cancelled) setNoteHistoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, baptism?.id]);

  useEffect(() => {
    if (!certificateModalOpen || !canViewExternalCertificate || Number.isNaN(id)) return;
    let cancelled = false;
    setCertificateLoading(true);
    setCertificateError(null);
    fetchBaptismExternalCertificate(id)
      .then((blob) => {
        if (cancelled) return;
        if (certificateUrlRef.current) URL.revokeObjectURL(certificateUrlRef.current);
        const url = URL.createObjectURL(blob);
        certificateUrlRef.current = url;
        setCertificateObjectUrl(url);
        setCertificateIsPdf(blob.type === 'application/pdf');
      })
      .catch((e) => {
        if (!cancelled) setCertificateError(e instanceof Error ? e.message : 'Failed to load certificate');
      })
      .finally(() => {
        if (!cancelled) setCertificateLoading(false);
      });
    return () => {
      cancelled = true;
      if (certificateUrlRef.current) {
        URL.revokeObjectURL(certificateUrlRef.current);
        certificateUrlRef.current = null;
      }
      setCertificateObjectUrl(null);
    };
  }, [id, canViewExternalCertificate, certificateModalOpen]);

  const handleDownloadCertificate = useCallback(async (format: 'pdf' | 'image' = 'pdf') => {
    if (!id || !canViewExternalCertificate || !baptism) return;
    try {
      const blob = await fetchBaptismExternalCertificate(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baptismName = sanitizeFilenamePart(baptism.baptismName);
      const surname = sanitizeFilenamePart(baptism.surname);
      const baseName = [baptismName, surname].filter(Boolean).join('-') || `baptism-${id}`;
      const ext = format === 'image' ? 'png' : 'pdf';
      a.download = `baptism-certificate-${baseName}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setCertificateError('Download failed');
    }
  }, [id, canViewExternalCertificate, baptism]);

  const handleViewFullscreen = useCallback(async () => {
    if (!id || !canViewExternalCertificate) return;
    try {
      const blob = await fetchBaptismExternalCertificate(id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setCertificateError('Failed to open certificate');
    }
  }, [id, canViewExternalCertificate]);

  async function handleSaveNotes() {
    if (baptism == null) return;
    await saveNotesOptimistically({
      notes,
      noteHistory,
      entityId: baptism.id,
      updateNotes: updateBaptismNotes,
      fetchNoteHistory: fetchBaptismNoteHistory,
      setNotes,
      setNoteHistory,
      setEntity: setBaptism,
      setNotesError,
      setSavingNotes,
      errorFallback: 'Failed to save notes',
    });
  }

  function openEmailModal() {
    setEmailModalOpen(true);
    setEmailTo('');
    setEmailError(null);
    setEmailSuccess(false);
  }

  function closeEmailModal() {
    setEmailModalOpen(false);
    setEmailTo('');
    setEmailError(null);
    setEmailSuccess(false);
  }

  async function handleEmailCertificate() {
    if (baptism == null || !emailTo.trim()) return;
    setEmailError(null);
    setEmailSending(true);
    try {
      await emailBaptismCertificate(baptism.id, emailTo.trim());
      setEmailSuccess(true);
      setTimeout(closeEmailModal, 2000);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Failed to send certificate');
    } finally {
      setEmailSending(false);
    }
  }

  if (Number.isNaN(id)) {
    return (
      <AuthenticatedLayout>
        <p className="text-red-600">Invalid baptism id.</p>
      </AuthenticatedLayout>
    );
  }

  if (baptism === undefined) {
    return (
      <AuthenticatedLayout>
        <p className="text-gray-600">Loading…</p>
      </AuthenticatedLayout>
    );
  }

  if (baptism === null) {
    return (
      <AuthenticatedLayout>
        <h1 className="text-2xl font-serif font-semibold text-sancta-maroon">Baptism</h1>
        <p className="mt-4 text-gray-600">Baptism record not found.</p>
        <Link href="/baptisms" className="mt-4 inline-block text-sancta-maroon hover:underline">
          Back to baptisms
        </Link>
      </AuthenticatedLayout>
    );
  }

  const parentAddress = baptism.parentAddress ?? baptism.address ?? '';

  return (
    <AuthenticatedLayout>
      <div className="mb-4">
        <Link href="/baptisms" className="text-gray-500 hover:text-gray-700 hover:underline">
          ← Back to Baptisms
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-serif font-semibold text-sancta-maroon">
            Baptism Record
          </h1>
          {isExternalBaptism && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              • Baptized in Another Parish
            </span>
          )}
          {!isExternalBaptism && baptism.parishName && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              • Baptized in {baptism.parishName}
            </span>
          )}
        </div>
      </div>

      {emailModalOpen && (
        <EmailCertificateModal
          emailTo={emailTo}
          setEmailTo={setEmailTo}
          sending={emailSending}
          error={emailError}
          success={emailSuccess}
          onSend={handleEmailCertificate}
          onClose={closeEmailModal}
        />
      )}

      {certificateModalOpen && canViewExternalCertificate && (
        <CertificatePopupModal
          certificateObjectUrl={certificateObjectUrl}
          certificateIsPdf={certificateIsPdf}
          certificateLoading={certificateLoading}
          certificateError={certificateError}
          onClose={() => setCertificateModalOpen(false)}
        />
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {isExternalBaptism && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
              <span className="flex h-6 w-6 shrink-0 text-amber-600" aria-hidden>
                <WarningIcon className="h-6 w-6" />
              </span>
              <p className="text-sm text-amber-900">
                {externalCertificatePending ? (
                  <>
                    This child was baptized in another parish. Proof of baptism from the original parish has not been uploaded yet. Use the upload section on the right when the certificate is available.
                  </>
                ) : (
                  <>
                    This child was baptized in another parish. The certificate below was provided by the original parish and is for reference only.
                  </>
                )}
              </p>
            </div>
          )}

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <PeopleIcon className="h-5 w-5 text-gray-500" />
              Child&apos;s Information
            </h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
              <DetailRow label="Baptism Name" value={baptism.baptismName || '—'} />
              <DetailRow
                label="Other Names"
                value={
                  externalCertificatePending && baptism.otherNames === 'See Certificate'
                    ? 'Awaiting baptism proof'
                    : (baptism.otherNames || '—')
                }
                linkToCertificate={canViewExternalCertificate}
                onSeeCertificate={openCertificateModal}
              />
              <DetailRow label="Surname" value={baptism.surname || '—'} />
              <DetailRow label="Date of Birth" value={formatDisplayDate(baptism.dateOfBirth)} />
              <DetailRow label="Place of Birth" value={baptism.placeOfBirth || '—'} />
              <DetailRow label="Gender" value={baptism.gender || '—'} />
            </dl>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-gray-500" />
              Parents
            </h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
              <DetailRow label="Father" value={baptism.fathersName || '—'} />
              <DetailRow label="Mother" value={baptism.mothersName || '—'} />
              <DetailRow label="Parents Address" value={parentAddress || 'No address provided'} />
            </dl>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <PeopleIcon className="h-5 w-5 text-gray-500" />
              Sponsors
            </h2>
            <p className="mt-3 text-gray-900">
              {isExternalBaptism && baptism.sponsorNames === 'See Certificate' ? (
                canViewExternalCertificate ? (
                  <button
                    type="button"
                    onClick={openCertificateModal}
                    className="text-sancta-maroon hover:underline font-medium text-left"
                  >
                    See Certificate
                  </button>
                ) : (
                  <span className="text-gray-600">Awaiting baptism proof</span>
                )
              ) : (
                baptism.sponsorNames || '—'
              )}
            </p>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FolderIcon className="h-5 w-5 text-gray-500" />
              Baptism Details
            </h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
              <DetailRow label="Baptism Date" value={formatDisplayDate(baptism.dateOfBaptism || baptism.dateOfBirth)} />
              <DetailRow label="Place of Baptism" value={baptism.placeOfBaptism || '—'} />
              {baptism.parishAddress && (
                <DetailRow label="Baptism Parish (Original)" value={baptism.parishAddress} />
              )}
              {baptism.liberNo && <DetailRow label="Liber No." value={baptism.liberNo} />}
              <DetailRow
                label="Officiating Priest"
                value={
                  externalCertificatePending && baptism.officiatingPriest === 'See Certificate'
                    ? 'Awaiting baptism proof'
                    : (baptism.officiatingPriest || '—')
                }
                linkToCertificate={canViewExternalCertificate}
                onSeeCertificate={openCertificateModal}
              />
              <DetailRow label="Remarks" value={baptism.note || '—'} />
            </dl>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <NotesIcon className="h-5 w-5 text-gray-500" />
              Notes
            </h2>
            <p className="mt-1 text-sm text-gray-500">Add internal notes about this baptism record (optional)</p>
            <textarea
              id="baptism-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Follow-up actions, observations..."
              rows={4}
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon"
            />
            {notesError && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {notesError}
              </p>
            )}
            <button
              type="button"
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="mt-3 rounded-lg bg-sancta-maroon px-4 py-2 font-medium text-white hover:bg-sancta-maroon-dark disabled:opacity-50"
            >
              {savingNotes ? 'Saving…' : 'Save Notes'}
            </button>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-gray-900">Note history</h2>
            <p className="mt-1 text-sm text-gray-500">All saved notes for this record, newest first.</p>
            {noteHistoryLoading ? (
              <p className="mt-3 text-sm text-gray-500">Loading…</p>
            ) : noteHistory.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No notes saved yet.</p>
            ) : (
              <ul className="mt-3 space-y-4" role="list">
                {noteHistory.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-gray-200 pl-4">
                    <p className="text-xs font-medium text-gray-500">{formatDateTime(entry.createdAt)} By {entry.createdBy || 'Unknown'}</p>
                    <p className="mt-0.5 text-sm text-gray-900 whitespace-pre-wrap">{entry.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {isExternalBaptism && (
          <div className="space-y-6">
            {hasUploadedExternalCertificate && (
              <section className={cardClass}>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDownloadCertificate()}
                    className="inline-flex items-center gap-2 rounded-lg bg-sancta-maroon px-4 py-2 text-sm font-medium text-white hover:bg-sancta-maroon-dark"
                  >
                    <DownloadIcon className="h-4 w-4" />
                    Download External Certificate (PDF)
                  </button>
                </div>
              </section>
            )}

            <section className={cardClass} id="external-certificate">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CrossIcon className="h-5 w-5 text-gray-500" />
                External Baptism Certificate
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Issued by: {baptism.parishAddress?.trim() || baptism.externalCertificateIssuingParish?.trim() || 'Unknown'}
              </p>
              {externalCertificatePending ? (
                <>
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3" role="status">
                    <span className="flex h-6 w-6 shrink-0 text-amber-600" aria-hidden>
                      <ClockIcon className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-amber-900">Awaiting baptism proof</p>
                      <p className="mt-1 text-sm text-amber-800">
                        The certificate from the original parish has not been uploaded yet. Choose a PDF or image (max 2 MB), then upload it here.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                    <input
                      ref={externalCertFileInputRef}
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                      className="sr-only"
                      aria-label="Select baptism certificate file"
                      onChange={handleExternalCertFileChange}
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                      <button
                        type="button"
                        onClick={() => externalCertFileInputRef.current?.click()}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Choose file
                      </button>
                      {externalCertUploadFile && (
                        <span className="text-sm text-gray-700 truncate max-w-full" title={externalCertUploadFile.name}>
                          {externalCertUploadFile.name}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleUploadExternalCertificate()}
                        disabled={!externalCertUploadFile || externalCertUploading}
                        className="inline-flex items-center justify-center rounded-lg bg-sancta-maroon px-4 py-2 text-sm font-medium text-white hover:bg-sancta-maroon-dark disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {externalCertUploading ? 'Uploading…' : 'Upload certificate'}
                      </button>
                    </div>
                    {externalCertUploadError && (
                      <p role="alert" className="mt-3 text-sm text-red-600">
                        {externalCertUploadError}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-4 rounded-lg border-2 border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center h-[300px] sm:h-[320px] max-h-[40vh]">
                    {certificateLoading && (
                      <p className="text-gray-500 p-4">Loading certificate…</p>
                    )}
                    {certificateError && (
                      <p className="text-red-600 text-sm p-4">{certificateError}</p>
                    )}
                    {!certificateLoading && !certificateError && certificateObjectUrl && (
                      certificateIsPdf ? (
                        <iframe
                          src={`${certificateObjectUrl}#view=FitH`}
                          title="External baptism certificate"
                          className="w-full h-full min-w-0 min-h-0 border-0 rounded"
                        />
                      ) : (
                        <div className="relative w-full h-full min-h-[200px]">
                          <Image
                            src={certificateObjectUrl}
                            alt="External baptism certificate"
                            fill
                            className="object-contain border-0 rounded"
                            unoptimized
                          />
                        </div>
                      )
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleViewFullscreen}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <ExpandIcon className="h-4 w-4" />
                      View Fullscreen
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadCertificate('pdf')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <DownloadIcon className="h-4 w-4" />
                      Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadCertificate('image')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <DownloadIcon className="h-4 w-4" />
                      Download Image
                    </button>
                  </div>
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex gap-2">
                    <span className="text-amber-600 shrink-0 mt-0.5" aria-hidden>
                      <InfoIcon className="h-5 w-5" />
                    </span>
                    <p className="text-sm text-amber-900">
                      This certificate is not editable and is stored for reference only.
                    </p>
                  </div>
                </>
              )}
            </section>

            <section className={cardClass}>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FolderIcon className="h-5 w-5 text-gray-500" />
                Record Summary
              </h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Record ID</dt>
                  <dd className="font-medium text-gray-900">BAP/{baptism.id}</dd>
                </div>
              </dl>
            </section>
          </div>
        )}

        {!isExternalBaptism && (
          <div className="space-y-6">
            <section className={cardClass}>
              <div className="flex flex-wrap justify-end gap-2">
                <Link
                  href={`/baptisms/${id}/certificate`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-sancta-maroon bg-white px-4 py-2 text-sm font-medium text-sancta-maroon hover:bg-sancta-maroon/5"
                >
                  <PrinterIcon className="h-4 w-4" />
                  Print Certificate
                </Link>
                <button
                  type="button"
                  onClick={openEmailModal}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <EmailIcon className="h-4 w-4" />
                  Email Baptism Certificate
                </button>
              </div>
            </section>

            <section className={cardClass} id="baptism-certificate">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CrossIcon className="h-5 w-5 text-gray-500" />
                Baptism Certificate
              </h2>
              <div className="mt-4 rounded-lg border-2 border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center h-[300px] sm:h-[320px] max-h-[40vh]">
                <iframe
                  src={`/baptisms/${id}/certificate?embed=1`}
                  title="Baptism certificate"
                  className="w-full h-full min-w-0 min-h-0 border-0 rounded"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/baptisms/${id}/certificate`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ExpandIcon className="h-4 w-4" />
                  View Fullscreen
                </Link>
                <Link
                  href={`/baptisms/${id}/certificate`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Download PDF
                </Link>
                <Link
                  href={`/baptisms/${id}/certificate`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Download Image
                </Link>
              </div>
            </section>

            <section className={cardClass}>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FolderIcon className="h-5 w-5 text-gray-500" />
                Record Summary
              </h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Record ID</dt>
                  <dd className="font-medium text-gray-900">BAP/{baptism.id}</dd>
                </div>
              </dl>
            </section>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

function CertificatePopupModal({
  certificateObjectUrl,
  certificateIsPdf,
  certificateLoading,
  certificateError,
  onClose,
}: {
  certificateObjectUrl: string | null;
  certificateIsPdf: boolean;
  certificateLoading: boolean;
  certificateError: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="certificate-popup-title">
      <div
        className="absolute inset-0"
        aria-hidden
        onClick={onClose}
      />
      <div className="relative z-10 flex flex-col bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-gray-200">
          <h2 id="certificate-popup-title" className="text-lg font-semibold text-gray-900">External Baptism Certificate</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-gray-50 overflow-auto">
          {certificateLoading && <p className="text-gray-500">Loading certificate…</p>}
          {certificateError && <p className="text-red-600 text-sm">{certificateError}</p>}
          {!certificateLoading && !certificateError && certificateObjectUrl && (
            certificateIsPdf ? (
              <iframe
                src={`${certificateObjectUrl}#view=FitH`}
                title="External baptism certificate"
                className="w-full h-full min-h-[60vh] rounded border border-gray-200 bg-white"
              />
            ) : (
              <div className="relative w-full max-w-4xl h-[70vh] min-h-[200px]">
                <Image
                  src={certificateObjectUrl}
                  alt="External baptism certificate"
                  fill
                  className="object-contain rounded border border-gray-200 bg-white"
                  unoptimized
                />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, linkToCertificate, onSeeCertificate }: { label: string; value: string; linkToCertificate?: boolean; onSeeCertificate?: () => void }) {
  const isSeeCertificate = linkToCertificate && value === 'See Certificate';
  return (
    <>
      <dt className="text-sm font-medium text-gray-700">{label}</dt>
      <dd className="text-gray-900">
        {isSeeCertificate ? (
          <button
            type="button"
            onClick={onSeeCertificate}
            className="text-sancta-maroon hover:underline font-medium text-left"
          >
            See Certificate
          </button>
        ) : (
          value
        )}
      </dd>
    </>
  );
}

function PrinterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 8a1 1 0 011 1v3a1 1 0 11-2 0V9a1 1 0 011-1zm0 7a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
  );
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v20M2 12h20" />
    </svg>
  );
}

function NotesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function EmailCertificateModal({
  emailTo,
  setEmailTo,
  sending,
  error,
  success,
  onSend,
  onClose,
}: {
  emailTo: string;
  setEmailTo: (v: string) => void;
  sending: boolean;
  error: string | null;
  success: boolean;
  onSend: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-certificate-title"
        className="relative w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg"
      >
        <h2 id="email-certificate-title" className="text-lg font-semibold text-gray-900">
          Email Baptism Certificate
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter the recipient&apos;s email address. A PDF certificate will be sent as an attachment.
        </p>
        <label htmlFor="email-certificate-to" className="mt-4 block text-sm font-medium text-gray-700">
          Recipient email
        </label>
        <input
          id="email-certificate-to"
          type="email"
          value={emailTo}
          onChange={(e) => setEmailTo(e.target.value)}
          placeholder="e.g. recipient@example.com"
          disabled={sending || success}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-sancta-maroon focus:outline-none focus:ring-1 focus:ring-sancta-maroon disabled:opacity-60"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-2 text-sm text-green-600">
            Certificate sent successfully. This dialog will close shortly.
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={sending || success || !emailTo.trim()}
            className="rounded-lg bg-sancta-maroon px-4 py-2 text-sm font-medium text-white hover:bg-sancta-maroon-dark disabled:opacity-50"
          >
            {sending ? 'Sending…' : success ? 'Sent' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
