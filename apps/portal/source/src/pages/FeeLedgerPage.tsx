import {MoneyInput} from '../components/portal/UX';
import {money,humanize,displayValue} from '../ux/format';
import {ModuleTabs} from '../components/portal/ModuleTabs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, App, Badge, Button, Card, Collapse, DatePicker, Divider, Drawer, Empty, Flex, Form, Input, InputNumber,
  Popconfirm, Row, Col, Select, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography, Descriptions, Skeleton,
} from 'antd';
import {
  AuditOutlined, DownloadOutlined, FileAddOutlined, FileDoneOutlined, PlusOutlined, ReloadOutlined,
  SettingOutlined, WalletOutlined,
} from '@ant-design/icons';
import { apiClient } from '../services/api';

type Field = { name: string; label: string; type?: 'number' | 'date' | 'select' | 'long'; options?: any[]; min?: number; max?: number; optional?: boolean };
const choices = (values: string[]) => values.map(value => ({ value, label: value.replace(/_/g, ' ') }));
const amount = (name: string, label: string, min = 1): Field => ({ name, label, type: 'number', min, max: 1000000000000 });

function currencyAmount(value: number, currency: string | null | undefined) {
  if (!currency) return `${value} minor units`;
  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(value / 10 ** digits);
}

function titleCase(value: string) { return humanize(value); }

function ActualCommandForm({ fields, url, method = 'post', extra = {}, after, label, currency, initialValues }: {currency?:string|null;initialValues?:any; fields: Field[]; url: string; method?: string; extra?: any; after: () => Promise<void>; label: string }) {
  const [form] = Form.useForm();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewed,setReviewed]=useState(false);
  const key = useRef(crypto.randomUUID());
  const { message } = App.useApp();

  const save = async () => {
    try {
      const values = await form.validateFields();
      const body: any = { ...extra };
      for (const field of fields) body[field.name] = field.type === 'date' ? values[field.name]?.format('YYYY-MM-DD') : values[field.name] ?? null;
      if(!reviewed){setReviewed(true);return;}
      setBusy(true);
      const response = await apiClient.request({ url, method, data: body, headers: { 'Idempotency-Key': key.current } });
      message.success(response.data.message);
      key.current = crypto.randomUUID();
      form.resetFields();setReviewed(false);
      setError('');
      await after();
    } catch (e: any) {
      if (e.response?.data?.errors) form.setFields(Object.entries(e.response.data.errors).map(([name, errors]) => ({ name, errors: errors as string[] })));
      if (!e.errorFields) setError(e.response?.data?.message || 'Save failed. Review the highlighted fields and try again.');
    } finally { setBusy(false); }
  };

  return <>
    {error && <Alert type="error" showIcon message={error} className="gk-form-error" />}
    <Form form={form} initialValues={initialValues} layout="vertical" className="gk-fee-form" onValuesChange={()=>setReviewed(false)}>
      <Row gutter={[14, 0]}>{fields.map(field => <Col key={field.name} xs={24} md={field.type === 'long' ? 24 : 12}>
        <Form.Item name={field.name} label={field.label.replace(/ in minor currency units/g,'').replace(/ in minor units/g,'')} rules={[{ required: !field.optional, message: `${field.label} is required.` }]}>
          {field.type === 'number' && field.name.endsWith('Minor') ? <MoneyInput currency={currency} min={field.min??1} max={field.max}/> : field.type === 'number' ? <InputNumber min={field.min ?? 1} max={field.max} precision={0} style={{ width: '100%' }} />
            : field.type === 'date' ? <DatePicker style={{ width: '100%' }} />
              : field.type === 'select' ? <Select showSearch optionFilterProp="label" options={field.options || []} />
                : field.type === 'long' ? <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={field.max || 500} />
                  : <Input maxLength={field.max || 100} />}
        </Form.Item>
      </Col>)}</Row>
      {reviewed&&<Descriptions className="gk-review-summary" bordered column={1} size="small" items={fields.map(f=>({key:f.name,label:humanize(f.name),children:displayValue(f.name,f.type==='date'?form.getFieldValue(f.name)?.format('YYYY-MM-DD'):f.type==='select'?f.options?.find(o=>o.value===form.getFieldValue(f.name))?.label||form.getFieldValue(f.name):form.getFieldValue(f.name),currency)}))}/>}
      <Button type="primary" icon={<FileDoneOutlined />} loading={busy} onClick={save}>{reviewed?'Confirm: '+label:'Review: '+label}</Button>
    </Form>
  </>;
}

