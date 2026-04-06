/**
 * Tests for API functions.
 */
import {
  createCommunionWithExternalBaptismPendingProof,
  createDiocese,
  fetchDioceses,
  fetchInviteProfile,
  fetchDashboardCounts,
  fetchDioceseDashboard,
  getStoredDioceseId,
  login,
  setStoredDioceseId,
  type DioceseDashboardResponse,
} from '@/lib/api';

const mockDioceseDashboard: DioceseDashboardResponse = {
  counts: {
    parishes: 3,
    baptisms: 150,
    communions: 80,
    confirmations: 45,
    marriages: 22,
    holyOrders: 2,
  },
  parishActivity: [
    { parishId: 1, parishName: 'St Mary', baptisms: 60, communions: 30, confirmations: 15, marriages: 8 },
    { parishId: 2, parishName: 'St Joseph', baptisms: 50, communions: 25, confirmations: 18, marriages: 7 },
    { parishId: 3, parishName: 'St Peter', baptisms: 40, communions: 25, confirmations: 12, marriages: 7 },
  ],
  recentSacraments: {
    baptisms: [
      {
        id: 1,
        baptismName: 'John',
        otherNames: 'Paul',
        surname: 'Doe',
        gender: 'MALE',
        dateOfBirth: '2020-01-15',
        fathersName: 'Father',
        mothersName: 'Mother',
        sponsorNames: 'Sponsor',
        officiatingPriest: 'Fr A',
        parishId: 1,
      },
    ],
    communions: [],
    confirmations: [],
    marriages: [],
  },
  monthly: {
    baptisms: [5, 3, 8, 4, 6, 2, 1, 3, 4, 5, 6, 7],
    communions: [2, 1, 3, 2, 4, 1, 0, 2, 3, 2, 1, 2],
    confirmations: [1, 0, 2, 1, 1, 0, 0, 1, 1, 0, 1, 1],
    marriages: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  },
};

describe('fetchDioceseDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('church_registry_token', 'jwt-test');
  });

  it('calls GET /api/dioceses/{dioceseId}/dashboard with auth header', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDioceseDashboard),
    });
    global.fetch = mockFetch;

    const result = await fetchDioceseDashboard(5);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/dioceses/5/dashboard',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-test',
          'Content-Type': 'application/json',
        }),
      })
    );
    expect(result).toEqual(mockDioceseDashboard);
  });

  it('returns DioceseDashboardResponse with counts, parishActivity, recentSacraments, monthly', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDioceseDashboard),
    });

    const result = await fetchDioceseDashboard(1);

    expect(result.counts).toEqual({
      parishes: 3,
      baptisms: 150,
      communions: 80,
      confirmations: 45,
      marriages: 22,
      holyOrders: 2,
    });
    expect(result.parishActivity).toHaveLength(3);
    expect(result.parishActivity[0]).toEqual({
      parishId: 1,
      parishName: 'St Mary',
      baptisms: 60,
      communions: 30,
      confirmations: 15,
      marriages: 8,
    });
    expect(result.recentSacraments.baptisms).toHaveLength(1);
    expect(result.recentSacraments.baptisms[0].baptismName).toBe('John');
    expect(result.monthly.baptisms).toHaveLength(12);
  });

  it('throws on 401 Unauthorized', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });

    await expect(fetchDioceseDashboard(1)).rejects.toThrow('Unauthorized');
  });

  it('throws on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });

    await expect(fetchDioceseDashboard(1)).rejects.toThrow('Failed to fetch diocese dashboard');
  });

  it('refreshes access token once on 401 and retries request', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            token: 'jwt-refreshed',
            refreshToken: 'refresh-refreshed',
            username: 'admin',
            displayName: 'Admin',
            role: 'ADMIN',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDioceseDashboard),
      });
    global.fetch = mockFetch;
    localStorage.setItem('church_registry_refresh_token', 'refresh-original');
    localStorage.setItem(
      'church_registry_user',
      JSON.stringify({ username: 'admin', displayName: 'Admin', role: 'ADMIN' }),
    );

    const result = await fetchDioceseDashboard(1);

    expect(result).toEqual(mockDioceseDashboard);
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8080/api/auth/refresh',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(localStorage.getItem('church_registry_token')).toBe('jwt-refreshed');
    expect(localStorage.getItem('church_registry_refresh_token')).toBe('refresh-refreshed');
  });

  it('clears auth and throws Unauthorized when refresh fails', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 401 });
    global.fetch = mockFetch;
    localStorage.setItem('church_registry_refresh_token', 'refresh-original');
    localStorage.setItem(
      'church_registry_user',
      JSON.stringify({ username: 'admin', displayName: 'Admin', role: 'ADMIN' }),
    );

    await expect(fetchDioceseDashboard(1)).rejects.toThrow('Unauthorized');
    expect(localStorage.getItem('church_registry_token')).toBeNull();
    expect(localStorage.getItem('church_registry_refresh_token')).toBeNull();
    expect(localStorage.getItem('church_registry_user')).toBeNull();
  });

  it('uses single-flight refresh when multiple requests get 401 concurrently', async () => {
    const delayedRefresh = new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              token: 'jwt-refreshed',
              refreshToken: 'refresh-refreshed',
              username: 'admin',
              displayName: 'Admin',
              role: 'ADMIN',
            }),
        });
      }, 10);
    });

    let dioceseAttempts = 0;
    let parishAttempts = 0;
    const mockFetch = jest.fn((url: string) => {
      if (url.endsWith('/api/dioceses/1/dashboard')) {
        dioceseAttempts += 1;
        if (dioceseAttempts === 1) return Promise.resolve({ ok: false, status: 401 });
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDioceseDashboard),
        });
      }
      if (url.endsWith('/api/parishes/10/dashboard-counts')) {
        parishAttempts += 1;
        if (parishAttempts === 1) return Promise.resolve({ ok: false, status: 401 });
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              baptisms: 1,
              communions: 2,
              confirmations: 3,
              marriages: 4,
              holyOrders: 5,
            }),
        });
      }
      if (url.endsWith('/api/auth/refresh')) {
        return delayedRefresh;
      }
      return Promise.resolve({ ok: false, status: 500 });
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    localStorage.setItem('church_registry_refresh_token', 'refresh-original');
    localStorage.setItem(
      'church_registry_user',
      JSON.stringify({ username: 'admin', displayName: 'Admin', role: 'ADMIN' }),
    );

    const [dashboard, counts] = await Promise.all([
      fetchDioceseDashboard(1),
      fetchDashboardCounts(10),
    ]);

    expect(dashboard.counts.baptisms).toBe(150);
    expect(counts.baptisms).toBe(1);
    const refreshCalls = (mockFetch as jest.Mock).mock.calls.filter(
      ([url]) => typeof url === 'string' && url.endsWith('/api/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
  });
});

