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
  List,
  Row,
  Skeleton,
  Space,
  Statistic,
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
  FileOutlined,
  HeartOutlined,
  IdcardOutlined,
  MedicineBoxOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { App as AntApp, Form, Input, InputNumber, Modal, Popconfirm, Select, Upload } from 'antd';
import { UploadOutlined, PlusOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { apiClient, API, withId } from '../services/api';
import {AuthenticatedAvatar} from '../components/UserAvatar';

const { Text, Title } = Typography;

/**
 * Ported from gegok12/resources/assets/js/antd/pages/StudentProfilePage.jsx.
 * Tab structure (Overview / Family / Conduct) follows the production page.
 */

const statusColor: Record<string, string> = {
  active: 'green',
  inactive: 'orange',
  exit: 'red',
};

const show = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : String(value));

interface Guardian {
  id: number;
  name: string;
  relation: string | null;
  isPrimary: boolean;
  email: string | null;
  mobile: string | null;
  occupation: string | null;
}

interface Sibling {
  id: number;
  name: string;
  className: string | null;
}

interface DisciplineEntry {
  id: number;
  title: string | null;
  description: string | null;
  date: string | null;
  severity: string | null;
  actionTaken: string | null;
}

interface Student {
  id: number;
  name: string;
  fullName: string;
  avatar: string | null;
  status: string;
  email: string | null;
  mobile: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  address: string | null;
  aadhaarNumber: string | null;
  academicYear: string | null;
  className: string | null;
  registrationNumber: string | null;
  rollNumber: string | null;
  joiningDate: string | null;
}

interface Medical {
  hasData: boolean;
  height: number | null;
  weight: number | null;
  medicationProblems: string | null;
  medicationNeeds: string | null;
  medicationAllergies: string | null;
  foodAllergies: string | null;
  otherAllergies: string | null;
  otherInformation: string | null;
}

interface StudentDocument {
  id: number;
  name: string;
  category: string | null;
  url: string | null;
}

interface ProfilePayload {
  student: Student;
  guardians: Guardian[];
  siblings: Sibling[];
  discipline: DisciplineEntry[];
  medical: Medical;
  documents: StudentDocument[];
}

