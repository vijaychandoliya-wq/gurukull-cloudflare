import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Flex, List, Row, Space, Statistic, Tag, Typography } from 'antd';
import {
  BookOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  FileDoneOutlined,
  ReadOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { apiClient } from '../services/api';

interface Dashboard {
  school: { name: string; code: string; status: string };
  counts: Record<string, number>;
  configuration: { timezone: string | null; currency: string | null; address: string | null } | null;
  setupNeeded: boolean;
}

const metrics = [
  ['students', 'Students', TeamOutlined, '#2563eb', '/students'],
  ['teachers', 'Teachers', ReadOutlined, '#7c3aed', '/teachers'],
  ['classes', 'Classes', BookOutlined, '#0891b2', '/academics'],
  ['sections', 'Sections', CalendarOutlined, '#ea580c', '/academics'],
] as const;

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    apiClient.get('/api/admin/dashboard').then((r) => {
      if (current) setData(r.data.data);
    }).catch((e) => {
      if (current) setError(e.response?.data?.message || 'Dashboard could not be loaded.');
    });
    return () => { current = false; };
  }, []);

  if (error) return <Alert type="error" showIcon message={error} />;
  if (!data) return <Card loading />;

  const setupRows = [
    ['Timezone', data.configuration?.timezone || 'Not confirmed'],
    ['Currency', data.configuration?.currency || 'Not confirmed'],
    ['Address', data.configuration?.address || 'Not supplied'],
    ['Academic years', String(data.counts.academicYears ?? 0)],
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={16} className="gk-page-heading">
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>School overview</Typography.Title>
          <Typography.Text type="secondary">A clear view of {data.school.name} and the current school setup.</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<FileDoneOutlined />} onClick={() => window.location.assign('/feature-report')}>Feature status</Button>
          <Button type="primary" icon={<TeamOutlined />} onClick={() => window.location.assign('/students')}>Manage students</Button>
        </Space>
      </Flex>

      <Alert
        type={data.setupNeeded ? 'warning' : 'success'}
        showIcon
        message={data.setupNeeded ? 'School configuration is required' : 'School overview is ready'}
        description={`School code ${data.school.code} · Status: ${data.school.status.replace(/_/g, ' ')}. Add genuine school records to unlock the operational workflows.`}
        action={data.setupNeeded ? <Button size="small" onClick={() => window.location.assign('/settings')}>Open settings</Button> : undefined}
      />

      <Row gutter={[16, 16]}>
        {metrics.map(([key, label, Icon, color, href]) => (
          <Col key={key} xs={24} sm={12} xl={6}>
            <Link to={href} className="gk-card-link-wrapper">
              <Card className="gk-metric-card" hoverable>
                <Flex justify="space-between" align="center">
                  <Statistic title={label} value={data.counts[key] ?? 0} />
                  <div className="gk-metric-icon" style={{ color, background: `${color}14` }}><Icon /></div>
                </Flex>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="School setup" extra={<Button type="link" icon={<SettingOutlined />} onClick={() => window.location.assign('/settings')}>Edit settings</Button>}>
            <List
              dataSource={setupRows}
              renderItem={([label, value]) => (
                <List.Item>
                  <Typography.Text type="secondary">{label}</Typography.Text>
                  <Typography.Text strong>{value}</Typography.Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Quick actions">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Button block icon={<TeamOutlined />} onClick={() => window.location.assign('/students')}>Add or review students</Button>
              <Button block icon={<UserOutlined />} onClick={() => window.location.assign('/teachers')}>Add or review teachers</Button>
              <Button block icon={<CheckSquareOutlined />} onClick={() => window.location.assign('/attendance')}>Record attendance</Button>
              <Button block icon={<BookOutlined />} onClick={() => window.location.assign('/academics')}>Manage classes and sections</Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="Operational status" extra={<Tag color={data.setupNeeded ? 'orange' : 'green'}>{data.setupNeeded ? 'Setup in progress' : 'Ready'}</Tag>}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Attendance, finance and analytics appear here once genuine school records are available." />
      </Card>
    </Space>
  );
};
