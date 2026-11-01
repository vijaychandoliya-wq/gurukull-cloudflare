/** Shared presentation rules. Monetary API values always remain integer minor units. */
export function humanize(value: string): string {
  const labels: Record<string,string> = {amountMinor:'Amount',paidMinor:'Paid',balanceMinor:'Balance',concessionMinor:'Concession',netMinor:'Net pay',grossMinor:'Gross pay',fareMinor:'Fare',unitPriceMinor:'Unit price',earningsMinor:'Earnings',deductionsMinor:'Deductions',fullName:'Name',employeeId:'Employee ID',sectionId:'Class and section',ugDegree:'UG degree',pgDegree:'PG degree',subDesignation:'Additional designation',reportingTo:'Reports to',isCurrent:'Current year',dateOfBirth:'Date of birth',jobType:'Job type',registrationNumber:'Admission number',schooladmin:'School administrator',head_of_the_department:'Head of department'};
  return labels[value] || value.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/^./,c=>c.toUpperCase());
}
export function currencyDigits(currency: string): number {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('School currency is required.');
  return new Intl.NumberFormat('en-IN',{style:'currency',currency}).resolvedOptions().maximumFractionDigits ?? 2;
}
export function majorToMinor(value:string, currency:string):number|null {
  if (!value.trim()) return null;
  const digits=currencyDigits(currency), text=value.trim();
  if (!/^\d+(\.\d*)?$/.test(text)) throw new Error('Enter a positive amount without commas or currency symbols.');
  const [whole,fraction='']=text.split('.');
  if (fraction.length>digits) throw new Error(`${currency} allows ${digits} decimal place${digits===1?'':'s'}.`);
  const minor=BigInt(whole)*10n**BigInt(digits)+BigInt(fraction.padEnd(digits,'0')||'0');
  if(minor>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('This amount is too large.');
  return Number(minor);
}
export function minorToMajor(value:number,currency:string):string {
  const digits=currencyDigits(currency);
  if(!Number.isSafeInteger(value))throw new Error('The recorded amount is invalid.');
  const sign=value<0?'-':'', raw=String(Math.abs(value)).padStart(digits+1,'0');
  return sign+(digits?raw.slice(0,-digits)+'.'+raw.slice(-digits):raw);
}
export function money(value:number|null|undefined,currency?:string|null):string {
  if(value===null||value===undefined)return '—';
  if(!currency)return 'Currency setup required';
  try{return new Intl.NumberFormat('en-IN',{style:'currency',currency}).format(Number(minorToMajor(value,currency)));}catch{return 'Invalid amount';}
}
export function displayValue(key:string,value:unknown,currency?:string|null):string {
  if(value===null||value===undefined||value==='')return 'Not supplied';
  if(key.endsWith('Minor'))return money(Number(value),currency);
  if(typeof value==='boolean')return value?'Yes':'No';
  if(typeof value==='number'&&/(At|Until)$/.test(key))return new Date(value*1000).toLocaleString();
  if(Array.isArray(value))return value.map(v=>typeof v==='string'?humanize(v):String(v)).join(', ');
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return new Date(value+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  if(typeof value==='string'&&/^(status|type|role|gender|designation|jobType|session|lifecycle|publicationStatus|approvalStatus|absentTotals)$/.test(key))return humanize(value);
  return String(value);
}
