export type LocaleDirection = 'ltr' | 'rtl';
export type LocaleAvailability = 'available' | 'planned';

export type LocaleDefinition = {
  tag: string;
  nativeName: string;
  englishName: string;
  direction: LocaleDirection;
  availability: LocaleAvailability;
};

/**
 * Keep exact BCP-47 tags. Script-bearing languages must not be reduced to a
 * language-only code: ks-Arab, sd-Arab and mni-Mtei are separate packs.
 */
export const LOCALE_REGISTRY: readonly LocaleDefinition[] = [
  {tag:'en',nativeName:'English',englishName:'English',direction:'ltr',availability:'available'},
  {tag:'as',nativeName:'অসমীয়া',englishName:'Assamese',direction:'ltr',availability:'planned'},
  {tag:'bn',nativeName:'বাংলা',englishName:'Bengali',direction:'ltr',availability:'planned'},
  {tag:'brx',nativeName:'बड़ो',englishName:'Bodo',direction:'ltr',availability:'planned'},
  {tag:'doi',nativeName:'डोगरी',englishName:'Dogri',direction:'ltr',availability:'planned'},
  {tag:'gu',nativeName:'ગુજરાતી',englishName:'Gujarati',direction:'ltr',availability:'planned'},
  {tag:'hi',nativeName:'हिन्दी',englishName:'Hindi',direction:'ltr',availability:'available'},
  {tag:'kn',nativeName:'ಕನ್ನಡ',englishName:'Kannada',direction:'ltr',availability:'planned'},
  {tag:'ks-Arab',nativeName:'کٲشُر',englishName:'Kashmiri (Arabic)',direction:'rtl',availability:'planned'},
  {tag:'kok-Deva',nativeName:'कोंकणी',englishName:'Konkani (Devanagari)',direction:'ltr',availability:'planned'},
  {tag:'mai',nativeName:'मैथिली',englishName:'Maithili',direction:'ltr',availability:'planned'},
  {tag:'ml',nativeName:'മലയാളം',englishName:'Malayalam',direction:'ltr',availability:'planned'},
  {tag:'mni-Mtei',nativeName:'ꯃꯤꯇꯩꯂꯣꯟ',englishName:'Manipuri (Meetei Mayek)',direction:'ltr',availability:'planned'},
  {tag:'mr',nativeName:'मराठी',englishName:'Marathi',direction:'ltr',availability:'planned'},
  {tag:'ne',nativeName:'नेपाली',englishName:'Nepali',direction:'ltr',availability:'planned'},
  {tag:'or',nativeName:'ଓଡ଼ିଆ',englishName:'Odia',direction:'ltr',availability:'planned'},
  {tag:'pa-Guru',nativeName:'ਪੰਜਾਬੀ',englishName:'Punjabi (Gurmukhi)',direction:'ltr',availability:'planned'},
  {tag:'sa',nativeName:'संस्कृतम्',englishName:'Sanskrit',direction:'ltr',availability:'planned'},
  {tag:'sat-Olck',nativeName:'ᱥᱟᱱᱛᱟᱲᱤ',englishName:'Santali (Ol Chiki)',direction:'ltr',availability:'planned'},
  {tag:'sd-Arab',nativeName:'سنڌي',englishName:'Sindhi (Arabic)',direction:'rtl',availability:'planned'},
  {tag:'ta',nativeName:'தமிழ்',englishName:'Tamil',direction:'ltr',availability:'available'},
  {tag:'te',nativeName:'తెలుగు',englishName:'Telugu',direction:'ltr',availability:'planned'},
  {tag:'ur',nativeName:'اردو',englishName:'Urdu',direction:'rtl',availability:'available'},
] as const;

export const DEFAULT_LOCALE = 'en';
export const AVAILABLE_LOCALES = LOCALE_REGISTRY.filter(locale => locale.availability === 'available');

export function localeDefinition(tag: string): LocaleDefinition {
  return LOCALE_REGISTRY.find(locale => locale.tag === tag) || LOCALE_REGISTRY[0];
}

export function isAvailableLocale(tag: string): boolean {
  return AVAILABLE_LOCALES.some(locale => locale.tag === tag);
}

/** A browser locale is used only as a first-run convenience; it is not sent to
 * the API or used to infer a script-sensitive locale. */
export function preferredAvailableLocale(browserLocale?: string): string {
  if (!browserLocale) return DEFAULT_LOCALE;
  const exact = AVAILABLE_LOCALES.find(locale => locale.tag.toLowerCase() === browserLocale.toLowerCase());
  if (exact) return exact.tag;
  const base = browserLocale.split('-')[0].toLowerCase();
  return AVAILABLE_LOCALES.find(locale => locale.tag === base)?.tag || DEFAULT_LOCALE;
}
