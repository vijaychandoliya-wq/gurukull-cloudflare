import drafts from './locales/indic-core.json';
// Static UI copy only. Never pass school records or identifiers to this lookup.
const packs:Record<string,Record<string,string>>=drafts;
export function interfaceText(locale:string,source:string):string {
  return packs[locale]?.[source] || source;
}
export const CORE_TRANSLATION_TAGS=Object.keys(packs);
