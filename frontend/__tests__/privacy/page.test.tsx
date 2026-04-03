/**
 * TDD: Privacy notice page tests.
 * - Renders public privacy notice heading and dynamic last updated date
 * - Exposes key sections and updated copy
 * - Shows email CTAs and footer navigation links
 */
import { render, screen } from '@testing-library/react';
import PrivacyNoticePage from '@/app/privacy/page';

describe('Privacy notice page', () => {
  it('renders Privacy Notice heading and dynamic last updated date text', () => {
    render(<PrivacyNoticePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Notice' })).toBeInTheDocument();
    expect(screen.getByText(/^Last updated: \d{4}-\d{2}-\d{2}$/i)).toBeInTheDocument();
  });

  it('shows the exact parish ownership and processor statement', () => {
    render(<PrivacyNoticePage />);

    expect(screen.getByText('All data belongs to your parish/diocese. Sacrament Registry is only a processor.')).toBeInTheDocument();
  });

  it('renders key policy sections derived from the privacy notice', () => {
    render(<PrivacyNoticePage />);

    expect(screen.getByRole('heading', { level: 2, name: '1) Who We Are' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '2) Data We Process' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '6A) Data Location Transparency' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '8) Your Rights' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '12) Changes to This Notice' })).toBeInTheDocument();
  });

  it('shows concrete hosting and updated international transfer wording', () => {
    render(<PrivacyNoticePage />);

    expect(screen.getByText(/Fly\.io primary region jnb/i)).toBeInTheDocument();
    expect(screen.getByText(/Supabase Postgres and private storage endpoints configured on eu-west-1/i)).toBeInTheDocument();
    expect(screen.getByText(/If data is processed outside the data country of origin/i)).toBeInTheDocument();
  });

  it('renders info email as CTA links and removes placeholder text', () => {
    render(<PrivacyNoticePage />);

    const infoEmailLinks = screen.getAllByRole('link', { name: 'info@sacramentregistry.com' });
    expect(infoEmailLinks.length).toBeGreaterThan(0);
    infoEmailLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', 'mailto:info@sacramentregistry.com');
    });

    expect(screen.queryByText(/DSR form URL/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/privacy@yourdomain\.com/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nigeria Data Protection Commission/i)).not.toBeInTheDocument();
  });

  it('shows footer navigation links', () => {
    render(<PrivacyNoticePage />);

    expect(screen.getByRole('link', { name: 'Go to Login' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
  });
});