describe('getStoredDioceseId / setStoredDioceseId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no diocese stored', () => {
    expect(getStoredDioceseId()).toBeNull();
  });

  it('returns stored diocese id', () => {
    setStoredDioceseId(5);
    expect(getStoredDioceseId()).toBe(5);
  });

  it('clears diocese when set to null', () => {
    setStoredDioceseId(3);
    setStoredDioceseId(null);
    expect(getStoredDioceseId()).toBeNull();
  });

  it('returns null for invalid stored value', () => {
    localStorage.setItem('church_registry_diocese_id', 'invalid');
    expect(getStoredDioceseId()).toBeNull();
  });
});

describe('fetchInviteProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('calls invite-profile endpoint and maps prefill fields', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          title: 'Fr.',
          firstName: 'John',
          lastName: 'Doe',
          invitedEmail: 'john@example.com',
          expiresAt: '2026-04-12T10:00:00Z',
        }),
    });
    global.fetch = mockFetch;

    const response = await fetchInviteProfile('token-123');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/auth/invite-profile?token=token-123',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(response.firstName).toBe('John');
    expect(response.lastName).toBe('Doe');
    expect(response.title).toBe('Fr.');
  });
});

const externalBaptismPayload = {
  baptismName: 'Jane',
  surname: 'Doe',
  otherNames: '',
  gender: 'FEMALE',
  fathersName: 'Father',
  mothersName: 'Mother',
  baptisedChurchAddress: 'St Elsewhere, Other Town',
};

