// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import {LanguageProvider,useLanguage,LOCALE_STORAGE_KEY} from './LanguageProvider';
function Preferences(){const {locale,setLocale,restoreAccountLocale}=useLanguage();return <><output>{locale}</output><button data-restore onClick={()=>restoreAccountLocale('hi')}>Restore account</button><button data-manual onClick={()=>setLocale('ta')}>Manual choice</button></>;}
it('loads an account language after sign-in and prevents a late response replacing a manual choice',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>root.render(<LanguageProvider><Preferences/></LanguageProvider>));await act(async()=>host.querySelector<HTMLButtonElement>('[data-restore]')!.click());expect(host.querySelector('output')?.textContent).toBe('hi');await act(async()=>host.querySelector<HTMLButtonElement>('[data-manual]')!.click());await act(async()=>host.querySelector<HTMLButtonElement>('[data-restore]')!.click());expect(host.querySelector('output')?.textContent).toBe('ta');expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ta');}finally{await act(async()=>root.unmount());host.remove();localStorage.clear();}
});
