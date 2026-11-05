import React from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {CertificateSheet,certificateCSS,type CertificateDesign} from './CertificateSheet';
let dispose:(()=>void)|undefined;
export function disposeCertificatePrint(){dispose?.();}
/** A separate same-origin document avoids the portal's ID-card print rules. */
export async function printCertificate(record:any,design:CertificateDesign){
 if(!record.bodyContent?.trim())throw Error('Add the school-approved certificate wording before printing.');
 dispose?.();
 const frame=document.createElement('iframe');frame.title='Certificate print document';frame.style.cssText='position:fixed;width:1px;height:1px;left:-10000px;border:0';document.body.append(frame);
 const doc=frame.contentDocument,win=frame.contentWindow;
 if(!doc||!win){frame.remove();throw Error('The browser could not open the print document.');}
 doc.documentElement.lang=document.documentElement.lang;doc.documentElement.dir=document.documentElement.dir;doc.title='Certificate '+String(record.certificateNo||'');
 const style=doc.createElement('style');style.textContent=certificateCSS;doc.head.append(style);
 const mount=doc.createElement('div');doc.body.append(mount);const root=createRoot(mount);
 let disposed=false;
 const cleanup=()=>{if(disposed)return;disposed=true;root.unmount();frame.remove();if(dispose===cleanup)dispose=undefined;};dispose=cleanup;
 win.addEventListener('afterprint',cleanup,{once:true});
 try{flushSync(()=>root.render(<CertificateSheet record={record} design={design}/>));await doc.fonts?.ready;if(!frame.isConnected)throw Error('Printing cancelled because the certificate page was closed.');win.focus();win.print();}catch(error){cleanup();throw error;}
}
