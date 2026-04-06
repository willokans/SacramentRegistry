/**
 * TDD: Login page tests.
 * - Renders username and password inputs and submit button
 * - On successful login, stores tokens and redirects to home
 * - On failed login, shows error and does not redirect
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, usePathname } from 'next/navigation';
import LoginPage from '@/app/login/page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

const mockPush = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ push: mockPush });
(usePathname as jest.Mock).mockReturnValue('/login');

describe('Login page', () => {
  let locationHref: string;
  let locationSearch: string;
  beforeEach(() => {
    mockPush.mockClear();
    localStorage.clear();
    locationHref = '';
    locationSearch = '';
    Object.defineProperty(window, 'location', {
      value: {
        get href() {
          return locationHref;
        },
        set href(v) {
          locationHref = String(v);
        },
        get search() {
          return locationSearch;
        },
        assign: jest.fn(),
      },
      writable: true,
    });
  });

  it('renders login form with email/phone, password and submit button', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in|login/i })).toBeInTheDocument();
  });

  it('shows a Privacy Notice link', () => {
    render(<LoginPage />);
    const privacyLink = screen.getByRole('link', { name: 'Privacy Notice' });
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  it('shows a Terms of Use link', () => {
    render(<LoginPage />);
    const termsLink = screen.getByRole('link', { name: 'Terms of Use' });
    expect(termsLink).toHaveAttribute('href', '/terms-of-use');
  });

  it('shows inactivity sign-out message when reason=idle', () => {
    locationSearch = '?reason=idle';
    render(<LoginPage />);
    expect(screen.getByText(/signed out after two hours without activity/i)).toBeInTheDocument();
  });

  it('on successful login stores token and redirects to dashboard', async () => {
    const user = userEvent.setup();
    const mockResponse = {
      token: 'jwt-123',
      refreshToken: 'refresh-456',
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    };
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    render(<LoginPage />);
    await user.type(screen.getByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/^Password$/), 'password');
    await user.click(screen.getByRole('button', { name: /sign in|login/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/auth\/login$/),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: 'password' }),
        })
      );
    });
    await waitFor(() => {
      expect(localStorage.getItem('church_registry_token')).toBe('jwt-123');
      expect(localStorage.getItem('church_registry_refresh_token')).toBe('refresh-456');
      expect(localStorage.getItem('church_registry_last_activity_ms')).toBeTruthy();
      expect(locationHref).toBe('/dashboard');
    });
  });

  it('on failed login shows error and does not redirect', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve(''),
    });

    render(<LoginPage />);
    await user.type(screen.getByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/^Password$/), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in|login/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/email or password you entered is not correct|invalid credentials|login failed/i),
      ).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
