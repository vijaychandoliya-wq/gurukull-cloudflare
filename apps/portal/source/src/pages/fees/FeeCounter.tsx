import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Card,Descriptions,Empty,Form,Input,Modal,Radio,Select,Space,Steps,Table,Typography} from 'antd';
import {MoneyInput} from '../../components/portal/UX';
import {money,displayValue} from '../../ux/format';
import {apiClient} from '../../services/api';
import {feeError,schoolToday,useFeeResource,useFeeText} from './feeHelpers';
import {FeeReceipt} from './FeeReceipt';
import {useAuth} from '../../context/AuthContext';
import {readPendingPayment,type PendingPayment} from './pendingPayment';

type Props={context:any;policy:any;onDirty:(dirty:boolean)=>void;onSettings:()=>void;onAddCharge:(student:any,refresh:()=>void)=>void;onCancelCharge:(invoice:any,refresh:()=>void)=>void};
export function FeeCounter({context,policy,onDirty,onSettings,onAddCharge,onCancelCharge}:Props){
 const {user,schoolCode}=useAuth(),storageKey=user&&schoolCode?'gk-fee-pending:'+schoolCode+':'+user.id:null;
 const t=useFeeText(),[query,setQuery]=useState(''),[page,setPage]=useState(1),[student,setStudent]=useState<any>(),[invoice,setInvoice]=useState<any>(),[invoicePage,setInvoicePage]=useState(1),[error,setError]=useState(''),[review,setReview]=useState<any>(),[busy,setBusy]=useState(false),[pending,setPending]=useState<PendingPayment|undefined>(()=>readPendingPayment(storageKey)),[receiptId,setReceiptId]=useState<string>();const [form]=Form.useForm();const lock=useRef(false),search=useRef<ReturnType<typeof setTimeout>>();const [searchInput,setSearchInput]=useState('');
 const students=useFeeResource(context&&!student?'/api/admin/fees/counter/students':null,{q:query,page,per_page:10});
 const [history,setHistory]=useState(false);
 const details=useFeeResource(student?'/api/admin/fees/counter/students/'+encodeURIComponent(student.id):null,{page:invoicePage,per_page:20,history:history?1:undefined});
 const amount=Form.useWatch('amountMinor',form),concession=Form.useWatch('concessionMinor',form)||0,method=Form.useWatch('paymentMode',form);const [showConcession,setShowConcession]=useState(false);
 useEffect(()=>{onDirty((!!invoice||!!pending)&&!receiptId);return()=>onDirty(false);},[invoice,pending,receiptId,onDirty]);
 useEffect(()=>()=>clearTimeout(search.current),[]);
 const reset=()=>{setStudent(undefined);setInvoice(undefined);setReview(undefined);setPending(undefined);setReceiptId(undefined);setError('');form.resetFields();};
 const choose=(row:any)=>{setInvoice(row);setError('');setReview(undefined);setPending(undefined);setShowConcession(false);form.setFieldsValue({amountMinor:row.balanceMinor,concessionMinor:0,paymentMode:undefined,paidOn:schoolToday(context.timezone),transactionRef:'',remarks:''});};
 const clearPending=()=>{if(storageKey)sessionStorage.removeItem(storageKey);setPending(undefined);};
 const finish=(id:string)=>{setReceiptId(id);clearPending();setReview(undefined);setError('');details.refresh();};
 const check=async()=>{if(!pending)return;try{setBusy(true);const r=await apiClient.get('/api/admin/fees/counter/commands/'+pending.key);if(r.data.data?.receiptId)finish(r.data.data.receiptId);else setError('No confirmed result is available yet. Retry the same payment below; it uses the original request to prevent duplicates.');}catch(e){setError(feeError(e));}finally{setBusy(false);}};
 const submit=async(command:PendingPayment)=>{if(lock.current)return;lock.current=true;setBusy(true);setPending(command);setReview(undefined);setError('');
  try{if(storageKey)sessionStorage.setItem(storageKey,JSON.stringify(command));}catch{setPending(undefined);setError('Your browser could not retain the payment recovery request. No payment was submitted. Enable tab storage and try again.');lock.current=false;setBusy(false);return;}
  try{const r=await apiClient.post('/api/admin/fees/payments',command.body,{headers:{'Idempotency-Key':command.key}});if(!r.data.data?.id)throw Error('The server did not confirm a receipt. Check payment status.');finish(r.data.data.id);}catch(e:any){if(e.response&&e.response.status>=400&&e.response.status<500){clearPending();setError(feeError(e));if(e.response.data?.errors)form.setFields(Object.entries(e.response.data.errors).map(([name,errors])=>({name,errors:errors as string[]})));if(e.response.status===409){setInvoice(undefined);details.refresh();}}else setError('We could not confirm whether this payment was recorded. Check payment status or retry the same request.');}finally{lock.current=false;setBusy(false);}};
 const reviewPayment=async()=>{try{const values=await form.validateFields();setError('');if(!invoice||!Number.isSafeInteger(values.amountMinor)||values.amountMinor<=0||!Number.isSafeInteger(values.concessionMinor)||values.concessionMinor<0||values.amountMinor+values.concessionMinor>invoice.balanceMinor){setError('The amount received plus concession cannot exceed the selected balance.');return;}setReview({...values,invoiceId:invoice.id,version:invoice.version,transactionRef:values.paymentMode==='cash'?null:values.transactionRef});}catch{/* Ant Form highlights the field */}};
 const stage=receiptId?2:invoice||pending?1:0;
 return <Space direction="vertical" size={20} style={{width:'100%'}}>
  <Steps size="small" current={stage} items={[{title:t('Find student')},{title:t('Payment & review')},{title:t('Receipt')}]}/>
  {error&&<Alert type={pending?'warning':'error'} showIcon message={error}/>}
  {receiptId?<><FeeReceipt id={receiptId}/><Button type="primary" onClick={reset}>{t('Next student')}</Button></>:pending?<Card title={busy?'Recording payment…':'Payment status is not confirmed'}><Space wrap><Button loading={busy} onClick={()=>void check()}>{t('Check payment status')}</Button><Button disabled={busy} onClick={()=>void submit(pending)}>{t('Retry same payment')}</Button></Space><Typography.Paragraph type="secondary">The request is retained in this browser tab for this school and administrator. Check its result before starting another payment.</Typography.Paragraph></Card>:<>
   {!student?<Card title={t('Find student')}>
    <Input.Search autoFocus aria-label={t('Search student, admission number or parent mobile')} placeholder={t('Search student, admission number or parent mobile')} value={searchInput} allowClear onChange={e=>{const v=e.target.value;setSearchInput(v);clearTimeout(search.current);search.current=setTimeout(()=>{setQuery(v);setPage(1);},300);}} onSearch={v=>{clearTimeout(search.current);setQuery(v);setPage(1);}}/>
    {students.error&&<Alert type="error" message={students.error} action={<Button onClick={students.refresh}>Retry</Button>}/>}
    <Table<any> rowKey="id" loading={students.loading} dataSource={students.result?.data||[]} pagination={{current:page,pageSize:10,total:students.result?.total||0,onChange:setPage}} locale={{emptyText:students.error?'Student search could not be loaded.':<Empty description="No students match this search in the current school year."/>}} columns={[{title:t('Name'),dataIndex:'fullName'},{title:t('Admission number'),dataIndex:'admissionNo'},{title:t('Class'),dataIndex:'className'},{title:t('Balance'),dataIndex:'balanceMinor',align:'right',render:v=>money(v,context.currency)},{title:'',render:(_,r)=><Button onClick={()=>{setStudent(r);setInvoicePage(1);}}>{t('Open fees')}</Button>}]}/>
   </Card>:<>
    <Space wrap><Button disabled={!!invoice} onClick={reset}>← {t('Change student')}</Button><Typography.Text strong>{student.fullName}</Typography.Text><Typography.Text type="secondary">{student.admissionNo} · {student.className} · {context.name}</Typography.Text></Space>
    {!invoice?<Card title={t('Select a charge')} extra={<Button onClick={()=>onAddCharge(student,details.refresh)}>{t('Add charge')}</Button>}>
     {details.error&&<Alert type="error" message={details.error} action={<Button onClick={details.refresh}>Retry</Button>}/>}
     <Typography.Paragraph type="secondary">Record one charge at a time. A partial payment leaves the remaining amount due.</Typography.Paragraph>
     <Radio.Group value={history} onChange={e=>{setHistory(e.target.value);setInvoicePage(1);}} options={[{value:false,label:'Due charges'},{value:true,label:'All charges'}]} style={{marginBottom:16}}/>
     <Table<any> rowKey="id" loading={details.loading} dataSource={details.result?.data?.invoices||[]} pagination={{current:invoicePage,total:details.result?.total||0,pageSize:20,onChange:setInvoicePage}} locale={{emptyText:details.error?'Charges could not be loaded.':<Empty description="No fees are assigned to this student for the current year."/>}} columns={[{title:t('Fee'),dataIndex:'feeName'},{title:'Period',dataIndex:'term'},{title:t('Due date'),dataIndex:'dueDate',render:v=>displayValue('dueDate',v)},{title:t('Balance'),dataIndex:'balanceMinor',align:'right',render:(v,r)=>money(v,r.currency)},{title:'Status',dataIndex:'status',render:v=>displayValue('status',v)},{title:'',render:(_,r)=><Space wrap><Button type="primary" disabled={r.status==='cancelled'||r.balanceMinor<=0||!policy} onClick={()=>choose(r)}>Record payment</Button>{r.status!=='cancelled'&&r.paidMinor===0&&r.concessionMinor===0&&<Button onClick={()=>onCancelCharge(r,details.refresh)}>Cancel charge</Button>}</Space>}]}/>
    </Card>:<Card title={invoice.feeName} extra={<Button onClick={()=>{setInvoice(undefined);setReview(undefined);}}>← Back to charges</Button>}>
     <Form form={form} layout="vertical" disabled={busy} onFinish={reviewPayment}>
      <Descriptions size="small" items={[{key:'invoice',label:'Invoice',children:invoice.invoiceNo},{key:'balance',label:t('Balance'),children:money(invoice.balanceMinor,invoice.currency)}]}/>
      <div className="gk-fee-counter-grid">
       <Form.Item name="amountMinor" label={t('Amount received')} rules={[{required:true}]}><MoneyInput currency={invoice.currency} min={1} max={invoice.balanceMinor}/></Form.Item>
       <Form.Item name="paymentMode" label={t('Payment method')} rules={[{required:true,message:'Select how the money was received.'}]}><Select options={['cash','upi','bank_transfer','card'].map(value=>({value,label:value==='upi'?'UPI':displayValue('role',value)}))}/></Form.Item>
       <Form.Item name="paidOn" label={t('Date received')} rules={[{required:true}]}><Input type="date" min={context.startsOn} max={context.endsOn<schoolToday(context.timezone)?context.endsOn:schoolToday(context.timezone)}/></Form.Item>
       {method&&method!=='cash'&&<Form.Item name="transactionRef" label={method==='upi'?'UPI transaction reference':'Transaction reference'} rules={[{required:true,whitespace:true,message:'Enter the actual received payment reference.'}]}><Input maxLength={100}/></Form.Item>}
      </div>
      <Form.Item name="remarks" label={concession>0?'Reason for concession':t('Note')+' (optional)'} dependencies={['concessionMinor']} rules={[{validator:(_,value)=>!form.getFieldValue('concessionMinor')||String(value||'').trim()?Promise.resolve():Promise.reject(Error('Enter the reason for the concession.'))}]}><Input maxLength={500} placeholder="Short note for the collection ledger"/></Form.Item>
      <Button type="link" onClick={()=>{setShowConcession(v=>!v);form.setFieldValue('concessionMinor',0);}}> {showConcession?'Remove concession':'Add a concession with this payment'}</Button>
      <Form.Item name="concessionMinor" label={t('Concession')} hidden={!showConcession}><MoneyInput currency={invoice.currency} min={0} max={invoice.balanceMinor}/></Form.Item>
      <Typography.Paragraph>Receiving <strong>{money(amount||0,invoice.currency)}</strong> · {t('Remaining balance')} <strong>{money(invoice.balanceMinor-(amount||0)-concession,invoice.currency)}</strong></Typography.Paragraph>
      <Typography.Paragraph type="secondary">Records money already received. Cheque clearance and concession-only entries are separate workflows.</Typography.Paragraph>
      <Button type="primary" htmlType="submit">{t('Review payment')}</Button>
     </Form>
    </Card>}
   </>}
  </>}
  {!policy&&!receiptId&&<Alert type="info" showIcon message="Finish fee setup before recording new payments" action={<Button onClick={onSettings}>{t('Fee settings')}</Button>}/>}
  <Modal title="Confirm payment" open={!!review} onCancel={()=>setReview(undefined)} okText={review?'Record '+money(review.amountMinor,invoice?.currency)+' and create receipt':'Record payment'} onOk={()=>review&&void submit({body:review,key:crypto.randomUUID()})} confirmLoading={busy}>
   {review&&<Descriptions column={1} items={[{key:'student',label:t('Name'),children:student?.fullName+' · '+student?.admissionNo},{key:'fee',label:t('Fee'),children:invoice?.feeName},{key:'amount',label:t('Amount received'),children:money(review.amountMinor,invoice?.currency)},{key:'concession',label:t('Concession'),children:money(review.concessionMinor,invoice?.currency)},{key:'method',label:t('Payment method'),children:displayValue('role',review.paymentMode)},{key:'ref',label:'Reference',children:review.transactionRef||'—'},{key:'date',label:t('Date received'),children:review.paidOn},{key:'remaining',label:t('Remaining balance'),children:money(invoice?.balanceMinor-review.amountMinor-review.concessionMinor,invoice?.currency)}]}/>}
  </Modal>
 </Space>;
}
