/**
 * TDD: Dashboard page tests.
 * - When not authenticated, redirects to login
 * - When authenticated, shows time-based greeting and user display name
 */
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter, usePathname } from 'next/navigation';
import { SWRConfig } from 'swr';
import DashboardPage from '@/app/dashboard/page';

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
  useParish: jest.fn(() => ({
    parishId: 10,
    setParishId: jest.fn(),
    dioceseId: 1,
    setDioceseId: jest.fn(),
    parishes: [{ id: 10, parishName: 'St Mary', dioceseId: 1 }],
    dioceses: [{ id: 1, dioceseName: 'Test Diocese', parishes: [] }],
    loading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

function toDashboard(
  counts: { baptisms: number; communions: number; confirmations: number; marriages: number },
  baptisms: unknown[] = [],
  communions: unknown[] = [],
  confirmations: unknown[] = [],
  marriages: unknown[] = []
) {
  return {
    counts: { ...counts, holyOrders: 0 },
    baptisms,
    communions,
    confirmations,
    marriages,
  };
}

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getStoredUser: jest.fn(),
    getStoredToken: jest.fn(),
    fetchDashboard: jest.fn(() =>
      Promise.resolve({
        counts: { baptisms: 0, communions: 0, confirmations: 0, marriages: 0, holyOrders: 0 },
        baptisms: [],
        communions: [],
        confirmations: [],
        marriages: [],
      })
    ),
  };
});

const mockReplace = jest.fn();
const mockPush = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, push: mockPush });
(usePathname as jest.Mock).mockReturnValue('/dashboard');

const defaultParishContext = {
  parishId: 10,
  setParishId: jest.fn(),
  dioceseId: 1,
  setDioceseId: jest.fn(),
  parishes: [{ id: 10, parishName: 'St Mary', dioceseId: 1 }],
  dioceses: [{ id: 1, dioceseName: 'Test Diocese', parishes: [] }],
  loading: false,
  error: null,
  refetch: jest.fn(),
};

