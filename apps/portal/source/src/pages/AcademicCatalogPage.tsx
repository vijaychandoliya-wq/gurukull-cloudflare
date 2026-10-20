import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Card, Form, Input, InputNumber, Select, Space, Table, Tabs, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { apiClient } from '../services/api';
import { en } from '../i18n/en';

export const AcademicCatalogPage: React.FC = () => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [options, setOptions] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>();
  const [editingAssignment, setEditingAssignment] = useState<any>();
  const [subjectForm] = Form.useForm();
  const [assignmentForm] = Form.useForm();
  const keys = useRef<Record<string, string>>({});
  const { message } = App.useApp();
  const load = useCallback(async () => {
    try {
      const [subjectsResponse, assignmentsResponse, optionsResponse] = await Promise.all([apiClient.get('/api/admin/subjects'), apiClient.get('/api/admin/teacher-assignments'), apiClient.get('/api/admin/academic-options')]);
      setSubjects(subjectsResponse.data.data); setAssignments(assignmentsResponse.data.data); setOptions(optionsResponse.data.data); setError(null);
    } catch (requestError: any) { setError(requestError.response?.data?.message || 'Academic records could not be loaded.'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const save = async (kind: 'subjects' | 'teacher-assignments') => {
    const form = kind === 'subjects' ? subjectForm : assignmentForm;
    const editing = kind === 'subjects' ? editingSubject : editingAssignment;
    try {
      const values = await form.validateFields(); setSaving(true); setError(null); keys.current[kind] ||= crypto.randomUUID();
      const response = await apiClient.request({ url: `/api/admin/${kind}${editing ? `/${editing.id}` : ''}`, method: editing ? 'put' : 'post', data: { ...values, ...(editing ? { version: editing.version } : {}) }, headers: { 'Idempotency-Key': keys.current[kind] } });
      delete keys.current[kind]; message.success(response.data.message); form.resetFields(); kind === 'subjects' ? setEditingSubject(undefined) : setEditingAssignment(undefined); await load();
    } catch (requestError: any) { if (!requestError.errorFields) setError(requestError.response?.data?.message || 'The record could not be saved. Retry uses the same command.'); } finally { setSaving(false); }
  };
  const begin = (kind: 'subject' | 'assignment', row: any) => { const form = kind === 'subject' ? subjectForm : assignmentForm; form.resetFields(); form.setFieldsValue(row); kind === 'subject' ? setEditingSubject(row) : setEditingAssignment(row); };
  const subjectTab = <Card title={en.subjects.subjectsTab}><Table rowKey="id" dataSource={subjects} columns={[{ title: 'Name', dataIndex: 'name' }, { title: 'Class', dataIndex: 'className' }, { title: 'Code', dataIndex: 'code' }, { title: 'Type', dataIndex: 'type' }, { title: 'Action', render: (_: unknown, row: any) => <Button onClick={() => begin('subject', row)}>{en.common.edit}</Button> }]} /><Form form={subjectForm} layout="vertical"><Form.Item name="name" label="Subject name" rules={[{ required: true }]}><Input maxLength={120} /></Form.Item><Form.Item name="sectionId" label="Class and section" rules={[{ required: true }]}><Select disabled={!!editingSubject} options={options.classes || []} /></Form.Item><Form.Item name="code" label="Code"><Input maxLength={30} /></Form.Item><Form.Item name="type" label="Subject type" rules={[{ required: true }]}><Input maxLength={60} /></Form.Item><Space><Button type="primary" loading={saving} onClick={() => save('subjects')}>{editingSubject ? 'Save subject changes' : 'Add subject'}</Button>{editingSubject && <Button onClick={() => { subjectForm.resetFields(); setEditingSubject(undefined); }}>{en.common.cancel}</Button>}</Space></Form></Card>;
  const assignmentTab = <Card title={en.subjects.assignmentsTab}><Table rowKey="id" dataSource={assignments} columns={[{ title: 'Teacher', dataIndex: 'teacherName' }, { title: 'Subject', dataIndex: 'subjectName' }, { title: 'Class', dataIndex: 'className' }, { title: 'Periods per week', dataIndex: 'plannedPeriods' }, { title: 'Action', render: (_: unknown, row: any) => <Button onClick={() => begin('assignment', row)}>{en.common.edit}</Button> }]} /><Form form={assignmentForm} layout="vertical"><Form.Item name="teacherId" label="Teacher" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={options.teachers || []} /></Form.Item><Form.Item name="subjectId" label="Subject and section" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={options.subjects || []} /></Form.Item><Form.Item name="plannedPeriods" label="Required periods per week" rules={[{ required: true }]}><InputNumber min={1} max={112} style={{ width: '100%' }} /></Form.Item><Space><Button type="primary" loading={saving} onClick={() => save('teacher-assignments')}>{editingAssignment ? 'Save assignment changes' : 'Assign teacher'}</Button>{editingAssignment && <Button onClick={() => { assignmentForm.resetFields(); setEditingAssignment(undefined); }}>{en.common.cancel}</Button>}</Space></Form></Card>;
  return <Space direction="vertical" size="large" style={{ width: '100%' }}><Typography.Title level={3}>{en.subjects.title}</Typography.Title><Alert type="info" showIcon message="Use the actual current academic year" description={<>Save <Link to="/settings">school settings</Link> and the real year, classes and sections in <Link to="/academics">Academics</Link> first. Assign saved teachers before scheduling the <Link to="/timetable">timetable</Link>.</>} />{error && <Alert type="error" showIcon message={error} />}<Button onClick={load}>{en.common.refresh}</Button><Tabs items={[{ key: 'subjects', label: en.subjects.subjectsTab, children: subjectTab }, { key: 'assignments', label: en.subjects.assignmentsTab, children: assignmentTab }]} /></Space>;
};
