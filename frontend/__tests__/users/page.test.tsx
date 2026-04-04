/**
 * TDD: User Access (admin) page tests.
 * - When authenticated as admin, fetches users and dioceses/parishes
 * - Shows user list and parish access form when user selected
 * - Allows assigning/revoking parishes and setting default parish
 * - Shows "Select a user" when none selected
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, usePathname } from 'next/navigation';
import UsersPage from '@/app/users/page';
import {
  listUsersWithParishAccess,
  fetchDioceses,
  fetchParishes,
  replaceUserParishAccess,
  getLatestUserInvitation,
  resendUserInvitation,
} from '@/lib/api';
import { getStoredToken, getStoredUser } from '@/lib/api';
import { useParish } from '@/context/ParishContext';
import { defaultParishContext } from '../test-utils';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  getStoredToken: jest.fn(),
  getStoredUser: jest.fn(),
  listUsersWithParishAccess: jest.fn(),
  fetchDioceses: jest.fn(),
  fetchParishes: jest.fn(),
  replaceUserParishAccess: jest.fn(),
  getLatestUserInvitation: jest.fn(),
  resendUserInvitation: jest.fn(),
}));

jest.mock('@/context/ParishContext', () => ({
  useParish: jest.fn(),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ push: mockPush, replace: mockReplace });
(usePathname as jest.Mock).mockReturnValue('/users');

const mockUsers = [
  {
    userId: 1,
    username: 'admin',
    displayName: 'Admin',
    role: 'ADMIN',
    defaultParishId: 10,
    parishAccessIds: [10],
  },
  {
    userId: 2,
    username: 'priest@church.com',
    displayName: 'Fr. John',
    role: 'PRIEST',
    defaultParishId: 10,
    parishAccessIds: [10, 11],
  },
];

const mockDioceses = [{ id: 1, name: 'Lagos' }];
const mockParishes = [
  { id: 10, parishName: 'St Mary', dioceseId: 1 },
  { id: 11, parishName: 'St John', dioceseId: 1 },
];

describe('Users page (User Access)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    (getStoredToken as jest.Mock).mockReturnValue('token');
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'admin',
      displayName: 'Admin',
      role: 'ADMIN',
    });
    (useParish as jest.Mock).mockReturnValue({
      ...defaultParishContext,
      parishes: mockParishes,
    });
    (listUsersWithParishAccess as jest.Mock).mockResolvedValue(mockUsers);
    (fetchDioceses as jest.Mock).mockResolvedValue(mockDioceses);
    (fetchParishes as jest.Mock).mockResolvedValue(mockParishes);
    (replaceUserParishAccess as jest.Mock).mockClear();
    (getLatestUserInvitation as jest.Mock).mockResolvedValue(null);
    (resendUserInvitation as jest.Mock).mockClear();
  });

  it('fetches users and dioceses on load', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(listUsersWithParishAccess).toHaveBeenCalled();
      expect(fetchDioceses).toHaveBeenCalled();
    });
    expect(fetchParishes).toHaveBeenCalledWith(1);
  });

  it('shows User Parish Access heading and description', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(listUsersWithParishAccess).toHaveBeenCalled();
    });
    expect(screen.getByRole('heading', { name: /user parish access/i })).toBeInTheDocument();
    expect(screen.getByText(/assign or revoke parish access/i)).toBeInTheDocument();
  });

  it('shows user list with display names and parish counts', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText('Fr. John')).toBeInTheDocument();
    });
    const usersSection = screen.getByRole('heading', { name: 'Users' }).closest('section');
    expect(within(usersSection!).getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText(/1 parish/)).toBeInTheDocument();
    expect(screen.getByText(/2 parishes/)).toBeInTheDocument();
  });

  it('shows "Select a user to manage parish access" when no user selected', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText(/select a user to manage parish access/i)).toBeInTheDocument();
    });
  });

  it('shows parish access form when user selected', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText('Fr. John')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /fr\. john/i }));
    await waitFor(() => {
      expect(screen.getByText('Assigned parishes')).toBeInTheDocument();
    });
    expect(screen.getAllByText(/priest@church\.com/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Default parish')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save parish access/i })).toBeInTheDocument();
  });

  it('allows resending latest invitation from users page', async () => {
    (getLatestUserInvitation as jest.Mock).mockResolvedValue({
      invitationId: 44,
      userId: 2,
      invitedEmail: 'priest@church.com',
      expiresAt: new Date().toISOString(),
      invitationStatus: 'PENDING',
      emailDeliveryStatus: 'FAILED',
      deliveryMessage: 'Invitation created, but email delivery failed. Please use resend to try again.',
      lastEmailError: 'Authentication failed',
    });
    (resendUserInvitation as jest.Mock).mockResolvedValue({
      invitationId: 45,
      userId: 2,
      invitedEmail: 'priest@church.com',
      expiresAt: new Date().toISOString(),
      invitationStatus: 'PENDING',
      emailDeliveryStatus: 'SENT',
      deliveryMessage: 'Invitation email sent.',
      lastEmailError: null,
    });

    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText('Fr. John')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /fr\. john/i }));
    await waitFor(() => {
      expect(getLatestUserInvitation).toHaveBeenCalledWith(2);
    });
    await userEvent.click(screen.getByRole('button', { name: /resend invitation email/i }));
    await waitFor(() => {
      expect(resendUserInvitation).toHaveBeenCalledWith(44);
    });
    expect(screen.getByText(/delivery: SENT/i)).toBeInTheDocument();
  });

  it('shows parish checkboxes grouped by diocese', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText('Fr. John')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /fr\. john/i }));
    expect(screen.getByText('Lagos')).toBeInTheDocument();
    expect(screen.getByLabelText('St Mary')).toBeInTheDocument();
    expect(screen.getByLabelText('St John')).toBeInTheDocument();
  });

  it('calls replaceUserParishAccess when saving', async () => {
    (replaceUserParishAccess as jest.Mock).mockResolvedValue({
      ...mockUsers[1],
      parishAccessIds: [10],
      defaultParishId: 10,
    });
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText('Fr. John')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /fr\. john/i }));
    await userEvent.click(screen.getByLabelText('St John')); // uncheck
    await userEvent.click(screen.getByRole('button', { name: /save parish access/i }));
    await waitFor(() => {
      expect(replaceUserParishAccess).toHaveBeenCalledWith(2, {
        parishIds: [10],
        defaultParishId: 10,
      });
    });
  });

  it('optimistic UI: rolls back user parish access when save fails', async () => {
    (replaceUserParishAccess as jest.Mock).mockRejectedValue(new Error('Server error'));
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText('Fr. John')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /fr\. john/i }));
    expect(screen.getByText(/2 parishes/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('St John')); // uncheck
    await userEvent.click(screen.getByRole('button', { name: /save parish access/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/server error|failed to save/i);
    });
    expect(screen.getByText(/2 parishes/)).toBeInTheDocument();
  });

  it('shows error when fetch fails', async () => {
    (listUsersWithParishAccess as jest.Mock).mockRejectedValue(new Error('Admin access required'));
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/admin access required|failed to load/i);
    });
  });

  it('shows "No users found" when list is empty', async () => {
    (listUsersWithParishAccess as jest.Mock).mockResolvedValue([]);
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText('No users found.')).toBeInTheDocument();
    });
  });

  it('allows SUPER_ADMIN to access and fetch users', async () => {
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'superadmin',
      displayName: 'Super Admin',
      role: 'SUPER_ADMIN',
    });
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /user parish access/i })).toBeInTheDocument();
    });
    expect(listUsersWithParishAccess).toHaveBeenCalled();
    expect(fetchDioceses).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects non-admin to home', async () => {
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'priest',
      displayName: 'Priest',
      role: 'PRIEST',
    });
    render(<UsersPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
    expect(screen.getByText(/redirecting/i)).toBeInTheDocument();
  });
});
