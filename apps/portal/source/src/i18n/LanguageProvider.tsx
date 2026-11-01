import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {DEFAULT_LOCALE,isAvailableLocale,localeDefinition,preferredAvailableLocale} from './registry';
import {messages,type MessageKey} from './messages';

export const LOCALE_STORAGE_KEY='gurukull.locale.v1';
type LocaleContextValue={locale:string;direction:'ltr'|'rtl';setLocale:(locale:string)=>void;t:(key:MessageKey)=>string};
const LocaleContext=createContext<LocaleContextValue|null>(null);

export function readLocalePreference():string {
  try {
    const stored=localStorage.getItem(LOCALE_STORAGE_KEY);
    if(stored&&isAvailableLocale(stored))return stored;
    return preferredAvailableLocale(navigator.language);
  } catch { return DEFAULT_LOCALE; }
}

export const LanguageProvider:React.FC<{children:React.ReactNode}>=({children})=>{
  const [locale,setLocaleState]=useState(readLocalePreference);
  const setLocale=useCallback((next:string)=>{
    const safe=isAvailableLocale(next)?next:DEFAULT_LOCALE;
    setLocaleState(safe);
    try{localStorage.setItem(LOCALE_STORAGE_KEY,safe);}catch{/* Storage is optional. */}
  },[]);
  useEffect(()=>{
    const definition=localeDefinition(locale);
    document.documentElement.lang=locale;
    document.documentElement.dir=definition.direction;
    document.documentElement.dataset.locale=locale;
  },[locale]);
  const value=useMemo<LocaleContextValue>(()=>({
    locale,direction:localeDefinition(locale).direction,setLocale,
    t:(key)=>messages[locale as keyof typeof messages]?.[key]||messages.en[key],
  }),[locale,setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export function useLanguage():LocaleContextValue {
  const value=useContext(LocaleContext);
  if(!value)throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
