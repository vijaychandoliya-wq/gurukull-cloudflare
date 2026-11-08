import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Card,Space,Spin,Typography} from 'antd';
import {useAuth} from '../../context/AuthContext';
import {money,displayValue} from '../../ux/format';
import {feeError,useFeeResource,useFeeText} from './feeHelpers';

export function FeeReceipt({id}:{id:string}){
 const r=useFeeResource('/api/admin/fees/receipts/'+encodeURIComponent(id)),invoice=useFeeResource(r.result?.data?.invoiceId?'/api/admin/fees/invoices/'+encodeURIComponent(r.result.data.invoiceId):null),{schoolName}=useAuth(),t=useFeeText(),[error,setError]=useState('');const printArea=useRef<HTMLDivElement>(null),frameRef=useRef<HTMLIFrameElement>();
 useEffect(()=>()=>frameRef.current?.remove(),[]);
 const print=async()=>{try{if(!printArea.current)return;frameRef.current?.remove();const frame=document.createElement('iframe');frame.title='Fee receipt print document';frame.style.cssText='position:fixed;left:-10000px;width:1px;height:1px;border:0';document.body.append(frame);frameRef.current=frame;const doc=frame.contentDocument,win=frame.contentWindow;if(!doc||!win)throw Error('The browser could not prepare the receipt.');doc.documentElement.lang=document.documentElement.lang;doc.documentElement.dir=document.documentElement.dir;doc.title='Receipt '+r.result.data.receiptNo;const style=doc.createElement('style');style.textContent='@page{size:A4;margin:16mm}body{font:14px/1.6 Arial,sans-serif;color:#111;background:#fff;margin:0}h2{font-size:24px}dl{display:grid;grid-template-columns:1fr 1fr;gap:10px}dt,dd{margin:0;padding:6px 0;border-bottom:1px solid #ddd}';doc.head.append(style);doc.body.append(printArea.current.cloneNode(true));win.addEventListener('afterprint',()=>{frame.remove();frameRef.current=undefined;},{once:true});await doc.fonts?.ready;if(!frame.isConnected)return;win.focus();win.print();}catch(e){frameRef.current?.remove();setError(feeError(e));}};
 if(r.loading)return <Spin/>;if(r.error)return <Alert type="error" message={r.error} action={<Button onClick={r.refresh}>Retry receipt</Button>}/>;const receipt=r.result?.data;if(!receipt)return null;
 const entries=[['Receipt number',receipt.receiptNo],['Invoice number',receipt.invoiceNo],['Student',receipt.studentName],['Admission number',receipt.admissionNo],['Fee',receipt.feeName],['Entry type',displayValue('type',receipt.entryType)],['Amount received',money(receipt.amountMinor,receipt.currency)],['Concession',money(receipt.concessionMinor,receipt.currency)],['Payment method',displayValue('role',receipt.paymentMode)],['Payment date',receipt.paidOn],['Reference',receipt.transactionRef||'—'],['Recorded by',receipt.recordedBy],['Note',receipt.remarks]];
 return <Card title={t('Receipt')}><Space direction="vertical" style={{width:'100%'}} size={16}>
  {error&&<Alert type="error" message={error}/>}
  <div ref={printArea}><h2>{schoolName}</h2><h3>Fee receipt</h3>{receipt.reversedBy&&<p><strong>Reversed — retained for history</strong></p>}<dl className="gk-fee-receipt-details">{entries.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'—'}</dd></div>)}</dl></div>
  {invoice.result?.data&&<Typography.Text type="secondary">Current invoice balance: {money(invoice.result.data.balanceMinor,receipt.currency)}. This reflects the current ledger and may include later entries.</Typography.Text>}
  <Button onClick={()=>void print()}>{t('Print / save PDF')}</Button>
 </Space></Card>;
}
