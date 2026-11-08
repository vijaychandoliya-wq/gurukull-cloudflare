// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {LanguageProvider,useLanguage,LOCALE_STORAGE_KEY} from '../../i18n/LanguageProvider';
import {AppLayout} from './AppLayout';
const auth=vi.hoisted(()=>({role:'schooladmin'}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{name:'Unchanged name',roles:[auth.role]},schoolCode:'CODE',schoolName:'Unchanged school',academicYear:'Year',logout:vi.fn().mockResolvedValue(undefined),hasRole:(...roles:string[])=>roles.includes(auth.role)})}));
vi.mock('../ThemeSwitcher',()=>({ThemeSwitcher:()=>null}));
vi.mock('../LanguageSwitcher',()=>({LanguageSwitcher:()=>{const {setLocale}=useLanguage();return <button data-language onClick={()=>setLocale('hi')}>हिन्दी</button>;}}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{auth.role='schooladmin';localStorage.setItem(LOCALE_STORAGE_KEY,'en');(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(window,'matchMedia',{writable:true,value:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();localStorage.clear();});
async function open(){await act(async()=>root.render(<MemoryRouter initialEntries={['/dashboard']}><LanguageProvider><AppLayout><input aria-label="Unsaved work" defaultValue="Keep this"/></AppLayout></LanguageProvider></MemoryRouter>));}
it('changes navigation and breadcrumbs without remounting unsaved page content',async()=>{
 await open();const input=host.querySelector<HTMLInputElement>('[aria-label="Unsaved work"]')!;
 await act(async()=>host.querySelector<HTMLButtonElement>('[data-language]')!.click());
 expect(host.textContent).toContain('अवलोकन');expect(host.textContent).toContain('शैक्षणिक कार्य');expect(host.textContent).toContain('Unchanged school');
 expect(host.querySelector('[aria-label="Unsaved work"]')).toBe(input);expect(input.value).toBe('Keep this');
 expect(host.querySelector('.gk-breadcrumb')?.textContent).toContain('अवलोकन');
});
it('translates the teacher navigation without granting administrator menu items',async()=>{
 auth.role='teacher';await open();await act(async()=>host.querySelector<HTMLButtonElement>('[data-language]')!.click());
 expect(host.textContent).toContain('मेरा कार्यक्षेत्र');expect(host.textContent).toContain('मेरी कक्षा की उपस्थिति');expect(host.textContent).not.toContain('विद्यालय सेटिंग्स');
});
it('keeps translated search and menu navigation usable',async()=>{
 await open();const search=host.querySelector<HTMLInputElement>('[aria-label="Search students"]')!;
 await act(async()=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;setter.call(search,'existing');search.dispatchEvent(new Event('input',{bubbles:true}));search.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true}));});
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Collapse navigation"]')!.click());
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Expand navigation"]')!.click());
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Close navigation"]')!.click());
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Expand navigation"]')!.click());
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Notifications"]')!.click());
 expect(host.querySelector('.gk-breadcrumb')?.textContent).toContain('Notices');
});
it('keeps the navigation toggle separate from preferences and exposes its expanded state',async()=>{
 await open();const toggle=host.querySelector<HTMLButtonElement>('.gk-navigation-toggle')!;
 expect(toggle.closest('.gk-header-navigation')).not.toBeNull();
 expect(toggle.closest('.gk-header-preferences')).toBeNull();
 expect(host.querySelector('[data-language]')?.closest('.gk-header-preferences')).not.toBeNull();
 expect(toggle.getAttribute('aria-controls')).toBe('school-navigation');
 expect(toggle.getAttribute('aria-expanded')).toBe('true');
 await act(async()=>toggle.click());expect(toggle.getAttribute('aria-expanded')).toBe('false');
 await act(async()=>toggle.click());expect(toggle.getAttribute('aria-expanded')).toBe('true');
});
