import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  List,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EyeOutlined,
  PlusOutlined,
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient, API, withId } from '../services/api';
import {PersonFormDrawer} from '../components/PersonFormDrawer';

const { Title, Text } = Typography;

/**
 * Ported from the production admin screen
 * (gegok12/resources/assets/js/antd/pages/StudentsPage.jsx).
 *
 * Server-side pagination, search and filtering are preserved deliberately: the
 * live school has ~2,400 students, so the previous client-side filter over a
 * hardcoded array was not a smaller version of this screen, it was a different
 * screen that could never work against real data.
 */

interface StudentRow {
  id: number;
  name: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  registrationNumber: string | null;
  avatar: string;
  gender: string | null;
  status: string;
  className: string | null;
  standardLinkId: number | null;
  rollNo: string | null;
}

interface StudentDetail extends StudentRow {
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  address?: string | null;
  aadhaarNumber?: string | null;
  rollNumber?: string | null;
  academicYear?: string | null;
  transportMode?: string | null;
  parents?: Array<{
    id: number;
    name: string;
    email: string | null;
    mobile: string | null;
    relation: string | null;
    isPrimary: boolean;
  }>;
}

interface Filters {
  status?: string;
  gender?: string;
  blood_group?: string;
}

const initialFilters: Filters = { status: 'active' };

const statusColor: Record<string, string> = {
  active: 'green',
  inactive: 'orange',
  exit: 'red',
  unknown: 'default',
};

