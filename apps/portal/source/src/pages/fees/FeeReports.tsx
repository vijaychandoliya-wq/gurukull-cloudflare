import {useState} from 'react';
import {Alert,Button,Card,Descriptions,Space,Typography} from 'antd';
import {money} from '../../ux/format';
import {apiClient} from '../../services/api';
import {feeError,useFeeResource} from './feeHelpers';

export function FeeReports({context}:{context:any}){
 const report=useFeeResource('/api/admin/fees/reports/summary'),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const download=async()=>{try{setBusy(true);setError('');const r=await apiClient.get('/api/admin/fees/reports/export',{params:{currentYear:1,display:1},responseType:'blob'}),url=URL.createObjectURL(r.data),link=document.createElement('a');link.href=url;link.download='current-year-fee-ledger.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(feeError(e));}finally{setBusy(false);}};
 const s=report.result?.data;
 return <Space direction="vertical" style={{width:'100%'}} size={16}>
  <Typography.Title level={4} style={{margin:0}}>Current-year fee ledger</Typography.Title>
  <Typography.Text type="secondary">{context?.name} · {context?.startsOn} to {context?.endsOn}</Typography.Text>
  {(error||report.error)&&<Alert type="error" message={error||report.error}/>}
  <Card loading={report.loading}><Descriptions column={{xs:1,md:2}} items={[{key:'charged',label:'Charges (excluding cancelled)',children:money(s?.grossMinor,context?.currency)},{key:'paid',label:'Net payments recorded',children:money(s?.paidMinor,context?.currency)},{key:'concession',label:'Concessions',children:money(s?.concessionMinor,context?.currency)},{key:'outstanding',label:'Outstanding',children:money(s?.outstandingMinor,context?.currency)},{key:'overdue',label:'Overdue invoices',children:s?.overdueInvoices??'—'}]}/></Card>
  <Typography.Paragraph type="secondary">These are school-year ledger totals, including recorded opening balances and corrections. They are not a cash-in-hand or bank settlement report.</Typography.Paragraph>
  <Space><Button onClick={report.refresh}>Refresh</Button><Button loading={busy} onClick={()=>void download()}>Export current-year ledger</Button></Space>
 </Space>;
}
