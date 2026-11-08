import {useEffect,useRef,useState} from 'react';
import {Alert,App,Button,DatePicker,Descriptions,Form,Input,InputNumber,Row,Col,Select} from 'antd';
import {FileDoneOutlined} from '@ant-design/icons';
import {MoneyInput} from '../../components/portal/UX';
import {displayValue} from '../../ux/format';
import {apiClient} from '../../services/api';
import {useDirtyForm} from '../../components/portal/UX';
import {feeError} from './feeHelpers';
export type Field = { name:string;label:string;type?:'number'|'date'|'select'|'long';options?:any[];min?:number;max?:number;optional?:boolean;remoteStudents?:boolean };
export function FeeCommandForm({ fields, url, method = 'post', extra = {}, after, label, currency, initialValues }: {currency?:string|null;initialValues?:any; fields: Field[]; url: string; method?: string; extra?: any; after: () => Promise<void>; label: string }) {
  const [form] = Form.useForm();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [unconfirmed,setUnconfirmed]=useState(false);
  const [reviewed,setReviewed]=useState(false);const [dirty,setDirty]=useState(false);useDirtyForm(dirty);
  const key = useRef(crypto.randomUUID());
  const { message } = App.useApp();
  const [studentChoices,setStudentChoices]=useState<any[]>([]);const searchVersion=useRef(0);
  useEffect(()=>()=>{searchVersion.current++;},[]);
  const searchStudents=async(q:string)=>{const request=++searchVersion.current;try{const r=await apiClient.get('/api/admin/fees/counter/students',{params:{q,per_page:20}});if(request===searchVersion.current)setStudentChoices(r.data.data.map((s:any)=>({value:s.id,label:s.fullName+' · '+s.admissionNo+' · '+s.className})));}catch(e){if(request===searchVersion.current)setError(feeError(e));}};

  const save = async () => {
    let committed=false;
    try {
      const values = await form.validateFields();
      const body: any = { ...extra };
      for (const field of fields) body[field.name] = field.type === 'date' ? values[field.name]?.format('YYYY-MM-DD') : values[field.name] ?? null;
      if(!reviewed){setReviewed(true);return;}
      setBusy(true);
      const response = await apiClient.request({ url, method, data: body, headers: { 'Idempotency-Key': key.current } });
      committed=true;setUnconfirmed(false);
      message.success(response.data.message);
      key.current = crypto.randomUUID();
      form.resetFields();setReviewed(false);setDirty(false);
      setError('');
      await after();
    } catch (e: any) {
      if (e.response?.data?.errors) form.setFields(Object.entries(e.response.data.errors).map(([name, errors]) => ({ name, errors: errors as string[] })));
      if (!e.errorFields){const unknown=!committed&&(!e.response||e.response.status>=500);setUnconfirmed(unknown);setError(committed?'The record was saved, but the view could not refresh. Refresh before starting another entry.':unknown?'This request is not confirmed. Retry the same request to check its result; the details are locked to prevent duplicates.':feeError(e));}
    } finally { setBusy(false); }
  };

  return <>
    {error && <Alert type="error" showIcon message={error} className="gk-form-error" />}
    <Form form={form} initialValues={initialValues} layout="vertical" className="gk-fee-form" disabled={busy||unconfirmed} onValuesChange={()=>{setReviewed(false);setDirty(true);key.current=crypto.randomUUID();}}>
      <Row gutter={[14, 0]}>{fields.map(field => <Col key={field.name} xs={24} md={field.type === 'long' ? 24 : 12}>
        <Form.Item name={field.name} label={field.label.replace(/ in minor currency units/g,'').replace(/ in minor units/g,'')} rules={[{ required: !field.optional, message: `${field.label} is required.` }]}>
          {field.type === 'number' && field.name.endsWith('Minor') ? <MoneyInput currency={currency} min={field.min??1} max={field.max}/> : field.type === 'number' ? <InputNumber min={field.min ?? 1} max={field.max} precision={0} style={{ width: '100%' }} />
            : field.type === 'date' ? <DatePicker style={{ width: '100%' }} />
              : field.type === 'select' ? <Select showSearch optionFilterProp="label" filterOption={field.remoteStudents?false:undefined} onSearch={field.remoteStudents?q=>void searchStudents(q):undefined} options={field.remoteStudents?studentChoices:field.options || []} />
                : field.type === 'long' ? <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={field.max || 500} />
                  : <Input maxLength={field.max || 100} />}
        </Form.Item>
      </Col>)}</Row>
      {reviewed&&<Descriptions className="gk-review-summary" bordered column={1} size="small" items={fields.map(f=>({key:f.name,label:f.label,children:displayValue(f.name,f.type==='date'?form.getFieldValue(f.name)?.format('YYYY-MM-DD'):f.type==='select'?(f.remoteStudents?studentChoices:f.options)?.find(o=>o.value===form.getFieldValue(f.name))?.label||form.getFieldValue(f.name):form.getFieldValue(f.name),currency)}))}/>}
    </Form>
    <Button type="primary" icon={<FileDoneOutlined />} loading={busy} onClick={save}>{unconfirmed?'Retry same request':reviewed?'Confirm: '+label:'Review: '+label}</Button>
  </>;
}