export const FeeLedgerPage: React.FC = () => {
  const {message}=App.useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [options, setOptions] = useState<any>({});
  const [policy, setPolicy] = useState<any>();
  const [summary, setSummary] = useState<any>();
  const [reminders, setReminders] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any>();
  const [receipts, setReceipts] = useState<any[] | null>(null);
  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptTotal, setReceiptTotal] = useState(0);
  const [correction, setCorrection] = useState<any>();

  const load = useCallback(async () => {
    try {
      const [invoices, feeGroups, formOptions, numbering, feeStructures, report, feeReminders] = await Promise.all([
        apiClient.get('/api/admin/fees/invoices', { params: { page, per_page: 20 } }),
        apiClient.get('/api/admin/fees/groups'), apiClient.get('/api/admin/fees/form-options'), apiClient.get('/api/admin/fees/policy'),
        apiClient.get('/api/admin/fees/structures'), apiClient.get('/api/admin/fees/reports/summary'), apiClient.get('/api/admin/fees/reminders'),
      ]);
      setRows(invoices.data.data); setTotal(invoices.data.meta.total); setGroups(feeGroups.data.data); setOptions(formOptions.data.data);
      setPolicy(numbering.data.data); setStructures(feeStructures.data.data); setSummary(report.data.data); setReminders(feeReminders.data.data); setError('');
    } catch (e: any) { setError(e.response?.data?.message || 'Fees could not be loaded.'); }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const ledger = async (p = 1) => { try { const r = await apiClient.get('/api/admin/fees/receipts', { params: { page: p, per_page: 20 } }); setReceipts(r.data.data); setReceiptPage(p); setReceiptTotal(r.data.total); } catch (e: any) { setError(e.response?.data?.message || 'Receipts could not be loaded.'); } };
  const open = async (row: any, kind: 'collect' | 'cancel' | 'reverse' | 'adjust') => { try { const r = await apiClient.get('/api/admin/fees/invoices/' + (['reverse', 'adjust'].includes(kind) ? row.invoiceId : row.id)); if (kind === 'collect') setSelected({ ...row, ...r.data.data }); else setCorrection({ row, invoice: r.data.data, kind }); } catch (e: any) { setError(e.response?.data?.message || 'Invoice could not be opened.'); } };
  const standardGroups = async () => { try { await apiClient.post('/api/admin/fees/default-groups', {}, { headers: { 'Idempotency-Key': crypto.randomUUID() } }); await load(); } catch (e: any) { setError(e.response?.data?.message || 'Standard fee heads could not be prepared.'); } };
  const exportCsv = async () => { const response = await apiClient.get('/api/admin/fees/reports/export', { responseType: 'blob' }); const link = document.createElement('a'); link.href = URL.createObjectURL(response.data); link.download = 'fee-report.csv'; link.click(); URL.revokeObjectURL(link.href); };

  const invoiceFields: Field[] = [{ name: 'studentId', label: 'Student', type: 'select', options: options.students }, { name: 'feeGroupId', label: 'Fee head', type: 'select', options: options.groups }, amount('amountMinor', 'Amount in minor currency units'), { name: 'dueDate', label: 'Due date', type: 'date' }];
  const sectionOptions = (options.sections || []).map((section: any) => ({ ...section, label: `${(options.classes || []).find((c: any) => c.value === section.classId)?.label || ''} · ${section.label}` }));
  const structureFields: Field[] = [{ name: 'feeGroupId', label: 'Fee head', type: 'select', options: options.groups }, { name: 'name', label: 'Fee structure name', max: 120 }, { name: 'term', label: 'Term / billing period', optional: true }, { name: 'classId', label: 'Class (blank = all classes)', type: 'select', options: options.classes, optional: true }, { name: 'sectionId', label: 'Section (optional)', type: 'select', options: sectionOptions, optional: true }, amount('amountMinor', 'Amount in minor currency units'), { name: 'startsOn', label: 'Fee start date', type: 'date' }, { name: 'dueOn', label: 'Due date', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: choices(['active', 'inactive']) }];
  const manualFields: Field[] = [{ name: 'studentId', label: 'Student', type: 'select', options: options.students }, { name: 'name', label: 'Opening balance name', max: 120 }, amount('totalMinor', 'Original balance in minor currency units'), amount('paidMinor', 'Already paid in minor currency units', 0), amount('concessionMinor', 'Concession in minor currency units', 0), { name: 'dueDate', label: 'Due date', type: 'date' }, { name: 'notes', label: 'Migration notes', type: 'long', max: 500, optional: true }];

  const structureCols = [
    { title: 'Fee head', dataIndex: 'feeGroupName' }, { title: 'Structure', dataIndex: 'name' },
    { title: 'Scope', render: (_: any, row: any) => row.sectionName ? `${row.className} · ${row.sectionName}` : row.className || 'All classes' },
    { title: 'Term', dataIndex: 'term', render: (value: string) => value || '—' }, { title: 'Amount', render: (_: any, row: any) => currencyAmount(row.amountMinor, options.currency) },
    { title: 'Assigned', dataIndex: 'assignedStudents' }, { title: 'Status', render: (_: any, row: any) => <Tag color={row.status === 'active' ? 'green' : 'default'}>{row.status}</Tag> },
    { title: 'Actions', fixed: 'right' as const, render: (_: any, row: any) => <Space><Button size="small" onClick={async () => { try { const x = await apiClient.post(`/api/admin/fees/structures/${row.id}/assign`, {}, { headers: { 'Idempotency-Key': crypto.randomUUID() } }); await load(); message.success(x.data.message); } catch (e: any) { setError(e.response?.data?.message || 'Assignment failed.'); } }}>Assign eligible students</Button><Popconfirm title="Archive this fee structure?" onConfirm={async () => { try { await apiClient.delete(`/api/admin/fees/structures/${row.id}`, { data: { version: row.version }, headers: { 'Idempotency-Key': crypto.randomUUID() } }); await load(); } catch (e: any) { setError(e.response?.data?.message || 'Archive failed.'); } }}><Button size="small" danger>Archive</Button></Popconfirm></Space> },
  ];
  const invoiceCols = [...['invoiceNo', 'studentName', 'className', 'feeName', 'currency', 'dueDate'].map(key => ({ title: titleCase(key), dataIndex: key })),
    { title: 'Status', dataIndex: 'status', render: (value: string) => <Tag color={value === 'paid' ? 'green' : value === 'cancelled' ? 'default' : value === 'partially_paid' ? 'blue' : 'orange'}>{titleCase(value)}</Tag> },
    ...['amountMinor', 'paidMinor', 'concessionMinor', 'balanceMinor'].map(key => ({ title: titleCase(key), dataIndex: key, render: (value: number, row: any) => currencyAmount(value, row.currency) })),
    { title: 'Actions', fixed: 'right' as const, render: (_: any, row: any) => <Space><Button size="small" disabled={row.status === 'cancelled' || row.balanceMinor <= 0} onClick={() => open(row, 'collect')}>Collect</Button><Button size="small" disabled={row.status === 'cancelled' || row.paidMinor !== 0 || row.concessionMinor !== 0} onClick={() => open(row, 'cancel')}>Cancel</Button><Tooltip title="Queue a reminder for the configured provider"><Button size="small" disabled={row.status === 'cancelled' || row.balanceMinor <= 0} onClick={async () => { try { await apiClient.post('/api/admin/fees/reminders', { invoiceId: row.id, channel: 'whatsapp' }, { headers: { 'Idempotency-Key': crypto.randomUUID() } }); await load(); } catch (e: any) { setError(e.response?.data?.message || 'Reminder could not be queued.'); } }}>Remind</Button></Tooltip></Space> },
  ];

  const currency = options.currency;
  return <Space direction="vertical" size={24} style={{ width: '100%' }} className="gk-fee-page">
    <Flex justify="space-between" align="flex-start" wrap="wrap" gap={16} className="gk-page-heading">
      <div><Typography.Text className="gk-dashboard-eyebrow">FINANCE & LOGISTICS</Typography.Text><Typography.Title level={2} style={{ margin: '4px 0' }}>Fees & collections</Typography.Title><Typography.Text type="secondary">Manage fee heads, invoices, collections and the school ledger from one workspace.</Typography.Text></div>
      <Space wrap><Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button><Button icon={<AuditOutlined />} onClick={() => ledger()}>Receipts & corrections</Button><Button icon={<DownloadOutlined />} onClick={exportCsv}>Export CSV</Button></Space>
    </Flex>
    {error && <Alert type="error" showIcon message={error} closable onClose={() => setError('')} />}
    <Card className="gk-fee-intro-card" bordered={false}><Flex gap={16} align="flex-start"><span className="gk-fee-intro-icon"><WalletOutlined /></span><div><Typography.Title level={4} style={{ margin: 0 }}>A clear, auditable fee workflow</Typography.Title><Typography.Paragraph type="secondary" style={{ margin: '6px 0 0' }}>Use the school’s actual fee policy and current roster. Enter amounts in the displayed school currency. Collections record money already received; this screen does not charge a card or bank account.</Typography.Paragraph></div><Tag color="blue" className="gk-fee-currency-tag">{currency || 'Currency setup required'}</Tag></Flex></Card>
    <Row gutter={[16, 16]}>
      {[["Gross billed", summary?.grossMinor || 0, <WalletOutlined />, '#2563eb'], ["Collected", summary?.paidMinor || 0, <FileDoneOutlined />, '#16a34a'], ["Outstanding", summary?.outstandingMinor || 0, <FileAddOutlined />, '#d97706'], ["Overdue invoices", summary?.overdueInvoices || 0, <SettingOutlined />, '#dc2626']].map(([label, value, icon, color]) => <Col key={String(label)} xs={12} xl={6}><Card className="gk-fee-stat-card"><Statistic title={label as string} value={typeof value === 'number' && label !== 'Overdue invoices' ? (summary?currencyAmount(value, currency):'—') : (summary?value as number:'—')} prefix={<span style={{ color: color as string }}>{icon}</span>} /></Card></Col>)}
    </Row>
    <ModuleTabs className="gk-fee-tabs" items={[
      { key: 'invoices', label: 'Invoices & collections', children: <Card title="Student invoices" extra={<Tag>{total} total</Tag>}><Table size="middle" rowKey="id" scroll={{ x: 1260 }} dataSource={rows} columns={invoiceCols} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} locale={{ emptyText: <Empty description="No invoices have been issued for this school year." /> }} /><Divider /><Collapse ghost items={[{ key: 'issue', label: <Space><PlusOutlined /> Issue one invoice</Space>, children: <ActualCommandForm currency={currency} fields={invoiceFields} url="/api/admin/fees/invoices" after={load} label="Issue invoice" /> }]} /></Card> },
      { key: 'structures', label: 'Fee structures', children: <Space direction="vertical" size={16} style={{ width: '100%' }}><Card title="Current fee structures" extra={<Button type="primary" icon={<SettingOutlined />} onClick={standardGroups}>Prepare standard fee heads</Button>}><Typography.Paragraph type="secondary">Create actual billing periods, scope them to classes or sections, then assign them to the active roster.</Typography.Paragraph><Table size="middle" rowKey="id" scroll={{ x: 1180 }} dataSource={structures} columns={structureCols} pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty description="No fee structures configured yet." /> }} /></Card><Card><Collapse ghost items={[{ key: 'structure', label: <Space><PlusOutlined /> Create fee structure</Space>, children: <ActualCommandForm currency={currency} fields={structureFields} url="/api/admin/fees/structures" after={load} label="Save fee structure" /> }, { key: 'opening', label: <Space><FileAddOutlined /> Import an opening balance</Space>, children: <ActualCommandForm currency={currency} fields={manualFields} url="/api/admin/fees/manual-balance" after={load} label="Record opening balance" /> }]} /></Card></Space> },
      { key: 'groups', label: 'Fee heads', children: <Card title="Fee heads" extra={<Button type="primary" icon={<PlusOutlined />} onClick={standardGroups}>Prepare standard heads</Button>}><Typography.Paragraph type="secondary">Fee heads are reusable labels such as tuition, transport or examination charges. Preparing standard heads only creates them when you explicitly confirm the action.</Typography.Paragraph><Table size="middle" rowKey="id" dataSource={groups} columns={[{ title: 'Name', dataIndex: 'name' }, { title: 'Description', dataIndex: 'description', render: (value: string) => value || '—' }]} locale={{ emptyText: <Empty description="No fee heads have been configured." /> }} /><Divider /><Collapse ghost items={[{ key: 'group', label: <Space><PlusOutlined /> Add a fee head</Space>, children: <ActualCommandForm currency={currency} fields={[{ name: 'name', label: 'Fee head name', max: 80 }, { name: 'description', label: 'Description', type: 'long', max: 255, optional: true }]} url="/api/admin/fees/groups" after={load} label="Add fee head" /> }]} /></Card> },
      { key: 'reminders', label: 'Reminders', children: <Card title="Reminder activity" extra={<Badge status={reminders.length ? 'processing' : 'default'} text={`${reminders.length} queued`} />}><Table size="middle" rowKey="id" dataSource={reminders} columns={['createdAt', 'studentName', 'invoiceId', 'channel', 'recipient', 'status', 'message'].map(key => ({ title: humanize(key), dataIndex: key,render:(v:any,r:any)=>displayValue(key,v,r.currency||currency) }))} locale={{ emptyText: <Empty description="No reminders have been queued." /> }} /></Card> },
      { key: 'policy', label: 'Numbering policy', children: <Card title="Current-year numbering policy"><Alert type="info" showIcon message="Use the existing school convention" description="The policy becomes locked after the first invoice. Enter the next unused invoice and receipt numbers exactly as maintained by the school." />{policy && <Typography.Paragraph className="gk-fee-policy-summary">Current convention: <strong>{policy.invoicePrefix}</strong> invoices and <strong>{policy.receiptPrefix}</strong> receipts · next invoice <strong>{policy.nextInvoiceNumber}</strong> · next receipt <strong>{policy.nextReceiptNumber}</strong>.</Typography.Paragraph>}<Divider /><ActualCommandForm currency={currency} initialValues={policy} key={policy?.version || 0} fields={[{ name: 'invoicePrefix', label: 'Invoice prefix', max: 30 }, { name: 'receiptPrefix', label: 'Receipt prefix', max: 30 }, { name: 'numberWidth', label: 'Number width', type: 'number', max: 12 }, { name: 'nextInvoiceNumber', label: 'Next unused invoice number', type: 'number', max: 999999999999 }, { name: 'nextReceiptNumber', label: 'Next unused receipt number', type: 'number', max: 999999999999 }]} extra={{ version: policy?.version || 0 }} url="/api/admin/fees/policy" method="put" after={load} label="Save numbering policy" /></Card> },
    ]} />
    <Drawer width={650} title="Record money received" open={!!selected} onClose={() => setSelected(undefined)}>{selected && <><Typography.Paragraph>{selected.invoiceNo} · {selected.studentName} · Outstanding {currencyAmount(selected.balanceMinor, selected.currency)}</Typography.Paragraph><ActualCommandForm currency={currency} key={`${selected.id}-${selected.version}`} fields={[amount('amountMinor', 'Amount received in minor currency units'), amount('concessionMinor', 'Concession (0 if none)', 0), { name: 'paymentMode', label: 'Payment method', type: 'select', options: choices(['cash', 'cheque', 'bank_transfer', 'upi', 'card']) }, { name: 'transactionRef', label: 'Non-cash transaction reference', optional: true }, { name: 'paidOn', label: 'Payment date', type: 'date' }, { name: 'remarks', label: 'Collection remarks', type: 'long' }]} extra={{ invoiceId: selected.id, version: selected.version }} url="/api/admin/fees/payments" after={async () => { setSelected(undefined); await load(); await ledger(); }} label="Record collection" /></>}</Drawer>
    <Drawer width={1100} title="Immutable receipts and corrections" open={receipts !== null} onClose={() => setReceipts(null)}><Table rowKey="id" scroll={{ x: true }} dataSource={receipts || []} pagination={{ current: receiptPage, total: receiptTotal, pageSize: 20, onChange: ledger }} columns={[...['receiptNo', 'invoiceNo', 'studentName', 'entryType', 'amountMinor', 'concessionMinor', 'currency', 'paidOn', 'paymentMode', 'transactionRef', 'remarks', 'recordedBy'].map(key => ({ title: humanize(key), dataIndex: key,render:(v:any,r:any)=>displayValue(key,v,r.currency||currency) })), { title: 'Correction', render: (_: any, row: any) => <Space><Button disabled={row.entryType !== 'collection' || !!row.reversedBy} onClick={() => open(row, 'reverse')}>Reverse</Button><Button disabled={row.entryType !== 'collection' || !!row.reversedBy} onClick={() => open(row, 'adjust')}>Adjust</Button></Space> }]} /></Drawer>
    <Drawer title={correction?.kind === 'adjust' ? 'Adjust receipt' : correction?.kind === 'reverse' ? 'Record ledger reversal' : 'Cancel unpaid invoice'} open={!!correction} onClose={() => setCorrection(undefined)}>{correction && <><Alert type="info" showIcon message="Original history remains immutable." description="Corrections are recorded as a reversal and replacement entry." /><ActualCommandForm currency={currency} key={`${correction.row.id}-${correction.invoice.version}`} fields={correction.kind === 'adjust' ? [amount('amountMinor', 'Corrected amount in minor currency units'), amount('concessionMinor', 'Corrected concession', 0), { name: 'paymentMode', label: 'Payment method', type: 'select', options: choices(['cash', 'cheque', 'bank_transfer', 'upi', 'card']) }, { name: 'transactionRef', label: 'Non-cash transaction reference', optional: true }, { name: 'paidOn', label: 'Correction date', type: 'date' }, { name: 'reason', label: 'Reason', type: 'long' }] : [...(correction.kind === 'reverse' ? [{ name: 'paidOn', label: 'Correction date', type: 'date' as const }] : []), { name: 'reason', label: 'Reason', type: 'long' }]} extra={correction.kind === 'adjust' ? { invoiceId: correction.row.invoiceId, receiptId: correction.row.id, version: correction.invoice.version } : correction.kind === 'reverse' ? { invoiceId: correction.row.invoiceId, version: correction.invoice.version } : { version: correction.invoice.version }} url={correction.kind === 'adjust' ? `/api/admin/fees/invoices/${correction.row.invoiceId}/adjust` : `/api/admin/fees/${correction.kind === 'reverse' ? `receipts/${correction.row.id}/reverse` : `invoices/${correction.row.id}/cancel`}`} after={async () => { setCorrection(undefined); await load(); if (receipts !== null) await ledger(receiptPage); }} label="Save correction" /></>}</Drawer>
  </Space>;
};
