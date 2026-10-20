import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Button,Card,Space,Table} from 'antd';
import {apiClient} from '../services/api';
import {PersonFormDrawer} from '../components/PersonFormDrawer';
export const StaffManagementPage:React.FC=()=>{
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState<string|null>(null),[open,setOpen]=useState(false),[id,setId]=useState<string|null>(null);
 const load=useCallback(async()=>{try{const r=await apiClient.get('/api/admin/staff');setRows(r.data.data);setError(null);}catch(e:any){setError(e.response?.data?.message||'Staff could not be loaded.');}},[]);useEffect(()=>{load();},[load]);
 return <Card title="Staff" extra={<Button type="primary" onClick={()=>{setId(null);setOpen(true);}}>New staff member</Button>}>{error&&<Alert type="error" message={error}/>}<Table rowKey="id" dataSource={rows} columns={[{title:'Name',dataIndex:'fullName'},{title:'Employee ID',dataIndex:'employeeId'},{title:'Designation',dataIndex:'designation'},{title:'Email',dataIndex:'email'},{title:'Action',render:(_:any,r:any)=><Button onClick={()=>{setId(r.id);setOpen(true);}}>Edit</Button>}]}/><PersonFormDrawer open={open} kind="staff" id={id} onClose={()=>setOpen(false)} onSaved={load}/></Card>;
};
