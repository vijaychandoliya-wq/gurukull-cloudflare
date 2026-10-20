import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, Typography, Drawer, Descriptions, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, FileTextOutlined, CalendarOutlined, EyeOutlined, CheckCircleOutlined, UploadOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface HomeworkItem {
  key: string;
  id: number;
  title: string;
  subject: string;
  class: string;
  assignedBy: string;
  assignedDate: string;
  dueDate: string;
  submissionCount: number;
  totalStudents: number;
  instructions: string;
}

const initialHomework: HomeworkItem[] = [
  { key: '1', id: 1, title: 'Linear Equations Exercise 3.2 & Word Problems', subject: 'Mathematics', class: 'Grade 10 - Section A', assignedBy: 'Sunita Verma', assignedDate: '2026-08-12', dueDate: '2026-08-16', submissionCount: 38, totalStudents: 43, instructions: 'Complete questions 1 through 15 in homework notebook with graph attachments.' },
  { key: '2', id: 2, title: 'Plant Cell Diagram & Organelles Chart', subject: 'Science', class: 'Grade 10 - Section A', assignedBy: 'Ramesh Gupta', assignedDate: '2026-08-13', dueDate: '2026-08-17', submissionCount: 40, totalStudents: 43, instructions: 'Draw a neatly labeled diagram of plant cell and explain chloroplast function.' },
  { key: '3', id: 3, title: 'Creative Essay: A Day in Monsoon Season', subject: 'English', class: 'Grade 1 - Section A', assignedBy: 'Priya Mehta', assignedDate: '2026-08-14', dueDate: '2026-08-18', submissionCount: 32, totalStudents: 38, instructions: 'Write 5 simple sentences describing what you like to do on a rainy day.' },
];

export const HomeworkPage: React.FC = () => {
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>(initialHomework);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState<HomeworkItem | null>(null);
  const [form] = Form.useForm();

  const handleCreate = (values: any) => {
    const newHW: HomeworkItem = {
      key: String(homeworks.length + 1),
      id: homeworks.length + 1,
      title: values.title,
      subject: values.subject,
      class: values.class,
      assignedBy: 'Sunita Verma',
      assignedDate: new Date().toISOString().split('T')[0],
      dueDate: values.dueDate || '2026-08-20',
      submissionCount: 0,
      totalStudents: 40,
      instructions: values.instructions,
    };
    setHomeworks([newHW, ...homeworks]);
    setIsModalOpen(false);
    form.resetFields();
    message.success('Homework published and notifications sent to Dronacharya & Eklavya mobile apps!');
  };

  const columns: ColumnsType<HomeworkItem> = [
    { title: 'Homework Title', dataIndex: 'title', key: 'title', render: (t) => <Text strong>{t}</Text> },
    { title: 'Subject', dataIndex: 'subject', key: 'subject', render: (s) => <Tag color="blue">{s}</Tag> },
    { title: 'Standard Section', dataIndex: 'class', key: 'class' },
    { title: 'Assigned Faculty', dataIndex: 'assignedBy', key: 'assignedBy' },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (d) => <Text type="danger"><CalendarOutlined /> {d}</Text>,
    },
    {
      title: 'Submissions',
      key: 'submissions',
      render: (_, r) => (
        <Space>
          <Text strong>{r.submissionCount}</Text> / {r.totalStudents}
          <Tag color={r.submissionCount >= r.totalStudents ? 'green' : 'gold'}>
            {Math.round((r.submissionCount / r.totalStudents) * 100)}% Submitted
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedHomework(r)}>
          View Submissions
        </Button>
      ),
    },
  ];

  return (
    <Card
      title={<Title level={5} style={{ margin: 0 }}>Homework & Digital Assignment Hub</Title>}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ background: '#0A2540', borderColor: '#0A2540' }}
        >
          Assign Homework
        </Button>
      }
      bordered={false}
    >
      <Table columns={columns} dataSource={homeworks} pagination={false} />

      <Modal
        title="Assign Daily Homework / Project"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Homework Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Chapter 4 Trigonometry Problem Set" />
          </Form.Item>
          <Space style={{ display: 'flex', width: '100%' }} size="middle">
            <Form.Item name="subject" label="Subject" initialValue="Mathematics" style={{ flex: 1 }}>
              <Select
                options={[
                  { value: 'Mathematics', label: 'Mathematics' },
                  { value: 'Science', label: 'Science' },
                  { value: 'English', label: 'English' },
                  { value: 'Social Studies', label: 'Social Studies' },
                ]}
              />
            </Form.Item>
            <Form.Item name="class" label="Class Section" initialValue="Grade 10 - Section A" style={{ flex: 1 }}>
              <Select
                options={[
                  { value: 'Grade 1 - Section A', label: 'Grade 1 - Section A' },
                  { value: 'Grade 1 - Section B', label: 'Grade 1 - Section B' },
                  { value: 'Grade 2 - Section A', label: 'Grade 2 - Section A' },
                  { value: 'Grade 10 - Section A', label: 'Grade 10 - Section A' },
                ]}
              />
            </Form.Item>
          </Space>
          <Form.Item name="dueDate" label="Submission Due Date" initialValue="2026-08-20">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="instructions" label="Homework Details & Guidelines" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="Type exercise questions, page numbers, and instructions..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                Publish Assignment
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Submission Review Drawer */}
      <Drawer
        title="Student Homework Submissions Inbox"
        placement="right"
        width={550}
        open={!!selectedHomework}
        onClose={() => setSelectedHomework(null)}
      >
        {selectedHomework && (
          <div>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Assignment">{selectedHomework.title}</Descriptions.Item>
              <Descriptions.Item label="Subject">{selectedHomework.subject}</Descriptions.Item>
              <Descriptions.Item label="Class">{selectedHomework.class}</Descriptions.Item>
              <Descriptions.Item label="Due Date">{selectedHomework.dueDate}</Descriptions.Item>
              <Descriptions.Item label="Instructions">{selectedHomework.instructions}</Descriptions.Item>
            </Descriptions>

            <Title level={5}>Received Submissions (Digital PDF / Images)</Title>
            <Card size="small" style={{ marginBottom: 8, background: '#F8FAFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>Aarav Malhotra (Roll 01)</Text>
                <Tag color="green">Graded: A+ (10/10)</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>Submitted: 2026-08-13 06:30 PM • 2 Attachments</Text>
            </Card>
            <Card size="small" style={{ marginBottom: 8, background: '#F8FAFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>Ananya Sharma (Roll 02)</Text>
                <Tag color="green">Graded: A (9/10)</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>Submitted: 2026-08-14 07:15 PM • 1 Attachment</Text>
            </Card>
            <Card size="small" style={{ marginBottom: 8, background: '#FEF2F2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>Kabir Patel (Roll 03)</Text>
                <Tag color="red">Pending Submission</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>Reminder push notification sent</Text>
            </Card>
          </div>
        )}
      </Drawer>
    </Card>
  );
};
