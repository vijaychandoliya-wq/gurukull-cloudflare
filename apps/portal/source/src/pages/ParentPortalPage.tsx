import React, { useState } from 'react';
import { Card, Row, Col, Typography, Tag, Progress, Space, Table, Button, Avatar, Statistic, Select, Modal, Form, Input, Descriptions, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UserOutlined,
  DollarOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CarOutlined,
  PhoneOutlined,
  CreditCardOutlined,
  DownloadOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface ChildInfo {
  id: number;
  name: string;
  class: string;
  rollNo: string;
  admissionNo: string;
  attendancePct: number;
  feeStatus: 'Paid' | 'Partial' | 'Due';
  feeAmountDue: number;
  classTeacher: string;
  classTeacherPhone: string;
}

const childrenList: ChildInfo[] = [
  { id: 1, name: 'Aarav Malhotra', class: 'Grade 10 - Section A', rollNo: '01', admissionNo: 'GW-2026-001', attendancePct: 96.5, feeStatus: 'Paid', feeAmountDue: 0, classTeacher: 'Sunita Verma', classTeacherPhone: '+91 98765 00012' },
  { id: 2, name: 'Riya Malhotra', class: 'Grade 6 - Section B', rollNo: '14', admissionNo: 'GW-2021-089', attendancePct: 98.2, feeStatus: 'Due', feeAmountDue: 8500, classTeacher: 'Devika Das', classTeacherPhone: '+91 98765 00025' },
];

export const ParentPortalPage: React.FC = () => {
  const [selectedChildId, setSelectedChildId] = useState<number>(1);
  const [isPayModalOpen, setIsPayModalOpen] = useState<boolean>(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);
  const [form] = Form.useForm();

  const currentChild = childrenList.find((c) => c.id === selectedChildId) || childrenList[0];

  const handleApplyLeave = (values: any) => {
    setIsLeaveModalOpen(false);
    form.resetFields();
    message.success(`Student leave application submitted for ${currentChild.name} to class teacher ${currentChild.classTeacher}!`);
  };

  const handlePayFee = () => {
    setIsPayModalOpen(false);
    message.success(`Online Fee payment of ₹${currentChild.feeAmountDue.toLocaleString()} processed successfully via UPI/Gateway! Receipt REC-2026-9901 generated.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Parent Top Child Switcher Banner */}
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
              V
            </Avatar>
            <div>
              <Title level={3} style={{ color: '#FFFFFF', margin: 0 }}>
                Parent Portal: Vikram Malhotra 👨‍👩‍👦
              </Title>
              <Text style={{ color: '#93C5FD' }}>
                Primary Mobile: +91 98765 43203 • Eklavya Connected
              </Text>
            </div>
          </div>

          <Space size="middle">
            <Text style={{ color: '#FFFFFF', fontWeight: 600 }}>Viewing Child Profile:</Text>
            <Select
              value={selectedChildId}
              onChange={setSelectedChildId}
              style={{ width: 260 }}
              options={childrenList.map((c) => ({
                value: c.id,
                label: `🎓 ${c.name} (${c.class})`,
              }))}
            />
          </Space>
        </div>
      </Card>

      {/* Child Summary Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="ATTENDANCE (TERM 1)" value={currentChild.attendancePct} suffix="%" valueStyle={{ color: '#10B981' }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic
              title="SCHOOL FEE BALANCE"
              value={currentChild.feeAmountDue === 0 ? 'CLEARED' : `₹${currentChild.feeAmountDue.toLocaleString()}`}
              valueStyle={{ color: currentChild.feeAmountDue === 0 ? '#10B981' : '#EF4444' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="CLASS TEACHER" value={currentChild.classTeacher} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="BUS LIVE TELEMETRY" value="32 km/h" suffix="GPS Active" valueStyle={{ color: '#10B981' }} />
          </Card>
        </Col>
      </Row>

      {/* Child Profile Details & Quick Actions */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>Academic Record for {currentChild.name}</Title>}
            extra={
              <Space>
                <Button icon={<FilePdfOutlined />} onClick={() => message.success('Report card PDF downloaded.')}>Download Report Card</Button>
                <Button type="primary" onClick={() => setIsLeaveModalOpen(true)} style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                  Apply Student Leave
                </Button>
              </Space>
            }
            bordered={false}
          >
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Admission Number"><Text code strong>{currentChild.admissionNo}</Text></Descriptions.Item>
              <Descriptions.Item label="Class & Section">{currentChild.class}</Descriptions.Item>
              <Descriptions.Item label="Roll Number">{currentChild.rollNo}</Descriptions.Item>
              <Descriptions.Item label="Academic Session">2026–2027</Descriptions.Item>
              <Descriptions.Item label="Class Teacher Contact">{currentChild.classTeacher} ({currentChild.classTeacherPhone})</Descriptions.Item>
              <Descriptions.Item label="Fee Status">
                <Tag color={currentChild.feeStatus === 'Paid' ? 'green' : 'red'}>{currentChild.feeStatus}</Tag>
                {currentChild.feeAmountDue > 0 && (
                  <Button size="small" type="primary" danger onClick={() => setIsPayModalOpen(true)} style={{ marginLeft: 8 }}>
                    Pay ₹{currentChild.feeAmountDue.toLocaleString()}
                  </Button>
                )}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 24 }}>Recent Teacher Remarks & Notice Diary</Title>
            <Card size="small" style={{ background: '#F8FAFC', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>Sunita Verma (Class Teacher):</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>2026-08-14</Text>
              </div>
              <Paragraph style={{ margin: '4px 0 0 0', fontSize: 13 }}>
                "{currentChild.name} showed exceptional participation in mathematics linear algebra session today. Keep up the enthusiasm!"
              </Paragraph>
            </Card>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<Title level={5} style={{ margin: 0 }}>School Transport GPS Tracking</Title>} bordered={false}>
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong>Bus Route 01 (RJ-14-PA-8812)</Text>
                <Tag color="green">Live on Route</Tag>
              </div>
              <Progress percent={70} strokeColor="#10B981" status="active" />
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 8 }}>
                Driver: <strong>Satish Singh</strong> (+91 98765 88101)
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                Next Stop: <strong>Civil Lines Crossing</strong> (ETA: 5 mins)
              </div>
            </div>
          </Card>

          <Card title={<Title level={5} style={{ margin: 0, marginTop: 16 }}>Fee Invoicing & Payment History</Title>} bordered={false} style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <Text strong>Term 1 Tuition & Transport</Text>
                <div style={{ fontSize: 11, color: '#64748B' }}>Invoice: INV-2026-001</div>
              </div>
              <Tag color="green">Paid ₹25,000</Tag>
            </div>
            <Button block icon={<DownloadOutlined />} onClick={() => message.success('Official Fee Receipt REC-2026-001 downloaded.')}>
              Download Official Fee Receipt
            </Button>
          </Card>
        </Col>
      </Row>

      {/* Apply Leave Modal */}
      <Modal
        title={`Apply Student Leave for ${currentChild.name}`}
        open={isLeaveModalOpen}
        onCancel={() => setIsLeaveModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleApplyLeave} style={{ marginTop: 16 }}>
          <Form.Item name="leaveType" label="Reason Category" initialValue="Medical / Illness">
            <Select
              options={[
                { value: 'Medical / Illness', label: 'Medical / Illness' },
                { value: 'Family Function / Travel', label: 'Family Function / Travel' },
                { value: 'Urgent Personal Work', label: 'Urgent Personal Work' },
              ]}
            />
          </Form.Item>
          <Space style={{ display: 'flex', width: '100%' }} size="middle">
            <Form.Item name="startDate" label="From Date" initialValue="2026-08-18" style={{ flex: 1 }}>
              <Input type="date" />
            </Form.Item>
            <Form.Item name="endDate" label="To Date" initialValue="2026-08-19" style={{ flex: 1 }}>
              <Input type="date" />
            </Form.Item>
          </Space>
          <Form.Item name="reason" label="Reason Details" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Please explain reason for leave..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsLeaveModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                Submit Leave to Teacher
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Online Fee Payment Modal */}
      <Modal
        title={`Online Instant Fee Payment (₹${currentChild.feeAmountDue.toLocaleString()})`}
        open={isPayModalOpen}
        onCancel={() => setIsPayModalOpen(false)}
        onOk={handlePayFee}
        okText="Pay Now via UPI / NetBanking"
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Title level={4} style={{ color: '#0A2540', margin: 0 }}>
            Greenwood High School Fee Portal
          </Title>
          <Text type="secondary">Student: {currentChild.name} • {currentChild.class}</Text>
          <Card size="small" style={{ background: '#F8FAFC', margin: '16px 0' }}>
            <Statistic title="AMOUNT PAYABLE" value={currentChild.feeAmountDue} prefix="₹" valueStyle={{ color: '#0A2540' }} />
          </Card>
          <Text style={{ fontSize: 12, color: '#64748B' }}>
            Secured by Razorpay / UPI Instant Banking. Instant receipt generated.
          </Text>
        </div>
      </Modal>
    </div>
  );
};
