import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, App, Button, Card, Form, Input, Space, Tag, Typography} from 'antd';
import {apiClient} from '../services/api';
import {WhatsAppConsentPanel} from '../components/WhatsAppConsentPanel';
import {WhatsAppTemplateDraftPanel} from '../components/WhatsAppTemplateDraftPanel';
import {WhatsAppSuppressionPanel} from '../components/WhatsAppSuppressionPanel';
import {WhatsAppReadinessPanel} from '../components/WhatsAppReadinessPanel';
import {WhatsAppMessageDraftPanel} from '../components/WhatsAppMessageDraftPanel';
import {ModuleTabs} from '../components/portal/ModuleTabs';

type Draft={phone:string;displayName:string;version:number};
export const WhatsAppConnectionPage:React.FC=()=>{
 const [form]=Form.useForm();
 const [draft,setDraft]=useState<Draft|null>(null);
 const [draftRefresh,setDraftRefresh]=useState(0);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState('');
 const command=useRef(crypto.randomUUID());
 const {message}=App.useApp();
 const load=useCallback(async()=>{
  setLoading(true);
  try{const response=await apiClient.get('/api/admin/whatsapp/connection');const value=response.data.data.draft as Draft|null;setDraft(value);form.setFieldsValue(value||{phone:'',displayName:''});setReady(true);setError('');}
  catch(e:any){setReady(false);setError(e.response?.data?.message||'WhatsApp connection details could not be loaded.');}
  finally{setLoading(false);}
 },[form]);
 useEffect(()=>{void load();},[load]);
 const save=async(values:{phone:string;displayName:string})=>{
  setSaving(true);setError('');
  try{const result=await apiClient.put('/api/admin/whatsapp/connection/draft',{...values,version:draft?.version||0},{headers:{'Idempotency-Key':command.current}});setDraft(result.data.data.draft);command.current=crypto.randomUUID();message.success(result.data.message);}
  catch(e:any){setError(e.response?.data?.message||'The draft could not be saved.');}
  finally{setSaving(false);}
 };
 return <Space direction="vertical" size={20} style={{width:'100%',maxWidth:1120}}>
  <Typography.Title level={2}>School WhatsApp</Typography.Title>
  <Alert type="info" showIcon message="Connection setup is in progress" description="Save your school's intended WhatsApp Business number as a draft. It is not connected to Meta, verified, or able to send messages yet."/>
  {error&&<Alert type="error" showIcon message={error} action={<Button size="small" onClick={()=>void load()}>Reload</Button>}/>}
  <ModuleTabs items={[
   {key:'number',forceRender:true,label:'School number',children:<Card title="School-owned number" extra={<Tag>Not connected</Tag>} loading={loading}>
   <Form form={form} layout="vertical" onFinish={save} onValuesChange={()=>{command.current=crypto.randomUUID();}}>
    <Form.Item name="displayName" label="School display name" rules={[{required:true,whitespace:true,message:'Enter the school display name.'},{max:100}]}><Input maxLength={100}/></Form.Item>
    <Form.Item name="phone" label="WhatsApp number with country code" extra="For India, start with +91. Check that your number is eligible for the official WhatsApp Business Platform before connecting it." rules={[{required:true,message:'Enter the school number.'},{pattern:/^\+[1-9][0-9]{7,14}$/,message:'Enter the full international number, starting with + and country code.'}]}><Input placeholder="+91…" inputMode="tel" maxLength={16}/></Form.Item>
    <Button type="primary" htmlType="submit" loading={saving} disabled={!ready}>Save draft</Button>
   </Form>
  </Card>},
   {key:'consent',label:'Parent consent',children:<WhatsAppConsentPanel senderPhone={draft?.phone||null}/>},
   {key:'opt-outs',label:'Opt-outs',children:<WhatsAppSuppressionPanel senderPhone={draft?.phone||null}/>},
   {key:'templates',label:'Message templates',children:<WhatsAppTemplateDraftPanel/>},
   {key:'readiness',label:'Check readiness',children:<WhatsAppReadinessPanel senderPhone={draft?.phone||null} onDraftSaved={()=>setDraftRefresh(value=>value+1)}/>},
   {key:'drafts',label:'Message drafts',children:<WhatsAppMessageDraftPanel refreshKey={draftRefresh}/>},
  ]}/>
 </Space>;
};
