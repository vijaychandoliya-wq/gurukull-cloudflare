import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Alert,App,Button,Card,Form,Input,Select,Space} from 'antd';
import {Table} from './export/ExportTable';
import {apiClient} from '../services/api';

type Block={senderPhone:string;recipientPhone:string;evidence:string;version:number};
export const WhatsAppSuppressionPanel:React.FC<{senderPhone:string|null}>=({senderPhone})=>{
 const [form]=Form.useForm();const {message}=App.useApp();
 const [records,setRecords]=useState<Block[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=useRef(crypto.randomUUID());
 const load=useCallback(async()=>{setBusy(true);setReady(false);try{const r=await apiClient.get('/api/admin/whatsapp/suppressions');setRecords(r.data.data);setReady(true);setError('');}catch(e:any){setError(e.response?.data?.message||'Opt-out records could not be loaded.');}finally{setBusy(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const save=async(v:Omit<Block,'version'>)=>{
  const previous=records.find(r=>r.senderPhone===v.senderPhone&&r.recipientPhone===v.recipientPhone);
  setBusy(true);setError('');try{const r=await apiClient.put('/api/admin/whatsapp/suppressions',{...v,version:previous?.version||0},{headers:{'Idempotency-Key':key.current}});key.current=crypto.randomUUID();message.success(r.data.message);form.resetFields();await load();}catch(e:any){setError(e.response?.data?.message||'The opt-out could not be recorded. Refresh the list and try again.');}finally{setBusy(false);}
 };
 return <Card title="Number-level opt-outs" extra={<Button onClick={()=>void load()} loading={busy}>Refresh</Button>}>
  <Space direction="vertical" size={16} style={{width:'100%'}}>
   <Alert type="info" showIcon message="Record a request to stop WhatsApp messages" description="This record covers the school number and recipient phone across message purposes and linked people. Sending and automatic enforcement are not available yet. Only record actual opt-out requests."/>
   {error&&<Alert type="error" showIcon message={error}/>}
   <Table size="small" rowKey={r=>`${r.senderPhone}:${r.recipientPhone}`} dataSource={records} loading={busy} pagination={{pageSize:10}} columns={[{title:'School number',dataIndex:'senderPhone'},{title:'Recipient number',dataIndex:'recipientPhone'},{title:'Evidence reference',dataIndex:'evidence'}]} locale={{emptyText:'No number-level opt-outs recorded.'}}/>
   <Form form={form} layout="vertical" onFinish={save} onValuesChange={()=>{key.current=crypto.randomUUID();}}>
    <Form.Item name="senderPhone" label="School number" rules={[{required:true,message:'Choose the school number.'}]}><Select options={Array.from(new Set([...(senderPhone?[senderPhone]:[]),...records.map(r=>r.senderPhone)])).map(number=>({value:number,label:number===senderPhone?`${number} (current draft)`:`${number} (previous)`}))}/></Form.Item>
    <Form.Item name="recipientPhone" label="Recipient number with country code" rules={[{required:true},{pattern:/^\+[1-9][0-9]{7,14}$/,message:'Enter the full international number.'}]}><Input placeholder="+91…" maxLength={16}/></Form.Item>
    <Form.Item name="evidence" label="Evidence reference" extra="Identify where the request can be checked. Do not enter sensitive details." rules={[{required:true,whitespace:true,message:'Enter an evidence reference.'}]}><Input maxLength={250}/></Form.Item>
    <Button type="primary" htmlType="submit" disabled={!ready||(!senderPhone&&!records.length)} loading={busy}>Record opt-out</Button>
   </Form>
   <Alert type="warning" showIcon message="Clearing an opt-out is not available yet" description="A separate reviewed re-consent workflow is needed before an opt-out can be removed."/>
  </Space>
 </Card>;
};
