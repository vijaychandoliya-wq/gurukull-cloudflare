import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Button,Card,Descriptions,Empty,Flex,Skeleton,Space,Table,Tag,Typography} from 'antd';
import {ArrowLeftOutlined,EditOutlined} from '@ant-design/icons';
import {Link,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {apiClient} from '../services/api';
import {PersonFormDrawer} from '../components/PersonFormDrawer';
import {AuthenticatedAvatar} from '../components/UserAvatar';
import {ModuleTabs} from '../components/portal/ModuleTabs';
import {humanize,displayValue} from '../ux/format';
export const PersonDetailPage:React.FC<{kind:'students'|'teachers'|'staff'}>=({kind})=>{
 const {id}=useParams(),navigate=useNavigate(),[query]=useSearchParams();
 const [data,setData]=useState<any>(),[error,setError]=useState<string|null>(null),[edit,setEdit]=useState(query.get('edit')==='1');
 const load=useCallback(async()=>{try{const r=await apiClient.get(`/api/admin/${kind}/${encodeURIComponent(id||'')}`);setData(r.data.data);setError(null);}catch(e:any){setError(e.response?.data?.message||'This record could not be loaded.');}},[id,kind]);useEffect(()=>{setData(undefined);void load();},[load]);
 const details=(keys:string[])=><Descriptions bordered size="small" column={{xs:1,sm:1,md:2}} items={keys.filter(k=>data&&k in data).map(key=>({key,label:humanize(key),children:displayValue(key,data[key+'Label']||data[key])}))}/>;
 return <Space direction="vertical" size={24} style={{width:'100%'}}>
  <Button type="text" icon={<ArrowLeftOutlined/>} onClick={()=>window.history.state?.idx>0?navigate(-1):navigate('/'+kind)}>Back to {kind}</Button>
  {error?<Alert type="error" showIcon message={error} action={<Button onClick={load}>Retry</Button>}/>:!data?<Skeleton active/>:<>
   <Flex wrap gap={16} align="center" justify="space-between" className="gk-record-header"><Space size={16}><AuthenticatedAvatar size={64} name={data.fullName||data.name} src={data.avatar}/><div><Typography.Title level={2} style={{margin:0}}>{data.fullName||data.name}</Typography.Title><Typography.Text type="secondary">{data.registrationNumber||data.employeeId||'Identifier not supplied'} · {data.className||data.designationLabel||humanize(kind)}</Typography.Text><div><Tag color={data.status==='active'?'green':'default'}>{humanize(data.status||'unknown')}</Tag></div></div></Space><Button type="primary" icon={<EditOutlined/>} onClick={()=>setEdit(true)}>Edit details</Button></Flex>
   <ModuleTabs items={[
    {key:'overview',label:'Overview',children:<Card>{details(['firstName','lastName','gender','dateOfBirth','bloodGroup','status'])}</Card>},
    {key:'contact',label:'Contact',children:<Card>{details(['email','mobile','alternateMobile','address','city','pincode'])}</Card>},
    {key:'placement',label:kind==='students'?'Enrollment':'Employment',children:<Card>{details(kind==='students'?['registrationNumber','rollNumber','className','academicYear','enrollmentDate']:['employeeId','designation','subDesignation','jobType','joiningDate','reportingTo'])}</Card>},
    ...(kind==='teachers'?[{key:'qualifications',label:'Qualifications',children:<Card>{details(['ugDegree','pgDegree','specialization','interestedIn'])}</Card>}]:[]),
    ...(kind==='students'?[{key:'family',label:'Family',children:<Card><Table rowKey="id" dataSource={data.parents||[]} pagination={false} locale={{emptyText:<Empty description="No parent or guardian linked yet"><Link to="/parents">Manage parent links</Link></Empty>}} columns={[{title:'Name',dataIndex:'name'},{title:'Relationship',dataIndex:'relation',render:(v:string)=>displayValue('role',v)},{title:'Email',dataIndex:'email'},{title:'Mobile',dataIndex:'mobile'}]}/></Card>}]:[]),
    {key:'access',label:'Account access',children:<Card><Typography.Paragraph>Login credentials and delivery status are managed from Users & access. Existing passwords cannot be recovered; a replacement invalidates the old credential.</Typography.Paragraph><Link to={'/roles?role='+(kind==='students'?'student':kind==='teachers'?'teacher':'staff')}>Manage account access</Link></Card>},
   ]}/>
  </>}
  <PersonFormDrawer open={edit} kind={kind} id={id} onClose={()=>setEdit(false)} onSaved={load}/>
 </Space>;
};
