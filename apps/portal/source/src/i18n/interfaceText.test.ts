import {describe,it,expect} from 'vitest';
import {LOCALE_REGISTRY} from './registry';
import {interfaceText,CORE_TRANSLATION_TAGS} from './interfaceText';
import packs from './locales/indic-core.json';
import sourceCopy from './locales/core-source.json';
const translations:Record<string,Record<string,string>>=packs;
describe('Indian-language core packs',()=>{
 it.each(LOCALE_REGISTRY.filter(x=>x.tag!=='en'))('provides actual core text for $englishName with intact interpolation tokens',({tag})=>{
  expect(CORE_TRANSLATION_TAGS).toContain(tag);
  expect(interfaceText(tag,'School overview')).not.toBe('School overview');
  expect(interfaceText(tag,'Students')).not.toBe('Students');
  expect(Object.keys(translations[tag]).sort()).toEqual(Object.keys(sourceCopy).sort());
  for(const [source,value] of Object.entries(translations[tag])){
   expect(value.trim()).not.toBe('');expect([...value.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort()).toEqual([...source.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort());
  }
 });
 it('falls back to readable English without transforming arbitrary data',()=>{
  expect(interfaceText('invalid','Save')).toBe('Save');expect(interfaceText('bn','UNRECOGNISED_SCHOOL_VALUE')).toBe('UNRECOGNISED_SCHOOL_VALUE');
 });
});
