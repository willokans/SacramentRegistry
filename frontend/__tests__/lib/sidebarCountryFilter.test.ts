import {
  UNSPECIFIED_COUNTRY_KEY,
  countryFilterLabelForKey,
  dioceseSidebarCountryKey,
  iso2FromCountryName,
} from '@/lib/sidebarCountryFilter';

describe('dioceseSidebarCountryKey', () => {
  it('uses ISO code when countryCode is set', () => {
    expect(
      dioceseSidebarCountryKey({ countryCode: 'ng', countryName: 'Nigeria' })
    ).toBe('NG');
  });

  it('maps countryName to ISO when countryCode is missing (Nigeria / Abuja case)', () => {
    expect(dioceseSidebarCountryKey({ countryCode: null, countryName: 'Nigeria' })).toBe('NG');
    expect(dioceseSidebarCountryKey({ countryCode: '', countryName: '  Nigeria  ' })).toBe('NG');
    expect(dioceseSidebarCountryKey({ countryName: 'Federal Republic of Nigeria' })).toBe('NG');
  });

  it('uses NAME: prefix for unknown country names without code', () => {
    expect(dioceseSidebarCountryKey({ countryName: 'Atlantis' })).toBe('NAME:ATLANTIS');
  });

  it('returns unspecified when no code or name', () => {
    expect(dioceseSidebarCountryKey({})).toBe(UNSPECIFIED_COUNTRY_KEY);
  });

  it('returns unspecified for null or non-object', () => {
    expect(dioceseSidebarCountryKey(null as unknown as { countryCode?: string })).toBe(
      UNSPECIFIED_COUNTRY_KEY
    );
  });
});

describe('countryFilterLabelForKey', () => {
  it('labels NAME: keys with title case when no sample name', () => {
    expect(countryFilterLabelForKey('NAME:BURKINA FASO', undefined)).toBe('Burkina Faso');
  });

  it('uses ISO display map when countryName is missing on sample (sidebar label)', () => {
    expect(countryFilterLabelForKey('NG', { countryCode: 'NG', countryName: undefined })).toBe('Nigeria');
  });
});

describe('iso2FromCountryName', () => {
  it('resolves Nigeria', () => {
    expect(iso2FromCountryName('nigeria')).toBe('NG');
  });
});
