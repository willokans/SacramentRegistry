/**
 * TDD: Baptism create page.
 * - When authenticated and parishId in query, shows form and creates on submit
 * - Redirects to list or view after successful create
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import BaptismCreatePage from '@/app/baptisms/new/page';
import { getStoredToken, getStoredUser, createBaptism, uploadBaptismBirthCertificate } from '@/lib/api';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  getStoredToken: jest.fn(),
  getStoredUser: jest.fn(),
  createBaptism: jest.fn(),
  uploadBaptismBirthCertificate: jest.fn(),
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

const mockPush = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ push: mockPush });
(usePathname as jest.Mock).mockReturnValue('/baptisms/new');

describe('Baptism create page', () => {
  async function fillRequiredFieldsForSubmit(
    user: ReturnType<typeof userEvent.setup>,
    {
      addressLine,
      country,
      region,
    }: { addressLine: string; country: string; region: string },
  ) {
    await user.type(screen.getByLabelText(/^baptism name/i), 'Jane');
    await user.type(document.getElementById('surname')!, 'Doe');
    await user.type(screen.getByLabelText(/^date of birth/i), '2021-05-10');
    await user.type(screen.getByLabelText(/place of birth/i), 'Lagos');
    await user.type(screen.getByLabelText(/place of baptism/i), 'St Mary Church');
    await user.type(screen.getByLabelText(/date of baptism/i), '2021-06-15');
    await user.type(screen.getByLabelText(/father|father's name/i), 'John');
    await user.type(screen.getByLabelText(/mother|mother's name/i), 'Mary');
    await user.type(document.getElementById('sponsor-first-0')!, 'Peter');
    await user.type(document.getElementById('sponsor-last-0')!, 'Doe');
    await user.type(screen.getByLabelText(/officiating priest/i), 'Fr. Smith');
    await user.type(screen.getByLabelText(/parents address:/i), addressLine);
    await user.type(screen.getByLabelText(/^country/i), country);
    await user.type(screen.getByLabelText(/state\/region/i), region);
    const genderSelect = screen.getByLabelText(/gender/i);
    await user.selectOptions(
      genderSelect,
      screen.getByRole('option', { name: /female/i }) ||
        genderSelect.querySelector('option[value="FEMALE"]'),
    );
  }

  beforeEach(() => {
    mockPush.mockClear();
    (getStoredToken as jest.Mock).mockReturnValue('token');
    (getStoredUser as jest.Mock).mockReturnValue({
      username: 'admin',
      displayName: 'Admin',
      role: 'ADMIN',
    });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('parishId=10'));
    (createBaptism as jest.Mock).mockResolvedValue({ id: 99, baptismName: 'Jane', surname: 'Doe' });
    (uploadBaptismBirthCertificate as jest.Mock).mockResolvedValue(undefined);
  });

  it('shows form with heading and required fields', () => {
    render(<BaptismCreatePage />);
    expect(screen.getByRole('heading', { name: /add baptism/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^baptism name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/place of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/place of baptism/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of baptism/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/other names/i)).toBeInTheDocument();
    expect(document.getElementById('surname')).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/father|father's name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mother|mother's name/i)).toBeInTheDocument();
    expect(screen.getByText((c) => c.includes('Sponsor') && !c.includes('Add'))).toBeInTheDocument();
    expect(document.getElementById('sponsor-first-0')).toBeInTheDocument();
    expect(document.getElementById('sponsor-last-0')).toBeInTheDocument();
    expect(screen.getByLabelText(/officiating priest/i)).toBeInTheDocument();
  });

  it('on submit creates baptism and redirects to list', async () => {
    const user = userEvent.setup();
    render(<BaptismCreatePage />);
    await user.type(screen.getByLabelText(/^baptism name/i), 'Jane');
    await user.type(document.getElementById('surname')!, 'Doe');
    await user.type(screen.getByLabelText(/^date of birth/i), '2021-05-10');
    await user.type(screen.getByLabelText(/place of birth/i), 'Lagos');
    await user.type(screen.getByLabelText(/place of baptism/i), 'St Mary Church');
    await user.type(screen.getByLabelText(/date of baptism/i), '2021-06-15');
    await user.type(screen.getByLabelText(/father|father's name/i), 'John');
    await user.type(screen.getByLabelText(/mother|mother's name/i), 'Mary');
    await user.type(document.getElementById('sponsor-first-0')!, 'Peter');
    await user.type(document.getElementById('sponsor-last-0')!, 'Doe');
    await user.type(screen.getByLabelText(/officiating priest/i), 'Fr. Smith');
    await user.type(screen.getByLabelText(/parents address:/i), '10 Main St');
    await user.type(screen.getByLabelText(/^country/i), 'Nigeria');
    await user.type(screen.getByLabelText(/state\/region/i), 'Lagos');
    const genderSelect = screen.getByLabelText(/gender/i);
    await user.selectOptions(
      genderSelect,
      screen.getByRole('option', { name: /female/i }) ||
        genderSelect.querySelector('option[value="FEMALE"]'),
    );
    await user.click(screen.getByRole('button', { name: /save baptism/i }));

    await waitFor(() => {
      expect(createBaptism).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          baptismName: 'Jane',
          otherNames: '',
          surname: 'Doe',
          fathersName: 'John',
          mothersName: 'Mary',
          sponsorNames: 'Peter Doe',
          officiatingPriest: 'Fr. Smith',
          parentAddress: '10 Main St, Lagos, Nigeria',
        }),
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/baptisms');
    });
  });

  it('when no parishId shows message', () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(''));
    render(<BaptismCreatePage />);
    const main = screen.getByRole('main');
    expect(within(main).getByText(/select a parish from the baptisms list/i)).toBeInTheDocument();
  });

  it('shows Parents Address section under mother name with address line above country and region', () => {
    render(<BaptismCreatePage />);
    expect(screen.getByText(/^parents address$/i)).toBeInTheDocument();
    const mothersName = screen.getByLabelText(/mother|mother's name/i);
    const addressLine = screen.getByLabelText(/parents address:/i);
    const countryInput = screen.getByLabelText(/^country/i);
    const regionInput = screen.getByLabelText(/state\/region/i);
    expect(addressLine).toBeInTheDocument();
    expect(countryInput).toBeInTheDocument();
    expect(regionInput).toBeInTheDocument();

    const form = addressLine.closest('form');
    const inputs = form?.querySelectorAll('input, select') ?? [];
    const mothersNameIdx = Array.from(inputs).findIndex((el) => el.id === 'mothersName');
    const addressLineIdx = Array.from(inputs).findIndex((el) => el.id === 'parentAddressLine');
    const countryIdx = Array.from(inputs).findIndex((el) => el.id === 'parentAddressCountry');
    const regionIdx = Array.from(inputs).findIndex((el) => el.id === 'parentAddressRegion');
    expect(mothersNameIdx).toBeLessThan(addressLineIdx);
    expect(addressLineIdx).toBeLessThan(countryIdx);
    expect(countryIdx).toBeLessThan(regionIdx);
  });

  it('Address line, Country and State/Region are required', () => {
    render(<BaptismCreatePage />);
    expect(screen.getByLabelText(/parents address:/i)).toBeRequired();
    expect(screen.getByLabelText(/^country/i)).toBeRequired();
    expect(screen.getByLabelText(/state\/region/i)).toBeRequired();
  });

  it('Place of birth, Place of baptism, and Date of baptism are required', () => {
    render(<BaptismCreatePage />);
    expect(screen.getByLabelText(/place of birth/i)).toBeRequired();
    expect(screen.getByLabelText(/place of baptism/i)).toBeRequired();
    expect(screen.getByLabelText(/date of baptism/i)).toBeRequired();
  });

  it('date of birth input has max set so future dates cannot be selected', () => {
    render(<BaptismCreatePage />);
    const dobInput = screen.getByLabelText(/date of birth/i);
    expect(dobInput).toHaveAttribute('max');
    expect(dobInput.getAttribute('max')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('on submit saves parent address as "Address line, State/Region" in parentAddress', async () => {
    const user = userEvent.setup();
    render(<BaptismCreatePage />);
    await user.type(screen.getByLabelText(/^baptism name/i), 'Jane');
    await user.type(document.getElementById('surname')!, 'Doe');
    await user.type(screen.getByLabelText(/^date of birth/i), '2021-05-10');
    await user.type(screen.getByLabelText(/place of birth/i), 'Lagos');
    await user.type(screen.getByLabelText(/place of baptism/i), 'St Mary Church');
    await user.type(screen.getByLabelText(/date of baptism/i), '2021-06-15');
    await user.type(screen.getByLabelText(/father|father's name/i), 'John');
    await user.type(screen.getByLabelText(/mother|mother's name/i), 'Mary');
    await user.type(document.getElementById('sponsor-first-0')!, 'Peter');
    await user.type(document.getElementById('sponsor-last-0')!, 'Doe');
    await user.type(screen.getByLabelText(/officiating priest/i), 'Fr. Jones');
    await user.type(screen.getByLabelText(/parents address:/i), '10 Main St, Ikeja');
    await user.type(screen.getByLabelText(/^country/i), 'Nigeria');
    await user.type(screen.getByLabelText(/state\/region/i), 'Lagos');
    const genderSelect = screen.getByLabelText(/gender/i);
    await user.selectOptions(
      genderSelect,
      screen.getByRole('option', { name: /female/i }) ||
        genderSelect.querySelector('option[value="FEMALE"]'),
    );
    await user.click(screen.getByRole('button', { name: /save baptism/i }));

    await waitFor(() => {
      expect(createBaptism).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          parentAddress: '10 Main St, Ikeja, Lagos, Nigeria',
        }),
      );
    });
  });

  it('disables save until sponsor has both first and last name', async () => {
    (createBaptism as jest.Mock).mockClear();
    const user = userEvent.setup();
    render(<BaptismCreatePage />);
    await user.type(screen.getByLabelText(/^baptism name/i), 'Jane');
    await user.type(document.getElementById('surname')!, 'Doe');
    await user.type(screen.getByLabelText(/^date of birth/i), '2021-05-10');
    await user.type(screen.getByLabelText(/place of birth/i), 'Lagos');
    await user.type(screen.getByLabelText(/place of baptism/i), 'St Mary Church');
    await user.type(screen.getByLabelText(/date of baptism/i), '2021-06-15');
    await user.type(screen.getByLabelText(/father|father's name/i), 'John');
    await user.type(screen.getByLabelText(/mother|mother's name/i), 'Mary');
    await user.type(document.getElementById('sponsor-first-0')!, 'Peter');
    await user.type(screen.getByLabelText(/officiating priest/i), 'Fr. Smith');
    await user.type(screen.getByLabelText(/parents address:/i), '10 Main St');
    await user.type(screen.getByLabelText(/^country/i), 'Nigeria');
    await user.type(screen.getByLabelText(/state\/region/i), 'Lagos');
    const genderSelect = screen.getByLabelText(/gender/i);
    await user.selectOptions(
      genderSelect,
      screen.getByRole('option', { name: /female/i }) ||
        genderSelect.querySelector('option[value="FEMALE"]'),
    );

    const saveButton = screen.getByRole('button', { name: /save baptism/i });
    expect(saveButton).toBeDisabled();
    await user.click(saveButton);
    expect(createBaptism).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('submits required place of birth, place of baptism, date of baptism', async () => {
    (createBaptism as jest.Mock).mockClear();
    const user = userEvent.setup();
    render(<BaptismCreatePage />);
    await user.type(screen.getByLabelText(/^baptism name/i), 'Jane');
    await user.type(document.getElementById('surname')!, 'Doe');
    await user.type(screen.getByLabelText(/^date of birth/i), '2021-05-10');
    await user.type(screen.getByLabelText(/place of birth/i), 'Lagos General Hospital');
    await user.type(screen.getByLabelText(/place of baptism/i), 'St Mary Church');
    await user.type(screen.getByLabelText(/date of baptism/i), '2021-06-15');
    await user.type(screen.getByLabelText(/father|father's name/i), 'John');
    await user.type(screen.getByLabelText(/mother|mother's name/i), 'Mary');
    await user.type(document.getElementById('sponsor-first-0')!, 'Peter');
    await user.type(document.getElementById('sponsor-last-0')!, 'Doe');
    await user.type(screen.getByLabelText(/officiating priest/i), 'Fr. Smith');
    await user.type(screen.getByLabelText(/parents address:/i), '10 Main St');
    await user.type(screen.getByLabelText(/^country/i), 'Nigeria');
    await user.type(screen.getByLabelText(/state\/region/i), 'Lagos');
    const genderSelect = screen.getByLabelText(/gender/i);
    await user.selectOptions(
      genderSelect,
      screen.getByRole('option', { name: /female/i }) ||
        genderSelect.querySelector('option[value="FEMALE"]'),
    );
    await user.click(screen.getByRole('button', { name: /save baptism/i }));

    await waitFor(() => {
      expect(createBaptism).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          placeOfBirth: 'Lagos General Hospital',
          placeOfBaptism: 'St Mary Church',
          dateOfBaptism: '2021-06-15',
        }),
      );
    });
  });

  it('allows two sponsors and submits combined sponsorNames', async () => {
    (createBaptism as jest.Mock).mockClear();
    const user = userEvent.setup();
    render(<BaptismCreatePage />);
    await user.type(screen.getByLabelText(/^baptism name/i), 'Jane');
    await user.type(document.getElementById('surname')!, 'Doe');
    await user.type(screen.getByLabelText(/^date of birth/i), '2021-05-10');
    await user.type(screen.getByLabelText(/place of birth/i), 'Lagos');
    await user.type(screen.getByLabelText(/place of baptism/i), 'St Mary Church');
    await user.type(screen.getByLabelText(/date of baptism/i), '2021-06-15');
    await user.type(screen.getByLabelText(/father|father's name/i), 'John');
    await user.type(screen.getByLabelText(/mother|mother's name/i), 'Mary');
    await user.type(document.getElementById('sponsor-first-0')!, 'John');
    await user.type(document.getElementById('sponsor-last-0')!, 'Doe');
    await user.click(screen.getByRole('button', { name: /add sponsor/i }));
    await user.type(document.getElementById('sponsor-first-1')!, 'Jane');
    await user.type(document.getElementById('sponsor-last-1')!, 'Smith');
    expect(document.getElementById('sponsor-first-2')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/officiating priest/i), 'Fr. Smith');
    await user.type(screen.getByLabelText(/parents address:/i), '10 Main St');
    await user.type(screen.getByLabelText(/^country/i), 'Nigeria');
    await user.type(screen.getByLabelText(/state\/region/i), 'Lagos');
    const genderSelect = screen.getByLabelText(/gender/i);
    await user.selectOptions(
      genderSelect,
      screen.getByRole('option', { name: /female/i }) ||
        genderSelect.querySelector('option[value="FEMALE"]'),
    );
    await user.click(screen.getByRole('button', { name: /save baptism/i }));

    await waitFor(() => {
      expect(createBaptism).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          sponsorNames: 'John Doe, Jane Smith',
        }),
      );
    });
  });

  it('uses free-text region input when country has no predefined regions', async () => {
    const user = userEvent.setup();
    render(<BaptismCreatePage />);
    await user.type(screen.getByLabelText(/^country/i), 'Afghanistan');
    const regionInput = screen.getByLabelText(/state\/region/i);
    expect(regionInput).toBeEnabled();
    expect(regionInput).not.toHaveAttribute('list');
    await user.type(regionInput, 'Kabul');
    expect(regionInput).toHaveValue('Kabul');
  });

  it('shows county suggestions for Ireland', async () => {
    const user = userEvent.setup();
    render(<BaptismCreatePage />);
    await user.type(screen.getByLabelText(/^country/i), 'Ireland');
    const regionInput = screen.getByLabelText(/state\/region/i);
    expect(regionInput).toHaveAttribute('list', 'parent-address-region-options');
    expect(document.querySelector('#parent-address-region-options option[value="Dublin"]')).toBeInTheDocument();
  });

  it('switches region mode by country and clears region when country changes', async () => {
    const user = userEvent.setup();
    render(<BaptismCreatePage />);

    const countryInput = screen.getByLabelText(/^country/i);
    const initialRegion = screen.getByLabelText(/state\/region/i);
    expect(initialRegion).toBeDisabled();
    expect(initialRegion).not.toHaveAttribute('list');

    await user.type(countryInput, 'Nigeria');
    const predefinedRegionInput = screen.getByLabelText(/state\/region/i);
    expect(predefinedRegionInput).toHaveAttribute('list', 'parent-address-region-options');
    await user.type(predefinedRegionInput, 'Lagos');
    expect(predefinedRegionInput).toHaveValue('Lagos');

    await user.clear(countryInput);
    await user.type(countryInput, 'Afghanistan');
    const fallbackRegionInput = screen.getByLabelText(/state\/region/i);
    expect(fallbackRegionInput).toBeEnabled();
    expect(fallbackRegionInput).not.toHaveAttribute('list');
    expect(fallbackRegionInput).toHaveValue('');
  });

  it('updates postal hint for UK, Ireland and USA', async () => {
    const user = userEvent.setup();
    render(<BaptismCreatePage />);
    const countryInput = screen.getByLabelText(/^country/i);

    await user.type(countryInput, 'United Kingdom');
    expect(screen.getAllByText(/include postcode/i).length).toBeGreaterThan(0);

    await user.clear(countryInput);
    await user.type(countryInput, 'Ireland');
    expect(screen.getAllByText(/include eircode/i).length).toBeGreaterThan(0);

    await user.clear(countryInput);
    await user.type(countryInput, 'United States');
    expect(screen.getAllByText(/include zip code/i).length).toBeGreaterThan(0);
  });

  it('formats parentAddress using normalized country name when country code is entered', async () => {
    const user = userEvent.setup();
    render(<BaptismCreatePage />);

    await fillRequiredFieldsForSubmit(user, {
      addressLine: '10 Main St',
      country: 'US',
      region: 'California',
    });
    await user.click(screen.getByRole('button', { name: /save baptism/i }));

    await waitFor(() => {
      expect(createBaptism).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          parentAddress: '10 Main St, California, United States',
        }),
      );
    });
  });

  it('formats parentAddress with free-text region for countries without predefined regions', async () => {
    const user = userEvent.setup();
    render(<BaptismCreatePage />);

    await fillRequiredFieldsForSubmit(user, {
      addressLine: 'Kabul Central',
      country: 'Afghanistan',
      region: 'Kabul',
    });
    await user.click(screen.getByRole('button', { name: /save baptism/i }));

    await waitFor(() => {
      expect(createBaptism).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          parentAddress: 'Kabul Central, Kabul, Afghanistan',
        }),
      );
    });
  });

  it('creates baptism first, then uploads optional birth certificate', async () => {
    (createBaptism as jest.Mock).mockClear();
    (uploadBaptismBirthCertificate as jest.Mock).mockClear();
    const user = userEvent.setup();
    render(<BaptismCreatePage />);

    await fillRequiredFieldsForSubmit(user, {
      addressLine: '10 Main St',
      country: 'Nigeria',
      region: 'Lagos',
    });
    const file = new File(['dummy-pdf'], 'birth-cert.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/birth certificate \(optional\)/i), file);
    await user.click(screen.getByRole('button', { name: /save baptism/i }));

    await waitFor(() => {
      expect(createBaptism).toHaveBeenCalled();
      expect(uploadBaptismBirthCertificate).toHaveBeenCalledWith(99, file);
      expect(mockPush).toHaveBeenCalledWith('/baptisms');
    });
  });

  it('keeps created baptism when optional birth certificate upload fails', async () => {
    (createBaptism as jest.Mock).mockClear();
    (uploadBaptismBirthCertificate as jest.Mock).mockClear();
    const user = userEvent.setup();
    (uploadBaptismBirthCertificate as jest.Mock).mockRejectedValueOnce(new Error('Upload failed'));
    render(<BaptismCreatePage />);

    await fillRequiredFieldsForSubmit(user, {
      addressLine: '10 Main St',
      country: 'Nigeria',
      region: 'Lagos',
    });
    const file = new File(['dummy-pdf'], 'birth-cert.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/birth certificate \(optional\)/i), file);
    await user.click(screen.getByRole('button', { name: /save baptism/i }));

    await waitFor(() => {
      expect(createBaptism).toHaveBeenCalled();
      expect(uploadBaptismBirthCertificate).toHaveBeenCalledWith(99, file);
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(
      screen.getByText(/baptism was created, but birth certificate upload failed/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /baptism details/i })).toHaveAttribute('href', '/baptisms/99');
  });
});
