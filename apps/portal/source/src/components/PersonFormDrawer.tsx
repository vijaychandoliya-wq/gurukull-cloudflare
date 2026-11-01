import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, App, Button, Drawer, Flex, Form, Input, Select, Space, Spin, Steps, Typography, Upload, Descriptions, Collapse} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import {Link} from 'react-router-dom';
import {ErrorSummary,useDirtyForm} from './portal/UX';
import {humanize,displayValue} from '../ux/format';
import {apiClient} from '../services/api';
import {AuthenticatedAvatar, UserAvatar} from './UserAvatar';

type Kind = 'students' | 'teachers' | 'staff';
const labels:Record<Kind,string> = {students:'student',teachers:'teacher',staff:'staff member'};

function errorMessage(error:any, label:string) {
  if (error?.errorFields?.length) return 'Review the highlighted fields before saving.';
  const response=error?.response?.data;
  if (response?.error==='DUPLICATE_RECORD') return `This ${label} conflicts with an existing record. Check the email, mobile number, admission/employee ID, and roll number.`;
  if (response?.error==='SCHOOL_SETUP_REQUIRED') return 'School setup is incomplete. Save the school timezone, currency, address, and a current academic year before adding people.';
  if (response?.error==='INVALID_SECTION') return 'The selected class or section is no longer available. Reload the form and choose an active section.';
  if (response?.error==='INVALID_RELATIONSHIP') return 'One of the selected school links changed. Reload the form and select the class, section, or account again.';
  if (response?.error==='MANAGEMENT_WRITE_FAILED') return 'The database rejected a related record. Reload the form, check every highlighted value, and try again.';
  return response?.message || `The ${label} could not be saved. Check every required field and try again.`;
}

