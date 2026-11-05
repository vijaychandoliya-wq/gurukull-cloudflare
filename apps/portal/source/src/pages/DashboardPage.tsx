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
import {useDashboardText} from '../i18n/dashboard';
import {useLanguage} from '../i18n/LanguageProvider';

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

function currencyAmount(value: number, currency: string, locale: string) {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(value / 10 ** digits);
}

function MetricCard({ label, value, color, icon: Icon, href }: { label: string; value: number; color: string; icon: React.ElementType; href: string }) {
  const text=useDashboardText();
  return (
    <Link to={href} className="gk-card-link-wrapper">
      <Card className="gk-dashboard-metric" hoverable>
        <Flex justify="space-between" align="center">
          <Statistic title={label} value={value} />
          <span className="gk-dashboard-metric-icon" style={{ color, background: `${color}14` }}><Icon /></span>
        </Flex>
        <Typography.Text type="secondary" className="gk-dashboard-metric-link">{text('View details')} <ArrowRightOutlined /></Typography.Text>
      </Card>
    </Link>
  );
}

export const DashboardPage: React.FC = () => {
  const text=useDashboardText();
  const {locale}=useLanguage();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    apiClient.get('/api/admin/dashboard').then((r) => {
      if (current) setData(r.data.data);
    }).catch((e) => {
      if (current) setError(e.response?.data?.message || '');
    });
    return () => { current = false; };
  }, []);

  if (error!==null) return <Alert type="error" showIcon message={error || text('Dashboard could not be loaded.')} />;
  if (!data) return <Card loading />;

  const amount=(value:number)=>data.configuration?.currency?currencyAmount(value,data.configuration.currency,locale):text('{amount} minor units',{amount:value});
  const setupRows = [
    [text('Timezone'), data.configuration?.timezone || text('Not confirmed')],
    [text('Currency'), data.configuration?.currency || text('Not confirmed')],
    [text('Address'), data.configuration?.address || text('Not supplied')],
    [text('Academic year'), data.currentYear ? `${data.currentYear.name} · ${text('{start} to {end}',{start:data.currentYear.startsOn,end:data.currentYear.endsOn})}` : text('Not configured')],
  ];
  const attendanceRate = data.attendance.rate ?? 0;
  const collectionRate = data.finance.collectionRate ?? 0;

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={16} className="gk-page-heading gk-dashboard-heading">
        <div>
          <Typography.Text className="gk-dashboard-eyebrow">{text('SCHOOL OPERATIONS')}</Typography.Text>
          <Typography.Title level={2} style={{ margin: '4px 0 4px' }}>{text('School overview')}</Typography.Title>
          <Typography.Text type="secondary">{text('Current school-year records for {school}.',{school:data.school.name})}</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<FileDoneOutlined />} href="/feature-report">{text('Feature status')}</Button>
          <Button type="primary" icon={<TeamOutlined />} href="/students">{text('Manage students')}</Button>
        </Space>
      </Flex>

      <Alert
        type={data.setupNeeded ? 'warning' : 'success'}
        showIcon
        message={data.setupNeeded ? text('Complete the school setup') : text('School setup is ready')}
        description={text('School code {code} · {year}. Attendance reflects recorded sessions; finance reflects saved invoices and collections.',{code:data.school.code,year:data.currentYear?.name||text('No current academic year')})}
        action={data.setupNeeded ? <Button size="small" href="/settings">{text('Open settings')}</Button> : undefined}
      />

      <Row gutter={[16, 16]}>
        {metrics.map(([key, label, Icon, color, href]) => <Col key={key} xs={24} sm={12} xl={6}><MetricCard label={text(label)} value={data.counts[key] ?? 0} color={color} icon={Icon} href={href} /></Col>)}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card className="gk-dashboard-insight-card" title={<Space><CheckSquareOutlined /> {text('Attendance')}</Space>} extra={<Link to="/attendance">{text('Open')}</Link>}>
            <Statistic title={text('Recorded attendance')} value={data.attendance.rate===null?text('No records'):attendanceRate} suffix={data.attendance.rate===null?undefined:'%'} valueStyle={{ color: attendanceRate >= 75 ? '#16a34a' : '#d97706' }} />
            <Progress percent={attendanceRate} showInfo={false} strokeColor={attendanceRate >= 75 ? '#16a34a' : '#d97706'} trailColor="var(--gk-surface-inset)" />
            <Flex justify="space-between" className="gk-dashboard-supporting-row"><Typography.Text type="secondary">{text('Present')} {data.attendance.present}</Typography.Text><Typography.Text type="secondary">{text('Absent')} {data.attendance.absent}</Typography.Text><Typography.Text type="secondary">{text('Late')} {data.attendance.late}</Typography.Text></Flex>
            <Divider />
            <Typography.Text type="secondary">{text('{count} recorded school sessions',{count:data.attendance.sessions})}{data.attendance.lastDate ? ` · ${text('Last updated')} ${data.attendance.lastDate}` : ''}</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="gk-dashboard-insight-card" title={<Space><WalletOutlined /> {text('Finance')}</Space>} extra={<Link to="/fees">{text('Open')}</Link>}>
            <Statistic title={text('Collection rate')} value={data.finance.collectionRate===null?text('No invoices'):collectionRate} suffix={data.finance.collectionRate===null?undefined:'%'} valueStyle={{ color: collectionRate >= 75 ? '#16a34a' : '#2563eb' }} />
            <Progress percent={collectionRate} showInfo={false} strokeColor="#2563eb" trailColor="var(--gk-surface-inset)" />
            <List size="small" split={false} dataSource={[
              [text('Billed'), amount(data.finance.billedMinor)],
              [text('Collected'), amount(data.finance.paidMinor)],
              [text('Outstanding'), amount(data.finance.outstandingMinor)],
            ]} renderItem={([label, value]) => <List.Item><Typography.Text type="secondary">{label}</Typography.Text><Typography.Text strong>{value}</Typography.Text></List.Item>} />
            <Tag color={data.finance.overdueInvoices ? 'orange' : 'green'}>{text('{count} overdue invoices',{count:data.finance.overdueInvoices})}</Tag>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="gk-dashboard-insight-card" title={<Space><BookOutlined /> {text('Learning & people')}</Space>} extra={<Link to="/homework">{text('Open')}</Link>}>
            <List size="small" split={false} dataSource={[
              [text('Published homework'), `${data.analytics.homework.published} / ${data.analytics.homework.total}`],
              [text('Published exams'), `${data.analytics.exams.published} / ${data.analytics.exams.total}`],
              [text('Pending leave requests'), String(data.analytics.leaveRequests.pending)],
            ]} renderItem={([label, value]) => <List.Item><Typography.Text type="secondary">{label}</Typography.Text><Typography.Text strong>{value}</Typography.Text></List.Item>} />
            <Divider />
            <Badge status={data.analytics.leaveRequests.pending ? 'warning' : 'success'} text={data.analytics.leaveRequests.pending ? text('Review requests requiring attention') : text('No pending leave requests')} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title={text('School setup')} extra={<Button type="link" icon={<SettingOutlined />} href="/settings">{text('Edit settings')}</Button>}>
            <List className="gk-dashboard-list" dataSource={setupRows} renderItem={([label, value]) => <List.Item><Typography.Text type="secondary">{label}</Typography.Text><Typography.Text strong>{value}</Typography.Text></List.Item>} />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title={text('Quick actions')}>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Button block icon={<TeamOutlined />} href="/students">{text('Add or review students')}</Button>
              <Button block icon={<ReadOutlined />} href="/teachers">{text('Add or review teachers')}</Button>
              <Button block icon={<CheckSquareOutlined />} href="/attendance">{text('Record attendance')}</Button>
              <Button block icon={<BookOutlined />} href="/academics">{text('Manage classes and sections')}</Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
};
