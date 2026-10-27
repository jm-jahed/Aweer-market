/**
 * Country flag utilities for wholesale produce origins in Al Aweer Central Market.
 * Automatically resolves country text to official flag emoji and formatted display string.
 */

const COUNTRY_MAP: Record<string, string> = {
  pakistan: '🇵🇰',
  pk: '🇵🇰',
  egypt: '🇪🇬',
  eg: '🇪🇬',
  srilanka: '🇱🇰',
  ceylon: '🇱🇰',
  lk: '🇱🇰',
  turkey: '🇹🇷',
  turkiye: '🇹🇷',
  türkiye: '🇹🇷',
  tr: '🇹🇷',
  unitedarabemirates: '🇦🇪',
  uae: '🇦🇪',
  dubai: '🇦🇪',
  emirates: '🇦🇪',
  ae: '🇦🇪',
  india: '🇮🇳',
  in: '🇮🇳',
  bharat: '🇮🇳',
  iran: '🇮🇷',
  ir: '🇮🇷',
  oman: '🇴🇲',
  om: '🇴🇲',
  saudiarabia: '🇸🇦',
  saudi: '🇸🇦',
  ksa: '🇸🇦',
  sa: '🇸🇦',
  southafrica: '🇿🇦',
  za: '🇿🇦',
  spain: '🇪🇸',
  es: '🇪🇸',
  netherlands: '🇳🇱',
  holland: '🇳🇱',
  nl: '🇳🇱',
  australia: '🇦🇺',
  au: '🇦🇺',
  unitedstates: '🇺🇸',
  unitedstatesofamerica: '🇺🇸',
  usa: '🇺🇸',
  us: '🇺🇸',
  america: '🇺🇸',
  china: '🇨🇳',
  cn: '🇨🇳',
  bangladesh: '🇧🇩',
  bd: '🇧🇩',
  philippines: '🇵🇭',
  ph: '🇵🇭',
  thailand: '🇹🇭',
  th: '🇹🇭',
  vietnam: '🇻🇳',
  vn: '🇻🇳',
  brazil: '🇧🇷',
  br: '🇧🇷',
  ecuador: '🇪🇨',
  ec: '🇪🇨',
  colombia: '🇨🇴',
  co: '🇨🇴',
  kenya: '🇰🇪',
  ke: '🇰🇪',
  tanzania: '🇹🇿',
  tz: '🇹🇿',
  morocco: '🇲🇦',
  ma: '🇲🇦',
  jordan: '🇯🇴',
  jo: '🇯🇴',
  lebanon: '🇱🇧',
  lb: '🇱🇧',
  italy: '🇮🇹',
  it: '🇮🇹',
  greece: '🇬🇷',
  gr: '🇬🇷',
  france: '🇫🇷',
  fr: '🇫🇷',
  peru: '🇵🇪',
  pe: '🇵🇪',
  chile: '🇨🇱',
  cl: '🇨🇱',
  newzealand: '🇳🇿',
  nz: '🇳🇿',
  mexico: '🇲🇽',
  mx: '🇲🇽',
  canada: '🇨🇦',
  ca: '🇨🇦',
  unitedkingdom: '🇬🇧',
  uk: '🇬🇧',
  britain: '🇬🇧',
  gb: '🇬🇧',
  england: '🇬🇧',
  yemen: '🇾🇪',
  ye: '🇾🇪',
  kuwait: '🇰🇼',
  kw: '🇰🇼',
  qatar: '🇶🇦',
  qa: '🇶🇦',
  bahrain: '🇧🇭',
  bh: '🇧🇭',
  iraq: '🇮🇶',
  iq: '🇮🇶',
  syria: '🇸🇾',
  sy: '🇸🇾',
  sudan: '🇸🇩',
  sd: '🇸🇩',
  somalia: '🇸🇴',
  so: '🇸🇴',
  uzbekistan: '🇺🇿',
  uz: '🇺🇿',
  kazakhstan: '🇰🇿',
  kz: '🇰🇿',
  afghanistan: '🇦🇫',
  af: '🇦🇫',
  indonesia: '🇮🇩',
  id: '🇮🇩',
  malaysia: '🇲🇾',
  my: '🇲🇾',
  poland: '🇵🇱',
  pl: '🇵🇱',
  germany: '🇩🇪',
  de: '🇩🇪',
  belgium: '🇧🇪',
  be: '🇧🇪',
  portugal: '🇵🇹',
  pt: '🇵🇹',
  argentina: '🇦🇷',
  ar: '🇦🇷',
  uganda: '🇺🇬',
  ug: '🇺🇬',
  ethiopia: '🇪🇹',
  et: '🇪🇹',
  ghana: '🇬🇭',
  gh: '🇬🇭',
  ivorycoast: '🇨🇮',
  cotedivoire: '🇨🇮',
  ci: '🇨🇮',
  rwanda: '🇷🇼',
  rw: '🇷🇼',
  madagascar: '🇲🇬',
  mg: '🇲🇬',
  azerbaijan: '🇦🇿',
  az: '🇦🇿',
  georgia: '🇬🇪',
  ge: '🇬🇪',
  armenia: '🇦🇲',
  am: '🇦🇲',
  cyprus: '🇨🇾',
  cy: '🇨🇾',
  japan: '🇯🇵',
  jp: '🇯🇵',
  korea: '🇰🇷',
  southkorea: '🇰🇷',
  kr: '🇰🇷',
  russia: '🇷🇺',
  ru: '🇷🇺',
  ukraine: '🇺🇦',
  ua: '🇺🇦'
};

