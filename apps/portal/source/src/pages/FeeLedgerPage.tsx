import {MoneyInput} from '../components/portal/UX';
import {money,humanize,displayValue} from '../ux/format';
import {ModuleTabs} from '../components/portal/ModuleTabs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, App, Badge, Button, Card, Collapse, DatePicker, Divider, Drawer, Empty, Flex, Form, Input, InputNumber, Col,
  Modal, Popconfirm, Radio, Row, Select, Space, Statistic, Tabs, Tag, Tooltip, Typography, Descriptions, Skeleton,
} from 'antd';
import {Table} from '../components/export/ExportTable';
import {FeeDemandDrawer} from '../components/FeeDemandDrawer';
import {
  AuditOutlined, BellOutlined, DownloadOutlined, FileAddOutlined, FileDoneOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined,
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
  const [remindSummary, setRemindSummary] = useState<any>();
  const [remindOpen, setRemindOpen] = useState(false);
  const [remindInvoice, setRemindInvoice] = useState<any>();
  const [remindPreview, setRemindPreview] = useState<any>();
  const [remindBusy, setRemindBusy] = useState(false);
  const [remindForm] = Form.useForm();
  const [demand, setDemand] = useState<{ studentId: string; label: string } | undefined>();
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);
  const [payLinks, setPayLinks] = useState<any[]>([]);
  const [payLinkSummary, setPayLinkSummary] = useState<any>(null);
  const [payLinkForm] = Form.useForm();

  const loadPayLinks = useCallback(async () => {
    try {
      const [gw, links] = await Promise.all([
        apiClient.get('/api/admin/fees/gateway'),
        apiClient.get('/api/admin/fees/pay-links'),
      ]);
      setGatewayStatus(gw.data.data);
      setPayLinks(links.data.data);
      setPayLinkSummary(links.data.summary);
    } catch (e: any) { setError(e.response?.data?.message || 'Payment links could not be loaded.'); }
  }, []);

  const createPayLink = async () => {
    setError('');
    try {
      const values = await payLinkForm.validateFields();
      const body: any = { ...values };
      await apiClient.post('/api/admin/fees/pay-links', body, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
      message.success('Payment link created.');
      payLinkForm.resetFields();
      await loadPayLinks();
      await load();
    } catch (e: any) { setError(e.response?.data?.message || 'Payment link could not be created.'); }
  };

  const cancelPayLink = async (id: string) => {
    try {
      await apiClient.post(`/api/admin/fees/pay-links/${id}/cancel`, undefined, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
      message.success('Payment link cancelled.');
      await loadPayLinks();
    } catch (e: any) { setError(e.response?.data?.message || 'Payment link could not be cancelled.'); }
  };

  const load = useCallback(async () => {
    try {
      const [invoices, feeGroups, formOptions, numbering, feeStructures, report, feeReminders, remindSum] = await Promise.all([
        apiClient.get('/api/admin/fees/invoices', { params: { page, per_page: 20 } }),
        apiClient.get('/api/admin/fees/groups'), apiClient.get('/api/admin/fees/form-options'), apiClient.get('/api/admin/fees/policy'),
        apiClient.get('/api/admin/fees/structures'), apiClient.get('/api/admin/fees/reports/summary'), apiClient.get('/api/admin/fees/reminders', { params: { per_page: 50 } }),
        apiClient.get('/api/admin/fees/reminders/summary'),
      ]);
      setRows(invoices.data.data); setTotal(invoices.data.meta.total); setGroups(feeGroups.data.data); setOptions(formOptions.data.data);
      setPolicy(numbering.data.data); setStructures(feeStructures.data.data); setSummary(report.data.data); setReminders(feeReminders.data.data); setRemindSummary(remindSum.data.data); setError('');
      await loadPayLinks();
    } catch (e: any) { setError(e.response?.data?.message || 'Fees could not be loaded.'); }
  }, [page, loadPayLinks]);
  useEffect(() => { load(); }, [load]);
  const refreshReminders = async () => { try { const [r, s] = await Promise.all([apiClient.get('/api/admin/fees/reminders', { params: { per_page: 50 } }), apiClient.get('/api/admin/fees/reminders/summary')]); setReminders(r.data.data); setRemindSummary(s.data.data); } catch (e: any) { setError(e.response?.data?.message || 'Reminder activity could not be loaded.'); } };
  const openRemind = (row?: any) => { setRemindInvoice(row || undefined); setRemindOpen(true); setRemindPreview(undefined); remindForm.resetFields(); };
  const remindParams = (values: any) => remindInvoice ? { invoiceId: remindInvoice.id, channel: values.channel, window: 'all' } : { structureId: values.structureId || undefined, channel: values.channel, window: values.window || 'overdue' };
  const refreshRemindPreview = (values: any) => { if (!remindOpen) return; apiClient.get('/api/admin/fees/reminders/dry-run', { params: remindParams(values) }).then(r => setRemindPreview(r.data.data)).catch(() => setRemindPreview(undefined)); };
  const sendReminders = async (values: any) => {
    setRemindBusy(true); setError('');
    try {
      const body = { ...remindParams(values), message: values.message || undefined };
      const r = await apiClient.post('/api/admin/fees/reminders', body);
      message.success(r.data.data.message || 'Reminders queued.');
      setRemindOpen(false); setRemindPreview(undefined);
      await Promise.all([load(), refreshReminders()]);
    } catch (e: any) { setError(e.response?.data?.message || 'Reminders could not be queued.'); }
    finally { setRemindBusy(false); }
  };
  const retryReminder = async (row: any) => { try { const r = await apiClient.post(`/api/admin/fees/reminders/${row.id}/retry`); message.success(r.data.data.message || 'Reminder requeued.'); await refreshReminders(); } catch (e: any) { message.error(e.response?.data?.message || 'Reminder could not be retried.'); } };

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
    { title: 'Actions', fixed: 'right' as const, render: (_: any, row: any) => <Space><Button size="small" disabled={row.status === 'cancelled' || row.balanceMinor <= 0} onClick={() => open(row, 'collect')}>Collect</Button><Button size="small" disabled={row.status === 'cancelled' || row.paidMinor !== 0 || row.concessionMinor !== 0} onClick={() => open(row, 'cancel')}>Cancel</Button><Tooltip title={row.status === 'cancelled' || row.balanceMinor <= 0 ? 'This invoice has no open balance.' : 'Remind this family about the open balance.'}><Button size="small" icon={<BellOutlined />} disabled={row.status === 'cancelled' || row.balanceMinor <= 0} onClick={() => openRemind(row)}>Remind</Button></Tooltip><Tooltip title="View this student's complete open term bill and print the demand."><Button size="small" icon={<PrinterOutlined />} onClick={() => setDemand({ studentId: row.studentId, label: row.studentName })}>Demand</Button></Tooltip></Space> },
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
      { key: 'pay-links', label: 'Payment links', children: <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card title="Payment gateway">
          {!gatewayStatus ? <Skeleton active /> : <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              Payment links are fully opt-in. The gateway stays disabled until the school stores real credentials and the admin runs the self-test. Nothing is charged and no external money is moved by this screen.
            </Typography.Text>
            {gatewayStatus.configured
              ? <><Tag color={gatewayStatus.enabled ? 'green' : 'orange'}>{gatewayStatus.enabled ? 'Enabled' : 'Disabled until self-test'}</Tag>
                <Button size="small" icon={<ReloadOutlined />} onClick={loadPayLinks}>Refresh</Button>
                {!gatewayStatus.enabled && <Typography.Paragraph type="secondary" style={{ margin: 0 }}>Run the gateway self-test to enable payment links.</Typography.Paragraph>}
              </>
              : <Alert type="info" showIcon message="No gateway configured" description="Configure the gateway to create payment links. This does not add a paid integration; it only stores the school's own credentials until the admin enables them." />}
            {gatewayStatus.webhookUrl && <Typography.Text type="secondary" style={{ fontSize: 12 }}>Webhook endpoint: <code>{gatewayStatus.webhookUrl}</code></Typography.Text>}
          </Space>}
        </Card>
        <Card title="Payment links" extra={payLinkSummary ? <Space><Tag>{payLinkSummary.open} open</Tag><Tag color="green">{payLinkSummary.paidToday} paid today</Tag><Tag color="orange">{payLinkSummary.expired7d} expired (7 d)</Tag></Space> : null}>
          <Collapse ghost items={[{ key: 'create', label: <Space><PlusOutlined /> Create payment link</Space>, children: gatewayStatus?.enabled ? <Form form={payLinkForm} layout="vertical" onFinish={createPayLink}>
            <Form.Item name="studentId" label="Student" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={(options.students || []).map((s: any) => ({ value: s.value, label: s.label }))} placeholder="Select a student" /></Form.Item>
            <Form.Item name="invoiceIds" label="Invoices" rules={[{ required: true }]}><Select mode="multiple" showSearch optionFilterProp="label" options={(options.invoices || []).map((i: any) => ({ value: i.value, label: `${i.label} · ${i.amountMinor} ${gatewayStatus?.currency || 'INR'}` }))} /></Form.Item>
            <Form.Item name="expiresInDays" label="Expires in" rules={[{ required: true }]}><Select options={[{ value: 1, label: '1 day' }, { value: 3, label: '3 days' }, { value: 7, label: '7 days' }]} /></Form.Item>
            <Button type="primary" htmlType="submit" disabled={!gatewayStatus?.enabled}>Create payment link</Button>
          </Form> : <Typography.Paragraph type="secondary">Enable the gateway before creating links.</Typography.Paragraph> }]} />
          <Divider />
          <Table size="middle" rowKey="id" scroll={{ x: 1140 }} dataSource={payLinks} pagination={{ pageSize: 10, showSizeChanger: false }} locale={{ emptyText: <Empty description="No payment links yet." /> }} columns={[
            { title: 'Link', dataIndex: 'id', render: (v: string) => <Typography.Link href={`/pay/${v}`}>{v.slice(0, 8)}…</Typography.Link> },
            { title: 'Student', dataIndex: 'studentName' }, { title: 'Invoices', dataIndex: 'invoiceCount', width: 80 },
            { title: 'Amount', dataIndex: 'amountPaise', render: (v: number) => currencyAmount(v, gatewayStatus?.currency) },
            { title: 'Status', dataIndex: 'status', render: (v: string) => <Tag color={v === 'paid' ? 'green' : v === 'expired' || v === 'cancelled' ? 'default' : v === 'failed' ? 'red' : 'orange'}>{v}</Tag> },
            { title: 'Receipt', dataIndex: 'receiptNo', render: (v: string) => v || '—' },
            { title: 'Provider', dataIndex: 'providerRef', render: (v: string) => v || '—' },
            { title: 'Created', dataIndex: 'createdAt', render: (v: number) => new Date(v * 1000).toLocaleString() },
            { title: 'Actions', render: (_: any, row: any) => row.status === 'pending' || row.status === 'failed' ? <Popconfirm title="Cancel this payment link?" onConfirm={() => cancelPayLink(row.id)}><Button size="small" danger>Cancel</Button></Popconfirm> : null },
          ]} />
        </Card>
      </Space> },
      { key: 'structures', label: 'Fee structures', children: <Space direction="vertical" size={16} style={{ width: '100%' }}><Card title="Current fee structures" extra={<Button type="primary" icon={<SettingOutlined />} onClick={standardGroups}>Prepare standard fee heads</Button>}><Typography.Paragraph type="secondary">Create actual billing periods, scope them to classes or sections, then assign them to the active roster.</Typography.Paragraph><Table size="middle" rowKey="id" scroll={{ x: 1180 }} dataSource={structures} columns={structureCols} pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty description="No fee structures configured yet." /> }} /></Card><Card><Collapse ghost items={[{ key: 'structure', label: <Space><PlusOutlined /> Create fee structure</Space>, children: <ActualCommandForm currency={currency} fields={structureFields} url="/api/admin/fees/structures" after={load} label="Save fee structure" /> }, { key: 'opening', label: <Space><FileAddOutlined /> Import an opening balance</Space>, children: <ActualCommandForm currency={currency} fields={manualFields} url="/api/admin/fees/manual-balance" after={load} label="Record opening balance" /> }]} /></Card></Space> },
      { key: 'groups', label: 'Fee heads', children: <Card title="Fee heads" extra={<Button type="primary" icon={<PlusOutlined />} onClick={standardGroups}>Prepare standard heads</Button>}><Typography.Paragraph type="secondary">Fee heads are reusable labels such as tuition, transport or examination charges. Preparing standard heads only creates them when you explicitly confirm the action.</Typography.Paragraph><Table size="middle" rowKey="id" dataSource={groups} columns={[{ title: 'Name', dataIndex: 'name' }, { title: 'Description', dataIndex: 'description', render: (value: string) => value || '—' }]} locale={{ emptyText: <Empty description="No fee heads have been configured." /> }} /><Divider /><Collapse ghost items={[{ key: 'group', label: <Space><PlusOutlined /> Add a fee head</Space>, children: <ActualCommandForm currency={currency} fields={[{ name: 'name', label: 'Fee head name', max: 80 }, { name: 'description', label: 'Description', type: 'long', max: 255, optional: true }]} url="/api/admin/fees/groups" after={load} label="Add fee head" /> }]} /></Card> },
      { key: 'reminders', label: 'Reminders', children: <Space direction="vertical" size={16} style={{ width: '100%' }}><Row gutter={[16, 16]}><Col xs={12} md={6}><Card className="gk-fee-stat-card"><Statistic title="Queued" value={remindSummary?.queued ?? 0} prefix={<span style={{ color: '#2563eb' }}><BellOutlined /></span>} /></Card></Col><Col xs={12} md={6}><Card className="gk-fee-stat-card"><Statistic title="Sent" value={remindSummary?.sent ?? 0} prefix={<span style={{ color: '#16a34a' }}><FileDoneOutlined /></span>} /></Card></Col><Col xs={12} md={6}><Card className="gk-fee-stat-card"><Statistic title="Failed" value={remindSummary?.failed ?? 0} prefix={<span style={{ color: '#dc2626' }}><SettingOutlined /></span>} /></Card></Col><Col xs={12} md={6}><Card className="gk-fee-stat-card"><Statistic title="Consent coverage" value={remindSummary?.openFamilies ? Math.round((remindSummary.consentedFamilies / Math.max(1, remindSummary.openFamilies)) * 100) : 0} suffix="%" prefix={<span style={{ color: '#d97706' }}><WalletOutlined /></span>} /></Card></Col></Row>{remindSummary && <Typography.Text type="secondary">{remindSummary.consentedFamilies} of {remindSummary.openFamilies} families with open dues have WhatsApp fee-reminder consent. Record consent in the WhatsApp workspace to reach the rest.</Typography.Text>}<Card title="Recent reminders" extra={<Space><Badge status="default" text={`${reminders.length} records`} /><Button size="small" icon={<ReloadOutlined />} onClick={refreshReminders}>Refresh</Button><Button type="primary" size="small" icon={<BellOutlined />} onClick={() => openRemind()}>Send reminders</Button></Space>}><Table size="middle" rowKey="id" scroll={{ x: 1000 }} dataSource={reminders} pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty description="No reminders queued yet." /> }} columns={[{ title: 'Time', dataIndex: 'createdAt', render: (v: any) => new Date(v * 1000).toLocaleString() }, { title: 'Student', dataIndex: 'studentName' }, { title: 'Fee', dataIndex: 'feeName' }, { title: 'Channel', dataIndex: 'channel', render: (v: string) => <Tag>{v}</Tag> }, { title: 'Recipient', dataIndex: 'recipient' }, { title: 'Status', dataIndex: 'status', render: (v: string, row: any) => { const map: Record<string, [string, string]> = { queued: ['Queued', 'blue'], processing: ['Sending', 'blue'], sent: ['Sent', 'green'], failed: ['Failed', 'red'], provider_not_configured: ['Provider not set up', 'orange'], skipped: ['Skipped', 'default'] }; const [label, color] = map[v] || [titleCase(v), 'default']; return <Tooltip title={row.detail || undefined}><Tag color={color}>{label}</Tag></Tooltip>; } }, { title: 'Action', render: (_: any, row: any) => (row.status === 'failed' || row.status === 'provider_not_configured') ? <Button size="small" onClick={() => retryReminder(row)}>Retry</Button> : null }]} /><Typography.Link href="/whatsapp" style={{ display: 'block', marginTop: 12 }}>Manage fee-reminder consent in the WhatsApp workspace →</Typography.Link></Card></Space> },
      { key: 'policy', label: 'Numbering policy', children: <Card title="Current-year numbering policy"><Alert type="info" showIcon message="Use the existing school convention" description="The policy becomes locked after the first invoice. Enter the next unused invoice and receipt numbers exactly as maintained by the school." />{policy && <Typography.Paragraph className="gk-fee-policy-summary">Current convention: <strong>{policy.invoicePrefix}</strong> invoices and <strong>{policy.receiptPrefix}</strong> receipts · next invoice <strong>{policy.nextInvoiceNumber}</strong> · next receipt <strong>{policy.nextReceiptNumber}</strong>.</Typography.Paragraph>}<Divider /><ActualCommandForm currency={currency} initialValues={policy} key={policy?.version || 0} fields={[{ name: 'invoicePrefix', label: 'Invoice prefix', max: 30 }, { name: 'receiptPrefix', label: 'Receipt prefix', max: 30 }, { name: 'numberWidth', label: 'Number width', type: 'number', max: 12 }, { name: 'nextInvoiceNumber', label: 'Next unused invoice number', type: 'number', max: 999999999999 }, { name: 'nextReceiptNumber', label: 'Next unused receipt number', type: 'number', max: 999999999999 }]} extra={{ version: policy?.version || 0 }} url="/api/admin/fees/policy" method="put" after={load} label="Save numbering policy" /></Card> },
    ]} />
    <Drawer width={650} title="Record money received" open={!!selected} onClose={() => setSelected(undefined)}>{selected && <><Typography.Paragraph>{selected.invoiceNo} · {selected.studentName} · Outstanding {currencyAmount(selected.balanceMinor, selected.currency)}</Typography.Paragraph><ActualCommandForm currency={currency} key={`${selected.id}-${selected.version}`} fields={[amount('amountMinor', 'Amount received in minor currency units'), amount('concessionMinor', 'Concession (0 if none)', 0), { name: 'paymentMode', label: 'Payment method', type: 'select', options: choices(['cash', 'cheque', 'bank_transfer', 'upi', 'card']) }, { name: 'transactionRef', label: 'Non-cash transaction reference', optional: true }, { name: 'paidOn', label: 'Payment date', type: 'date' }, { name: 'remarks', label: 'Collection remarks', type: 'long' }]} extra={{ invoiceId: selected.id, version: selected.version }} url="/api/admin/fees/payments" after={async () => { setSelected(undefined); await load(); await ledger(); }} label="Record collection" /></>}</Drawer>
    <Drawer width={1100} title="Immutable receipts and corrections" open={receipts !== null} onClose={() => setReceipts(null)}><Table rowKey="id" scroll={{ x: true }} dataSource={receipts || []} pagination={{ current: receiptPage, total: receiptTotal, pageSize: 20, onChange: ledger }} columns={[...['receiptNo', 'invoiceNo', 'studentName', 'entryType', 'amountMinor', 'concessionMinor', 'currency', 'paidOn', 'paymentMode', 'transactionRef', 'remarks', 'recordedBy'].map(key => ({ title: humanize(key), dataIndex: key,render:(v:any,r:any)=>displayValue(key,v,r.currency||currency) })), { title: 'Correction', render: (_: any, row: any) => <Space><Button disabled={row.entryType !== 'collection' || !!row.reversedBy} onClick={() => open(row, 'reverse')}>Reverse</Button><Button disabled={row.entryType !== 'collection' || !!row.reversedBy} onClick={() => open(row, 'adjust')}>Adjust</Button></Space> }]} /></Drawer>
    <Modal title={remindInvoice ? `Remind this family` : 'Send fee reminders'} open={remindOpen} onCancel={() => setRemindOpen(false)} footer={null} width={620}>
      {remindInvoice && <Typography.Paragraph><strong>{remindInvoice.invoiceNo}</strong> · {remindInvoice.studentName} · Outstanding {currencyAmount(remindInvoice.balanceMinor, remindInvoice.currency)}</Typography.Paragraph>}
      <Form form={remindForm} layout="vertical" onFinish={sendReminders} onValuesChange={(_v, all) => refreshRemindPreview(all)} initialValues={{ channel: 'whatsapp', window: 'overdue', structureId: undefined, message: '' }}>
        <Form.Item name="channel" label="Channel" rules={[{ required: true }]}>
          <Radio.Group options={[{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS' }]} optionType="button" buttonStyle="solid" />
        </Form.Item>
        {!remindInvoice && <Row gutter={12}>
          <Col span={12}><Form.Item name="structureId" label="Fee structure (optional)" style={{ marginBottom: 4 }}><Select allowClear showSearch optionFilterProp="label" placeholder="All open invoices" options={(structures || []).map((s: any) => ({ value: s.id, label: `${s.feeGroupName} — ${s.name}` }))} /></Form.Item></Col>
          <Col span={12}><Form.Item name="window" label="Due window" rules={[{ required: true }]}><Select options={[{ value: 'overdue', label: 'Overdue' }, { value: 'due_7d', label: 'Due within 7 days' }, { value: 'all', label: 'All open' }]} /></Form.Item></Col>
        </Row>}
        <Form.Item name="message" label="Message (optional)" style={{ marginBottom: 4 }}>
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={1000} showCount placeholder="Default: the school's fee-reminder wording with head, student, balance and due date." />
        </Form.Item>
        {remindPreview && <Alert type={remindPreview.eligible > 0 ? 'info' : 'warning'} showIcon style={{ marginBottom: 12 }} message={`${remindPreview.eligible} of ${remindPreview.open} open invoice${remindPreview.open === 1 ? '' : 's'} will be reminded${remindPreview.skipped ? `; ${remindPreview.skipped} skipped` : ''}.`} description={<>
          {Object.keys(remindPreview.byReason || {}).length > 0 && <Typography.Text type="secondary">{Object.entries(remindPreview.byReason).map(([k, n]) => `${n} × ${titleCase(String(k))}`).join(' · ')}</Typography.Text>}
          {remindPreview.note && <Typography.Text type="secondary">{remindPreview.note}</Typography.Text>}
        </>}/>}
        <Space style={{ marginTop: 4 }}><Button type="primary" htmlType="submit" loading={remindBusy} disabled={remindPreview?.eligible === 0}>{remindPreview && remindPreview.eligible === 0 ? 'Nothing to queue' : 'Queue reminders'}</Button><Button onClick={() => setRemindOpen(false)}>Cancel</Button></Space>
      </Form>
    </Modal>
    <Drawer title={correction?.kind === 'adjust' ? 'Adjust receipt' : correction?.kind === 'reverse' ? 'Record ledger reversal' : 'Cancel unpaid invoice'} open={!!correction} onClose={() => setCorrection(undefined)}>{correction && <><Alert type="info" showIcon message="Original history remains immutable." description="Corrections are recorded as a reversal and replacement entry." /><ActualCommandForm currency={currency} key={`${correction.row.id}-${correction.invoice.version}`} fields={correction.kind === 'adjust' ? [amount('amountMinor', 'Corrected amount in minor currency units'), amount('concessionMinor', 'Corrected concession', 0), { name: 'paymentMode', label: 'Payment method', type: 'select', options: choices(['cash', 'cheque', 'bank_transfer', 'upi', 'card']) }, { name: 'transactionRef', label: 'Non-cash transaction reference', optional: true }, { name: 'paidOn', label: 'Correction date', type: 'date' }, { name: 'reason', label: 'Reason', type: 'long' }] : [...(correction.kind === 'reverse' ? [{ name: 'paidOn', label: 'Correction date', type: 'date' as const }] : []), { name: 'reason', label: 'Reason', type: 'long' }]} extra={correction.kind === 'adjust' ? { invoiceId: correction.row.invoiceId, receiptId: correction.row.id, version: correction.invoice.version } : correction.kind === 'reverse' ? { invoiceId: correction.row.invoiceId, version: correction.invoice.version } : { version: correction.invoice.version }} url={correction.kind === 'adjust' ? `/api/admin/fees/invoices/${correction.row.invoiceId}/adjust` : `/api/admin/fees/${correction.kind === 'reverse' ? `receipts/${correction.row.id}/reverse` : `invoices/${correction.row.id}/cancel`}`} after={async () => { setCorrection(undefined); await load(); if (receipts !== null) await ledger(receiptPage); }} label="Save correction" /></>}</Drawer>
    <FeeDemandDrawer studentId={demand?.studentId || ''} studentLabel={demand?.label} open={!!demand} onClose={() => setDemand(undefined)} />
  </Space>;
};