const MedicalTab: React.FC<{
  medical: Medical;
  studentId: string;
  onChanged: () => Promise<void> | void;
}> = ({ medical, studentId, onChanged }) => {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openEditor = () => {
    form.setFieldsValue(medical);
    setFormError(null);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const values = await form.validateFields();
      const res = await apiClient.post(withId(API.studentMedicalApi, studentId), values);
      message.success(res.data.message || 'Medical history saved.');
      setOpen(false);
      await onChanged();
    } catch (e: any) {
      if (!e?.response) return;
      setFormError(e.response.data?.message || 'The medical history could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
  <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Flex justify="flex-end">
      <Button type="primary" icon={<EditOutlined />} onClick={openEditor}>
        Edit medical history
      </Button>
    </Flex>
    {!medical.hasData && (
      <Alert
        showIcon
        type="info"
        message="No medical history has been recorded for this academic year."
      />
    )}
    <Row gutter={[16, 16]}>
      <Col xs={12} md={6}>
        <Card>
          <Statistic title="Height" value={medical.height ?? 0} suffix="cm" prefix={<HeartOutlined />} />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card>
          <Statistic title="Weight" value={medical.weight ?? 0} suffix="kg" prefix={<MedicineBoxOutlined />} />
        </Card>
      </Col>
    </Row>
    <Card title="Medical notes">
      <Descriptions column={{ xs: 1, lg: 2 }} bordered size="small">
        <Descriptions.Item label="Medical problems">{show(medical.medicationProblems)}</Descriptions.Item>
        <Descriptions.Item label="Medication needs">{show(medical.medicationNeeds)}</Descriptions.Item>
        <Descriptions.Item label="Medication allergies">{show(medical.medicationAllergies)}</Descriptions.Item>
        <Descriptions.Item label="Food allergies">{show(medical.foodAllergies)}</Descriptions.Item>
        <Descriptions.Item label="Other allergies">{show(medical.otherAllergies)}</Descriptions.Item>
        <Descriptions.Item label="Identification and other information">
          {show(medical.otherInformation)}
        </Descriptions.Item>
      </Descriptions>
    </Card>

    <Modal
      open={open}
      title="Edit medical history"
      onCancel={() => setOpen(false)}
      onOk={save}
      confirmLoading={saving}
      okText="Save"
      width={640}
    >
      {formError && <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="height" label="Height (cm)">
              <InputNumber min={0} max={300} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="weight" label="Weight (kg)">
              <InputNumber min={0} max={500} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="medicationProblems" label="Medical problems">
          <Input.TextArea rows={2} maxLength={2000} />
        </Form.Item>
        <Form.Item name="medicationNeeds" label="Medication needs">
          <Input.TextArea rows={2} maxLength={2000} />
        </Form.Item>
        <Form.Item name="medicationAllergies" label="Medication allergies">
          <Input maxLength={2000} />
        </Form.Item>
        <Form.Item name="foodAllergies" label="Food allergies">
          <Input maxLength={2000} />
        </Form.Item>
        <Form.Item name="otherAllergies" label="Other allergies">
          <Input maxLength={2000} />
        </Form.Item>
        <Form.Item name="otherInformation" label="Identification and other information">
          <Input.TextArea rows={2} maxLength={2000} />
        </Form.Item>
      </Form>
    </Modal>
  </Space>
  );
};

const DocumentsTab: React.FC<{
  documents: StudentDocument[];
  studentId: string;
  onChanged: () => Promise<void> | void;
}> = ({ documents, studentId, onChanged }) => {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const upload = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const values = await form.validateFields();
      const file = fileList[0]?.originFileObj;
      if (!file) {
        setFormError('Choose a file to upload.');
        return;
      }

      const body = new FormData();
      body.append('file', file);
      body.append('name', values.name);
      if (values.category) body.append('category', values.category);

      const res = await apiClient.post(withId(API.studentDocumentsApi, studentId), body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(res.data.message || 'Document uploaded.');
      setOpen(false);
      setFileList([]);
      form.resetFields();
      await onChanged();
    } catch (e: any) {
      if (!e?.response) return;
      setFormError(e.response.data?.message || 'The document could not be uploaded.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (docId: number) => {
    try {
      const url = withId(API.studentDocumentApi, studentId).replace('__DOC__', String(docId));
      await apiClient.delete(url);
      message.success('Document removed.');
      await onChanged();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'The document could not be removed.');
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Flex justify="flex-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Upload document
        </Button>
      </Flex>

      {documents.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No documents uploaded" />
      ) : (
        <List
          bordered
          dataSource={documents}
          renderItem={(doc) => (
            <List.Item
              actions={[
                doc.url ? (
                  <Button
                    key="dl"
                    size="small"
                    icon={<DownloadOutlined />}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </Button>
                ) : null,
                <Popconfirm key="rm" title="Remove this document?" onConfirm={() => remove(doc.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={<FileOutlined />}
                title={doc.name}
                description={doc.category || 'Uncategorised'}
              />
            </List.Item>
          )}
        />
      )}

      <Modal
        open={open}
        title="Upload document"
        onCancel={() => setOpen(false)}
        onOk={upload}
        confirmLoading={saving}
        okText="Upload"
      >
        {formError && <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Document name" rules={[{ required: true }]}>
            <Input maxLength={255} placeholder="e.g. Transfer Certificate" />
          </Form.Item>
          <Form.Item name="category" label="Category">
            <Select
              allowClear
              options={[
                { value: 'certificates', label: 'Certificates' },
                { value: 'id_proof', label: 'ID proof' },
                { value: 'others', label: 'Other' },
              ]}
            />
          </Form.Item>
          <Form.Item label="File" required>
            {/* Upload is deferred to the modal's OK so the request carries the
                name and category alongside the file in one call. */}
            <Upload
              beforeUpload={() => false}
              maxCount={1}
              fileList={fileList}
              onChange={({ fileList: fl }) => setFileList(fl)}
              accept=".pdf,.jpg,.jpeg,.png,.webp"
            >
              <Button icon={<UploadOutlined />}>Choose file</Button>
            </Upload>
            <Text type="secondary" style={{ fontSize: 12 }}>
              PDF, JPEG, PNG or WebP, up to 10 MB.
            </Text>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

const ConductTab: React.FC<{
  records: DisciplineEntry[];
  studentId: string;
  onChanged: () => Promise<void> | void;
}> = ({ records, studentId, onChanged }) => {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const values = await form.validateFields();
      const res = await apiClient.post(withId(API.studentConductApi, studentId), values);
      message.success(res.data.message || 'Conduct record added.');
      setOpen(false);
      form.resetFields();
      await onChanged();
    } catch (e: any) {
      if (!e?.response) return;
      setFormError(e.response.data?.message || 'The record could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="Conduct log"
        description="A dated record of behaviour incidents — what happened, how serious it was, and what the school did about it. Entries are visible to the student's parents in the mobile app, so they double as the written trail behind any follow-up."
      />
      <Flex justify="flex-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Add conduct record
        </Button>
      </Flex>
      <Card>
        <Table
          rowKey="id"
          columns={disciplineColumns}
          dataSource={records}
          pagination={false}
          locale={{ emptyText: 'No conduct records' }}
          scroll={{ x: 720 }}
        />
      </Card>

      <Modal
        open={open}
        title="Add conduct record"
        onCancel={() => setOpen(false)}
        onOk={save}
        confirmLoading={saving}
        okText="Save record"
      >
        {formError && <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical">
          <Form.Item name="incidentType" label="Incident" rules={[{ required: true }]}>
            <Input maxLength={150} placeholder="e.g. Late arrival" />
          </Form.Item>
          <Form.Item
            name="incidentDate"
            label="Date"
            rules={[{ required: true, message: 'Pick the date it happened' }]}
          >
            <Input type="date" />
          </Form.Item>
          <Form.Item name="severity" label="Severity">
            <Select
              allowClear
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="What happened">
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
          <Form.Item name="actionTaken" label="Action taken">
            <Input.TextArea rows={2} maxLength={2000} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

const OverviewTab: React.FC<{ student: Student }> = ({ student }) => (
  <Row gutter={[16, 16]}>
    <Col xs={24} lg={12}>
      <Card title="Personal and contact information">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Date of birth">{show(student.dateOfBirth)}</Descriptions.Item>
          <Descriptions.Item label="Gender">{show(student.gender)}</Descriptions.Item>
          <Descriptions.Item label="Blood group">{show(student.bloodGroup)}</Descriptions.Item>
          <Descriptions.Item label="Email">{show(student.email)}</Descriptions.Item>
          <Descriptions.Item label="Mobile">{show(student.mobile)}</Descriptions.Item>
          <Descriptions.Item label="Address">{show(student.address)}</Descriptions.Item>
          <Descriptions.Item label="Aadhaar number">{show(student.aadhaarNumber)}</Descriptions.Item>
        </Descriptions>
      </Card>
    </Col>
    <Col xs={24} lg={12}>
      <Card title="Academic information">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Academic year">{show(student.academicYear)}</Descriptions.Item>
          <Descriptions.Item label="Class">{show(student.className)}</Descriptions.Item>
          <Descriptions.Item label="Admission number">{show(student.registrationNumber)}</Descriptions.Item>
          <Descriptions.Item label="Roll number">{show(student.rollNumber)}</Descriptions.Item>
          <Descriptions.Item label="Joining date">
            {student.joiningDate ? new Date(student.joiningDate).toLocaleDateString() : '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Col>
  </Row>
);

const FamilyTab: React.FC<{ guardians: Guardian[]; siblings: Sibling[] }> = ({ guardians, siblings }) => (
  <Row gutter={[16, 16]}>
    <Col xs={24} lg={12}>
      <Card title="Guardians" extra={<Tag icon={<TeamOutlined />}>{guardians.length}</Tag>}>
        {guardians.length === 0 ? (
          <Empty description="No guardians linked" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={guardians}
            renderItem={(g) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={
                    <Space>
                      {g.name}
                      {g.relation && <Tag>{g.relation}</Tag>}
                      {g.isPrimary && <Tag color="blue">Primary</Tag>}
                    </Space>
                  }
                  description={[g.mobile, g.email, g.occupation].filter(Boolean).join(' · ') || '—'}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </Col>
    <Col xs={24} lg={12}>
      <Card title="Siblings" extra={<Tag>{siblings.length}</Tag>}>
        {siblings.length === 0 ? (
          <Empty description="No siblings enrolled" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={siblings}
            renderItem={(s) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={s.name}
                  description={s.className || 'No class assigned'}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </Col>
  </Row>
);

const disciplineColumns: ColumnsType<DisciplineEntry> = [
  { title: 'Incident', dataIndex: 'title', render: (v) => show(v) },
  { title: 'Description', dataIndex: 'description', render: (v) => show(v) },
  {
    title: 'Severity',
    dataIndex: 'severity',
    render: (v: string | null) =>
      v ? <Tag color={v === 'high' ? 'red' : v === 'medium' ? 'orange' : 'default'}>{v}</Tag> : '—',
  },
  {
    title: 'Date',
    dataIndex: 'date',
    render: (v: string | null) => (v ? new Date(v).toLocaleDateString() : '—'),
  },
  { title: 'Action taken', dataIndex: 'actionTaken', render: (v) => show(v) },
];

export const StudentProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(withId(API.studentProfileApi, id));
      setProfile(response.data.data);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Student profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const student = profile?.student;

  const tabs = profile
    ? [
        { key: 'overview', label: 'Overview', children: <OverviewTab student={profile.student} /> },
        {
          key: 'family',
          label: `Family (${profile.guardians.length + profile.siblings.length})`,
          children: <FamilyTab guardians={profile.guardians} siblings={profile.siblings} />,
        },
        {
          key: 'documents',
          label: `Documents (${profile.documents.length})`,
          children: (
            <DocumentsTab
              documents={profile.documents}
              studentId={id!}
              onChanged={loadProfile}
            />
          ),
        },
        {
          key: 'medical',
          label: 'Medical',
          children: (
            <MedicalTab medical={profile.medical} studentId={id!} onChanged={loadProfile} />
          ),
        },
        {
          key: 'conduct',
          label: `Conduct (${profile.discipline.length})`,
          children: (
            <ConductTab
              records={profile.discipline}
              studentId={id!}
              onChanged={loadProfile}
            />
          ),
        },
      ]
    : [];

  return (
    <Flex vertical gap={16}>
      <div>
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0 }} onClick={() => navigate('/students')}>
          Back to students
        </Button>
        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Student profile</Title>
            <Text type="secondary">Profile, family, documents and medical information</Text>
          </div>
          <Button type="primary" icon={<EditOutlined />}>Edit student</Button>
        </Flex>
      </div>

      {error && <Alert type="error" showIcon message={error} />}
      {loading && <Card><Skeleton active avatar paragraph={{ rows: 4 }} /></Card>}

      {!loading && student && (
        <>
          <Card>
            <Flex align="center" justify="space-between" wrap="wrap" gap={20}>
              <Flex align="center" gap={18}>
                <AuthenticatedAvatar name={student.fullName} src={student.avatar} size={88} />
                <div>
                  <Title level={3} style={{ margin: 0 }}>{student.fullName}</Title>
                  <Space wrap>
                    <Tag color={statusColor[student.status] || 'default'}>
                      {student.status?.toUpperCase()}
                    </Tag>
                    <Text>{show(student.className)}</Text>
                    <Text type="secondary">Admission {show(student.registrationNumber)}</Text>
                  </Space>
                  <div>
                    <Text type="secondary">
                      {show(student.email)} · {show(student.mobile)}
                    </Text>
                  </div>
                </div>
              </Flex>
              <Space>
                <Button icon={<IdcardOutlined />} onClick={() => navigate('/id-cards')}>
                  ID cards
                </Button>
                <Button type="primary" icon={<EditOutlined />}>Edit profile</Button>
              </Space>
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
