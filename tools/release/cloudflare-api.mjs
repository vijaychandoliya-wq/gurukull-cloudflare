import {readFileSync,existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
export function cloudflareToken(){
 if(process.env.CLOUDFLARE_API_TOKEN)return process.env.CLOUDFLARE_API_TOKEN;
 // Local maintenance uses the already-authorized Wrangler OAuth identity.
 const file=join(homedir(),'Library/Preferences/.wrangler/config/default.toml');
 if(existsSync(file)){const match=readFileSync(file,'utf8').match(/^oauth_token\s*=\s*(".*")/m);if(match)return JSON.parse(match[1]);}
 throw Error('Authorized Cloudflare identity required');
}
export async function cloudflareRequest(path,options={}){
 const response=await fetch('https://api.cloudflare.com/client/v4/'+path,{...options,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+cloudflareToken(),'Content-Type':'application/json',...options.headers}});
 if(!response.ok)throw Error('Cloudflare operation failed with HTTP '+response.status);
 return response.json();
}
