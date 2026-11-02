// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {App} from 'antd';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {WhatsAppConnectionPage} from './WhatsAppConnectionPage';
const api=vi.hoisted(()=>({get:vi.fn(),put:vi.fn()}));
vi.mock('../services/api',()=>({apiClient:api}));
vi.mock('../components/WhatsAppConsentPanel',()=>({WhatsAppConsentPanel:()=> <input aria-label="Consent evidence"/>}));
vi.mock('../components/WhatsAppSuppressionPanel',()=>({WhatsAppSuppressionPanel:()=> <p>Opt-out records</p>}));
vi.mock('../components/WhatsAppTemplateDraftPanel',()=>({WhatsAppTemplateDraftPanel:()=> <p>Template records</p>}));
vi.mock('../components/WhatsAppReadinessPanel',()=>({WhatsAppReadinessPanel:({onDraftSaved}:any)=> <button onClick={onDraftSaved}>Save readiness draft</button>}));
vi.mock('../components/WhatsAppMessageDraftPanel',()=>({WhatsAppMessageDraftPanel:({refreshKey}:any)=> <p>Draft refresh {refreshKey}</p>}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{
 Object.defineProperty(window,'matchMedia',{writable:true,value:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})});
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 api.get.mockResolvedValue({data:{data:{draft:{displayName:'Existing school',phone:'+919876543210',version:1}}}});
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();});
async function open(path='/whatsapp'){await act(async()=>root.render(<MemoryRouter initialEntries={[path]}><App><WhatsAppConnectionPage/></App></MemoryRouter>));}
async function tab(name:string){const button=[...host.querySelectorAll('[role="tab"]')].find(e=>e.textContent===name);expect(button).toBeTruthy();await act(async()=> (button as HTMLElement).click());}
function active(){return host.querySelector('.ant-tabs-tabpane-active');}
describe('School WhatsApp task tabs',()=>{
 it('opens one task panel and preserves connection values when switching away and back',async()=>{
  await open();expect(host.querySelectorAll('[role="tab"]')).toHaveLength(6);
  expect(active()?.textContent).toContain('School-owned number');
  await tab('Parent consent');expect(active()?.querySelector('[aria-label="Consent evidence"]')).toBeTruthy();
  const input=active()!.querySelector('input')!;input.value='Recorded permission';
  await tab('Message templates');expect(active()?.textContent).toContain('Template records');
  await tab('Parent consent');expect(active()!.querySelector('input')!.value).toBe('Recorded permission');
  await tab('School number');expect(host.querySelector<HTMLInputElement>('#displayName')?.value).toBe('Existing school');
 });
 it('opens draft links directly and refreshes them after a readiness draft is saved',async()=>{
  await open('/whatsapp?tab=drafts');expect(active()?.textContent).toContain('Draft refresh 0');
  await tab('Check readiness');await act(async()=> (active()!.querySelector('button') as HTMLElement).click());
  await tab('Message drafts');expect(active()?.textContent).toContain('Draft refresh 1');
  await tab('Opt-outs');expect(active()?.textContent).toContain('Opt-out records');
 });
 it('falls back to the school-number tab when a link contains an unknown tab',async()=>{
  await open('/whatsapp?tab=missing');expect(active()?.textContent).toContain('School-owned number');
 });
});
