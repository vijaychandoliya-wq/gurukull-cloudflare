import {useCallback,useEffect,useRef,useState} from 'react';
import {apiClient} from '../../services/api';
import {useLanguage} from '../../i18n/LanguageProvider';
import {feeText} from '../../i18n/fees';

export function useFeeText(){const {locale}=useLanguage();return (text:string)=>feeText(locale,text);}
export function feeError(error:any){
 const code=error?.response?.data?.error||error?.response?.data?.message;
 const messages:Record<string,string>={VALIDATION_FAILED:'Check the highlighted fields and try again. This request was not saved.',FUTURE_PAYMENT_DATE:'The date received cannot be in the future. Select the date the money was actually received.',DATE_OUTSIDE_ACADEMIC_YEAR:'Select a date within the current academic year shown at the top of Fees.',LEDGER_RECONCILIATION_REQUIRED:'These ledger totals need reconciliation. No new collection can be confirmed from this view; contact the school finance administrator.',SEARCH_TOO_LONG:'Use a shorter student name, admission number or mobile number to search.',FEE_STRUCTURE_NOT_FOUND:'This fee plan could not be found or its numbering setup is missing. Check fee settings and refresh the plan.',ACTUAL_FINANCE_POLICY_REQUIRED:'Set invoice and receipt numbers in Fee settings before recording charges or payments.',SCHOOL_SETUP_REQUIRED:'Complete the school settings and current academic year before continuing.',RECORD_CHANGED:'The balance or school record changed. Refresh and review the updated values before saving.',IDEMPOTENCY_CONFLICT:'This request differs from the earlier attempt. Check payment status before starting another entry.',DUPLICATE_RECORD:'This entry or transaction reference already exists. Check the receipt register before recording it again.'};
 return messages[code]||(/^[A-Z_]+$/.test(code||'')?'The fee service could not complete this action. Refresh and try again.':error?.response?.data?.message)||error?.message||'The fee service could not be loaded. Please try again.';
}
/** Independent requests: one unavailable view never overwrites another view's data. */
export function useFeeResource(url:string|null,params:Record<string,unknown>={}){
 const [result,setResult]=useState<any>(),[error,setError]=useState(''),[loading,setLoading]=useState(!!url),[tick,setTick]=useState(0);const sequence=useRef(0),query=JSON.stringify(params);
 const refresh=useCallback(()=>setTick(v=>v+1),[]);
 useEffect(()=>{const request=++sequence.current;setResult(undefined);setError('');if(!url){setLoading(false);return;}setLoading(true);apiClient.get(url,{params:JSON.parse(query)}).then(r=>{if(request===sequence.current)setResult(r.data);}).catch(e=>{if(request===sequence.current)setError(feeError(e));}).finally(()=>{if(request===sequence.current)setLoading(false);});return()=>{sequence.current++;};},[url,query,tick]);
 return {result,error,loading,refresh};
}
export function schoolToday(timezone:string){return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
