import React, { useState } from 'react';
import { Card, List, Button, Modal, Form, Input, Select, Tag, Space, Typography, message } from 'antd';
import { PlusOutlined, NotificationOutlined, CalendarOutlined, SendOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface NoticeItem {
  id: number;
  title: string;
  notice: string;
  date: string;
  audience: string;
  postedBy: string;
}

const initialNotices: NoticeItem[] = [
  {
    id: 1,
    title: 'Independence Day Celebrations & Flag Hoisting Ceremony',
    notice:
      'All students, parents, and staff members are cordially invited to celebrate the 80th Independence Day on August 15, 2026. Reporting time: 07:45 AM in clean school uniform.',
    date: '2026-08-10',
    audience: 'Entire School Community',
    postedBy: 'Principal Office',
  },
  {
    id: 2,
    title: 'First Term Summative Assessment Schedule & Syllabus Outline',
    notice:
      'Term 1 Summative exams commence on September 15, 2026. Detailed date sheets and revision guidelines have been published on the Eklavya and Dronacharya mobile apps.',
    date: '2026-08-08',
    audience: 'Students & Parents',
    postedBy: 'Examination Controller',
  },
  {
    id: 3,
    title: 'Staff Meeting on CBSE NEP 2020 Holistic Progress Cards',
    notice:
      'All teaching faculty are requested to assemble in Conference Room A for a training seminar on continuous 360-degree assessment frameworks on Friday at 02:30 PM.',
    date: '2026-08-05',
    audience: 'Teaching Staff Only',
    postedBy: 'Academic Coordinator',
  },
];

export const NoticesPage: React.FC = () => {
  const [notices, setNotices] = useState<NoticeItem[]>(initialNotices);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = (values: any) => {
    const newNotice: NoticeItem = {
      id: notices.length + 1,
      title: values.title,
      notice: values.notice,
      audience: values.audience,
      date: new Date().toISOString().split('T')[0],
      postedBy: 'Principal Office',
    };

    setNotices([newNotice, ...notices]);
    setIsModalOpen(false);
    form.resetFields();
    message.success('Notice published and broadcasted to mobile apps!');
  };

  return (
    <Card
      title={<Title level={5} style={{ margin: 0 }}>Official School Circulars & Notice Board</Title>}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ background: '#0A2540', borderColor: '#0A2540' }}
        >
          Publish Notice
        </Button>
      }
      bordered={false}
    >
      <List
        itemLayout="vertical"
        dataSource={notices}
        renderItem={(item) => (
          <List.Item
            key={item.id}
            extra={
              <Space direction="vertical" align="end">
                <Tag color="blue">{item.audience}</Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>By: {item.postedBy}</Text>
              </Space>
            }
          >
            <List.Item.Meta
              title={
                <Space>
                  <NotificationOutlined style={{ color: '#F59E0B' }} />
                  <Text strong style={{ fontSize: 15 }}>{item.title}</Text>
                </Space>
              }
              description={
                <Text type="secondary" style={{ fontSize: 11 }}>
                  <CalendarOutlined /> Published on: {item.date}
                </Text>
              }
            />
            <Paragraph style={{ marginTop: 8, color: '#334155', lineHeight: 1.6 }}>{item.notice}</Paragraph>
          </List.Item>
        )}
      />

      <Modal
        title={<Title level={4} style={{ margin: 0 }}>Publish New School Notice</Title>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Notice Headline" rules={[{ required: true }]}>
            <Input placeholder="e.g. Annual Sports Meet 2026" />
          </Form.Item>

          <Form.Item name="audience" label="Target Audience" initialValue="Entire School Community">
            <Select
              options={[
                { value: 'Entire School Community', label: 'Entire School Community (All)' },
                { value: 'Students & Parents', label: 'Students & Parents Only' },
                { value: 'Teaching Staff Only', label: 'Teaching Staff Only' },
                { value: 'Primary School (Grades 1-5)', label: 'Primary School (Grades 1-5)' },
                { value: 'High School (Grades 9-10)', label: 'High School (Grades 9-10)' },
              ]}
            />
          </Form.Item>

          <Form.Item name="notice" label="Notice Announcement Content" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="Type announcement details..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" icon={<SendOutlined />} style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                Broadcast Notice
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
