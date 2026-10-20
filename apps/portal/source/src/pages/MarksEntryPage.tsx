import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Checkbox,
  Flex,
  Input,
  InputNumber,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { apiClient, API, withId } from '../services/api';

const { Text, Title } = Typography;

interface Row {
  studentId: number;
  name: string;
  rollNo: string | null;
  admissionNo: string | null;
  marksObtained: number | null;
  isAbsent: boolean;
  remarks: string | null;
}

interface ScheduleInfo {
  id: number;
  examName: string;
  className: string | null;
  subjectName: string | null;
  maxMarks: number;
  passMarks: number;
}

/**
 * Marks entry for a single paper.
 *
 * The whole sheet is saved in one request rather than per-row: a half-saved
 * mark sheet is worse than an unsaved one, because it looks finished. The
 * server writes it in a transaction for the same reason.
 */
export const MarksEntryPage: React.FC = () => {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [schedule, setSchedule] = useState<ScheduleInfo | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!scheduleId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(withId(API.examMarksApi, scheduleId));
      setSchedule(res.data.data.schedule);
      setRows(res.data.data.students);
      setDirty(false);
    } catch (e: any) {
      setError(e.response?.data?.message || 'The mark sheet could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [scheduleId]);

  useEffect(() => { load(); }, [load]);

  const update = (studentId: number, patch: Partial<Row>) => {
    setRows((current) =>
      current.map((r) => (r.studentId === studentId ? { ...r, ...patch } : r))
    );
    setDirty(true);
  };

  const save = async () => {
    if (!scheduleId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.post(withId(API.examMarksApi, scheduleId), {
        marks: rows.map((r) => ({
          studentId: r.studentId,
          marksObtained: r.isAbsent ? null : r.marksObtained,
          isAbsent: r.isAbsent,
          remarks: r.remarks,
        })),
      });
      message.success(res.data.message || 'Marks saved.');
      setDirty(false);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'The marks could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const max = schedule?.maxMarks ?? 100;
  const pass = schedule?.passMarks ?? 0;

  const columns: ColumnsType<Row> = [
    { title: 'Roll', dataIndex: 'rollNo', width: 80, render: (v) => v || '—' },
    {
      title: 'Student',
      dataIndex: 'name',
      render: (_, r) => (
        <div>
          <Text>{r.name}</Text>
          <div style={{ fontSize: 12, color: '#667085' }}>{r.admissionNo || '—'}</div>
        </div>
      ),
    },
    {
      title: `Marks (out of ${max})`,
      key: 'marks',
      width: 200,
      render: (_, r) => (
        <InputNumber
          min={0}
          max={max}
          value={r.marksObtained ?? undefined}
          disabled={r.isAbsent}
          style={{ width: 120 }}
          onChange={(v) => update(r.studentId, { marksObtained: v === null ? null : Number(v) })}
        />
      ),
    },
    {
      title: 'Absent',
      key: 'absent',
      width: 90,
      align: 'center',
      render: (_, r) => (
        <Checkbox
          checked={r.isAbsent}
          onChange={(e) =>
            update(r.studentId, {
              isAbsent: e.target.checked,
              marksObtained: e.target.checked ? null : r.marksObtained,
            })
          }
        />
      ),
    },
    {
      title: 'Result',
      key: 'result',
      width: 110,
      render: (_, r) => {
        if (r.isAbsent) return <Tag color="orange">Absent</Tag>;
        if (r.marksObtained === null || r.marksObtained === undefined) return <Tag>—</Tag>;
        return r.marksObtained >= pass ? <Tag color="green">Pass</Tag> : <Tag color="red">Fail</Tag>;
      },
    },
    {
      title: 'Remarks',
      key: 'remarks',
      render: (_, r) => (
        <Input
          value={r.remarks ?? ''}
          maxLength={255}
          onChange={(e) => update(r.studentId, { remarks: e.target.value })}
        />
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <div>
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0 }} onClick={() => navigate('/exams')}>
          Back to exams
        </Button>
        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Marks entry</Title>
            {schedule && (
              <Text type="secondary">
                {schedule.examName} · {schedule.className} · {schedule.subjectName} · pass mark {pass}
              </Text>
            )}
          </div>
          <Space>
            {dirty && <Tag color="orange">Unsaved changes</Tag>}
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save} disabled={!rows.length}>
              Save mark sheet
            </Button>
          </Space>
        </Flex>
      </div>

      {error && <Alert type="error" showIcon message={error} />}

      <Card>
        <Table
          rowKey="studentId"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 880 }}
          locale={{ emptyText: 'No students enrolled in this class' }}
        />
      </Card>
    </Flex>
  );
};
