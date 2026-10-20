import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  App as AntApp,
  Avatar,
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  Row,
  Space,
  Spin,
  Typography,
  Upload,
} from 'antd';
import { BankOutlined, UploadOutlined } from '@ant-design/icons';
import { apiClient, API } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Text, Title } = Typography;

/** School identity: name, logo, board details and contact information. */
export const SettingsPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const { refreshSchool } = useAuth();
  const [form] = Form.useForm();

  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(API.schoolApi);
      setSchool(res.data.data);
      form.setFieldsValue(res.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'School settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const values = await form.validateFields();
      const res = await apiClient.put(API.schoolApi, values);
      message.success(res.data.message || 'Saved.');
      await load();
      await refreshSchool();
    } catch (e: any) {
      if (!e?.response) return;
      setError(e.response.data?.message || 'The settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await apiClient.post(API.schoolLogoApi, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(res.data.message || 'Logo updated.');
      await load();
      // Update the cached identity so the sidebar shows it immediately.
      await refreshSchool();
    } catch (e: any) {
      setError(e.response?.data?.message || 'The logo could not be uploaded.');
    } finally {
      setUploading(false);
    }
    return false;
  };

  if (loading) return <Card><Spin /></Card>;

  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={3} style={{ margin: 0 }}>School settings</Title>
        <Text type="secondary">Identity, logo and contact details</Text>
      </div>

      {error && <Alert type="error" showIcon message={error} />}

      <Card>
        <Flex align="center" gap={20} wrap="wrap">
          <Avatar shape="square" size={88} src={school?.logo || undefined} icon={<BankOutlined />} />
          <div>
            <Title level={4} style={{ margin: 0 }}>{school?.name}</Title>
            <Text type="secondary">Code {school?.code}</Text>
            <div style={{ marginTop: 10 }}>
              <Upload
                accept=".jpg,.jpeg,.png,.webp,.svg"
                maxCount={1}
                showUploadList={false}
                beforeUpload={uploadLogo}
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  {school?.logo ? 'Replace logo' : 'Upload logo'}
                </Button>
              </Upload>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 10 }}>
                JPEG, PNG, WebP or SVG, up to 2 MB. Appears on ID cards and marksheets.
              </Text>
            </div>
          </div>
        </Flex>
      </Card>

      <Card title="School details">
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="School name" rules={[{ required: true }]}>
                <Input maxLength={200} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="moto" label="Motto">
                <Input maxLength={255} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="board" label="Board">
                <Input maxLength={100} placeholder="e.g. CBSE" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="affiliationNo" label="Affiliation number">
                <Input maxLength={100} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="dateOfEstablishment" label="Established">
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item name="address" label="Address">
                <Input.TextArea rows={2} maxLength={500} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="pincode" label="Pincode">
                <Input maxLength={20} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="landlineNo" label="Landline">
                <Input maxLength={50} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="website" label="Website">
                <Input maxLength={255} placeholder="https://" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="customDomain"
                label="Custom domain"
                extra="Used to resolve this school by hostname."
              >
                <Input maxLength={255} placeholder="erp.yourschool.edu" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="aboutUs" label="About the school">
            <Input.TextArea rows={4} maxLength={4000} />
          </Form.Item>
          <Space>
            <Button type="primary" loading={saving} onClick={save}>Save settings</Button>
            <Button onClick={load}>Reset</Button>
          </Space>
        </Form>
      </Card>
    </Flex>
  );
};
