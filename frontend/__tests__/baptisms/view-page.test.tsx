/**
 * TDD: Baptism view page.
 * - When authenticated, fetches baptism by id and shows details
 * - When not found, shows not-found message
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useParams, usePathname } from 'next/navigation';
import BaptismViewPage from '@/app/baptisms/[id]/page';
import {
  getStoredToken,
  getStoredUser,
  fetchBaptism,
  fetchBaptismNoteHistory,
  updateBaptismNotes,
  fetchBaptismExternalCertificate,
  uploadBaptismExternalCertificate,
} from '@/lib/api';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  getStoredToken: jest.fn(),
  getStoredUser: jest.fn(),
  fetchBaptism: jest.fn(),
  updateBaptismNotes: jest.fn(),
  fetchBaptismNoteHistory: jest.fn(),
  emailBaptismCertificate: jest.fn(),
  fetchBaptismExternalCertificate: jest.fn(),
  uploadBaptismExternalCertificate: jest.fn(),
}));

jest.mock('@/context/ParishContext', () => ({
  useParish: () => ({
    parishId: 10,
    setParishId: jest.fn(),
    dioceseId: null,
    setDioceseId: jest.fn(),
    parishes: [{ id: 10, parishName: 'St Mary', dioceseId: 1 }],
    dioceses: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

(useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
(usePathname as jest.Mock).mockReturnValue('/baptisms');

describe('Baptism view page', () => {
  beforeEach(() => {
    (getStoredToken as jest.Mock).mockReturnValue('token');
    (getStoredUser as jest.Mock).mockReturnValue({ username: 'admin', displayName: 'Admin', role: 'ADMIN' });
    (useParams as jest.Mock).mockReturnValue({ id: '123' });
    (fetchBaptism as jest.Mock).mockResolvedValue({
      id: 123,
      baptismName: 'John',
      otherNames: '',
      surname: 'Doe',
      gender: 'MALE',
      dateOfBirth: '2020-01-15',
      fathersName: 'James',
      mothersName: 'Mary',
      parentAddress: 'No 12 Grace Street, Abuja',
      sponsorNames: 'Peter, Anne',
      officiatingPriest: 'Fr. Williams',
      parishId: 10,
    });
    (fetchBaptismNoteHistory as jest.Mock).mockResolvedValue([]);
    (fetchBaptismExternalCertificate as jest.Mock).mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
  });

  it('fetches baptism by id and shows name', async () => {
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(fetchBaptism).toHaveBeenCalledWith(123);
    });
    expect(screen.getByText(/John/i)).toBeInTheDocument();
  });

  it('shows baptism details', async () => {
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/John/i)).toBeInTheDocument();
    });
    const main = screen.getByRole('main');
    expect(within(main).getByText(/James/i)).toBeInTheDocument();
    expect(within(main).getByText(/Baptism Date/i)).toBeInTheDocument();
    expect(within(main).getByText(/^Mary$/)).toBeInTheDocument();
    expect(within(main).getByText(/Parents Address/i)).toBeInTheDocument();
    expect(within(main).getByText(/No 12 Grace Street, Abuja/i)).toBeInTheDocument();
    expect(within(main).getByText(/Peter, Anne/i)).toBeInTheDocument();
    expect(within(main).getByText(/Fr\. Williams/i)).toBeInTheDocument();
  });

  it('shows place of birth, place of baptism, date of baptism, liber no when present', async () => {
    (fetchBaptism as jest.Mock).mockResolvedValue({
      id: 125,
      baptismName: 'Jane',
      otherNames: '',
      surname: 'Smith',
      gender: 'FEMALE',
      dateOfBirth: '2020-06-01',
      placeOfBirth: 'Lagos General Hospital',
      placeOfBaptism: 'St Mary Catholic Church',
      dateOfBaptism: '2020-07-15',
      liberNo: 'BAP-2020-001',
      fathersName: 'John',
      mothersName: 'Mary',
      sponsorNames: 'Peter',
      officiatingPriest: 'Fr. Williams',
      parishId: 10,
    });
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/Jane/i)).toBeInTheDocument();
    });
    const main = screen.getByRole('main');
    expect(within(main).getByText(/Place of Birth/i)).toBeInTheDocument();
    expect(within(main).getByText(/Lagos General Hospital/i)).toBeInTheDocument();
    expect(within(main).getByText(/Place of Baptism/i)).toBeInTheDocument();
    expect(within(main).getByText(/St Mary Catholic Church/i)).toBeInTheDocument();
    expect(within(main).getByText(/Liber No\./i)).toBeInTheDocument();
    expect(within(main).getByText(/BAP-2020-001/i)).toBeInTheDocument();
  });

  it('shows other names when present', async () => {
    (fetchBaptism as jest.Mock).mockResolvedValue({
      id: 124,
      baptismName: 'John',
      otherNames: 'Paul',
      surname: 'Doe',
      gender: 'MALE',
      dateOfBirth: '2020-01-15',
      fathersName: 'James',
      mothersName: 'Mary',
      sponsorNames: 'Peter',
      officiatingPriest: 'Fr. Williams',
      parishId: 10,
    });
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/Other names/i)).toBeInTheDocument();
    });
    const main = screen.getByRole('main');
    expect(within(main).getByText(/Other names/i)).toBeInTheDocument();
    const paulElements = within(main).getAllByText(/^Paul$/);
    expect(paulElements.length).toBeGreaterThanOrEqual(1);
  });

  it('when baptism not found shows not-found message', async () => {
    (fetchBaptism as jest.Mock).mockResolvedValue(null);
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it('shows Notes section with textarea and Save Notes button', async () => {
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/John/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /notes/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/follow-up actions|observations/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save notes/i })).toBeInTheDocument();
  });

  it('shows Print Certificate link', async () => {
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/John/i)).toBeInTheDocument();
    });
    const printLink = screen.getByRole('link', { name: /print certificate/i });
    expect(printLink).toBeInTheDocument();
    expect(printLink).toHaveAttribute('href', '/baptisms/123/certificate');
  });

  it('fetches note history when baptism is loaded', async () => {
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/John/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(fetchBaptismNoteHistory).toHaveBeenCalledWith(123);
    });
  });

  it('shows Note history section with empty state when no notes', async () => {
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/John/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /note history/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/all saved notes for this record, newest first/i)).toBeInTheDocument();
    expect(screen.getByText(/no notes saved yet/i)).toBeInTheDocument();
  });

  it('shows note history entries when API returns notes', async () => {
    (fetchBaptismNoteHistory as jest.Mock).mockResolvedValue([
      { id: 1, baptismId: 123, content: 'First note', createdAt: '2026-02-20T10:00:00Z' },
      { id: 2, baptismId: 123, content: 'Second note', createdAt: '2026-02-22T14:30:00Z' },
    ]);
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/John/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('First note')).toBeInTheDocument();
      expect(screen.getByText('Second note')).toBeInTheDocument();
    });
  });

  it('saving notes calls updateBaptismNotes and then refreshes note history', async () => {
    const user = userEvent.setup();
    (updateBaptismNotes as jest.Mock).mockResolvedValue({
      id: 123,
      baptismName: 'John',
      surname: 'Doe',
      note: 'New note text',
    });
    (fetchBaptismNoteHistory as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 1, baptismId: 123, content: 'New note text', createdAt: '2026-02-22T15:00:00Z' }]);
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/John/i)).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/follow-up actions|observations/i), 'New note text');
    await user.click(screen.getByRole('button', { name: /save notes/i }));
    await waitFor(() => {
      expect(updateBaptismNotes).toHaveBeenCalledWith(123, 'New note text');
    });
    const historyHeading = screen.getByRole('heading', { name: /note history/i });
    const historySection = historyHeading.closest('section');
    await waitFor(() => {
      expect(within(historySection!).getByText('New note text')).toBeInTheDocument();
    });
    expect(fetchBaptismNoteHistory).toHaveBeenCalledWith(123);
  });

  it('optimistic UI: note appears immediately when saving, then replaced by server data', async () => {
    const user = userEvent.setup();
    let resolveUpdate: (value: unknown) => void;
    const updatePromise = new Promise((resolve) => {
      resolveUpdate = resolve;
    });
    (updateBaptismNotes as jest.Mock).mockReturnValue(updatePromise);
    (fetchBaptismNoteHistory as jest.Mock).mockResolvedValue([
      { id: 1, content: 'Optimistic note', createdAt: '2026-03-03T12:00:00Z', createdBy: 'admin' },
    ]);
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/John/i)).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(/follow-up actions|observations/i);
    await user.type(textarea, 'Optimistic note');
    await user.click(screen.getByRole('button', { name: /save notes/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Optimistic note').length).toBeGreaterThanOrEqual(1);
    });
    expect(textarea).toHaveValue('');
    resolveUpdate!({ id: 123, baptismName: 'John', surname: 'Doe', note: 'Optimistic note' });
    await waitFor(() => {
      expect(fetchBaptismNoteHistory).toHaveBeenCalledWith(123);
    });
  });

  it('optimistic UI: rolls back note and restores input when save fails', async () => {
    const user = userEvent.setup();
    (updateBaptismNotes as jest.Mock).mockRejectedValue(new Error('Network error'));
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/John/i)).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(/follow-up actions|observations/i);
    await user.type(textarea, 'Note that will fail');
    await user.click(screen.getByRole('button', { name: /save notes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
    });
    expect(textarea).toHaveValue('Note that will fail');
    expect(screen.getByText(/no notes saved yet/i)).toBeInTheDocument();
  });
});

describe('Baptism view page when baptized in another parish (external certificate)', () => {
  beforeEach(() => {
    (getStoredToken as jest.Mock).mockReturnValue('token');
    (getStoredUser as jest.Mock).mockReturnValue({ username: 'admin', displayName: 'Admin', role: 'ADMIN' });
    (useParams as jest.Mock).mockReturnValue({ id: '123' });
    (fetchBaptism as jest.Mock).mockResolvedValue({
      id: 123,
      baptismName: 'Jacob',
      otherNames: 'See Certificate',
      surname: 'Lamin',
      gender: 'MALE',
      dateOfBirth: '2026-02-28',
      fathersName: 'Trita Tochukwu',
      mothersName: 'Joy Bello',
      sponsorNames: 'See Certificate',
      officiatingPriest: 'See Certificate',
      parishId: 10,
      parishAddress: 'Holy Family Catholic Church, Gwarinpa, Abuja',
      externalCertificatePath: 'path/to/cert.pdf',
      externalCertificateIssuingParish: 'Holy Family Catholic Church, Abuja',
    });
    (fetchBaptismNoteHistory as jest.Mock).mockResolvedValue([]);
    (fetchBaptismExternalCertificate as jest.Mock).mockResolvedValue(new Blob(['cert content'], { type: 'application/pdf' }));
  });

  it('shows Baptized in Another Parish badge and does not show Print or Email certificate', async () => {
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/Jacob/i)).toBeInTheDocument();
    });
    expect(screen.getByText('• Baptized in Another Parish')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /print certificate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /email baptism certificate/i })).not.toBeInTheDocument();
  });

  it('shows External Baptism Certificate section and warning', async () => {
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /external baptism certificate/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/this child was baptized in another parish/i)).toBeInTheDocument();
    const refOnly = screen.getAllByText(/for reference only/i);
    expect(refOnly.length).toBeGreaterThanOrEqual(1);
  });

  it('fetches external certificate when user opens certificate modal', async () => {
    const user = userEvent.setup();
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(fetchBaptism).toHaveBeenCalledWith(123);
    });
    expect(fetchBaptismExternalCertificate).not.toHaveBeenCalled();
    const seeCertButtons = screen.getAllByRole('button', { name: /see certificate/i });
    await user.click(seeCertButtons[0]);
    await waitFor(() => {
      expect(fetchBaptismExternalCertificate).toHaveBeenCalledWith(123);
    });
  });

  it('See Certificate opens certificate popup modal', async () => {
    const user = userEvent.setup();
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/Jacob/i)).toBeInTheDocument();
    });
    const seeCertButtons = screen.getAllByRole('button', { name: /see certificate/i });
    expect(seeCertButtons.length).toBeGreaterThanOrEqual(1);
    await user.click(seeCertButtons[0]);
    await waitFor(() => {
      const dialog = screen.getByRole('dialog', { name: /external baptism certificate/i });
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByLabelText(/close/i)).toBeInTheDocument();
    });
  });

  it('closing certificate popup hides modal', async () => {
    const user = userEvent.setup();
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/Jacob/i)).toBeInTheDocument();
    });
    const seeCertButtons = screen.getAllByRole('button', { name: /see certificate/i });
    await user.click(seeCertButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /external baptism certificate/i })).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/close/i));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /external baptism certificate/i })).not.toBeInTheDocument();
    });
  });
});

describe('Baptism view page when external baptism proof is pending', () => {
  const pendingBaptismFromApi = {
    id: 123,
    baptismName: 'Maria',
    otherNames: 'See Certificate',
    surname: 'Okoro',
    gender: 'FEMALE',
    dateOfBirth: '2018-05-10',
    fathersName: 'Paul',
    mothersName: 'Grace',
    sponsorNames: 'See Certificate',
    officiatingPriest: 'See Certificate',
    parishId: 10,
    parishAddress: 'Christ the King Catholic Church, Lagos',
    externalCertificatePath: null as string | null,
    externalCertificateIssuingParish: 'St Mary Catholic Church, Ikeja',
  };

  beforeEach(() => {
    (getStoredToken as jest.Mock).mockReturnValue('token');
    (getStoredUser as jest.Mock).mockReturnValue({ username: 'admin', displayName: 'Admin', role: 'ADMIN' });
    (useParams as jest.Mock).mockReturnValue({ id: '123' });
    (fetchBaptism as jest.Mock).mockResolvedValue({ ...pendingBaptismFromApi });
    (fetchBaptismNoteHistory as jest.Mock).mockResolvedValue([]);
    (fetchBaptismExternalCertificate as jest.Mock).mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    (fetchBaptismExternalCertificate as jest.Mock).mockClear();
    (uploadBaptismExternalCertificate as jest.Mock).mockReset();
  });

  it('shows awaiting baptism proof messaging and upload controls', async () => {
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/Maria/i)).toBeInTheDocument();
    });
    expect(screen.getByText('• Baptized in Another Parish')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/awaiting baptism proof/i);
    expect(screen.getByRole('button', { name: /choose file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload certificate/i })).toBeDisabled();
    expect(screen.getByLabelText(/select baptism certificate file/i)).toBeInTheDocument();
  });

  it('does not offer See Certificate, download, or view actions until certificate is uploaded', async () => {
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/Maria/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /^see certificate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download external certificate \(pdf\)/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view fullscreen/i })).not.toBeInTheDocument();
    expect(fetchBaptismExternalCertificate).not.toHaveBeenCalled();
  });

  it('shows Awaiting baptism proof for other names, officiating priest, and sponsors', async () => {
    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/Maria/i)).toBeInTheDocument();
    });
    const awaiting = screen.getAllByText(/awaiting baptism proof/i);
    expect(awaiting.length).toBeGreaterThanOrEqual(3);
  });

  it('calls upload API and updates UI when certificate is uploaded', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.4'], 'cert.pdf', { type: 'application/pdf' });
    const afterUpload = {
      ...pendingBaptismFromApi,
      externalCertificatePath: 'baptism-certificates/cert.pdf',
    };
    (uploadBaptismExternalCertificate as jest.Mock).mockResolvedValue(afterUpload);

    render(<BaptismViewPage />);
    await waitFor(() => {
      expect(screen.getByText(/Maria/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/select baptism certificate file/i);
    await user.upload(input, file);

    const uploadBtn = screen.getByRole('button', { name: /upload certificate/i });
    expect(uploadBtn).not.toBeDisabled();
    await user.click(uploadBtn);

    await waitFor(() => {
      expect(uploadBaptismExternalCertificate).toHaveBeenCalledWith(123, file);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download external certificate \(pdf\)/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /view fullscreen/i })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
