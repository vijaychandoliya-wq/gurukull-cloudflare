import {humanize,displayValue} from '../ux/format';
import {useEffect,useState} from 'react';
import {Alert,Card,Table} from 'antd';
import {apiClient} from '../services/api';
export function BorrowerLoans({studentId}:{studentId?:string}){
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[page,setPage]=useState(1),[total,setTotal]=useState(0),[loading,setLoading]=useState(false);
 useEffect(()=>{let cancelled=false;setLoading(true);setRows([]);apiClient.get('/api/portal/'+(studentId?'student-library':'my-library'),{params:{studentId,page,per_page:20}}).then(r=>{if(!cancelled){setRows(r.data.data);setTotal(r.data.total);setError('');}}).catch(e=>{if(!cancelled)setError(e.response?.data?.message||'Library loans could not be loaded.');}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[studentId,page]);
 return <Card title="Library loans">{error&&<Alert type="error" showIcon message={error}/>}<Table rowKey="id" loading={loading} scroll={{x:true}} dataSource={rows} pagination={{current:page,pageSize:20,total,onChange:setPage}} columns={['title','author','accessionNo','cardNo','issueDate','dueDate','status','closedDate','closureReason'].map(k=>({title:humanize(k),dataIndex:k,render:(v:any,r:any)=>displayValue(k,v,r.currency)}))}/></Card>;
}
