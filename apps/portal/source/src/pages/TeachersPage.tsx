import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Drawer } from 'antd';
import { apiClient, API } from '../services/api';
import { TeacherFormDrawer } from '../components/TeacherFormDrawer';
import {AuthenticatedAvatar} from '../components/UserAvatar';

const { Title, Text } = Typography;

/**
 * Ported from gegok12/resources/assets/js/antd/pages/TeachersPage.jsx.
 * Columns follow the production layout: Teacher, Role & qualification,
 * Contact, Gender, Status, Actions.
 */

interface TeacherRow {
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
  designation: string | null;
  designationLabel: string | null;
  qualification: string | null;
  jobType: string | null;
  specialization: string | null;
}

interface Filters {
  status?: string;
  gender?: string;
  job_type?: string;
}

const initialFilters: Filters = { status: 'active' };

const statusColor: Record<string, string> = {
  active: 'green',
  inactive: 'orange',
  exit: 'red',
  unknown: 'default',
};

export const TeachersPage: React.FC = () => {
  const navigate = useNavigate();
  const [urlQuery,setUrlQuery]=useSearchParams();
  const [form] = Form.useForm<Filters>();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [meta, setMeta] = useState({ currentPage: 1, perPage: 20, total: 0 });
  const [query, setQuery] = useState(urlQuery.get('q')||'');
  const [searchInput, setSearchInput] = useState(urlQuery.get('q')||'');
  useEffect(()=>{setSearchInput(urlQuery.get('q')||'');},[urlQuery]);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formTeacherId, setFormTeacherId] = useState<number | null>(null);

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(
        ([key, value]) => value && !(key === 'status' && value === 'active')
      ).length,
    [filters]
  );

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(API.teacherListApi, {
        params: {
          page: meta.currentPage,
          per_page: meta.perPage,
          ...(query ? { q: query } : {}),
          ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
        },
      });
      setTeachers(response.data.data);
      setMeta((current) => ({ ...current, ...response.data.meta }));
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Teachers could not be loaded.');
      setTeachers([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, meta.currentPage, meta.perPage, query, reloadKey]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput);
      setUrlQuery(current=>{const next=new URLSearchParams(current);if(searchInput)next.set('q',searchInput);else next.delete('q');return next;},{replace:true});
      setMeta((current) => ({ ...current, currentPage: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

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

  const columns: ColumnsType<TeacherRow> = [
    {
      title: 'Teacher',
      dataIndex: 'fullName',
      render: (_, record) => (
        <Space>
          <AuthenticatedAvatar name={record.fullName || record.name} src={record.avatar} />
          <div>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto' }}
              onClick={() => navigate(`/teachers/${record.id}`)}
            >
              {record.fullName || record.name}
            </Button>
            <div style={{ fontSize: 12, color: 'var(--gk-text-secondary)' }}>
              {record.employeeId ? `Emp: ${record.employeeId}` : record.email || '—'}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role & qualification',
      key: 'role',
      render: (_, record) => (
        <div>
          {record.designationLabel ? (
            <Tag color="blue">{record.designationLabel}</Tag>
          ) : (
            <Text type="secondary">—</Text>
          )}
          <div style={{ fontSize: 12, color: 'var(--gk-text-secondary)' }}>
            {record.qualification || record.specialization || '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record) => (
        <div>
          <div>{record.mobile || '—'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.email || '—'}
          </Text>
        </div>
      ),
    },
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
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setFormMode('edit');
              setFormTeacherId(record.id);
              setFormOpen(true);
            }}
          />
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/teachers/${record.id}`)}
          >
            View
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Alert type="info" showIcon message="Teacher management" description="Create and edit real teacher records after configuring school settings and the current academic year." />
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Teachers</Title>
          <Text type="secondary">
            {loading ? 'Loading…' : `${meta.total.toLocaleString()} teachers`}
          </Text>
        </div>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search name, email, employee id, specialization"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 340 }}
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
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setFormMode('create');
              setFormTeacherId(null);
              setFormOpen(true);
            }}
          >
            New teacher
          </Button>
        </Space>
      </Flex>

      {error && <Alert type="error" showIcon message={error} />}

      <Card>
        <Table<TeacherRow>
          rowKey="id"
          columns={columns}
          dataSource={teachers}
          loading={loading}
          scroll={{ x: 820 }}
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

      <TeacherFormDrawer
        open={formOpen}
        mode={formMode}
        teacherId={formTeacherId}
        onClose={() => setFormOpen(false)}
        onSaved={() => setReloadKey((k) => k + 1)}
      />

      <Drawer
        title="Filter teachers"
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
                { value: 'exit', label: 'Exited' },
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
          <Form.Item name="job_type" label="Job type">
            <Select
              allowClear
              options={[
                { value: 'full_time', label: 'Full time' },
                { value: 'part_time', label: 'Part time' },
                { value: 'contract', label: 'Contract' },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </Flex>
  );
};
