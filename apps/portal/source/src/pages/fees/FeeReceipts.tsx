import {useState} from 'react';
import {Alert,Button,Descriptions,Input,Modal,Space,Table,Typography} from 'antd';
import {money,displayValue} from '../../ux/format';
import {apiClient} from '../../services/api';
import {FeeReceipt} from './FeeReceipt';
import {FeeCommandForm,type Field} from './FeeCommandForm';
import {feeError,useFeeResource} from './feeHelpers';

export function FeeReceipts({currency,currentYear=true}:{currency:string;currentYear?:boolean}){
 const [q,setQ]=useState(''),[page,setPage]=useState(1),[receipt,setReceipt]=useState<string>(),[correction,setCorrection]=useState<any>(),[error,setError]=useState('');
 const rows=useFeeResource('/api/admin/fees/receipts',{currentYear:currentYear?1:undefined,q,page,per_page:20});
 const correct=async(row:any,kind:'adjust'|'reverse')=>{setError('');try{const r=await apiClient.get('/api/admin/fees/invoices/'+row.invoiceId);setCorrection({row,kind,invoice:r.data.data});}catch(e){setError(feeError(e));}};
 const fields:Field[]=correction?.kind==='adjust'?[{name:'amountMinor',label:'Corrected amount received',type:'number',max:1000000000000},{name:'concessionMinor',label:'Corrected concession',type:'number',min:0,max:1000000000000},{name:'paymentMode',label:'Payment method',type:'select',options:['cash','upi','bank_transfer','card','cheque'].map(value=>({value,label:displayValue('role',value)}))},{name:'transactionRef',label:'Non-cash reference',optional:true,max:100},{name:'paidOn',label:'Correction date',type:'date'},{name:'reason',label:'Reason for correction',type:'long',max:500}]:[{name:'paidOn',label:'Correction date',type:'date'},{name:'reason',label:'Reason for reversal',type:'long',max:500}];
 return <Space direction="vertical" style={{width:'100%'}} size={16}>
  <Typography.Paragraph type="secondary">{currentYear?'Current school year.':'All recorded school years.'} Reprinting uses the existing receipt; corrections retain the original history.</Typography.Paragraph>
  <Space wrap><Input.Search aria-label="Search receipts" placeholder="Receipt number, student or admission number" allowClear onSearch={v=>{setQ(v);setPage(1);}}/><Button onClick={rows.refresh}>Refresh</Button></Space>
  {(rows.error||error)&&<Alert type="error" message={rows.error||error}/>}
  <Table<any> rowKey="id" loading={rows.loading} dataSource={rows.result?.data||[]} pagination={{current:page,pageSize:20,total:rows.result?.total||0,onChange:setPage}} scroll={{x:900}} columns={[{title:'Receipt',dataIndex:'receiptNo'},{title:'Student',dataIndex:'studentName'},{title:'Received',dataIndex:'amountMinor',align:'right',render:(v,r)=>money(v,r.currency)},{title:'Date',dataIndex:'paidOn'},{title:'Entry',dataIndex:'entryType',render:v=>displayValue('type',v)},{title:'Actions',render:(_,row)=><Space wrap><Button onClick={()=>setReceipt(row.id)}>View / print</Button>{row.entryType==='collection'&&!row.reversedBy&&<><Button onClick={()=>void correct(row,'adjust')}>Correct entry</Button><Button danger onClick={()=>void correct(row,'reverse')}>Reverse entry</Button></>}</Space>}]}/>
  <Modal open={!!receipt} onCancel={()=>setReceipt(undefined)} title="Recorded receipt" footer={null} width={720}>{receipt&&<FeeReceipt id={receipt}/>}</Modal>
  <Modal title={correction?.kind==='adjust'?'Correct payment entry':'Reverse payment entry'} open={!!correction} onCancel={()=>{const event=new CustomEvent('gk-before-navigate',{cancelable:true,detail:{proceed:()=>setCorrection(undefined)}});if(window.dispatchEvent(event))setCorrection(undefined);}} footer={null} width={680}>
   {correction&&<><Alert type="warning" showIcon message="This records a ledger correction; it does not refund or transfer money."/><Descriptions column={1} items={[{key:'original',label:'Original receipt',children:correction.row.receiptNo},{key:'amount',label:'Original amount',children:money(correction.row.amountMinor,correction.row.currency)}]}/><FeeCommandForm key={correction.row.id+correction.kind} currency={currency} fields={fields} extra={correction.kind==='adjust'?{invoiceId:correction.row.invoiceId,receiptId:correction.row.id,version:correction.invoice.version}:{invoiceId:correction.row.invoiceId,version:correction.invoice.version}} url={correction.kind==='adjust'?'/api/admin/fees/invoices/'+correction.row.invoiceId+'/adjust':'/api/admin/fees/receipts/'+correction.row.id+'/reverse'} after={async()=>{setCorrection(undefined);rows.refresh();}} label="Confirm correction"/></>}
  </Modal>
 </Space>;
}
