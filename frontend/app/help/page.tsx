'use client';

import Link from 'next/link';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

const SECTIONS = [
  { id: 'quick-start', title: 'Quick Start' },
  { id: 'register-baptism', title: 'Register Baptism' },
  { id: 'register-holy-communion', title: 'Register Holy Communion' },
  { id: 'register-confirmation', title: 'Register Confirmation' },
  { id: 'register-marriage', title: 'Register Marriage' },
  { id: 'search-records', title: 'Search Records' },
  { id: 'generate-certificates', title: 'Generate Certificates' },
  { id: 'install-app', title: 'Install the App' },
  { id: 'offline-and-sync', title: 'Offline and Sync' },
  { id: 'contact-support', title: 'Contact Support' },
] as const;

export default function HelpPage() {
  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-serif font-semibold text-sancta-maroon">
          Help Center
        </h1>

        {/* Table of Contents */}
        <nav
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          aria-label="Help sections"
        >
          <h2 className="text-sm font-medium text-gray-500 mb-3">On this page</h2>
          <ul className="space-y-2">
            {SECTIONS.map(({ id, title }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="text-sm text-sancta-maroon hover:underline font-medium"
                >
                  {title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Quick Start */}
        <section
          id="quick-start"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-serif font-semibold text-sancta-maroon text-lg">
            Quick Start
          </h2>
          <p className="mt-2 text-gray-600 text-sm leading-relaxed">
            Select your parish from the sidebar. Use the Quick Actions on the dashboard to register new sacraments or search existing records. All records are organized by parish.
          </p>
        </section>

        {/* Register Baptism */}
        <section
          id="register-baptism"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-serif font-semibold text-sancta-maroon text-lg">
            Register Baptism
          </h2>
          <ol className="mt-2 text-gray-600 text-sm leading-relaxed list-decimal list-inside space-y-1">
            <li>Go to the dashboard or use the Baptisms link in the sidebar.</li>
            <li>Click &quot;Register Baptism&quot; or use the Quick Action.</li>
            <li>Fill in the baptism details (name, date of birth, parents, etc.).</li>
            <li>Save the record.</li>
          </ol>
          <Link
            href="/baptisms/new"
            className="mt-3 inline-block text-sm font-medium text-sancta-maroon hover:underline"
          >
            Register a baptism →
          </Link>
        </section>

        {/* Register Holy Communion */}
        <section
          id="register-holy-communion"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-serif font-semibold text-sancta-maroon text-lg">
            Register Holy Communion
          </h2>
          <ol className="mt-2 text-gray-600 text-sm leading-relaxed list-decimal list-inside space-y-1">
            <li>Go to the dashboard or use the Holy Communion link in the sidebar.</li>
            <li>Click &quot;Register Holy Communion&quot; or use the Quick Action.</li>
            <li>Enter the communion details (child, date, parish, etc.).</li>
            <li>Save the record.</li>
          </ol>
          <Link
            href="/communions/new"
            className="mt-3 inline-block text-sm font-medium text-sancta-maroon hover:underline"
          >
            Register Holy Communion →
          </Link>
        </section>

        {/* Register Confirmation */}
        <section
          id="register-confirmation"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-serif font-semibold text-sancta-maroon text-lg">
            Register Confirmation
          </h2>
          <ol className="mt-2 text-gray-600 text-sm leading-relaxed list-decimal list-inside space-y-1">
            <li>Go to the dashboard or use the Confirmation link in the sidebar.</li>
            <li>Click &quot;Register Confirmation&quot; or use the Quick Action.</li>
            <li>Fill in the confirmation details (candidate, date, bishop, etc.).</li>
            <li>Save the record.</li>
          </ol>
          <Link
            href="/confirmations/new"
            className="mt-3 inline-block text-sm font-medium text-sancta-maroon hover:underline"
          >
            Register Confirmation →
          </Link>
        </section>

        {/* Register Marriage */}
        <section
          id="register-marriage"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-serif font-semibold text-sancta-maroon text-lg">
            Register Marriage
          </h2>
          <ol className="mt-2 text-gray-600 text-sm leading-relaxed list-decimal list-inside space-y-1">
            <li>Go to the dashboard or use the Marriage link in the sidebar.</li>
            <li>Click &quot;Register Marriage&quot; or use the Quick Action.</li>
            <li>Enter the marriage details (partners, date, witnesses, etc.).</li>
            <li>Save the record.</li>
          </ol>
          <Link
            href="/marriages/new"
            className="mt-3 inline-block text-sm font-medium text-sancta-maroon hover:underline"
          >
            Register Marriage →
          </Link>
        </section>

        {/* Search Records */}
        <section
          id="search-records"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-serif font-semibold text-sancta-maroon text-lg">
            Search Records
          </h2>
          <p className="mt-2 text-gray-600 text-sm leading-relaxed">
            Use the search box on each sacrament list page (Baptisms, Holy Communion, Confirmation, Marriage) to find records by name, address, parents, or other fields. Filters for year, month, and day help narrow results.
          </p>
          <Link
            href="/baptisms"
            className="mt-3 inline-block text-sm font-medium text-sancta-maroon hover:underline"
          >
            Search baptisms →
          </Link>
        </section>

        {/* Generate Certificates */}
        <section
          id="generate-certificates"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-serif font-semibold text-sancta-maroon text-lg">
            Generate Certificates
          </h2>
          <p className="mt-2 text-gray-600 text-sm leading-relaxed">
            Open any record&apos;s detail page (e.g. from the Baptisms list, click a record). On the detail page, use the &quot;Print Certificate&quot; button to generate an official sacramental certificate. Certificates are available for baptisms, communions, confirmations, and marriages.
          </p>
          <p className="mt-2 text-gray-600 text-sm leading-relaxed">
            If the certificate window doesn&apos;t appear, check your browser&apos;s pop-up blocker and try again.
          </p>
          <Link
            href="/baptisms"
            className="mt-3 inline-block text-sm font-medium text-sancta-maroon hover:underline"
          >
            View records →
          </Link>
        </section>

        {/* Install App */}
        <section
          id="install-app"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-serif font-semibold text-sancta-maroon text-lg">
            Install the App
          </h2>
          <p className="mt-2 text-gray-600 text-sm leading-relaxed">
            You can add Sacrament Registry to your home screen for quicker access. This doesn&apos;t change how you sign in or how the records work—it just makes opening the app faster.
          </p>

          <h3 className="mt-4 font-medium text-gray-800 text-sm">How to install</h3>
          <ol className="mt-2 text-gray-600 text-sm leading-relaxed list-decimal list-inside space-y-1">
            <li>Open Sacrament Registry in your browser (for example: the Dashboard page).</li>
            <li>Look for an “Install” or “Add to Home Screen” option from your browser.</li>
            <li>If you don&apos;t see it, open your browser menu (usually the “Share” or “Apps” option) and choose “Add to Home Screen”.</li>
            <li>Follow the prompts to install.</li>
          </ol>

          <h3 className="mt-4 font-medium text-gray-800 text-sm">
            What are the trade-offs?
          </h3>
          <p className="mt-2 text-gray-600 text-sm leading-relaxed">
            Installing can make daily use more convenient. However, using the website directly is still perfectly fine.
          </p>
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Using the installed app is best when you want:</p>
              <ul className="mt-2 text-gray-600 text-sm leading-relaxed list-disc list-inside space-y-1">
                <li>Quick access from your home screen.</li>
                <li>More reliable use when your connection is slow or temporarily unavailable.</li>
                <li>A smoother experience day-to-day.</li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-800">Using the website directly is best when you want:</p>
              <ul className="mt-2 text-gray-600 text-sm leading-relaxed list-disc list-inside space-y-1">
                <li>No install step.</li>
                <li>Nothing extra stored on your device.</li>
                <li>You always use the latest page version with no extra steps.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Offline and Sync */}
        <section
          id="offline-and-sync"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-serif font-semibold text-sancta-maroon text-lg">
            Offline and Sync
          </h2>
          <p className="mt-2 text-gray-600 text-sm leading-relaxed">
            If your internet connection is slow or unavailable, the app can still help you enter records. What you enter will be saved and sent when your connection improves.
          </p>

          <h3 className="mt-4 font-medium text-gray-800 text-sm">When you&apos;re offline</h3>
          <ol className="mt-2 text-gray-600 text-sm leading-relaxed list-decimal list-inside space-y-1">
            <li>You&apos;ll see an “offline” message at the top of the page.</li>
            <li>You can continue entering and saving records.</li>
            <li>Once you&apos;re back online, the app sends your saved entries automatically.</li>
          </ol>

          <h3 className="mt-4 font-medium text-gray-800 text-sm">If something needs a retry</h3>
          <p className="mt-2 text-gray-600 text-sm leading-relaxed">
            If a submission fails to send, you&apos;ll see a banner that says “Retry failed submissions”. When you&apos;re back online, click the button to try again.
          </p>

          <h3 className="mt-4 font-medium text-gray-800 text-sm">If the record already exists</h3>
          <p className="mt-2 text-gray-600 text-sm leading-relaxed">
            Sometimes the server already has a similar record. When that happens, you may be asked to choose:
            <span className="block mt-1 font-medium text-gray-900">Use server version</span>
            <span className="block mt-1 font-medium text-gray-900">Use my local version</span>
            Choose the option that matches the correct information for your parish.
          </p>

          <h3 className="mt-4 font-medium text-gray-800 text-sm">If you need to sign in again</h3>
          <p className="mt-2 text-gray-600 text-sm leading-relaxed">
            If your sign-in expires while syncing, you&apos;ll be asked to sign in again. After you sign in, syncing will continue.
          </p>
        </section>

        {/* Contact Support */}
        <section
          id="contact-support"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-serif font-semibold text-sancta-maroon text-lg">
            Contact Support
          </h2>
          <p className="mt-2 text-gray-600 text-sm leading-relaxed">
            Contact your parish administrator for assistance with access, data questions, or technical issues.
          </p>
          <p className="mt-3 text-gray-600 text-sm leading-relaxed">
            For how personal data is handled, review our privacy notice. For rules on using the platform, see our terms of use.
          </p>
          <Link
            href="/privacy"
            className="mt-1 inline-block text-sm font-medium text-sancta-maroon hover:underline"
          >
            Read Privacy Notice →
          </Link>
          <Link
            href="/terms-of-use"
            className="mt-2 inline-block text-sm font-medium text-sancta-maroon hover:underline"
          >
            Terms of Use →
          </Link>
          <a
            href="mailto:support@sacramentregistry.com"
            className="mt-3 inline-block text-sm font-medium text-sancta-maroon hover:underline"
          >
            support@sacramentregistry.com
          </a>
        </section>
      </div>
    </AuthenticatedLayout>
  );
}
