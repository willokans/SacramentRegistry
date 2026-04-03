/**
 * TDD: Landing page (home) tests.
 * - Renders updated persuasive sections and key messaging
 * - Header anchors and CTA links are wired correctly
 * - When authenticated, redirects to /dashboard
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter, usePathname } from 'next/navigation';
import LandingPage from '@/app/page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  getStoredToken: jest.fn(),
  getStoredUser: jest.fn(),
}));

const mockReplace = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
(usePathname as jest.Mock).mockReturnValue('/');

describe('Landing page (home)', () => {
  const requestAccessHref = 'mailto:support@sacramentregistry.com?subject=Request%20Access%20for%20Parish';

  beforeEach(() => {
    mockReplace.mockClear();
    const api = require('@/lib/api');
    api.getStoredToken.mockReturnValue(null);
    api.getStoredUser.mockReturnValue(null);
  });

  it('renders updated hero and primary CTAs', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Sacramental Records - Even Without Internet/i);
    expect(screen.getByText(/Works even when internet is slow or unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep sacramental records accurate, searchable, and parish-controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/without slowing ministry work/i)).toBeInTheDocument();
    expect(screen.queryByText(/Designed for Catholic parish workflows and diocesan record-keeping/i)).not.toBeInTheDocument();

    const signInLinks = screen.getAllByRole('link', { name: /sign in/i });
    expect(signInLinks.length).toBeGreaterThan(0);
    expect(signInLinks[0]).toHaveAttribute('href', '/login');

    const requestAccessLinks = screen.getAllByRole('link', { name: /Request Access for Your Parish/i });
    expect(requestAccessLinks.length).toBeGreaterThan(0);
    expect(requestAccessLinks[0]).toHaveAttribute('href', requestAccessHref);
  });

  it('renders key section headings including offline value proposition', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { name: /Why Sacrament Registry/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Practical features for priests and parish staff/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Structured Sacrament Records/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Find Records in Seconds/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Works Even Without Internet/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Built for Parishes with Unreliable Internet/i })).toBeInTheDocument();
    expect(screen.getByText(/Continue recording with confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/syncs automatically when the connection returns/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /How it works/i })).toBeInTheDocument();
  });

  it('renders trust wording and invitation-only access section', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Access is by invitation only/i)).toBeInTheDocument();
    expect(screen.getByText(/available to Catholic parishes and dioceses/i)).toBeInTheDocument();
    expect(screen.getByText(/secure, parish-approved onboarding/i)).toBeInTheDocument();
    expect(screen.getByText(/Contact your parish office or write to support for access guidance/i)).toBeInTheDocument();
    expect(screen.getByText(/Or email us directly at/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'info@sacramentregistry.com' })[0]).toHaveAttribute('href', 'mailto:info@sacramentregistry.com');
    expect(screen.getByText(/Replace manual registers and scattered records with a structured, reliable system/i)).toBeInTheDocument();
    expect(screen.getByText(/Designed with input from parish priests and real parish workflows/i)).toBeInTheDocument();
    expect(screen.getByText(/Built specifically for Catholic parish and diocesan sacrament record-keeping/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Designed for Catholic parish workflows/i).length).toBeGreaterThan(0);
  });

  it('renders header nav anchors for updated sections', () => {
    render(<LandingPage />);

    expect(screen.getAllByRole('link', { name: 'Why' })[0]).toHaveAttribute('href', '#why');
    expect(screen.getAllByRole('link', { name: 'Features' })[0]).toHaveAttribute('href', '#features');
    expect(screen.getAllByRole('link', { name: 'How it works' })[0]).toHaveAttribute('href', '#how-it-works');
    expect(screen.getAllByRole('link', { name: 'Offline' })[0]).toHaveAttribute('href', '#offline');
    expect(screen.getAllByRole('link', { name: 'Access' })[0]).toHaveAttribute('href', '#access');
  });

  it('shows mobile nav links and closes menu after tapping a section link', () => {
    render(<LandingPage />);

    const openMenuButton = screen.getByRole('button', { name: /open menu/i });
    fireEvent.click(openMenuButton);

    const whyMobileLinks = screen.getAllByRole('link', { name: 'Why' });
    expect(whyMobileLinks.length).toBeGreaterThan(1);

    const whyMobileLink = whyMobileLinks[1];
    expect(whyMobileLink).toHaveAttribute('href', '#why');

    fireEvent.click(whyMobileLink);
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('renders footer links and core labels', () => {
    render(<LandingPage />);
    expect(document.body).toHaveTextContent('Sacrament Registry');
    expect(document.body).toHaveTextContent(/Sacramental Record Management System/i);
    expect(document.body).not.toHaveTextContent(/Support: support@sacramentregistry.com/i);

    const privacyLink = screen.getByRole('link', { name: 'Privacy Notice' });
    expect(privacyLink).toHaveAttribute('href', '/privacy');

    const supportLinks = screen.getAllByRole('link', { name: 'Support' });
    expect(supportLinks[0]).toHaveAttribute('href', 'mailto:support@sacramentregistry.com');

    const requestAccessFooter = screen.getAllByRole('link', { name: 'Request Access for Your Parish' });
    expect(requestAccessFooter.length).toBeGreaterThan(0);
    expect(requestAccessFooter[0]).toHaveAttribute('href', requestAccessHref);
  });

  it('keeps access section CTAs wired correctly', () => {
    render(<LandingPage />);

    const signInLinks = screen.getAllByRole('link', { name: 'Sign in' });
    expect(signInLinks.length).toBeGreaterThan(0);
    signInLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/login');
    });

    const requestAccessLinks = screen.getAllByRole('link', { name: 'Request Access for Your Parish' });
    expect(requestAccessLinks.length).toBeGreaterThan(0);
    requestAccessLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', requestAccessHref);
    });

    expect(requestAccessLinks[0]).toHaveAttribute('href', requestAccessHref);
  });

  it('shows secondary direct-email option with info mailbox', () => {
    render(<LandingPage />);

    expect(screen.getByText(/Or email us directly at/i)).toBeInTheDocument();
    const infoEmailLinks = screen.getAllByRole('link', { name: 'info@sacramentregistry.com' });
    expect(infoEmailLinks.length).toBeGreaterThan(0);
    expect(infoEmailLinks[0]).toHaveAttribute('href', 'mailto:info@sacramentregistry.com');
  });

  it('when authenticated redirects to /dashboard', async () => {
    const api = require('@/lib/api');
    api.getStoredToken.mockReturnValue('jwt-123');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    });

    render(<LandingPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('when not authenticated does not redirect', () => {
    render(<LandingPage />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
