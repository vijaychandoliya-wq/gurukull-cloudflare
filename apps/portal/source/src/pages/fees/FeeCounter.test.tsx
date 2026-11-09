// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {App} from 'antd';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {FeeCounter} from './FeeCounter';
import {apiClient} from '../../services/api';

vi.mock('../../services/api',()=>({apiClient:{get:vi.fn(),post:vi.fn()}}));
vi.mock('./feeHelpers',async importOriginal=>({...await importOriginal<any>(),useFeeText:()=>((s:string)=>s)}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{id:'cashier'},schoolCode:'boundary'})}));
vi.mock('./FeeReceipt',()=>({FeeReceipt:({id}:{id:string})=><div>Confirmed receipt: {id}</div>}));
vi.mock('../../components/portal/UX',()=>({MoneyInput:({value,onChange}:{value:number;onChange:(n:number)=>void})=><input aria-label="Money input" type="number" value={value??''} onChange={e=>onChange(Number(e.target.value))}/>}));
let host:HTMLDivElement,root:Root;
const context={name:'Year',currency:'INR',timezone:'Asia/Kolkata',startsOn:'2026-04-01',endsOn:'2027-03-31'};
beforeEach(()=>{sessionStorage.clear();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(window,'matchMedia',{writable:true,value:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})});host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.mocked(apiClient.get).mockImplementation(async(url:any)=>({data:String(url).endsWith('/students')?{data:[{id:'student',fullName:'Boundary learner',admissionNo:'A-1',className:'1 – A',balanceMinor:350000}],total:1}:{data:{student:{id:'student'},invoices:[{id:'invoice',feeName:'Tuition',invoiceNo:'INV-1',amountMinor:350000,paidMinor:0,concessionMinor:0,balanceMinor:350000,currency:'INR',status:'unpaid',version:4}]},total:1}}));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();});
const click=async(text:string)=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.trim()===text);expect(button,'button '+text).toBeTruthy();await act(async()=>button!.click());};
async function open(){await act(async()=>root.render(<App><FeeCounter context={context} policy={{version:1}} onDirty={()=>{}} onSettings={()=>{}} onAddCharge={()=>{}} onCancelCharge={()=>{}}/></App>));await click('Open fees');await click('Record payment');}
async function fill(){
 const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;
 await act(async()=>{const amount=host.querySelector<HTMLInputElement>('[aria-label="Money input"]')!;setter.call(amount,'200000');amount.dispatchEvent(new Event('input',{bubbles:true}));const note=host.querySelector<HTMLInputElement>('#remarks')!;setter.call(note,'Received at counter');note.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>host.querySelector('.ant-select-selector')!.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})));
 await act(async()=>Array.from(document.querySelectorAll('.ant-select-item-option-content')).find(n=>n.textContent==='Cash')!.dispatchEvent(new MouseEvent('click',{bubbles:true})));
}
it('selects an actual API result and shows a partial-payment balance before saving',async()=>{
 await open();await fill();expect(host.textContent).toContain('₹1,500.00');expect(apiClient.post).not.toHaveBeenCalled();
 await click('Review payment');expect(document.body.textContent).toContain('Confirm payment');expect(document.body.textContent).toContain('Boundary learner · A-1');
 vi.mocked(apiClient.post).mockResolvedValue({data:{data:{id:'receipt'}}});await click('Record ₹2,000.00 and create receipt');expect(apiClient.post).toHaveBeenCalledWith('/api/admin/fees/payments',expect.objectContaining({invoiceId:'invoice',version:4,amountMinor:200000,concessionMinor:0,paymentMode:'cash'}),expect.objectContaining({headers:{'Idempotency-Key':expect.any(String)}}));expect(host.textContent).toContain('Confirmed receipt: receipt');
});
it('retries an unconfirmed payment with the same key and frozen payload',async()=>{
 await open();await fill();await click('Review payment');vi.mocked(apiClient.post).mockRejectedValueOnce(Error('Network lost')).mockResolvedValueOnce({data:{data:{id:'receipt'}}});await click('Record ₹2,000.00 and create receipt');expect(host.textContent).toContain('Payment status is not confirmed');await click('Retry same payment');expect(vi.mocked(apiClient.post).mock.calls[1]).toEqual(vi.mocked(apiClient.post).mock.calls[0]);expect(host.textContent).toContain('Confirmed receipt: receipt');
});

it('recovers an unconfirmed payment after reopening the counter and checks the existing command',async()=>{
 await open();await fill();await click('Review payment');vi.mocked(apiClient.post).mockRejectedValueOnce(Error('Network lost'));await click('Record ₹2,000.00 and create receipt');const command=JSON.parse(sessionStorage.getItem('gk-fee-pending:boundary:cashier')!);expect(command.body.amountMinor).toBe(200000);
 await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App><FeeCounter context={context} policy={{version:1}} onDirty={()=>{}} onSettings={()=>{}} onAddCharge={()=>{}} onCancelCharge={()=>{}}/></App>));expect(host.textContent).toContain('Payment status is not confirmed');vi.mocked(apiClient.get).mockResolvedValueOnce({data:{data:{receiptId:'recovered'}}});await click('Check payment status');expect(apiClient.get).toHaveBeenCalledWith('/api/admin/fees/counter/commands/'+command.key);expect(apiClient.post).toHaveBeenCalledTimes(1);expect(host.textContent).toContain('Confirmed receipt: recovered');expect(sessionStorage.getItem('gk-fee-pending:boundary:cashier')).toBeNull();
});
it('stops an overpayment before confirmation or an API write',async()=>{
 await open();await fill();const amount=host.querySelector<HTMLInputElement>('[aria-label="Money input"]')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(amount,'400000');amount.dispatchEvent(new Event('input',{bubbles:true}));});await click('Review payment');expect(host.textContent).toContain('cannot exceed the selected balance');expect(apiClient.post).not.toHaveBeenCalled();expect(document.body.textContent).not.toContain('Confirm payment');
});
it('requires an actual reference for UPI without writing a payment',async()=>{
 await open();await fill();await act(async()=>host.querySelector('.ant-select-selector')!.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})));await act(async()=>Array.from(document.querySelectorAll('.ant-select-item-option-content')).find(n=>n.textContent==='UPI')!.dispatchEvent(new MouseEvent('click',{bubbles:true})));await click('Review payment');await act(async()=>{await new Promise(resolve=>setTimeout(resolve,50));});expect(host.textContent).toContain('Enter the actual received payment reference.');expect(apiClient.post).not.toHaveBeenCalled();
});
