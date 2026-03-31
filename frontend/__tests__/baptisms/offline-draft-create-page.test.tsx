import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import BaptismCreatePage from '@/app/baptisms/new/page';
import { getStoredToken, getStoredUser, createBaptism } from '@/lib/api';
import { useParish } from '@/context/ParishContext';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  getStoredToken: jest.fn(),
  getStoredUser: jest.fn(),
  createBaptism: jest.fn(),
}));

jest.mock('@/context/ParishContext', () => ({
  useParish: jest.fn(),
}));

const mockPush = jest.fn();

describe('Baptism create page offline drafts', () => {
  const originalIndexedDB = (globalThis as unknown as { indexedDB?: unknown }).indexedDB;

  beforeAll(() => {
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (usePathname as jest.Mock).mockReturnValue('/baptisms/new');
  });

  beforeEach(() => {
    // Force localStorage fallback to keep draft persistence deterministic.
    (globalThis as unknown as { indexedDB?: unknown }).indexedDB = undefined;
    window.localStorage.clear();

    mockPush.mockClear();
    (getStoredToken as jest.Mock).mockReturnValue('token');
    (getStoredUser as jest.Mock).mockReturnValue({ username: 'admin', displayName: 'Admin', role: 'ADMIN' });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('parishId=10'));
    (createBaptism as jest.Mock).mockResolvedValue({ id: 99, baptismName: 'Jane', surname: 'Doe' });
    (useParish as jest.Mock).mockReturnValue({
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
  });

  afterAll(() => {
    (globalThis as unknown as { indexedDB?: unknown }).indexedDB = originalIndexedDB;
  });

  function fillDraftRelevantFields(user: ReturnType<typeof userEvent.setup>) {
    return (async () => {
      await user.type(screen.getByLabelText(/^baptism name/i), 'Jane Baptism');
      await user.type(document.getElementById('surname')!, 'Doe');
      await user.type(screen.getByLabelText(/place of birth/i), 'Lagos');
      await user.type(screen.getByLabelText(/place of baptism/i), 'St Mary Church');
      await user.type(document.getElementById('sponsor-first-0')!, 'Peter');
      await user.type(document.getElementById('sponsor-last-0')!, 'Doe');

      await user.type(screen.getByLabelText(/parents address:/i), '10 Main St');
      await user.type(screen.getByLabelText(/^country/i), 'Nigeria');
      await user.type(screen.getByLabelText(/state\/region/i), 'Lagos');
    })();
  }

  it('shows Save Draft banner, restores values on Resume, and removes draft on Discard', async () => {
    const user = userEvent.setup();
    render(<BaptismCreatePage />);

    await fillDraftRelevantFields(user);
    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resume draft/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
    });

    // Mutate a few fields and ensure Resume draft restores them from the stored payload.
    await user.clear(screen.getByLabelText(/^baptism name/i));
    await user.type(screen.getByLabelText(/^baptism name/i), 'Changed Baptism');
    await user.clear(document.getElementById('surname')!);
    await user.type(document.getElementById('surname')!, 'Changed Surname');

    await user.click(screen.getByRole('button', { name: /resume draft/i }));

    expect(screen.getByLabelText(/^baptism name/i)).toHaveValue('Jane Baptism');
    expect(document.getElementById('surname')).toHaveValue('Doe');
    expect(document.getElementById('sponsor-first-0')).toHaveValue('Peter');
    expect(document.getElementById('sponsor-last-0')).toHaveValue('Doe');
    expect(screen.getByLabelText(/parents address:/i)).toHaveValue('10 Main St');
    expect(screen.getByLabelText(/^country/i)).toHaveValue('Nigeria');
    expect(screen.getByLabelText(/state\/region/i)).toHaveValue('Lagos');

    const draftKey = 'church_registry_offline_draft:baptism_create:10:admin';
    expect(window.localStorage.getItem(draftKey)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /discard/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /resume draft/i })).not.toBeInTheDocument();
    });

    expect(window.localStorage.getItem(draftKey)).toBeNull();
  });

  it('persists draft across re-render and restores values on Resume', async () => {
    const user = userEvent.setup();
    const draftKey = 'church_registry_offline_draft:baptism_create:10:admin';

    const firstRender = render(<BaptismCreatePage />);

    await fillDraftRelevantFields(user);
    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resume draft/i })).toBeInTheDocument();
    });

    expect(window.localStorage.getItem(draftKey)).not.toBeNull();

    firstRender.unmount();
    render(<BaptismCreatePage />);

    // Form should start blank (or defaulted by parish) until we click Resume draft.
    expect(screen.getByLabelText(/^baptism name/i)).toHaveValue('');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resume draft/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /resume draft/i }));

    expect(screen.getByLabelText(/^baptism name/i)).toHaveValue('Jane Baptism');
    expect(document.getElementById('surname')).toHaveValue('Doe');
  });

  it('migrates legacy state-only draft payloads on Resume', async () => {
    const user = userEvent.setup();
    const draftKey = 'church_registry_offline_draft:baptism_create:10:admin';
    const legacyRecord = {
      draftId: 'baptism_create:10:admin',
      id: 'baptism_create:10:admin',
      formType: 'baptism_create',
      updatedAt: Date.now(),
      payload: {
        form: {
          baptismName: 'Legacy Jane',
          otherNames: '',
          surname: 'Doe',
          gender: 'FEMALE',
          dateOfBirth: '',
          fathersName: 'John',
          mothersName: 'Mary',
          officiatingPriest: '',
          placeOfBirth: 'Lagos',
          placeOfBaptism: 'St Mary Church',
          dateOfBaptism: '',
        },
        sponsors: [{ firstName: 'Peter', lastName: 'Doe' }],
        parentAddressLine: '10 Main St',
        parentAddressState: 'Lagos',
      },
    };
    window.localStorage.setItem(draftKey, JSON.stringify(legacyRecord));

    render(<BaptismCreatePage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resume draft/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /resume draft/i }));

    expect(screen.getByLabelText(/parents address:/i)).toHaveValue('10 Main St');
    expect(screen.getByLabelText(/^country/i)).toHaveValue('Nigeria');
    expect(screen.getByLabelText(/state\/region/i)).toHaveValue('Lagos');
  });
});

