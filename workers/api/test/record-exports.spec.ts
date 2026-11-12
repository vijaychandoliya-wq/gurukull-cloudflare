import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {expect,it} from 'vitest';
import {unpageSelect,validExportSource,sourceRows} from '../src/exports/read-source.js';
import {snapshotRecords,csvSnapshot,pdfSnapshot,xlsxSnapshot} from '../src/exports/document.js';
import {zipFiles} from '../src/exports/zip.js';
import app from '../src/index.js';
it('exports every matching numeric test row beyond both UI pagination and 10,000 offsets',()=>{
 const database=new DatabaseSync(':memory:');try{database.exec('CREATE TABLE numeric_boundary(owner TEXT,n INTEGER); WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<20041) INSERT INTO numeric_boundary SELECT CASE WHEN x%2=0 THEN \'other\' ELSE \'owner\' END,x FROM n;');
 const input="SELECT n,(SELECT n FROM numeric_boundary WHERE owner=? ORDER BY n LIMIT 1) AS first FROM numeric_boundary WHERE owner=? ORDER BY n LIMIT ? OFFSET ?",plan=unpageSelect(input);expect(plan.keepParameters).toBe(2);const rows=database.prepare(plan.sql).all('owner','owner');expect(rows).toHaveLength(10021);expect(rows.at(-1)?.n).toBe(20041);expect(rows.every(row=>row.first===1)).toBe(true);
 }finally{database.close();}
});
it('preserves nested limits and skips literal/comment tokens and parameters',()=>{
 const sql="SELECT '?' AS label,(SELECT 1 LIMIT 1) AS nested FROM t WHERE owner=? /* LIMIT ? */ AND v='LIMIT ?' ORDER BY id LIMIT 20 OFFSET ?";const result=unpageSelect(sql);expect(result.keepParameters).toBe(1);expect(result.sql).toContain('(SELECT 1 LIMIT 1)');expect(result.sql).toContain("v='LIMIT ?'");expect(result.sql).toMatch(/ORDER BY id$/);expect(()=>unpageSelect('DELETE FROM t')).toThrow('READ_ONLY');expect(()=>unpageSelect("SELECT 'broken")).toThrow('PARSE_FAILED');
});
it('allows reviewed record sources but rejects secrets, arbitrary hosts, traversal and recursive exports',()=>{
 for(const path of ['/api/admin/students','/api/admin/academic-years','/api/admin/library','/api/admin/fees/receipts','/api/admin/exam-schedules/one/marks','/platform/v1/schools'])expect(validExportSource(path),path).toBe(true);
 for(const path of ['https://other/api/admin/users','/api/admin/users?all=1','/api/admin/../sessions','/api/admin/teachers/x/password','/api/exports','/api/admin/fees/reports/export','/api/admin/users%2fpassword'])expect(validExportSource(path),path).toBe(false);
 expect(()=>sourceRows({data:[]},['__proto__'])).toThrow();expect(sourceRows({data:{items:[{n:1}]}},['data','items'])).toEqual([{n:1}]);
});
it('creates a complete server snapshot and protects CSV without exporting password fields',()=>{
 const snapshot=snapshotRecords([{id:1,name:'=SUM(1,2)',password_hash:'never export',amountMinor:123},{id:2,name:'Second',amountMinor:456}],{title:'Records',school:'School',capturedAt:'2026-11-09',source:'/api/admin/students'});expect(snapshot.rows).toHaveLength(2);const csv=csvSnapshot(snapshot);expect(csv).toContain("'=SUM(1,2)");expect(csv).toContain('Second');expect(csv).not.toContain('never export');expect(snapshot.headers.join()).toContain('minor currency units');
});
it('migrates export-job schema without adding any school or business records',()=>{
 const database=new DatabaseSync(':memory:');try{const dir=new URL('../../../migrations/',import.meta.url);for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')&&n!=='0037_record_exports.sql').sort())database.exec(readFileSync(new URL(name,dir),'utf8'));const before=database.prepare('SELECT COUNT(*) AS n FROM schools').get()?.n;database.exec(readFileSync(new URL('0037_record_exports.sql',dir),'utf8'));expect(database.prepare('SELECT COUNT(*) AS n FROM record_exports').get()?.n).toBe(0);expect(database.prepare('SELECT COUNT(*) AS n FROM schools').get()?.n).toBe(before);}finally{database.close();}
});
it('does not expose export creation, history, processing or downloads without authentication',async()=>{
 for(const [path,method]of [['/api/exports','POST'],['/api/exports','GET'],['/api/exports/job/continue','POST'],['/api/exports/job/download','GET']])expect((await app.request(path,{method})).status).toBe(401);
});
it('streams ZIP parts in order without opening later objects prematurely',async()=>{
 const calls:string[]=[],files=['one.pdf','two.pdf'].map(name=>({name,open:async()=>{calls.push(name);return new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode(name));c.close();}});}}));const stream=zipFiles(files);expect(calls).toEqual([]);const bytes=new Uint8Array(await new Response(stream).arrayBuffer());expect(calls).toEqual(['one.pdf','two.pdf']);expect(new DataView(bytes.buffer).getUint32(0,true)).toBe(0x04034b50);expect(new DataView(bytes.buffer).getUint32(bytes.length-22,true)).toBe(0x06054b50);
});
it('generates a real multipage PDF from the complete server snapshot with long cells',async()=>{
 const rows=Array.from({length:35},(_,n)=>({number:n+1,name:n===0?'हिन्दी पाठ':n===1?'தமிழ் உரை':n===2?'اردو':'Record boundary '+n,detail:'Long aligned cell content '.repeat(80)})),snapshot=snapshotRecords(rows,{title:'Export alignment verification',school:'Boundary values only',capturedAt:'2026-11-09',source:'unit boundary'}),bytes=await pdfSnapshot(snapshot,0,rows.length,async family=>new Uint8Array(readFileSync(new URL('../../../apps/portal/source/public/export-fonts/'+family+'.ttf',import.meta.url))));expect(new TextDecoder().decode(bytes.slice(0,8))).toBe('%PDF-1.7');const {PDFDocument}=await import('pdf-lib');const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBeGreaterThan(1);expect(snapshot.rows).toHaveLength(35);
},20000);
it('generates a valid single-part Excel workbook from the complete server snapshot with numeric typing',async()=>{
 const rows=[{id:'one',fullName:'Sharma "Vinod"',amountMinor:123450},{id:'two',fullName:'New line',amountMinor:750}],snapshot=snapshotRecords(rows,{title:'Excel records',school:'School',capturedAt:'2026-11-09',source:'/api/admin/students'});
 const archive=Buffer.from(await xlsxSnapshot(snapshot,0,rows.length)).toString('latin1');
 expect(archive.slice(0,2)).toBe('PK');expect(archive).toContain('xl/worksheets/sheet1.xml');
 // amountMinor is the numeric-typed column: written as a real number, headers as styled strings.
 expect(archive).toContain('<c r="C2" t="n"><v>123450</v></c>');expect(archive).toContain('<c r="C3" t="n"><v>750</v></c>');
 // secrets stay out; text is XML-escaped.
 expect(archive).toContain('Sharma &quot;Vinod&quot;');expect(snapshot.headers.join()).not.toContain('password');
},10000);
