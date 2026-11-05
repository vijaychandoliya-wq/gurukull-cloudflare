import {describe,expect,it} from 'vitest';
import {AVAILABLE_LOCALES,LOCALE_REGISTRY,localeDefinition,preferredAvailableLocale} from './registry';

describe('locale registry',()=>{
  it('makes all scheduled languages selectable with explicit preview status',()=>{
    expect(LOCALE_REGISTRY).toHaveLength(23);
    expect(localeDefinition('ks-Arab').direction).toBe('rtl');
    expect(localeDefinition('sd-Arab').direction).toBe('rtl');
    expect(localeDefinition('mni-Mtei').availability).toBe('preview');
    expect(AVAILABLE_LOCALES).toHaveLength(23);
  });
  it('uses a reviewed base language for browser convenience and English otherwise',()=>{
    expect(preferredAvailableLocale('ta-IN')).toBe('ta');
    expect(preferredAvailableLocale('ur-PK')).toBe('ur');
    expect(preferredAvailableLocale('bn-IN')).toBe('bn');
  });
});
