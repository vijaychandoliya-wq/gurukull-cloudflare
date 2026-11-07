// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {disposeIdCardPrint,printIdCards} from './printIdCards';
afterEach(()=>{disposeIdCardPrint();document.body.innerHTML='';vi.restoreAllMocks();});
it('creates separate print pages with eight complete cards per page and cleans up',async()=>{
 const sheet=document.createElement('div');sheet.innerHTML=Array.from({length:10},(_,i)=>`<article class="gk-id-card"><header>Card ${i+1}</header></article>`).join('');document.body.append(sheet);
 const original=document.body.append.bind(document.body);vi.spyOn(document.body,'append').mockImplementation((...nodes)=>{original(...nodes);const frame=nodes.find(n=>n instanceof HTMLIFrameElement) as HTMLIFrameElement|undefined;if(frame?.contentWindow){frame.contentWindow.focus=vi.fn();frame.contentWindow.print=vi.fn();}});
 await printIdCards(sheet);const frame=document.querySelector('iframe')!;const pages=frame.contentDocument!.querySelectorAll('.gk-id-print-page');expect(pages).toHaveLength(2);expect(pages[0].querySelectorAll('.gk-id-card')).toHaveLength(8);expect(pages[1].querySelectorAll('.gk-id-card')).toHaveLength(2);expect(pages[0].textContent).toContain('Card 1');expect(frame.contentWindow!.print).toHaveBeenCalledOnce();frame.contentWindow!.dispatchEvent(new Event('afterprint'));expect(document.querySelector('iframe')).toBeNull();
});
it('refuses an empty card selection',async()=>{await expect(printIdCards(document.createElement('div'))).rejects.toThrow('Select at least one card');});
