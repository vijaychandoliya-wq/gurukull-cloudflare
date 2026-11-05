// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {LanguageProvider,useLanguage,LOCALE_STORAGE_KEY} from '../i18n/LanguageProvider';
import {DashboardPage} from './DashboardPage';
import {LOCALE_REGISTRY} from '../i18n/registry';
import {interfaceText} from '../i18n/interfaceText';
const api=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('../services/api',()=>({apiClient:api}));
// Pure in-memory response, never persisted to a school.
const record={school:{name:'Unchanged school name',code:'CODE',status:'active'},counts:{students:8},configuration:{timezone:'Asia/Kolkata',currency:'INR',address:'Unchanged address'},currentYear:null,setupNeeded:true,attendance:{rate:null,sessions:0,present:0,absent:0,late:0,lastDate:null},finance:{collectionRate:null,billedMinor:0,paidMinor:0,outstandingMinor:0,overdueInvoices:0},analytics:{homework:{total:0,published:0},exams:{total:0,published:0},leaveRequests:{pending:0}}};
function Controls(){const {setLocale}=useLanguage();return <>{LOCALE_REGISTRY.map(({tag})=><button key={tag} data-lang={tag} onClick={()=>setLocale(tag)}>{tag}</button>)}</>;}
let host:HTMLDivElement,root:Root;
beforeEach(()=>{localStorage.clear();localStorage.setItem(LOCALE_STORAGE_KEY,'en');(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(window,'matchMedia',{writable:true,value:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})});host=document.createElement('div');document.body.append(host);root=createRoot(host);api.get.mockResolvedValue({data:{data:record}});});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();localStorage.clear();vi.clearAllMocks();});
it('updates the loaded dashboard immediately in all enabled languages and preserves school data',async()=>{
 await act(async()=>root.render(<MemoryRouter><LanguageProvider><Controls/><DashboardPage/></LanguageProvider></MemoryRouter>));
 expect(host.textContent).toContain('School overview');
 for(const [tag,title,label] of [['hi','विद्यालय का अवलोकन','विद्यार्थी'],['ta','பள்ளிக் கண்ணோட்டம்','மாணவர்கள்'],['ur','اسکول کا جائزہ','طلبہ'],['en','School overview','Students']]){
  await act(async()=>host.querySelector<HTMLButtonElement>(`[data-lang="${tag}"]`)!.click());
  expect(host.querySelector('h2')?.textContent).toBe(title);expect(host.textContent).toContain(label);
  expect(host.textContent).toContain('Unchanged school name');expect(host.textContent).toContain('Unchanged address');
  expect(document.documentElement.dir).toBe(tag==='ur'?'rtl':'ltr');expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(tag);
 }
 expect(api.get).toHaveBeenCalledTimes(1);
});
it('translates fallback failures even when language is changed after the request failed',async()=>{
 api.get.mockRejectedValue(new Error('Offline'));
 await act(async()=>root.render(<MemoryRouter><LanguageProvider><Controls/><DashboardPage/></LanguageProvider></MemoryRouter>));
 expect(host.textContent).toContain('Dashboard could not be loaded.');
 await act(async()=>host.querySelector<HTMLButtonElement>('[data-lang="hi"]')!.click());
 expect(host.textContent).toContain('डैशबोर्ड लोड नहीं हो सका।');
});

it('renders every additional Indian language after the school dashboard has loaded',async()=>{
 await act(async()=>root.render(<MemoryRouter><LanguageProvider><Controls/><DashboardPage/></LanguageProvider></MemoryRouter>));
 for(const {tag,direction} of LOCALE_REGISTRY.filter(item=>!['en','hi','ta','ur'].includes(item.tag))){
  await act(async()=>host.querySelector<HTMLButtonElement>(`[data-lang="${tag}"]`)!.click());
  expect(host.querySelector('h2')?.textContent).toBe(interfaceText(tag,'School overview'));
  expect(host.querySelector('h2')?.textContent).not.toBe('School overview');
  expect(document.documentElement.lang).toBe(tag);expect(document.documentElement.dir).toBe(direction);
  expect(host.textContent).toContain('Unchanged school name');
 }
 expect(api.get).toHaveBeenCalledTimes(1);
});
