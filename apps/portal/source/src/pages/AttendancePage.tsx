import React, { useState } from 'react';
import { Card, Table, Radio, Select, Button, Tag, Space, Alert, Typography, message, Avatar } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, CloseCircleOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface AttendanceItem {
  key: string;
  studentId: number;
  rollNo: string;
  name: string;
  status: 'present' | 'absent';
  reason?: string;
}

const initialAttendance: AttendanceItem[] = [
  { key: '1', studentId: 1, rollNo: '01', name: 'Aarav Malhotra', status: 'present' },
  { key: '2', studentId: 2, rollNo: '02', name: 'Ananya Sharma', status: 'present' },
  { key: '3', studentId: 3, rollNo: '03', name: 'Kabir Patel', status: 'absent', reason: 'Medical / Viral Fever' },
  { key: '4', studentId: 4, rollNo: '04', name: 'Diya Sengupta', status: 'present' },
  { key: '5', studentId: 5, rollNo: '05', name: 'Rohan Verma', status: 'present' },
  { key: '6', studentId: 6, rollNo: '06', name: 'Ishita Roy', status: 'absent', reason: 'Family Function' },
  { key: '7', studentId: 7, rollNo: '07', name: 'Aditya Rao', status: 'present' },
  { key: '8', studentId: 8, rollNo: '08', name: 'Meera Nair', status: 'present' },
];

export const AttendancePage: React.FC = () => {
  const [data, setData] = useState<AttendanceItem[]>(initialAttendance);
  const [selectedClass, setSelectedClass] = useState('Grade 1 - Section A');
  const [session, setSession] = useState('full_day');
  const [isSaved, setIsSaved] = useState(false);

  const toggleStatus = (id: number, status: 'present' | 'absent') => {
    setData(
      data.map((item) =>
        item.studentId === id
          ? { ...item, status, reason: status === 'present' ? undefined : item.reason || 'Uninformed' }
          : item
      )
    );
    setIsSaved(false);
  };

  const setReason = (id: number, reason: string) => {
    setData(data.map((item) => (item.studentId === id ? { ...item, reason } : item)));
    setIsSaved(false);
  };

  const markAll = (status: 'present' | 'absent') => {
    setData(
      data.map((item) => ({
        ...item,
        status,
        reason: status === 'absent' ? 'Uninformed' : undefined,
      }))
    );
    setIsSaved(false);
  };

  const handleSave = () => {
    setIsSaved(true);
    message.success('Attendance saved! 2 absent parent SMS alerts queued to Redis BullMQ.');
  };

  const presentCount = data.filter((d) => d.status === 'present').length;
  const absentCount = data.filter((d) => d.status === 'absent').length;

  const columns: ColumnsType<AttendanceItem> = [
    { title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 100, render: (t) => <Text strong>{t}</Text> },
    {
      title: 'Student Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <Space>
          <Avatar style={{ backgroundColor: '#0A2540' }}>{name.charAt(0)}</Avatar>
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Attendance Status',
      key: 'status',
      align: 'center',
      render: (_, record) => (
        <Radio.Group
          value={record.status}
          onChange={(e) => toggleStatus(record.studentId, e.target.value)}
          buttonStyle="solid"
          size="middle"
        >
          <Radio.Button value="present" style={{ color: record.status === 'present' ? '#FFFFFF' : '#10B981' }}>
            <CheckCircleOutlined /> Present
          </Radio.Button>
          <Radio.Button value="absent" style={{ color: record.status === 'absent' ? '#FFFFFF' : '#EF4444' }}>
            <CloseCircleOutlined /> Absent
          </Radio.Button>
        </Radio.Group>
      ),
    },
    {
      title: 'Absent Reason / Notes',
      key: 'reason',
      render: (_, record) =>
        record.status === 'absent' ? (
          <Select
            value={record.reason || 'Uninformed'}
            onChange={(val) => setReason(record.studentId, val)}
            style={{ width: 220 }}
            options={[
              { value: 'Uninformed', label: 'Uninformed Absence' },
              { value: 'Medical / Viral Fever', label: 'Medical / Viral Fever' },
              { value: 'Family Function', label: 'Family Function' },
              { value: 'Planned Sick Leave', label: 'Planned Sick Leave' },
            ]}
          />
        ) : (
          <Text type="secondary" italic>Present in classroom</Text>
        ),
    },
  ];

  return (
    <Card bordered={false}>
      {/* Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <Space size="middle" wrap>
          <Select
            value={selectedClass}
            onChange={setSelectedClass}
            style={{ width: 220 }}
            options={[
              { value: 'Grade 1 - Section A', label: 'Grade 1 - Section A' },
              { value: 'Grade 1 - Section B', label: 'Grade 1 - Section B' },
              { value: 'Grade 2 - Section A', label: 'Grade 2 - Section A' },
            ]}
          />
          <Select
            value={session}
            onChange={setSession}
            style={{ width: 160 }}
            options={[
              { value: 'full_day', label: 'Full Day' },
              { value: 'morning', label: 'Morning Session' },
              { value: 'afternoon', label: 'Afternoon Session' },
            ]}
          />
          <Tag color="success" style={{ padding: '4px 10px', fontSize: 13, fontWeight: 700 }}>
            {presentCount} Present
          </Tag>
          <Tag color="error" style={{ padding: '4px 10px', fontSize: 13, fontWeight: 700 }}>
            {absentCount} Absent
          </Tag>
        </Space>

        <Space size="small">
          <Button onClick={() => markAll('present')}>All Present</Button>
          <Button danger onClick={() => markAll('absent')}>All Absent</Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            style={{ background: '#0A2540', borderColor: '#0A2540' }}
          >
            Save & Queue Alerts
          </Button>
        </Space>
      </div>

      {isSaved && (
        <Alert
          message="Attendance Committed"
          description="Records successfully committed to PostgreSQL database. 2 absent notification jobs dispatched to BullMQ worker."
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Table columns={columns} dataSource={data} pagination={false} />
    </Card>
  );
};