/**
 * Resolves country flag emoji from freeform country text.
 */
export function getCountryFlag(country?: string): string {
  if (!country || typeof country !== 'string') return '';
  const trimmed = country.trim();
  if (!trimmed) return '';

  // If already contains a regional indicator flag emoji, extract it
  if (/[\uD83C][\uDDE6-\uDDFF]/.test(trimmed)) {
    const match = trimmed.match(/[\uD83C][\uDDE6-\uDDFF]{2}/);
    return match ? match[0] : '';
  }

  const norm = trimmed.toLowerCase().replace(/[^a-z]/g, '');

  if (COUNTRY_MAP[norm]) {
    return COUNTRY_MAP[norm];
  }

  // Check partial substring match (e.g. "Pakistan wholesale" -> Pakistan)
  for (const [key, flag] of Object.entries(COUNTRY_MAP)) {
    if (key.length >= 3 && norm.includes(key)) {
      return flag;
    }
  }

  return '';
}

/**
 * Formats country name with its flag emoji automatically.
 * e.g. "Pakistan" -> "🇵🇰 Pakistan"
 * If already formatted or no flag match, returns country as-is.
 */
export function formatCountryWithFlag(country?: string): string {
  if (!country || typeof country !== 'string') return '';
  const trimmed = country.trim();
  if (!trimmed) return '';

  // Already prefixed with a flag emoji?
  if (/[\uD83C][\uDDE6-\uDDFF]/.test(trimmed)) {
    return trimmed;
  }

  const flag = getCountryFlag(trimmed);
  return flag ? `${flag} ${trimmed}` : trimmed;
}

/**
 * Common Al Aweer wholesale produce origins with flags for datalists.
 */
export const COMMON_PRODUCE_ORIGINS = [
  { name: 'United Arab Emirates', flag: '🇦🇪' },
  { name: 'Pakistan', flag: '🇵🇰' },
  { name: 'Egypt', flag: '🇪🇬' },
  { name: 'India', flag: '🇮🇳' },
  { name: 'Sri Lanka', flag: '🇱🇰' },
  { name: 'Turkey', flag: '🇹🇷' },
  { name: 'Iran', flag: '🇮🇷' },
  { name: 'Oman', flag: '🇴🇲' },
  { name: 'Saudi Arabia', flag: '🇸🇦' },
  { name: 'Spain', flag: '🇪🇸' },
  { name: 'South Africa', flag: '🇿🇦' },
  { name: 'Netherlands', flag: '🇳🇱' },
  { name: 'Australia', flag: '🇦🇺' },
  { name: 'United States', flag: '🇺🇸' },
  { name: 'China', flag: '🇨🇳' },
  { name: 'Bangladesh', flag: '🇧🇩' },
  { name: 'Philippines', flag: '🇵🇭' },
  { name: 'Thailand', flag: '🇹🇭' },
  { name: 'Vietnam', flag: '🇻🇳' },
  { name: 'Brazil', flag: '🇧🇷' },
  { name: 'Ecuador', flag: '🇪🇨' },
  { name: 'Colombia', flag: '🇨🇴' },
  { name: 'Kenya', flag: '🇰🇪' },
  { name: 'Tanzania', flag: '🇹🇿' },
  { name: 'Morocco', flag: '🇲🇦' },
  { name: 'Jordan', flag: '🇯🇴' },
  { name: 'Lebanon', flag: '🇱🇧' },
  { name: 'Italy', flag: '🇮🇹' },
  { name: 'Greece', flag: '🇬🇷' },
  { name: 'France', flag: '🇫🇷' }
];
