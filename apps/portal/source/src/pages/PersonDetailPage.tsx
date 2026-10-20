import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Button,Card,Descriptions,Space,Spin} from 'antd';
import {useParams} from 'react-router-dom';
import {apiClient} from '../services/api';
import {PersonFormDrawer} from '../components/PersonFormDrawer';
export const PersonDetailPage:React.FC<{kind:'students'|'teachers'|'staff'}>=({kind})=>{
 const {id}=useParams();const [data,setData]=useState<any>(),[error,setError]=useState<string|null>(null),[edit,setEdit]=useState(false);
 const load=useCallback(async()=>{try{const r=await apiClient.get(`/api/admin/${kind}/${encodeURIComponent(id||'')}`);setData(r.data.data);setError(null);}catch(e:any){setError(e.response?.data?.message||'This record could not be loaded.');}},[id,kind]);useEffect(()=>{load();},[load]);
 return <Card title={data?.fullName||'Person details'} extra={data&&<Button onClick={()=>setEdit(true)}>Edit</Button>}>{error?<Alert type="error" showIcon message={error}/>:!data?<Spin/>:<Space direction="vertical" style={{width:'100%'}}><Descriptions bordered column={1} items={['email','mobile','status','gender','dateOfBirth','bloodGroup','registrationNumber','rollNumber','className','academicYear','employeeId','designation','jobType','joiningDate','address','city','pincode'].filter(k=>k in data).map(key=>({key,label:key.replace(/([A-Z])/g,' $1'),children:data[key]??'Not supplied'}))}/><Alert type="info" showIcon message="Login credentials are issued separately by the school administrator."/></Space>}<PersonFormDrawer open={edit} kind={kind} id={id} onClose={()=>setEdit(false)} onSaved={load}/></Card>;
};
