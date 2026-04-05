'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getStoredToken, getStoredUser } from '@/lib/api';

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 32" fill="currentColor" aria-hidden>
      <path d="M9 0L15 0 14 4 14 11 20 11 22 12 22 14 20 15 14 15 14 28 15 32 9 32 10 28 10 15 4 15 2 14 2 12 4 11 10 11 10 4z" />
    </svg>
  );
}

function ChaliceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2c-.5 0-1 .2-1.4.6L8.5 4.7c-.4.4-.6.9-.6 1.4v2.5c0 .8.3 1.6.8 2.2l2.5 2.8V18h-2v2h6v-2h-2v-4.4l2.5-2.8c.5-.6.8-1.4.8-2.2V6.1c0-.5-.2-1-.6-1.4l-2.1-2.1C13 2.2 12.5 2 12 2zm-2 4h4v1.5l-2 2.2-2-2.2V6z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function CertificateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

function ChurchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2L2 8v2h2v10h6v-6h4v6h6V10h2V8L12 2zm0 2.5l6 4v1.5h-2V20h-2v-6h-4v6H8v-10H6V8.5l6-4z" />
    </svg>
  );
}

function PwaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
      <path d="M8 3h8a2 2 0 0 1 2 2v2H6V5a2 2 0 0 1 2-2Z" />
      <path d="M6 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7H6Z" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

const features = [
  {
    title: 'Structured Sacrament Records',
    description: 'Capture baptisms, confirmations, marriages, holy communion, and holy orders in a consistent parish-friendly format.',
    Icon: ChaliceIcon,
  },
  {
    title: 'Find Records in Seconds',
    description: 'Find records quickly by family name, parents, address, date, or sacrament type during office hours.',
    Icon: SearchIcon,
  },
  {
    title: 'Certificate Ready',
    description: 'Generate official sacramental certificates from existing records without retyping details.',
    Icon: CertificateIcon,
  },
  {
    title: 'Parish-Controlled Access',
    description: 'Each parish controls who can view and update records with secure invitation-only account setup.',
    Icon: ChurchIcon,
  },
  {
    title: 'Works Even Without Internet',
    description: 'Installable web app support keeps entries safe when internet is slow, unstable, or temporarily unavailable.',
    Icon: PwaIcon,
  },
];

const supportEmail = 'support@sacramentregistry.com';
const infoEmail = 'info@sacramentregistry.com';
const requestAccessEmail = supportEmail;
const requestAccessTargets = {
  mailto: `mailto:${requestAccessEmail}?subject=Request%20Access%20for%20Parish`,
  route: '/request-access',
} as const;

const requestAccessTarget: keyof typeof requestAccessTargets = 'mailto';

const ctaLinks = {
  signIn: '/login',
  requestAccess: requestAccessTargets[requestAccessTarget],
};

