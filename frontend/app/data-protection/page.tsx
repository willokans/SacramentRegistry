import Link from 'next/link';

type TrustSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

const TRUST_SECTIONS: TrustSection[] = [
  {
    id: 'your-records-your-control',
    title: 'Your Records. Your Control',
    paragraphs: [
      'Sacrament Registry is built so your parish or diocese stays in control of its records. You decide who can access data, what they can do, and how your team manages daily recordkeeping.',
    ],
  },
  {
    id: 'parish-diocesan-responsibility',
    title: 'Built for Parish and Diocesan Responsibility',
    paragraphs: [
      'The platform supports pastoral and administrative duty of care by keeping sacramental information organized, traceable, and easier to maintain over time.',
      'We design workflows around accountability so authorized staff can confidently handle records and respond to requests.',
    ],
  },
  {
    id: 'secure-access',
    title: 'Secure Access',
    paragraphs: [
      'Access is restricted to authorized users with account authentication and role-based permissions. This helps ensure each user only sees and manages the data relevant to their responsibilities.',
    ],
  },
  {
    id: 'offline-reliability',
    title: 'Offline Reliability',
    paragraphs: [
      'Where network quality is inconsistent, Sacrament Registry is designed to support continuity of work with resilient workflows so recordkeeping can continue and sync safely when connectivity is restored.',
    ],
  },
  {
    id: 'what-data-is-stored',
    title: 'What Data Is Stored',
    paragraphs: [
      'Records can include sacramental information, member identity details, parish metadata, and operational audit information required to maintain reliable and secure administration.',
    ],
  },
  {
    id: 'how-data-is-used',
    title: 'How Data Is Used',
    paragraphs: [
      'Data is used to maintain sacramental registers, support certificate processes, secure user access, and provide support services for your team.',
      'We do not sell parish or personal data.',
    ],
  },
  {
    id: 'where-data-is-hosted',
    title: 'Where Data Is Hosted',
    paragraphs: [
      'Sacrament Registry uses managed cloud infrastructure with production services hosted in trusted regions selected for reliability and data protection commitments.',
      'Hosting details are reviewed as part of our security and compliance process to maintain appropriate safeguards for your environment.',
    ],
  },
  {
    id: 'data-protection-standards',
    title: 'Data Protection Standards',
    paragraphs: [
      'We apply practical technical and organizational controls, including access controls, encrypted transport, and operational monitoring, to reduce risk and protect sensitive records.',
    ],
  },
  {
    id: 'retention-and-ownership',
    title: 'Retention and Ownership',
    paragraphs: [
      'Record ownership remains with your parish or diocese. Data retention is managed according to your governance requirements and applicable legal or ecclesiastical obligations.',
    ],
  },
  {
    id: 'rights',
    title: 'Rights',
    paragraphs: [
      'Depending on applicable law, individuals may request access, correction, or other data rights actions. Parish and diocesan administrators can contact support for guidance on handling requests appropriately.',
    ],
  },
  {
    id: 'support-and-enquiries',
    title: 'Support and Enquiries',
    paragraphs: [
      'For data protection questions, onboarding support, or policy clarifications, our team is available to help your parish or diocese implement best-practice record stewardship.',
    ],
  },
  {
    id: 'transparency',
    title: 'Transparency',
    paragraphs: [
      'We believe trust is built through clear communication. We provide plain-language information about our data handling approach and keep this guidance updated as the service evolves.',
    ],
  },
];

export default function DataProtectionPage() {
  return (
    <main className="min-h-screen bg-pattern px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-6">
        <header className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-serif font-semibold text-sancta-maroon sm:text-3xl">
            Data Protection &amp; Trust
          </h1>
          <p className="mt-2 text-sm font-medium text-sancta-maroon/80">Your data, your control</p>
          <p className="mt-4 text-sm leading-relaxed text-gray-700 sm:text-base">
            A plain-language overview of how Sacrament Registry protects parish and diocesan data.
          </p>
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 sm:text-base">
            All sacramental records belong to your parish or diocese.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/privacy" className="font-medium text-sancta-maroon hover:underline">
              Need formal legal detail? Read Privacy Notice
            </Link>
            <Link href="/terms-of-use" className="font-medium text-sancta-maroon hover:underline">
              Terms of Use
            </Link>
            <Link href="/" className="font-medium text-sancta-maroon hover:underline">
              Back to Home
            </Link>
          </div>
        </header>

        {TRUST_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-serif font-semibold text-sancta-maroon sm:text-xl">{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-sm leading-relaxed text-gray-700 sm:text-base">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-serif font-semibold text-sancta-maroon sm:text-xl">Need Help?</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-700 sm:text-base">
            Contact us for onboarding guidance, data protection enquiries, or practical help with your parish setup.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <a href="mailto:info@sacramentregistry.com" className="font-medium text-sancta-maroon hover:underline">
              info@sacramentregistry.com
            </a>
            <Link href="/privacy" className="font-medium text-sancta-maroon hover:underline">
              View formal Privacy Notice
            </Link>
            <Link href="/terms-of-use" className="font-medium text-sancta-maroon hover:underline">
              Terms of Use
            </Link>
            <Link href="/login" className="font-medium text-sancta-maroon hover:underline">
              Go to Login
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
