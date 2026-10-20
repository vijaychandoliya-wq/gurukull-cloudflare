import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, InputNumber, Select, Row, Col, Statistic, Typography, message, Empty, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DollarOutlined, PrinterOutlined, CheckCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '../services/api';

const { Text, Title, Paragraph } = Typography;

interface InvoiceItem {
  key: string;
  feeId: string;
  invoiceNo: string;
  studentId: string;
  studentName: string;
  class: string;
  feeName: string;
  totalAmount: number;
  paidAmount: number;
  concession: number;
  balanceDue: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  dueDate: number;
}

export const FeesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [receiptModal, setReceiptModal] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [form] = Form.useForm();

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/admin/fees/invoices');
      if (Array.isArray(res.data.data)) {
        setInvoices(res.data.data);
      } else {
        setInvoices([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load school fee invoices from Cloudflare backend.');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handlePay = async (values: any) => {
    if (!selectedInvoice) return;
    setPayLoading(true);
    try {
      const modeMap: Record<string, string> = {
        'UPI / QR Code': 'online_gateway',
        'Cash Counter': 'cash',
        'Net Banking / NEFT': 'bank_transfer',
        'Debit / Credit Card': 'online_gateway'
      };

      const res = await apiClient.post('/api/admin/fees/payments', {
        invoiceId: selectedInvoice.feeId,
        amount: Number(values.amount),
        paymentMode: modeMap[values.paymentMethod] || 'cash',
        transactionRef: values.transactionRef || null
      });

      const receiptNo = res.data.data.receiptNo;
      setSelectedInvoice(null);
      form.resetFields();
      setReceiptModal(receiptNo);
      message.success(`Fee collected successfully! Receipt ${receiptNo} recorded.`);
      await loadInvoices();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to record fee payment.');
    } finally {
      setPayLoading(false);
    }
  };

  const totalCollected = invoices.reduce((acc, inv) => acc + inv.paidAmount, 0);
  const totalOutstanding = invoices.reduce((acc, inv) => acc + inv.balanceDue, 0);
  const fullyPaidCount = invoices.filter((inv) => inv.status === 'Paid').length;

  const columns: ColumnsType<InvoiceItem> = [
    {
      title: 'Invoice #',
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      render: (no) => <Text code>{no}</Text>,
    },
    {
      title: 'Student',
      dataIndex: 'studentName',
      key: 'studentName',
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{record.class}</Text>
        </div>
      ),
    },
    { title: 'Fee Head', dataIndex: 'feeName', key: 'feeName' },
    {
      title: 'Total Fee',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amt) => <Text strong>₹{amt.toLocaleString('en-IN')}</Text>,
    },
    {
      title: 'Paid',
      dataIndex: 'paidAmount',
      key: 'paidAmount',
      render: (amt) => <Text type="success" strong>₹{amt.toLocaleString('en-IN')}</Text>,
    },
    {
      title: 'Balance Due',
      dataIndex: 'balanceDue',
      key: 'balanceDue',
      render: (amt) =>
        amt > 0 ? (
          <Text type="danger" strong>₹{amt.toLocaleString('en-IN')}</Text>
        ) : (
          <Tag color="success">Cleared</Tag>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'Paid' ? 'green' : status === 'Partial' ? 'gold' : 'red'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) =>
        record.status !== 'Paid' ? (
          <Button
            type="primary"
            size="small"
            icon={<DollarOutlined />}
            onClick={() => {
              setSelectedInvoice(record);
              form.setFieldsValue({ amount: record.balanceDue });
            }}
            style={{ background: '#0A2540', borderColor: '#0A2540' }}
          >
            Collect
          </Button>
        ) : (
          <Button size="small" icon={<PrinterOutlined />} onClick={() => window.print()}>
            Print
          </Button>
        ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <FlexHeader onRefresh={loadInvoices} loading={loading} />

      {error && <Alert type="error" message={error} showIcon />}

      {/* KPI Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Total Collections"
              value={totalCollected}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#10B981', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Total Outstanding Receivables"
              value={totalOutstanding}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#EF4444', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Cleared Invoices"
              value={fullyPaidCount}
              suffix={`/ ${invoices.length}`}
              valueStyle={{ color: '#635BFF', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Fee Invoices Table */}
      <Card
        title={<Title level={5} style={{ margin: 0 }}>Fee Ledger & Invoices</Title>}
        bordered={false}
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <Table
          columns={columns}
          dataSource={invoices}
          rowKey="key"
          loading={loading}
          locale={{ emptyText: <Empty description="No fee invoices issued yet for this school." /> }}
          pagination={{ pageSize: 15 }}
        />
      </Card>

      {/* Collect Fee Modal */}
      <Modal
        title={<Title level={4} style={{ margin: 0 }}>Fee Collection Counter</Title>}
        open={!!selectedInvoice}
        onCancel={() => setSelectedInvoice(null)}
        footer={null}
      >
        {selectedInvoice && (
          <Form form={form} layout="vertical" onFinish={handlePay} style={{ marginTop: 16 }}>
            <Card size="small" style={{ background: '#F8FAFC', marginBottom: 16 }}>
              <Text strong>{selectedInvoice.studentName}</Text> ({selectedInvoice.class})
              <Paragraph style={{ margin: 0, fontSize: 12 }}>Fee Head: {selectedInvoice.feeName}</Paragraph>
              <Text type="danger" strong style={{ fontSize: 13 }}>
                Outstanding Due: ₹{selectedInvoice.balanceDue.toLocaleString('en-IN')}
              </Text>
            </Card>

            <Form.Item name="amount" label="Amount to Collect (₹)" rules={[{ required: true, message: 'Please enter amount' }]}>
              <InputNumber style={{ width: '100%' }} max={selectedInvoice.balanceDue} min={1} />
            </Form.Item>

            <Form.Item name="paymentMethod" label="Payment Mode" initialValue="Cash Counter">
              <Select
                options={[
                  { value: 'Cash Counter', label: 'Cash Counter' },
                  { value: 'UPI / QR Code', label: 'UPI / QR Code Instant' },
                  { value: 'Net Banking / NEFT', label: 'Net Banking / NEFT' },
                  { value: 'Debit / Credit Card', label: 'Card Swipe' },
                ]}
              />
            </Form.Item>

            <Form.Item name="transactionRef" label="Reference / Cheque # (Optional)">
              <InputNumber style={{ width: '100%' }} placeholder="e.g. UTR12345678" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setSelectedInvoice(null)}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={payLoading} style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                  Generate Receipt
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Receipt Modal */}
      <Modal
        title={<Title level={4} style={{ margin: 0, color: '#10B981' }}><CheckCircleOutlined /> Payment Acknowledged</Title>}
        open={!!receiptModal}
        onCancel={() => setReceiptModal(null)}
        onOk={() => setReceiptModal(null)}
      >
        <Paragraph>Computerized receipt generated and transaction recorded in D1 fee ledger with integer paise accuracy.</Paragraph>
        <Card size="small" style={{ background: '#F0FDF4', borderColor: '#BBF7D0', textAlign: 'center' }}>
          <Text strong style={{ fontSize: 18, color: '#166534' }}>{receiptModal}</Text>
        </Card>
      </Modal>
    </div>
  );
};

const FlexHeader: React.FC<{ onRefresh: () => void; loading: boolean }> = ({ onRefresh, loading }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <Title level={4} style={{ margin: 0, color: '#0A2540' }}>Finance & Fee Counter</Title>
      <Text type="secondary">Tenant-scoped computerized fee collection with exact paise reconciliation.</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        Refresh
      </Button>
    </Space>
  </div>
);
