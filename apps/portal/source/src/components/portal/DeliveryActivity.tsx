import {useEffect,useState} from 'react';
import {Alert,Button,Card,Space,Table,Tag,Typography} from 'antd';
import {apiClient} from '../../services/api';
import {displayValue,humanize} from '../../ux/format';
export function DeliveryActivity(){
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const load=async()=>{setLoading(true);try{const r=await apiClient.get('/api/admin/email-deliveries',{params:{limit:100}});setRows(r.data.data);setError('');}catch(e:any){setError(e.response?.data?.message||'Delivery activity could not be loaded.');}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 return <Card title="Credential email activity" extra={<Button loading={loading} onClick={load}>Refresh</Button>}>
  <Typography.Paragraph type="secondary">Latest 100 attempts. Queued messages are awaiting processing. Provider acceptance does not confirm that a recipient opened or received an email. Recipients are masked for privacy.</Typography.Paragraph>
  {error&&<Alert type="error" showIcon message={error}/>}
  <Table loading={loading} scroll={{x:900}} rowKey="id" dataSource={rows} pagination={{pageSize:15}} locale={{emptyText:'No credential emails recorded.'}} columns={[
   {title:'Account',dataIndex:'fullName'},{title:'Recipient',dataIndex:'email'},
   {title:'Status',dataIndex:'status',render:(v:string)=><Tag color={v==='completed'?'green':v==='failed'?'red':'blue'}>{v==='completed'?'Provider accepted':humanize(v)}</Tag>},
   {title:'Attempts',dataIndex:'attempts'},
   ...['createdAt','scheduledAt','completedAt'].map(key=>({title:humanize(key),dataIndex:key,render:(v:any)=>displayValue(key,v)})),
   {title:'Last error',dataIndex:'lastError',ellipsis:true},
  ]}/>
 </Card>;
}
