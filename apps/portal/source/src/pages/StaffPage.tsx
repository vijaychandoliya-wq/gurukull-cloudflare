import React, { useState } from 'react';
import { Card, Table, Button, Input, Tag, Space, Modal, Form, Avatar, Typography, Row, Col, Statistic, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UserAddOutlined, SearchOutlined, PhoneOutlined, MailOutlined, IdcardOutlined, PrinterOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface StaffItem {
  key: string;
  id: number;
  empCode: string;
  name: string;
  department: string;
  designation: string;
  mobile: string;
  email: string;
  qualification: string;
  experienceYears: number;
  joinDate: string;
  status: 'active' | 'inactive';
}

const initialStaff: StaffItem[] = [
  { key: '1', id: 1, empCode: 'EMP-001', name: 'Dr. Rajesh Sharma', department: 'Administration', designation: 'School Principal & Lead', mobile: '+91 98765 00001', email: 'principal@greenwood.edu', qualification: 'Ph.D in Education, M.Sc Physics', experienceYears: 18, joinDate: '2015-06-01', status: 'active' },
  { key: '2', id: 2, empCode: 'EMP-012', name: 'Sunita Verma', department: 'Mathematics Department', designation: 'Senior Faculty & HOD', mobile: '+91 98765 00012', email: 'sunita.verma@greenwood.edu', qualification: 'M.Sc Mathematics, B.Ed', experienceYears: 12, joinDate: '2018-04-15', status: 'active' },
  { key: '3', id: 3, empCode: 'EMP-014', name: 'Ramesh Gupta', department: 'Science Department', designation: 'Senior Faculty & Lab Incharge', mobile: '+91 98765 00014', email: 'ramesh.g@greenwood.edu', qualification: 'M.Sc Chemistry, B.Ed', experienceYears: 10, joinDate: '2019-06-10', status: 'active' },
  { key: '4', id: 4, empCode: 'EMP-020', name: 'Priya Mehta', department: 'English Department', designation: 'Senior Faculty', mobile: '+91 98765 00020', email: 'priya.m@greenwood.edu', qualification: 'M.A English Literature, B.Ed', experienceYears: 8, joinDate: '2020-08-01', status: 'active' },
  { key: '5', id: 5, empCode: 'EMP-033', name: 'Vikas Mathur', department: 'Finance & Accounts', designation: 'Chief Finance Officer', mobile: '+91 98765 00033', email: 'accounts@greenwood.edu', qualification: 'Chartered Accountant (FCA), B.Com', experienceYears: 14, joinDate: '2017-02-10', status: 'active' },
];

export const StaffPage: React.FC = () => {
  const [staffList, setStaffList] = useState<StaffItem[]>(initialStaff);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIDCardStaff, setSelectedIDCardStaff] = useState<StaffItem | null>(null);
  const [form] = Form.useForm();

  const handleCreate = (values: any) => {
    const newEmp: StaffItem = {
      key: String(staffList.length + 1),
      id: staffList.length + 1,
      empCode: `EMP-0${staffList.length + 1}`,
      name: values.name,
      department: values.department,
      designation: values.designation,
      mobile: values.mobile,
      email: values.email,
      qualification: values.qualification || 'M.A / M.Sc, B.Ed',
      experienceYears: Number(values.experienceYears) || 5,
      joinDate: new Date().toISOString().split('T')[0],
      status: 'active',
    };
    setStaffList([...staffList, newEmp]);
    setIsModalOpen(false);
    form.resetFields();
    message.success(`Staff member ${newEmp.name} (${newEmp.empCode}) enrolled!`);
  };

  const columns: ColumnsType<StaffItem> = [
    {
      title: 'Employee',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <Avatar style={{ backgroundColor: '#0A2540' }}>{name.charAt(0)}</Avatar>
          <div>
            <Text strong>{name}</Text>
            <div style={{ fontSize: 11, color: '#64748B' }}>Code: <Text code>{record.empCode}</Text></div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Department & Role',
      key: 'dept',
      render: (_, r) => (
        <div>
          <Text strong>{r.designation}</Text>
          <div style={{ fontSize: 11, color: '#64748B' }}>{r.department}</div>
        </div>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, r) => (
        <div>
          <div><PhoneOutlined /> {r.mobile}</div>
          <Text type="secondary" style={{ fontSize: 11 }}><MailOutlined /> {r.email}</Text>
        </div>
      ),
    },
    { title: 'Qualification', dataIndex: 'qualification', key: 'qualification' },
    {
      title: 'Experience',
      dataIndex: 'experienceYears',
      key: 'experienceYears',
      render: (exp) => <Tag color="geekblue">{exp} Years</Tag>,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        <Button size="small" icon={<IdcardOutlined />} onClick={() => setSelectedIDCardStaff(r)}>
          Staff ID
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="TOTAL EMPLOYEES" value={staffList.length + 42} suffix="Staff" />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="TEACHING FACULTY" value={34} suffix="Teachers" />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="ADMIN & SUPPORT" value={13} suffix="Staff" />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="ATTENDANCE TODAY" value={98.2} suffix="%" valueStyle={{ color: '#10B981' }} />
          </Card>
        </Col>
      </Row>

      <Card
        title={<Title level={5} style={{ margin: 0 }}>Faculty & Staff Employee Master</Title>}
        extra={
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => setIsModalOpen(true)}
            style={{ background: '#0A2540', borderColor: '#0A2540' }}
          >
            Enroll New Staff
          </Button>
        }
        bordered={false}
      >
        <Table columns={columns} dataSource={staffList} pagination={false} />

        <Modal
          title="Enroll Faculty / Staff Member"
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
            <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Meenakshi Iyer" />
            </Form.Item>
            <Form.Item name="department" label="Department" initialValue="Science Department">
              <Input placeholder="e.g. Library & Learning / Mathematics" />
            </Form.Item>
            <Form.Item name="designation" label="Designation" initialValue="Senior Faculty">
              <Input placeholder="e.g. Head Librarian / Senior Teacher" />
            </Form.Item>
            <Form.Item name="mobile" label="Mobile Number" rules={[{ required: true }]}>
              <Input placeholder="+91 98765 00000" />
            </Form.Item>
            <Form.Item name="email" label="Official Email" rules={[{ required: true }]}>
              <Input placeholder="name@greenwood.edu" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                  Save Employee
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Staff ID Card Modal */}
        <Modal
          title="Staff Smart Identity Card"
          open={!!selectedIDCardStaff}
          onCancel={() => setSelectedIDCardStaff(null)}
          footer={null}
        >
          {selectedIDCardStaff && (
            <div style={{ textAlign: 'center' }}>
              <Card
                style={{
                  width: 320,
                  margin: '12px auto',
                  borderRadius: 16,
                  border: '2px solid #0A2540',
                  background: 'linear-gradient(180deg, #0A2540 0%, #0A2540 85px, #FFFFFF 85px, #FFFFFF 100%)',
                  color: '#FFFFFF',
                  boxShadow: '0 8px 24px rgba(10, 37, 64, 0.15)',
                }}
              >
                <div style={{ height: 60, textAlign: 'center' }}>
                  <Text strong style={{ color: '#F59E0B', fontSize: 13, display: 'block' }}>
                    GREENWOOD HIGH SCHOOL
                  </Text>
                  <Text style={{ color: '#93C5FD', fontSize: 10 }}>STAFF IDENTITY CARD</Text>
                </div>

                <Avatar
                  size={80}
                  style={{
                    backgroundColor: '#0A2540',
                    border: '3px solid #FFFFFF',
                    marginTop: 8,
                    fontSize: 32,
                    fontWeight: 'bold',
                  }}
                >
                  {selectedIDCardStaff.name.charAt(0)}
                </Avatar>

                <div style={{ color: '#1E293B', marginTop: 10 }}>
                  <Title level={5} style={{ margin: 0, color: '#0A2540' }}>{selectedIDCardStaff.name}</Title>
                  <Tag color="gold" style={{ marginTop: 4, fontWeight: 700 }}>
                    {selectedIDCardStaff.designation}
                  </Tag>

                  <div style={{ marginTop: 12, textAlign: 'left', fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
                    <div><strong>Emp Code:</strong> {selectedIDCardStaff.empCode}</div>
                    <div><strong>Department:</strong> {selectedIDCardStaff.department}</div>
                    <div><strong>Contact:</strong> {selectedIDCardStaff.mobile}</div>
                    <div><strong>Blood Group:</strong> O+</div>
                  </div>
                </div>
              </Card>

              <Button
                type="primary"
                icon={<PrinterOutlined />}
                onClick={() => message.success('Staff ID Card printed successfully.')}
                style={{ background: '#0A2540', borderColor: '#0A2540', marginTop: 16 }}
              >
                Print Staff Card
              </Button>
            </div>
          )}
        </Modal>
      </Card>
    </div>
  );
};
