/** Stable key for dioceses with no country code or name (sidebar country filter). */
export const UNSPECIFIED_COUNTRY_KEY = '__unspecified__';

/**
 * Normalized English country names (uppercase, single spaces) → ISO 3166-1 alpha-2.
 * Used when a diocese has {@code countryName} but no {@code countryCode}, so it still
 * groups with dioceses that do have the code (e.g. Abuja with name-only "Nigeria" vs Lagos with NG).
 */
/** ISO 3166-1 alpha-2 → English display name when API omits {@code countryName}. */
const ISO2_TO_DISPLAY_NAME: Record<string, string> = {
  NG: 'Nigeria',
  KE: 'Kenya',
  GH: 'Ghana',
  UG: 'Uganda',
  ZA: 'South Africa',
  CA: 'Canada',
  AU: 'Australia',
  IE: 'Ireland',
  GB: 'United Kingdom',
  US: 'United States',
  PH: 'Philippines',
  IN: 'India',
  MX: 'Mexico',
  BR: 'Brazil',
  FR: 'France',
  DE: 'Germany',
  IT: 'Italy',
  ES: 'Spain',
  PL: 'Poland',
};

const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  NIGERIA: 'NG',
  'FEDERAL REPUBLIC OF NIGERIA': 'NG',
  'REPUBLIC OF NIGERIA': 'NG',
  KENYA: 'KE',
  GHANA: 'GH',
  UGANDA: 'UG',
  'SOUTH AFRICA': 'ZA',
  CANADA: 'CA',
  AUSTRALIA: 'AU',
  IRELAND: 'IE',
  'UNITED KINGDOM': 'GB',
  UK: 'GB',
  ENGLAND: 'GB',
  SCOTLAND: 'GB',
  WALES: 'GB',
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  USA: 'US',
  PHILIPPINES: 'PH',
  INDIA: 'IN',
  MEXICO: 'MX',
  BRAZIL: 'BR',
  FRANCE: 'FR',
  GERMANY: 'DE',
  ITALY: 'IT',
  SPAIN: 'ES',
  POLAND: 'PL',
};

function normalizeCountryNameKey(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, ' ');
}

function titleCaseWords(upperWords: string): string {
  return upperWords
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Public for tests: resolve ISO2 from a free-text country name when code is missing. */
export function iso2FromCountryName(countryName: string | null | undefined): string | null {
  const raw = countryName?.trim();
  if (!raw) return null;
  return COUNTRY_NAME_TO_ISO2[normalizeCountryNameKey(raw)] ?? null;
}

export function dioceseSidebarCountryKey(d: {
  countryCode?: string | null;
  countryName?: string | null;
}): string {
  if (d == null || typeof d !== 'object') {
    return UNSPECIFIED_COUNTRY_KEY;
  }
  const c = d.countryCode?.trim();
  if (c) return c.toUpperCase();
  const fromName = iso2FromCountryName(d.countryName);
  if (fromName) return fromName;
  const rawName = d.countryName?.trim();
  if (rawName) {
    return `NAME:${normalizeCountryNameKey(rawName)}`;
  }
  return UNSPECIFIED_COUNTRY_KEY;
}

export function countryFilterLabelForKey(
  key: string,
  sampleDiocese: { countryName?: string | null; countryCode?: string | null } | undefined
): string {
  if (key === UNSPECIFIED_COUNTRY_KEY) return 'Unspecified';
  if (sampleDiocese?.countryName?.trim()) return sampleDiocese.countryName.trim();
  if (key.startsWith('NAME:')) return titleCaseWords(key.slice('NAME:'.length));
  if (/^[A-Z]{2}$/.test(key) && ISO2_TO_DISPLAY_NAME[key]) {
    return ISO2_TO_DISPLAY_NAME[key];
  }
  return key.length > 0 ? key : 'Unspecified';
}
