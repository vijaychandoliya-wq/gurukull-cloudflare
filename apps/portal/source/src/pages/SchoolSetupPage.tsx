import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Card, Checkbox, Form, Input, InputNumber, Select, Space, Table, Tabs, Typography } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../services/api';
import { BulkImportPanel } from '../components/BulkImportPanel';
import { en } from '../i18n/en';
import { useAuth } from '../context/AuthContext';

export const SchoolSetupPage: React.FC<{ academics?: boolean }> = ({ academics = false }) => {
  const { schoolCode } = useAuth();
  const [data, setData] = useState<any>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingClass, setEditingClass] = useState<any>();
  const [editingSection, setEditingSection] = useState<any>();
  const [settings] = Form.useForm();
  const [year] = Form.useForm();
  const [klass] = Form.useForm();
  const [section] = Form.useForm();
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();
  const commands = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/admin/setup');
      setData(response.data.data);
      if (response.data.data.configuration) settings.setFieldsValue(response.data.data.configuration);
      setError(null);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'School configuration could not be loaded.');
    }
  }, [settings]);
  useEffect(() => { load(); }, [load]);

  const save = async (key: string, path: string, form: any, method = 'post', id?: string) => {
    try {
      const input = await form.validateFields(); setSaving(true); setError(null);
      commands.current[key] ||= crypto.randomUUID();
      const response = await apiClient.request({ method, url: id ? `${path}/${id}` : path, data: input, headers: { 'Idempotency-Key': commands.current[key] } });
      delete commands.current[key]; message.success(response.data.message);
      form.resetFields(); if (key === 'class') setEditingClass(undefined); if (key === 'section') setEditingSection(undefined); await load();
    } catch (requestError: any) {
      if (!requestError.errorFields) setError(requestError.response?.data?.message || 'The change could not be saved. Retry uses the same command.');
    } finally { setSaving(false); }
  };

  const editClass = (row: any) => { setEditingClass(row); klass.setFieldsValue({ name: row.name, code: row.code, sortOrder: row.sortOrder || 0 }); };
  const editSection = (row: any) => { setEditingSection(row); section.setFieldsValue({ classId: row.classId, name: row.name, sortOrder: row.sortOrder || 0 }); };

  const yearTab = <Card title={en.academics.yearTab} extra={<Typography.Text type="secondary">Set the actual current year before roster imports.</Typography.Text>}>
    <Table size="small" rowKey="id" dataSource={data?.academicYears || []} columns={[{ title: 'Name', dataIndex: 'name' }, { title: 'Start', dataIndex: 'startsOn' }, { title: 'End', dataIndex: 'endsOn' }, { title: 'Current', dataIndex: 'isCurrent', render: (value: number) => value ? 'Yes' : 'No' }]} />
    <Form form={year} layout="vertical"><Form.Item name="name" label="Academic year name" rules={[{ required: true }]}><Input maxLength={80} /></Form.Item><Form.Item name="startsOn" label="Start date" rules={[{ required: true }]}><Input type="date" /></Form.Item><Form.Item name="endsOn" label="End date" rules={[{ required: true }]}><Input type="date" /></Form.Item><Form.Item name="isCurrent" valuePropName="checked" initialValue={false}><Checkbox>Make this the current academic year</Checkbox></Form.Item><Button icon={<PlusOutlined />} loading={saving} onClick={() => save('year', '/api/admin/academic-years', year)}>Add academic year</Button></Form>
  </Card>;

  const classesTab = <Card title={en.academics.classesTab} extra={<Typography.Text type="secondary">Class names and codes can be edited without leaving this tab.</Typography.Text>}>
    <Table size="small" rowKey="id" dataSource={data?.classes || []} columns={[{ title: 'Name', dataIndex: 'name' }, { title: 'Code', dataIndex: 'code' }, { title: 'Actions', render: (_: unknown, row: any) => <Button icon={<EditOutlined />} onClick={() => editClass(row)}>{en.common.edit}</Button> }]} />
    <Form form={klass} layout="vertical"><Form.Item name="name" label={en.academics.className} rules={[{ required: true }]}><Input maxLength={80} /></Form.Item><Form.Item name="code" label={en.academics.classCode}><Input maxLength={40} /></Form.Item><Form.Item name="sortOrder" label="Display order" initialValue={0}><InputNumber min={0} max={1000} style={{ width: '100%' }} /></Form.Item><Space><Button type="primary" icon={editingClass ? <EditOutlined /> : <PlusOutlined />} loading={saving} onClick={() => save('class', '/api/admin/classes', klass, editingClass ? 'put' : 'post', editingClass?.id)}>{editingClass ? 'Save class changes' : 'Add class'}</Button>{editingClass && <Button onClick={() => { setEditingClass(undefined); klass.resetFields(); }}>{en.common.cancel}</Button>}</Space></Form>
  </Card>;

  const sectionsTab = <Card title={en.academics.sectionsTab} extra={<Typography.Text type="secondary">Sections stay linked to a class and can be reordered here.</Typography.Text>}>
    <Table size="small" rowKey="id" dataSource={data?.sections || []} columns={[{ title: 'Class', dataIndex: 'className' }, { title: 'Section', dataIndex: 'name' }, { title: 'Actions', render: (_: unknown, row: any) => <Button icon={<EditOutlined />} onClick={() => editSection(row)}>{en.common.edit}</Button> }]} />
    <Form form={section} layout="vertical"><Form.Item name="classId" label="Class" rules={[{ required: true }]}><Select options={(data?.classes || []).map((value: any) => ({ value: value.id, label: value.name }))} /></Form.Item><Form.Item name="name" label={en.academics.sectionName} rules={[{ required: true }]}><Input maxLength={80} /></Form.Item><Form.Item name="sortOrder" label="Display order" initialValue={0}><InputNumber min={0} max={1000} style={{ width: '100%' }} /></Form.Item><Space><Button type="primary" icon={editingSection ? <EditOutlined /> : <PlusOutlined />} loading={saving} onClick={() => save('section', '/api/admin/sections', section, editingSection ? 'put' : 'post', editingSection?.id)}>{editingSection ? 'Save section changes' : 'Add section'}</Button>{editingSection && <Button onClick={() => { setEditingSection(undefined); section.resetFields(); }}>{en.common.cancel}</Button>}</Space></Form>
  </Card>;

  return <Space direction="vertical" size="large" style={{ width: '100%' }}>
    <Typography.Title level={3}>{academics ? en.academics.title : 'School settings'}</Typography.Title>
    <Alert type="info" showIcon message={data?.school?.name || 'School configuration'} description={<>School code {data?.school?.code || schoolCode || '—'}. Enter actual values. {academics ? <Link to="/settings">School settings</Link> : <Link to="/academics">Manage academic years, classes and sections</Link>}.</>} />
    {error && <Alert type="error" showIcon message={error} />}
    {!academics ? <Card title="Required school settings"><Form form={settings} layout="vertical"><Form.Item name="timezone" label="Timezone (IANA name)" rules={[{ required: true }]}><Input placeholder="Asia/Kolkata" /></Form.Item><Form.Item name="currency" label="Currency" rules={[{ required: true }]}><Select options={['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'NZD', 'JPY', 'AED', 'SGD', 'ZAR'].map((value) => ({ value, label: value }))} /></Form.Item><Form.Item name="address" label="School address" rules={[{ required: true }]}><Input.TextArea maxLength={500} /></Form.Item><Button type="primary" loading={saving} onClick={() => save('settings', '/api/admin/school/configuration', settings, 'put')}>Save school settings</Button></Form></Card> : <Tabs defaultActiveKey={searchParams.get('tab') === 'import' ? 'import' : 'years'} items={[{ key: 'years', label: en.academics.yearTab, children: yearTab }, { key: 'classes', label: en.academics.classesTab, children: classesTab }, { key: 'sections', label: en.academics.sectionsTab, children: sectionsTab }, { key: 'import', label: en.academics.importTab, children: <BulkImportPanel onImported={load} /> }]} />}
  </Space>;
};