function CtaLink({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: ReactNode;
  className: string;
  onClick?: () => void;
}) {
  const isExternal = href.startsWith('mailto:') || href.startsWith('http://') || href.startsWith('https://');

  if (isExternal) {
    return (
      <a href={href} onClick={onClick} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}

const whyRegistry = [
  'Replace manual registers and scattered records with a structured, reliable system.',
  'Built specifically for Catholic parish and diocesan sacrament record-keeping.',
  'Find, verify, and prepare records quickly for certificates and future sacraments.',
];

const howItWorks = [
  'Your parish requests access and receives invitation-only onboarding.',
  'Approved parish users sign in and begin entering or organizing sacramental records.',
  'Teams search records, generate certificates, and continue working even with unreliable internet.',
];

function DashboardPreview() {
  return (
    <div className="relative w-full max-w-md mx-auto lg:mx-0">
      <div className="rounded-lg border-2 border-gray-300 bg-white shadow-xl overflow-hidden">
        <Image
          src="/images/dashboard-preview.png"
          alt="Sacrament Registry dashboard showing sacrament records, quick actions, and parish management"
          width={800}
          height={600}
          className="w-full h-auto object-cover"
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 400px"
        />
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    const user = getStoredUser();
    if (token && user) {
      router.replace('/dashboard');
    }
  }, [router]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navLinks = (
    <>
      <a href="#why" onClick={closeMobileMenu} className="text-sm font-medium text-gray-600 hover:text-sancta-maroon transition-colors py-2">
        Why
      </a>
      <a href="#features" onClick={closeMobileMenu} className="text-sm font-medium text-gray-600 hover:text-sancta-maroon transition-colors py-2">
        Features
      </a>
      <a href="#offline" onClick={closeMobileMenu} className="text-sm font-medium text-gray-600 hover:text-sancta-maroon transition-colors py-2">
        Offline
      </a>
      <a href="#how-it-works" onClick={closeMobileMenu} className="text-sm font-medium text-gray-600 hover:text-sancta-maroon transition-colors py-2">
        How it works
      </a>
      <a href="#access" onClick={closeMobileMenu} className="text-sm font-medium text-gray-600 hover:text-sancta-maroon transition-colors py-2">
        Access
      </a>
      <Link
        href={ctaLinks.signIn}
        onClick={closeMobileMenu}
        className="rounded-lg bg-sancta-maroon px-4 py-2.5 text-sm font-medium text-white hover:bg-sancta-maroon-dark transition-colors min-h-[44px] inline-flex items-center justify-center"
      >
        Sign in
      </Link>
    </>
  );

  return (
    <div className="min-h-screen bg-pattern flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <CrossIcon className="h-7 w-7 sm:h-8 sm:w-8 text-sancta-gold shrink-0" />
            <div className="min-w-0">
              <span className="block font-serif text-lg sm:text-xl font-semibold text-sancta-maroon truncate">Sacrament Registry</span>
              <span className="hidden sm:block text-xs text-gray-500 truncate">Designed for Catholic parish workflows</span>
            </div>
          </Link>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks}
          </nav>
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="md:hidden p-2 -mr-2 rounded-lg text-gray-600 hover:text-sancta-maroon hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>
        </div>
        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-gray-200/80 bg-white px-4 py-4 flex flex-col gap-1">
            <a href="#why" onClick={closeMobileMenu} className="py-3 text-base font-medium text-gray-600 hover:text-sancta-maroon transition-colors">
              Why
            </a>
            <a href="#features" onClick={closeMobileMenu} className="py-3 text-base font-medium text-gray-600 hover:text-sancta-maroon transition-colors">
              Features
            </a>
            <a href="#offline" onClick={closeMobileMenu} className="py-3 text-base font-medium text-gray-600 hover:text-sancta-maroon transition-colors">
              Offline
            </a>
            <a href="#how-it-works" onClick={closeMobileMenu} className="py-3 text-base font-medium text-gray-600 hover:text-sancta-maroon transition-colors">
              How it works
            </a>
            <a href="#access" onClick={closeMobileMenu} className="py-3 text-base font-medium text-gray-600 hover:text-sancta-maroon transition-colors">
              Access
            </a>
            <Link
              href={ctaLinks.signIn}
              onClick={closeMobileMenu}
              className="mt-2 rounded-lg bg-sancta-maroon px-4 py-3.5 text-base font-medium text-white hover:bg-sancta-maroon-dark transition-colors min-h-[44px] flex items-center justify-center"
            >
              Sign in
            </Link>
          </nav>
        )}
      </header>

      {/* Hero */}
      <section className="flex-1 px-4 py-10 sm:px-6 sm:py-16 md:py-24">
        <div className="mx-auto max-w-6xl flex flex-col lg:flex-row items-center gap-8 sm:gap-12 lg:gap-16">
          <div className="flex-1 text-left min-w-0">
            <div className="inline-flex items-center rounded-full border border-sancta-gold/40 bg-sancta-gold/10 px-3 py-1 text-xs font-medium text-sancta-maroon">
              Works even when internet is slow or unavailable
            </div>
            <h1 className="font-serif text-2xl font-semibold text-sancta-maroon sm:text-3xl md:text-4xl lg:text-5xl leading-tight">
              Sacramental Records - Even Without Internet
            </h1>
            <p className="mt-3 sm:mt-4 text-base text-gray-600 sm:text-lg md:text-xl">
              Keep sacramental records accurate, searchable, and parish-controlled, without slowing ministry work.
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
              <Link
                href={ctaLinks.signIn}
                className="inline-flex items-center justify-center rounded-lg bg-sancta-maroon px-6 py-3.5 text-base font-medium text-white hover:bg-sancta-maroon-dark transition-colors min-h-[44px] w-full sm:w-auto"
              >
                Sign in
              </Link>
              <CtaLink
                href={ctaLinks.requestAccess}
                className="inline-flex items-center justify-center rounded-lg border-2 border-sancta-maroon bg-white px-6 py-3.5 text-base font-medium text-sancta-maroon hover:bg-sancta-maroon/5 transition-colors min-h-[44px] w-full sm:w-auto"
              >
                Request Access for Your Parish
              </CtaLink>
            </div>
          </div>
          <div className="flex-1 flex justify-center lg:justify-end w-full">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* Supporting visual text */}
      <section className="border-t border-gray-200/80 bg-white/80 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-6xl grid gap-4 sm:gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-sancta-maroon">Record with confidence</p>
            <p className="mt-2 text-sm text-gray-600">Standardized sacrament forms reduce errors and keep records consistent over time.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-sancta-maroon">Find details quickly</p>
            <p className="mt-2 text-sm text-gray-600">Searchable records help parish teams answer requests faster and with less manual work.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-sancta-maroon">Serve parishioners better</p>
            <p className="mt-2 text-sm text-gray-600">Generate certificates and follow-up records without repeated data entry.</p>
          </div>
        </div>
      </section>

      {/* Why Sacrament Registry */}
      <section id="why" className="border-t border-gray-200/80 bg-white/60 px-4 py-12 sm:px-6 sm:py-16 md:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-serif text-xl font-semibold text-sancta-maroon sm:text-2xl md:text-3xl">
            Why Sacrament Registry
          </h2>
          <p className="mt-3 text-sm text-gray-600 sm:text-base">
            Designed with input from parish priests and real parish workflows.
          </p>
          <div className="mt-6 space-y-3">
            {whyRegistry.map((point) => (
              <p key={point} className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 sm:text-base">
                {point}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-gray-200/80 bg-white/60 px-4 py-12 sm:px-6 sm:py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-serif text-xl font-semibold text-gray-800 sm:text-2xl md:text-3xl text-center mb-8 sm:mb-12 px-2">
            Practical features for priests and parish staff
          </h2>
          <div className="grid items-stretch gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {features.map(({ title, description, Icon }) => (
              <div
                key={title}
                className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm h-full flex flex-col"
              >
                <Icon className="h-9 w-9 sm:h-10 sm:w-10 text-sancta-gold shrink-0" aria-hidden />
                <h3 className="mt-3 font-semibold text-sancta-maroon text-base sm:text-lg">{title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed flex-1">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Offline section */}
      <section id="offline" className="border-t border-sancta-gold/40 bg-sancta-maroon px-4 py-12 sm:px-6 sm:py-16 md:py-20">
        <div className="mx-auto max-w-4xl rounded-2xl border border-white/20 bg-white/10 p-6 sm:p-8 md:p-10">
          <h2 className="font-serif text-2xl font-semibold text-white sm:text-3xl">
            Built for Parishes with Unreliable Internet
          </h2>
          <p className="mt-4 text-sm text-white/90 sm:text-base">
            Parish work should not stop when connectivity is weak. Continue recording with confidence, and data syncs automatically when the connection returns.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/95">
              Continue sacrament entry with confidence during outages.
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/95">
              Sync updates automatically when internet access returns.
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-gray-200/80 bg-white px-4 py-12 sm:px-6 sm:py-16 md:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-serif text-xl font-semibold text-sancta-maroon sm:text-2xl md:text-3xl">
            How it works
          </h2>
          <div className="mt-6 space-y-4">
            {howItWorks.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sancta-maroon text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <p className="text-sm text-gray-700 sm:text-base">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Access */}
      <section id="access" className="border-t border-gray-200/80 bg-white/60 px-4 py-12 sm:px-6 sm:py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-xl font-semibold text-sancta-maroon sm:text-2xl md:text-3xl px-2">
            Access is by invitation only
          </h2>
          <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base px-2">
            Sacrament Registry is available to Catholic parishes and dioceses through secure, parish-approved onboarding.
          </p>
          <p className="mt-3 text-sm text-gray-500 px-2">
            Contact your parish office or write to support for access guidance.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={ctaLinks.signIn}
              className="inline-flex items-center justify-center rounded-lg bg-sancta-maroon px-6 py-3.5 text-base font-medium text-white hover:bg-sancta-maroon-dark transition-colors min-h-[44px] w-full sm:w-auto"
            >
              Sign in
            </Link>
            <CtaLink
              href={ctaLinks.requestAccess}
              className="inline-flex items-center justify-center rounded-lg border-2 border-sancta-maroon bg-white px-6 py-3.5 text-base font-medium text-sancta-maroon hover:bg-sancta-maroon/5 transition-colors min-h-[44px] w-full sm:w-auto"
            >
              Request Access for Your Parish
            </CtaLink>
          </div>
          <p className="mt-3 text-xs sm:text-sm text-gray-500">
            Or email us directly at{' '}
            <a href={`mailto:${infoEmail}`} className="font-medium text-gray-600 hover:text-sancta-maroon underline underline-offset-2">
              {infoEmail}
            </a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-4 py-8 sm:py-12 sm:px-6">
        <div className="mx-auto max-w-6xl text-center">
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center gap-2">
              <CrossIcon className="h-5 w-5 sm:h-6 sm:w-6 text-sancta-gold shrink-0" />
              <span className="font-serif text-base sm:text-lg font-semibold text-sancta-maroon">
                Sacrament Registry
              </span>
            </div>
            <p className="mt-2 sm:mt-3 text-sm text-gray-600">Sacramental Record Management System</p>
          </div>

          <div className="mt-4 sm:mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <Link href={ctaLinks.signIn} className="text-sm font-medium text-sancta-maroon hover:underline">
              Sign in
            </Link>
            <CtaLink href="/data-protection" className="text-sm font-medium text-sancta-maroon hover:underline">
              Data Protection & Trust
            </CtaLink>
            <CtaLink href="/privacy" className="text-sm font-medium text-sancta-maroon hover:underline">
              Privacy Notice
            </CtaLink>
            <CtaLink href="/terms-of-use" className="text-sm font-medium text-sancta-maroon hover:underline">
              Terms of Use
            </CtaLink>
            <CtaLink href={ctaLinks.requestAccess} className="text-sm text-gray-600 hover:text-sancta-maroon">
              Request Access for Your Parish
            </CtaLink>
            <a href={`mailto:${supportEmail}`} className="text-sm text-gray-600 hover:text-sancta-maroon">
              Support
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-sancta-maroon">
              Documentation
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