export const PersonFormDrawer:React.FC<{open:boolean;kind:Kind;id?:string|number|null;onClose:()=>void;onSaved:(id?:string|number)=>void}>=({open,kind,id,onClose,onSaved})=>{
 const [form]=Form.useForm(); const {message}=App.useApp();
 const [error,setError]=useState<string|null>(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[options,setOptions]=useState<any>({}),[version,setVersion]=useState<number>();
 const [setupState,setSetupState]=useState<'loading'|'ready'|'missing'>('loading');
 const [step,setStep]=useState(0); const [dirty,setDirty]=useState(false); const [fieldErrors,setFieldErrors]=useState<{name:string;label:string;errors:string[]}[]>([]); const guardClose=useDirtyForm(open&&dirty); const close=()=>{if(!saving)guardClose(onClose);}; const [photoFile,setPhotoFile]=useState<File|null>(null); const [photoPreview,setPhotoPreview]=useState<string|null>(null); const [avatarPath,setAvatarPath]=useState<string|null>(null); const command=useRef(''); const label=labels[kind];
 useEffect(()=>()=>{if(photoPreview?.startsWith('blob:'))URL.revokeObjectURL(photoPreview);},[photoPreview]);
 const steps=useMemo(()=>kind==='students'?['Identity & contact','Enrollment','Additional details','Review']:['Identity & contact','Employment','Additional details','Review'],[kind]);
 const groups=useMemo(()=>kind==='students'?[['name','firstName','lastName','email','gender','dateOfBirth','bloodGroup'],['registrationNumber','rollNumber','sectionId','enrollmentDate'],['address','city','pincode','aadhaarNumber']]:[['name','firstName','lastName','email','mobile','alternateMobile','gender','dateOfBirth','bloodGroup'],['employeeId','designation','joiningDate','jobType'],['address','city','pincode','aadhaarNumber','subDesignation','reportingTo','ugDegree','pgDegree','specialization','interestedIn']],[kind]);

 useEffect(()=>{if(!open)return;let cancelled=false;command.current=crypto.randomUUID();form.resetFields();setError(null);setFieldErrors([]);setDirty(false);setStep(0);setPhotoFile(null);setPhotoPreview(null);setAvatarPath(null);setLoading(true);setSetupState('loading');setVersion(undefined);
  (async()=>{try{const [optionsResponse,setupResponse]=await Promise.all([apiClient.get(`/api/admin/${kind}/form-options`),apiClient.get('/api/admin/setup')]);if(cancelled)return;setOptions(optionsResponse.data.data);const setup=setupResponse.data.data;const ready=Boolean(setup.configuration?.configuration_verified_at)&&setup.academicYears?.some((year:any)=>Boolean(year.isCurrent));setSetupState(ready?'ready':'missing');if(id){const d=await apiClient.get(`/api/admin/${kind}/${id}`);if(cancelled)return;form.setFieldsValue(d.data.data);setVersion(d.data.data.version);setAvatarPath(d.data.data.avatar||null);}}catch(e:any){if(!cancelled){setSetupState('missing');setError(e.response?.data?.message||`The ${label} form could not be loaded.`);}}finally{if(!cancelled)setLoading(false);}})();return()=>{cancelled=true;};
 },[open,kind,id,form,label]);

 const goNext=async()=>{try{await form.validateFields(groups[step]);setError(null);setFieldErrors([]);setStep(value=>Math.min(value+1,steps.length-1));}catch(e:any){setError(errorMessage(e,label));}};
 const goBack=()=>{setError(null);setStep(value=>Math.max(value-1,0));};
 const save=async()=>{try{await form.validateFields();const values=form.getFieldsValue(groups.flat());setSaving(true);setError(null);const headers={'Idempotency-Key':command.current};const r=id?await apiClient.put(`/api/admin/${kind}/${id}`,{...values,version},{headers}):await apiClient.post(`/api/admin/${kind}`,values,{headers});const savedId=r.data.data?.id||id;let photoWarning='';if(photoFile&&savedId){try{await apiClient.post(`/api/admin/${kind}/${savedId}/avatar`,photoFile,{headers:{'Content-Type':photoFile.type,'x-file-name':photoFile.name}});}catch(e:any){photoWarning=e.response?.data?.message||'The person was saved, but the photo could not be uploaded.';}}message[photoWarning?'warning':'success'](photoWarning||r.data.message);command.current=crypto.randomUUID();setDirty(false);onSaved(savedId);onClose();}catch(e:any){const fields=e?.response?.data?.errors;if(fields)form.setFields(Object.entries(fields).map(([name,errors])=>({name,errors:Array.isArray(errors)?errors as string[]:[String(errors)]})));const errors=fields?Object.entries(fields).map(([name,errors])=>({name,label:humanize(name),errors:Array.isArray(errors)?errors.map(String):[String(errors)]})):(e.errorFields||[]).map((f:any)=>({name:String(f.name[0]),label:humanize(String(f.name[0])),errors:f.errors}));setFieldErrors(errors);if(errors[0]){setStep(Math.max(0,groups.findIndex(group=>group.includes(errors[0].name))));setTimeout(()=>form.scrollToField(errors[0].name,{focus:true}),50);}setError(errorMessage(e,label));}finally{setSaving(false);}};

 const choosePhoto=(file:File)=>{if(!['image/jpeg','image/png'].includes(file.type)||file.size>2*1024*1024){message.error('Choose a JPEG or PNG photo smaller than 2 MB.');return Upload.LIST_IGNORE;}setDirty(true);if(photoPreview?.startsWith('blob:'))URL.revokeObjectURL(photoPreview);setPhotoFile(file);setPhotoPreview(URL.createObjectURL(file));return false;};

 const identity=<>
  <Form.Item name="name" label="Full name" rules={[{required:true,message:'Enter the person’s full name.'}]}><Input maxLength={160} placeholder="e.g. Nandini Sharma"/></Form.Item>
  <Form.Item label="Profile photo"><Flex align="center" gap={14}><span>{photoPreview?<UserAvatar name={form.getFieldValue('name')||label} src={photoPreview} size={72}/>:<AuthenticatedAvatar name={form.getFieldValue('name')||label} src={avatarPath} size={72}/>}</span><Space direction="vertical" size={2}><Upload accept="image/jpeg,image/png" maxCount={1} showUploadList={false} beforeUpload={choosePhoto}><Button icon={<UploadOutlined />}>Choose photo</Button></Upload><Typography.Text type="secondary">JPEG or PNG, up to 2 MB. Photos are private to this school.</Typography.Text></Space></Flex></Form.Item>
  <Flex gap={12} wrap="wrap"><Form.Item name="firstName" label="First name" style={{flex:1,minWidth:220}}><Input maxLength={160}/></Form.Item><Form.Item name="lastName" label="Last name" style={{flex:1,minWidth:220}}><Input maxLength={160}/></Form.Item></Flex>
  <Form.Item name="email" label="Email" rules={[{required:kind==='teachers',message:'Teacher email is required for login and delivery.'},{type:'email',message:'Enter a complete email address, for example name@school.com.'}]}><Input maxLength={254} placeholder="name@example.com"/></Form.Item>
  {kind==='students'?<Alert type="info" showIcon message="Student mobile is not collected" description="Use the parent or guardian mobile when linking siblings. A household number may be shared by multiple students." style={{marginBottom:16}}/>:<Form.Item name="mobile" label="Mobile number" rules={[{required:kind==='teachers',message:'Teacher mobile is required for login.'},{pattern:/^\+?[0-9]{7,15}$/,message:'Enter 7–15 digits with an optional leading +.'}]}><Input maxLength={16} placeholder="+91 9876543210"/></Form.Item>}
  {kind!=='students'&&<Form.Item name="alternateMobile" label="Alternate mobile" rules={[{pattern:/^\+?[0-9]{7,15}$/,message:'Enter 7–15 digits with an optional leading +, or leave blank.'}]}><Input maxLength={16}/></Form.Item>}
  <Flex gap={12} wrap="wrap"><Form.Item name="gender" label="Gender" style={{flex:1,minWidth:180}}><Select allowClear options={options.genders||[]}/></Form.Item><Form.Item name="dateOfBirth" label="Date of birth" style={{flex:1,minWidth:180}}><Input type="date"/></Form.Item><Form.Item name="bloodGroup" label="Blood group" style={{flex:1,minWidth:180}}><Select allowClear options={['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(value=>({value,label:value}))}/></Form.Item></Flex>
 </>;
 const placement=kind==='students'?<>
  <Alert type="info" showIcon message="Enrollment details" description="Use the real admission and roll numbers. The selected class and section must belong to the current academic year." style={{marginBottom:16}}/>
  <Form.Item name="registrationNumber" label="Admission number" rules={[{required:true,message:'Enter the student’s admission number.'}]}><Input maxLength={50} placeholder="e.g. MGGS-2026-001"/></Form.Item>
  <Form.Item name="rollNumber" label="Roll number" rules={[{required:true,message:'Enter the student’s roll number.'}]}><Input maxLength={50} placeholder="e.g. 1"/></Form.Item>
  <Form.Item name="sectionId" label="Class and section" rules={[{required:true,message:'Select the student’s current class and section.'}]}><Select showSearch optionFilterProp="label" options={options.sections||[]} notFoundContent={<Link to="/academics" onClick={onClose}>Add the actual classes and sections first</Link>}/></Form.Item>
  <Form.Item name="enrollmentDate" label="Enrollment date" rules={[{required:true,message:'Select the enrollment date.'}]}><Input type="date"/></Form.Item>
 </>:<>
  <Alert type="info" showIcon message="Employment details" description="Employee ID is optional. If left blank, the system will generate a unique ID after saving." style={{marginBottom:16}}/>
  <Form.Item name="employeeId" label="Employee ID"><Input maxLength={30} placeholder="Leave blank to generate automatically"/></Form.Item>
  <Form.Item name="designation" label="Designation" rules={[{required:true,message:'Select or enter the person’s designation.'}]}>{kind==='teachers'?<Select options={options.designations||[]} showSearch/>:<Input maxLength={80}/>}</Form.Item>
  <Flex gap={12} wrap="wrap"><Form.Item name="joiningDate" label="Joining date" rules={[{required:true,message:'Select the joining date.'}]} style={{flex:1,minWidth:220}}><Input type="date"/></Form.Item>{kind==='teachers'&&<Form.Item name="jobType" label="Job type" rules={[{required:true,message:'Select full-time or part-time.'}]} style={{flex:1,minWidth:220}}><Select options={options.jobTypes||[]}/></Form.Item>}</Flex>
 </>;
 const additional=<>
  {kind==='teachers'&&<><Form.Item name="subDesignation" label="Additional designation"><Select allowClear options={options.designations||[]} placeholder="Optional"/></Form.Item><Form.Item name="reportingTo" label="Reports to"><Select allowClear options={(options.reportingTo||[]).filter((o:any)=>o.value!==id)} placeholder="Optional"/></Form.Item><Flex gap={12} wrap="wrap"><Form.Item name="ugDegree" label="UG degree" style={{flex:1,minWidth:220}}><Input maxLength={150}/></Form.Item><Form.Item name="pgDegree" label="PG degree" style={{flex:1,minWidth:220}}><Input maxLength={150}/></Form.Item></Flex><Form.Item name="specialization" label="Specialization"><Input maxLength={255}/></Form.Item><Form.Item name="interestedIn" label="Interests"><Input.TextArea maxLength={500}/></Form.Item></>}
  <Form.Item name="aadhaarNumber" label="Aadhaar number (optional)" rules={[{pattern:/^[0-9]{12}$/,message:'Enter exactly 12 digits, or leave blank.'}]}><Input maxLength={12}/></Form.Item><Form.Item name="address" label="Address"><Input.TextArea maxLength={500}/></Form.Item><Flex gap={12} wrap="wrap"><Form.Item name="city" label="City" style={{flex:1,minWidth:220}}><Input maxLength={100}/></Form.Item><Form.Item name="pincode" label="Postal code" style={{flex:1,minWidth:220}}><Input maxLength={12}/></Form.Item></Flex><Typography.Text type="secondary">Contact and academic information is private to this school’s authorized users.</Typography.Text>
 </>;

 return <Drawer open={open} onClose={close} width={650} className="gk-person-drawer" maskClosable={!saving} closable={!saving} title={`${id?'Edit':'New'} ${label}`} destroyOnClose footer={<Flex justify="space-between"><Button disabled={saving} onClick={close}>Cancel</Button><Space>{step>0&&<Button disabled={saving} onClick={goBack}>Back</Button>}{step<steps.length-1?<Button type="primary" onClick={goNext}>Next</Button>:<Button type="primary" loading={saving} disabled={loading||setupState==='missing'} onClick={save}>{id?'Save changes':`Create ${label}`}</Button>}</Space></Flex>}>
  {setupState!=='ready'&&<Alert showIcon type="warning" message={setupState==='loading'?'Checking school setup…':'Complete school setup before saving'} description={<><Link to="/settings" onClick={close}>School settings</Link> and a current year in <Link to="/academics" onClick={close}>Academics</Link> must be saved before adding this {label}.</>} style={{marginBottom:16}}/>}
  <Steps size="small" current={step} items={steps.map(title=>({title}))} style={{marginBottom:24}}/>
  {error&&<ErrorSummary message={error} fields={fieldErrors} onField={name=>{setStep(Math.max(0,groups.findIndex(group=>group.includes(name))));setTimeout(()=>form.scrollToField(name,{focus:true}),50);}}/>}
  {loading?<Spin/>:<Form form={form} layout="vertical" onValuesChange={()=>setDirty(true)}>
   <div hidden={step!==0}>{identity}</div><div hidden={step!==1}>{placement}</div><div hidden={step!==2}>{additional}</div>
   {step===3&&<><Typography.Title level={4}>Review {label} details</Typography.Title><Typography.Paragraph type="secondary">Check the information below before {id?'saving your changes':'creating this record'}. Account access is managed separately after saving.</Typography.Paragraph><Descriptions bordered column={1} size="small" items={Object.entries(form.getFieldsValue(groups.flat())).filter(([key,value])=>value!==undefined&&value!==null&&value!==''&&!['version','avatar','avatarKey'].includes(key)).map(([key,value])=>({key,label:humanize(key),children:displayValue(key,[...(options.sections||[]),...(options.designations||[]),...(options.jobTypes||[]),...(options.reportingTo||[])].find((o:any)=>o.value===value)?.label||value)}))}/>{photoPreview&&<Typography.Paragraph>Profile photo selected.</Typography.Paragraph>}</>}
  </Form>}

 </Drawer>;
};
