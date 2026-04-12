/**
 * TDD: Diocese Dashboard page tests.
 * - Non–diocese-dashboard roles (e.g. PRIEST, parish ADMIN) redirect to /dashboard
 * - SUPER_ADMIN and DIOCESE_ADMIN may access; when no diocese selected, shows select-diocese message
 * - When diocese selected, fetches and displays diocese dashboard data
 * - Sortable parish table, stat cards, chart, recent sacraments with parish
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, usePathname } from 'next/navigation';
import { SWRConfig } from 'swr';
import DioceseDashboardPage from '@/app/dashboard/diocese/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>
      {children}
    </SWRConfig>
  );
}

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('@/context/ParishContext', () => ({
  useParish: jest.fn(),
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, push: mockPush });
(usePathname as jest.Mock).mockReturnValue('/dashboard/diocese');

const defaultDioceseContext = {
  parishId: 10,
  setParishId: jest.fn(),
  dioceseId: 1,
  setDioceseId: jest.fn(),
  parishes: [{ id: 10, parishName: 'St Mary', dioceseId: 1 }],
  dioceses: [{ id: 1, dioceseName: 'Archdiocese of Accra', parishes: [] }],
  loading: false,
  error: null,
  refetch: jest.fn(),
};

const mockDioceseDashboard = {
  counts: {
    parishes: 5,
    baptisms: 42,
    communions: 30,
    confirmations: 25,
    marriages: 12,
    holyOrders: 2,
  },
  parishActivity: [
    { parishId: 10, parishName: 'St Mary', baptisms: 15, communions: 10, confirmations: 8, marriages: 3 },
    { parishId: 11, parishName: 'St John', baptisms: 12, communions: 8, confirmations: 6, marriages: 2 },
  ],
  recentSacraments: {
    baptisms: [{ id: 1, baptismName: 'Alice', otherNames: '', surname: 'Smith', parishId: 10, dateOfBirth: '2024-01-15' }],
    communions: [],
    confirmations: [],
    marriages: [],
  },
  monthly: {
    baptisms: [2, 3, 4, 5, 3, 4, 5, 4, 3, 2, 2, 1],
    communions: [1, 2, 2, 3, 2, 3, 3, 2, 2, 1, 1, 0],
    confirmations: [0, 1, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0],
    marriages: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
};

jest.mock('@/lib/api', () => ({
  getStoredUser: jest.fn(),
  getStoredToken: jest.fn(),
  fetchDioceseDashboard: jest.fn(),
}));

describe('Diocese Dashboard page', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    localStorage.clear();
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue(null);
    api.getStoredToken.mockReturnValue(null);
    api.fetchDioceseDashboard.mockResolvedValue(mockDioceseDashboard);
    const { useParish } = require('@/context/ParishContext');
    useParish.mockReturnValue(defaultDioceseContext);
  });

  it('redirects non-admin users to /dashboard', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'priest',
      displayName: 'Priest',
      role: 'PRIEST',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'priest',
      displayName: 'Priest',
      role: 'PRIEST',
    }));

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('redirects parish ADMIN to /dashboard', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Parish Admin',
      role: 'ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'admin',
      displayName: 'Parish Admin',
      role: 'ADMIN',
    }));

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows Redirecting… and does not fetch for non-admin users', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'priest',
      displayName: 'Priest',
      role: 'PRIEST',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'priest',
      displayName: 'Priest',
      role: 'PRIEST',
    }));

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    expect(screen.getByText('Redirecting…')).toBeInTheDocument();
    expect(api.fetchDioceseDashboard).not.toHaveBeenCalled();
    expect(screen.queryByText('Parish Activity')).not.toBeInTheDocument();
  });

  it('redirects to login when not authenticated', async () => {
    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('shows select-diocese message when no diocese selected', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    }));
    const { useParish } = require('@/context/ParishContext');
    useParish.mockReturnValue({
      ...defaultDioceseContext,
      dioceseId: null,
    });

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText('Select a diocese in the sidebar to view the diocesan dashboard.')).toBeInTheDocument();
    });
    expect(api.fetchDioceseDashboard).not.toHaveBeenCalled();
  });

  it('fetches and displays diocese dashboard when diocese selected', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    }));

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(api.fetchDioceseDashboard).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.getByText(/42 records/)).toBeInTheDocument();
    });
    expect(screen.getByText('Welcome to Archdiocese of Accra Dashboard')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'St Mary' })).toHaveAttribute('href', '/dashboard?parishId=10');
    expect(screen.getByRole('link', { name: 'St John' })).toHaveAttribute('href', '/dashboard?parishId=11');
    expect(screen.getByRole('link', { name: /Alice Smith/i })).toHaveAttribute('href', '/baptisms/1');
  });

  it('shows loading skeleton when diocese selected and data loading', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDioceseDashboard.mockImplementation(() => new Promise(() => {}));
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    }));

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
  });

  it('shows error when fetch fails', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDioceseDashboard.mockRejectedValue(new Error('Network error'));
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    }));

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/network error|failed/i);
    });
  });

  it('allows SUPER_ADMIN to access diocese dashboard', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'superadmin',
      displayName: 'Super Admin',
      role: 'SUPER_ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'superadmin',
      displayName: 'Super Admin',
      role: 'SUPER_ADMIN',
    }));

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(api.fetchDioceseDashboard).toHaveBeenCalledWith(1);
    });
    expect(screen.getByText('Welcome to Archdiocese of Accra Dashboard')).toBeInTheDocument();
  });

  it('displays all stat cards with correct counts', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    }));

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText('42 records')).toBeInTheDocument();
    });
    const recordCounts = screen.getAllByText(/ records$/);
    expect(recordCounts.length).toBeGreaterThanOrEqual(6);
    const countTexts = recordCounts.map((el) => el.textContent);
    expect(countTexts).toContain('5 records');
    expect(countTexts).toContain('42 records');
    expect(countTexts).toContain('30 records');
    expect(countTexts).toContain('25 records');
    expect(countTexts).toContain('12 records');
    expect(countTexts).toContain('2 records');
  });

  it('sorts parish activity table when column header is clicked', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDioceseDashboard.mockResolvedValue({
      ...mockDioceseDashboard,
      parishActivity: [
        { parishId: 10, parishName: 'St Anne', baptisms: 5, communions: 2, confirmations: 1, marriages: 0 },
        { parishId: 11, parishName: 'St Bernard', baptisms: 25, communions: 15, confirmations: 10, marriages: 5 },
      ],
    });
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    }));

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText('St Anne')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('St Anne');
    expect(rows[1]).toHaveTextContent('St Bernard');

    const baptismsHeader = screen.getByRole('button', { name: /Baptisms/ });
    await userEvent.click(baptismsHeader);
    await userEvent.click(baptismsHeader);

    const rowsAfterSort = screen.getAllByRole('row').slice(1);
    expect(rowsAfterSort[0]).toHaveTextContent('St Bernard');
    expect(rowsAfterSort[1]).toHaveTextContent('St Anne');
  });

  it('renders chart section with sacrament legend', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    }));

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText('Sacraments by month')).toBeInTheDocument();
    });
    expect(screen.getByText('Diocese-wide totals')).toBeInTheDocument();
    expect(screen.getAllByText('Baptisms').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Confirmations').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Holy Communion').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Marriages').length).toBeGreaterThanOrEqual(1);
  });

  it('shows parish name in recent sacraments when available', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDioceseDashboard.mockResolvedValue({
      ...mockDioceseDashboard,
      parishActivity: [],
      recentSacraments: {
        baptisms: [{
          id: 1,
          baptismName: 'Alice',
          otherNames: '',
          surname: 'Smith',
          parishId: 10,
          parishName: 'St Mary',
          dateOfBirth: '2024-01-15',
        }],
        communions: [],
        confirmations: [],
        marriages: [],
      },
    });
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    }));

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText('Latest diocesan records')).toBeInTheDocument();
    });
    expect(screen.getByTitle('St Mary')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Alice Smith/i })).toHaveAttribute('href', '/baptisms/1');
  });

  it('shows empty state when no parish activity', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDioceseDashboard.mockResolvedValue({
      ...mockDioceseDashboard,
      parishActivity: [],
    });
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    }));

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText('Parish Activity')).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: 'St Mary' })).not.toBeInTheDocument();
  });

  it('shows no recent records when recent sacraments are empty', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDioceseDashboard.mockResolvedValue({
      ...mockDioceseDashboard,
      recentSacraments: {
        baptisms: [],
        communions: [],
        confirmations: [],
        marriages: [],
      },
    });
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'admin',
      displayName: 'Administrator',
      role: 'DIOCESE_ADMIN',
    }));

    render(<TestWrapper><DioceseDashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText('Latest diocesan records')).toBeInTheDocument();
    });
    expect(screen.getByText('No recent records yet.')).toBeInTheDocument();
  });
});
