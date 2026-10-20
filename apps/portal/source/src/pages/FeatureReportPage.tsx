import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Button,Card,Table,Tag,Typography} from 'antd';
import {Link,useLocation} from 'react-router-dom';
import {adminFeatures} from '../../../../../packages/contracts/src/admin-features';
import {apiClient} from '../services/api';
export const UnavailableFeaturePage:React.FC=()=>{
 const {pathname}=useLocation();
 const feature=adminFeatures.find(f=>f.path===pathname)||adminFeatures.find(f=>f.path.includes('/:')&&pathname.startsWith(f.path.split('/:')[0]+'/'));
 return <Card><Typography.Title level={3}>{feature?.title||'Feature unavailable'}</Typography.Title><Alert type="warning" showIcon message="Not available yet" description={feature?.reason||'This operation has not been implemented.'}/><Typography.Paragraph style={{marginTop:16}}>This page cannot save or change school records yet.</Typography.Paragraph><Link to="/feature-report">View administrator feature status</Link></Card>;
};
export const FeatureReportPage:React.FC=()=> {
 const [features,setFeatures]=useState<any[]>([]),[release,setRelease]=useState(''),[loadedAt,setLoadedAt]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const load=useCallback(async()=>{setLoading(true);try{const r=await apiClient.get('/api/admin/features');if(!Array.isArray(r.data.data))throw Error('Invalid feature response');setFeatures(r.data.data);setRelease(r.data.release||'Unversioned backend');setLoadedAt(new Date().toLocaleString());setError('');}catch(e:any){setFeatures([]);setError(e.response?.data?.message||'Current backend feature status could not be loaded.');}finally{setLoading(false);}},[]);
 useEffect(()=>{load();},[load]);
 return <Card title="Administrator feature status" extra={<Button onClick={load} loading={loading}>Refresh from backend</Button>}><Alert type="info" showIcon message="Implementation status" description="Connected workflows still need acceptance checks using your actual school records. Each row describes the available scope; it does not certify the whole module." style={{marginBottom:16}}/>{error?<Alert type="error" message={error}/>:<Typography.Paragraph>Backend release: <Typography.Text code>{release}</Typography.Text> · Checked: {loadedAt||'Loading'}</Typography.Paragraph>}<Table loading={loading} rowKey="path" pagination={false} dataSource={features} columns={[{title:'Feature',dataIndex:'title'},{title:'Status',dataIndex:'status',render:(s:string)=><Tag color={s==='implemented'?'green':s==='read_only'?'blue':'orange'}>{s.replace('_',' ')}</Tag>},{title:'Details',dataIndex:'reason'},{title:'Open',dataIndex:'path',render:(path:string)=>path.includes(':')?'Requires a genuine record':<Link to={path}><Button size="small">Open</Button></Link>}]}/></Card>;
};
