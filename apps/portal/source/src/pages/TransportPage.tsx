import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, InputNumber, Select, Typography, Row, Col, Statistic, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CarOutlined, PlusOutlined, PhoneOutlined, CompassOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface VehicleRouteItem {
  key: string;
  id: number;
  routeNumber: string;
  routeName: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  seatingCapacity: number;
  allocatedStudents: number;
  currentSpeed: number;
  liveStatus: 'On Route' | 'At Depot' | 'Maintenance';
  lastPing: string;
}

const initialRoutes: VehicleRouteItem[] = [
  { key: '1', id: 1, routeNumber: 'Route 01', routeName: 'Civil Lines - C-Scheme - MI Road', vehicleNo: 'RJ-14-PA-8812', driverName: 'Satish Singh', driverPhone: '+91 98765 88101', seatingCapacity: 42, allocatedStudents: 38, currentSpeed: 32, liveStatus: 'On Route', lastPing: 'Just now (GPS Live)' },
  { key: '2', id: 2, routeNumber: 'Route 02', routeName: 'Mansarovar - Gopalpura - Tonk Road', vehicleNo: 'RJ-14-PA-8814', driverName: 'Harish Gurjar', driverPhone: '+91 98765 88102', seatingCapacity: 42, allocatedStudents: 40, currentSpeed: 28, liveStatus: 'On Route', lastPing: 'Just now (GPS Live)' },
  { key: '3', id: 3, routeNumber: 'Route 03', routeName: 'Vaishali Nagar - Queens Road - Ajmer Highway', vehicleNo: 'RJ-14-PA-8818', driverName: 'Bhagwan Das', driverPhone: '+91 98765 88103', seatingCapacity: 35, allocatedStudents: 31, currentSpeed: 0, liveStatus: 'At Depot', lastPing: '5 mins ago' },
];

export const TransportPage: React.FC = () => {
  const [routes, setRoutes] = useState<VehicleRouteItem[]>(initialRoutes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleAddRoute = (values: any) => {
    const newR: VehicleRouteItem = {
      key: String(routes.length + 1),
      id: routes.length + 1,
      routeNumber: `Route 0${routes.length + 1}`,
      routeName: values.routeName,
      vehicleNo: values.vehicleNo,
      driverName: values.driverName,
      driverPhone: values.driverPhone,
      seatingCapacity: Number(values.seatingCapacity) || 40,
      allocatedStudents: 0,
      currentSpeed: 0,
      liveStatus: 'At Depot',
      lastPing: 'Connected',
    };
    setRoutes([...routes, newR]);
    setIsModalOpen(false);
    form.resetFields();
    message.success(`Transport route ${newR.routeNumber} registered!`);
  };

  const columns: ColumnsType<VehicleRouteItem> = [
    { title: 'Route Number', dataIndex: 'routeNumber', key: 'routeNumber', render: (r) => <Text strong>{r}</Text> },
    { title: 'Route Path & Stops', dataIndex: 'routeName', key: 'routeName' },
    { title: 'Bus Vehicle No', dataIndex: 'vehicleNo', key: 'vehicleNo', render: (v) => <Tag color="geekblue">{v}</Tag> },
    {
      title: 'Driver & Contact',
      key: 'driver',
      render: (_, r) => <div><Text strong>{r.driverName}</Text><div style={{ fontSize: 11, color: '#64748B' }}><PhoneOutlined /> {r.driverPhone}</div></div>,
    },
    {
      title: 'Occupancy',
      key: 'occ',
      render: (_, r) => (
        <Space>
          <Text strong>{r.allocatedStudents}</Text> / {r.seatingCapacity}
          <Tag color="blue">{Math.round((r.allocatedStudents / r.seatingCapacity) * 100)}% Full</Tag>
        </Space>
      ),
    },
    {
      title: 'GPS Live Telemetry',
      key: 'gps',
      render: (_, r) => (
        <div>
          <Tag color={r.liveStatus === 'On Route' ? 'green' : 'default'} style={{ fontWeight: 700 }}>
            {r.liveStatus} ({r.currentSpeed} km/h)
          </Tag>
          <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}><CompassOutlined /> {r.lastPing}</div>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="TOTAL TRANSPORT FLEET" value={14} suffix="Buses / Vans" />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="STUDENTS COMMUTING" value={465} suffix="Students" />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="ACTIVE VEHICLES ON ROUTE" value={8} suffix="Live Tracking" valueStyle={{ color: '#10B981' }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="FLEET SPEED COMPLIANCE" value={100} suffix="%" valueStyle={{ color: '#10B981' }} />
          </Card>
        </Col>
      </Row>

      <Card
        title={<Title level={5} style={{ margin: 0 }}>School Transport Fleet & Live GPS Telemetry</Title>}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalOpen(true)}
            style={{ background: '#0A2540', borderColor: '#0A2540' }}
          >
            Add Transport Route
          </Button>
        }
        bordered={false}
      >
        <Table columns={columns} dataSource={routes} pagination={false} />

        <Modal
          title="Add New Transport Route & Vehicle"
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleAddRoute} style={{ marginTop: 16 }}>
            <Form.Item name="routeName" label="Route Name & Stops" rules={[{ required: true }]}>
              <Input placeholder="e.g. Malviya Nagar - Jawahar Circle - Durgapura" />
            </Form.Item>
            <Form.Item name="vehicleNo" label="Vehicle Registration Number" rules={[{ required: true }]}>
              <Input placeholder="e.g. RJ-14-PA-9911" />
            </Form.Item>
            <Space style={{ display: 'flex', width: '100%' }} size="middle">
              <Form.Item name="driverName" label="Driver Name" rules={[{ required: true }]} style={{ flex: 1 }}>
                <Input placeholder="e.g. Suresh Kumar" />
              </Form.Item>
              <Form.Item name="driverPhone" label="Driver Mobile Number" rules={[{ required: true }]} style={{ flex: 1 }}>
                <Input placeholder="+91 98765 00000" />
              </Form.Item>
            </Space>
            <Form.Item name="seatingCapacity" label="Seating Capacity" initialValue={42}>
              <InputNumber min={10} max={60} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                  Register Bus Route
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};
