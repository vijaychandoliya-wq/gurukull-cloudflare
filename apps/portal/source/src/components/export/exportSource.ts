import type {AxiosInstance,AxiosResponse} from 'axios';
type PathPart=string|{key:'id'|'userId'|'studentId'|'sessionId';value:string|number};
export type RecordExportSource={path:string;query:Record<string,string>;arrayPath:PathPart[];client?:AxiosInstance};
const sourceKey=Symbol.for('gurukull.record-export-source');
export function getExportSource(rows:readonly unknown[]|undefined):RecordExportSource|undefined{
 if(!rows)return;return (rows as any)[sourceKey]||(rows.find(row=>row&&typeof row==='object'&&(row as any)[sourceKey]) as any)?.[sourceKey];
}
/** Non-JSON metadata follows object spreads; exported records are always read by the server. */
export function attachExportSource(response:AxiosResponse,client:AxiosInstance){
 if((response.config.method||'get').toLowerCase()!=='get')return response;
 try{const url=new URL(client.getUri(response.config),window.location.origin==='null'?'http://localhost':window.location.origin);if(!/^\/(?:api\/(?:admin|portal)\/|platform\/v1\/)/.test(url.pathname)||url.pathname.startsWith('/api/exports'))return response;
 const query=Object.fromEntries(Array.from(url.searchParams.entries()).filter(([key])=>!['page','per_page','offset','limit','cursor'].includes(key)));if(Array.from(url.searchParams.keys()).some(k=>url.searchParams.getAll(k).length>1))return response;
 const walk=(value:any,path:PathPart[]|undefined,inherited?:RecordExportSource)=>{if(!value||typeof value!=='object')return;let source=inherited;if(Array.isArray(value)&&path){source={path:url.pathname,query,arrayPath:path,client};Object.defineProperty(value,sourceKey,{value:source,enumerable:true,configurable:true});}else if(source&&!Array.isArray(value))Object.defineProperty(value,sourceKey,{value:source,enumerable:true,configurable:true});for(const [key,item]of Object.entries(value)){if(!path||path.length>=8)continue;let next:PathPart[]|undefined=[...path,key];if(Array.isArray(value)){const identity=item&&typeof item==='object'?['id','userId','studentId','sessionId'].find(field=>typeof (item as any)[field]==='string'||typeof (item as any)[field]==='number'):undefined;next=identity?[...path,{key:identity as 'id',value:(item as any)[identity]}]:undefined;}walk(item,next,source);}};walk(response.data,[]);
 }catch{/* An unrecognized source never falls back to exporting the rendered page. */}return response;
}
