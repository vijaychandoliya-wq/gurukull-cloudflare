import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, InputNumber, Select, Typography, Row, Col, Statistic, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DollarOutlined, FilePdfOutlined, CheckCircleOutlined, DownloadOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface PayslipItem {
  key: string;
  id: number;
  empCode: string;
  name: string;
  designation: string;
  monthYear: string;
  basicSalary: number;
  hra: number;
  da: number;
  specialAllowance: number;
  pfDeduction: number;
  tdsDeduction: number;
  netPay: number;
  status: 'Disbursed' | 'Pending';
}

const initialPayslips: PayslipItem[] = [
  { key: '1', id: 1, empCode: 'EMP-001', name: 'Dr. Rajesh Sharma', designation: 'School Principal', monthYear: 'July 2026', basicSalary: 85000, hra: 25000, da: 15000, specialAllowance: 10000, pfDeduction: 10200, tdsDeduction: 12000, netPay: 112800, status: 'Disbursed' },
  { key: '2', id: 2, empCode: 'EMP-012', name: 'Sunita Verma', designation: 'Senior Faculty (Maths)', monthYear: 'July 2026', basicSalary: 45000, hra: 15000, da: 8000, specialAllowance: 5000, pfDeduction: 5400, tdsDeduction: 4000, netPay: 63600, status: 'Disbursed' },
  { key: '3', id: 3, empCode: 'EMP-014', name: 'Ramesh Gupta', designation: 'Senior Faculty (Science)', monthYear: 'July 2026', basicSalary: 42000, hra: 14000, da: 7500, specialAllowance: 4500, pfDeduction: 5040, tdsDeduction: 3500, netPay: 59460, status: 'Disbursed' },
  { key: '4', id: 4, empCode: 'EMP-020', name: 'Priya Mehta', designation: 'Senior Faculty (English)', monthYear: 'July 2026', basicSalary: 38000, hra: 12000, da: 6500, specialAllowance: 4000, pfDeduction: 4560, tdsDeduction: 2800, netPay: 53140, status: 'Disbursed' },
];

export const PayrollPage: React.FC = () => {
  const [payslips, setPayslips] = useState<PayslipItem[]>(initialPayslips);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipItem | null>(null);

  const columns: ColumnsType<PayslipItem> = [
    { title: 'Emp Code', dataIndex: 'empCode', key: 'empCode', render: (c) => <Text code strong>{c}</Text> },
    {
      title: 'Employee Name',
      key: 'emp',
      render: (_, r) => <div><Text strong>{r.name}</Text><div style={{ fontSize: 11, color: '#64748B' }}>{r.designation}</div></div>,
    },
    { title: 'Pay Period', dataIndex: 'monthYear', key: 'monthYear' },
    {
      title: 'Gross Earnings',
      key: 'gross',
      render: (_, r) => `₹${(r.basicSalary + r.hra + r.da + r.specialAllowance).toLocaleString()}`,
    },
    {
      title: 'Total Deductions (PF/TDS)',
      key: 'deductions',
      render: (_, r) => <Text type="danger">₹{(r.pfDeduction + r.tdsDeduction).toLocaleString()}</Text>,
    },
    {
      title: 'Net Disbursed Salary',
      dataIndex: 'netPay',
      key: 'netPay',
      render: (p) => <Text type="success" strong style={{ fontSize: 14 }}>₹{p.toLocaleString()}</Text>,
    },
    {
      title: 'Disbursement Status',
      dataIndex: 'status',
      key: 'status',
      render: (st) => <Tag color="green">{st}</Tag>,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        <Button size="small" icon={<FilePdfOutlined />} onClick={() => setSelectedPayslip(r)}>
          View Payslip
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false}>
            <Statistic title="TOTAL MONTHLY PAYROLL" value={2845000} prefix="₹" />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false}>
            <Statistic title="PROVIDENT FUND (PF) POOL" value={341400} prefix="₹" valueStyle={{ color: '#1890FF' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false}>
            <Statistic title="DISBURSEMENT SUCCESS RATE" value={100} suffix="%" valueStyle={{ color: '#10B981' }} />
          </Card>
        </Col>
      </Row>

      <Card
        title={<Title level={5} style={{ margin: 0 }}>Faculty & Staff Payroll Ledger (Auto Bank NEFT Export)</Title>}
        extra={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={() => message.success('Bank NEFT Excel text file generated.')}>Export Bank File</Button>
            <Button type="primary" style={{ background: '#0A2540', borderColor: '#0A2540' }} onClick={() => message.success('August 2026 batch payroll computed.')}>
              Run Monthly Payroll Batch
            </Button>
          </Space>
        }
        bordered={false}
      >
        <Table columns={columns} dataSource={payslips} pagination={false} />

        {/* Payslip Modal */}
        <Modal
          title="Official Computerized Salary Payslip"
          open={!!selectedPayslip}
          onCancel={() => setSelectedPayslip(null)}
          footer={null}
          width={650}
        >
          {selectedPayslip && (
            <Card style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', marginTop: 12 }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <Title level={4} style={{ color: '#0A2540', margin: 0 }}>GREENWOOD HIGH SCHOOL</Title>
                <Text type="secondary" style={{ fontSize: 11 }}>CBSE Affiliation No: 1730882 • Salary Slip for {selectedPayslip.monthYear}</Text>
              </div>

              <Row gutter={16} style={{ marginBottom: 16, background: '#FFFFFF', padding: 12, borderRadius: 8 }}>
                <Col span={12}>
                  <div><strong>Employee Name:</strong> {selectedPayslip.name}</div>
                  <div><strong>Designation:</strong> {selectedPayslip.designation}</div>
                </Col>
                <Col span={12}>
                  <div><strong>Employee Code:</strong> {selectedPayslip.empCode}</div>
                  <div><strong>Payment Mode:</strong> Direct Bank NEFT Transfer</div>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title="Earnings Breakdown" style={{ height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}><span>Basic Pay:</span> <strong>₹{selectedPayslip.basicSalary.toLocaleString()}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}><span>House Rent Allowance (HRA):</span> <strong>₹{selectedPayslip.hra.toLocaleString()}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}><span>Dearness Allowance (DA):</span> <strong>₹{selectedPayslip.da.toLocaleString()}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}><span>Special Allowance:</span> <strong>₹{selectedPayslip.specialAllowance.toLocaleString()}</strong></div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="Deductions" style={{ height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}><span>Provident Fund (PF):</span> <strong style={{ color: '#EF4444' }}>₹{selectedPayslip.pfDeduction.toLocaleString()}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}><span>Income Tax (TDS):</span> <strong style={{ color: '#EF4444' }}>₹{selectedPayslip.tdsDeduction.toLocaleString()}</strong></div>
                  </Card>
                </Col>
              </Row>

              <Card size="small" style={{ marginTop: 12, background: '#F0FDF4', borderColor: '#BBF7D0', textAlign: 'center' }}>
                <Text style={{ fontSize: 13, color: '#166534' }}>NET TAKE-HOME SALARY:</Text>
                <Title level={3} style={{ color: '#166534', margin: '4px 0 0 0' }}>₹{selectedPayslip.netPay.toLocaleString()}</Title>
              </Card>
            </Card>
          )}
        </Modal>
      </Card>
    </div>
  );
};
