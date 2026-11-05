// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {App} from 'antd';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {ProfilePage} from './ProfilePage';
import {LanguageProvider,LOCALE_STORAGE_KEY} from '../i18n/LanguageProvider';
const api=vi.hoisted(()=>({get:vi.fn(),put:vi.fn()}));
vi.mock('../services/api',()=>({apiClient:api,API:{profileApi:'/profile',localePreferenceApi:'/locale'},clearPortalSession:vi.fn()}));
vi.mock('../components/PasswordChangeForm',()=>({PasswordChangeForm:()=> <p>Password form</p>}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();localStorage.setItem(LOCALE_STORAGE_KEY,'hi');Object.defineProperty(window,'matchMedia',{writable:true,value:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})});api.get.mockImplementation(async(path:string)=>({data:{data:path==='/locale'?{localeTag:'en',version:0}:{name:'Memory-only profile',version:1}}}));api.put.mockResolvedValue({data:{message:'Saved',data:{localeTag:'hi',version:1}}});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();localStorage.clear();vi.clearAllMocks();});
async function click(label:string){const target=[...document.querySelectorAll('button')].find(b=>b.textContent===label);expect(target).toBeTruthy();await act(async()=>target!.click());}
it('keeps the chosen device language when Profile loads and saves that choice to the account',async()=>{
 await act(async()=>root.render(<LanguageProvider><App><ProfilePage/></App></LanguageProvider>));
 expect(host.textContent).toContain('Memory-only profile');expect(host.textContent).toContain('भाषा वरीयता');expect(document.documentElement.lang).toBe('hi');
 await click('भाषा वरीयता सहेजें');expect(api.put).toHaveBeenCalledWith('/locale',{mode:'explicit',localeTag:'hi',version:0},expect.any(Object));
 await click('Edit profile');await click('Save changes');expect(api.put).toHaveBeenCalledWith('/profile',expect.objectContaining({name:'Memory-only profile',version:1}),expect.any(Object));
 expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('hi');
});
it.each([new Error('Offline'),{response:{data:{message:'Profile temporarily unavailable'}}}])('keeps the selected language when profile loading fails',async error=>{
 api.get.mockRejectedValue(error);
 await act(async()=>root.render(<LanguageProvider><App><ProfilePage/></App></LanguageProvider>));
 expect(host.querySelector('[role="alert"]')).toBeTruthy();expect(document.documentElement.lang).toBe('hi');expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('hi');
});
