// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from 'antd';
import {MemoryRouter} from 'react-router-dom';
import {expect,it,vi} from 'vitest';
import {FeeLedgerPage} from './FeeLedgerPage';
import {apiClient} from '../services/api';
vi.mock('../services/api',()=>({apiClient:{get:vi.fn(),post:vi.fn()}}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({schoolName:'Boundary school'})}));
vi.mock('./fees/feeHelpers',async original=>({...await original<any>(),useFeeText:()=>((s:string)=>s)}));
it('starts at student search without waiting for fee plans and explains a failed plan read',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(window,'matchMedia',{writable:true,value:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})});
 vi.mocked(apiClient.get).mockImplementation(async(url:any)=>{if(String(url).endsWith('/structures'))throw {response:{data:{message:'FEE_STRUCTURE_NOT_FOUND'}}};return {data:{data:String(url).endsWith('/context')?{name:'Year',currency:'INR',timezone:'Asia/Kolkata',startsOn:'2026-04-01',endsOn:'2027-03-31'}:String(url).endsWith('/students')?[{id:'student',fullName:'Boundary learner',admissionNo:'A-1',balanceMinor:50000}]:{},total:1}};});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>root.render(<App><MemoryRouter><FeeLedgerPage/></MemoryRouter></App>));expect(host.textContent).toContain('Boundary learner');expect(vi.mocked(apiClient.get).mock.calls.some(([url])=>String(url).endsWith('/structures'))).toBe(false);const tab=Array.from(host.querySelectorAll('[role="tab"]')).find(n=>n.textContent==='Fee plans')!;await act(async()=>tab.dispatchEvent(new MouseEvent('click',{bubbles:true})));expect(host.textContent).toContain('This fee plan could not be found');expect(host.textContent).not.toContain('FEE_STRUCTURE_NOT_FOUND');}finally{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();}
});
