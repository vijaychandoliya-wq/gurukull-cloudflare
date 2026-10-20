import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, InputNumber, Select, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { QuestionCircleOutlined, PlusOutlined, ClockCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface QuizItem {
  key: string;
  id: number;
  title: string;
  subject: string;
  class: string;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  totalQuestions: number;
  status: string;
}

const initialQuizzes: QuizItem[] = [
  { key: '1', id: 1, title: 'Linear Equations Mastery Quiz', subject: 'Mathematics', class: 'Grade 10 - A', durationMinutes: 30, totalMarks: 20, passMarks: 8, totalQuestions: 10, status: 'active' },
  { key: '2', id: 2, title: 'Plant Physiology & Photosynthesis', subject: 'Science (Biology)', class: 'Grade 10 - A', durationMinutes: 25, totalMarks: 15, passMarks: 6, totalQuestions: 8, status: 'active' },
  { key: '3', id: 3, title: 'English Grammar & Prepositions', subject: 'English', class: 'Grade 1 - A', durationMinutes: 20, totalMarks: 10, passMarks: 4, totalQuestions: 5, status: 'active' },
];

export const QuizzesPage: React.FC = () => {
  const [quizzes, setQuizzes] = useState<QuizItem[]>(initialQuizzes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = (values: any) => {
    const newQuiz: QuizItem = {
      key: String(quizzes.length + 1),
      id: quizzes.length + 1,
      title: values.title,
      subject: values.subject,
      class: values.class,
      durationMinutes: values.durationMinutes,
      totalMarks: values.totalMarks,
      passMarks: Math.round(values.totalMarks * 0.4),
      totalQuestions: values.totalQuestions || 10,
      status: 'active',
    };

    setQuizzes([newQuiz, ...quizzes]);
    setIsModalOpen(false);
    form.resetFields();
    message.success('Online Quiz and Question Bank created successfully!');
  };

  const columns: ColumnsType<QuizItem> = [
    { title: 'Quiz Title', dataIndex: 'title', key: 'title', render: (t) => <Text strong>{t}</Text> },
    { title: 'Subject', dataIndex: 'subject', key: 'subject', render: (s) => <Tag color="geekblue">{s}</Tag> },
    { title: 'Class Section', dataIndex: 'class', key: 'class' },
    {
      title: 'Duration',
      dataIndex: 'durationMinutes',
      key: 'durationMinutes',
      render: (d) => <Text type="secondary"><ClockCircleOutlined /> {d} mins</Text>,
    },
    { title: 'Total Marks', dataIndex: 'totalMarks', key: 'totalMarks', render: (m) => <Text strong>{m} pts</Text> },
    { title: 'Questions', dataIndex: 'totalQuestions', key: 'totalQuestions' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: () => <Tag icon={<CheckCircleOutlined />} color="success">ACTIVE</Tag>,
    },
  ];

  return (
    <Card
      title={<Title level={5} style={{ margin: 0 }}>Online Quizzes & Question Bank Engine</Title>}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ background: '#0A2540', borderColor: '#0A2540' }}
        >
          Create New Quiz
        </Button>
      }
      bordered={false}
    >
      <Table columns={columns} dataSource={quizzes} pagination={false} />

      <Modal
        title={<Title level={4} style={{ margin: 0 }}>Create Online Quiz</Title>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Quiz Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Periodic Table Speed Test" />
          </Form.Item>

          <Form.Item name="subject" label="Subject" initialValue="Science">
            <Select
              options={[
                { value: 'Mathematics', label: 'Mathematics' },
                { value: 'Science', label: 'Science' },
                { value: 'English', label: 'English' },
                { value: 'Computer Science', label: 'Computer Science' },
              ]}
            />
          </Form.Item>

          <Form.Item name="class" label="Class" initialValue="Grade 10 - A">
            <Select
              options={[
                { value: 'Grade 1 - A', label: 'Grade 1 - A' },
                { value: 'Grade 2 - A', label: 'Grade 2 - A' },
                { value: 'Grade 10 - A', label: 'Grade 10 - A' },
              ]}
            />
          </Form.Item>

          <Space style={{ display: 'flex', width: '100%' }} size="middle">
            <Form.Item name="durationMinutes" label="Duration (Mins)" initialValue={30} style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={5} max={180} />
            </Form.Item>
            <Form.Item name="totalMarks" label="Total Marks" initialValue={20} style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={1} max={100} />
            </Form.Item>
          </Space>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                Publish Quiz
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
