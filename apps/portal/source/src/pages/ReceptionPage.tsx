import React, { useState } from 'react';
import { Card, Tabs, Table, Button, Tag, Space, Modal, Form, Input, Select, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PhoneOutlined, UserAddOutlined, CheckCircleOutlined, ExportOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface VisitorItem {
  key: string;
  id: number;
  visitorName: string;
  phone: string;
  purpose: string;
  visitingPerson: string;
  checkIn: string;
  badgeNo: string;
  status: 'In Campus' | 'Checked Out';
}

const initialVisitors: VisitorItem[] = [
  { key: '1', id: 1, visitorName: 'Ramesh Chawla', phone: '+91 98765 11223', purpose: 'New Admission Inquiry (Grade 1)', visitingPerson: 'Admission Desk', checkIn: '10:15 AM', badgeNo: 'VIS-881', status: 'In Campus' },
  { key: '2', id: 2, visitorName: 'Sanjay Kapoor (Tata McGraw Hill)', phone: '+91 98765 22334', purpose: 'Textbook Sample Submission', visitingPerson: 'Principal Office', checkIn: '11:00 AM', badgeNo: 'VIS-882', status: 'Checked Out' },
];

export const ReceptionPage: React.FC = () => {
  const [visitors, setVisitors] = useState<VisitorItem[]>(initialVisitors);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = (values: any) => {
    const newVisitor: VisitorItem = {
      key: String(visitors.length + 1),
      id: visitors.length + 1,
      visitorName: values.visitorName,
      phone: values.phone,
      purpose: values.purpose,
      visitingPerson: values.visitingPerson,
      checkIn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      badgeNo: `VIS-${Math.floor(100 + Math.random() * 900)}`,
      status: 'In Campus',
    };
    setVisitors([newVisitor, ...visitors]);
    setIsModalOpen(false);
    form.resetFields();
    message.success(`Visitor badge ${newVisitor.badgeNo} generated successfully!`);
  };

  const checkoutVisitor = (id: number) => {
    setVisitors(
      visitors.map((v) => (v.id === id ? { ...v, status: 'Checked Out' } : v))
    );
    message.success('Visitor check-out recorded.');
  };

  const columns: ColumnsType<VisitorItem> = [
    { title: 'Badge No', dataIndex: 'badgeNo', key: 'badgeNo', render: (b) => <Tag color="gold" style={{ fontWeight: 800 }}>{b}</Tag> },
    { title: 'Visitor Name', dataIndex: 'visitorName', key: 'visitorName', render: (n) => <Text strong>{n}</Text> },
    { title: 'Phone Number', dataIndex: 'phone', key: 'phone' },
    { title: 'Purpose of Visit', dataIndex: 'purpose', key: 'purpose' },
    { title: 'Visiting Person / Dept', dataIndex: 'visitingPerson', key: 'visitingPerson' },
    { title: 'Check In Time', dataIndex: 'checkIn', key: 'checkIn' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (st) => <Tag color={st === 'In Campus' ? 'green' : 'default'}>{st}</Tag>,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) =>
        record.status === 'In Campus' ? (
          <Button size="small" danger onClick={() => checkoutVisitor(record.id)}>
            Check Out
          </Button>
        ) : (
          <Text type="secondary" italic>Completed</Text>
        ),
    },
  ];

  return (
    <Card
      title={<Title level={5} style={{ margin: 0 }}>Front-Office & Reception Gate Pass Register</Title>}
      extra={
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ background: '#0A2540', borderColor: '#0A2540' }}
        >
          Issue Visitor Pass
        </Button>
      }
      bordered={false}
    >
      <Table columns={columns} dataSource={visitors} pagination={false} />

      <Modal
        title={<Title level={4} style={{ margin: 0 }}>Issue Visitor Gate Pass</Title>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="visitorName" label="Visitor Full Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Anand Mahindra" />
          </Form.Item>
          <Form.Item name="phone" label="Mobile Contact Number" rules={[{ required: true }]}>
            <Input placeholder="+91 98765 00000" />
          </Form.Item>
          <Form.Item name="purpose" label="Purpose of Visit" rules={[{ required: true }]}>
            <Input placeholder="e.g. Admission Inquiry / Fee Deposit / Vendor Meet" />
          </Form.Item>
          <Form.Item name="visitingPerson" label="Visiting Person / Department" initialValue="Admission Desk">
            <Select
              options={[
                { value: 'Admission Desk', label: 'Admission Desk' },
                { value: 'Principal Office', label: 'Principal Office' },
                { value: 'Accounts Department', label: 'Accounts Department' },
                { value: 'Examination Cell', label: 'Examination Cell' },
              ]}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                Print Gate Pass
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
