import { render, screen } from '@testing-library/react';
import DataProtectionPage from '@/app/data-protection/page';

describe('Data protection and trust page', () => {
  it('renders page heading, trust statement, and product naming', () => {
    render(<DataProtectionPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Data Protection & Trust' })).toBeInTheDocument();
    expect(screen.getByText(/A plain-language overview of how Sacrament Registry protects parish and diocesan data/i)).toBeInTheDocument();
    expect(screen.getByText(/All sacramental records belong to your parish or diocese/i)).toBeInTheDocument();
    expect(screen.queryByText(/Church Registry/i)).not.toBeInTheDocument();
  });

  it('renders key trust sections', () => {
    render(<DataProtectionPage />);

    expect(screen.getByRole('heading', { level: 2, name: 'Your Records. Your Control' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Where Data Is Hosted' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Support and Enquiries' })).toBeInTheDocument();
    expect(screen.getByText(/Sacrament Registry uses managed cloud infrastructure/i)).toBeInTheDocument();
  });

  it('shows need help email CTA and navigation links', () => {
    render(<DataProtectionPage />);

    expect(screen.getByRole('link', { name: 'info@sacramentregistry.com' })).toHaveAttribute('href', 'mailto:info@sacramentregistry.com');
    expect(screen.getByRole('link', { name: 'View formal Privacy Notice' })).toHaveAttribute('href', '/privacy');
    const termsLinks = screen.getAllByRole('link', { name: 'Terms of Use' });
    expect(termsLinks).toHaveLength(2);
    termsLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/terms-of-use');
    });
    expect(screen.getByRole('link', { name: 'Go to Login' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
  });
});
