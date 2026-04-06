import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParishesPage from '@/app/parishes/page';
import {
  fetchDioceses,
  fetchDiocesesWithParishes,
  fetchParishes,
  createDiocese,
  createParish,
} from '@/lib/api';
import { useParish } from '@/context/ParishContext';
import { defaultParishContext } from '../test-utils';

jest.mock('@/components/AuthenticatedLayout', () => ({
  __esModule: true,
  default: function MockAuthenticatedLayout({ children }: { children: React.ReactNode }) {
    return <main>{children}</main>;
  },
}));

jest.mock('@/lib/api', () => ({
  fetchDioceses: jest.fn(),
  fetchDiocesesWithParishes: jest.fn(),
  fetchParishes: jest.fn(),
  createDiocese: jest.fn(),
  createParish: jest.fn(),
}));

jest.mock('@/context/ParishContext', () => ({
  useParish: jest.fn(),
}));

describe('Parishes page country-first flow', () => {
  beforeEach(() => {
    (useParish as jest.Mock).mockReturnValue({
      ...defaultParishContext,
      refetch: jest.fn(),
    });
    (fetchDioceses as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Abuja', countryCode: 'NG', countryName: 'Nigeria' },
      { id: 2, name: 'Onitsha', countryCode: 'NG', countryName: 'Nigeria' },
      { id: 3, name: 'Accra', countryCode: 'GH', countryName: 'Ghana' },
    ]);
    (fetchDiocesesWithParishes as jest.Mock).mockResolvedValue([
      { id: 1, dioceseName: 'Abuja', parishes: [{ id: 10, parishName: 'St Mary', dioceseId: 1 }] },
      { id: 2, dioceseName: 'Onitsha', parishes: [] },
      { id: 3, dioceseName: 'Accra', parishes: [{ id: 20, parishName: 'Holy Trinity', dioceseId: 3 }] },
    ]);
    (fetchParishes as jest.Mock).mockResolvedValue([{ id: 10, parishName: 'St Mary', dioceseId: 1 }]);
    (createDiocese as jest.Mock).mockResolvedValue({ id: 4, name: 'Lagos', countryCode: 'NG', countryName: 'Nigeria' });
    (createParish as jest.Mock).mockResolvedValue({ id: 99, parishName: 'St Peter', dioceseId: 1 });
  });

  it('renders drill-down selectors with progressive enablement', async () => {
    render(<ParishesPage />);

    await waitFor(() => {
      expect(fetchDioceses).toHaveBeenCalled();
      expect(fetchDiocesesWithParishes).toHaveBeenCalled();
    });

    const country = await screen.findByLabelText(/country/i);
    const diocese = screen.getByLabelText(/^diocese$/i);
    const parish = screen.getByLabelText(/parish/i);

    expect(country).toBeInTheDocument();
    expect(diocese).toBeDisabled();
    expect(parish).toBeDisabled();
  });

  it('shows dioceses for selected country, then parishes for selected diocese', async () => {
    const user = userEvent.setup();
    render(<ParishesPage />);

    await user.selectOptions(await screen.findByLabelText(/country/i), 'NG');
    expect(await screen.findByRole('heading', { name: /dioceses in nigeria/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abuja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Onitsha' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accra' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^diocese$/i), '1');
    expect(await screen.findByRole('heading', { name: /parishes in abuja/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^parish$/i)).toHaveTextContent('St Mary');
  });

  it('includes legacy dioceses with parishes in diocese selector', async () => {
    const user = userEvent.setup();
    (fetchDioceses as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Abuja' },
      { id: 2, name: 'Abuja', countryCode: 'NG', countryName: 'Nigeria' },
      { id: 3, name: 'Lagos', countryCode: 'NG', countryName: 'Nigeria' },
      { id: 4, name: 'Accra', countryCode: 'GH', countryName: 'Ghana' },
    ]);
    (fetchDiocesesWithParishes as jest.Mock).mockResolvedValue([
      { id: 1, dioceseName: 'Abuja', parishes: [{ id: 11, parishName: 'St Edwin', dioceseId: 1 }] },
      { id: 2, dioceseName: 'Abuja', parishes: [] },
      { id: 3, dioceseName: 'Lagos', parishes: [{ id: 12, parishName: 'Regina Mundi', dioceseId: 3 }] },
      { id: 4, dioceseName: 'Accra', parishes: [{ id: 13, parishName: 'Holy Trinity', dioceseId: 4 }] },
    ]);

    render(<ParishesPage />);

    await user.selectOptions(await screen.findByLabelText(/country/i), 'NG');
    const dioceseSelect = screen.getByLabelText(/^diocese$/i);
    expect(dioceseSelect).toHaveTextContent('Abuja');
    expect(dioceseSelect).toHaveTextContent('Lagos');
    expect(dioceseSelect).not.toHaveTextContent('Accra');
  });

  it('prefers same-name diocese option that has parishes', async () => {
    const user = userEvent.setup();
    (fetchDioceses as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Abuja', countryCode: 'NG', countryName: 'Nigeria' },
      { id: 2, name: 'Abuja' },
    ]);
    (fetchDiocesesWithParishes as jest.Mock).mockResolvedValue([
      { id: 1, dioceseName: 'Abuja', parishes: [] },
      { id: 2, dioceseName: 'Abuja', parishes: [{ id: 12, parishName: 'St. Teresa', dioceseId: 2 }] },
    ]);

    render(<ParishesPage />);
    await user.selectOptions(await screen.findByLabelText(/country/i), 'NG');
    await user.selectOptions(screen.getByLabelText(/^diocese$/i), '2');

    expect(await screen.findByRole('heading', { name: /parishes in abuja/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^parish$/i)).toHaveTextContent('St. Teresa');
  });

  it('does not leak legacy Nigerian dioceses into Ireland selection', async () => {
    const user = userEvent.setup();
    (fetchDioceses as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Lagos' },
      { id: 2, name: 'Lagos', countryCode: 'NG', countryName: 'Nigeria' },
      { id: 3, name: 'Cork and Ross', countryCode: 'IE', countryName: 'Ireland' },
    ]);
    (fetchDiocesesWithParishes as jest.Mock).mockResolvedValue([
      { id: 1, dioceseName: 'Lagos', parishes: [{ id: 11, parishName: 'Regina Mundi', dioceseId: 1 }] },
      { id: 2, dioceseName: 'Lagos', parishes: [] },
      { id: 3, dioceseName: 'Cork and Ross', parishes: [{ id: 12, parishName: "St Mary's Cathedral", dioceseId: 3 }] },
    ]);

    render(<ParishesPage />);
    await user.selectOptions(await screen.findByLabelText(/country/i), 'IE');
    const dioceseSelect = screen.getByLabelText(/^diocese$/i);
    expect(dioceseSelect).toHaveTextContent('Cork and Ross');
    expect(dioceseSelect).not.toHaveTextContent('Lagos');
  });

  it('creates diocese and adds parish in drill-down flow', async () => {
    const user = userEvent.setup();

    (fetchDioceses as jest.Mock)
      .mockResolvedValueOnce([
        { id: 1, name: 'Abuja', countryCode: 'NG', countryName: 'Nigeria' },
      ])
      .mockResolvedValueOnce([
        { id: 1, name: 'Abuja', countryCode: 'NG', countryName: 'Nigeria' },
        { id: 4, name: 'Lagos', countryCode: 'NG', countryName: 'Nigeria' },
      ]);
    (fetchDiocesesWithParishes as jest.Mock)
      .mockResolvedValueOnce([
        { id: 1, dioceseName: 'Abuja', parishes: [{ id: 10, parishName: 'St Mary', dioceseId: 1 }] },
      ])
      .mockResolvedValueOnce([
        { id: 1, dioceseName: 'Abuja', parishes: [{ id: 10, parishName: 'St Mary', dioceseId: 1 }] },
        { id: 4, dioceseName: 'Lagos', parishes: [] },
      ]);
    (createDiocese as jest.Mock).mockResolvedValue({ id: 4, name: 'Lagos' });
    (fetchParishes as jest.Mock).mockResolvedValue([{ id: 99, parishName: 'Holy Family', dioceseId: 4 }]);

    render(<ParishesPage />);

    await user.selectOptions(await screen.findByLabelText(/country/i), 'NG');
    await user.click(screen.getByRole('button', { name: /\+ create diocese/i }));
    await user.type(screen.getByLabelText(/diocese name/i), 'Lagos');
    await user.click(screen.getByRole('button', { name: /^create diocese$/i }));

    await waitFor(() => {
      expect(createDiocese).toHaveBeenCalledWith('Lagos', {
        countryCode: 'NG',
        countryName: 'Nigeria',
      });
    });

    await user.click(await screen.findByRole('button', { name: /\+ add parish/i }));
    await user.type(screen.getByLabelText(/parish name/i), 'Holy Family');
    await user.click(screen.getByRole('button', { name: /^add parish$/i }));
    await waitFor(() => {
      expect(createParish).toHaveBeenCalledWith(4, 'Holy Family');
    });
  });

  it('selects existing diocese when duplicate create is attempted', async () => {
    const user = userEvent.setup();
    (fetchDioceses as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Abuja' },
      { id: 2, name: 'Abuja', countryCode: 'NG', countryName: 'Nigeria' },
    ]);
    (fetchDiocesesWithParishes as jest.Mock).mockResolvedValue([
      { id: 1, dioceseName: 'Abuja', parishes: [{ id: 10, parishName: 'St Mary', dioceseId: 1 }] },
      { id: 2, dioceseName: 'Abuja', parishes: [] },
    ]);
    (createDiocese as jest.Mock).mockRejectedValue(new Error('A diocese with that name already exists'));

    render(<ParishesPage />);

    await user.selectOptions(await screen.findByLabelText(/country/i), 'NG');
    await user.click(screen.getByRole('button', { name: /\+ create diocese/i }));
    await user.type(screen.getByLabelText(/diocese name/i), 'Abuja');
    await user.click(screen.getByRole('button', { name: /^create diocese$/i }));

    expect(await screen.findByText(/diocese already exists\. selected it so you can add a parish\./i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /parishes in abuja/i })).toBeInTheDocument();
  });
});
