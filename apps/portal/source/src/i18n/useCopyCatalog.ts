import {useMemo} from 'react';
import {en} from './en';
import {useLanguage} from './LanguageProvider';
import {interfaceText} from './interfaceText';
type Copy<T>={readonly [K in keyof T]:T[K] extends string?string:Copy<T[K]>};
function translate(value:unknown,locale:string):unknown {
  if(typeof value==='string')return interfaceText(locale,value);
  return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([key,item])=>[key,translate(item,locale)]));
}
export function useCopyCatalog():Copy<typeof en> {
  const {locale}=useLanguage();
  return useMemo(()=>translate(en,locale) as Copy<typeof en>,[locale]);
}
