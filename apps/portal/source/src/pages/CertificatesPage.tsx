import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Select, Input, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FileProtectOutlined, PrinterOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface CertificateItem {
  key: string;
  id: number;
  type: string;
  certificateNo: string;
  studentName: string;
  issueDate: string;
  status: string;
}

const initialCerts: CertificateItem[] = [
  { key: '1', id: 1, type: 'bonafide', certificateNo: 'BON-2026-8812', studentName: 'Aarav Malhotra', issueDate: '2026-08-10', status: 'issued' },
  { key: '2', id: 2, type: 'character', certificateNo: 'CHA-2026-8813', studentName: 'Ananya Sharma', issueDate: '2026-08-11', status: 'issued' },
  { key: '3', id: 3, type: 'transfer', certificateNo: 'TRA-2026-8814', studentName: 'Rohan Verma', issueDate: '2026-08-12', status: 'issued' },
];

export const CertificatesPage: React.FC = () => {
  const [certs, setCerts] = useState<CertificateItem[]>(initialCerts);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewCert, setPreviewCert] = useState<CertificateItem | null>(null);
  const [form] = Form.useForm();

  const handleIssue = (values: any) => {
    const certPrefix = values.type.toUpperCase().substring(0, 3);
    const certNo = `${certPrefix}-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newCert: CertificateItem = {
      key: String(certs.length + 1),
      id: certs.length + 1,
      type: values.type,
      certificateNo: certNo,
      studentName: values.studentName,
      issueDate: new Date().toISOString().split('T')[0],
      status: 'issued',
    };

    setCerts([newCert, ...certs]);
    setIsModalOpen(false);
    form.resetFields();
    message.success(`${values.type.toUpperCase()} Certificate generated successfully!`);
  };

  const columns: ColumnsType<CertificateItem> = [
    { title: 'Certificate No', dataIndex: 'certificateNo', key: 'certificateNo', render: (t) => <Text code strong>{t}</Text> },
    { title: 'Student Name', dataIndex: 'studentName', key: 'studentName', render: (t) => <Text strong>{t}</Text> },
    {
      title: 'Certificate Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'transfer' ? 'red' : type === 'bonafide' ? 'blue' : 'green'} style={{ textTransform: 'uppercase', fontWeight: 700 }}>
          {type}
        </Tag>
      ),
    },
    { title: 'Issue Date', dataIndex: 'issueDate', key: 'issueDate' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: () => <Tag icon={<CheckCircleOutlined />} color="success">ISSUED</Tag>,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button size="small" icon={<PrinterOutlined />} onClick={() => setPreviewCert(record)}>
          Print Certificate
        </Button>
      ),
    },
  ];

  return (
    <Card
      title={<Title level={5} style={{ margin: 0 }}>Official Certificate Generation Engine</Title>}
      extra={
        <Button
          type="primary"
          icon={<FileProtectOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ background: '#0A2540', borderColor: '#0A2540' }}
        >
          Issue Certificate
        </Button>
      }
      bordered={false}
    >
      <Table columns={columns} dataSource={certs} pagination={false} />

      {/* Issue Modal */}
      <Modal
        title={<Title level={4} style={{ margin: 0 }}>Issue Student Certificate</Title>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleIssue} style={{ marginTop: 16 }}>
          <Form.Item name="studentName" label="Student Full Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Aarav Malhotra" />
          </Form.Item>

          <Form.Item name="type" label="Certificate Type" initialValue="bonafide">
            <Select
              options={[
                { value: 'bonafide', label: 'Bonafide Certificate' },
                { value: 'character', label: 'Character & Conduct Certificate' },
                { value: 'transfer', label: 'Transfer Certificate (TC)' },
                { value: 'study', label: 'Study & Medium Certificate' },
              ]}
            />
          </Form.Item>

          <Form.Item name="purpose" label="Purpose / Remarks">
            <Input placeholder="e.g. Passport application / College admission" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                Generate Certificate
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Preview Modal */}
      <Modal
        title={<Title level={4} style={{ margin: 0 }}>Certificate Verification Preview</Title>}
        open={!!previewCert}
        onCancel={() => setPreviewCert(null)}
        onOk={() => {
          message.success('Certificate dispatched to printer spool.');
          setPreviewCert(null);
        }}
        okText="Print / Export PDF"
      >
        {previewCert && (
          <Card style={{ border: '2px dashed #0A2540', background: '#FAFAFA', textAlign: 'center', marginTop: 12 }}>
            <Title level={4} style={{ color: '#0A2540', margin: 0 }}>GREENWOOD HIGH SCHOOL</Title>
            <Text type="secondary" style={{ fontSize: 11 }}>Affiliated to CBSE, New Delhi • School Code: GW101</Text>
            <div style={{ margin: '20px 0' }}>
              <Tag color="gold" style={{ fontSize: 13, padding: '4px 12px', fontWeight: 800 }}>
                {previewCert.type.toUpperCase()} CERTIFICATE
              </Tag>
              <Paragraph style={{ marginTop: 12, fontSize: 13, lineHeight: 1.8 }}>
                This is to certify that <strong>{previewCert.studentName}</strong> is a bonafide student of Greenwood High School.
              </Paragraph>
              <Text code style={{ fontSize: 12 }}>Verification Serial: {previewCert.certificateNo}</Text>
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>Date: {previewCert.issueDate} • Authorized Signatory</Text>
          </Card>
        )}
      </Modal>
    </Card>
  );
};
