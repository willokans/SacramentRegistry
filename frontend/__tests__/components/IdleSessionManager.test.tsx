/**
 * IdleSessionManager signs out when last activity is older than IDLE_SESSION_MS.
 */
import { render, act } from '@testing-library/react';
import IdleSessionManager from '@/components/IdleSessionManager';
import { IDLE_SESSION_MS } from '@/lib/authIdle';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api') as typeof import('@/lib/api');
  return {
    ...actual,
    getStoredToken: jest.fn(),
    clearAuth: jest.fn(),
    touchAuthActivity: jest.fn(),
    readAuthLastActivityMs: jest.fn(),
  };
});

import {
  getStoredToken,
  clearAuth,
  touchAuthActivity,
  readAuthLastActivityMs,
} from '@/lib/api';

const getStoredTokenMock = getStoredToken as jest.Mock;
const clearAuthMock = clearAuth as jest.Mock;
const touchAuthActivityMock = touchAuthActivity as jest.Mock;
const readAuthLastActivityMsMock = readAuthLastActivityMs as jest.Mock;

describe('IdleSessionManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
    mockReplace.mockClear();
    clearAuthMock.mockClear();
    touchAuthActivityMock.mockClear();
    readAuthLastActivityMsMock.mockReset();
    getStoredTokenMock.mockReturnValue('jwt');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes missing last-activity timestamp when session exists', () => {
    readAuthLastActivityMsMock.mockReturnValue(null);
    render(<IdleSessionManager />);
    expect(touchAuthActivityMock).toHaveBeenCalled();
    expect(clearAuthMock).not.toHaveBeenCalled();
  });

  it('clears auth and navigates to login when idle beyond limit', () => {
    const stale = Date.now() - IDLE_SESSION_MS - 1000;
    readAuthLastActivityMsMock.mockReturnValue(stale);
    render(<IdleSessionManager />);
    expect(clearAuthMock).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/login?reason=idle');
  });

  it('on interval, logs out if activity becomes stale', () => {
    const recent = Date.now() - 60_000;
    readAuthLastActivityMsMock.mockReturnValue(recent);
    render(<IdleSessionManager />);
    expect(clearAuthMock).not.toHaveBeenCalled();

    readAuthLastActivityMsMock.mockReturnValue(Date.now() - IDLE_SESSION_MS - 1);
    act(() => {
      jest.advanceTimersByTime(60_001);
    });
    expect(clearAuthMock).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/login?reason=idle');
  });
});
