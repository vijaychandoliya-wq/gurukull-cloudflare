import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const dist=resolve(dirname(fileURLToPath(import.meta.url)),'../apps/portal/source/dist');
const html=await readFile(resolve(dist,'index.html'),'utf8');
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map(m=>m[1]);
if(!assets.length)throw new Error('Portal has no built JavaScript assets');
for(const asset of assets){const s=await readFile(resolve(dist,asset.slice(1)),'utf8');if(/http:\/\/(?:localhost|127\.0\.0\.1):\d+/.test(s))throw new Error('Cloudflare portal contains a development HTTP API origin; rebuild with VITE_API_URL empty');}
console.log('Cloudflare portal build validation passed: JavaScript assets present; no development HTTP origin.');
