// Required by fontkit's Indic shaping state machine.
import 'regenerator-runtime/runtime.js';
import {PDFDocument,rgb,type PDFFont,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {zipFiles} from './zip.js';
export type ExportSnapshot={title:string;school:string;capturedAt:string;source:string;headers:string[];rows:string[][];numeric:number[]};
const secret=/^(?:password|password_hash|generated_password_hash|token|token_digest|secret|credential_digest|accessKey|access_key|accessKeyValue|rawPassword)$/i;
function value(item:unknown){return item===null||item===undefined?'':typeof item==='object'?JSON.stringify(item,(key,v)=>secret.test(key)?undefined:v):String(item);}
export function snapshotRecords(records:Record<string,unknown>[],meta:Omit<ExportSnapshot,'headers'|'rows'|'numeric'>):ExportSnapshot{
 const keys=Array.from(new Set(records.flatMap(row=>Object.keys(row)))).filter(key=>!secret.test(key));
 if(keys.length>120)throw Error('EXPORT_TOO_MANY_COLUMNS');
 return {...meta,headers:keys.map(key=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ')+( /(?:minor|paise)$/i.test(key)?' (minor currency units)':'')),rows:records.map(row=>keys.map(key=>value(row[key]))),numeric:keys.flatMap((key,i)=>records.every(r=>r[key]==null||typeof r[key]==='number')?[i]:[])};
}
export function csvSnapshot(snapshot:ExportSnapshot){
 const quote=(text:string)=>{let first=0;while(first<text.length&&(text.charCodeAt(first)<=32||/\s/u.test(text[first])))first++;const unsafe=text.charCodeAt(0)===9||text.charCodeAt(0)===13||(first<text.length&&'=+@-'.includes(text[first]));return '"'+(unsafe?"'"+text:text).replaceAll('"','""')+'"';};
 return '\ufeff'+[snapshot.headers.map(quote).join(','),...snapshot.rows.map(row=>row.map(quote).join(','))].join('\r\n');
}
export function fontFamily(char:string){
 const n=char.codePointAt(0)!;if(n>=0x900&&n<=0x97f)return 'notosansdevanagari';if(n>=0x980&&n<=0x9ff)return 'notosansbengali';if(n>=0xa00&&n<=0xa7f)return 'notosansgurmukhi';if(n>=0xa80&&n<=0xaff)return 'notosansgujarati';if(n>=0xb00&&n<=0xb7f)return 'notosansoriya';if(n>=0xb80&&n<=0xbff)return 'notosanstamil';if(n>=0xc00&&n<=0xc7f)return 'notosanstelugu';if(n>=0xc80&&n<=0xcff)return 'notosanskannada';if(n>=0xd00&&n<=0xd7f)return 'notosansmalayalam';if((n>=0x600&&n<=0x8ff)||(n>=0xfb50&&n<=0xfdff)||(n>=0xfe70&&n<=0xfeff))return 'notonaskharabic';if(n>=0x1c50&&n<=0x1c7f)return 'notosansolchiki';if((n>=0xabc0&&n<=0xabff)||(n>=0xaae0&&n<=0xaaff))return 'notosansmeeteimayek';return 'notosans';
}
export async function pdfSnapshot(snapshot:ExportSnapshot,start:number,end:number,loadFont:(name:string)=>Promise<Uint8Array>){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);doc.setTitle(snapshot.title);doc.setAuthor(snapshot.school);const fonts=new Map<string,PDFFont>(),charsets=new Map<PDFFont,Set<number>>();
 const strings=[snapshot.title,snapshot.school,...snapshot.headers,...snapshot.rows.slice(start,end).flat()];const names=new Set(strings.flatMap(text=>Array.from(text,fontFamily)));names.add('notosans');
 for(const name of names){const font=await doc.embedFont(await loadFont(name),{subset:true});fonts.set(name,font);charsets.set(font,new Set(font.getCharacterSet()));}
 const size=8,lineHeight=12,pageWidth=842,pageHeight=595,margin=30;let page:PDFPage|undefined,y=0,pageNumber=0;const activePage=()=>{if(!page)throw Error('EXPORT_PAGE_NOT_INITIALIZED');return page;};
 const runs=(text:string)=>{const out:{text:string;font:PDFFont}[]=[];for(const char of text.replace(/[\r\n\t]/g,' ')){const font=fonts.get(fontFamily(char))!;if(!charsets.get(font)!.has(char.codePointAt(0)!))throw Error('EXPORT_UNSUPPORTED_GLYPH');if(out.at(-1)?.font===font)out[out.length-1].text+=char;else out.push({text:char,font});}return out;};
 const widths=new Map<string,number>();const width=(text:string)=>{const cached=widths.get(text);if(cached!==undefined)return cached;const measured=runs(text).reduce((sum,r)=>sum+r.font.widthOfTextAtSize(r.text,size),0);if(widths.size<20000)widths.set(text,measured);return measured;};
 const draw=(text:string,x:number,at:number)=>{for(const r of runs(text)){activePage().drawText(r.text,{x,y:at,size,font:r.font,color:rgb(.08,.08,.08)});x+=r.font.widthOfTextAtSize(r.text,size);}};
 const words=new Intl.Segmenter(undefined,{granularity:'word'}),graphemes=new Intl.Segmenter(undefined,{granularity:'grapheme'});
 const wrap=(text:string,max:number)=>{const lines:string[]=[];let current='';for(const {segment} of words.segment((text||'—').replace(/[\r\n\t]/g,' '))){if(width(current+segment)<=max){current+=segment;continue;}if(current.trim()){lines.push(current.trimEnd());current='';}const word=segment.trimStart();if(width(word)<=max){current=word;continue;}for(const {segment:char}of graphemes.segment(word)){if(current&&width(current+char)>max){lines.push(current);current=char;}else current+=char;}}if(current||!lines.length)lines.push(current);return lines;};
 for(let band=0;band<Math.max(snapshot.headers.length,1);band+=6){const indexes=snapshot.headers.slice(band,band+6).map((_,i)=>band+i),cellWidth=(pageWidth-2*margin-35)/Math.max(indexes.length,1),headerLines=indexes.map(i=>wrap(snapshot.headers[i],cellWidth-10)),headerHeight=Math.max(1,...headerLines.map(a=>a.length))*lineHeight+12;
  const newPage=()=>{page=doc.addPage([pageWidth,pageHeight]);pageNumber++;y=pageHeight-margin;draw(snapshot.title,margin,y);y-=lineHeight+4;draw(snapshot.school,margin,y);y-=lineHeight;draw(`Records ${snapshot.rows.length?start+1:0}–${end} of ${snapshot.rows.length} | Columns ${band+1}–${band+indexes.length} | Page ${pageNumber}`,margin,y);y-=lineHeight;draw('Captured '+snapshot.capturedAt,margin,y);y-=20;activePage().drawRectangle({x:margin,y:y-headerHeight,width:pageWidth-2*margin,height:headerHeight,color:rgb(.93,.94,.96)});draw('#',margin+4,y-12);headerLines.forEach((lines,c)=>lines.forEach((line,l)=>draw(line,margin+35+c*cellWidth+5,y-12-l*lineHeight)));y-=headerHeight;};
  newPage();if(!snapshot.rows.length){draw('No matching records.',margin,y-20);continue;}
  for(let r=start;r<end;r++){const cells=indexes.map(i=>wrap(snapshot.rows[r][i],cellWidth-10)),lines=Math.max(1,...cells.map(a=>a.length));let offset=0;
   while(offset<lines){if(y<margin+lineHeight+10)newPage();const take=Math.min(lines-offset,Math.max(1,Math.floor((y-margin-10)/lineHeight))),height=take*lineHeight+10;draw(String(r+1)+(offset?' +':''),margin+4,y-12);cells.forEach((values,c)=>{for(let l=0;l<take;l++){const text=values[offset+l]||'',x=margin+35+c*cellWidth+5;draw(text,snapshot.numeric.includes(indexes[c])?x+cellWidth-10-width(text):x,y-12-l*lineHeight);}});activePage().drawLine({start:{x:margin,y:y-height},end:{x:pageWidth-margin,y:y-height},thickness:.5,color:rgb(.7,.7,.7)});y-=height;offset+=take;if(offset<lines)newPage();}
  }
 }
 return doc.save();
}

/** Minimal OOXML spreadsheet: shared content types, relationships and one inline-string sheet,
 * streamed through the stored-ZIP writer. Numbers use their snapshot numeric typing, never text. */
const xlsxEscape=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/[\u0000-\u001f]/g,' ');
const xlsxColumn=(index:number)=>{let name='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+((n-1)%26))+name;return name;};
const xmlFile=(name:string,xml:string)=>({name,open:async()=>{const bytes=new TextEncoder().encode(xml);return new ReadableStream<Uint8Array>({start(controller){controller.enqueue(bytes);controller.close();}});}});
export async function xlsxSnapshot(snapshot:ExportSnapshot,start:number,end:number):Promise<Uint8Array>{
 const rowXml=Array.from({length:end-start},(_,offset)=>{
  const r=start+offset+2;
  return `<row r="${r}">`+snapshot.rows[r-2].map((cell,i)=>{
   if(snapshot.numeric.includes(i)){const n=Number(cell);if(cell===''||!Number.isFinite(n))return '';return `<c r="${xlsxColumn(i)}${r}" t="n"><v>${cell}</v></c>`;}
   return `<c r="${xlsxColumn(i)}${r}" t="inlineStr"><is><t xml:space="preserve">${xlsxEscape(cell)}</t></is></c>`;
  }).join('')+'</row>';
 }).join('');
 const headerXml=`<row r="1">`+snapshot.headers.map((h,i)=>`<c r="${xlsxColumn(i)}1" s="1" t="inlineStr"><is><t xml:space="preserve">${xlsxEscape(h)}</t></is></c>`).join('')+'</row>';
 const sheet=xmlFile('xl/worksheets/sheet1.xml',`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData>${headerXml}${rowXml}</sheetData></worksheet>`);
 const archive=await new Response(zipFiles([
  xmlFile('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
  xmlFile('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
  xmlFile('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Records" sheetId="1" r:id="rId1"/></sheets></workbook>`),
  xmlFile('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
  xmlFile('xl/styles.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`),
  sheet,
 ])).arrayBuffer();
 return new Uint8Array(archive);
}
