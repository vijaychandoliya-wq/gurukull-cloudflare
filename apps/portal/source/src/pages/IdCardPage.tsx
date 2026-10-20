import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Input,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  IdcardOutlined,
  PrinterOutlined,
  SearchOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { apiClient, API } from '../services/api';
import '../styles/print.css';

const { Text, Title, Paragraph } = Typography;

/**
 * Ported from gegok12/resources/assets/js/antd/pages/IdCardPage.jsx.
 *
 * Printing goes through window.print() against a dedicated print stylesheet
 * rather than generating a PDF server-side: the cards must come out at exactly
 * 85.6 x 54 mm on card stock, and the browser's own print pipeline is what the
 * school's existing workflow already targets.
 */

interface SchoolInfo {
  name: string;
  logo: string | null;
  address: string | null;
  board: string | null;
  academicYear: string | null;
}

interface ClassOption {
  value: string;
  label: string;
  studentCount: number;
}

interface IdCardStudent {
  id: string;
  fullName: string;
  avatar: string | null;
  className: string | null;
  rollNumber: string | null;
  registrationNumber: string | null;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  address: string | null;
  guardianContact: string | null;
  contactNumber: string | null;
  readyToPrint: boolean;
  missingFields: string[];
}

const initials = (name: string) =>
  (name || 'Student')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

