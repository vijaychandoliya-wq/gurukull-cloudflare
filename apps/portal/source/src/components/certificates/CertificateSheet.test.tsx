// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {CertificateSheet,CERTIFICATE_DESIGNS,certificateDesign} from './CertificateSheet';
import {printCertificate} from './printCertificate';
const record={schoolName:'In-memory school',schoolAddress:'Address',headerTitle:'Certificate',certificateNo:'memory-1',issueDate:'2026-11-05',bodyContent:'Approved wording <script>example</script>',footerLeft:'Authorised signatory',status:'void',voidReason:'Correction'};
it('renders all ten designs without changing issued wording and retains void markings',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{expect(new Set(CERTIFICATE_DESIGNS.map(d=>d.id)).size).toBe(10);for(const design of CERTIFICATE_DESIGNS){await act(async()=>root.render(<CertificateSheet record={record} design={design}/>));expect(host.querySelector('article')?.dataset.design).toBe(design.id);expect(host.textContent).toContain(record.bodyContent);expect(host.textContent).toContain('VOID — Correction');expect(host.querySelector('script')).toBeNull();}expect(certificateDesign('invalid').id).toBe('classic');}finally{await act(async()=>root.unmount());host.remove();}
});
it('prints only the certificate in an isolated document using the selected design',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const create=document.createElement.bind(document);let frame:HTMLIFrameElement|undefined;const print=vi.fn();
 const spy=vi.spyOn(document,'createElement').mockImplementation(((tag:string,options?:ElementCreationOptions)=>{const element=create(tag,options);if(tag==='iframe'){frame=element as HTMLIFrameElement;queueMicrotask(()=>{if(frame?.contentWindow){frame.contentWindow.print=print;frame.contentWindow.focus=vi.fn();}});}return element;}) as any);
 try{await act(async()=>printCertificate(record,CERTIFICATE_DESIGNS[6]));expect(print).toHaveBeenCalledOnce();expect(frame?.contentDocument?.querySelector('article')?.dataset.design).toBe('modern');expect(frame?.contentDocument?.body.textContent).toContain(record.bodyContent);expect(frame?.contentDocument?.querySelector('.gk-shell')).toBeNull();await act(async()=>frame?.contentWindow?.dispatchEvent(new Event('afterprint')));expect(frame?.isConnected).toBe(false);}finally{spy.mockRestore();frame?.remove();}
});
it('rejects an empty certificate rather than opening a blank print dialog',async()=>{await expect(printCertificate({...record,bodyContent:' '},CERTIFICATE_DESIGNS[0])).rejects.toThrow('wording');});
it('reports a browser that cannot create a print document and cleans up the frame',async()=>{
 const create=document.createElement.bind(document);let frame:HTMLIFrameElement|undefined;
 const spy=vi.spyOn(document,'createElement').mockImplementation(((tag:string,options?:ElementCreationOptions)=>{const element=create(tag,options);if(tag==='iframe'){frame=element as HTMLIFrameElement;Object.defineProperty(frame,'contentDocument',{value:null});}return element;}) as any);
 try{await expect(printCertificate(record,CERTIFICATE_DESIGNS[0])).rejects.toThrow('could not open');expect(frame?.isConnected).toBe(false);}finally{spy.mockRestore();frame?.remove();}
});
it('replaces a previous print document rather than leaving certificate data in the page',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;const create=document.createElement.bind(document);const frames:HTMLIFrameElement[]=[];
 const spy=vi.spyOn(document,'createElement').mockImplementation(((tag:string,options?:ElementCreationOptions)=>{const element=create(tag,options);if(tag==='iframe'){const frame=element as HTMLIFrameElement;frames.push(frame);queueMicrotask(()=>{if(frame.contentWindow){frame.contentWindow.print=vi.fn();frame.contentWindow.focus=vi.fn();}});}return element;}) as any);
 try{await act(async()=>printCertificate(record,CERTIFICATE_DESIGNS[0]));await act(async()=>printCertificate(record,CERTIFICATE_DESIGNS[1]));expect(frames[0].isConnected).toBe(false);expect(frames[1].contentDocument?.querySelector('article')?.dataset.design).toBe('gold');await act(async()=>frames[1].contentWindow?.dispatchEvent(new Event('afterprint')));expect(frames[1].isConnected).toBe(false);}finally{spy.mockRestore();frames.forEach(frame=>frame.remove());}
});
