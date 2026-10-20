import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined, PrinterOutlined, FileTextOutlined } from '@ant-design/icons';
import { apiClient, API, withId } from '../services/api';
import '../styles/print.css';

const { Text, Title } = Typography;

interface ResultRow {
  id: number;
  name: string;
  rollNo: string | null;
  admissionNo: string | null;
  className: string | null;
  totalMax: number;
  totalObtained: number;
  percentage: number;
  grade: string | null;
  result: string;
  rank: number | null;
  cohortSize: number | null;
  subjectCount: number;
  hasAbsent: boolean;
}

interface Marksheet {
  student: { id: number; name: string; rollNo: string | null; admissionNo: string | null; className: string | null };
  exam: { id: number; name: string; term: string | null };
  board: { code: string; label: string };
  subjects: Array<{
    subject: string;
    maxMarks: number;
    passMarks: number;
    marksObtained: number | null;
    isAbsent: boolean;
    percentage: number | null;
    grade: string | null;
    passed: boolean | null;
  }>;
  summary: {
    totalMax: number; totalObtained: number; percentage: number;
    grade: string | null; result: string; rank: number | null; cohortSize: number | null;
  };
}

const MarksheetSheet: React.FC<{ sheet: Marksheet; schoolName: string }> = ({ sheet, schoolName }) => (
  <div className="gk-marksheet">
    <div className="gk-marksheet-head">
      <h2>{schoolName}</h2>
      <div style={{ fontSize: 13 }}>
        {sheet.exam.name}{sheet.exam.term ? ` · ${sheet.exam.term}` : ''}
      </div>
      {/* Printed on the sheet so a reprint stays interpretable: the same marks
          grade differently under another board's bands. */}
      <div style={{ fontSize: 11, color: '#667085' }}>
        Graded under {sheet.board?.label ?? sheet.board?.code}
      </div>
    </div>

    <table style={{ marginBottom: 12 }}>
      <tbody>
        <tr>
          <th style={{ width: '18%' }}>Student</th><td>{sheet.student.name}</td>
          <th style={{ width: '18%' }}>Class</th><td>{sheet.student.className || '—'}</td>
        </tr>
        <tr>
          <th>Roll no</th><td>{sheet.student.rollNo || '—'}</td>
          <th>Admission no</th><td>{sheet.student.admissionNo || '—'}</td>
        </tr>
      </tbody>
    </table>

    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th className="num">Max</th>
          <th className="num">Pass</th>
          <th className="num">Obtained</th>
          <th className="num">%</th>
          <th>Grade</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        {sheet.subjects.map((s) => (
          <tr key={s.subject}>
            <td>{s.subject}</td>
            <td className="num">{s.maxMarks}</td>
            <td className="num">{s.passMarks}</td>
            <td className="num">{s.isAbsent ? 'AB' : s.marksObtained ?? '—'}</td>
            <td className="num">{s.percentage === null ? '—' : s.percentage}</td>
            <td>{s.grade || '—'}</td>
            <td>{s.isAbsent ? 'Absent' : s.passed === null ? '—' : s.passed ? 'Pass' : 'Fail'}</td>
          </tr>
        ))}
        <tr>
          <th>Total</th>
          <th className="num">{sheet.summary.totalMax}</th>
          <th />
          <th className="num">{sheet.summary.totalObtained}</th>
          <th className="num">{sheet.summary.percentage}</th>
          <th>{sheet.summary.grade || '—'}</th>
          <th>{sheet.summary.result}</th>
        </tr>
      </tbody>
    </table>

    <div style={{ marginTop: 12, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
      <span>
        Rank: {sheet.summary.rank ?? '—'}
        {sheet.summary.cohortSize ? ` of ${sheet.summary.cohortSize}` : ''}
      </span>
      <span>Class teacher ______________  Principal ______________</span>
    </div>
  </div>
);

export const ExamResultsPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<Array<{ value: number; label: string }>>([]);
  const [standardLinkId, setStandardLinkId] = useState<number | undefined>();
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sheets, setSheets] = useState<Marksheet[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [building, setBuilding] = useState(false);
  const schoolName = (() => {
    try { return JSON.parse(localStorage.getItem('gurukul_school') || '{}').name || 'School'; }
    catch { return 'School'; }
  })();

  useEffect(() => {
    (async () => {
      const res = await apiClient.get(API.timetableOptionsApi);
      setClasses(res.data.data.classes);
      if (res.data.data.classes.length) setStandardLinkId(res.data.data.classes[0].value);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!examId || !standardLinkId) return;
    setLoading(true);
    setError(null);
    try {
      const url = API.examResultsApi
        .replace('__EXAM__', String(examId))
        .replace('__CLASS__', String(standardLinkId));
      const res = await apiClient.get(url);
      setRows(res.data.data.students);
      setStats(res.data.data.stats);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Results could not be loaded.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [examId, standardLinkId]);

  useEffect(() => { load(); }, [load]);

  const openMarksheets = async (studentIds: number[]) => {
    setBuilding(true);
    try {
      const built = await Promise.all(
        studentIds.map(async (id) => {
          const url = API.marksheetApi.replace('__ID__', String(id)).replace('__EXAM__', String(examId));
          const res = await apiClient.get(url);
          return res.data.data as Marksheet;
        })
      );
      setSheets(built);
      setPreviewOpen(true);
    } finally {
      setBuilding(false);
    }
  };

  const columns: ColumnsType<ResultRow> = [
    { title: 'Roll', dataIndex: 'rollNo', width: 70, render: (v) => v || '—' },
    { title: 'Student', dataIndex: 'name' },
    { title: 'Obtained', key: 'obt', align: 'right', render: (_, r) => `${r.totalObtained} / ${r.totalMax}` },
    { title: '%', dataIndex: 'percentage', align: 'right' },
    { title: 'Grade', dataIndex: 'grade', render: (v) => (v ? <Tag color="blue">{v}</Tag> : '—') },
    {
      title: 'Result',
      dataIndex: 'result',
      render: (v: string) => (
        <Tag color={v === 'Pass' ? 'green' : v === 'Fail' ? 'red' : 'default'}>{v}</Tag>
      ),
    },
    { title: 'Rank', dataIndex: 'rank', align: 'right', render: (v) => v ?? '—' },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, r) => (
        <Button size="small" icon={<FileTextOutlined />} onClick={() => openMarksheets([r.id])}>
          Marksheet
        </Button>
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
            <Title level={3} style={{ margin: 0 }}>Exam results</Title>
            <Text type="secondary">Class results, ranks and printable marksheets</Text>
          </div>
          <Space>
            <Select
              style={{ width: 240 }}
              value={standardLinkId}
              onChange={setStandardLinkId}
              options={classes}
              showSearch
              optionFilterProp="label"
            />
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              loading={building}
              disabled={!rows.length}
              onClick={() => openMarksheets(rows.map((r) => r.id))}
            >
              All marksheets
            </Button>
          </Space>
        </Flex>
      </div>

      {error && <Alert type="error" showIcon message={error} />}

      {stats && (
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}><Card><Statistic title="Students" value={stats.total} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="Passed" value={stats.passed} valueStyle={{ color: '#16a34a' }} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="Pass rate" value={stats.passPercentage} suffix="%" /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="Class average" value={stats.classAverage} suffix="%" /></Card></Col>
        </Row>
      )}

      <Card>
        {rows.length === 0 && !loading ? (
          <Empty description="No results for this class" />
        ) : (
          <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} scroll={{ x: 820 }} pagination={{ pageSize: 25 }} />
        )}
      </Card>

      <Modal
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        width={900}
        title={`Marksheet preview (${sheets.length})`}
        footer={[
          <Button key="close" onClick={() => setPreviewOpen(false)}>Close</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
            Print {sheets.length} marksheet(s)
          </Button>,
        ]}
      >
        <Alert
          type="info"
          showIcon
          className="gk-marksheet-note"
          style={{ marginBottom: 16 }}
          message="Print layout"
          description="One marksheet per page; the admin navigation is removed automatically."
        />
        <div className="gk-marksheet-sheet">
          {sheets.map((s) => (
            <MarksheetSheet key={s.student.id} sheet={s} schoolName={schoolName} />
          ))}
        </div>
      </Modal>
    </Flex>
  );
};
