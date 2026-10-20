import React from 'react';
import { Card, Row, Col, Typography, Tag, Progress, Space, Table, Button, Timeline, Avatar, Statistic, Badge, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  BookOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  TrophyOutlined,
  CarOutlined,
  RocketOutlined,
  UploadOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface HomeworkTask {
  id: number;
  subject: string;
  title: string;
  dueDate: string;
  status: 'Pending' | 'Submitted' | 'Graded';
  grade?: string;
}

const studentHomework: HomeworkTask[] = [
  { id: 1, subject: 'Mathematics', title: 'Linear Equations Exercise 3.2 (Q1-15)', dueDate: '2026-08-16', status: 'Submitted', grade: 'A+ (10/10)' },
  { id: 2, subject: 'Science (Physics)', title: 'Snell Law & Refraction Diagram', dueDate: '2026-08-17', status: 'Pending' },
  { id: 3, subject: 'English', title: 'Monsoon Creative Essay Submission', dueDate: '2026-08-18', status: 'Submitted', grade: 'A (9/10)' },
];

export const StudentPortalPage: React.FC = () => {
  const hwColumns: ColumnsType<HomeworkTask> = [
    { title: 'Subject', dataIndex: 'subject', key: 'subject', render: (s) => <Tag color="blue">{s}</Tag> },
    { title: 'Homework Assignment', dataIndex: 'title', key: 'title', render: (t) => <Text strong>{t}</Text> },
    { title: 'Due Date', dataIndex: 'dueDate', key: 'dueDate', render: (d) => <Text type="secondary"><CalendarOutlined /> {d}</Text> },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => (
        <Tag color={r.status === 'Graded' ? 'green' : r.status === 'Submitted' ? 'gold' : 'red'}>
          {r.status} {r.grade ? `(${r.grade})` : ''}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        r.status === 'Pending' ? (
          <Button size="small" type="primary" icon={<UploadOutlined />} onClick={() => message.success('Assignment PDF uploaded for teacher grading.')}>
            Submit Work
          </Button>
        ) : (
          <Tag icon={<CheckCircleOutlined />} color="success">Completed</Tag>
        )
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Student Welcome Banner */}
      <Card
        style={{
          background: 'linear-gradient(135deg, #0A2540 0%, #1E3A8A 100%)',
          color: '#FFFFFF',
          borderRadius: 16,
          border: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Avatar size={64} style={{ backgroundColor: '#F59E0B', color: '#0A2540', fontSize: 24, fontWeight: 'bold' }}>
              A
            </Avatar>
            <div>
              <Title level={3} style={{ color: '#FFFFFF', margin: 0 }}>
                Welcome back, Aarav Malhotra! 👋
              </Title>
              <Text style={{ color: '#93C5FD' }}>
                Grade 10 - Section A • Roll No: 01 • Admission No: GW-2026-001
              </Text>
            </div>
          </div>
          <Space size="large">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#10B981' }}>96.5%</div>
              <div style={{ fontSize: 11, color: '#93C5FD' }}>Attendance</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#F59E0B' }}>Rank 1</div>
              <div style={{ fontSize: 11, color: '#93C5FD' }}>Class Standing</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#38BDF8' }}>A1</div>
              <div style={{ fontSize: 11, color: '#93C5FD' }}>Overall Grade</div>
            </div>
          </Space>
        </div>
      </Card>

      {/* Quick Metrics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false}>
            <Statistic title="PENDING HOMEWORK TASKS" value={1} suffix="Assignments" valueStyle={{ color: '#EF4444' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false}>
            <Statistic title="ACTIVE LIBRARY BOOKS" value={2} suffix="Books with me (Due in 5 days)" />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false}>
            <Statistic title="BUS LIVE TELEMETRY" value="32 km/h" suffix="(Bus 01 on route)" valueStyle={{ color: '#10B981' }} />
          </Card>
        </Col>
      </Row>

      {/* Main Student Layout */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title={<Title level={5} style={{ margin: 0 }}>My Active Homework & Assignments</Title>} bordered={false}>
            <Table columns={hwColumns} dataSource={studentHomework} pagination={false} rowKey="id" />
          </Card>

          <Card title={<Title level={5} style={{ margin: 0, marginTop: 16 }}>Today's Class Timetable</Title>} bordered={false} style={{ marginTop: 16 }}>
            <Row gutter={[12, 12]}>
              <Col span={6}>
                <Card size="small" style={{ background: '#F8FAFC', borderLeft: '3px solid #1890FF' }}>
                  <Text strong>08:30 - 09:15</Text>
                  <div>Mathematics</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Sunita Verma (Room 201)</Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ background: '#F8FAFC', borderLeft: '3px solid #10B981' }}>
                  <Text strong>09:15 - 10:00</Text>
                  <div>Physics Lab</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Ramesh Gupta (Lab 1)</Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ background: '#F8FAFC', borderLeft: '3px solid #F59E0B' }}>
                  <Text strong>10:00 - 10:45</Text>
                  <div>English Core</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Priya Mehta (Room 201)</Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ background: '#F8FAFC', borderLeft: '3px solid #8B5CF6' }}>
                  <Text strong>11:00 - 11:45</Text>
                  <div>Computer Python</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Alok Roy (Computer Lab)</Text>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<Title level={5} style={{ margin: 0 }}>Upcoming Tests & Events</Title>} bordered={false}>
            <Timeline
              items={[
                {
                  color: 'green',
                  children: (
                    <div>
                      <Text strong>Mathematics Mid-Term Exam</Text>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Aug 25, 2026 • 09:00 AM</div>
                    </div>
                  ),
                },
                {
                  color: 'blue',
                  children: (
                    <div>
                      <Text strong>Inter-School Science Fair 2026</Text>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Aug 28, 2026 • Main Auditorium</div>
                    </div>
                  ),
                },
                {
                  color: 'orange',
                  children: (
                    <div>
                      <Text strong>Return Library Book (Dr. Kalam)</Text>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Aug 30, 2026 • Circulation Desk</div>
                    </div>
                  ),
                },
              ]}
            />
          </Card>

          <Card title={<Title level={5} style={{ margin: 0, marginTop: 16 }}>Live School Bus GPS Tracking</Title>} bordered={false} style={{ marginTop: 16 }}>
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong>Bus 01 (RJ-14-PA-8812)</Text>
                <Tag color="green">Live on route</Tag>
              </div>
              <Progress percent={75} strokeColor="#10B981" status="active" />
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 8 }}>
                Approaching stop: <strong>Civil Lines Metro Pillar 42</strong> (ETA: 4 mins)
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
