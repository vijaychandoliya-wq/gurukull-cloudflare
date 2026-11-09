// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Table} from './ExportTable';
import {printTablePdf} from './tablePdf';
vi.mock('./tablePdf',async original=>({...await original<any>(),printTablePdf:vi.fn()}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(window,'matchMedia',{writable:true,value:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})});host=document.createElement('div');host.className='gk-shell';host.setAttribute('data-school-name','Boundary school');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();});
it('exports only the displayed page and identifies the school without fetching other records',async()=>{
 await act(async()=>root.render(<Table rowKey="id" columns={[{title:'Name',dataIndex:'name'}]} dataSource={Array.from({length:11},(_,i)=>({id:i,name:'Row '+i}))}/>));await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Export PDF')!.click());expect(printTablePdf).toHaveBeenCalledOnce();expect(vi.mocked(printTablePdf).mock.calls[0][0].rows).toHaveLength(10);expect(vi.mocked(printTablePdf).mock.calls[0][2]).toBe('Boundary school');expect(host.textContent).toContain('current loaded rows');
});
it('disables exporting an empty table',async()=>{await act(async()=>root.render(<Table columns={[{title:'Name',dataIndex:'name'}]} dataSource={[]}/>));expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Export PDF')!.disabled).toBe(true);expect(printTablePdf).not.toHaveBeenCalled();});
it('reports a failed PDF preparation without claiming a successful export',async()=>{vi.mocked(printTablePdf).mockRejectedValueOnce(Error('Print unavailable'));await act(async()=>root.render(<Table rowKey="id" columns={[{title:'Name',dataIndex:'name'}]} dataSource={[{id:1,name:'Row'}]}/>));await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Export PDF')!.click());expect(host.textContent).toContain('Print unavailable');});
