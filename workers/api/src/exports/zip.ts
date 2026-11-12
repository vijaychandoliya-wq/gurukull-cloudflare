export type ZipFile={name:string;open:()=>Promise<ReadableStream<Uint8Array>>};
const table=Array.from({length:256},(_,i)=>{for(let n=0;n<8;n++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
const header=(size:number,values:[number,number,number][])=>{const b=new Uint8Array(size),v=new DataView(b.buffer);values.forEach(([at,bits,value])=>bits===16?v.setUint16(at,value,true):v.setUint32(at,value,true));return b;};
/** Stored ZIP with data descriptors: streams parts without buffering the archive. */
export function zipFiles(files:ZipFile[]){
 const encoder=new TextEncoder();
 async function* chunks(){let offset=0;const entries:{name:Uint8Array;crc:number;size:number;offset:number}[]=[];
  for(const file of files){const name=encoder.encode(file.name),start=offset,head=header(30,[[0,32,0x04034b50],[4,16,20],[6,16,0x0808],[26,16,name.length]]);yield head;yield name;offset+=head.length+name.length;let crc=0xffffffff,size=0;const reader=(await file.open()).getReader();try{while(true){const item=await reader.read();if(item.done)break;for(const byte of item.value)crc=table[(crc^byte)&255]^(crc>>>8);size+=item.value.length;offset+=item.value.length;if(offset>0xffffff00)throw Error('EXPORT_ARCHIVE_TOO_LARGE');yield item.value;}}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}crc=(crc^0xffffffff)>>>0;const descriptor=header(16,[[0,32,0x08074b50],[4,32,crc],[8,32,size],[12,32,size]]);yield descriptor;offset+=16;entries.push({name,crc,size,offset:start});}
  const directoryStart=offset;for(const e of entries){const h=header(46,[[0,32,0x02014b50],[4,16,20],[6,16,20],[8,16,0x0808],[16,32,e.crc],[20,32,e.size],[24,32,e.size],[28,16,e.name.length],[42,32,e.offset]]);yield h;yield e.name;offset+=46+e.name.length;}yield header(22,[[0,32,0x06054b50],[8,16,entries.length],[10,16,entries.length],[12,32,offset-directoryStart],[16,32,directoryStart]]);
 }
 const iterator=chunks();return new ReadableStream<Uint8Array>({async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(next.value);}catch(e){controller.error(e);}},async cancel(){await iterator.return();}});
}
