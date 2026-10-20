import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, InputNumber, Select, Typography, message, Row, Col, Statistic } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BookOutlined, PlusOutlined, ExportOutlined, CheckCircleOutlined, SearchOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface BookItem {
  key: string;
  id: number;
  isbn: string;
  title: string;
  author: string;
  category: string;
  publisher: string;
  copies: number;
  available: number;
  rackNo: string;
}

const initialBooks: BookItem[] = [
  { key: '1', id: 1, isbn: '978-0143428534', title: 'Ignited Minds: Unleashing Power Within', author: 'Dr. A.P.J. Abdul Kalam', category: 'Inspirational & Science', publisher: 'Penguin India', copies: 15, available: 12, rackNo: 'Rack 3-B' },
  { key: '2', id: 2, isbn: '978-8172234980', title: 'The Discovery of India', author: 'Jawaharlal Nehru', category: 'History & Culture', publisher: 'Oxford University Press', copies: 10, available: 8, rackNo: 'Rack 1-A' },
  { key: '3', id: 3, isbn: '978-0195628456', title: 'Concepts of Physics (Vol 1 & 2)', author: 'Dr. H.C. Verma', category: 'Physics & Reference', publisher: 'Bharati Bhawan', copies: 25, available: 18, rackNo: 'Rack 4-C' },
  { key: '4', id: 4, isbn: '978-0747532743', title: 'Harry Potter and Philosopher Stone', author: 'J.K. Rowling', category: 'Young Adult Fiction', publisher: 'Bloomsbury', copies: 20, available: 14, rackNo: 'Rack 2-D' },
];

export const LibraryPage: React.FC = () => {
  const [books, setBooks] = useState<BookItem[]>(initialBooks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [form] = Form.useForm();
  const [issueForm] = Form.useForm();

  const handleAddBook = (values: any) => {
    const newBook: BookItem = {
      key: String(books.length + 1),
      id: books.length + 1,
      isbn: values.isbn,
      title: values.title,
      author: values.author,
      category: values.category,
      publisher: values.publisher || 'Standard Academic Press',
      copies: values.copies || 10,
      available: values.copies || 10,
      rackNo: values.rackNo || 'Rack 1',
    };
    setBooks([...books, newBook]);
    setIsModalOpen(false);
    form.resetFields();
    message.success(`Book ${newBook.title} added to library catalog!`);
  };

  const handleIssue = (values: any) => {
    if (!selectedBook) return;
    if (selectedBook.available < 1) {
      message.error('No copies available!');
      return;
    }
    setBooks(
      books.map((b) => (b.id === selectedBook.id ? { ...b, available: b.available - 1 } : b))
    );
    setIsIssueModalOpen(false);
    issueForm.resetFields();
    message.success(`Issued ${selectedBook.title} to ${values.memberName} (Due in 14 days).`);
  };

  const columns: ColumnsType<BookItem> = [
    { title: 'ISBN', dataIndex: 'isbn', key: 'isbn', render: (i) => <Text code>{i}</Text> },
    {
      title: 'Book Title & Author',
      key: 'title',
      render: (_, r) => <div><Text strong>{r.title}</Text><div style={{ fontSize: 11, color: '#64748B' }}>By {r.author}</div></div>,
    },
    { title: 'Category (DDC)', dataIndex: 'category', key: 'category', render: (c) => <Tag color="blue">{c}</Tag> },
    { title: 'Rack / Shelf', dataIndex: 'rackNo', key: 'rackNo', render: (rk) => <Tag color="geekblue">{rk}</Tag> },
    {
      title: 'Availability',
      key: 'avail',
      render: (_, r) => (
        <Space>
          <Text strong>{r.available}</Text> / {r.copies}
          <Tag color={r.available > 0 ? 'green' : 'red'}>{r.available > 0 ? 'In Stock' : 'All Borrowed'}</Tag>
        </Space>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        <Button
          size="small"
          icon={<ExportOutlined />}
          onClick={() => {
            setSelectedBook(r);
            setIsIssueModalOpen(true);
          }}
          disabled={r.available < 1}
        >
          Issue Book
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="TOTAL BOOKS IN CATALOG" value={4820} suffix="Volumes" />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="ACTIVELY LENT OUT" value={340} suffix="Books with Students" valueStyle={{ color: '#1890FF' }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="OVERDUE RETURNS" value={14} suffix="Books" valueStyle={{ color: '#EF4444' }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false}>
            <Statistic title="FINES COLLECTED (THIS MONTH)" value={1400} prefix="₹" />
          </Card>
        </Col>
      </Row>

      <Card
        title={<Title level={5} style={{ margin: 0 }}>Library Book Catalog & Circulation Desk</Title>}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalOpen(true)}
            style={{ background: '#0A2540', borderColor: '#0A2540' }}
          >
            Add Book
          </Button>
        }
        bordered={false}
      >
        <Table columns={columns} dataSource={books} pagination={false} />

        {/* Add Book Modal */}
        <Modal
          title="Add Book to Library Catalog"
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleAddBook} style={{ marginTop: 16 }}>
            <Form.Item name="title" label="Book Title" rules={[{ required: true }]}>
              <Input placeholder="e.g. S. Chand Higher Secondary Physics" />
            </Form.Item>
            <Form.Item name="author" label="Author / Editor" rules={[{ required: true }]}>
              <Input placeholder="e.g. Dr. P.K. Agarwal" />
            </Form.Item>
            <Form.Item name="isbn" label="ISBN Code" rules={[{ required: true }]}>
              <Input placeholder="978-XXXXXXXXXX" />
            </Form.Item>
            <Form.Item name="category" label="Subject / Genre" initialValue="Science & Reference">
              <Select
                options={[
                  { value: 'Mathematics & Science', label: 'Mathematics & Science' },
                  { value: 'History & Culture', label: 'History & Culture' },
                  { value: 'Young Adult Fiction', label: 'Young Adult Fiction' },
                  { value: 'Language & Grammar', label: 'Language & Grammar' },
                ]}
              />
            </Form.Item>
            <Space style={{ display: 'flex', width: '100%' }} size="middle">
              <Form.Item name="copies" label="Number of Copies" initialValue={5} style={{ flex: 1 }}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="rackNo" label="Rack / Shelf Code" initialValue="Rack 2-A" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
            </Space>
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                  Save to Catalog
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Issue Book Modal */}
        <Modal
          title="Issue Book to Student / Teacher"
          open={isIssueModalOpen}
          onCancel={() => setIsIssueModalOpen(false)}
          footer={null}
        >
          {selectedBook && (
            <Form form={issueForm} layout="vertical" onFinish={handleIssue} style={{ marginTop: 16 }}>
              <Card size="small" style={{ background: '#F8FAFC', marginBottom: 16 }}>
                <Text strong>{selectedBook.title}</Text>
                <div style={{ fontSize: 11, color: '#64748B' }}>ISBN: {selectedBook.isbn} • {selectedBook.rackNo}</div>
              </Card>
              <Form.Item name="memberName" label="Student / Staff Full Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Aarav Malhotra (Roll 01)" />
              </Form.Item>
              <Form.Item name="memberCardNo" label="Library Card Number" rules={[{ required: true }]}>
                <Input placeholder="e.g. LIB-2026-088" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setIsIssueModalOpen(false)}>Cancel</Button>
                  <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                    Confirm Issue (14 Days)
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          )}
        </Modal>
      </Card>
    </div>
  );
};
