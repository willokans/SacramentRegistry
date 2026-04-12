/**
 * Tests for ParishContext (ParishProvider, useParish) including diocese support.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname } from 'next/navigation';
import { ParishProvider, useParish } from '@/context/ParishContext';
import * as api from '@/lib/api';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    fetchDiocesesWithParishes: jest.fn(),
    getStoredToken: jest.fn(),
    getStoredParishId: jest.fn(),
    getStoredDioceseId: jest.fn(),
    getStoredSidebarCountryKey: jest.fn(),
    setStoredParishId: jest.fn(),
    setStoredDioceseId: jest.fn(),
    setStoredSidebarCountryKey: jest.fn(),
    clearAuth: jest.fn(),
  };
});

const mockDioceses = [
  {
    id: 1,
    dioceseName: 'Diocese A',
    countryCode: 'GH',
    countryName: 'Ghana',
    parishes: [
      { id: 10, parishName: 'St Mary', dioceseId: 1 },
      { id: 11, parishName: 'St John', dioceseId: 1 },
    ],
  },
  {
    id: 2,
    dioceseName: 'Diocese B',
    countryCode: 'KE',
    countryName: 'Kenya',
    parishes: [{ id: 20, parishName: 'St Peter', dioceseId: 2 }],
  },
  {
    id: 3,
    dioceseName: 'Diocese Empty',
    countryCode: 'US',
    countryName: 'United States',
    parishes: [],
  },
];

function Consumer() {
  const {
    parishId,
    setParishId,
    dioceseId,
    setDioceseId,
    sidebarCountryKey,
    setSidebarCountryKey,
    parishes,
    dioceses,
    loading,
    error,
    refetch,
  } = useParish();
  return (
    <div>
      <span data-testid="parish-id">{String(parishId)}</span>
      <span data-testid="diocese-id">{String(dioceseId)}</span>
      <span data-testid="sidebar-country">{sidebarCountryKey === null ? 'null' : sidebarCountryKey}</span>
      <span data-testid="parishes-count">{parishes.length}</span>
      <span data-testid="dioceses-count">{dioceses.length}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? ''}</span>
      <button type="button" onClick={() => setParishId(20)}>Set parish 20</button>
      <button type="button" onClick={() => setDioceseId(1)}>Set diocese 1</button>
      <button type="button" onClick={() => setDioceseId(3)}>Set diocese 3</button>
      <button type="button" onClick={() => setDioceseId(null)}>Clear diocese</button>
      <button type="button" onClick={() => setSidebarCountryKey('GH')}>Set country GH</button>
      <button type="button" onClick={() => setSidebarCountryKey(null)}>Clear country</button>
      <button type="button" onClick={refetch}>Refetch</button>
    </div>
  );
}

describe('ParishContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    (api.getStoredToken as jest.Mock).mockReturnValue('jwt-test');
    (api.getStoredParishId as jest.Mock).mockReturnValue(null);
    (api.getStoredDioceseId as jest.Mock).mockReturnValue(null);
    (api.getStoredSidebarCountryKey as jest.Mock).mockReturnValue(null);
    (api.fetchDiocesesWithParishes as jest.Mock).mockResolvedValue(mockDioceses);
  });

  it('useParish throws when used outside ParishProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow('useParish must be used within ParishProvider');
    spy.mockRestore();
  });

  it('exposes dioceseId, setDioceseId, and dioceses from useParish', async () => {
    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('diocese-id')).toHaveTextContent('null');
      expect(screen.getByTestId('dioceses-count')).toHaveTextContent('3');
    });
  });

  it('fetches dioceses and sets parishes when token exists', async () => {
    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(api.fetchDiocesesWithParishes).toHaveBeenCalled();
      expect(screen.getByTestId('parishes-count')).toHaveTextContent('3');
      expect(screen.getByTestId('parish-id')).toHaveTextContent('10');
    });
  });

  it('filters parishes when dioceseId is set', async () => {
    const user = userEvent.setup();
    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('parishes-count')).toHaveTextContent('3');
    });

    await user.click(screen.getByRole('button', { name: 'Set diocese 1' }));

    await waitFor(() => {
      expect(screen.getByTestId('diocese-id')).toHaveTextContent('1');
      expect(screen.getByTestId('parishes-count')).toHaveTextContent('2');
      expect(api.setStoredDioceseId).toHaveBeenCalledWith(1);
    });
  });

  it('shows all parishes when dioceseId is cleared', async () => {
    const user = userEvent.setup();
    (api.getStoredDioceseId as jest.Mock).mockReturnValue(1);

    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('diocese-id')).toHaveTextContent('1');
      expect(screen.getByTestId('parishes-count')).toHaveTextContent('2');
    });

    await user.click(screen.getByRole('button', { name: 'Clear diocese' }));

    await waitFor(() => {
      expect(screen.getByTestId('diocese-id')).toHaveTextContent('null');
      expect(screen.getByTestId('parishes-count')).toHaveTextContent('3');
      expect(api.setStoredDioceseId).toHaveBeenCalledWith(null);
    });
  });

  it('clears parishId when selected diocese has no parishes', async () => {
    const user = userEvent.setup();
    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('parish-id')).toHaveTextContent('10');
    });

    await user.click(screen.getByRole('button', { name: 'Set diocese 3' }));

    await waitFor(() => {
      expect(screen.getByTestId('diocese-id')).toHaveTextContent('3');
      expect(screen.getByTestId('parishes-count')).toHaveTextContent('0');
      expect(screen.getByTestId('parish-id')).toHaveTextContent('null');
      expect(api.setStoredParishId).toHaveBeenCalledWith(null);
    });
  });

  it('selects first parish when leaving an empty diocese and choosing one with parishes', async () => {
    const user = userEvent.setup();
    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('parish-id')).toHaveTextContent('10');
    });

    await user.click(screen.getByRole('button', { name: 'Set diocese 3' }));

    await waitFor(() => {
      expect(screen.getByTestId('parish-id')).toHaveTextContent('null');
    });

    await user.click(screen.getByRole('button', { name: 'Set diocese 1' }));

    await waitFor(() => {
      expect(screen.getByTestId('diocese-id')).toHaveTextContent('1');
      expect(screen.getByTestId('parishes-count')).toHaveTextContent('2');
      expect(screen.getByTestId('parish-id')).toHaveTextContent('10');
      expect(api.setStoredParishId).toHaveBeenCalledWith(10);
    });
  });

  it('resets parishId when diocese changes and current parish not in new diocese', async () => {
    const user = userEvent.setup();
    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('parish-id')).toHaveTextContent('10');
    });

    await user.click(screen.getByRole('button', { name: 'Set parish 20' }));

    await waitFor(() => {
      expect(screen.getByTestId('parish-id')).toHaveTextContent('20');
    });

    await user.click(screen.getByRole('button', { name: 'Set diocese 1' }));

    await waitFor(() => {
      expect(screen.getByTestId('parish-id')).toHaveTextContent('10');
    });
  });

  it('restores dioceseId from storage on load', async () => {
    (api.getStoredDioceseId as jest.Mock).mockReturnValue(2);

    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('diocese-id')).toHaveTextContent('2');
      expect(screen.getByTestId('parishes-count')).toHaveTextContent('1');
      expect(screen.getByTestId('parish-id')).toHaveTextContent('20');
    });
  });

  it('skips fetch and sets loading false when no token', async () => {
    (api.getStoredToken as jest.Mock).mockReturnValue(null);

    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(api.fetchDiocesesWithParishes).not.toHaveBeenCalled();
    });
  });

  it('refetch triggers new fetch', async () => {
    const user = userEvent.setup();
    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(api.fetchDiocesesWithParishes).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Refetch' }));

    await waitFor(() => {
      expect(api.fetchDiocesesWithParishes).toHaveBeenCalledTimes(2);
    });
  });

  it('on Unauthorized clears state and sets error', async () => {
    (api.fetchDiocesesWithParishes as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(api.clearAuth).toHaveBeenCalled();
      expect(screen.getByTestId('error')).toHaveTextContent('Session expired. Please sign in again.');
    });
  });

  it('persists sidebar country from storage when compatible with diocese', async () => {
    (api.getStoredSidebarCountryKey as jest.Mock).mockReturnValue('GH');
    (api.getStoredDioceseId as jest.Mock).mockReturnValue(1);

    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-country')).toHaveTextContent('GH');
      expect(screen.getByTestId('diocese-id')).toHaveTextContent('1');
      expect(screen.getByTestId('parishes-count')).toHaveTextContent('2');
      expect(api.setStoredSidebarCountryKey).toHaveBeenCalledWith('GH');
    });
  });

  it('clears incompatible stored country when it does not match stored diocese', async () => {
    (api.getStoredSidebarCountryKey as jest.Mock).mockReturnValue('GH');
    (api.getStoredDioceseId as jest.Mock).mockReturnValue(2);

    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-country')).toHaveTextContent('null');
      expect(screen.getByTestId('diocese-id')).toHaveTextContent('2');
      expect(api.setStoredSidebarCountryKey).toHaveBeenCalledWith(null);
    });
  });

  it('filters parishes to selected sidebar country when diocese is cleared', async () => {
    const user = userEvent.setup();
    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('parishes-count')).toHaveTextContent('3');
    });

    await user.click(screen.getByRole('button', { name: 'Set country GH' }));

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-country')).toHaveTextContent('GH');
      expect(screen.getByTestId('parishes-count')).toHaveTextContent('2');
      expect(api.setStoredSidebarCountryKey).toHaveBeenCalledWith('GH');
    });
  });

  it('clears diocese when sidebar country excludes that diocese', async () => {
    const user = userEvent.setup();
    (api.getStoredDioceseId as jest.Mock).mockReturnValue(2);

    render(
      <ParishProvider>
        <Consumer />
      </ParishProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('diocese-id')).toHaveTextContent('2');
    });

    await user.click(screen.getByRole('button', { name: 'Set country GH' }));

    await waitFor(() => {
      expect(screen.getByTestId('diocese-id')).toHaveTextContent('null');
      expect(api.setStoredDioceseId).toHaveBeenCalledWith(null);
    });
  });
});
