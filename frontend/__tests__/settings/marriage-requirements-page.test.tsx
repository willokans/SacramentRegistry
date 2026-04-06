/**
 * Marriage requirements settings: admin-only, loads per-parish flag, saves via API.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, usePathname } from 'next/navigation';
import MarriageRequirementsSettingsPage from '@/app/settings/marriage-requirements/page';
import {
  getStoredUser,
  getStoredToken,
  fetchDiocesesWithParishes,
  fetchParishMarriageRequirements,
  patchParishMarriageRequirements,
} from '@/lib/api';
import { useParish } from '@/context/ParishContext';
import { defaultParishContext } from '../test-utils';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/settings/marriage-requirements'),
}));

jest.mock('@/lib/api', () => ({
  getStoredUser: jest.fn(),
  getStoredToken: jest.fn(),
  clearAuth: jest.fn(),
  fetchDiocesesWithParishes: jest.fn(),
  fetchParishMarriageRequirements: jest.fn(),
  patchParishMarriageRequirements: jest.fn(),
}));

jest.mock('@/context/ParishContext', () => ({
  useParish: jest.fn(),
}));

const mockReplace = jest.fn();

describe('Marriage requirements settings page', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, push: jest.fn() });
    (usePathname as jest.Mock).mockReturnValue('/settings/marriage-requirements');
    (getStoredToken as jest.Mock).mockReturnValue('token');
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'admin',
      displayName: 'Admin',
      role: 'ADMIN',
    });
    (useParish as jest.Mock).mockReturnValue({
      ...defaultParishContext,
      parishId: null,
      parishes: [],
    });
    (fetchDiocesesWithParishes as jest.Mock).mockResolvedValue([
      {
        id: 1,
        dioceseName: 'Enugu Diocese',
        parishes: [
          { id: 10, parishName: 'St Mary', dioceseId: 1, requireMarriageConfirmation: true },
        ],
      },
    ]);
    (fetchParishMarriageRequirements as jest.Mock).mockResolvedValue({
      parishId: 10,
      requireMarriageConfirmation: true,
    });
    (patchParishMarriageRequirements as jest.Mock).mockResolvedValue({
      parishId: 10,
      requireMarriageConfirmation: false,
    });
  });

  it('redirects non-admin users to home', () => {
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'priest',
      displayName: 'Priest',
      role: 'PRIEST',
    });
    render(<MarriageRequirementsSettingsPage />);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('loads parishes and fetches requirements when a parish is selected', async () => {
    const user = userEvent.setup();
    render(<MarriageRequirementsSettingsPage />);

    await waitFor(() => {
      expect(fetchDiocesesWithParishes).toHaveBeenCalled();
    });

    await user.type(screen.getByLabelText(/parish/i), 'St Mary');
    await user.click(screen.getByRole('button', { name: /st mary/i }));

    await waitFor(() => {
      expect(fetchParishMarriageRequirements).toHaveBeenCalledWith(10);
    });

    expect(await screen.findByRole('checkbox')).toBeChecked();
  });

  it('saves updated requirement via patch API', async () => {
    const user = userEvent.setup();
    render(<MarriageRequirementsSettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/parish/i), 'St Mary');
    await user.click(screen.getByRole('button', { name: /st mary/i }));
    await waitFor(() => {
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(patchParishMarriageRequirements).toHaveBeenCalledWith(10, false);
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i);
  });
});
