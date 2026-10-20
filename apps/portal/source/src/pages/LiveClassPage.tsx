import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { VideoCameraOutlined, PlusOutlined, LinkOutlined, ClockCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface LiveClassItem {
  key: string;
  id: number;
  title: string;
  subject: string;
  teacher: string;
  class: string;
  platform: string;
  meetingUrl: string;
  startTime: string;
  status: string;
}

const initialClasses: LiveClassItem[] = [
  { key: '1', id: 1, title: 'Calculus & Derivatives Interactive Lecture', subject: 'Mathematics', teacher: 'Sunita Verma', class: 'Grade 10 - A', platform: 'google_meet', meetingUrl: 'https://meet.google.com/abc-defg-hij', startTime: 'Today, 02:00 PM', status: 'scheduled' },
  { key: '2', id: 2, title: 'Organic Chemistry Lab Simulation', subject: 'Science (Chemistry)', teacher: 'Ramesh Gupta', class: 'Grade 10 - A', platform: 'zoom', meetingUrl: 'https://zoom.us/j/987654321', startTime: 'Tomorrow, 10:00 AM', status: 'scheduled' },
];

export const LiveClassPage: React.FC = () => {
  const [classes, setClasses] = useState<LiveClassItem[]>(initialClasses);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleSchedule = (values: any) => {
    const newClass: LiveClassItem = {
      key: String(classes.length + 1),
      id: classes.length + 1,
      title: values.title,
      subject: values.subject,
      teacher: 'Sunita Verma',
      class: values.class,
      platform: values.platform,
      meetingUrl: values.meetingUrl,
      startTime: values.startTime || 'Today, 03:00 PM',
      status: 'scheduled',
    };
    setClasses([newClass, ...classes]);
    setIsModalOpen(false);
    form.resetFields();
    message.success('Live classroom scheduled and link dispatched to Eklavya parent app!');
  };

  const columns: ColumnsType<LiveClassItem> = [
    { title: 'Lecture Title', dataIndex: 'title', key: 'title', render: (t) => <Text strong>{t}</Text> },
    { title: 'Subject', dataIndex: 'subject', key: 'subject', render: (s) => <Tag color="blue">{s}</Tag> },
    { title: 'Faculty', dataIndex: 'teacher', key: 'teacher' },
    { title: 'Class Section', dataIndex: 'class', key: 'class' },
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      render: (p) => <Tag color={p === 'zoom' ? 'geekblue' : 'green'}>{p === 'zoom' ? 'Zoom Meeting' : 'Google Meet'}</Tag>,
    },
    {
      title: 'Schedule Time',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (t) => <Text type="secondary"><ClockCircleOutlined /> {t}</Text>,
    },
    {
      title: 'Join Classroom',
      key: 'join',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<LinkOutlined />}
          size="small"
          onClick={() => window.open(record.meetingUrl, '_blank')}
          style={{ background: '#0A2540', borderColor: '#0A2540' }}
        >
          Launch Meeting
        </Button>
      ),
    },
  ];

  return (
    <Card
      title={<Title level={5} style={{ margin: 0 }}>Live Streaming & Video Classrooms</Title>}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ background: '#0A2540', borderColor: '#0A2540' }}
        >
          Schedule Live Class
        </Button>
      }
      bordered={false}
    >
      <Table columns={columns} dataSource={classes} pagination={false} />

      <Modal
        title={<Title level={4} style={{ margin: 0 }}>Schedule Live Video Class</Title>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSchedule} style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Lecture Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Thermodynamics Problem Solving" />
          </Form.Item>
          <Form.Item name="subject" label="Subject" initialValue="Mathematics">
            <Select
              options={[
                { value: 'Mathematics', label: 'Mathematics' },
                { value: 'Science (Physics)', label: 'Science (Physics)' },
                { value: 'English Literature', label: 'English Literature' },
              ]}
            />
          </Form.Item>
          <Form.Item name="class" label="Class Section" initialValue="Grade 10 - A">
            <Select
              options={[
                { value: 'Grade 1 - A', label: 'Grade 1 - A' },
                { value: 'Grade 2 - A', label: 'Grade 2 - A' },
                { value: 'Grade 10 - A', label: 'Grade 10 - A' },
              ]}
            />
          </Form.Item>
          <Form.Item name="platform" label="Streaming Platform" initialValue="google_meet">
            <Select
              options={[
                { value: 'google_meet', label: 'Google Meet' },
                { value: 'zoom', label: 'Zoom Video Communications' },
                { value: 'jitsi', label: 'Jitsi Meet (Self-Hosted)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="meetingUrl" label="Meeting Invite Link" rules={[{ required: true }]}>
            <Input placeholder="https://meet.google.com/xyz-123-abc" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                Schedule & Notify Students
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
