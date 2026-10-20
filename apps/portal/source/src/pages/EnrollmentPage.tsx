import React, { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

export const EnrollmentPage: React.FC = () => {
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[completed,setCompleted]=useState<string|null>(null);
 const submit=async(values:{schoolCode:string;token:string;password:string;confirmation:string})=>{
  setBusy(true);setError(null);
  try {
   const response=await axios.post(`${API_BASE_URL}/api/portal/enrollment/accept`,{schoolCode:values.schoolCode.trim().toUpperCase(),token:values.token.trim(),password:values.password},{headers:{'x-school-code':values.schoolCode.trim().toUpperCase(),'Content-Type':'application/json'}});
   setCompleted(response.data.message);
  }catch(e:any){
   const code=e.response?.data?.error;
   setError(code==='FREE_ENROLLMENT_CPU_VERIFICATION_REQUIRED'?'Secure administrator enrollment is awaiting the authentication performance check. Your invitation has not been consumed.':code==='ENROLLMENT_INVALID_OR_EXPIRED'?'The invitation is invalid, expired, revoked or already used. Request a new invitation from the platform owner.':e.response?.data?.message||'Enrollment could not be completed.');
  }finally{setBusy(false);}
 };
 return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#f5f7fb',padding:16}}><Card style={{width:'100%',maxWidth:480}}>
  <Typography.Title level={3}>Administrator enrollment</Typography.Title>
  <Typography.Paragraph>Use the private, single-use invitation provided by the platform owner and choose your own password. Invitations expire after 24 hours.</Typography.Paragraph>
  {error&&<Alert type="error" showIcon message={error} style={{marginBottom:16}}/>}
  {completed?<Alert type="success" showIcon message={completed}/>:<Form layout="vertical" onFinish={submit} requiredMark={false}>
   <Form.Item name="schoolCode" label="School code" rules={[{required:true,message:'Enter the school code'}]}><Input autoComplete="organization"/></Form.Item>
   <Form.Item name="token" label="Private invitation token" rules={[{required:true,message:'Enter your invitation token'},{pattern:/^[A-Za-z0-9_-]{43}$/,message:'Use the complete invitation token'}]}><Input.Password autoComplete="off"/></Form.Item>
   <Form.Item name="password" label="Choose password" rules={[{required:true,message:'Choose a password'},{min:12,message:'Use at least 12 characters'},{validator:(_,v)=>!v||new TextEncoder().encode(v).length<=72?Promise.resolve():Promise.reject(new Error('Use at most 72 UTF-8 bytes'))}]}><Input.Password autoComplete="new-password"/></Form.Item>
   <Form.Item name="confirmation" label="Confirm password" dependencies={['password']} rules={[{required:true,message:'Confirm your password'},({getFieldValue})=>({validator:(_,v)=>v===getFieldValue('password')?Promise.resolve():Promise.reject(new Error('Passwords must match'))})]}><Input.Password autoComplete="new-password"/></Form.Item>
   <Button type="primary" htmlType="submit" block loading={busy}>Complete enrollment</Button>
  </Form>}
  <Typography.Paragraph style={{marginTop:16,marginBottom:0}}><Link to="/login">Back to sign in</Link></Typography.Paragraph>
 </Card></main>;
};
