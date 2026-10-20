import React, { useState } from 'react';
import { Alert, Button, Card, Divider, Flex, Form, Input, Space, Tag, Typography } from 'antd';
import {
  ArrowLeftOutlined,
  BankOutlined,
  BookOutlined,
  CheckCircleFilled,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { ThemeSwitcher } from '../components/ThemeSwitcher';

const { Paragraph, Text, Title } = Typography;

interface LoginValues {
  schoolCode: string;
  identifier: string;
  password: string;
}

const benefits = [
  ['One connected campus', 'Students, families, teachers and operations in one workspace.', <TeamOutlined />],
  ['Built for everyday school work', 'Academics, attendance, communication and administration stay organised.', <BookOutlined />],
  ['Role-aware access', 'Every member enters the portal designed for their responsibilities.', <SafetyCertificateOutlined />],
] as const;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async (values: LoginValues) => {
    setSubmitting(true);
    setError(null);
    try {
      await login(values.schoolCode, values.identifier, values.password);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) setError('That school code was not recognised. Check the code and try again.');
      else if (err?.response?.data?.error === 'SCHOOL_CONFIGURATION_NEEDED') setError('This school is reserved. Its administrator and school settings must be configured before sign-in.');
      else if (['FREE_AUTH_CPU_VERIFICATION_REQUIRED', 'ADMIN_ACCESS_CPU_VERIFICATION_REQUIRED'].includes(err?.response?.data?.error)) setError('Sign-in is awaiting the secure login performance check. Please contact the platform administrator.');
      else setError(err?.response?.data?.message || 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="gk-login-page">
      <section className="gk-login-brand-panel" aria-label="Gurukul school platform">
        <div className="gk-login-orb gk-login-orb-one" />
        <div className="gk-login-orb gk-login-orb-two" />
        <Flex vertical justify="space-between" className="gk-login-brand-content">
          <Link to="/login" className="gk-login-wordmark" aria-label="Gurukul home">
            <span className="gk-login-mark">GK</span>
            <span><strong>Gurukul</strong><small>School operating system</small></span>
          </Link>
          <div className="gk-login-intro">
            <Tag bordered={false}>SCHOOL MANAGEMENT PLATFORM</Tag>
            <Title level={1}>Run the school day with clarity.</Title>
            <Paragraph>One secure place for learning, people and campus operations—from the first bell to the final report.</Paragraph>
            <Space direction="vertical" size={18} className="gk-login-benefits">
              {benefits.map(([title, detail, icon]) => (
                <Flex key={title} align="flex-start" gap={14}>
                  <span className="gk-login-benefit-icon">{icon}</span>
                  <span><Text strong>{title}</Text><small>{detail}</small></span>
                </Flex>
              ))}
            </Space>
          </div>
          <Text className="gk-login-trust"><CheckCircleFilled /> Secure access for your school community</Text>
        </Flex>
      </section>

      <section className="gk-login-form-panel">
        <div className="gk-login-appearance"><ThemeSwitcher /></div>
        <div className="gk-login-mobile-brand">
          <Link to="/login" className="gk-login-wordmark gk-login-wordmark-mobile" aria-label="Gurukul home">
            <span className="gk-login-mark">GK</span>
            <span><strong>Gurukul</strong><small>School operating system</small></span>
          </Link>
        </div>
        <Card className="gk-login-card" bordered={false}>
          <Link to="/enroll" className="gk-login-back"><ArrowLeftOutlined /> Have an administrator invitation?</Link>
          <div className="gk-login-heading">
            <Title level={2}>Welcome back</Title>
            <Text type="secondary">Sign in once to continue to your role-based Gurukul portal.</Text>
          </div>
          <Flex wrap="wrap" gap={6} className="gk-auth-role-list">
            {['School admin', 'Teacher', 'Student', 'Parent', 'Staff'].map((role) => <Tag key={role}>{role}</Tag>)}
          </Flex>
          {error && <Alert type="error" showIcon message={error} className="gk-login-alert" />}
          <Form<LoginValues> layout="vertical" onFinish={onFinish} requiredMark={false} className="gk-login-form">
            <Form.Item name="schoolCode" label="School code" rules={[{ required: true, message: 'Enter your school code' }]}>
              <Input size="large" prefix={<BankOutlined />} placeholder="e.g. 108" autoComplete="organization" autoCapitalize="characters" />
            </Form.Item>
            <Form.Item name="identifier" label="Mobile number or email address" rules={[{ required: true, message: 'Enter your mobile number or email address' }]}>
              <Input size="large" prefix={<MailOutlined />} placeholder="8056745614 or name@school.com" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="Password or administrator access key" rules={[{ required: true, message: 'Enter your password or access key' }]}>
              <Input.Password size="large" prefix={<LockOutlined />} placeholder="Enter your password or access key" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" size="large" htmlType="submit" block loading={submitting} className="gk-login-submit">Sign in securely</Button>
          </Form>
          <Divider />
          <Flex justify="center" align="center" gap={8} className="gk-login-help">
            <SafetyCertificateOutlined />
            <Text type="secondary">Use the account issued by your school administrator.</Text>
          </Flex>
        </Card>
        <Text type="secondary" className="gk-login-footer">© {new Date().getFullYear()} Gurukul. School management, thoughtfully connected.</Text>
      </section>
    </main>
  );
};
