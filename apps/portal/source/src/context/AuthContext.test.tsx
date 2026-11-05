// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {AuthProvider,useAuth} from './AuthContext';
import {LanguageProvider,useLanguage} from '../i18n/LanguageProvider';
import {apiClient,API} from '../services/api';
let host:HTMLDivElement,root:Root;
const actor={id:'memory-only-user',name:'In-memory actor',roles:['teacher']};
function Probe(){const a=useAuth(),l=useLanguage();return <><output>{a.isAuthenticated?'signed-in':'signed-out'}|{l.locale}|{a.hasRole('teacher')?'teacher':'no-role'}|{a.schoolName}</output><button data-login onClick={()=>a.login('CODE','memory-only-identifier','memory-only-password').catch(()=>{})}>Sign in</button><button data-logout onClick={()=>a.logout()}>Sign out</button><button data-refresh onClick={()=>a.refreshSchool()}>Refresh</button></>;}
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();localStorage.clear();vi.restoreAllMocks();});
async function mount(){await act(async()=>root.render(<LanguageProvider><AuthProvider><Probe/></AuthProvider></LanguageProvider>));}
async function click(selector:string){await act(async()=>host.querySelector<HTMLButtonElement>(selector)!.click());}
it('restores an account language after login while keeping school identity and role from the session',async()=>{
 vi.spyOn(apiClient,'post').mockResolvedValue({data:{token:'memory-token',user:actor,school:{name:'Memory school'}}});
 vi.spyOn(apiClient,'get').mockImplementation(async path=>({data:{data:path===API.localePreferenceApi?{localeTag:'hi'}:{school:{name:'Memory school',academicYear:'Year'}}}}));
 await mount();await click('[data-login]');expect(host.textContent).toContain('signed-in|hi|teacher|Memory school');
 await click('[data-refresh]');await click('[data-logout]');expect(host.textContent).toContain('signed-out');expect(localStorage.getItem('gurukul_token')).toBeNull();
});
it('keeps a successful login usable when optional language and branding requests fail',async()=>{
 vi.spyOn(apiClient,'post').mockResolvedValue({data:{token:'memory-token',user:actor}});vi.spyOn(apiClient,'get').mockRejectedValue(new Error('Offline'));
 await mount();await click('[data-login]');expect(host.textContent).toContain('signed-in');await click('[data-refresh]');
});
it('rejects an invalid login response without retaining a prior school session',async()=>{
 vi.spyOn(apiClient,'post').mockResolvedValue({data:{user:actor}});vi.spyOn(apiClient,'get').mockResolvedValue({data:{data:{}}});
 await mount();await click('[data-login]');expect(host.textContent).toContain('signed-out');expect(localStorage.getItem('gurukul_school_code')).toBeNull();
});
it('ignores an account-language response that arrives after sign-out',async()=>{
 let finish:(value:unknown)=>void=()=>{};const pending=new Promise<any>(resolve=>{finish=resolve;});
 vi.spyOn(apiClient,'post').mockResolvedValue({data:{token:'memory-token',user:actor}});
 vi.spyOn(apiClient,'get').mockImplementation(path=>path===API.localePreferenceApi?pending:Promise.resolve({data:{data:{school:{name:'Memory school'}}}} as any));
 await mount();await click('[data-login]');await click('[data-logout]');await act(async()=>finish({data:{data:{localeTag:'ta'}}}));
 expect(host.textContent).toContain('signed-out');expect(host.textContent).not.toContain('|ta|');
});