const StudentIdCard: React.FC<{
  school: SchoolInfo;
  student: IdCardStudent;
  isTeacher?: boolean;
}> = ({ school, student, isTeacher }) => (
  <article className="gk-id-card" aria-label={`ID card for ${student.fullName}`}>
    <header className="gk-id-card-header">
      <Avatar shape="square" size={36} src={school.logo || undefined}>
        {initials(school.name)}
      </Avatar>
      <div className="gk-id-card-school">
        <strong>{school.name}</strong>
        <span>
          {isTeacher ? 'Staff' : 'Student'} identity card{school.academicYear ? ` · ${school.academicYear}` : ''}
        </span>
      </div>
    </header>

    <div className="gk-id-card-body">
      <div className="gk-id-card-photo" aria-label={`Photo of ${student.fullName}`}>
        <span>Photo unavailable</span>
        {student.avatar && (
          <img
            src={student.avatar}
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}
      </div>

      <div className="gk-id-card-details">
        <h3>{student.fullName}</h3>
        <div className="gk-id-card-grid">
          <span>{isTeacher ? 'Role' : 'Class'}</span>
          <strong>{student.className || '—'}</strong>
          <span>Roll no</span>
          <strong>{student.rollNumber || '—'}</strong>
          <span>{isTeacher ? 'Emp ID' : 'Admission'}</span>
          <strong>{student.registrationNumber || '—'}</strong>
          <span>DOB</span>
          <strong>
            {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '—'}
          </strong>
          <span>Blood</span>
          <strong>{student.bloodGroup || '—'}</strong>
          <span>Contact</span>
          <strong>{student.guardianContact || student.contactNumber || '—'}</strong>
        </div>
      </div>
    </div>

    <footer className="gk-id-card-footer">
      <span>{school.address || ''}</span>
      <strong>Authorized signature</strong>
    </footer>
  </article>
);

interface IdCardPageProps {
  /**
   * Teachers and students print on the same CR80 stock through the same
   * pipeline; only the source endpoint and the wording differ, so the page is
   * shared rather than duplicated.
   */
  variant?: 'student' | 'teacher' | 'staff';
}

export const IdCardPage: React.FC<IdCardPageProps> = ({ variant = 'student' }) => {
  const isStudent = variant === 'student';
  // Teachers and staff share the same card shape (photo, role, employee id);
  // only students carry a class and roll number.
  const isTeacher = !isStudent;
  const subjectLabel = variant === 'staff' ? 'staff member' : variant;
  const listApi =
    variant === 'teacher'
      ? API.teacherIdCardStudentsApi
      : variant === 'staff'
        ? API.staffIdCardStudentsApi
        : API.idCardStudentsApi;
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<IdCardStudent[]>([]);
  const [standard, setStandard] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<React.Key[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await apiClient.get(API.idCardOptionsApi);
        setSchool(response.data.data.school);
        setClasses(response.data.data.classes);
      } catch (requestError: any) {
        setError(requestError.response?.data?.message || 'ID card options could not be loaded.');
      } finally {
        setOptionsLoading(false);
      }
    })();
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(listApi, {
        params: {
          ...(!isTeacher && standard ? { standard } : {}),
          ...(search ? { q: search } : {}),
        },
      });
      setStudents(response.data.data);
      setSelectedIds([]);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Students could not be loaded.');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [standard, search, listApi, isTeacher]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const schoolReady=!!school?.address&&!!school?.academicYear;
  const readyCount = useMemo(() => schoolReady?students.filter((s) => s.readyToPrint).length:0, [students,schoolReady]);
  const incompleteCount = students.length - readyCount;

  const previewStudents = useMemo(
    () =>
      selectedIds.length
        ? students.filter((s) => selectedIds.includes(s.id))
        : students,
    [students, selectedIds]
  );

  const columns: ColumnsType<IdCardStudent> = [
    {
      title: variant === 'staff' ? 'Staff member' : variant === 'teacher' ? 'Teacher' : 'Student',
      dataIndex: 'fullName',
      render: (_, record) => (
        <Space>
          <Avatar src={record.avatar || undefined}>{initials(record.fullName)}</Avatar>
          <div>
            <div>{record.fullName}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.registrationNumber || (isTeacher ? 'No employee id' : 'No admission number')}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: isTeacher ? 'Designation' : 'Class',
      dataIndex: 'className',
      render: (v: string | null) => (v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text>),
    },
    ...(isTeacher
      ? []
      : [{ title: 'Roll no', dataIndex: 'rollNumber', render: (v: string | null) => v || '—' }]),
    {
      title: '',
      key: 'print',
      align: 'right',
      render: (_, record) => (
        <Button
          size="small"
          icon={<PrinterOutlined />}
          onClick={() => {
            // Selecting the row first means the preview sheet contains exactly
            // this card, so window.print() emits one card rather than the
            // whole filtered batch.
            setSelectedIds([record.id]);
            setPreviewOpen(true);
          }}
        >
          Print
        </Button>
      ),
    },
    {
      title: 'Card status',
      key: 'status',
      render: (_, record) =>
        record.readyToPrint ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>Ready to print</Tag>
        ) : (
          <Tag color="orange" icon={<WarningOutlined />}>
            Missing {record.missingFields.join(', ')}
          </Tag>
        ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {variant === 'staff' ? 'Staff ID cards' : variant === 'teacher' ? 'Teacher ID cards' : 'Student ID cards'}
          </Title>
          <Text type="secondary">
            Review card data, preview the exact layout and print selected {subjectLabel}s
          </Text>
        </div>
        <Space>
          <Button
            icon={<IdcardOutlined />}
            disabled={!previewStudents.length}
            onClick={() => setPreviewOpen(true)}
          >
            Preview &amp; print{selectedIds.length ? ` (${selectedIds.length})` : ''}
          </Button>
        </Space>
      </Flex>

      {error && <Alert type="error" showIcon message={error} />}
      {!schoolReady&&<Alert type="warning" showIcon message="Save the actual school address and current academic year before final printing."/>}
      <Alert type="info" message="Cards use actual admission/employee numbers. Photo and school-logo uploads are separate; absent photos remain visibly blank."/>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={8}>
          <Card><Statistic title={variant === 'staff' ? 'Staff' : variant === 'teacher' ? 'Teachers' : 'Students'} value={students.length} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col xs={12} md={8}>
          <Card>
            <Statistic title="Ready to print" value={readyCount} valueStyle={{ color: '#16a34a' }} />
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card>
            <Statistic
              title="Incomplete"
              value={incompleteCount}
              valueStyle={{ color: incompleteCount ? '#d97706' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          {!isTeacher && (
          <Select
            allowClear
            loading={optionsLoading}
            placeholder="All classes"
            style={{ width: 240 }}
            value={standard}
            onChange={setStandard}
            options={classes.map((c) => ({
              value: c.value,
              label: `${c.label} (${c.studentCount})`,
            }))}
          />
          )}
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={isTeacher ? 'Search name or employee id' : 'Search name, admission or roll no'}
            style={{ width: 300 }}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Space>

        {incompleteCount > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={`${incompleteCount} ${subjectLabel}(s) have incomplete card data`}
            description={`You can still preview them, but update the ${subjectLabel} profile before final printing — missing fields print blank.`}
          />
        )}

        <Table<IdCardStudent>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={students}
          scroll={{ x: 720 }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: setSelectedIds,
          }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>

      <Modal
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        width={840}
        title="ID card preview"
        footer={[
          <Button key="close" onClick={() => setPreviewOpen(false)}>Close</Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            disabled={!schoolReady||!previewStudents.length||previewStudents.some(s=>!s.readyToPrint)}
            onClick={() => window.print()}
          >
            Print {previewStudents.length} card(s)
          </Button>,
        ]}
      >
        <Alert
          type="info"
          showIcon
          className="gk-id-print-note"
          style={{ marginBottom: 16 }}
          message="Print layout"
          description="The print view uses standard 85.6 × 54 mm cards, 8 per A4 sheet, and removes the admin navigation automatically."
        />

        {previewStudents.length === 0 ? (
          <Empty description={`No ${subjectLabel}s selected`} />
        ) : (
          <div className="gk-id-print-sheet">
            {school &&
              previewStudents.map((student) => (
                <StudentIdCard key={student.id} school={school} student={student} isTeacher={isTeacher} />
              ))}
          </div>
        )}
      </Modal>
    </Flex>
  );
};
