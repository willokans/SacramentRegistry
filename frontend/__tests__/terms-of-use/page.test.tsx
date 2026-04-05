/**
 * TDD: Terms of Use page tests.
 * - Renders heading and dynamic last updated date
 * - Exposes key sections and cross-links
 */
import { render, screen } from '@testing-library/react';
import TermsOfUsePage from '@/app/terms-of-use/page';

describe('Terms of Use page', () => {
  it('renders Terms of Use heading and dynamic last updated date text', () => {
    render(<TermsOfUsePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeInTheDocument();
    expect(screen.getByText(/^Last updated: \d{4}-\d{2}-\d{2}$/i)).toBeInTheDocument();
  });

  it('shows the invitation and ownership callout', () => {
    render(<TermsOfUsePage />);

    expect(
      screen.getByText(
        /Access is by invitation only\. Records belong to your parish or diocese; Sacrament Registry is the platform they use to manage them\./i
      )
    ).toBeInTheDocument();
  });

  it('renders key terms sections', () => {
    render(<TermsOfUsePage />);

    expect(screen.getByRole('heading', { level: 2, name: '1) Use of the platform' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '5) Access scope' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '9) Changes to these terms' })).toBeInTheDocument();
  });

  it('links to Privacy Notice and Data Protection from header', () => {
    render(<TermsOfUsePage />);

    const privacyInHeader = screen.getAllByRole('link', { name: 'Privacy Notice' }).find((el) => el.getAttribute('href') === '/privacy');
    expect(privacyInHeader).toBeDefined();

    const dataProtectionLinks = screen.getAllByRole('link', { name: 'Data Protection & Trust' });
    expect(dataProtectionLinks.some((link) => link.getAttribute('href') === '/data-protection')).toBe(true);
  });

  it('renders info email as CTA in contact section', () => {
    render(<TermsOfUsePage />);

    const infoEmailLinks = screen.getAllByRole('link', { name: 'info@sacramentregistry.com' });
    expect(infoEmailLinks.length).toBeGreaterThan(0);
    infoEmailLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', 'mailto:info@sacramentregistry.com');
    });
  });

  it('shows footer navigation links', () => {
    render(<TermsOfUsePage />);

    expect(screen.getByRole('link', { name: 'Go to Login' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
  });
});
