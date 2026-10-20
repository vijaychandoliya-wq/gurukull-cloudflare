import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, InputNumber, Select, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { InboxOutlined, PlusOutlined, ExportOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface InventoryItemType {
  key: string;
  id: number;
  name: string;
  itemCode: string;
  category: string;
  quantity: number;
  availableQuantity: number;
  unit: string;
  unitPrice: number;
}

const initialItems: InventoryItemType[] = [
  { key: '1', id: 1, name: 'Dell Vostro Core i5 Laptop', itemCode: 'IT-LAP-001', category: 'IT & Electronics', quantity: 30, availableQuantity: 24, unit: 'pcs', unitPrice: 48000 },
  { key: '2', id: 2, name: 'Science Lab Microscope 1000x', itemCode: 'LAB-MIC-012', category: 'Laboratory Equipment', quantity: 20, availableQuantity: 20, unit: 'pcs', unitPrice: 8500 },
  { key: '3', id: 3, name: 'Cricket Kit Combo (English Willow)', itemCode: 'SPT-CRI-004', category: 'Sports & Games', quantity: 10, availableQuantity: 7, unit: 'sets', unitPrice: 12000 },
  { key: '4', id: 4, name: 'Classroom Whiteboard 6x4 ft', itemCode: 'FURN-WB-055', category: 'Furniture & Fixture', quantity: 50, availableQuantity: 50, unit: 'pcs', unitPrice: 2200 },
];

export const InventoryPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItemType[]>(initialItems);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIssueModal, setIsIssueModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItemType | null>(null);
  const [form] = Form.useForm();
  const [issueForm] = Form.useForm();

  const handleAddItem = (values: any) => {
    const newItem: InventoryItemType = {
      key: String(items.length + 1),
      id: items.length + 1,
      name: values.name,
      itemCode: values.itemCode,
      category: values.category,
      quantity: values.quantity,
      availableQuantity: values.quantity,
      unit: values.unit || 'pcs',
      unitPrice: values.unitPrice || 0,
    };
    setItems([newItem, ...items]);
    setIsModalOpen(false);
    form.resetFields();
    message.success('Item added to school inventory!');
  };

  const handleIssue = (values: any) => {
    if (!selectedItem) return;
    const qty = Number(values.quantity || 1);
    if (selectedItem.availableQuantity < qty) {
      message.error('Insufficient stock available!');
      return;
    }
    setItems(
      items.map((i) =>
        i.id === selectedItem.id ? { ...i, availableQuantity: i.availableQuantity - qty } : i
      )
    );
    setIsIssueModal(false);
    issueForm.resetFields();
    message.success(`Issued ${qty} ${selectedItem.unit} of ${selectedItem.name} to ${values.recipientName}`);
  };

  const columns: ColumnsType<InventoryItemType> = [
    { title: 'Item Code', dataIndex: 'itemCode', key: 'itemCode', render: (t) => <Text code>{t}</Text> },
    { title: 'Item Name', dataIndex: 'name', key: 'name', render: (t) => <Text strong>{t}</Text> },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (c) => <Tag color="blue">{c}</Tag> },
    {
      title: 'Total Stock',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (q, r) => `${q} ${r.unit}`,
    },
    {
      title: 'Available',
      dataIndex: 'availableQuantity',
      key: 'availableQuantity',
      render: (avail, r) => (
        <Tag color={avail > 5 ? 'green' : 'red'} style={{ fontWeight: 700 }}>
          {avail} {r.unit}
        </Tag>
      ),
    },
    {
      title: 'Unit Price',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      render: (p) => `₹${p.toLocaleString()}`,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          size="small"
          icon={<ExportOutlined />}
          onClick={() => {
            setSelectedItem(record);
            setIsIssueModal(true);
          }}
        >
          Issue Asset
        </Button>
      ),
    },
  ];

  return (
    <Card
      title={<Title level={5} style={{ margin: 0 }}>Inventory & Fixed Asset Management</Title>}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ background: '#0A2540', borderColor: '#0A2540' }}
        >
          Add Item
        </Button>
      }
      bordered={false}
    >
      <Table columns={columns} dataSource={items} pagination={false} />

      {/* Add Item Modal */}
      <Modal
        title={<Title level={4} style={{ margin: 0 }}>Add Inventory Item</Title>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddItem} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Item Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Acer Core i5 Projector" />
          </Form.Item>
          <Form.Item name="itemCode" label="Item SKU / Asset Code" rules={[{ required: true }]}>
            <Input placeholder="e.g. IT-PROJ-011" />
          </Form.Item>
          <Form.Item name="category" label="Category" initialValue="IT & Electronics">
            <Select
              options={[
                { value: 'IT & Electronics', label: 'IT & Electronics' },
                { value: 'Laboratory Equipment', label: 'Laboratory Equipment' },
                { value: 'Sports & Games', label: 'Sports & Games' },
                { value: 'Furniture & Fixture', label: 'Furniture & Fixture' },
                { value: 'Library Books', label: 'Library Books' },
              ]}
            />
          </Form.Item>
          <Space style={{ display: 'flex', width: '100%' }} size="middle">
            <Form.Item name="quantity" label="Quantity" initialValue={10} style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Form.Item name="unitPrice" label="Unit Cost (₹)" initialValue={2000} style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Space>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                Add to Stock
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Issue Modal */}
      <Modal
        title={<Title level={4} style={{ margin: 0 }}>Issue Item to Staff / Student</Title>}
        open={isIssueModal}
        onCancel={() => setIsIssueModal(false)}
        footer={null}
      >
        {selectedItem && (
          <Form form={issueForm} layout="vertical" onFinish={handleIssue} style={{ marginTop: 16 }}>
            <Card size="small" style={{ background: '#F8FAFC', marginBottom: 16 }}>
              <Text strong>{selectedItem.name}</Text>
              <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>Code: {selectedItem.itemCode}</Text>
              <Tag color="green" style={{ marginTop: 4 }}>{selectedItem.availableQuantity} Available</Tag>
            </Card>

            <Form.Item name="recipientName" label="Staff / Student Full Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Ramesh Gupta (Science Dept)" />
            </Form.Item>

            <Form.Item name="quantity" label="Quantity to Issue" initialValue={1} rules={[{ required: true }]}>
              <InputNumber max={selectedItem.availableQuantity} min={1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIsIssueModal(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                  Confirm Asset Issue
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </Card>
  );
};
