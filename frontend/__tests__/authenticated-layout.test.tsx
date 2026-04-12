/**
 * TDD: Authenticated layout tests.
 * - When authenticated: renders header with Sacrament Registry branding and cross, sidebar, and children
 * - When not authenticated: redirects to /login and does not render layout content
 */
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, usePathname } from 'next/navigation';
import { getStoredToken, getStoredUser } from '@/lib/api';
import { useParish } from '@/context/ParishContext';
import { defaultParishContext } from './test-utils';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getStoredToken: jest.fn(),
    getStoredUser: jest.fn(),
  };
});

jest.mock('@/context/ParishContext', () => ({
  useParish: jest.fn(),
}));

const mockPush = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ push: mockPush });
(usePathname as jest.Mock).mockReturnValue('/dashboard');

describe('AuthenticatedLayout', () => {
  beforeEach(() => {
    mockPush.mockClear();
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    (getStoredToken as jest.Mock).mockReturnValue('token');
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'admin',
      displayName: 'Admin',
      role: 'ADMIN',
    });
    window.localStorage.clear();
    (useParish as jest.Mock).mockReturnValue(defaultParishContext);
  });

  it('shows the offline banner when navigator is offline', () => {
    const originalOnLine = window.navigator.onLine;
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });

    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );

    expect(
      screen.getByText(/you are offline\. new submissions will be saved locally and synced automatically when you are back online\./i)
    ).toBeInTheDocument();

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: originalOnLine });
  });

  it('renders header with Sacrament Registry branding when authenticated', () => {
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    expect(screen.getAllByText('Sacrament Registry').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a cross in the header when authenticated', () => {
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    const brandingHeader = screen.getAllByText('Sacrament Registry')[0].closest('header');
    expect(brandingHeader).toBeInTheDocument();
    expect(brandingHeader?.querySelector('svg')).toBeInTheDocument();
  });

  it('renders a sidebar (navigation) when authenticated', () => {
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });

  it('Parish Dashboard link points to /dashboard', () => {
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    const dashboardLink = screen.getByRole('link', { name: 'Parish Dashboard' });
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
  });

  it('parish ADMIN does not see Diocese Dashboard link', () => {
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    expect(screen.queryByRole('link', { name: 'Diocese Dashboard' })).not.toBeInTheDocument();
  });

  it('DIOCESE_ADMIN sees Diocese Dashboard link pointing to /dashboard/diocese', () => {
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'dioadmin',
      displayName: 'Diocese Admin',
      role: 'DIOCESE_ADMIN',
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    const dioceseDashboardLink = screen.getByRole('link', { name: 'Diocese Dashboard' });
    expect(dioceseDashboardLink).toHaveAttribute('href', '/dashboard/diocese');
  });

  it('SUPER_ADMIN sees Diocese Dashboard link pointing to /dashboard/diocese', () => {
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'superadmin',
      displayName: 'Super Administrator',
      role: 'SUPER_ADMIN',
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    const dioceseDashboardLink = screen.getByRole('link', { name: 'Diocese Dashboard' });
    expect(dioceseDashboardLink).toHaveAttribute('href', '/dashboard/diocese');
  });

  it('Help link points to /help in sidebar', () => {
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const helpLink = within(nav).getByRole('link', { name: 'Help' });
    expect(helpLink).toHaveAttribute('href', '/help');
  });

  it('Trust & Legal footer groups data protection, privacy, and terms in order', () => {
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    expect(screen.getByText('Trust & Legal')).toBeInTheDocument();
    expect(screen.getByText('Learn how your data is handled and protected.')).toBeInTheDocument();
    const trustNav = screen.getByRole('navigation', { name: 'Trust and legal' });
    expect(within(trustNav).getByRole('link', { name: 'Data Protection & Trust' })).toHaveAttribute(
      'href',
      '/data-protection'
    );
    expect(within(trustNav).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(within(trustNav).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms-of-use');
    const trustLinks = within(trustNav).getAllByRole('link');
    expect(trustLinks.map((a) => a.getAttribute('href'))).toEqual(['/data-protection', '/privacy', '/terms-of-use']);
  });

  it('main navigation does not duplicate Trust & Legal links', () => {
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    const mainNav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(mainNav).queryByRole('link', { name: 'Privacy' })).not.toBeInTheDocument();
    expect(within(mainNav).queryByRole('link', { name: 'Terms' })).not.toBeInTheDocument();
    expect(within(mainNav).queryByRole('link', { name: 'Data Protection & Trust' })).not.toBeInTheDocument();
  });

  it('redirects to /login when no token', () => {
    (getStoredToken as jest.Mock).mockReturnValue(null);
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Sacrament Registry')).not.toBeInTheDocument();
  });

  it('redirects to /login when no user', () => {
    (getStoredUser as jest.Mock).mockReturnValue(null);
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });

  it('parish selector displays only assigned parishes when parishes present', () => {
    (useParish as jest.Mock).mockReturnValue({
      ...defaultParishContext,
      parishId: 10,
      parishes: [
        { id: 10, parishName: 'St Mary', dioceseId: 1 },
        { id: 11, parishName: 'St John', dioceseId: 1 },
      ],
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    const parishSelect = screen.getByRole('combobox', { name: /parish/i });
    expect(parishSelect).toBeInTheDocument();
    expect(within(parishSelect).getByRole('option', { name: 'St Mary' })).toBeInTheDocument();
    expect(within(parishSelect).getByRole('option', { name: 'St John' })).toBeInTheDocument();
  });

  it('no-assigned-parish state: non-admin sees "No parish assigned. Contact admin."', () => {
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'priest',
      displayName: 'Priest',
      role: 'PRIEST',
    });
    (useParish as jest.Mock).mockReturnValue({
      ...defaultParishContext,
      parishId: null,
      parishes: [],
      loading: false,
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    expect(screen.getByText('No parish assigned. Contact admin.')).toBeInTheDocument();
  });

  it('ADMIN sees Administration link pointing to /settings in sidebar', () => {
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    const settingsLinks = screen.getAllByRole('link', { name: 'Administration' });
    expect(settingsLinks.some((el) => el.getAttribute('href') === '/settings')).toBe(true);
  });

  it('SUPER_ADMIN sees Administration link in sidebar (User Setup moved under Administration)', () => {
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'superadmin',
      displayName: 'Super Administrator',
      role: 'SUPER_ADMIN',
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    expect(screen.queryByRole('link', { name: 'User Setup' })).not.toBeInTheDocument();
    const settingsLinks = screen.getAllByRole('link', { name: 'Administration' });
    expect(settingsLinks.some((el) => el.getAttribute('href') === '/settings')).toBe(true);
  });

  it('ADMIN does not see User Setup link in sidebar', () => {
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'admin',
      displayName: 'Admin',
      role: 'ADMIN',
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    expect(screen.queryByRole('link', { name: 'User Setup' })).not.toBeInTheDocument();
  });

  it('non-admin does not see Diocese Dashboard link', () => {
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'priest',
      displayName: 'Priest',
      role: 'PRIEST',
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    expect(screen.queryByRole('link', { name: 'Diocese Dashboard' })).not.toBeInTheDocument();
  });

  it('ADMIN sees Diocese selector when dioceses are loaded', () => {
    (useParish as jest.Mock).mockReturnValue({
      ...defaultParishContext,
      dioceses: [
        { id: 1, dioceseName: 'Archdiocese of Accra', parishes: [] },
        { id: 2, dioceseName: 'Diocese of Kumasi', parishes: [] },
      ],
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    const dioceseSelect = screen.getByRole('combobox', { name: /diocese/i });
    expect(dioceseSelect).toBeInTheDocument();
    expect(within(dioceseSelect).getByRole('option', { name: 'Archdiocese of Accra' })).toBeInTheDocument();
    expect(within(dioceseSelect).getByRole('option', { name: 'Diocese of Kumasi' })).toBeInTheDocument();
  });

  it('Diocese selector lists dioceses alphabetically by name (not API order)', () => {
    (useParish as jest.Mock).mockReturnValue({
      ...defaultParishContext,
      sidebarCountryKey: null,
      dioceses: [
        { id: 3, dioceseName: 'Lagos', countryCode: 'NG', parishes: [] },
        { id: 1, dioceseName: 'Abuja', countryCode: 'NG', parishes: [] },
        { id: 2, dioceseName: 'Kano', countryCode: 'NG', parishes: [] },
      ],
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    const dioceseSelect = document.getElementById('diocese-select') as HTMLSelectElement;
    expect(dioceseSelect).toBeTruthy();
    const labels = within(dioceseSelect)
      .getAllByRole('option')
      .map((opt) => opt.textContent?.trim() ?? '');
    expect(labels).toEqual(['All dioceses', 'Abuja', 'Kano', 'Lagos']);
  });

  it('ADMIN sees Country selector with distinct countries and All countries', () => {
    (useParish as jest.Mock).mockReturnValue({
      ...defaultParishContext,
      sidebarCountryKey: null,
      setSidebarCountryKey: jest.fn(),
      dioceses: [
        { id: 1, dioceseName: 'D1', countryCode: 'GH', countryName: 'Ghana', parishes: [] },
        { id: 2, dioceseName: 'D2', countryCode: 'KE', countryName: 'Kenya', parishes: [] },
      ],
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    const countrySelect = document.getElementById('country-select') as HTMLSelectElement;
    expect(countrySelect).toBeTruthy();
    expect(within(countrySelect).getByRole('option', { name: 'All countries' })).toBeInTheDocument();
    expect(within(countrySelect).getByRole('option', { name: 'Ghana' })).toBeInTheDocument();
    expect(within(countrySelect).getByRole('option', { name: 'Kenya' })).toBeInTheDocument();
  });

  it('Country selector lists countries alphabetically by display name (not API order)', () => {
    (useParish as jest.Mock).mockReturnValue({
      ...defaultParishContext,
      sidebarCountryKey: null,
      setSidebarCountryKey: jest.fn(),
      dioceses: [
        { id: 3, dioceseName: 'D3', countryCode: 'NG', countryName: 'Nigeria', parishes: [] },
        { id: 1, dioceseName: 'D1', countryCode: 'KE', countryName: 'Kenya', parishes: [] },
        { id: 2, dioceseName: 'D2', countryCode: 'GH', countryName: 'Ghana', parishes: [] },
      ],
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    const countrySelect = document.getElementById('country-select') as HTMLSelectElement;
    expect(countrySelect).toBeTruthy();
    const labels = within(countrySelect)
      .getAllByRole('option')
      .map((opt) => opt.textContent?.trim() ?? '');
    expect(labels).toEqual(['All countries', 'Ghana', 'Kenya', 'Nigeria']);
  });

  it('changing Country calls setSidebarCountryKey with code or null for All countries', async () => {
    const user = userEvent.setup();
    const setSidebarCountryKey = jest.fn();
    (useParish as jest.Mock).mockReturnValue({
      ...defaultParishContext,
      sidebarCountryKey: null,
      setSidebarCountryKey,
      dioceses: [
        { id: 1, dioceseName: 'D1', countryCode: 'GH', countryName: 'Ghana', parishes: [] },
        { id: 2, dioceseName: 'D2', countryCode: 'KE', countryName: 'Kenya', parishes: [] },
      ],
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    const countrySelect = document.getElementById('country-select') as HTMLSelectElement;
    await user.selectOptions(countrySelect, 'GH');
    expect(setSidebarCountryKey).toHaveBeenCalledWith('GH');
    await user.selectOptions(countrySelect, '');
    expect(setSidebarCountryKey).toHaveBeenCalledWith(null);
  });

  it('DIOCESE_ADMIN sees Country and Diocese selectors when dioceses are loaded', () => {
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'dio',
      displayName: 'Diocese Admin',
      role: 'DIOCESE_ADMIN',
    });
    (useParish as jest.Mock).mockReturnValue({
      ...defaultParishContext,
      dioceses: [
        { id: 1, dioceseName: 'One', countryCode: 'GH', parishes: [] },
      ],
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    expect(document.getElementById('country-select')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /diocese/i })).toBeInTheDocument();
  });

  it('no-assigned-parish state: admin sees "No parish selected" and Add diocese link', () => {
    (useParish as jest.Mock).mockReturnValue({
      ...defaultParishContext,
      parishId: null,
      parishes: [],
      loading: false,
    });
    render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    expect(screen.getByText('No parish selected')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /directory management/i })).toBeInTheDocument();
  });

  it('closes mobile menu overlay when pathname changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    await waitFor(() => {
      expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    });
    const openMenuBtn = screen.getByRole('button', { name: /open menu/i });
    await user.click(openMenuBtn);
    const overlay = document.querySelector('.bg-black\\/50');
    expect(overlay).toBeInTheDocument();
    (usePathname as jest.Mock).mockReturnValue('/baptisms');
    rerender(
      <AuthenticatedLayout>
        <p>Dashboard content</p>
      </AuthenticatedLayout>
    );
    await waitFor(() => {
      expect(document.querySelector('.bg-black\\/50')).not.toBeInTheDocument();
    });
  });
});
