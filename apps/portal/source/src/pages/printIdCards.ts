let cleanupCurrent:(()=>void)|undefined;
export function disposeIdCardPrint(){cleanupCurrent?.();}

/** Print outside the scrollable modal so its position and clipping cannot cut cards. */
export async function printIdCards(sheet:HTMLElement){
 disposeIdCardPrint();
 const cards=Array.from(sheet.querySelectorAll<HTMLElement>('.gk-id-card'));
 if(!cards.length)throw Error('Select at least one card before printing.');
 const frame=document.createElement('iframe');frame.title='ID card print document';frame.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0';document.body.append(frame);
 const doc=frame.contentDocument,win=frame.contentWindow;
 if(!doc||!win){frame.remove();throw Error('The browser could not open the print document.');}
 let disposed=false;const cleanup=()=>{if(disposed)return;disposed=true;frame.remove();if(cleanupCurrent===cleanup)cleanupCurrent=undefined;};cleanupCurrent=cleanup;
 win.addEventListener('afterprint',cleanup,{once:true});
 try{
  doc.title='ID cards';doc.documentElement.lang=document.documentElement.lang;doc.documentElement.dir=document.documentElement.dir;
  const pendingStyles:Promise<void>[]=[];
  document.querySelectorAll('style,link[rel="stylesheet"]').forEach(node=>{const clone=node.cloneNode(true) as HTMLElement;if(clone.tagName==='LINK')pendingStyles.push(new Promise((resolve,reject)=>{clone.addEventListener('load',()=>resolve(),{once:true});clone.addEventListener('error',()=>reject(Error('The print styles could not be loaded. Please try again.')),{once:true});}));doc.head.append(clone);});
  const style=doc.createElement('style');style.textContent=`@page{size:A4 portrait;margin:8mm} @media print {html,body{margin:0!important;background:#fff!important} body *{visibility:visible!important} .gk-id-print-sheet{position:static!important;width:auto!important;display:block!important;padding:0!important} .gk-id-print-page{display:grid;grid-template-columns:repeat(2,85.6mm);grid-auto-rows:54mm;justify-content:center;gap:4mm;break-after:page;page-break-after:always} .gk-id-print-page:last-child{break-after:auto;page-break-after:auto} .gk-id-card{box-sizing:border-box;break-after:auto!important;page-break-after:auto!important} }`;
  doc.head.append(style);const container=doc.createElement('div');container.className='gk-id-print-sheet';
  for(let i=0;i<cards.length;i+=8){const page=doc.createElement('div');page.className='gk-id-print-page';cards.slice(i,i+8).forEach(card=>page.append(card.cloneNode(true)));container.append(page);}doc.body.append(container);
  await Promise.all(pendingStyles);await doc.fonts?.ready;await Promise.all(Array.from(doc.images).map(img=>img.decode?.().catch(()=>undefined)));if(!frame.isConnected)throw Error('Printing was cancelled.');win.focus();win.print();
 }catch(e){cleanup();throw e;}
}
