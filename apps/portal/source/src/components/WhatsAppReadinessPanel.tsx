import React,{useEffect,useRef,useState} from 'react';
import {Alert,App,Button,Card,Descriptions,Form,Input,Select,Space} from 'antd';
import {apiClient} from '../services/api';

type Result={canSend:false;templateVersion:number|null;checks:Record<string,string>;message:string};
type Selection={recipientId:string;recipientPhone:string;purpose:string;locale:string;senderPhone:string};
const labels:Record<string,string>={
 draft_matches:'Draft matches',draft_missing_or_different:'Draft missing or different',active:'Active',inactive:'Inactive',
 grant_recorded:'Consent evidence recorded',withdrawal_recorded:'Withdrawal recorded',not_recorded:'No record found',blocked:'Opt-out recorded',
 draft_available:'Draft available',draft_missing:'Draft missing',not_verified:'Not verified',not_available:'Not available',
};
const titles:Record<string,string>={schoolNumber:'School number',recipient:'Recipient account',consent:'Consent record',numberOptOut:'Number-level opt-out',template:'Message template',senderVerification:'Sender connection',templateApproval:'WhatsApp template approval',recipientNumberOwnership:'Recipient number ownership',delivery:'Message delivery'};
export const WhatsAppReadinessPanel:React.FC<{senderPhone:string|null;onDraftSaved:()=>void}>=({senderPhone,onDraftSaved})=>{
 const [form]=Form.useForm(),[parents,setParents]=useState<any[]>([]),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null);
 const [selection,setSelection]=useState<Selection|null>(null);const {message}=App.useApp();
 const requestVersion=useRef(0),draftKey=useRef(crypto.randomUUID());
 useEffect(()=>{let active=true;const timer=window.setTimeout(()=>{apiClient.get('/api/admin/parents',{params:{per_page:100,q:search}}).then(r=>{if(active)setParents(r.data.data||[]);}).catch(()=>{if(active)setError('Parent list could not be loaded.');});},250);return()=>{active=false;window.clearTimeout(timer);};},[search]);
 useEffect(()=>{requestVersion.current++;setResult(null);setSelection(null);draftKey.current=crypto.randomUUID();},[senderPhone]);
 const check=async(v:{recipientId:string;recipientPhone:string;purpose:string;locale:string})=>{
  if(!senderPhone)return;const current=++requestVersion.current;setBusy(true);setError('');setResult(null);
  try{const r=await apiClient.post('/api/admin/whatsapp/readiness',{...v,senderPhone});if(current===requestVersion.current){setResult(r.data.data);setSelection({...v,senderPhone});}}catch(e:any){if(current===requestVersion.current)setError(e.response?.data?.message||'Readiness could not be checked.');}finally{setBusy(false);}
 };
 const saveDraft=async()=>{
  if(!selection||!result?.templateVersion)return;
  setBusy(true);setError('');
  try{const r=await apiClient.post('/api/admin/whatsapp/message-drafts',{...selection,templateVersion:result.templateVersion},{headers:{'Idempotency-Key':draftKey.current}});draftKey.current=crypto.randomUUID();setSelection(null);setResult(null);message.success(r.data.message);onDraftSaved();}
  catch(e:any){setError(e.response?.data?.message||'Message draft could not be saved.');}
  finally{setBusy(false);}
 };
 return <Card title="Check message readiness">
  <Space direction="vertical" size={16} style={{width:'100%'}}>
   <Alert type="info" showIcon message="Preview only" description="Check the recorded information for one parent. This does not connect WhatsApp, verify phone ownership or send a message."/>
   {error&&<Alert type="error" showIcon message={error}/>}
   <Form form={form} layout="vertical" onFinish={check} disabled={busy} onValuesChange={()=>{requestVersion.current++;setResult(null);setSelection(null);draftKey.current=crypto.randomUUID();}} initialValues={{purpose:'school_notice',locale:'en'}}>
    <Form.Item name="recipientId" label="Parent" rules={[{required:true,message:'Choose a parent.'}]}><Select showSearch filterOption={false} onSearch={setSearch} placeholder="Search for a parent" options={parents.map(p=>({value:p.id,label:p.fullName}))}/></Form.Item>
    <Form.Item name="recipientPhone" label="Recipient number with country code" rules={[{required:true},{pattern:/^\+[1-9][0-9]{7,14}$/,message:'Enter the full international number.'}]}><Input placeholder="+91…" maxLength={16}/></Form.Item>
    <Form.Item name="purpose" label="Message purpose" rules={[{required:true}]}><Select options={[{value:'school_notice',label:'School notice'},{value:'fee_reminder',label:'Fee reminder'}]}/></Form.Item>
    <Form.Item name="locale" label="Template language code" rules={[{required:true},{pattern:/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/,message:'Enter a language code such as en or hi.'}]}><Input maxLength={32}/></Form.Item>
    <Button htmlType="submit" type="primary" loading={busy} disabled={!senderPhone}>Check readiness</Button>
    {!senderPhone&&<Alert type="warning" showIcon message="Save the school number draft first."/>}
   </Form>
   {result&&<><Alert type="warning" showIcon message="Sending is not available" description={result.message}/><Descriptions bordered column={1} size="small" items={Object.entries(result.checks).map(([key,value])=>({key,label:titles[key]||key,children:labels[value]||value}))}/><Button loading={busy} disabled={!result.templateVersion||result.checks.schoolNumber!=='draft_matches'||result.checks.recipient!=='active'} onClick={()=>void saveDraft()}>Save message request as draft</Button></>}
  </Space>
 </Card>;
};
