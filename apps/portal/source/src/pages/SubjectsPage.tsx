import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BookOutlined, PlusOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface SubjectItem {
  key: string;
  id: number;
  name: string;
  code: string;
  type: 'Theory' | 'Practical' | 'Both';
  isElective: boolean;
  standards: string[];
  assignedTeachers: string[];
}

const initialSubjects: SubjectItem[] = [
  { key: '1', id: 1, name: 'Mathematics', code: 'MATH-101', type: 'Theory', isElective: false, standards: ['Grade 1', 'Grade 2', 'Grade 10'], assignedTeachers: ['Sunita Verma', 'Alok Roy'] },
  { key: '2', id: 2, name: 'Science & Physics Lab', code: 'SCI-201', type: 'Both', isElective: false, standards: ['Grade 1', 'Grade 2', 'Grade 10'], assignedTeachers: ['Ramesh Gupta'] },
  { key: '3', id: 3, name: 'English Core Literature', code: 'ENG-101', type: 'Theory', isElective: false, standards: ['Grade 1', 'Grade 2', 'Grade 10'], assignedTeachers: ['Priya Mehta'] },
  { key: '4', id: 4, name: 'Computer Science & Python', code: 'CS-301', type: 'Both', isElective: true, standards: ['Grade 9', 'Grade 10'], assignedTeachers: ['Alok Roy'] },
  { key: '5', id: 5, name: 'French Language', code: 'LAN-FRE', type: 'Theory', isElective: true, standards: ['Grade 6', 'Grade 7', 'Grade 8'], assignedTeachers: ['Devika Das'] },
];

export const SubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectItem[]>(initialSubjects);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = (values: any) => {
    const newSub: SubjectItem = {
      key: String(subjects.length + 1),
      id: subjects.length + 1,
      name: values.name,
      code: values.code,
      type: values.type,
      isElective: values.isElective === 'true',
      standards: values.standards || ['Grade 1'],
      assignedTeachers: values.assignedTeachers || ['Sunita Verma'],
    };
    setSubjects([...subjects, newSub]);
    setIsModalOpen(false);
    form.resetFields();
    message.success(`Subject ${newSub.name} (${newSub.code}) created!`);
  };

  const columns: ColumnsType<SubjectItem> = [
    { title: 'Subject Code', dataIndex: 'code', key: 'code', render: (c) => <Text code strong>{c}</Text> },
    { title: 'Subject Name', dataIndex: 'name', key: 'name', render: (n) => <Text strong>{n}</Text> },
    {
      title: 'Assessment Type',
      dataIndex: 'type',
      key: 'type',
      render: (t) => <Tag color={t === 'Both' ? 'purple' : t === 'Practical' ? 'gold' : 'blue'}>{t}</Tag>,
    },
    {
      title: 'Curriculum Nature',
      dataIndex: 'isElective',
      key: 'isElective',
      render: (elec) => <Tag color={elec ? 'orange' : 'green'}>{elec ? 'Elective' : 'Core Compulsory'}</Tag>,
    },
    {
      title: 'Applicable Grades',
      dataIndex: 'standards',
      key: 'standards',
      render: (stds: string[]) => stds.map((s, i) => <Tag key={i}>{s}</Tag>),
    },
    {
      title: 'Faculty Assigned',
      dataIndex: 'assignedTeachers',
      key: 'assignedTeachers',
      render: (t: string[]) => t.join(', '),
    },
  ];

  return (
    <Card
      title={<Title level={5} style={{ margin: 0 }}>Curricular Subjects & Faculty Assignment Master</Title>}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ background: '#0A2540', borderColor: '#0A2540' }}
        >
          Add Subject
        </Button>
      }
      bordered={false}
    >
      <Table columns={columns} dataSource={subjects} pagination={false} />

      <Modal
        title="Add Curricular Subject"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Subject Full Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Sanskrit Grammar / Social Science" />
          </Form.Item>
          <Form.Item name="code" label="Subject Code" rules={[{ required: true }]}>
            <Input placeholder="e.g. SAN-201" />
          </Form.Item>
          <Form.Item name="type" label="Subject Type" initialValue="Theory">
            <Select
              options={[
                { value: 'Theory', label: 'Theory Only' },
                { value: 'Practical', label: 'Practical Lab Only' },
                { value: 'Both', label: 'Theory + Practical Lab' },
              ]}
            />
          </Form.Item>
          <Form.Item name="isElective" label="Curriculum Nature" initialValue="false">
            <Select
              options={[
                { value: 'false', label: 'Core / Compulsory' },
                { value: 'true', label: 'Elective / Optional' },
              ]}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                Save Subject
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
