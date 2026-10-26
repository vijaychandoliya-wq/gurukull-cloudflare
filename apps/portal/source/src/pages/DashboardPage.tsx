import React, { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  List,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
  Flex,
} from 'antd';
import {
  ArrowRightOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  FileDoneOutlined,
  ReadOutlined,
  SettingOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { apiClient } from '../services/api';

interface Dashboard {
  school: { name: string; code: string; status: string };
  counts: Record<string, number>;
  configuration: { timezone: string | null; currency: string | null; address: string | null } | null;
  currentYear: { id: string; name: string; startsOn: string; endsOn: string } | null;
  setupNeeded: boolean;
  attendance: { total: number; present: number; absent: number; late: number; sessions: number; lastDate: string | null; rate: number | null };
  finance: { invoices: number; billedMinor: number; paidMinor: number; concessionMinor: number; outstandingMinor: number; overdueInvoices: number; collectionRate: number | null };
  analytics: { homework: { total: number; published: number; lastUpdated: number | null }; exams: { total: number; published: number }; leaveRequests: { total: number; pending: number } };
}

const metrics = [
  ['students', 'Students', TeamOutlined, '#2563eb', '/students'],
  ['teachers', 'Teachers', ReadOutlined, '#7c3aed', '/teachers'],
  ['classes', 'Classes', BookOutlined, '#0891b2', '/academics'],
  ['sections', 'Sections', CalendarOutlined, '#ea580c', '/academics'],
] as const;

function currencyAmount(value: number, currency: string | null | undefined) {
  if (!currency) return `${value} minor units`;
  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(value / 10 ** digits);
}

function MetricCard({ label, value, color, icon: Icon, href }: { label: string; value: number; color: string; icon: React.ElementType; href: string }) {
  return (
    <Link to={href} className="gk-card-link-wrapper">
      <Card className="gk-dashboard-metric" hoverable>
        <Flex justify="space-between" align="center">
          <Statistic title={label} value={value} />
          <span className="gk-dashboard-metric-icon" style={{ color, background: `${color}14` }}><Icon /></span>
        </Flex>
        <Typography.Text type="secondary" className="gk-dashboard-metric-link">View details <ArrowRightOutlined /></Typography.Text>
      </Card>
    </Link>
  );
}

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
    ['Academic year', data.currentYear ? `${data.currentYear.name} · ${data.currentYear.startsOn} to ${data.currentYear.endsOn}` : 'Not configured'],
  ];
  const attendanceRate = data.attendance.rate ?? 0;
  const collectionRate = data.finance.collectionRate ?? 0;

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={16} className="gk-page-heading gk-dashboard-heading">
        <div>
          <Typography.Text className="gk-dashboard-eyebrow">SCHOOL OPERATIONS</Typography.Text>
          <Typography.Title level={2} style={{ margin: '4px 0 4px' }}>School overview</Typography.Title>
          <Typography.Text type="secondary">Current school-year records for {data.school.name}.</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<FileDoneOutlined />} onClick={() => window.location.assign('/feature-report')}>Feature status</Button>
          <Button type="primary" icon={<TeamOutlined />} onClick={() => window.location.assign('/students')}>Manage students</Button>
        </Space>
      </Flex>

      <Alert
        type={data.setupNeeded ? 'warning' : 'success'}
        showIcon
        message={data.setupNeeded ? 'Complete the school setup' : 'School setup is ready'}
        description={`School code ${data.school.code} · ${data.currentYear?.name||'No current academic year'}. Attendance reflects recorded sessions; finance reflects saved invoices and collections.`}
        action={data.setupNeeded ? <Button size="small" onClick={() => window.location.assign('/settings')}>Open settings</Button> : undefined}
      />

      <Row gutter={[16, 16]}>
        {metrics.map(([key, label, Icon, color, href]) => <Col key={key} xs={24} sm={12} xl={6}><MetricCard label={label} value={data.counts[key] ?? 0} color={color} icon={Icon} href={href} /></Col>)}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card className="gk-dashboard-insight-card" title={<Space><CheckSquareOutlined /> Attendance</Space>} extra={<Link to="/attendance">Open</Link>}>
            <Statistic title="Recorded attendance" value={data.attendance.rate===null?'No records':attendanceRate} suffix={data.attendance.rate===null?undefined:'%'} valueStyle={{ color: attendanceRate >= 75 ? '#16a34a' : '#d97706' }} />
            <Progress percent={attendanceRate} showInfo={false} strokeColor={attendanceRate >= 75 ? '#16a34a' : '#d97706'} trailColor="var(--gk-surface-inset)" />
            <Flex justify="space-between" className="gk-dashboard-supporting-row"><Typography.Text type="secondary">Present {data.attendance.present}</Typography.Text><Typography.Text type="secondary">Absent {data.attendance.absent}</Typography.Text><Typography.Text type="secondary">Late {data.attendance.late}</Typography.Text></Flex>
            <Divider />
            <Typography.Text type="secondary">{data.attendance.sessions} recorded school sessions{data.attendance.lastDate ? ` · last updated ${data.attendance.lastDate}` : ''}</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="gk-dashboard-insight-card" title={<Space><WalletOutlined /> Finance</Space>} extra={<Link to="/fees">Open</Link>}>
            <Statistic title="Collection rate" value={data.finance.collectionRate===null?'No invoices':collectionRate} suffix={data.finance.collectionRate===null?undefined:'%'} valueStyle={{ color: collectionRate >= 75 ? '#16a34a' : '#2563eb' }} />
            <Progress percent={collectionRate} showInfo={false} strokeColor="#2563eb" trailColor="var(--gk-surface-inset)" />
            <List size="small" split={false} dataSource={[
              ['Billed', currencyAmount(data.finance.billedMinor, data.configuration?.currency)],
              ['Collected', currencyAmount(data.finance.paidMinor, data.configuration?.currency)],
              ['Outstanding', currencyAmount(data.finance.outstandingMinor, data.configuration?.currency)],
            ]} renderItem={([label, value]) => <List.Item><Typography.Text type="secondary">{label}</Typography.Text><Typography.Text strong>{value}</Typography.Text></List.Item>} />
            <Tag color={data.finance.overdueInvoices ? 'orange' : 'green'}>{data.finance.overdueInvoices} overdue invoice{data.finance.overdueInvoices === 1 ? '' : 's'}</Tag>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="gk-dashboard-insight-card" title={<Space><BookOutlined /> Learning & people</Space>} extra={<Link to="/homework">Open</Link>}>
            <List size="small" split={false} dataSource={[
              ['Published homework', `${data.analytics.homework.published} / ${data.analytics.homework.total}`],
              ['Published exams', `${data.analytics.exams.published} / ${data.analytics.exams.total}`],
              ['Pending leave requests', String(data.analytics.leaveRequests.pending)],
            ]} renderItem={([label, value]) => <List.Item><Typography.Text type="secondary">{label}</Typography.Text><Typography.Text strong>{value}</Typography.Text></List.Item>} />
            <Divider />
            <Badge status={data.analytics.leaveRequests.pending ? 'warning' : 'success'} text={data.analytics.leaveRequests.pending ? 'Review requests requiring attention' : 'No pending leave requests'} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="School setup" extra={<Button type="link" icon={<SettingOutlined />} onClick={() => window.location.assign('/settings')}>Edit settings</Button>}>
            <List className="gk-dashboard-list" dataSource={setupRows} renderItem={([label, value]) => <List.Item><Typography.Text type="secondary">{label}</Typography.Text><Typography.Text strong>{value}</Typography.Text></List.Item>} />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Quick actions">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Button block icon={<TeamOutlined />} onClick={() => window.location.assign('/students')}>Add or review students</Button>
              <Button block icon={<ReadOutlined />} onClick={() => window.location.assign('/teachers')}>Add or review teachers</Button>
              <Button block icon={<CheckSquareOutlined />} onClick={() => window.location.assign('/attendance')}>Record attendance</Button>
              <Button block icon={<BookOutlined />} onClick={() => window.location.assign('/academics')}>Manage classes and sections</Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
};
