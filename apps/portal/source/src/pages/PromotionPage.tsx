import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Select, Typography, Row, Col, Statistic, Alert, message, Radio } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowUpOutlined, CheckCircleOutlined, SwapOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface PromotionCandidate {
  key: string;
  studentId: number;
  rollNo: string;
  name: string;
  currentClass: string;
  annualMarksPct: number;
  attendancePct: number;
  promotionDecision: 'Promote' | 'Retain' | 'Transfer TC';
  targetClass: string;
}

const initialCandidates: PromotionCandidate[] = [
  { key: '1', studentId: 1, rollNo: '01', name: 'Aarav Malhotra', currentClass: 'Grade 1 - A', annualMarksPct: 94.2, attendancePct: 96.5, promotionDecision: 'Promote', targetClass: 'Grade 2 - A' },
  { key: '2', studentId: 2, rollNo: '02', name: 'Ananya Sharma', currentClass: 'Grade 1 - A', annualMarksPct: 96.0, attendancePct: 98.0, promotionDecision: 'Promote', targetClass: 'Grade 2 - A' },
  { key: '3', studentId: 3, rollNo: '03', name: 'Kabir Patel', currentClass: 'Grade 1 - A', annualMarksPct: 74.5, attendancePct: 92.4, promotionDecision: 'Promote', targetClass: 'Grade 2 - A' },
  { key: '4', studentId: 4, rollNo: '04', name: 'Diya Sengupta', currentClass: 'Grade 1 - A', annualMarksPct: 98.1, attendancePct: 97.8, promotionDecision: 'Promote', targetClass: 'Grade 2 - A' },
];

export const PromotionPage: React.FC = () => {
  const [candidates, setCandidates] = useState<PromotionCandidate[]>(initialCandidates);
  const [fromClass, setFromClass] = useState('Grade 1 - Section A');
  const [toClass, setToClass] = useState('Grade 2 - Section A');

  const setDecision = (id: number, promotionDecision: 'Promote' | 'Retain' | 'Transfer TC') => {
    setCandidates(
      candidates.map((c) =>
        c.studentId === id
          ? {
              ...c,
              promotionDecision,
              targetClass: promotionDecision === 'Promote' ? toClass : promotionDecision === 'Retain' ? fromClass : 'Alumni / TC Issued',
            }
          : c
      )
    );
  };

  const handleExecuteBatch = () => {
    message.success('Academic Year-End Batch Promotion executed! 4 student academic history records archived in PostgreSQL.');
  };

  const columns: ColumnsType<PromotionCandidate> = [
    { title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 90, render: (r) => <Text strong>{r}</Text> },
    { title: 'Student Name', dataIndex: 'name', key: 'name', render: (n) => <Text strong>{n}</Text> },
    {
      title: 'Academic Score',
      dataIndex: 'annualMarksPct',
      key: 'annualMarksPct',
      render: (m) => <Tag color="blue" style={{ fontWeight: 700 }}>{m}%</Tag>,
    },
    {
      title: 'Attendance',
      dataIndex: 'attendancePct',
      key: 'attendancePct',
      render: (att) => <Tag color="green">{att}%</Tag>,
    },
    {
      title: 'Promotion Decision',
      key: 'decision',
      render: (_, r) => (
        <Radio.Group
          value={r.promotionDecision}
          onChange={(e) => setDecision(r.studentId, e.target.value)}
          size="small"
        >
          <Radio.Button value="Promote">Promote</Radio.Button>
          <Radio.Button value="Retain">Retain</Radio.Button>
          <Radio.Button value="Transfer TC">Transfer TC</Radio.Button>
        </Radio.Group>
      ),
    },
    {
      title: 'Target Standard',
      dataIndex: 'targetClass',
      key: 'targetClass',
      render: (tc, r) => (
        <Tag color={r.promotionDecision === 'Promote' ? 'green' : r.promotionDecision === 'Retain' ? 'gold' : 'red'}>
          {tc}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert
        message="Year-End Academic Promotion Engine"
        description="Select the source standard and target promotion standard. Promoting automatically updates student standard link, resets roll numbers, and archives previous report card transcripts."
        type="info"
        showIcon
        style={{ borderRadius: 14 }}
      />

      <Card bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <Space size="middle" wrap>
            <div>
              <Text strong style={{ display: 'block', fontSize: 11, color: '#64748B' }}>FROM CURRENT CLASS</Text>
              <Select
                value={fromClass}
                onChange={setFromClass}
                style={{ width: 220 }}
                options={[
                  { value: 'Grade 1 - Section A', label: 'Grade 1 - Section A' },
                  { value: 'Grade 2 - Section A', label: 'Grade 2 - Section A' },
                ]}
              />
            </div>
            <SwapOutlined style={{ fontSize: 20, marginTop: 18, color: '#94A3B8' }} />
            <div>
              <Text strong style={{ display: 'block', fontSize: 11, color: '#64748B' }}>PROMOTE TO TARGET CLASS</Text>
              <Select
                value={toClass}
                onChange={setToClass}
                style={{ width: 220 }}
                options={[
                  { value: 'Grade 2 - Section A', label: 'Grade 2 - Section A' },
                  { value: 'Grade 3 - Section A', label: 'Grade 3 - Section A' },
                ]}
              />
            </div>
          </Space>

          <Button
            type="primary"
            icon={<ArrowUpOutlined />}
            onClick={handleExecuteBatch}
            style={{ background: '#0A2540', borderColor: '#0A2540', marginTop: 12 }}
          >
            Execute Batch Promotion
          </Button>
        </div>

        <Table columns={columns} dataSource={candidates} pagination={false} />
      </Card>
    </div>
  );
};