describe('Dashboard page', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    localStorage.clear();
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue(null);
    api.getStoredToken.mockReturnValue(null);
    const { useParish } = require('@/context/ParishContext');
    useParish.mockReturnValue(defaultParishContext);
  });

  it('when not authenticated redirects to login', async () => {
    render(<TestWrapper><DashboardPage /></TestWrapper>);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('shows parish welcome when super admin has All dioceses but a parish is selected', async () => {
    const { useParish } = require('@/context/ParishContext');
    useParish.mockReturnValue({
      parishId: 10,
      setParishId: jest.fn(),
      dioceseId: null,
      setDioceseId: jest.fn(),
      parishes: [{ id: 10, parishName: 'St Mary', dioceseId: 1 }],
      dioceses: [{ id: 1, dioceseName: 'Test Diocese', parishes: [] }],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
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

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/Welcome to St Mary Sacrament Registry/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/Select a diocese in the sidebar to view the diocesan dashboard/i),
    ).not.toBeInTheDocument();
  });

  it('shows parish dashboard when parish ADMIN has All dioceses selected (no diocese-dashboard gate)', async () => {
    const { useParish } = require('@/context/ParishContext');
    useParish.mockReturnValue({
      parishId: 10,
      setParishId: jest.fn(),
      dioceseId: null,
      setDioceseId: jest.fn(),
      parishes: [{ id: 10, parishName: 'St Mary', dioceseId: 1 }],
      dioceses: [{ id: 1, dioceseName: 'Test Diocese', parishes: [] }],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Parish Admin',
      role: 'ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDashboard.mockResolvedValue(toDashboard(
      { baptisms: 0, communions: 0, confirmations: 0, marriages: 0 },
      [],
      [],
      [],
      []
    ));
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'admin',
      displayName: 'Parish Admin',
      role: 'ADMIN',
    }));

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/Welcome to St Mary Sacrament Registry/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Select a diocese in the sidebar to view the diocesan dashboard.')).not.toBeInTheDocument();
  });

  it('shows parish welcome when DIOCESE_ADMIN has All dioceses but a parish is selected', async () => {
    const { useParish } = require('@/context/ParishContext');
    useParish.mockReturnValue({
      parishId: 10,
      setParishId: jest.fn(),
      dioceseId: null,
      setDioceseId: jest.fn(),
      parishes: [{ id: 10, parishName: 'St Mary', dioceseId: 1 }],
      dioceses: [{ id: 1, dioceseName: 'Test Diocese', parishes: [] }],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'dioadmin',
      displayName: 'Diocese Admin',
      role: 'DIOCESE_ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'dioadmin',
      displayName: 'Diocese Admin',
      role: 'DIOCESE_ADMIN',
    }));

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/Welcome to St Mary Sacrament Registry/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/Select a diocese in the sidebar to view the diocesan dashboard/i),
    ).not.toBeInTheDocument();
  });

  it('shows parish dashboard when non–diocese-dashboard user has parish selected', async () => {
    const { useParish } = require('@/context/ParishContext');
    useParish.mockReturnValue({
      parishId: 10,
      setParishId: jest.fn(),
      dioceseId: null,
      setDioceseId: jest.fn(),
      parishes: [{ id: 10, parishName: 'St Mary', dioceseId: 1 }],
      dioceses: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'parishuser',
      displayName: 'Parish User',
      role: 'USER',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDashboard.mockResolvedValue(toDashboard(
      { baptisms: 1, communions: 0, confirmations: 0, marriages: 0 },
      [{ id: 1, baptismName: 'John', surname: 'Doe', parishId: 10, dateOfBirth: '2020-01-01' }],
      [],
      [],
      []
    ));
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'parishuser',
      displayName: 'Parish User',
      role: 'USER',
    }));

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/Welcome to St Mary Sacrament Registry/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Select a diocese in the sidebar to view the diocesan dashboard.')).not.toBeInTheDocument();
  });

  it('when authenticated shows greeting and user display name', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem('church_registry_user', JSON.stringify({
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    }));

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/welcome to st mary sacrament registry/i)).toBeInTheDocument();
    });
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent(/Administrator/);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows Holy Communion summary card with count', async () => {
    const year = new Date().getFullYear();
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDashboard.mockResolvedValue(toDashboard(
      { baptisms: 0, communions: 2, confirmations: 0, marriages: 0 },
      [],
      [
        { id: 1, baptismId: 1, communionDate: `${year}-01-10`, officiatingPriest: 'Fr A', parish: 'St Mary' },
        { id: 2, baptismId: 2, communionDate: `${year}-02-11`, officiatingPriest: 'Fr B', parish: 'St Mary' },
      ],
      [],
      []
    ));

    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem(
      'church_registry_user',
      JSON.stringify({
        username: 'admin',
        displayName: 'Administrator',
        role: 'ADMIN',
      })
    );

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getAllByText(/^Holy Communion$/i).length).toBeGreaterThan(0);
    });
    const communionLabel = screen.getAllByText(/^Holy Communion$/i)[0];
    const communionCard = communionLabel.closest('div')?.parentElement ?? null;
    expect(communionCard).not.toBeNull();
    expect((communionCard as HTMLElement).textContent).toContain('2');
    await waitFor(() => {
      expect(screen.getAllByTitle('Holy Communion: 1').length).toBeGreaterThan(0);
    });
  });

  it('shows accurate counts for parishes with 50+ records (uses consolidated dashboard endpoint)', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    const fiftyBaptisms = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      baptismName: 'John',
      surname: `Doe${i}`,
      parishId: 10,
      dateOfBirth: '2020-01-01',
    }));
    api.fetchDashboard.mockResolvedValue(toDashboard(
      { baptisms: 120, communions: 0, confirmations: 0, marriages: 0 },
      fiftyBaptisms,
      [],
      [],
      []
    ));

    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem(
      'church_registry_user',
      JSON.stringify({
        username: 'admin',
        displayName: 'Administrator',
        role: 'ADMIN',
      })
    );

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/120 records/)).toBeInTheDocument();
    });
    const baptismCard = screen.getByText(/120 records/).closest('div')?.parentElement?.parentElement;
    expect(baptismCard).toHaveTextContent(/Baptisms/);
  });

  it('renders visible grouped chart bars when monthly values are non-zero', async () => {
    const year = new Date().getFullYear();
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDashboard.mockResolvedValue(toDashboard(
      { baptisms: 1, communions: 0, confirmations: 0, marriages: 0 },
      [
        {
          id: 1,
          baptismName: 'John',
          otherNames: '',
          surname: 'Doe',
          gender: 'MALE',
          dateOfBirth: '2020-01-10',
          fathersName: 'Father',
          mothersName: 'Mother',
          sponsorNames: 'Sponsor',
          officiatingPriest: 'Fr A',
          parishId: 10,
          createdAt: `${year}-01-15T12:00:00.000Z`,
        },
      ],
      [],
      [],
      []
    ));

    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem(
      'church_registry_user',
      JSON.stringify({
        username: 'admin',
        displayName: 'Administrator',
        role: 'ADMIN',
      })
    );

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    const baptismBar = await waitFor(() => screen.getByTitle('Baptisms: 1'));
    expect(baptismBar).toHaveStyle('height: 100%');
  });

  it('shows empty state with guidance and Register button when sacrament has 0 records', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDashboard.mockResolvedValue(toDashboard(
      { baptisms: 0, communions: 0, confirmations: 0, marriages: 0 }
    ));

    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem(
      'church_registry_user',
      JSON.stringify({
        username: 'admin',
        displayName: 'Administrator',
        role: 'ADMIN',
      })
    );

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/Start by registering your first baptism/)).toBeInTheDocument();
    });
    const baptismLinks = screen.getAllByRole('link', { name: /Register Baptism/ });
    expect(baptismLinks.some((el) => el.getAttribute('href') === '/baptisms/new?parishId=10')).toBe(true);
    expect(screen.getByText(/Start by registering your first communion/)).toBeInTheDocument();
    const communionLinks = screen.getAllByRole('link', { name: /Register Holy Communion/ });
    expect(communionLinks.some((el) => el.getAttribute('href') === '/communions/new?parishId=10')).toBe(true);
    expect(screen.getByText(/Start by registering your first confirmation/)).toBeInTheDocument();
    const confirmationLinks = screen.getAllByRole('link', { name: /Register Confirmation/ });
    expect(confirmationLinks.some((el) => el.getAttribute('href') === '/confirmations/new?parishId=10')).toBe(true);
    expect(screen.getByText(/Start by registering your first marriage/)).toBeInTheDocument();
    const marriageLinks = screen.getAllByRole('link', { name: /Register Marriage/ });
    expect(marriageLinks.some((el) => el.getAttribute('href') === '/marriages/new?parishId=10')).toBe(true);
  });

  it('shows loading skeleton when parish is selected and dashboard data is loading', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    // Never-resolving promise keeps SWR in loading state
    api.fetchDashboard.mockImplementation(() => new Promise(() => {}));

    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem(
      'church_registry_user',
      JSON.stringify({
        username: 'admin',
        displayName: 'Administrator',
        role: 'ADMIN',
      })
    );

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
    expect(screen.queryByText(/Register Baptism/)).not.toBeInTheDocument();
  });

  it('does not show empty state guidance when sacrament has records', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDashboard.mockResolvedValue(toDashboard(
      { baptisms: 5, communions: 0, confirmations: 0, marriages: 0 },
      [{ id: 1, baptismName: 'John', surname: 'Doe', parishId: 10, dateOfBirth: '2020-01-01' }],
      [],
      [],
      []
    ));

    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem(
      'church_registry_user',
      JSON.stringify({
        username: 'admin',
        displayName: 'Administrator',
        role: 'ADMIN',
      })
    );

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText(/5 records/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Start by registering your first baptism/)).not.toBeInTheDocument();
    expect(screen.getByText(/Start by registering your first communion/)).toBeInTheDocument();
  });

  it('shows latest sacramental register entries with baptism full name and date', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDashboard.mockResolvedValue(toDashboard(
      { baptisms: 1, communions: 0, confirmations: 0, marriages: 0 },
      [{
        id: 42,
        baptismName: 'Alice',
        otherNames: 'Mary',
        surname: 'Smith',
        parishId: 10,
        dateOfBirth: '2018-03-15',
      }],
      [],
      [],
      []
    ));

    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem(
      'church_registry_user',
      JSON.stringify({
        username: 'admin',
        displayName: 'Administrator',
        role: 'ADMIN',
      })
    );

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText('Latest sacramental register entries')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Alice Mary Smith').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2018-03-15').length).toBeGreaterThan(0);
    const links = screen.getAllByRole('link', { name: /Alice Mary Smith/i });
    expect(links[0]).toHaveAttribute('href', '/baptisms/42');
  });

  it('shows latest sacramental register entries with marriage partners name and date', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDashboard.mockResolvedValue(toDashboard(
      { baptisms: 0, communions: 0, confirmations: 0, marriages: 1 },
      [],
      [],
      [],
      [{
        id: 7,
        partnersName: 'John Doe & Jane Doe',
        marriageDate: '2024-06-20',
      }]
    ));

    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem(
      'church_registry_user',
      JSON.stringify({
        username: 'admin',
        displayName: 'Administrator',
        role: 'ADMIN',
      })
    );

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getAllByText('John Doe & Jane Doe').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('2024-06-20').length).toBeGreaterThan(0);
    const links = screen.getAllByRole('link', { name: /John Doe & Jane Doe/i });
    expect(links[0]).toHaveAttribute('href', '/marriages/7');
  });

  it('shows latest sacramental register entries with communion and confirmation generic labels', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDashboard.mockResolvedValue(toDashboard(
      { baptisms: 0, communions: 1, confirmations: 1, marriages: 0 },
      [],
      [{ id: 3, communionDate: '2025-01-10' }],
      [{ id: 4, confirmationDate: '2025-02-14' }],
      []
    ));

    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem(
      'church_registry_user',
      JSON.stringify({
        username: 'admin',
        displayName: 'Administrator',
        role: 'ADMIN',
      })
    );

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getAllByText(/^Holy Communion$/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('2025-01-10').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2025-02-14').length).toBeGreaterThan(0);
    const communionLinks = screen.getAllByRole('link', { name: /Holy Communion/i });
    expect(communionLinks.some((el) => el.getAttribute('href') === '/communions/3')).toBe(true);
    const confirmationLinks = screen.getAllByRole('link', { name: /Confirmation/i });
    expect(confirmationLinks.some((el) => el.getAttribute('href') === '/confirmations/4')).toBe(true);
  });

  it('shows empty state when no recent records', async () => {
    const api = require('@/lib/api');
    api.getStoredUser.mockReturnValue({
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    });
    api.getStoredToken.mockReturnValue('jwt-123');
    api.fetchDashboard.mockResolvedValue(toDashboard(
      { baptisms: 0, communions: 0, confirmations: 0, marriages: 0 }
    ));

    localStorage.setItem('church_registry_token', 'jwt-123');
    localStorage.setItem(
      'church_registry_user',
      JSON.stringify({
        username: 'admin',
        displayName: 'Administrator',
        role: 'ADMIN',
      })
    );

    render(<TestWrapper><DashboardPage /></TestWrapper>);

    await waitFor(() => {
      expect(screen.getByText('Latest sacramental register entries')).toBeInTheDocument();
    });
    expect(screen.getByText('No recent records yet.')).toBeInTheDocument();
    expect(screen.getByText('No recent activity.')).toBeInTheDocument();
  });
});
