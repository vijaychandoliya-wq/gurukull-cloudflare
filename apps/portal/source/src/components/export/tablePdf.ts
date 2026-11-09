export type TableSnapshot={headers:string[];rows:string[][]};
let activeFrame:HTMLIFrameElement|undefined;
export function disposeTablePdf(){activeFrame?.remove();activeFrame=undefined;}
function text(cell:Element){const copy=cell.cloneNode(true) as Element;copy.querySelectorAll('svg,img,input,.ant-avatar,.gk-avatar,.ant-table-column-sorter,.ant-table-filter-trigger').forEach(n=>n.remove());return (copy.textContent||'').replace(/\s+/g,' ').trim();}
function grid(rows:HTMLTableRowElement[]){
 const result:string[][]=[];
 rows.forEach((row,r)=>{result[r]??=[];let col=0;Array.from(row.cells).forEach(cell=>{while(result[r][col]!==undefined)col++;const value=text(cell);for(let y=0;y<Math.min(cell.rowSpan||1,rows.length-r);y++){result[r+y]??=[];for(let x=0;x<(cell.colSpan||1);x++)result[r+y][col+x]=value;}col+=cell.colSpan||1;});});return result;
}
export function snapshotTable(root:HTMLElement):TableSnapshot{
 const table=root.querySelector<HTMLTableElement>('.ant-table-body table')||root.querySelector<HTMLTableElement>('.ant-table-content table')||root.querySelector<HTMLTableElement>('table');
 if(!table)throw Error('The table is not available. Wait for it to load and try again.');
 const head=root.querySelector('thead'),headerRows=head?Array.from(head.querySelectorAll('tr')):[],heads=grid(headerRows);
 const width=Math.max(0,...heads.map(r=>r.length));
 const headers=Array.from({length:width},(_,i)=>Array.from(new Set(heads.map(row=>row[i]).filter(Boolean))).join(' / '));
 const bodyRows=Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody > tr')).filter(row=>!row.matches('.ant-table-measure-row,.ant-table-placeholder,.ant-table-expanded-row'));
 const rows=grid(bodyRows),cols=headers.map((label,i)=>({label,i})).filter(({label,i})=>label&&!/^(actions?|select|selection)$/i.test(label)&&!headerRows.some(row=>row.cells[i]?.matches('.ant-table-selection-column,.ant-table-row-expand-icon-cell')));
 if(!rows.length)throw Error('There are no loaded rows to export.');
 if(!cols.length)throw Error('This table has no labelled data columns to export.');
 return {headers:cols.map(c=>c.label),rows:rows.map(row=>cols.map(c=>row[c.i]||'—'))};
}
export async function printTablePdf(snapshot:TableSnapshot,title:string,school:string){
 disposeTablePdf();const frame=document.createElement('iframe');frame.title='Table PDF export';frame.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0';document.body.append(frame);activeFrame=frame;
 try{const doc=frame.contentDocument,win=frame.contentWindow;if(!doc||!win)throw Error('The browser could not prepare the PDF.');
 doc.title=title;doc.documentElement.lang=document.documentElement.lang;doc.documentElement.dir=document.documentElement.dir;
 const style=doc.createElement('style');style.textContent=`@page{size:${snapshot.headers.length>12?'A3 landscape':snapshot.headers.length>6?'A4 landscape':'A4 portrait'};margin:12mm}*{box-sizing:border-box}body{margin:0;color:#111;background:#fff;font:9pt/1.45 Arial,sans-serif}h1{font-size:17pt;margin:0 0 4mm}p{margin:0 0 3mm}table{width:100%;table-layout:fixed;border-collapse:collapse}thead{display:table-header-group}th,td{border:1px solid #aaa;padding:2mm;vertical-align:top;overflow-wrap:anywhere;white-space:normal}th{font-weight:bold;background:#eee;text-align:start}tr{break-inside:avoid}td.numeric{text-align:right;font-variant-numeric:tabular-nums}.meta{font-size:8pt;color:#444;margin-bottom:5mm}`;doc.head.append(style);
 const add=(tag:string,value:string,parent:HTMLElement=doc.body)=>{const el=doc.createElement(tag);el.textContent=value;parent.append(el);return el;};
 add('h1',title);if(school)add('p',school);add('p',`Current loaded rows: ${snapshot.rows.length} · Exported ${new Date().toLocaleString()}`).className='meta';
 const table=doc.createElement('table'),head=doc.createElement('thead'),headRow=doc.createElement('tr');head.append(headRow);snapshot.headers.forEach(h=>add('th',h,headRow));table.append(head);const body=doc.createElement('tbody');
 snapshot.rows.forEach(values=>{const row=doc.createElement('tr');values.forEach(value=>{const cell=add('td',value,row);if(/^[₹$€£]?\s*-?[\d,]+(?:\.\d+)?%?$/.test(value))cell.className='numeric';});body.append(row);});table.append(body);doc.body.append(table);
 win.addEventListener('afterprint',()=>{frame.remove();if(activeFrame===frame)activeFrame=undefined;},{once:true});await doc.fonts?.ready;if(!frame.isConnected)return;win.focus();win.print();
 }catch(e){frame.remove();if(activeFrame===frame)activeFrame=undefined;throw e;}
}
