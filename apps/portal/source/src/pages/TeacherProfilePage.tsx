import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Row,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  EditOutlined,
  IdcardOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { apiClient, API, withId } from '../services/api';
import { TeacherFormDrawer } from '../components/TeacherFormDrawer';

const { Text, Title } = Typography;

/** Ported from gegok12/resources/assets/js/antd/pages/TeacherProfilePage.jsx. */

const statusColor: Record<string, string> = {
  active: 'green',
  inactive: 'orange',
  exit: 'red',
};

const show = (value: unknown) =>
  value === null || value === undefined || value === '' ? '—' : String(value);

interface Assignment {
  className: string | null;
  subject: string | null;
  periods: number | null;
}

interface Teacher {
  id: number;
  name: string;
  fullName: string;
  avatar: string;
  employeeId: string | null;
  email: string | null;
  mobile: string | null;
  alternateMobile: string | null;
  gender: string | null;
  status: string;
  designationLabel: string | null;
  jobTypeLabel: string | null;
  subDesignationLabel: string | null;
  subDesignation: string | null;
  qualification: string | null;
  jobType: string | null;
  specialization: string | null;
  interestedIn: string | null;
  ugDegree: string | null;
  pgDegree: string | null;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  address: string | null;
  joiningDate: string | null;
  reportingTo: string | null;
  classes: string[];
  assignments: Assignment[];
}

const assignmentColumns: ColumnsType<Assignment> = [
  {
    title: 'Class',
    dataIndex: 'className',
    render: (v: string | null) => (v ? <Tag color="blue">{v}</Tag> : '—'),
  },
  { title: 'Subject', dataIndex: 'subject', render: (v) => show(v) },
  { title: 'Periods', dataIndex: 'periods', render: (v) => show(v) },
];

export const TeacherProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const loadTeacher = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(withId(API.teacherDetailApi, id));
      setTeacher(response.data.data);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Teacher profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTeacher();
  }, [loadTeacher]);

  const tabs = teacher
    ? [
        {
          key: 'overview',
          label: 'Overview',
          children: (
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Card title="Employment">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Employee ID">{show(teacher.employeeId)}</Descriptions.Item>
                    <Descriptions.Item label="Designation">{show(teacher.designationLabel)}</Descriptions.Item>
                    <Descriptions.Item label="Sub-designation">{show(teacher.subDesignationLabel || teacher.subDesignation)}</Descriptions.Item>
                    <Descriptions.Item label="Job type">{show(teacher.jobTypeLabel || teacher.jobType)}</Descriptions.Item>
                    <Descriptions.Item label="Reports to">{show(teacher.reportingTo)}</Descriptions.Item>
                    <Descriptions.Item label="Joined">
                      {teacher.joiningDate ? new Date(teacher.joiningDate).toLocaleDateString() : '—'}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card title="Qualification and contact">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Qualification">{show(teacher.qualification)}</Descriptions.Item>
                    <Descriptions.Item label="UG degree">{show(teacher.ugDegree)}</Descriptions.Item>
                    <Descriptions.Item label="PG degree">{show(teacher.pgDegree)}</Descriptions.Item>
                    <Descriptions.Item label="Specialization">{show(teacher.specialization)}</Descriptions.Item>
                    <Descriptions.Item label="Email">{show(teacher.email)}</Descriptions.Item>
                    <Descriptions.Item label="Mobile">{show(teacher.mobile)}</Descriptions.Item>
                    <Descriptions.Item label="Alternate">{show(teacher.alternateMobile)}</Descriptions.Item>
                    <Descriptions.Item label="Date of birth">
                      {teacher.dateOfBirth ? new Date(teacher.dateOfBirth).toLocaleDateString() : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Blood group">{show(teacher.bloodGroup)}</Descriptions.Item>
                    <Descriptions.Item label="Address">{show(teacher.address)}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>
          ),
        },
        {
          key: 'classes',
          label: `Classes & subjects (${teacher.assignments.length})`,
          children: (
            <Card>
              {teacher.assignments.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No classes assigned"
                />
              ) : (
                <Table
                  rowKey={(row) => `${row.className}-${row.subject}`}
                  columns={assignmentColumns}
                  dataSource={teacher.assignments}
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 520 }}
                />
              )}
            </Card>
          ),
        },
      ]
    : [];

  return (
    <Flex vertical gap={16}>
      <div>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          style={{ paddingLeft: 0 }}
          onClick={() => navigate('/teachers')}
        >
          Back to teachers
        </Button>
        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Teacher profile</Title>
            <Text type="secondary">Employment, qualification and teaching load</Text>
          </div>
          <Button type="primary" icon={<EditOutlined />} onClick={() => setEditOpen(true)}>Edit teacher</Button>
        </Flex>
      </div>

      {error && <Alert type="error" showIcon message={error} />}
      {loading && <Card><Skeleton active avatar paragraph={{ rows: 4 }} /></Card>}

      <TeacherFormDrawer
        open={editOpen}
        mode="edit"
        teacherId={id ? Number(id) : null}
        onClose={() => setEditOpen(false)}
        onSaved={loadTeacher}
      />

      {!loading && teacher && (
        <>
          <Card>
            <Flex align="center" justify="space-between" wrap="wrap" gap={20}>
              <Flex align="center" gap={18}>
                <Avatar size={88} icon={<UserOutlined />} />
                <div>
                  <Title level={3} style={{ margin: 0 }}>{teacher.fullName}</Title>
                  <Space wrap>
                    <Tag color={statusColor[teacher.status] || 'default'}>
                      {teacher.status?.toUpperCase()}
                    </Tag>
                    <Text>{show(teacher.designationLabel)}</Text>
                    <Text type="secondary">Employee {show(teacher.employeeId)}</Text>
                  </Space>
                  <div>
                    <Text type="secondary">
                      {show(teacher.email)} · {show(teacher.mobile)}
                    </Text>
                  </div>
                  {teacher.classes.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <Space wrap size={[4, 4]}>
                        {teacher.classes.slice(0, 8).map((c) => (
                          <Tag key={c}>{c}</Tag>
                        ))}
                        {teacher.classes.length > 8 && (
                          <Text type="secondary">+{teacher.classes.length - 8} more</Text>
                        )}
                      </Space>
                    </div>
                  )}
                </div>
              </Flex>
              <Button icon={<IdcardOutlined />} onClick={() => navigate('/teacher-id-cards')}>
                ID cards
              </Button>
            </Flex>
          </Card>

          <Card>
            <Tabs items={tabs} />
          </Card>
        </>
      )}
    </Flex>
  );
};
