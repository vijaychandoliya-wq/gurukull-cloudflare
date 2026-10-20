import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { apiClient, API, withId } from '../services/api';

const { Text, Title } = Typography;

/**
 * Exams, schedules and the grading scale.
 *
 * Three tabs rather than three pages: setting up an exam means moving between
 * papers and grade bands repeatedly, and the grading scale is what the
 * marksheet resolves against, so it belongs beside the thing it grades.
 */

interface Exam {
  id: number;
  name: string;
  term: string | null;
  startDate: string | null;
  endDate: string | null;
  academicYear: string | null;
  scheduleCount: number;
  classCount: number;
}

interface Schedule {
  id: number;
  standardLinkId: number;
  className: string | null;
  subjectId: number;
  subjectName: string | null;
  date: string | null;
  maxMarks: number;
  passMarks: number;
  portion: string | null;
  marksEntered: number;
}

interface Grade {
  id: number;
  board: string;
  name: string;
  minPercentage: number;
  maxPercentage: number;
  gradePoint: number | null;
  remarks: string | null;
}

interface Option { value: number; label: string }

export const ExamsPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();

  const [exams, setExams] = useState<Exam[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [boards, setBoards] = useState<any>(null);
  const [viewBoard, setViewBoard] = useState<string | undefined>();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [selectedExam, setSelectedExam] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [examForm] = Form.useForm();
  const [examOpen, setExamOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  const [schedForm] = Form.useForm();
  const [schedOpen, setSchedOpen] = useState(false);
  const [editingSched, setEditingSched] = useState<Schedule | null>(null);

  const [gradeForm] = Form.useForm();
  const [gradeOpen, setGradeOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);

  const [boardPickerOpen, setBoardPickerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, b, opts] = await Promise.all([
        apiClient.get(API.examsApi),
        apiClient.get(API.gradeBoardsApi),
        apiClient.get(API.timetableOptionsApi),
      ]);
      setExams(e.data.data);
      setBoards(b.data.data);

      const board = viewBoard ?? b.data.data.activeBoard;
      setViewBoard(board);
      const g = await apiClient.get(API.gradesApi, { params: { board } });
      setGrades(g.data.data);
      setClasses(opts.data.data.classes);
      setSubjects(opts.data.data.subjects);
      if (!selectedExam && e.data.data.length) setSelectedExam(e.data.data[0].id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Exams could not be loaded.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadSchedules = useCallback(async () => {
    if (!selectedExam) { setSchedules([]); return; }
    try {
      const res = await apiClient.get(withId(API.examSchedulesApi, selectedExam));
      setSchedules(res.data.data);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Schedules could not be loaded.');
    }
  }, [selectedExam, message]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  const submit = async (
    fn: () => Promise<any>,
    close: () => void
  ) => {
    setSaving(true);
    setFormError(null);
    try {
      const res = await fn();
      message.success(res.data?.message || 'Saved.');
      close();
      await loadAll();
      await loadSchedules();
    } catch (err: any) {
      if (!err?.response) return;
      setFormError(err.response.data?.message || 'It could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const examColumns: ColumnsType<Exam> = [
    {
      title: 'Exam',
      dataIndex: 'name',
      render: (_, r) => (
        <div>
          <Text strong>{r.name}</Text>
          <div style={{ fontSize: 12, color: '#667085' }}>
            {[r.term, r.academicYear].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Dates',
      key: 'dates',
      render: (_, r) =>
        r.startDate
          ? `${new Date(r.startDate).toLocaleDateString()} – ${r.endDate ? new Date(r.endDate).toLocaleDateString() : '…'}`
          : '—',
    },
    { title: 'Papers', dataIndex: 'scheduleCount', align: 'right' },
    { title: 'Classes', dataIndex: 'classCount', align: 'right' },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<FileTextOutlined />} onClick={() => navigate(`/exam-results/${r.id}`)}>
            Results
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingExam(r);
              examForm.setFieldsValue(r);
              setFormError(null);
              setExamOpen(true);
            }}
          />
          <Popconfirm
            title="Remove this exam?"
            onConfirm={() =>
              submit(() => apiClient.delete(withId(API.examApi, r.id)), () => undefined)
            }
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const scheduleColumns: ColumnsType<Schedule> = [
    { title: 'Class', dataIndex: 'className', render: (v) => (v ? <Tag color="blue">{v}</Tag> : '—') },
    { title: 'Subject', dataIndex: 'subjectName', render: (v) => v || '—' },
    { title: 'Date', dataIndex: 'date', render: (v) => (v ? new Date(v).toLocaleDateString() : '—') },
    { title: 'Max', dataIndex: 'maxMarks', align: 'right' },
    { title: 'Pass', dataIndex: 'passMarks', align: 'right' },
    {
      title: 'Marks',
      dataIndex: 'marksEntered',
      align: 'right',
      render: (v: number) =>
        v > 0 ? <Tag color="green">{v} entered</Tag> : <Tag>Not entered</Tag>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" type="primary" onClick={() => navigate(`/marks-entry/${r.id}`)}>
            Enter marks
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingSched(r);
              schedForm.setFieldsValue({ ...r, standardLinkId: r.standardLinkId, subjectId: r.subjectId });
              setFormError(null);
              setSchedOpen(true);
            }}
          />
          <Popconfirm
            title="Remove this paper and its marks?"
            onConfirm={() =>
              submit(() => apiClient.delete(withId(API.examScheduleApi, r.id)), () => undefined)
            }
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const gradeColumns: ColumnsType<Grade> = [
    { title: 'Grade', dataIndex: 'name', render: (v) => <Tag color="blue">{v}</Tag> },
    { title: 'From %', dataIndex: 'minPercentage', align: 'right' },
    { title: 'To %', dataIndex: 'maxPercentage', align: 'right' },
    { title: 'Point', dataIndex: 'gradePoint', align: 'right', render: (v) => v ?? '—' },
    { title: 'Remarks', dataIndex: 'remarks', render: (v) => v || '—' },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingGrade(r);
              gradeForm.setFieldsValue(r);
              setFormError(null);
              setGradeOpen(true);
            }}
          />
          <Popconfirm
            title="Remove this grade band?"
            onConfirm={() =>
              submit(() => apiClient.delete(withId(API.gradeApi, r.id)), () => undefined)
            }
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Exams &amp; grading</Title>
          <Text type="secondary">Exams, papers, marks entry and the grading scale</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadAll}>Refresh</Button>
      </Flex>

      {error && <Alert type="error" showIcon message={error} />}

      <Tabs
        items={[
          {
            key: 'exams',
            label: `Exams (${exams.length})`,
            children: (
              <Card
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditingExam(null);
                      examForm.resetFields();
                      setFormError(null);
                      setExamOpen(true);
                    }}
                  >
                    New exam
                  </Button>
                }
              >
                <Table rowKey="id" loading={loading} columns={examColumns} dataSource={exams} scroll={{ x: 720 }} />
              </Card>
            ),
          },
          {
            key: 'schedules',
            label: 'Papers',
            children: (
              <Card
                title={
                  <Select
                    style={{ width: 280 }}
                    placeholder="Select exam"
                    value={selectedExam}
                    onChange={setSelectedExam}
                    options={exams.map((e) => ({ value: e.id, label: e.name }))}
                  />
                }
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!selectedExam}
                    onClick={() => {
                      setEditingSched(null);
                      schedForm.resetFields();
                      setFormError(null);
                      setSchedOpen(true);
                    }}
                  >
                    Add paper
                  </Button>
                }
              >
                {schedules.length === 0 ? (
                  <Empty description="No papers scheduled for this exam" />
                ) : (
                  <Table rowKey="id" columns={scheduleColumns} dataSource={schedules} scroll={{ x: 860 }} />
                )}
              </Card>
            ),
          },
          {
            key: 'grades',
            label: `Grading scale (${grades.length})`,
            children: (
              <Card
                title={
                  <Space wrap>
                    <Select
                      style={{ width: 320 }}
                      value={viewBoard}
                      onChange={async (b) => {
                        setViewBoard(b);
                        const g = await apiClient.get(API.gradesApi, { params: { board: b } });
                        setGrades(g.data.data);
                      }}
                      options={(boards?.configured ?? []).map((c: any) => ({
                        value: c.code,
                        label: `${c.label} (${c.bandCount})`,
                      }))}
                      placeholder="Select board"
                    />
                    {viewBoard === boards?.activeBoard ? (
                      <Tag color="green">Active for marksheets</Tag>
                    ) : (
                      <Button
                        size="small"
                        onClick={() =>
                          submit(
                            () => apiClient.post(API.gradeBoardActiveApi, { board: viewBoard }),
                            () => undefined
                          )
                        }
                      >
                        Use for marksheets
                      </Button>
                    )}
                  </Space>
                }
                extra={
                  <Space>
                    <Button onClick={() => setBoardPickerOpen(true)}>Add board scale</Button>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingGrade(null);
                        gradeForm.resetFields();
                        gradeForm.setFieldsValue({ board: viewBoard });
                        setFormError(null);
                        setGradeOpen(true);
                      }}
                    >
                      Add grade
                    </Button>
                  </Space>
                }
              >
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="One active board, non-overlapping bands"
                  description="Scales for several boards can coexist and their ranges overlap by design, so marksheets grade against the one board marked active. Within a board, overlapping bands are rejected — otherwise the same percentage would grade differently depending on row order."
                />
                <Table rowKey="id" columns={gradeColumns} dataSource={grades} pagination={false} scroll={{ x: 620 }} />
              </Card>
            ),
          },
        ]}
      />

      {/* Exam editor */}
      <Modal
        open={examOpen}
        title={editingExam ? 'Edit exam' : 'New exam'}
        onCancel={() => setExamOpen(false)}
        confirmLoading={saving}
        onOk={async () => {
          const v = await examForm.validateFields();
          await submit(
            () =>
              editingExam
                ? apiClient.put(withId(API.examApi, editingExam.id), v)
                : apiClient.post(API.examsApi, v),
            () => setExamOpen(false)
          );
        }}
      >
        {formError && <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />}
        <Form form={examForm} layout="vertical">
          <Form.Item name="name" label="Exam name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Term 1 Examination" maxLength={150} />
          </Form.Item>
          <Form.Item name="term" label="Term">
            <Input placeholder="e.g. Term 1" maxLength={50} />
          </Form.Item>
          <Form.Item name="startDate" label="Start date">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="endDate" label="End date">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Paper editor */}
      <Modal
        open={schedOpen}
        title={editingSched ? 'Edit paper' : 'Add paper'}
        onCancel={() => setSchedOpen(false)}
        confirmLoading={saving}
        onOk={async () => {
          const v = await schedForm.validateFields();
          const payload = { ...v, examId: selectedExam };
          await submit(
            () =>
              editingSched
                ? apiClient.put(withId(API.examScheduleApi, editingSched.id), payload)
                : apiClient.post(API.examSchedulesCreateApi, payload),
            () => setSchedOpen(false)
          );
        }}
      >
        {formError && <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />}
        <Form form={schedForm} layout="vertical">
          <Form.Item name="standardLinkId" label="Class" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={classes} disabled={!!editingSched} />
          </Form.Item>
          <Form.Item name="subjectId" label="Subject" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={subjects} />
          </Form.Item>
          <Form.Item name="date" label="Date">
            <Input type="date" />
          </Form.Item>
          <Space size={12}>
            <Form.Item name="maxMarks" label="Maximum marks" rules={[{ required: true }]}>
              <InputNumber min={1} max={1000} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="passMarks" label="Pass marks" rules={[{ required: true }]}>
              <InputNumber min={0} max={1000} style={{ width: 160 }} />
            </Form.Item>
          </Space>
          <Form.Item name="portion" label="Portion / syllabus">
            <Input.TextArea rows={2} maxLength={2000} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Board preset picker */}
      <Modal
        open={boardPickerOpen}
        title="Add a board grading scale"
        onCancel={() => setBoardPickerOpen(false)}
        footer={<Button onClick={() => setBoardPickerOpen(false)}>Close</Button>}
        width={720}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Check these against your board's current rules"
          description="These are starting points, not an authority. Boards revise pass marks and bands, and several grade differently by class or stream. Install the closest scale and edit it."
        />
        <Table
          rowKey="code"
          size="small"
          pagination={false}
          scroll={{ y: 360 }}
          dataSource={boards?.presets ?? []}
          columns={[
            { title: 'Board', dataIndex: 'label' },
            { title: 'Pass %', dataIndex: 'passMark', align: 'right', width: 80 },
            { title: 'Bands', dataIndex: 'bandCount', align: 'right', width: 70 },
            {
              title: '',
              key: 'a',
              align: 'right',
              width: 150,
              render: (_: any, r: any) => (
                <Button
                  size="small"
                  type={r.installed ? 'default' : 'primary'}
                  onClick={() =>
                    submit(
                      () => apiClient.post(API.gradeBoardApplyApi, { board: r.code }),
                      () => {
                        setViewBoard(r.code);
                        setBoardPickerOpen(false);
                      }
                    )
                  }
                >
                  {r.installed ? 'Reinstall' : 'Install'}
                </Button>
              ),
            },
          ]}
        />
      </Modal>

      {/* Grade editor */}
      <Modal
        open={gradeOpen}
        title={editingGrade ? 'Edit grade' : 'Add grade'}
        onCancel={() => setGradeOpen(false)}
        confirmLoading={saving}
        onOk={async () => {
          const v = await gradeForm.validateFields();
          await submit(
            () =>
              editingGrade
                ? apiClient.put(withId(API.gradeApi, editingGrade.id), v)
                : apiClient.post(API.gradesApi, v),
            () => setGradeOpen(false)
          );
        }}
      >
        {formError && <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />}
        <Form form={gradeForm} layout="vertical">
          <Form.Item name="board" label="Board" initialValue={viewBoard}>
            <Input disabled />
          </Form.Item>
          <Form.Item name="name" label="Grade" rules={[{ required: true }]}>
            <Input placeholder="e.g. A1" maxLength={20} />
          </Form.Item>
          <Space size={12}>
            <Form.Item name="minPercentage" label="From %" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} step={0.01} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="maxPercentage" label="To %" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} step={0.01} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="gradePoint" label="Grade point">
              <InputNumber min={0} max={10} step={0.1} style={{ width: 150 }} />
            </Form.Item>
          </Space>
          <Form.Item name="remarks" label="Remarks">
            <Input maxLength={255} placeholder="e.g. Outstanding" />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
};
