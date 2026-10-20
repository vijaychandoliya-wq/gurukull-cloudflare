import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AlertOutlined, PlusOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface IncidentItem {
  key: string;
  id: number;
  studentName: string;
  class: string;
  incidentTitle: string;
  severity: 'Low' | 'Medium' | 'High';
  incidentDate: string;
  actionTaken: string;
  parentNotified: boolean;
}

const initialIncidents: IncidentItem[] = [
  { key: '1', id: 1, studentName: 'Rohan Verma', class: 'Grade 10 - Section A', incidentTitle: 'Repeated classroom late arrivals (3 times this week)', severity: 'Low', incidentDate: '2026-08-10', actionTaken: 'Verbal counseling by class teacher and warning slip', parentNotified: true },
  { key: '2', id: 2, studentName: 'Aditya Rao', class: 'Grade 8 - Section B', incidentTitle: 'Corridor disruption and science lab equipment mishandling', severity: 'Medium', incidentDate: '2026-08-12', actionTaken: 'Library detention for 2 days + Parent meeting called', parentNotified: true },
];

export const DisciplinePage: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentItem[]>(initialIncidents);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = (values: any) => {
    const newInc: IncidentItem = {
      key: String(incidents.length + 1),
      id: incidents.length + 1,
      studentName: values.studentName,
      class: values.class,
      incidentTitle: values.incidentTitle,
      severity: values.severity,
      incidentDate: new Date().toISOString().split('T')[0],
      actionTaken: values.actionTaken,
      parentNotified: values.parentNotified === 'true',
    };
    setIncidents([...incidents, newInc]);
    setIsModalOpen(false);
    form.resetFields();
    message.success('Disciplinary incident recorded in student conduct ledger.');
  };

  const columns: ColumnsType<IncidentItem> = [
    {
      title: 'Student',
      key: 'student',
      render: (_, r) => <div><Text strong>{r.studentName}</Text><div style={{ fontSize: 11, color: '#64748B' }}>{r.class}</div></div>,
    },
    { title: 'Incident Description', dataIndex: 'incidentTitle', key: 'incidentTitle' },
    {
      title: 'Severity Level',
      dataIndex: 'severity',
      key: 'severity',
      render: (sev) => <Tag color={sev === 'High' ? 'red' : sev === 'Medium' ? 'gold' : 'blue'}>{sev}</Tag>,
    },
    { title: 'Date', dataIndex: 'incidentDate', key: 'incidentDate', render: (d) => <Text type="secondary"><CalendarOutlined /> {d}</Text> },
    { title: 'Corrective Action Taken', dataIndex: 'actionTaken', key: 'actionTaken' },
    {
      title: 'Parent Alert',
      dataIndex: 'parentNotified',
      key: 'parentNotified',
      render: (notif) => <Tag color={notif ? 'green' : 'default'}>{notif ? 'Parent Briefed' : 'Pending'}</Tag>,
    },
  ];

  return (
    <Card
      title={<Title level={5} style={{ margin: 0 }}>Student Conduct & Disciplinary Incident Register</Title>}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ background: '#0A2540', borderColor: '#0A2540' }}
        >
          Log Conduct Incident
        </Button>
      }
      bordered={false}
    >
      <Table columns={columns} dataSource={incidents} pagination={false} />

      <Modal
        title="Log Disciplinary Incident"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="studentName" label="Student Full Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Rohan Verma" />
          </Form.Item>
          <Form.Item name="class" label="Class Section" initialValue="Grade 10 - Section A">
            <Input />
          </Form.Item>
          <Form.Item name="severity" label="Severity Rating" initialValue="Low">
            <Select
              options={[
                { value: 'Low', label: 'Low (First warning / Minor uniform issue)' },
                { value: 'Medium', label: 'Medium (Disruption / Homework neglect)' },
                { value: 'High', label: 'High (Aggression / Exam malpractice)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="incidentTitle" label="Incident Summary" rules={[{ required: true }]}>
            <Input placeholder="e.g. Incomplete homework and disruptive behavior" />
          </Form.Item>
          <Form.Item name="actionTaken" label="Action & Counseling Remarks" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="e.g. Counseling by class teacher, apology letter" />
          </Form.Item>
          <Form.Item name="parentNotified" label="Parent Notification Status" initialValue="true">
            <Select
              options={[
                { value: 'true', label: 'Notify Parent via Eklavya App & SMS' },
                { value: 'false', label: 'Internal School Record Only' },
              ]}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                Save Incident
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
