export type PendingPayment={key:string;body:Record<string,unknown>};

/** Tab-local recovery only. Contains no password, session token or student name. */
export function readPendingPayment(storageKey:string|null):PendingPayment|undefined{
 if(!storageKey)return;
 try{
  const value=JSON.parse(sessionStorage.getItem(storageKey)||'null');
  if(value&&typeof value.key==='string'&&/^[-A-Za-z0-9_]{1,128}$/.test(value.key)&&value.body&&typeof value.body.invoiceId==='string'&&Number.isSafeInteger(value.body.version)&&Number.isSafeInteger(value.body.amountMinor))return value;
 }catch{/* A corrupt browser value is never submitted automatically. */}
}
