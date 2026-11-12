// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Table} from './ExportTable';
import {apiClient} from '../../services/api';
import {attachExportSource} from './exportSource';
vi.mock('../../services/api',()=>({apiClient:{get:vi.fn(),post:vi.fn(),getUri:(c:any)=>c.url}}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(window,'matchMedia',{writable:true,value:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();});
const click=async(text:string)=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent===text)!;expect(button).toBeTruthy();await act(async()=>button.click());};
it('requests all database rows from the backend and never sends displayed row values',async()=>{
 const response:any={config:{method:'get',url:'/api/admin/students?q=preserved&page=8&per_page=10'},data:{data:[{id:'record',name:'Visible record'}]}};attachExportSource(response,apiClient);vi.mocked(apiClient.post).mockResolvedValue({data:{data:{id:'export',status:'ready',format:'pdf',title:'Students',total:2400,done:2400,files:8}}});
 await act(async()=>root.render(<Table rowKey="id" columns={[{title:'Name',dataIndex:'name'}]} dataSource={response.data.data}/>));await click('Export all records');const [url,body,config]=vi.mocked(apiClient.post).mock.calls[0];expect(url).toBe('/api/exports');expect(body).toMatchObject({format:'pdf',source:{path:'/api/admin/students',query:{q:'preserved'},arrayPath:['data']}});expect(JSON.stringify(body)).not.toContain('Visible record');expect(config?.headers?.['Idempotency-Key']).toBeTruthy();expect(document.body.textContent).toContain('2400 / 2400');expect(document.body.textContent).toContain('Download 8 PDFs (ZIP)');
});
it('does not fall back to exporting a frontend-only preview',async()=>{await act(async()=>root.render(<Table columns={[{title:'Name',dataIndex:'name'}]} dataSource={[]}/>));const button=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Export all records')!;expect(button.disabled).toBe(true);expect(host.textContent).toContain('no saved-record export source');expect(apiClient.post).not.toHaveBeenCalled();});
it('follows source metadata through row mapping without placing it in JSON',()=>{
 const response:any={config:{method:'get',url:'/api/admin/students'},data:{data:[{id:'one',parents:[{id:'parent'}]}]}};attachExportSource(response,apiClient);expect(JSON.stringify(response.data)).toBe('{"data":[{"id":"one","parents":[{"id":"parent"}]}]}');
});
