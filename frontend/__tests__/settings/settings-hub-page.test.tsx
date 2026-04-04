/**
 * Administration hub lists admin tools including marriage requirements.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter, usePathname } from 'next/navigation';
import SettingsHubPage from '@/app/settings/page';
import { getStoredUser, getStoredToken, clearAuth } from '@/lib/api';
import { useParish } from '@/context/ParishContext';
import { defaultParishContext } from '../test-utils';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/settings'),
}));

jest.mock('@/lib/api', () => ({
  getStoredUser: jest.fn(),
  getStoredToken: jest.fn(),
  clearAuth: jest.fn(),
}));

jest.mock('@/context/ParishContext', () => ({
  useParish: jest.fn(),
}));

const mockReplace = jest.fn();

describe('Administration hub page', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, push: jest.fn() });
    (usePathname as jest.Mock).mockReturnValue('/settings');
    (getStoredToken as jest.Mock).mockReturnValue('token');
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'admin',
      displayName: 'Admin',
      role: 'ADMIN',
    });
    (useParish as jest.Mock).mockReturnValue(defaultParishContext);
  });

  it('shows link to marriage requirements for admin', async () => {
    render(<SettingsHubPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /administration/i })).toBeInTheDocument();
    });
    const marriageReqLink = screen
      .getAllByRole('link')
      .find((l) => l.getAttribute('href') === '/settings/marriage-requirements');
    expect(marriageReqLink).toBeTruthy();
  });

  it('shows directory management link for admin', async () => {
    render(<SettingsHubPage />);
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /directory management/i }).length).toBeGreaterThan(0);
    });
    const directoryLink = screen
      .getAllByRole('link')
      .find((l) => l.getAttribute('href') === '/parishes');
    expect(directoryLink).toBeTruthy();
  });

  it('redirects priest away from administration hub', () => {
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'priest',
      role: 'PRIEST',
    });
    render(<SettingsHubPage />);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
