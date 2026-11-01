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
import {LanguageSwitcher} from '../components/LanguageSwitcher';
import {useLanguage} from '../i18n/LanguageProvider';

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
  const {t}=useLanguage();
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
      else if (['FREE_AUTH_CPU_VERIFICATION_REQUIRED', 'ADMIN_ACCESS_CPU_VERIFICATION_REQUIRED'].includes(err?.response?.data?.error)) setError('This account still uses an older password that is not enabled on the current login service. Ask your school administrator to open Roles and account access, choose Generate password, and sign in with the new password.');
      else if(status===401||status===403)setError('We couldn’t sign you in. Check your school code and login details, or contact your school administrator.');
      else if(!err?.response)setError('The sign-in service could not be reached. Check your connection and try again.');
      else setError('Sign-in is temporarily unavailable. Please try again or contact your school administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="gk-login-page">
      <section className="gk-login-brand-panel" aria-label="Gurukul school platform" lang="en" dir="ltr">
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
        <div className="gk-login-appearance"><Space size={8}><LanguageSwitcher/><ThemeSwitcher /></Space></div>
        <div className="gk-login-mobile-brand">
          <Link to="/login" className="gk-login-wordmark gk-login-wordmark-mobile" aria-label="Gurukul home" lang="en" dir="ltr">
            <span className="gk-login-mark">GK</span>
            <span><strong>Gurukul</strong><small>School operating system</small></span>
          </Link>
        </div>
        <Card className="gk-login-card" bordered={false}>
          <Link to="/enroll" className="gk-login-back" lang="en" dir="ltr"><ArrowLeftOutlined /> Have an administrator invitation?</Link>
          <div className="gk-login-heading">
            <Title level={2}>{t('welcomeBack')}</Title>
            <Text type="secondary">{t('signInSubtitle')}</Text>
          </div>
          {error && <Alert type="error" showIcon message={error} className="gk-login-alert" />}
          {new URLSearchParams(window.location.search).get('passwordChanged')==='1'&&<Alert type="success" showIcon message="Password changed. Sign in with your new password."/>}<Form<LoginValues> layout="vertical" onFinish={onFinish} requiredMark={false} className="gk-login-form">
            <Form.Item name="schoolCode" label={t('schoolCode')} rules={[{ required: true, message: 'Enter your school code' }]}>
              <Input size="large" dir="ltr" prefix={<BankOutlined />} placeholder="e.g. 108" autoComplete="organization" autoCapitalize="characters" />
            </Form.Item>
            <Form.Item name="identifier" label={t('identifier')} rules={[{ required: true, message: 'Enter your mobile number or email address' }]}>
              <Input size="large" dir="ltr" prefix={<MailOutlined />} placeholder="8056745614 or name@school.com" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label={t('password')} rules={[{ required: true, message: 'Enter your password or access key' }]}>
              <Input.Password size="large" dir="auto" prefix={<LockOutlined />} placeholder="Enter your password or access key" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" size="large" htmlType="submit" block loading={submitting} className="gk-login-submit">{t('signIn')}</Button>
          </Form>
          <Divider />
          <Flex justify="center" align="center" gap={8} className="gk-login-help" lang="en" dir="ltr">
            <SafetyCertificateOutlined />
            <Text type="secondary">Use the account issued by your school administrator.</Text>
          </Flex>
        </Card>
        <Text type="secondary" className="gk-login-footer" lang="en" dir="ltr">© {new Date().getFullYear()} Gurukul. School management, thoughtfully connected.</Text>
      </section>
    </main>
  );
};
