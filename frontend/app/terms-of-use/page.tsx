import Link from 'next/link';

type TermsSection = {
  id: string;
  title: string;
  intro?: string;
  bullets?: string[];
  paragraphs?: string[];
};

const INFO_EMAIL = 'info@sacramentregistry.com';
const lastUpdated = new Date().toISOString().slice(0, 10);

function renderWithEmailCta(text: string) {
  const normalizedText = text.replaceAll(`[${INFO_EMAIL}]`, INFO_EMAIL);

  if (!normalizedText.includes(INFO_EMAIL)) {
    return normalizedText;
  }

  return normalizedText.split(INFO_EMAIL).map((part, index, parts) => {
    if (index === parts.length - 1) {
      return part;
    }

    return (
      <span key={`${part}-${index}`}>
        {part}
        <a href={`mailto:${INFO_EMAIL}`} className="font-medium text-sancta-maroon hover:underline">
          {INFO_EMAIL}
        </a>
      </span>
    );
  });
}

const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 'use-of-platform',
    title: '1) Use of the platform',
    paragraphs: [
      'Sacrament Registry is offered for use in a parish or diocesan context. Access is by invitation from an authorized organization; there is no open public sign-up or browsing of records.',
      'By using an account you confirm you are using the platform for legitimate parish or diocesan recordkeeping and administration, in line with the permissions your organization has granted you.',
    ],
  },
  {
    id: 'ownership',
    title: '2) Ownership of data',
    paragraphs: [
      'Sacramental and related records entered into the platform belong to the parish, diocese, or other authorizing organization that manages them. Sacrament Registry provides the software and hosting so that organization can store and work with its own data.',
      'Our role is to operate the service on their behalf in line with our Privacy Notice and applicable agreements—not to claim ownership of your parish or diocesan registers.',
    ],
  },
  {
    id: 'accuracy',
    title: '3) Responsibility for data accuracy',
    paragraphs: [
      'Parishes, dioceses, and their authorized users are responsible for the accuracy and completeness of information they enter. The platform does not independently verify sacramental facts, identities, or pastoral decisions.',
      'If something is wrong, it should be corrected through your organization’s normal processes and the tools the platform provides.',
    ],
  },
  {
    id: 'account-security',
    title: '4) Account security',
    bullets: [
      'Do not share your login credentials with anyone else. Your account is personal and your activity may be attributed to you.',
      'Use a strong password and protect devices you use to access the service.',
      'Tell your administrator and, if appropriate, contact us promptly if you suspect your account or device may have been compromised.',
    ],
  },
  {
    id: 'access-scope',
    title: '5) Access scope',
    paragraphs: [
      'What you can see and do depends on your role and how your organization has assigned you (for example, to a parish or diocesan scope). You do not automatically have access to every parish or every record in the system.',
      'Use only the access you have been given, and only for purposes your organization authorizes.',
    ],
  },
  {
    id: 'availability',
    title: '6) Service availability',
    paragraphs: [
      'We aim to run a reliable service, but we do not guarantee uninterrupted or error-free operation. Outages may occur because of maintenance, network issues, cloud providers, or events outside our control.',
      'Features that help when connectivity is poor are provided for convenience; they are not a substitute for your organization’s own continuity and recordkeeping policies where those are required.',
    ],
  },
  {
    id: 'liability',
    title: '7) Limitation of liability',
    paragraphs: [
      'To the fullest extent permitted by applicable law, Sacrament Registry and its suppliers are not liable for indirect or consequential losses (such as loss of profits, goodwill, or data) arising from your use of or inability to use the platform, except where liability cannot legally be excluded.',
      'Nothing in these terms limits any rights you have that cannot be waived under mandatory law.',
    ],
  },
  {
    id: 'suspension-termination',
    title: '8) Suspension and termination',
    paragraphs: [
      'Your parish or diocese may stop using the platform or adjust who has access, according to its own governance.',
      'We may suspend or end access where we reasonably need to protect security, respond to misuse or breach of these terms, or comply with law. We will give notice when practical, unless immediate action is required.',
    ],
  },
  {
    id: 'changes',
    title: '9) Changes to these terms',
    paragraphs: [
      'We may update these Terms of Use from time to time. The “Last updated” date at the top will change when we do. For material changes, we may also notify users through the application or other appropriate channels.',
      'If you continue to use the platform after updates take effect, you agree to the revised terms, unless your organization has a separate written agreement with us that says otherwise for your use case.',
    ],
  },
  {
    id: 'contact',
    title: '10) Contact',
    paragraphs: [
      'Questions about these Terms of Use: [info@sacramentregistry.com].',
    ],
  },
];

export default function TermsOfUsePage() {
  return (
    <main className="min-h-screen bg-pattern px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-6">
        <header className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <Link href="/" className="inline-block text-sm font-medium text-sancta-maroon hover:underline">
            ← Back to Home
          </Link>
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-sancta-maroon">
            Terms of Use
          </h1>
          <p className="mt-2 text-sm text-gray-600">Last updated: {lastUpdated}</p>
          <p className="mt-4 text-sm sm:text-base text-gray-700 leading-relaxed">
            These Terms of Use set out the rules for using the Sacrament Registry platform. They are written in plain language and work alongside our Privacy Notice (how we process personal data) and our Data Protection &amp; Trust overview.
          </p>
          <p className="mt-3 text-sm sm:text-base text-gray-700 leading-relaxed">
            <Link href="/privacy" className="font-medium text-sancta-maroon hover:underline">
              Privacy Notice
            </Link>
            {' · '}
            <Link href="/data-protection" className="font-medium text-sancta-maroon hover:underline">
              Data Protection &amp; Trust
            </Link>
          </p>
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm sm:text-base font-semibold text-amber-900">
            Access is by invitation only. Records belong to your parish or diocese; Sacrament Registry is the platform they use to manage them.
          </p>
        </header>

        {TERMS_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg sm:text-xl font-serif font-semibold text-sancta-maroon">
              {section.title}
            </h2>
            {section.intro && (
              <p className="mt-3 text-sm sm:text-base text-gray-700 leading-relaxed">
                {renderWithEmailCta(section.intro)}
              </p>
            )}
            {section.bullets && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm sm:text-base text-gray-700 leading-relaxed">
                {section.bullets.map((item) => (
                  <li key={item}>{renderWithEmailCta(item)}</li>
                ))}
              </ul>
            )}
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-sm sm:text-base text-gray-700 leading-relaxed">
                {renderWithEmailCta(paragraph)}
              </p>
            ))}
          </section>
        ))}

        <footer className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/privacy" className="font-medium text-sancta-maroon hover:underline">
              Privacy Notice
            </Link>
            <Link href="/data-protection" className="font-medium text-sancta-maroon hover:underline">
              Data Protection &amp; Trust
            </Link>
            <Link href="/login" className="font-medium text-sancta-maroon hover:underline">
              Go to Login
            </Link>
            <Link href="/" className="font-medium text-sancta-maroon hover:underline">
              Back to Home
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
