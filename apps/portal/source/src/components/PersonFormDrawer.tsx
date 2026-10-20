import React,{useEffect,useRef,useState} from 'react';
import {Alert,App,Button,Drawer,Form,Input,Select,Space,Spin,Typography} from 'antd';
import {Link} from 'react-router-dom';
import {apiClient} from '../services/api';
type Kind='students'|'teachers'|'staff';
export const PersonFormDrawer:React.FC<{open:boolean;kind:Kind;id?:string|number|null;onClose:()=>void;onSaved:()=>void}>=({open,kind,id,onClose,onSaved})=>{
 const [form]=Form.useForm();const {message}=App.useApp();const [error,setError]=useState<string|null>(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[options,setOptions]=useState<any>({}),[version,setVersion]=useState<number>();const command=useRef('');
 const label=kind==='students'?'student':kind==='teachers'?'teacher':'staff member';
 useEffect(()=>{if(!open)return;let cancelled=false;command.current=crypto.randomUUID();form.resetFields();setError(null);setLoading(true);setVersion(undefined);
  (async()=>{try{const r=await apiClient.get(`/api/admin/${kind}/form-options`);if(cancelled)return;setOptions(r.data.data);if(id){const d=await apiClient.get(`/api/admin/${kind}/${id}`);if(cancelled)return;form.setFieldsValue(d.data.data);setVersion(d.data.data.version);}}catch(e:any){if(!cancelled)setError(e.response?.data?.message||'The form could not be loaded.');}finally{if(!cancelled)setLoading(false);}})();return()=>{cancelled=true;};
 },[open,kind,id,form]);
 const save=async()=>{try{const values=await form.validateFields();setSaving(true);setError(null);const headers={'Idempotency-Key':command.current};const r=id?await apiClient.put(`/api/admin/${kind}/${id}`,{...values,version},{headers}):await apiClient.post(`/api/admin/${kind}`,values,{headers});message.success(r.data.message);command.current=crypto.randomUUID();onSaved();onClose();}catch(e:any){if(!e.response){if(!e.errorFields)setError('Connection interrupted. Retry keeps the same command to avoid duplicates.');return;}const fields=e.response.data?.errors;if(fields)form.setFields(Object.entries(fields).map(([name,errors])=>({name,errors:errors as string[]})));setError(e.response.data?.message||'The record could not be saved.');}finally{setSaving(false);}};
 return <Drawer open={open} onClose={onClose} width={650} title={`${id?'Edit':'New'} ${label}`} extra={<Space><Button onClick={onClose}>Cancel</Button><Button type="primary" loading={saving} disabled={loading} onClick={save}>{id?'Save changes':`Create ${label}`}</Button></Space>}>
 <Alert showIcon type="info" message="Use actual school records" description={<><Link to="/settings" onClick={onClose}>School settings</Link> and a current year in <Link to="/academics" onClick={onClose}>Academics</Link> are required before saving. Creating a record does not issue a login password.</>} style={{marginBottom:16}}/>
 {error&&<Alert showIcon type="error" message={error} style={{marginBottom:16}}/>}{loading?<Spin/>:<Form form={form} layout="vertical">
 <Form.Item name="name" label="Full name" rules={[{required:true}]}><Input maxLength={160}/></Form.Item>
 <Form.Item name="firstName" label="First name"><Input maxLength={160}/></Form.Item><Form.Item name="lastName" label="Last name"><Input maxLength={160}/></Form.Item>
 <Form.Item name="email" label="Email" rules={[{required:kind==='teachers'},{type:'email'}]}><Input maxLength={254}/></Form.Item>
 {kind==='students'?<Alert type="info" showIcon message="Student mobile is not collected" description="Use the parent or guardian mobile when linking siblings. A household number may be shared by multiple students." style={{marginBottom:16}}/>:<Form.Item name="mobile" label="Mobile" rules={[{required:kind==='teachers'},{pattern:/^\+?[0-9]{7,15}$/,message:'Enter 7–15 digits with optional leading +'}]}><Input maxLength={16}/></Form.Item>}
 {kind!=='students'&&<Form.Item name="alternateMobile" label="Alternate mobile" rules={[{pattern:/^\+?[0-9]{7,15}$/,message:'Enter 7–15 digits with optional leading +'}]}><Input maxLength={16}/></Form.Item>}
 <Form.Item name="aadhaarNumber" label="Aadhaar number (optional)" rules={[{pattern:/^[0-9]{12}$/,message:'Enter exactly 12 digits, or leave blank'}]}><Input maxLength={12}/></Form.Item>
 <Form.Item name="gender" label="Gender"><Select allowClear options={(options.genders||[])} /></Form.Item>
 <Form.Item name="dateOfBirth" label="Date of birth"><Input type="date"/></Form.Item>
 <Form.Item name="bloodGroup" label="Blood group"><Select allowClear options={['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(value=>({value,label:value}))}/></Form.Item>
 {kind==='students'?<>
 <Form.Item name="registrationNumber" label="Admission number" rules={[{required:true}]}><Input maxLength={50}/></Form.Item>
 <Form.Item name="rollNumber" label="Roll number" rules={[{required:true}]}><Input maxLength={50}/></Form.Item>
 <Form.Item name="sectionId" label="Class and section" rules={[{required:true}]}><Select options={options.sections||[]} notFoundContent={<Link to="/academics" onClick={onClose}>Add the actual classes and sections first</Link>}/></Form.Item>
 <Form.Item name="enrollmentDate" label="Enrollment date" rules={[{required:true}]}><Input type="date"/></Form.Item>
 </>:<>
 <Form.Item name="employeeId" label="Employee ID" rules={[{required:true}]}><Input maxLength={30}/></Form.Item>
 <Form.Item name="designation" label="Designation" rules={[{required:true}]}>{kind==='teachers'?<Select options={options.designations||[]}/>:<Input maxLength={80}/>}</Form.Item>
 <Form.Item name="joiningDate" label="Joining date" rules={[{required:true}]}><Input type="date"/></Form.Item>
 {kind==='teachers'&&<><Form.Item name="jobType" label="Job type" rules={[{required:true}]}><Select options={options.jobTypes||[]}/></Form.Item><Form.Item name="subDesignation" label="Additional designation"><Select allowClear options={options.designations||[]} placeholder="Select additional designation"/></Form.Item><Form.Item name="ugDegree" label="UG degree"><Input maxLength={150}/></Form.Item><Form.Item name="pgDegree" label="PG degree"><Input maxLength={150}/></Form.Item><Form.Item name="specialization" label="Specialization"><Input maxLength={255}/></Form.Item><Form.Item name="interestedIn" label="Interests"><Input.TextArea maxLength={500}/></Form.Item><Form.Item name="reportingTo" label="Reports to"><Select allowClear options={(options.reportingTo||[]).filter((o:any)=>o.value!==id)}/></Form.Item></>}
 </>}
 <Form.Item name="address" label="Address"><Input.TextArea maxLength={500}/></Form.Item><Form.Item name="city" label="City"><Input maxLength={100}/></Form.Item><Form.Item name="pincode" label="Postal code"><Input maxLength={12}/></Form.Item>
 <Typography.Text type="secondary">Contact and academic information is private to this school’s authorized users.</Typography.Text>
 </Form>}
 </Drawer>;
};
