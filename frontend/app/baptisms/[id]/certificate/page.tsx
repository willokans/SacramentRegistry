'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { fetchBaptismCertificateData, type BaptismCertificateData } from '@/lib/api';

function formatDisplayDate(value: string | { year?: number; month?: number; day?: number } | null | undefined): string {
  if (value == null) return '';
  let isoStr: string;
  if (typeof value === 'string') {
    isoStr = value.trim();
  } else if (typeof value === 'object' && typeof value.year === 'number') {
    const m = (value.month ?? 1).toString().padStart(2, '0');
    const day = (value.day ?? 1).toString().padStart(2, '0');
    isoStr = `${value.year}-${m}-${day}`;
  } else {
    return '';
  }
  if (!isoStr) return '';
  const d = new Date(isoStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateIssued(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function certificateId(baptismId: number, parishName: string): string {
  const year = new Date().getFullYear();
  const code = parishName.replace(/\s+/g, '').slice(0, 4).toUpperCase() || 'PR';
  return `BAP-${code}-${year}-${String(baptismId).padStart(6, '0')}`;
}

export default function BaptismCertificatePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const isEmbed = searchParams.get('embed') === '1';
  const id = typeof params.id === 'string' ? parseInt(params.id, 10) : NaN;
  const [data, setData] = useState<BaptismCertificateData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    if (!isEmbed || !containerRef.current || !contentRef.current) return;
    const container = containerRef.current;
    const content = contentRef.current;

    const updateScale = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const w = content.scrollWidth;
      const h = content.scrollHeight;
      if (cw <= 0 || ch <= 0 || w <= 0 || h <= 0) return;
      const s = Math.min(cw / w, ch / h, 1);
      if (s > 0.05) setScale(s);
    };

    const t = setTimeout(() => requestAnimationFrame(updateScale), 50);
    const ro = new ResizeObserver(() => requestAnimationFrame(updateScale));
    ro.observe(container);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [isEmbed, data]);

  useEffect(() => {
    if (Number.isNaN(id)) {
      setData(null);
      return;
    }
    let cancelled = false;
    fetchBaptismCertificateData(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load');
          setData(null);
        }
      });
    return () => { cancelled = true; };
  }, [id]);

  function handlePrint() {
    window.print();
  }

  if (Number.isNaN(id) || data === null || error) {
    return (
      <div className="min-h-screen bg-white p-8">
        <p className="text-red-600">{error || 'Invalid baptism or not found.'}</p>
      </div>
    );
  }

  if (data === undefined) {
    return (
      <div className="min-h-screen bg-white p-8">
        <p className="text-gray-600">Loading certificate…</p>
      </div>
    );
  }

  const { baptism, parishName, dioceseName } = data;
  const displayName = `${baptism.baptismName}${baptism.otherNames ? ` ${baptism.otherNames}` : ''} ${baptism.surname}`.trim();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;600&display=swap');
        .cert-script { font-family: 'Dancing Script', cursive; }
        @media print {
          @page { size: A4 landscape; }
        }
      `}</style>
      <div
        ref={isEmbed ? containerRef : undefined}
        className={`print:bg-[#faf8f3] ${isEmbed ? 'fixed inset-0 flex items-center justify-center overflow-hidden bg-[#faf8f3]' : 'min-h-screen p-8 bg-[#faf8f3]'}`}
      >
        <div
          ref={isEmbed ? contentRef : undefined}
          className="mx-auto max-w-4xl print:max-w-none shrink-0"
          style={isEmbed ? { transform: `scale(${scale})`, transformOrigin: 'center center' } : undefined}
        >
          {!isEmbed && (
            <div className="mb-8 flex justify-end print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-lg bg-sancta-maroon px-4 py-2 font-medium text-white hover:bg-sancta-maroon-dark"
              >
                <PrinterIcon className="h-5 w-5" />
                Print / Save as PDF
              </button>
            </div>
          )}

          <article
            className="relative overflow-hidden rounded-sm bg-[#faf8f3] p-10 shadow-lg print:shadow-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h2v2H0V0zm4 0h2v2H4V0z' fill='%23e8e0d0' fill-opacity='0.35' fill-rule='evenodd'/%3E%3C/svg%3E")`,
              border: '1px solid #b8860b',
            }}
          >
            {/* Ornate corner filigree */}
            <CornerFiligree position="top-left" />
            <CornerFiligree position="top-right" />
            <CornerFiligree position="bottom-left" />
            <CornerFiligree position="bottom-right" />

            {/* Watermark: baptismal font, candle, dove (right side, faint) */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-32 h-40 opacity-[0.06] pointer-events-none select-none" aria-hidden>
              <WatermarkIcon />
            </div>

            {/* Header: Cross with laurels + Title + Church + Location */}
            <header className="text-center pb-4 relative z-10">
              <CrossWithLaurels className="mx-auto h-12 w-12 text-sancta-gold" />
              <h1 className="mt-4 text-2xl font-serif font-bold uppercase tracking-widest text-sancta-maroon print:text-3xl">
                Baptism Certificate
              </h1>
              <p className="mt-3 text-lg font-bold text-gray-900 print:text-xl">
                {parishName}
              </p>
              {dioceseName && (
                <p className="mt-0.5 text-sm text-gray-500 print:text-base">{dioceseName}</p>
              )}
            </header>

            {/* Decorative separator */}
            <DecorativeLine />

            {/* Recipient section */}
            <div className="py-6 text-center relative z-10">
              <p className="text-sm italic text-gray-600">This is to certify that</p>
              <p className="cert-script mt-1 text-2xl font-semibold text-gray-900 print:text-3xl">{displayName}</p>
              <p className="mt-1 text-sm text-gray-700">
                was received into the Church through the <strong>Sacrament of Baptism.</strong>
              </p>
            </div>

            {/* Decorative separator */}
            <DecorativeLine />

            {/* Two-column data layout: child info (left) | other info (right) */}
            <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-3 sm:grid-cols-2 text-sm relative z-10">
              <div className="space-y-2.5">
                <DataRow label="Baptism Name" value={baptism.baptismName || '—'} />
                <DataRow label="Surname" value={baptism.surname || '—'} />
                <DataRow label="Gender" value={baptism.gender || '—'} />
                <DataRow label="Date of birth" value={formatDisplayDate(baptism.dateOfBirth) || '—'} />
                <DataRow label="Place of birth" value={baptism.placeOfBirth?.trim() || '—'} />
                <DataRow label="Place of baptism" value={baptism.placeOfBaptism?.trim() || '—'} />
                <DataRow label="Liber No." value={baptism.liberNo?.trim() || '—'} />
              </div>
              <div className="space-y-2.5">
                <DataRow label="Father" value={baptism.fathersName || '—'} />
                <DataRow label="Mother" value={baptism.mothersName || '—'} />
                <DataRow label="Parents Address" value={baptism.parentAddress ?? baptism.address ?? '—'} />
                <DataRow label="Sponsors" value={baptism.sponsorNames || '—'} />
                <DataRow label="Officiating Priest" value={baptism.officiatingPriest || '—'} />
              </div>
            </div>

            {/* Footer: Church crest (bottom-left) | Signature + church + Date, ID (right) — bottoms aligned */}
            <footer className="mt-12 pt-8 relative z-10">
              <div className="flex flex-wrap items-end justify-between gap-8">
                {/* Bottom-left: Church crest (seal) + parish name — left-aligned */}
                <div className="flex flex-col items-start shrink-0 self-end">
                  <div className="h-20 w-20 rounded-full border-2 border-sancta-gold flex items-center justify-center overflow-hidden bg-white/80">
                    <Image
                      src="/images/holy-family-church-logo.png"
                      alt=""
                      width={64}
                      height={64}
                      className="object-contain w-14 h-14"
                      unoptimized
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-medium uppercase text-left text-gray-600 leading-tight max-w-[120px]">
                    {parishName}
                  </p>
                </div>

                {/* Right: Signature, church, disclaimer, Date Issued, Certificate ID */}
                <div className="text-right shrink-0 ml-auto flex flex-col items-end">
                  <div className="h-10 border-b border-gray-500 w-[200px]" />
                  <p className="mt-2 text-sm font-semibold text-gray-900">{baptism.officiatingPriest || '—'}</p>
                  <p className="text-xs font-medium uppercase text-gray-500">Officiating Priest</p>
                  <p className="mt-3 text-sm font-medium text-gray-800">{parishName}</p>
                  <p className="mt-2 text-xs text-gray-600">This certificate is issued for official use.</p>
                  <p className="mt-4 text-sm"><span className="font-medium text-gray-600">Date Issued:</span> {formatDateIssued()}</p>
                  <p className="text-sm mt-0.5"><span className="font-medium text-gray-600">Certificate ID:</span> {certificateId(baptism.id, parishName)}</p>
                </div>
              </div>
            </footer>
          </article>
        </div>
      </div>
    </>
  );
}

function CornerFiligree({ position }: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const base = 'absolute w-16 h-16 text-sancta-gold pointer-events-none';
  const pos = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2 scale-x-[-1]',
    'bottom-left': 'bottom-2 left-2 scale-y-[-1]',
    'bottom-right': 'bottom-2 right-2 scale-x-[-1] scale-y-[-1]',
  }[position];
  return (
    <div className={`${base} ${pos}`} aria-hidden>
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1" className="w-full h-full opacity-65">
        <path d="M0 0 L32 0 M0 0 L0 32" />
        <path d="M4 4 L28 4 M4 4 L4 28" strokeWidth="0.6" />
        <path d="M8 8 Q20 8 28 8 M8 8 Q8 20 8 28" strokeWidth="0.5" strokeLinecap="round" />
        <path d="M12 12 Q18 12 24 12 M12 12 Q12 18 12 24" strokeWidth="0.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function DecorativeLine() {
  return (
    <div className="flex items-center justify-center gap-2 py-2" aria-hidden>
      <span className="flex-1 h-px bg-sancta-gold/60" />
      <span className="text-sancta-gold/70">◆</span>
      <span className="flex-1 h-px bg-sancta-gold/60" />
    </div>
  );
}

function WatermarkIcon() {
  return (
    <svg viewBox="0 0 100 120" fill="currentColor" className="w-full h-full text-gray-600">
      <ellipse cx="50" cy="85" rx="25" ry="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M35 85 L35 55 Q50 45 65 55 L65 85" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="50" y1="45" x2="50" y2="25" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="50" cy="20" rx="8" ry="5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M50 15 L48 5 Q50 0 52 5 Z" fill="currentColor" />
      <path d="M45 50 Q50 35 55 50" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M50 35 Q55 25 50 15 Q45 25 50 35" fill="none" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}

function CrossWithLaurels({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="currentColor" aria-hidden>
      <path d="M22 4h4v14h12v4H26v14h-4V22H10v-4h12V4z" />
      <path d="M8 20 Q12 18 16 20 L14 24 Q10 22 8 24 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M40 20 Q36 18 32 20 L34 24 Q38 22 40 24 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M22 8 Q20 12 22 16 L26 14 Q24 10 26 8 Z" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M26 8 Q28 12 26 16 L22 14 Q24 10 22 8 Z" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3">
      <dt className="font-medium text-gray-600">{label}:</dt>
      <dd className="font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function PrinterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}
