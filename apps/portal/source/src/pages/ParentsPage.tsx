import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Tag,
  Space,
  Modal,
  Form,
  Avatar,
  Typography,
  Descriptions,
  Row,
  Col,
  Statistic,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UserOutlined,
  SearchOutlined,
  PhoneOutlined,
  MailOutlined,
  EyeOutlined,
  PlusOutlined,
  KeyOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface ParentProfile {
  key: string;
  id: number;
  name: string;
  relation: string;
  mobile: string;
  email: string;
  occupation: string;
  address: string;
  linkedStudents: Array<{ name: string; standard: string; admissionNo: string }>;
  eklavyaAppStatus: 'Active' | 'Invited' | 'Inactive';
}

const initialParents: ParentProfile[] = [
  {
    key: '1',
    id: 1,
    name: 'Vikram Malhotra',
    relation: 'Father',
    mobile: '+91 98765 43203',
    email: 'vikram.m@gmail.com',
    occupation: 'Chartered Accountant',
    address: '14, Palm Avenue, Civil Lines, Jaipur',
    linkedStudents: [
      { name: 'Aarav Malhotra', standard: 'Grade 1 - A', admissionNo: 'GW-2026-001' },
      { name: 'Riya Malhotra', standard: 'Grade 6 - B', admissionNo: 'GW-2021-089' },
    ],
    eklavyaAppStatus: 'Active',
  },
  {
    key: '2',
    id: 2,
    name: 'Rohan Sharma',
    relation: 'Father',
    mobile: '+91 98765 43211',
    email: 'rohan.s@gmail.com',
    occupation: 'Architect',
    address: 'B-42, Mansarovar Extension, Jaipur',
    linkedStudents: [
      { name: 'Ananya Sharma', standard: 'Grade 1 - A', admissionNo: 'GW-2026-002' },
    ],
    eklavyaAppStatus: 'Active',
  },
  {
    key: '3',
    id: 3,
    name: 'Siddharth Patel',
    relation: 'Father',
    mobile: '+91 98765 43212',
    email: 'siddharth.p@gmail.com',
    occupation: 'Civil Engineer',
    address: '22, Vaishali Nagar, Jaipur',
    linkedStudents: [
      { name: 'Kabir Patel', standard: 'Grade 1 - A', admissionNo: 'GW-2026-003' },
    ],
    eklavyaAppStatus: 'Invited',
  },
];

export const ParentsPage: React.FC = () => {
  const [parents, setParents] = useState<ParentProfile[]>(initialParents);
  const [search, setSearch] = useState('');
  const [selectedParent, setSelectedParent] = useState<ParentProfile | null>(null);

  const columns: ColumnsType<ParentProfile> = [
    {
      title: 'Parent / Guardian',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <Avatar style={{ backgroundColor: '#0A2540' }}>{name.charAt(0)}</Avatar>
          <div>
            <Text strong>{name}</Text> ({record.relation})
            <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
              {record.occupation}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Contact Details',
      key: 'contact',
      render: (_, r) => (
        <div>
          <div><PhoneOutlined /> {r.mobile}</div>
          <Text type="secondary" style={{ fontSize: 11 }}><MailOutlined /> {r.email}</Text>
        </div>
      ),
    },
    {
      title: 'Linked Children (Eklavya)',
      key: 'children',
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          {r.linkedStudents.map((child, idx) => (
            <Tag color="blue" key={idx}>
              <strong>{child.name}</strong> ({child.standard})
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Eklavya Portal Status',
      dataIndex: 'eklavyaAppStatus',
      key: 'eklavyaAppStatus',
      align: 'center',
      render: (st) => (
        <Tag color={st === 'Active' ? 'green' : st === 'Invited' ? 'gold' : 'default'}>
          {st}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedParent(r)}>
            Details
          </Button>
          <Button
            size="small"
            icon={<KeyOutlined />}
            onClick={() => message.success(`Reset credentials SMS sent to ${r.mobile}`)}
          >
            Send OTP
          </Button>
        </Space>
      ),
    },
  ];

  const filtered = parents.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.mobile.includes(search) ||
      p.linkedStudents.some((c) => c.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false}>
            <Statistic title="REGISTERED PARENTS" value={1320} suffix="Guardians" />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false}>
            <Statistic title="ACTIVE EKLAVYA USERS" value={1185} suffix="Mobile App Active" valueStyle={{ color: '#10B981' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false}>
            <Statistic title="MULTI-CHILD SIBLINGS" value={240} suffix="Families" />
          </Card>
        </Col>
      </Row>

      <Card
        title={<Title level={5} style={{ margin: 0 }}>Parents & Guardians Directory (Eklavya Mobile Sync)</Title>}
        bordered={false}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input
            placeholder="Search parent name, mobile, or child name..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 340 }}
            allowClear
          />
        </div>

        <Table columns={columns} dataSource={filtered} pagination={{ pageSize: 6 }} />
      </Card>

      {/* Parent Details Modal */}
      <Modal
        title="Parent & Family Comprehensive Details"
        open={!!selectedParent}
        onCancel={() => setSelectedParent(null)}
        footer={null}
        width={600}
      >
        {selectedParent && (
          <Descriptions bordered column={1} size="small" style={{ marginTop: 12 }}>
            <Descriptions.Item label="Full Name">{selectedParent.name} ({selectedParent.relation})</Descriptions.Item>
            <Descriptions.Item label="Occupation">{selectedParent.occupation}</Descriptions.Item>
            <Descriptions.Item label="Mobile Number">{selectedParent.mobile}</Descriptions.Item>
            <Descriptions.Item label="Email Address">{selectedParent.email}</Descriptions.Item>
            <Descriptions.Item label="Residential Address">{selectedParent.address}</Descriptions.Item>
            <Descriptions.Item label="Linked Wards / Students">
              {selectedParent.linkedStudents.map((child, i) => (
                <div key={i} style={{ margin: '4px 0' }}>
                  <Text strong>{child.name}</Text> • {child.standard} • Adm: <Text code>{child.admissionNo}</Text>
                </div>
              ))}
            </Descriptions.Item>
            <Descriptions.Item label="Eklavya App Sync">
              <Tag color="green">Push Notifications Enabled</Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};
