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
it('opens the export history and restores a previous job',async()=>{
 const response:any={config:{method:'get',url:'/api/admin/students'},data:{data:[{id:'record',name:'Row'}]}};attachExportSource(response,apiClient);
 vi.mocked(apiClient.post).mockResolvedValue({data:{data:{id:'new',status:'ready',format:'csv',title:'Students',total:10,done:10,files:1,error:'EXPORT_UNSUPPORTED_GLYPH'}}});
 vi.mocked(apiClient.get).mockResolvedValue({data:{data:[{id:'old1',title:'Teachers',status:'ready',format:'pdf',total:30,done:30,files:2}]}});
 await act(async()=>root.render(<Table rowKey="id" columns={[{title:'Name',dataIndex:'name'}]} dataSource={response.data.data}/>));
 await click('Export all records');
 await act(async()=>{(document.querySelector('.ant-modal-close') as HTMLElement|null)?.click();});
 await click('My exports');
 expect(document.body.textContent).toContain('Teachers · ready · 30 records');
});
it('shows server-provided export failure details',async()=>{
 const response:any={config:{method:'get',url:'/api/admin/students'},data:{data:[{id:'record',name:'Row'}]}};attachExportSource(response,apiClient);
 vi.mocked(apiClient.post).mockResolvedValue({data:{data:{id:'failed',status:'failed',format:'pdf',title:'Students',total:10,done:0,files:0,error:'EXPORT_UNSUPPORTED_GLYPH'}}});
 await act(async()=>root.render(<Table rowKey="id" columns={[{title:'Name',dataIndex:'name'}]} dataSource={response.data.data}/>));
 await click('Export all records');
 expect(document.body.textContent).toContain('The PDF font cannot render a character in these records');
});
it('reports a failed export request and allows retry',async()=>{
 const response:any={config:{method:'get',url:'/api/admin/students'},data:{data:[{id:'record',name:'Row'}]}};attachExportSource(response,apiClient);
 const error=new Error('busy');(error as any).response={status:500,data:{error:'EXPORT_JOBS_BUSY'}};
 vi.mocked(apiClient.post).mockRejectedValue(error);
 await act(async()=>root.render(<Table rowKey="id" columns={[{title:'Name',dataIndex:'name'}]} dataSource={response.data.data}/>));
 await click('Export all records');
 expect(document.body.textContent).toContain('Three exports are already being prepared');
 expect(document.body.textContent).toContain('Retry export request');
});
it('downloads a ready export as a blob',async()=>{
 const response:any={config:{method:'get',url:'/api/admin/students'},data:{data:[{id:'record',name:'Row'}]}};attachExportSource(response,apiClient);
 vi.mocked(apiClient.post).mockResolvedValue({data:{data:{id:'dl',status:'ready',format:'xlsx',title:'Students',total:5,done:5,files:1}}});
 vi.mocked(apiClient.get).mockResolvedValue({data:new Blob(['x'])});
 const clickSpy=vi.fn();let lastAnchor:HTMLAnchorElement|undefined;
 const originalCreate=document.createElement.bind(document);
 vi.spyOn(document,'createElement').mockImplementation((tag:string,...rest:any[])=>{const el=originalCreate(tag,...rest);if(tag==='a'){(el as HTMLAnchorElement).click=clickSpy;lastAnchor=el as HTMLAnchorElement;}return el;});
 vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:fake');
 const revoke=vi.spyOn(URL,'revokeObjectURL');
 await act(async()=>root.render(<Table rowKey="id" columns={[{title:'Name',dataIndex:'name'}]} dataSource={response.data.data}/>));
 await click('Export all records');
 await click('Download Excel file');
 expect(clickSpy).toHaveBeenCalled();
 expect(lastAnchor?.download).toBe('dl.xlsx');
 await new Promise(r=>setTimeout(r,1050));
 expect(revoke).toHaveBeenCalledWith('blob:fake');
});
