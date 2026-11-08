// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {App} from 'antd';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {FeePlans} from './FeePlans';
import {FeeSettings} from './FeeSettings';
import {FeeReports} from './FeeReports';
import {FeeReceipt} from './FeeReceipt';
import {apiClient} from '../../services/api';
vi.mock('../../services/api',()=>({apiClient:{get:vi.fn(),post:vi.fn(),request:vi.fn()}}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({schoolName:'Boundary school'})}));
vi.mock('./feeHelpers',async original=>({...await original<any>(),useFeeText:()=>((s:string)=>s)}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(window,'matchMedia',{writable:true,value:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();});
const render=async(node:React.ReactNode)=>act(async()=>root.render(<App><MemoryRouter>{node}</MemoryRouter></App>));
const click=async(label:string)=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.trim()===label);expect(button,label).toBeTruthy();await act(async()=>button!.click());};
it('reviews the intended assignment and discloses the batch limit before creating invoices',async()=>{
 vi.mocked(apiClient.get).mockImplementation(async(url:any)=>({data:{data:String(url).includes('assignment-preview')?{version:3,amountMinor:10000,eligibleTotal:700,alreadyAssigned:4,students:[],page:1,batchIds:'reviewed-batch'}:[{id:'plan',name:'Tuition term',amountMinor:10000,status:'active'}]}}));vi.mocked(apiClient.post).mockResolvedValue({data:{message:'500 assigned.',data:{assigned:500}}});
 await render(<FeePlans context={{currency:'INR'}} policy={{version:1}} options={{}}/>);await click('Review assignment');expect(apiClient.post).not.toHaveBeenCalled();expect(document.body.textContent).toContain('700');await click('Assign to 500 students');expect(apiClient.post).toHaveBeenCalledWith('/api/admin/fees/structures/plan/assign',{expectedVersion:3,expectedCount:700,expectedBatchIds:'reviewed-batch'},expect.any(Object));expect(host.textContent).toContain('More students remain');
});
it('does not allow an imported opening balance to be assigned to a class',async()=>{
 vi.mocked(apiClient.get).mockResolvedValue({data:{data:[{id:'plan',name:'Opening',amountMinor:10000,status:'active',isOpeningBalance:1}]}});await render(<FeePlans context={{currency:'INR'}} policy={{version:1}} options={{}}/>);const button=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Review assignment')!;expect(button.disabled).toBe(true);expect(host.textContent).toContain('Opening balance only');
});
it('keeps an unconfirmed assignment locked to its reviewed batch when retrying',async()=>{
 vi.mocked(apiClient.get).mockImplementation(async(url:any)=>({data:{data:String(url).includes('assignment-preview')?{version:3,amountMinor:10000,eligibleTotal:700,alreadyAssigned:4,students:[],page:1,batchIds:'reviewed-batch'}:[{id:'plan',name:'Tuition term',amountMinor:10000,status:'active'}]}}));
 vi.mocked(apiClient.post).mockRejectedValueOnce(Error('Network lost')).mockResolvedValueOnce({data:{message:'500 assigned.',data:{assigned:500}}});
 await render(<FeePlans context={{currency:'INR'}} policy={{version:1}} options={{}}/>);await click('Review assignment');await click('Assign to 500 students');expect(document.body.textContent).toContain('Retry this same batch');await click('Assign to 500 students');expect(vi.mocked(apiClient.post).mock.calls[1]).toEqual(vi.mocked(apiClient.post).mock.calls[0]);expect(host.textContent).toContain('More students remain');
});
it('shows existing locked numbering without offering a reset',async()=>{
 vi.mocked(apiClient.get).mockResolvedValue({data:{data:[]}});await render(<FeeSettings context={{currency:'INR',name:'Year'}} policy={{locked:1,invoicePrefix:'I-',receiptPrefix:'R-',nextInvoiceNumber:6,nextReceiptNumber:8,numberWidth:4}} options={{}} onSaved={()=>{}} onPlans={()=>{}}/>);expect(host.textContent).toContain('I-0006');expect(host.textContent).toContain('Numbering is locked');expect(host.querySelector('input')).toBeNull();
});
it('shows unavailable report totals as unavailable rather than zero money',async()=>{
 vi.mocked(apiClient.get).mockRejectedValue(Error('Report unavailable'));await render(<FeeReports context={{currency:'INR',name:'Year'}}/>);expect(host.textContent).toContain('Report unavailable');expect(host.textContent).not.toContain('₹0.00');
});
it('reopens a receipt without creating a new collection',async()=>{
 vi.mocked(apiClient.get).mockImplementation(async(url:any)=>({data:{data:String(url).includes('receipts')?{id:'receipt',receiptNo:'R-1',invoiceId:'invoice',studentName:'Boundary learner',amountMinor:10000,concessionMinor:0,currency:'INR',entryType:'collection'}:{balanceMinor:20000}}}));await render(<FeeReceipt id="receipt"/>);expect(host.textContent).toContain('R-1');expect(host.textContent).toContain('₹100.00');expect(host.textContent).toContain('₹200.00');expect(apiClient.post).not.toHaveBeenCalled();
});
it('prints an existing receipt in a separate document without portal chrome or another collection',async()=>{
 vi.mocked(apiClient.get).mockResolvedValue({data:{data:{id:'receipt',receiptNo:'R-2',studentName:'Boundary learner',admissionNo:'A-1',amountMinor:10000,concessionMinor:0,currency:'INR',entryType:'collection',remarks:'<script>not executable</script>'}}});
 const print=vi.fn(),append=document.body.append.bind(document.body),spy=vi.spyOn(document.body,'append').mockImplementation((...nodes)=>{append(...nodes);for(const node of nodes)if(node instanceof HTMLIFrameElement){node.contentWindow!.print=print;node.contentWindow!.focus=vi.fn();}});
 try{await render(<><div className="portal-navigation">Portal navigation</div><FeeReceipt id="receipt"/></>);await click('Print / save PDF');const frame=document.querySelector('iframe')!;expect(frame.contentDocument!.body.textContent).toContain('R-2');expect(frame.contentDocument!.body.textContent).toContain('₹100.00');expect(frame.contentDocument!.body.textContent).not.toContain('Portal navigation');expect(frame.contentDocument!.querySelector('script')).toBeNull();expect(print).toHaveBeenCalledTimes(1);expect(apiClient.post).not.toHaveBeenCalled();frame.contentWindow!.dispatchEvent(new Event('afterprint'));expect(document.querySelector('iframe')).toBeNull();}finally{spy.mockRestore();}
});
