// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {CertificateSheet} from './CertificateSheet';
import {CERTIFICATE_DESIGNS, certificateDesign} from './CertificateDesigns';
import {printCertificate} from './printCertificate';

const record={schoolName:'In-memory school',schoolAddress:'Address',headerTitle:'Certificate',certificateNo:'memory-1',issueDate:'2026-11-05',bodyContent:'Approved wording <script>example</script>',footerLeft:'Authorised signatory',status:'void',voidReason:'Correction'};

it('renders all ten designs and retains void markings',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  expect(new Set(CERTIFICATE_DESIGNS.map(d=>d.id)).size).toBe(10);
  expect(certificateDesign('invalid').id).toBe('academic_blue');
  for(const design of CERTIFICATE_DESIGNS){
   await act(async()=>root.render(<CertificateSheet record={record} design={design}/>));
   const article=host.querySelector('article');
   expect(article).toBeTruthy();
   expect(article!.textContent).toContain(record.bodyContent);
   expect(article!.textContent).toContain('VOID');
   expect(article!.querySelector('script')).toBeNull();
   expect(design.colors.primary).toMatch(/^#[0-9a-f]{6}$/i);
   expect(['ornate','minimal','modern','classic','elegant']).toContain(design.layout.borderStyle);
  }
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('prints only the certificate in an isolated document using the selected design',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const create=document.createElement.bind(document);let frame:HTMLIFrameElement|undefined;const print=vi.fn();
 const spy=vi.spyOn(document,'createElement').mockImplementation(((tag:string)=>{const element=create(tag);if(tag==='iframe'){frame=element as HTMLIFrameElement;queueMicrotask(()=>{if(frame?.contentWindow){frame.contentWindow.print=print;frame.contentWindow.focus=vi.fn();}});}return element;}) as any);
 try{await act(async()=>printCertificate(record,CERTIFICATE_DESIGNS[0]));expect(print).toHaveBeenCalledOnce();expect(frame?.contentDocument?.querySelector('article')).toBeTruthy();expect(frame?.contentDocument?.body.textContent).toContain(record.bodyContent);await act(async()=>frame?.contentWindow?.dispatchEvent(new Event('afterprint')));expect(frame?.isConnected).toBe(false);}finally{spy.mockRestore();frame?.remove();}
});

it('rejects an empty certificate rather than opening a blank print dialog',async()=>{await expect(printCertificate({...record,bodyContent:' '},CERTIFICATE_DESIGNS[0])).rejects.toThrow('wording');});

it('reports a browser that cannot create a print document and cleans up the frame',async()=>{
 const create=document.createElement.bind(document);let frame:HTMLIFrameElement|undefined;
 const spy=vi.spyOn(document,'createElement').mockImplementation(((tag:string)=>{const element=create(tag);if(tag==='iframe'){frame=element as HTMLIFrameElement;Object.defineProperty(frame,'contentDocument',{value:null});}return element;}) as any);
 try{await expect(printCertificate(record,CERTIFICATE_DESIGNS[0])).rejects.toThrow('could not open');expect(frame?.isConnected).toBe(false);}finally{spy.mockRestore();frame?.remove();}
});

it('embeds the school logo as an inline data image when a logo URL is provided',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const create=document.createElement.bind(document);let frame:HTMLIFrameElement|undefined;const print=vi.fn();
 const spy=vi.spyOn(document,'createElement').mockImplementation(((tag:string)=>{const element=create(tag);if(tag==='iframe'){frame=element as HTMLIFrameElement;queueMicrotask(()=>{if(frame?.contentWindow){frame.contentWindow.print=print;frame.contentWindow.focus=vi.fn();}});}return element;}) as any);
 const fetchSpy=vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,blob:async()=>new Blob(['logo-bytes'],{type:'image/png'})} as any);
 try{
  await act(async()=>printCertificate(record,CERTIFICATE_DESIGNS[0],{logo:'/api/admin/school/logo'}));
  const img=frame?.contentDocument?.querySelector('img');
  expect(img).toBeTruthy();
  expect((img as HTMLImageElement).src.startsWith('data:')).toBe(true);
 }finally{fetchSpy.mockRestore();spy.mockRestore();frame?.remove();}
});

it('prints without a logo when the logo fetch fails',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const create=document.createElement.bind(document);let frame:HTMLIFrameElement|undefined;const print=vi.fn();
 const spy=vi.spyOn(document,'createElement').mockImplementation(((tag:string)=>{const element=create(tag);if(tag==='iframe'){frame=element as HTMLIFrameElement;queueMicrotask(()=>{if(frame?.contentWindow){frame.contentWindow.print=print;frame.contentWindow.focus=vi.fn();}});}return element;}) as any);
 const fetchSpy=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('network down'));
 try{
  await act(async()=>printCertificate(record,CERTIFICATE_DESIGNS[0],{logo:'/api/admin/school/logo'}));
  expect(frame?.contentDocument?.querySelector('img')).toBeNull();
  expect(print).toHaveBeenCalledOnce();
 }finally{fetchSpy.mockRestore();spy.mockRestore();frame?.remove();}
});

it('prints without a logo when the logo request is not ok',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const create=document.createElement.bind(document);let frame:HTMLIFrameElement|undefined;const print=vi.fn();
 const spy=vi.spyOn(document,'createElement').mockImplementation(((tag:string)=>{const element=create(tag);if(tag==='iframe'){frame=element as HTMLIFrameElement;queueMicrotask(()=>{if(frame?.contentWindow){frame.contentWindow.print=print;frame.contentWindow.focus=vi.fn();}});}return element;}) as any);
 const fetchSpy=vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:false,blob:async()=>new Blob([],'image/png')} as any);
 try{
  await act(async()=>printCertificate(record,CERTIFICATE_DESIGNS[0],{logo:'/api/admin/school/logo'}));
  expect(frame?.contentDocument?.querySelector('img')).toBeNull();
 }finally{fetchSpy.mockRestore();spy.mockRestore();frame?.remove();}
});

it('replaces a previous print document rather than leaving certificate data in the page',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;const create=document.createElement.bind(document);const frames:HTMLIFrameElement[]=[];
 const spy=vi.spyOn(document,'createElement').mockImplementation(((tag:string)=>{const element=create(tag);if(tag==='iframe'){const f=element as HTMLIFrameElement;frames.push(f);queueMicrotask(()=>{if(f.contentWindow){f.contentWindow.print=vi.fn();f.contentWindow.focus=vi.fn();}});}return element;}) as any);
 try{
  await act(async()=>printCertificate(record,CERTIFICATE_DESIGNS[0]));
  await act(async()=>printCertificate(record,CERTIFICATE_DESIGNS[1]));
  expect(frames[0].isConnected).toBe(false);
  expect(frames[1].contentDocument?.querySelector('article')).toBeTruthy();
  await act(async()=>frames[1].contentWindow?.dispatchEvent(new Event('afterprint')));
  expect(frames[1].isConnected).toBe(false);
 }finally{spy.mockRestore();frames.forEach(frame=>frame.remove());}
});
