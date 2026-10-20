import React, { useState } from 'react';
import { Card, Row, Col, Avatar, Button, Tag, Space, Modal, Form, Input, Select, Typography, message } from 'antd';
import { UserOutlined, PlusOutlined, BankOutlined, EnvironmentOutlined, MailOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface AlumniItem {
  id: number;
  name: string;
  graduationYear: number;
  profession: string;
  company: string;
  city: string;
  email: string;
}

const initialAlumni: AlumniItem[] = [
  { id: 1, name: 'Vikramaditya Singhania', graduationYear: 2018, profession: 'Software Engineer', company: 'Google India', city: 'Bengaluru', email: 'vikram.s@alumni.edu' },
  { id: 2, name: 'Dr. Radhika Menon', graduationYear: 2015, profession: 'Cardiologist', company: 'AIIMS New Delhi', city: 'New Delhi', email: 'radhika.m@alumni.edu' },
  { id: 3, name: 'Kunal Kapoor', graduationYear: 2020, profession: 'Product Designer', company: 'Swiggy', city: 'Bengaluru', email: 'kunal.k@alumni.edu' },
  { id: 4, name: 'Megha Sen', graduationYear: 2019, profession: 'Civil Services (IAS Officer)', company: 'Government of India', city: 'Jaipur', email: 'megha.s@alumni.edu' },
];

export const AlumniPage: React.FC = () => {
  const [alumni, setAlumni] = useState<AlumniItem[]>(initialAlumni);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleRegister = (values: any) => {
    const newMember: AlumniItem = {
      id: alumni.length + 1,
      name: values.name,
      graduationYear: Number(values.graduationYear),
      profession: values.profession,
      company: values.company,
      city: values.city,
      email: values.email,
    };
    setAlumni([newMember, ...alumni]);
    setIsModalOpen(false);
    form.resetFields();
    message.success('Alumni member registered successfully!');
  };

  return (
    <Card
      title={<Title level={5} style={{ margin: 0 }}>Alumni Network & Career Directory</Title>}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ background: '#0A2540', borderColor: '#0A2540' }}
        >
          Register Alumni
        </Button>
      }
      bordered={false}
    >
      <Row gutter={[16, 16]}>
        {alumni.map((item) => (
          <Col xs={24} sm={12} lg={6} key={item.id}>
            <Card hoverable style={{ borderRadius: 14, textAlign: 'center' }}>
              <Avatar size={64} style={{ backgroundColor: '#0A2540', fontSize: 24, fontWeight: 'bold', marginBottom: 12 }}>
                {item.name.charAt(0)}
              </Avatar>
              <Title level={5} style={{ margin: 0, color: '#0A2540' }}>{item.name}</Title>
              <Tag color="gold" style={{ marginTop: 4, fontWeight: 700 }}>Batch of {item.graduationYear}</Tag>

              <div style={{ marginTop: 12, textAlign: 'left', fontSize: 12, color: '#475569' }}>
                <Paragraph style={{ margin: '4px 0' }}><BankOutlined /> {item.profession} at <strong>{item.company}</strong></Paragraph>
                <Paragraph style={{ margin: '4px 0' }}><EnvironmentOutlined /> {item.city}</Paragraph>
                <Paragraph style={{ margin: '4px 0' }} type="secondary"><MailOutlined /> {item.email}</Paragraph>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title={<Title level={4} style={{ margin: 0 }}>Register Alumni Member</Title>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleRegister} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Siddharth Mathur" />
          </Form.Item>
          <Form.Item name="graduationYear" label="Graduation Passout Year" initialValue={2022} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 2024, label: 'Class of 2024' },
                { value: 2023, label: 'Class of 2023' },
                { value: 2022, label: 'Class of 2022' },
                { value: 2020, label: 'Class of 2020' },
                { value: 2018, label: 'Class of 2018' },
                { value: 2015, label: 'Class of 2015' },
              ]}
            />
          </Form.Item>
          <Form.Item name="profession" label="Current Profession / Role" rules={[{ required: true }]}>
            <Input placeholder="e.g. Senior Data Scientist" />
          </Form.Item>
          <Form.Item name="company" label="Organization / Company" rules={[{ required: true }]}>
            <Input placeholder="e.g. Microsoft / Tata Medical" />
          </Form.Item>
          <Space style={{ display: 'flex', width: '100%' }} size="middle">
            <Form.Item name="city" label="City" initialValue="New Delhi" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email Address" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                Join Alumni Directory
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