export const StudentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [personFormOpen,setPersonFormOpen]=useState(false);
  const [form] = Form.useForm<Filters>();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [meta, setMeta] = useState({ currentPage: 1, perPage: 20, total: 0 });
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(
        ([key, value]) => value && !(key === 'status' && value === 'active')
      ).length,
    [filters]
  );

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page: meta.currentPage,
        per_page: meta.perPage,
        ...(query ? { q: query } : {}),
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      };

      const response = await apiClient.get(API.studentListApi, { params });
      setStudents(response.data.data);
      setMeta((current) => ({ ...current, ...response.data.meta }));
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message || 'Students could not be loaded.'
      );
      setStudents([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, meta.currentPage, meta.perPage, query, reloadKey]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Debounce typing so each keystroke does not hit the API.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput);
      setMeta((current) => ({ ...current, currentPage: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const openStudentDetail = async (student: StudentRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setStudentDetail(null);

    try {
      const response = await apiClient.get(withId(API.studentDetailApi, student.id));
      setStudentDetail(response.data.data);
    } catch (requestError: any) {
      setDetailError(
        requestError.response?.data?.message || 'Student details could not be loaded.'
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const applyFilters = () => {
    const values = form.getFieldsValue();
    setFilters(
      Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== undefined && v !== null && v !== '')
      )
    );
    setMeta((current) => ({ ...current, currentPage: 1 }));
    setFilterOpen(false);
  };

  const resetFilters = () => {
    form.setFieldsValue(initialFilters);
    setFilters(initialFilters);
    setMeta((current) => ({ ...current, currentPage: 1 }));
    setFilterOpen(false);
  };

  const columns: ColumnsType<StudentRow> = [
    {
      title: 'Student',
      dataIndex: 'name',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto' }}
              onClick={() => navigate(`/students/${record.id}`)}
            >
              {record.fullName || record.name}
            </Button>
            <div style={{ fontSize: 12, color: '#667085' }}>
              {record.registrationNumber ? `Adm: ${record.registrationNumber}` : record.email || '—'}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Class',
      dataIndex: 'className',
      render: (value: string | null) => (value ? <Tag color="blue">{value}</Tag> : <Text type="secondary">Not assigned</Text>),
    },
    { title: 'Roll no', dataIndex: 'rollNo', render: (v: string | null) => v || '—' },
    { title: 'Gender', dataIndex: 'gender', render: (v: string | null) => v || '—' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (value: string) => <Tag color={statusColor[value] || 'default'}>{value}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => openStudentDetail(record)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <PersonFormDrawer open={personFormOpen} kind="students" onClose={()=>setPersonFormOpen(false)} onSaved={()=>setReloadKey(k=>k+1)}/>
      <Alert type="info" showIcon message="Student management" description="Enter school settings and the actual academic year, classes and sections before adding students." />
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Students</Title>
          <Text type="secondary">
            {loading ? 'Loading…' : `${meta.total.toLocaleString()} students`}
          </Text>
        </div>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={()=>setPersonFormOpen(true)}>New student</Button>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search name, email, mobile, admission no"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 320 }}
          />
          <Button
            icon={<FilterOutlined />}
            onClick={() => {
              form.setFieldsValue(filters);
              setFilterOpen(true);
            }}
          >
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => setReloadKey((k) => k + 1)}>
            Refresh
          </Button>
        </Space>
      </Flex>

      {error && <Alert type="error" showIcon message={error} />}

      <Card>
        <Table<StudentRow>
          rowKey="id"
          columns={columns}
          dataSource={students}
          loading={loading}
          scroll={{ x: 720 }}
          pagination={{
            current: meta.currentPage,
            pageSize: meta.perPage,
            total: meta.total,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            showTotal: (total, range) => `${range[0]}–${range[1]} of ${total.toLocaleString()}`,
            onChange: (page, pageSize) =>
              setMeta((current) => ({ ...current, currentPage: page, perPage: pageSize })),
          }}
        />
      </Card>

      <Drawer
        title="Filter students"
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        extra={
          <Space>
            <Button onClick={resetFilters}>Reset</Button>
            <Button type="primary" onClick={applyFilters}>Apply</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={initialFilters}>
          <Form.Item name="status" label="Status">
            <Select
              allowClear
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                
                { value: 'all', label: 'All' },
              ]}
            />
          </Form.Item>
          <Form.Item name="gender" label="Gender">
            <Select
              allowClear
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </Form.Item>
          <Form.Item name="blood_group" label="Blood group">
            <Select
              allowClear
              options={['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((v) => ({
                value: v,
                label: v,
              }))}
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/*
        Quick view mirrors the production modal: a glance at the record with
        Close / Edit / Full profile, rather than a drawer that dead-ends.
      */}
      <Modal
        title="Student quick view"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={820}
        destroyOnHidden
        footer={
          studentDetail
            ? [
                <Button key="close" onClick={() => setDetailOpen(false)}>Close</Button>,
                <Button key="edit" onClick={() => navigate(`/students/${studentDetail.id}?edit=1`)}>Edit</Button>,
                <Button
                  key="profile"
                  type="primary"
                  onClick={() => navigate(`/students/${studentDetail.id}`)}
                >
                  Full profile
                </Button>,
              ]
            : [<Button key="close" onClick={() => setDetailOpen(false)}>Close</Button>]
        }
      >
        {detailError && <Alert type="error" showIcon message={detailError} />}
        {detailLoading && <Card loading />}
        {!detailLoading && studentDetail && (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Flex align="center" gap={16}>
              <Avatar size={72} src={studentDetail.avatar || undefined} icon={<UserOutlined />} />
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  {studentDetail.fullName || studentDetail.name}
                </Title>
                <Space wrap>
                  <Tag color={statusColor[studentDetail.status] || 'default'}>
                    {studentDetail.status?.toUpperCase()}
                  </Tag>
                  <Text type="secondary">{studentDetail.className || 'Class not assigned'}</Text>
                </Space>
              </div>
            </Flex>

            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Admission no.">{studentDetail.registrationNumber || '—'}</Descriptions.Item>
              <Descriptions.Item label="Roll no.">{studentDetail.rollNumber || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{studentDetail.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Mobile">{studentDetail.mobile || '—'}</Descriptions.Item>
              <Descriptions.Item label="Date of birth">
                {studentDetail.dateOfBirth ? new Date(studentDetail.dateOfBirth).toLocaleDateString() : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Blood group">{studentDetail.bloodGroup || '—'}</Descriptions.Item>
              <Descriptions.Item label="Academic year">{studentDetail.academicYear || '—'}</Descriptions.Item>
              <Descriptions.Item label="Transport">{studentDetail.transportMode || '—'}</Descriptions.Item>
              <Descriptions.Item label="Address" span={2}>{studentDetail.address || '—'}</Descriptions.Item>
            </Descriptions>

            <div>
              <Title level={5}>Parents and guardians</Title>
              {studentDetail.parents?.length ? (
                <List
                  bordered
                  dataSource={studentDetail.parents}
                  renderItem={(parent) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={<UserOutlined />} />}
                        title={[parent.name, parent.relation].filter(Boolean).join(' · ')}
                        description={
                          [parent.email, parent.mobile].filter(Boolean).join(' · ') ||
                          'No contact details'
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No parent linked" />
              )}
            </div>
          </Space>
        )}
      </Modal>
    </Flex>
  );
};
