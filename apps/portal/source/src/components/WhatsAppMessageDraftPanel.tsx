import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Button,Card,Tag} from 'antd';
import {Table} from './export/ExportTable';
import {apiClient} from '../services/api';

type Draft={id:string;recipientName:string;recipientPhone:string;purpose:string;locale:string;templateVersion:number;createdAt:number};
export const WhatsAppMessageDraftPanel:React.FC<{refreshKey:number}>=({refreshKey})=>{
 const [rows,setRows]=useState<Draft[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{setLoading(true);try{const r=await apiClient.get('/api/admin/whatsapp/message-drafts');setRows(r.data.data);setError('');}catch(e:any){setError(e.response?.data?.message||'Message drafts could not be loaded.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load,refreshKey]);
 return <Card title="Message request drafts" extra={<Button onClick={()=>void load()} loading={loading}>Refresh</Button>}>
  <Alert type="info" showIcon message="Drafts only" description="These requests are not queued or sent. Approval, consent and delivery must be checked again before any future send."/>
  {error&&<Alert type="error" showIcon message={error}/>}
  <Table size="small" rowKey="id" loading={loading} dataSource={rows} pagination={{pageSize:10}} locale={{emptyText:'No message request drafts.'}} columns={[{title:'Recipient',dataIndex:'recipientName'},{title:'Phone',dataIndex:'recipientPhone'},{title:'Purpose',dataIndex:'purpose',render:(v:string)=>v==='fee_reminder'?'Fee reminder':'School notice'},{title:'Language',dataIndex:'locale'},{title:'Template version',dataIndex:'templateVersion'},{title:'Status',render:()=> <Tag>Draft</Tag>}]}/>
 </Card>;
};