describe('createCommunionWithExternalBaptismPendingProof', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('church_registry_token', 'jwt-test');
  });

  it('POSTs multipart to /api/communions without a certificate field', async () => {
    const mockResponse = {
      id: 1,
      baptismId: 2,
      communionDate: '2024-06-01',
      officiatingPriest: 'Fr X',
      parish: 'St A',
      baptismCertificatePending: true,
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    global.fetch = mockFetch;

    const result = await createCommunionWithExternalBaptismPendingProof(
      10,
      { communionDate: '2024-06-01', officiatingPriest: 'Fr X', parish: 'St A' },
      externalBaptismPayload
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/communions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-test',
        }),
      })
    );
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).not.toHaveProperty('Content-Type');
    const body = init.body as FormData;
    expect(Array.from(body.keys())).not.toContain('certificate');
    expect(body.get('baptismSource')).toBe('external');
    expect(body.get('parishId')).toBe('10');
    expect(body.get('communionDate')).toBe('2024-06-01');
    expect(body.get('externalBaptismName')).toBe('Jane');
    expect(body.get('externalBaptisedChurchAddress')).toBe('St Elsewhere, Other Town');
    expect(result).toEqual(mockResponse);
    expect(result.baptismCertificatePending).toBe(true);
  });

  it('throws Unauthorized on 401', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });

    await expect(
      createCommunionWithExternalBaptismPendingProof(
        1,
        { communionDate: '2024-06-01', officiatingPriest: 'Fr X', parish: 'St A' },
        externalBaptismPayload
      )
    ).rejects.toThrow('Unauthorized');
  });

  it('throws with server error message from JSON body on non-401 failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ error: 'Parish is required for external baptism.' })),
    });

    await expect(
      createCommunionWithExternalBaptismPendingProof(
        1,
        { communionDate: '2024-06-01', officiatingPriest: 'Fr X', parish: 'St A' },
        externalBaptismPayload
      )
    ).rejects.toThrow('Parish is required for external baptism.');
  });
});

describe('diocese API backward compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('church_registry_token', 'jwt-test');
  });

  it('fetchDioceses maps both legacy name and dioceseName fields', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 1, name: 'Legacy Diocese Name' },
        { id: 2, dioceseName: 'Canonical Diocese Name', countryCode: 'NG', ordinaryName: 'John Doe' },
      ]),
    });

    const dioceses = await fetchDioceses();

    expect(dioceses).toEqual([
      {
        id: 1,
        name: 'Legacy Diocese Name',
        dioceseName: undefined,
        countryCode: undefined,
        countryName: undefined,
        jurisdictionType: undefined,
        ordinaryName: undefined,
        ordinaryTitle: undefined,
      },
      {
        id: 2,
        name: 'Canonical Diocese Name',
        dioceseName: 'Canonical Diocese Name',
        countryCode: 'NG',
        countryName: undefined,
        jurisdictionType: undefined,
        ordinaryName: 'John Doe',
        ordinaryTitle: undefined,
      },
    ]);
  });

  it('createDiocese retries with legacy payload when extended payload is rejected', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve('Bad Request') })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 12, dioceseName: 'Diocese of Abuja' }),
      });
    global.fetch = mockFetch;

    const result = await createDiocese('Diocese of Abuja', {
      countryCode: 'NG',
      countryName: 'Nigeria',
      ordinaryTitle: 'Most Rev.',
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8080/api/dioceses',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          dioceseName: 'Diocese of Abuja',
          countryCode: 'NG',
          countryName: 'Nigeria',
          ordinaryTitle: 'Most Rev.',
        }),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8080/api/dioceses',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ dioceseName: 'Diocese of Abuja' }),
      }),
    );
    expect(result).toEqual({ id: 12, dioceseName: 'Diocese of Abuja' });
  });
});

describe('login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8080';
  });

  it('POSTs credentials to /api/auth/login and returns JSON on success', async () => {
    const payload = {
      token: 'access',
      refreshToken: 'refresh',
      user: { username: 'u@example.com', displayName: 'User', role: 'ADMIN' },
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
      text: () => Promise.resolve(''),
    });
    global.fetch = mockFetch;

    const result = await login('u@example.com', 'secret');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'u@example.com', password: 'secret' }),
      }),
    );
    expect(result).toEqual(payload);
  });

  it('throws a user-friendly message on 401', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(''),
    });

    await expect(login('a', 'b')).rejects.toThrow(
      /username or password you entered is not correct/i,
    );
  });

  it('throws API rate-limit message on 429 when body includes error', async () => {
    const body = JSON.stringify({ error: 'Too many requests. Please try again later.' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve(body),
    });

    await expect(login('a', 'b')).rejects.toThrow('Too many requests. Please try again later.');
  });

  it('throws default rate-limit guidance on 429 when body is empty', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve(''),
    });

    await expect(login('a', 'b')).rejects.toThrow(/Too many sign-in attempts from this network/i);
  });

  it('throws a user-friendly message on 5xx', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(''),
    });

    await expect(login('a', 'b')).rejects.toThrow(/temporarily unavailable/i);
  });

  it('throws parsed detail on other errors (e.g. 400)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ message: 'Account is locked.' })),
    });

    await expect(login('a', 'b')).rejects.toThrow('Account is locked.');
  });

  it('maps Failed to fetch to a user-friendly network message after retries', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(login('a', 'b')).rejects.toThrow(
      /We could not reach the server\. Check your internet connection/i,
    );
    expect(global.fetch).toHaveBeenCalled();
  });
});
