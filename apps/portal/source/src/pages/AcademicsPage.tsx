import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, InputNumber, Select, Tabs, Typography, Row, Col, Statistic, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, BankOutlined, CheckCircleOutlined, TeamOutlined, EditOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface StandardLinkItem {
  key: string;
  id: number;
  standard: string;
  section: string;
  roomNo: string;
  capacity: number;
  enrolledStudents: number;
  classTeacher: string;
  status: 'active' | 'inactive';
}

const initialStandardLinks: StandardLinkItem[] = [
  { key: '1', id: 1, standard: 'Grade 1', section: 'Section A', roomNo: 'Room 101', capacity: 40, enrolledStudents: 38, classTeacher: 'Sunita Verma', status: 'active' },
  { key: '2', id: 2, standard: 'Grade 1', section: 'Section B', roomNo: 'Room 102', capacity: 40, enrolledStudents: 39, classTeacher: 'Priya Mehta', status: 'active' },
  { key: '3', id: 3, standard: 'Grade 2', section: 'Section A', roomNo: 'Room 103', capacity: 40, enrolledStudents: 37, classTeacher: 'Ramesh Gupta', status: 'active' },
  { key: '4', id: 4, standard: 'Grade 10', section: 'Section A', roomNo: 'Room 201', capacity: 45, enrolledStudents: 43, classTeacher: 'Amitabh Sen', status: 'active' },
];

export const AcademicsPage: React.FC = () => {
  const [links, setLinks] = useState<StandardLinkItem[]>(initialStandardLinks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = (values: any) => {
    const newLink: StandardLinkItem = {
      key: String(links.length + 1),
      id: links.length + 1,
      standard: values.standard,
      section: values.section,
      roomNo: values.roomNo,
      capacity: Number(values.capacity) || 40,
      enrolledStudents: 0,
      classTeacher: values.classTeacher,
      status: 'active',
    };
    setLinks([...links, newLink]);
    setIsModalOpen(false);
    form.resetFields();
    message.success(`Class ${newLink.standard} - ${newLink.section} created and mapped to ${newLink.roomNo}!`);
  };

  const columns: ColumnsType<StandardLinkItem> = [
    { title: 'Standard / Grade', dataIndex: 'standard', key: 'standard', render: (s) => <Text strong>{s}</Text> },
    { title: 'Section', dataIndex: 'section', key: 'section', render: (sec) => <Tag color="blue">{sec}</Tag> },
    { title: 'Classroom Allocated', dataIndex: 'roomNo', key: 'roomNo', render: (r) => <Tag color="geekblue">{r}</Tag> },
    {
      title: 'Enrolled / Capacity',
      key: 'capacity',
      render: (_, r) => (
        <Space>
          <Text strong>{r.enrolledStudents}</Text> / {r.capacity}
          <Tag color={r.enrolledStudents >= r.capacity ? 'red' : 'green'}>
            {r.capacity - r.enrolledStudents} seats left
          </Tag>
        </Space>
      ),
    },
    { title: 'Class Teacher', dataIndex: 'classTeacher', key: 'classTeacher', render: (t) => <Text strong>{t}</Text> },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: () => <Tag icon={<CheckCircleOutlined />} color="success">ACTIVE</Tag>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="ACTIVE ACADEMIC YEAR" value="2026–2027" />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="TOTAL STANDARDS" value={10} suffix="Grades (1-10)" />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="CLASSROOM SECTIONS" value={24} suffix="Active Sections" />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="CLASSROOM CAPACITY" value="980 / 1050" suffix="Seats Occupied" valueStyle={{ color: '#10B981' }} />
          </Card>
        </Col>
      </Row>

      <Card
        title={<Title level={5} style={{ margin: 0 }}>Academic Hierarchy & Standard Links Matrix</Title>}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalOpen(true)}
            style={{ background: '#0A2540', borderColor: '#0A2540' }}
          >
            Add Standard Section
          </Button>
        }
        bordered={false}
      >
        <Table columns={columns} dataSource={links} pagination={false} />

        <Modal
          title="Create Standard & Section Link"
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
            <Form.Item name="standard" label="Standard / Grade" initialValue="Grade 3" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'Grade 1', label: 'Grade 1' },
                  { value: 'Grade 2', label: 'Grade 2' },
                  { value: 'Grade 3', label: 'Grade 3' },
                  { value: 'Grade 4', label: 'Grade 4' },
                  { value: 'Grade 5', label: 'Grade 5' },
                  { value: 'Grade 6', label: 'Grade 6' },
                  { value: 'Grade 7', label: 'Grade 7' },
                  { value: 'Grade 8', label: 'Grade 8' },
                  { value: 'Grade 9', label: 'Grade 9' },
                  { value: 'Grade 10', label: 'Grade 10' },
                ]}
              />
            </Form.Item>

            <Form.Item name="section" label="Section" initialValue="Section A" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'Section A', label: 'Section A' },
                  { value: 'Section B', label: 'Section B' },
                  { value: 'Section C', label: 'Section C' },
                ]}
              />
            </Form.Item>

            <Form.Item name="roomNo" label="Room Allocation" rules={[{ required: true }]}>
              <Input placeholder="e.g. Room 104 (Block A)" />
            </Form.Item>

            <Form.Item name="classTeacher" label="Class Teacher" initialValue="Kavita Reddy" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'Sunita Verma', label: 'Sunita Verma (Senior Maths)' },
                  { value: 'Priya Mehta', label: 'Priya Mehta (Senior English)' },
                  { value: 'Ramesh Gupta', label: 'Ramesh Gupta (Senior Science)' },
                  { value: 'Kavita Reddy', label: 'Kavita Reddy (Social Science)' },
                  { value: 'Amitabh Sen', label: 'Amitabh Sen (Hindi / Sanskrit)' },
                ]}
              />
            </Form.Item>

            <Form.Item name="capacity" label="Seat Capacity" initialValue={40}>
              <InputNumber min={10} max={60} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                  Save Standard Link
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};
