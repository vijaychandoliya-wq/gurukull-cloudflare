import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, BookOutlined, PrinterOutlined, CheckCircleOutlined, CalendarOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface LessonPlanItem {
  key: string;
  id: number;
  subject: string;
  class: string;
  teacher: string;
  weekRange: string;
  chapterTopic: string;
  pedagogicalObjective: string;
  teachingMethodology: string;
  principalStatus: 'Approved' | 'Pending Review' | 'Revision Needed';
}

const initialPlans: LessonPlanItem[] = [
  { key: '1', id: 1, subject: 'Mathematics', class: 'Grade 10 - A', teacher: 'Sunita Verma', weekRange: 'Aug 17 – Aug 22, 2026', chapterTopic: 'Chapter 4: Quadratic Equations & Roots Formula', pedagogicalObjective: 'Understand determinant nature of roots and graphical parabolas', teachingMethodology: 'Smartboard interactive plots + peer group problem sets', principalStatus: 'Approved' },
  { key: '2', id: 2, subject: 'Science (Physics)', class: 'Grade 10 - A', teacher: 'Ramesh Gupta', weekRange: 'Aug 17 – Aug 22, 2026', chapterTopic: 'Refraction & Snell Law of Light', pedagogicalObjective: 'Demonstrate prism dispersion and optical density in glass slab', teachingMethodology: 'Physics laboratory practical demo + ray diagrams', principalStatus: 'Approved' },
  { key: '3', id: 3, subject: 'English', class: 'Grade 1 - A', teacher: 'Priya Mehta', weekRange: 'Aug 17 – Aug 22, 2026', chapterTopic: 'Phonics Sound Blends (Sh, Ch, Th)', pedagogicalObjective: 'Recognize digraph phonetic sounds and spell 3-letter words', teachingMethodology: 'Flash cards + audio-visual rhymes', principalStatus: 'Pending Review' },
];

export const LessonPlanPage: React.FC = () => {
  const [plans, setPlans] = useState<LessonPlanItem[]>(initialPlans);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = (values: any) => {
    const newPlan: LessonPlanItem = {
      key: String(plans.length + 1),
      id: plans.length + 1,
      subject: values.subject,
      class: values.class,
      teacher: 'Sunita Verma',
      weekRange: values.weekRange,
      chapterTopic: values.chapterTopic,
      pedagogicalObjective: values.pedagogicalObjective,
      teachingMethodology: values.teachingMethodology,
      principalStatus: 'Pending Review',
    };
    setPlans([...plans, newPlan]);
    setIsModalOpen(false);
    form.resetFields();
    message.success('Weekly lesson plan submitted for Principal approval!');
  };

  const columns: ColumnsType<LessonPlanItem> = [
    { title: 'Subject & Class', key: 'sub', render: (_, r) => <div><Text strong>{r.subject}</Text><div style={{ fontSize: 11, color: '#64748B' }}>{r.class}</div></div> },
    { title: 'Faculty', dataIndex: 'teacher', key: 'teacher' },
    { title: 'Week Schedule', dataIndex: 'weekRange', key: 'weekRange', render: (w) => <Text type="secondary"><CalendarOutlined /> {w}</Text> },
    { title: 'Chapter Topic', dataIndex: 'chapterTopic', key: 'chapterTopic', render: (t) => <Text strong>{t}</Text> },
    { title: 'Teaching Methodology', dataIndex: 'teachingMethodology', key: 'teachingMethodology' },
    {
      title: 'Principal Status',
      dataIndex: 'principalStatus',
      key: 'principalStatus',
      render: (st) => <Tag color={st === 'Approved' ? 'green' : 'gold'}>{st}</Tag>,
    },
    {
      title: 'Action',
      key: 'action',
      render: () => <Button size="small" icon={<PrinterOutlined />} onClick={() => message.success('Lesson plan dispatched to printable format.')}>Print</Button>,
    },
  ];

  return (
    <Card
      title={<Title level={5} style={{ margin: 0 }}>Weekly Pedagogical Lesson Planning</Title>}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ background: '#0A2540', borderColor: '#0A2540' }}
        >
          Submit Lesson Plan
        </Button>
      }
      bordered={false}
    >
      <Table columns={columns} dataSource={plans} pagination={false} />

      <Modal
        title="Submit Weekly Lesson Plan"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={650}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Space style={{ display: 'flex', width: '100%' }} size="middle">
            <Form.Item name="subject" label="Subject" initialValue="Mathematics" style={{ flex: 1 }}>
              <Select
                options={[
                  { value: 'Mathematics', label: 'Mathematics' },
                  { value: 'Science', label: 'Science' },
                  { value: 'English', label: 'English' },
                  { value: 'Social Studies', label: 'Social Studies' },
                ]}
              />
            </Form.Item>
            <Form.Item name="class" label="Class Section" initialValue="Grade 10 - Section A" style={{ flex: 1 }}>
              <Select
                options={[
                  { value: 'Grade 1 - Section A', label: 'Grade 1 - Section A' },
                  { value: 'Grade 1 - Section B', label: 'Grade 1 - Section B' },
                  { value: 'Grade 2 - Section A', label: 'Grade 2 - Section A' },
                  { value: 'Grade 10 - Section A', label: 'Grade 10 - Section A' },
                ]}
              />
            </Form.Item>
          </Space>

          <Form.Item name="weekRange" label="Weekly Academic Schedule" initialValue="Aug 24 – Aug 29, 2026" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="chapterTopic" label="Chapter / Unit & Lesson Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Chapter 5: Arithmetic Progressions" />
          </Form.Item>

          <Form.Item name="pedagogicalObjective" label="Learning Outcomes & Objectives" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="Explain what students will master by end of week..." />
          </Form.Item>

          <Form.Item name="teachingMethodology" label="Pedagogical Tools & Teaching Methodology" rules={[{ required: true }]}>
            <Input placeholder="e.g. Smartboard presentation, Laboratory experiment, Quiz" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#0A2540', borderColor: '#0A2540' }}>
                Submit for Review
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
