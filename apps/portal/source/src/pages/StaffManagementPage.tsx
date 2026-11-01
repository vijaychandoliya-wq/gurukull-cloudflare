import {humanize} from '../ux/format';
import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Button,Card,Space,Table,Input,Typography} from 'antd';
import {apiClient} from '../services/api';
import {PersonFormDrawer} from '../components/PersonFormDrawer';
import {AuthenticatedAvatar} from '../components/UserAvatar';
export const StaffManagementPage:React.FC=()=>{
 const [query,setQuery]=useState(''),[loading,setLoading]=useState(false);
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState<string|null>(null),[open,setOpen]=useState(false),[id,setId]=useState<string|null>(null);
 const load=useCallback(async()=>{setLoading(true);try{const r=await apiClient.get('/api/admin/staff');setRows(r.data.data);setError(null);}catch(e:any){setError(e.response?.data?.message||'Staff could not be loaded.');}finally{setLoading(false);}},[]);useEffect(()=>{load();},[load]);
 return <Card title="Staff" extra={<Button type="primary" onClick={()=>{setId(null);setOpen(true);}}>New staff member</Button>}>{error&&<Alert type="error" message={error}/>}<Space wrap className="gk-table-toolbar"><Input.Search aria-label="Search loaded staff" placeholder="Search loaded staff" allowClear onChange={e=>setQuery(e.target.value)}/><Button onClick={load} loading={loading}>Refresh</Button><Typography.Text type="secondary">{rows.length} loaded records (up to 100)</Typography.Text></Space><Table loading={loading} scroll={{x:true}} rowKey="id" dataSource={rows.filter(r=>[r.fullName,r.employeeId,r.email,r.designation].some(v=>String(v||'').toLowerCase().includes(query.toLowerCase())))} columns={[{title:'Name',dataIndex:'fullName',render:(name:string,r:any)=><Space><AuthenticatedAvatar name={name} src={r.avatar}/><span>{name}</span></Space>},{title:'Employee ID',dataIndex:'employeeId'},{title:'Designation',dataIndex:'designation',render:(v:string)=>humanize(v||'Not supplied')},{title:'Email',dataIndex:'email'},{title:'Action',render:(_:any,r:any)=><Button onClick={()=>{setId(r.id);setOpen(true);}}>Edit</Button>}]}/><PersonFormDrawer open={open} kind="staff" id={id} onClose={()=>setOpen(false)} onSaved={load}/></Card>;
};
