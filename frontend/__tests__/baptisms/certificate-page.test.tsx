import { render, screen, waitFor } from '@testing-library/react';
import { useParams, useSearchParams } from 'next/navigation';
import BaptismCertificatePage from '@/app/baptisms/[id]/certificate/page';
import { fetchBaptismCertificateData } from '@/lib/api';

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage({ alt, src }: { alt: string; src: string }) {
    return <img alt={alt} src={src} />;
  },
}));

jest.mock('@/lib/api', () => ({
  fetchBaptismCertificateData: jest.fn(),
}));

describe('Baptism certificate page', () => {
  beforeEach(() => {
    (useParams as jest.Mock).mockReturnValue({ id: '123' });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
    (fetchBaptismCertificateData as jest.Mock).mockResolvedValue({
      parishName: 'Holy Family Catholic Church, Life Camp, Abuja',
      dioceseName: 'Catholic Diocese of Abuja',
      baptism: {
        id: 123,
        baptismName: 'John',
        otherNames: '',
        surname: 'Doe',
        gender: 'MALE',
        dateOfBirth: '2020-01-15',
        placeOfBirth: 'Abuja',
        placeOfBaptism: 'Holy Family Catholic Church',
        liberNo: 'BAP-001',
        fathersName: 'James',
        mothersName: 'Mary',
        parentAddress: 'No 12 Grace Street, Abuja',
        sponsorNames: 'Peter, Anne',
        officiatingPriest: 'Fr. Williams',
      },
    });
  });

  it('shows Parents Address label and value', async () => {
    render(<BaptismCertificatePage />);

    await waitFor(() => {
      expect(screen.getByText(/Baptism Certificate/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Parents Address:/i)).toBeInTheDocument();
    expect(screen.getByText(/No 12 Grace Street, Abuja/i)).toBeInTheDocument();
    expect(screen.queryByText(/Parents' address:/i)).not.toBeInTheDocument();
  });
});
