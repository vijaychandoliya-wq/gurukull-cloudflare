// Keep at most the current JWT and access-key CryptoKeys per isolate. Keys remain
// non-extractable; every caller still validates its secret and verifies signatures.
// A rotated secret has a different map key and cannot reuse the prior key.
const keys=new Map<string,Promise<CryptoKey>>();
export function hmacKey(secret:string){
 let value=keys.get(secret);if(value)return value;
 value=crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 if(keys.size>=2)keys.delete(keys.keys().next().value!);
 keys.set(secret,value);value.catch(()=>{if(keys.get(secret)===value)keys.delete(secret);});return value;
}
