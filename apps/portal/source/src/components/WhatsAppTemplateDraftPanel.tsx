import React,{useEffect,useRef,useState} from 'react';
import {Alert,App,Button,Card,Form,Input,Select,Space,Table,Tag} from 'antd';
import {apiClient} from '../services/api';

type Draft={purpose:'school_notice'|'fee_reminder';locale:string;body:string;version:number};
export const WhatsAppTemplateDraftPanel:React.FC=()=>{
 const [form]=Form.useForm();const {message}=App.useApp();
 const [drafts,setDrafts]=useState<Draft[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const command=useRef(crypto.randomUUID());
 const load=async()=>{setBusy(true);setReady(false);try{const r=await apiClient.get('/api/admin/whatsapp/templates');setDrafts(r.data.data);setReady(true);setError('');}catch(e:any){setError(e.response?.data?.message||'Template drafts could not be loaded.');}finally{setBusy(false);}};
 useEffect(()=>{void load();},[]);
 const save=async(v:Omit<Draft,'version'>)=>{
  const previous=drafts.find(d=>d.purpose===v.purpose&&d.locale===v.locale);
  setBusy(true);setError('');try{const r=await apiClient.put('/api/admin/whatsapp/templates/draft',{...v,version:previous?.version||0},{headers:{'Idempotency-Key':command.current}});command.current=crypto.randomUUID();message.success(r.data.message);form.resetFields();await load();}catch(e:any){setError(e.response?.data?.message||'Template draft could not be saved.');}finally{setBusy(false);}
 };
 return <Card title="Message template drafts" extra={<Button onClick={()=>void load()} loading={busy}>Refresh</Button>}>
  <Space direction="vertical" size={16} style={{width:'100%'}}>
   <Alert type="info" showIcon message="Drafts are not WhatsApp-approved" description="Save proposed text for review. Provider submission, approval and sending are not available. Do not include private student details or passwords."/>
   {error&&<Alert type="error" showIcon message={error}/>}
   <Table size="small" rowKey={d=>`${d.purpose}:${d.locale}`} dataSource={drafts} loading={busy} pagination={{pageSize:10}} columns={[{title:'Purpose',dataIndex:'purpose',render:(v:string)=>v==='fee_reminder'?'Fee reminder':'School notice'},{title:'Language code',dataIndex:'locale'},{title:'Status',render:()=> <Tag>Draft · not verified</Tag>},{title:'Action',render:(_:unknown,row:Draft)=><Button size="small" onClick={()=>{form.setFieldsValue(row);command.current=crypto.randomUUID();}}>Edit</Button>}]}/>
   <Form form={form} layout="vertical" onFinish={save} onValuesChange={()=>{command.current=crypto.randomUUID();}} initialValues={{purpose:'school_notice',locale:'en'}}>
    <Form.Item name="purpose" label="Purpose" rules={[{required:true}]}><Select options={[{value:'school_notice',label:'School notice'},{value:'fee_reminder',label:'Fee reminder'}]}/></Form.Item>
    <Form.Item name="locale" label="Language code" extra="For example, en or hi. Each language requires its own later provider review." rules={[{required:true},{pattern:/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/,message:'Enter a language code such as en or hi.'}]}><Input maxLength={32}/></Form.Item>
    <Form.Item name="body" label="Draft message" extra="You may use {{school_name}}. Do not include passwords, grades or sensitive information." rules={[{required:true,whitespace:true,message:'Enter a draft message.'},{max:1024}]}><Input.TextArea rows={4} maxLength={1024}/></Form.Item>
    <Button type="primary" htmlType="submit" loading={busy} disabled={!ready}>Save draft</Button>
   </Form>
  </Space>
 </Card>;
};
