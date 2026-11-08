import {useCallback,useState} from 'react';
import {Alert,Button,Drawer,Modal,Space,Spin,Tabs,Typography} from 'antd';
import {Link,useSearchParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useDirtyForm} from '../components/portal/UX';
import {FeeCounter} from './fees/FeeCounter';
import {FeePlans} from './fees/FeePlans';
import {FeeSettings} from './fees/FeeSettings';
import {FeeReceipts} from './fees/FeeReceipts';
import {FeeReports} from './fees/FeeReports';
import {FeeCommandForm} from './fees/FeeCommandForm';
import {useFeeResource,useFeeText} from './fees/feeHelpers';

/** Daily fee counter; each workspace owns its loading and error state. */
export function FeeLedgerPage(){
 const t=useFeeText(),{schoolName}=useAuth(),[params,setParams]=useSearchParams(),[settings,setSettings]=useState(false),[dirty,setDirty]=useState(false),[charge,setCharge]=useState<any>(),[cancel,setCancel]=useState<any>(),[revision,setRevision]=useState(0);
 useDirtyForm(dirty);
 const context=useFeeResource('/api/admin/fees/counter/context'),policy=useFeeResource('/api/admin/fees/policy'),options=useFeeResource('/api/admin/fees/form-options');
 const tabs=['collect','plans','receipts','reports'],requested=params.get('tab'),active=tabs.includes(requested||'')?requested!:'collect';
 const safe=(proceed:()=>void)=>{const run=()=>{if(dirty){setDirty(false);setRevision(v=>v+1);}proceed();};const event=new CustomEvent('gk-before-navigate',{cancelable:true,detail:{proceed:run}});if(window.dispatchEvent(event))run();};
 const go=(tab:string)=>safe(()=>setParams(current=>{const next=new URLSearchParams(current);next.set('tab',tab);return next;}));
 const refresh=useCallback(()=>{context.refresh();policy.refresh();options.refresh();setRevision(v=>v+1);},[context.refresh,policy.refresh,options.refresh]);
 const cfg=context.result?.data,p=policy.result?.data,opts=options.result?.data||{};
 return <Space direction="vertical" size={24} style={{width:'100%'}} className="gk-fee-page">
  <div className="gk-fee-counter-heading"><div><Typography.Title level={2} style={{margin:0}}>{t('Fees')}</Typography.Title><Typography.Text type="secondary">{schoolName}{cfg?' · '+cfg.name+' · '+cfg.currency:''}</Typography.Text></div><Button onClick={()=>safe(()=>setSettings(true))}>{t('Fee settings')}</Button></div>
  {context.error&&<Alert type="info" showIcon message="Fee setup needs attention" description={context.error} action={<Space><Link to="/settings">School settings</Link><Link to="/academics">Academic year</Link><Button onClick={context.refresh}>Retry</Button></Space>}/>}
  {policy.error&&<Alert type="error" showIcon message={policy.error} action={<Button onClick={policy.refresh}>Retry numbers</Button>}/>}
  {options.error&&<Alert type="warning" showIcon message="Fee-type options could not be loaded" description={options.error} action={<Button onClick={options.refresh}>Retry options</Button>}/>}
  <Tabs activeKey={active} onChange={go} destroyInactiveTabPane items={[
   {key:'collect',label:t('Collect fees'),children:context.loading||policy.loading?<Spin/>:cfg?<FeeCounter key={revision} context={cfg} policy={p} onDirty={setDirty} onSettings={()=>safe(()=>setSettings(true))} onAddCharge={(student,refresh)=>setCharge({student,refresh})} onCancelCharge={(invoice,refresh)=>setCancel({invoice,refresh})}/>:<Button onClick={()=>setSettings(true)}>Complete fee setup</Button>},
   {key:'plans',label:t('Fee plans'),children:<FeePlans options={opts} context={cfg} policy={p}/>},
   {key:'receipts',label:t('Receipts'),children:<FeeReceipts currency={cfg?.currency||opts.currency} currentYear={!!cfg}/>},
   {key:'reports',label:t('Reports'),children:<FeeReports context={cfg}/>}
  ]}/>
  <Drawer title={t('Fee settings')} open={settings} onClose={()=>safe(()=>setSettings(false))} width={760} destroyOnClose><FeeSettings context={cfg} policy={p} options={opts} onSaved={refresh} onPlans={()=>safe(()=>{setSettings(false);go('plans');})}/></Drawer>
  <Modal title={t('Add charge')} open={!!charge} footer={null} onCancel={()=>safe(()=>setCharge(undefined))} destroyOnClose>
   {charge&&<><Typography.Paragraph>{charge.student.fullName} · {charge.student.admissionNo} · {charge.student.className}</Typography.Paragraph>{!p?<Alert type="info" message="Set invoice and receipt numbers in Fee settings first."/>:<FeeCommandForm currency={cfg?.currency} fields={[{name:'feeGroupId',label:'Fee type',type:'select',options:opts.groups},{name:'amountMinor',label:'Amount',type:'number',max:1000000000000},{name:'dueDate',label:'Due date',type:'date'}]} extra={{studentId:charge.student.id}} url="/api/admin/fees/invoices" after={async()=>{charge.refresh();setCharge(undefined);}} label="Issue charge"/>}</>}
  </Modal>
  <Modal title="Cancel unpaid charge" open={!!cancel} footer={null} onCancel={()=>safe(()=>setCancel(undefined))} destroyOnClose>{cancel&&<><Alert type="warning" message="The original charge number and history are retained."/><Typography.Paragraph>{cancel.invoice.invoiceNo} · {cancel.invoice.feeName}</Typography.Paragraph><FeeCommandForm fields={[{name:'reason',label:'Reason for cancellation',type:'long',max:500}]} extra={{version:cancel.invoice.version}} url={'/api/admin/fees/invoices/'+cancel.invoice.id+'/cancel'} after={async()=>{cancel.refresh();setCancel(undefined);}} label="Cancel charge"/></>}</Modal>
 </Space>;
}
