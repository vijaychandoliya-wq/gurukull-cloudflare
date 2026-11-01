import React,{useEffect,useRef,useState} from 'react';
import {Alert,App,Button,Card,Checkbox,Form,Input,Select,Space,Table} from 'antd';
import {apiClient} from '../services/api';

type Consent={recipientId:string;senderPhone:string;recipientPhone:string;purpose:'school_notice'|'fee_reminder';state:'granted'|'withdrawn';source:string;evidence:string;version:number};
export const WhatsAppConsentPanel:React.FC<{senderPhone:string|null}>=({senderPhone})=>{
 const [form]=Form.useForm();const {message}=App.useApp();const [parents,setParents]=useState<any[]>([]),[search,setSearch]=useState(''),[records,setRecords]=useState<Consent[]>([]),[recipientId,setRecipientId]=useState(''),[loading,setLoading]=useState(false),[recordsReady,setRecordsReady]=useState(false),[error,setError]=useState('');
 const key=useRef(crypto.randomUUID()),loadId=useRef(0);
 useEffect(()=>{let active=true;const timer=window.setTimeout(()=>{apiClient.get('/api/admin/parents',{params:{per_page:100,q:search}}).then(r=>{if(active)setParents(r.data.data||[]);}).catch(()=>{if(active)setError('Parent list could not be loaded.');});},250);return()=>{active=false;window.clearTimeout(timer);};},[search]);
 const load=async(id:string)=>{const current=++loadId.current;setLoading(true);setRecordsReady(false);setError('');try{const r=await apiClient.get('/api/admin/whatsapp/consents',{params:{recipientId:id}});if(current===loadId.current){setRecords(r.data.data);setRecordsReady(true);}}catch(e:any){if(current===loadId.current){setRecords([]);setError(e.response?.data?.message||'Consent records could not be loaded.');}}finally{if(current===loadId.current)setLoading(false);}};
 const save=async(v:{senderPhone:string;recipientPhone:string;purpose:Consent['purpose'];state:Consent['state'];source:Consent['source'];evidence:string;explicitConsent?:boolean})=>{
  if(!recipientId)return;
  const previous=records.find(r=>r.senderPhone===v.senderPhone&&r.recipientPhone===v.recipientPhone&&r.purpose===v.purpose);
  setLoading(true);setError('');try{const r=await apiClient.put('/api/admin/whatsapp/consents',{...v,explicitConsent:v.state==='granted'?v.explicitConsent:undefined,recipientId,version:previous?.version||0},{headers:{'Idempotency-Key':key.current}});key.current=crypto.randomUUID();message.success(r.data.message);form.resetFields();await load(recipientId);}catch(e:any){setError(e.response?.data?.message||'Consent could not be recorded. Reload the records and try again.');}finally{setLoading(false);}
 };
 return <Card title="Parent consent records">
  <Space direction="vertical" size={16} style={{width:'100%'}}>
   <Alert type="info" showIcon message="Record an actual permission or withdrawal" description="This is an administrative record only. Phone ownership and WhatsApp delivery are not verified, and sending remains unavailable. Do not record consent without the parent's explicit permission."/>
   {error&&<Alert type="error" showIcon message={error}/>}
   <Select showSearch filterOption={false} onSearch={setSearch} placeholder="Search and choose a parent" disabled={loading} style={{width:'100%'}} value={recipientId||undefined} options={parents.map(p=>({value:p.id,label:p.fullName}))} onChange={id=>{setRecipientId(id);setRecords([]);form.resetFields();key.current=crypto.randomUUID();void load(id);}}/>
   {recipientId&&<><Table rowKey={r=>[r.senderPhone,r.recipientPhone,r.purpose].join(':')} size="small" loading={loading} dataSource={records} pagination={{pageSize:10}} columns={[{title:'School number',dataIndex:'senderPhone'},{title:'Parent number',dataIndex:'recipientPhone'},{title:'Purpose',dataIndex:'purpose',render:(v:string)=>v==='fee_reminder'?'Fee reminders':'School notices'},{title:'Status',dataIndex:'state'},{title:'Evidence reference',dataIndex:'evidence'}]}/>
    <Form form={form} layout="vertical" onFinish={save} onValuesChange={()=>{key.current=crypto.randomUUID();}} initialValues={{purpose:'school_notice',state:'withdrawn',source:'written'}}>
     <Form.Item name="senderPhone" label="School number" rules={[{required:true,message:'Choose the school number.'}]}><Select options={Array.from(new Set([...(senderPhone?[senderPhone]:[]),...records.map(r=>r.senderPhone)])).map(number=>({value:number,label:number===senderPhone?`${number} (current draft)`: `${number} (previous)`}))}/></Form.Item>
     <Form.Item name="recipientPhone" label="Parent number with country code" rules={[{required:true},{pattern:/^\+[1-9][0-9]{7,14}$/,message:'Enter the full international number.'}]}><Input placeholder="+91…" maxLength={16}/></Form.Item>
     <Form.Item name="purpose" label="Message purpose" rules={[{required:true}]}><Select options={[{value:'school_notice',label:'School notices'},{value:'fee_reminder',label:'Fee reminders'}]}/></Form.Item>
     <Form.Item name="state" label="Record" rules={[{required:true}]}><Select options={[{value:'granted',label:'Consent given'},{value:'withdrawn',label:'Consent withdrawn'}]}/></Form.Item>
     <Form.Item name="source" label="How it was recorded" rules={[{required:true}]}><Select options={[{value:'written',label:'Written'},{value:'verbal',label:'Verbal'},{value:'portal',label:'Portal'}]}/></Form.Item>
     <Form.Item name="evidence" label="Evidence reference" extra="Record where the permission or withdrawal can be checked; do not enter sensitive details." rules={[{required:true,whitespace:true,message:'Enter an evidence reference.'}]}><Input maxLength={250}/></Form.Item>
     <Form.Item noStyle shouldUpdate={(a,b)=>a.state!==b.state}>{({getFieldValue})=>getFieldValue('state')==='granted'?<Form.Item name="explicitConsent" valuePropName="checked" rules={[{validator:(_,v)=>v?Promise.resolve():Promise.reject(new Error('Confirm explicit permission.'))}]}><Checkbox>The parent explicitly agreed to this school, number and purpose.</Checkbox></Form.Item>:null}</Form.Item>
     <Button type="primary" htmlType="submit" loading={loading} disabled={!recordsReady||(!senderPhone&&!records.length)}>Save consent record</Button>
     {!senderPhone&&!records.length&&<Alert type="warning" showIcon message="Save the school number draft before recording consent."/>}
    </Form></>}
  </Space>
 </Card>;
};
