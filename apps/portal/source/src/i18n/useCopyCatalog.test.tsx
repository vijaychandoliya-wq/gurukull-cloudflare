// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import {LanguageProvider,useLanguage,LOCALE_STORAGE_KEY} from './LanguageProvider';
import {useCopyCatalog} from './useCopyCatalog';
function FormLabels(){const copy=useCopyCatalog();const {setLocale}=useLanguage();return <><button onClick={()=>setLocale('bn')}>বাংলা</button><h2>{copy.academics.title}</h2><label>{copy.academics.className}<input defaultValue="Preserved class name"/></label><button>{copy.common.save}</button></>;}
it('updates common academic form labels without changing the entered record',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;localStorage.setItem(LOCALE_STORAGE_KEY,'en');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<LanguageProvider><FormLabels/></LanguageProvider>));expect(host.querySelector('h2')?.textContent).toBe('Academics');const input=host.querySelector('input');
  await act(async()=>host.querySelector('button')!.click());expect(host.querySelector('h2')?.textContent).not.toBe('Academics');expect(host.querySelector('input')).toBe(input);expect(input?.value).toBe('Preserved class name');
 }finally{await act(async()=>root.unmount());host.remove();localStorage.clear();}
});
