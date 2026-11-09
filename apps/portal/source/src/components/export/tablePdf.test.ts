// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {snapshotTable,printTablePdf,disposeTablePdf} from './tablePdf';
afterEach(()=>{disposeTablePdf();document.body.innerHTML='';vi.restoreAllMocks();});
it('exports visible data columns and excludes selection and actions without changing source rows',()=>{
 const root=document.createElement('div');root.innerHTML='<table><thead><tr><th class="ant-table-selection-column"><input type="checkbox"></th><th>Name</th><th>Balance</th><th>Actions</th></tr></thead><tbody><tr><td><input type="checkbox"></td><td>Long नाम &amp; name</td><td>₹1,234.00</td><td><button>Edit</button></td></tr></tbody></table>';const original=root.innerHTML;
 expect(snapshotTable(root)).toEqual({headers:['Name','Balance'],rows:[['Long नाम & name','₹1,234.00']]});expect(root.innerHTML).toBe(original);
});
it('flattens grouped headers and retains values from row-spanned cells',()=>{
 const root=document.createElement('div');root.innerHTML='<table><thead><tr><th rowspan="2">Class</th><th colspan="2">Student</th></tr><tr><th>Name</th><th>Number</th></tr></thead><tbody><tr><td rowspan="2">A</td><td>One</td><td>1</td></tr><tr><td>Two</td><td>2</td></tr></tbody></table>';
 expect(snapshotTable(root)).toEqual({headers:['Class','Student / Name','Student / Number'],rows:[['A','One','1'],['A','Two','2']]});
});
it('rejects empty tables rather than presenting a successful empty export',()=>{
 const root=document.createElement('div');root.innerHTML='<table><thead><tr><th>Name</th></tr></thead><tbody><tr class="ant-table-placeholder"><td>No data</td></tr></tbody></table>';expect(()=>snapshotTable(root)).toThrow('no loaded rows');
});
it('prints a standalone landscape document with repeating headers, safe text and numeric alignment',async()=>{
 const print=vi.fn(),append=document.body.append.bind(document.body);vi.spyOn(document.body,'append').mockImplementation((...nodes)=>{append(...nodes);nodes.forEach(n=>{if(n instanceof HTMLIFrameElement){n.contentWindow!.print=print;n.contentWindow!.focus=vi.fn();}});});
 await printTablePdf({headers:['Name','A','B','C','D','E','Amount'],rows:[['<script>text</script>','1','2','3','4','5','₹1,000.00']]},'School ledger','School');
 const frame=document.querySelector('iframe')!,doc=frame.contentDocument!;expect(print).toHaveBeenCalledOnce();expect(doc.head.textContent).toContain('A4 landscape');expect(doc.head.textContent).toContain('table-header-group');expect(doc.querySelector('script')).toBeNull();expect(doc.body.textContent).toContain('<script>text</script>');expect(doc.querySelector('td.numeric')?.textContent).toBe('1');expect(doc.body.textContent).toContain('Current loaded rows: 1');frame.contentWindow!.dispatchEvent(new Event('afterprint'));expect(document.querySelector('iframe')).toBeNull();
});
