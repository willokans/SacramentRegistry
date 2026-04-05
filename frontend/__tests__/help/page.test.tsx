/**
 * TDD: Help page tests.
 * - When authenticated: renders Help Center heading, table of contents, all 8 sections, and links
 * - When not authenticated: redirects to /login
 */
import { render, screen, within } from '@testing-library/react';
import { useRouter, usePathname } from 'next/navigation';
import { getStoredToken, getStoredUser } from '@/lib/api';
import { useParish } from '@/context/ParishContext';
import { defaultParishContext } from '../test-utils';
import HelpPage from '@/app/help/page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  getStoredToken: jest.fn(),
  getStoredUser: jest.fn(),
}));

jest.mock('@/context/ParishContext', () => ({
  useParish: jest.fn(),
}));

const mockPush = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ push: mockPush });
(usePathname as jest.Mock).mockReturnValue('/help');

describe('Help page', () => {
  beforeEach(() => {
    mockPush.mockClear();
    (getStoredToken as jest.Mock).mockReturnValue('token');
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'admin',
      displayName: 'Admin',
      role: 'ADMIN',
    });
    (useParish as jest.Mock).mockReturnValue(defaultParishContext);
  });

  it('renders Help Center heading when authenticated', () => {
    render(<HelpPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Help Center' })).toBeInTheDocument();
  });

  it('renders table of contents with all 8 section links', () => {
    render(<HelpPage />);
    const nav = screen.getByRole('navigation', { name: 'Help sections' });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Quick Start' })).toHaveAttribute('href', '#quick-start');
    expect(within(nav).getByRole('link', { name: 'Register Baptism' })).toHaveAttribute('href', '#register-baptism');
    expect(within(nav).getByRole('link', { name: 'Register Holy Communion' })).toHaveAttribute('href', '#register-holy-communion');
    expect(within(nav).getByRole('link', { name: 'Register Confirmation' })).toHaveAttribute('href', '#register-confirmation');
    expect(within(nav).getByRole('link', { name: 'Register Marriage' })).toHaveAttribute('href', '#register-marriage');
    expect(within(nav).getByRole('link', { name: 'Search Records' })).toHaveAttribute('href', '#search-records');
    expect(within(nav).getByRole('link', { name: 'Generate Certificates' })).toHaveAttribute('href', '#generate-certificates');
    expect(within(nav).getByRole('link', { name: 'Contact Support' })).toHaveAttribute('href', '#contact-support');
  });

  it('renders all 8 sections with correct headings', () => {
    render(<HelpPage />);
    expect(screen.getByRole('heading', { level: 2, name: 'Quick Start' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Register Baptism' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Register Holy Communion' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Register Confirmation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Register Marriage' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Search Records' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Generate Certificates' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Contact Support' })).toBeInTheDocument();
  });

  it('links to baptisms/new from Register Baptism section', () => {
    render(<HelpPage />);
    const link = screen.getByRole('link', { name: /Register a baptism/i });
    expect(link).toHaveAttribute('href', '/baptisms/new');
  });

  it('links to communions/new from Register Holy Communion section', () => {
    render(<HelpPage />);
    const link = screen.getByRole('link', { name: /Register Holy Communion →/i });
    expect(link).toHaveAttribute('href', '/communions/new');
  });

  it('links to confirmations/new from Register Confirmation section', () => {
    render(<HelpPage />);
    const link = screen.getByRole('link', { name: /Register Confirmation →/i });
    expect(link).toHaveAttribute('href', '/confirmations/new');
  });

  it('links to marriages/new from Register Marriage section', () => {
    render(<HelpPage />);
    const link = screen.getByRole('link', { name: /Register Marriage →/i });
    expect(link).toHaveAttribute('href', '/marriages/new');
  });

  it('links to baptisms from Search Records section', () => {
    render(<HelpPage />);
    const link = screen.getByRole('link', { name: /Search baptisms/i });
    expect(link).toHaveAttribute('href', '/baptisms');
  });

  it('renders Contact Support with mailto link', () => {
    render(<HelpPage />);
    const link = screen.getByRole('link', { name: 'support@sacramentregistry.com' });
    expect(link).toHaveAttribute('href', 'mailto:support@sacramentregistry.com');
  });

  it('links to privacy notice from Contact Support section', () => {
    render(<HelpPage />);
    const link = screen.getByRole('link', { name: /Read Privacy Notice/i });
    expect(link).toHaveAttribute('href', '/privacy');
  });

  it('links to terms of use from Contact Support section', () => {
    render(<HelpPage />);
    const link = screen.getByRole('link', { name: 'Terms of Use →' });
    expect(link).toHaveAttribute('href', '/terms-of-use');
  });

  it('redirects to /login when not authenticated', () => {
    (getStoredToken as jest.Mock).mockReturnValue(null);
    render(<HelpPage />);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('redirects to /login when no user', () => {
    (getStoredUser as jest.Mock).mockReturnValue(null);
    render(<HelpPage />);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});
