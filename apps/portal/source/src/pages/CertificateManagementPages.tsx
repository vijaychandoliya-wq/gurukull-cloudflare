import {
  CERTIFICATE_DESIGNS,
  certificateDesign,
  getCertificateBorder,
  getCertificateTypography,
} from '../components/certificates/CertificateDesigns';
import {printCertificate, disposeCertificatePrint} from '../components/certificates/printCertificate';
import {CertificateSheet} from '../components/certificates/CertificateSheet';
import {humanize, displayValue} from '../ux/format';
import {ModuleTabs} from '../components/portal/ModuleTabs';
import {useEffect, useRef, useState} from 'react';
import {Link, useParams, useSearchParams} from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Typography,
  Tag,
  Divider,
  Flex,
} from 'antd';
import {Table} from '../components/export/ExportTable';
import {apiClient} from '../services/api';
import {useAuth} from '../context/AuthContext';
import {WorkflowPage, type WorkflowSpec} from './SchoolWorkflowPages';
import {
  CopyOutlined,
  FilePdfOutlined,
  PrinterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  EyeOutlined,
  StarOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';

const templates: WorkflowSpec = {
  path: 'certificate-templates',
  title: 'Certificate templates',
  archive: true,
  columns: ['name', 'type', 'headerTitle', 'version'],
  notice: 'Enter actual school wording as plain text. Supported placeholders: {STUDENT_NAME}, {CLASS}, {ROLL_NO}, {ADMISSION_NO}, {ACADEMIC_YEAR}, {SCHOOL_NAME}, {SCHOOL_ADDRESS}, {ISSUE_DATE}, {CERTIFICATE_NO}, {REASON}. No templates, conduct claims, logos or signatures are fabricated.',
  fields: [
    { name: 'name', label: 'Actual template name', required: true, max: 100 },
    { name: 'type', label: 'Certificate type', required: true, type: 'select', options: 'types' },
    { name: 'headerTitle', label: 'Actual document title', required: true, max: 200 },
    { name: 'subheader', label: 'Subheading', max: 300 },
    { name: 'bodyContent', label: 'Actual school-approved wording / placeholders', required: true, type: 'long', max: 10000 },
    { name: 'footerLeft', label: 'Left authorized-signature label, if used', max: 150 },
    { name: 'footerRight', label: 'Right authorized-signature label, if used', max: 150 },
  ],
};
const issues: WorkflowSpec = {
  path: 'certificates',
  title: 'Certificates',
  addLabel: 'Issue actual certificate',
  canEdit: () => false,
  columns: ['certificateNo', 'studentName', 'templateName', 'type', 'issueDate', 'status', 'voidReason'],
  notice: 'Enter the school\'s actual certificate number and issue date. The actual student, school and template wording are frozen at issuance. Corrections void the original; issue a new number separately. Print views are authenticated. No signature or PDF upload is fabricated.',
  fields: [
    { name: 'studentId', label: 'Actual student', required: true, type: 'select', options: 'students' },
    { name: 'templateId', label: 'Actual template', required: true, type: 'select', options: 'templates' },
    { name: 'certificateNo', label: 'Actual certificate number', required: true, max: 100 },
    { name: 'issueDate', label: 'Actual issue date', required: true, type: 'date' },
    { name: 'reason', label: 'Actual reason / achievement (required when used by wording)', type: 'long', max: 1000 },
  ],
};

const STATUS_COLORS: Record<string, string> = { issued: 'green', void: 'red' };
const STATUS_ICONS: Record<string, React.ReactNode> = {
  issued: <CheckCircleOutlined />,
  void: <CloseCircleOutlined />,
};

const CATEGORY_COLORS: Record<string, string> = {
  academic: 'blue',
  achievement: 'gold',
  formal: 'purple',
  sports: 'green',
  custom: 'default',
};

export function CertificateManagementPage() {
  const [selected, setSelected] = useState<any>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<any>();
  const [previewDesignId, setPreviewDesignId] = useState<string>('academic_blue');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [form] = Form.useForm();
  const key = useRef(''), reload = useRef<() => Promise<void>>(async () => {});
  const {message} = App.useApp();
  const {refreshSchool} = useAuth();

  useEffect(() => {
    if (previewOpen) {
      refreshSchool().then(() => {
        const stored = JSON.parse(localStorage.getItem('gurukul_school') || '{"logo":null}');
        setPreviewLogo(stored.logo);
      }).catch(() => {});
    }
  }, [previewOpen, refreshSchool]);

  const openPreview = async (row: any) => {
    try {
      const r = await apiClient.get('/api/admin/certificates/' + row.id);
      setPreviewRecord(r.data.data);
      setPreviewDesignId('academic_blue');
      setPreviewOpen(true);
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Could not load certificate preview.');
    }
  };

  const renderIssueActions = (row: any, refresh: () => Promise<void>) => (
    <Space size="small">
      <Button
        icon={<EyeOutlined />}
        size="small"
        onClick={() => openPreview(row)}
      >
        Preview
      </Button>
      <Link to={'/certificates/' + row.id + '/print'}>
        <Button icon={<FilePdfOutlined />} size="small">Print</Button>
      </Link>
      {row.status !== 'void' && (
        <Button danger size="small" onClick={() => {
          setSelected(row);
          form.resetFields();
          setError('');
          key.current = crypto.randomUUID();
          reload.current = refresh;
        }}>
          Void
        </Button>
      )}
    </Space>
  );

  const save = async () => {
    try {
      const v = await form.validateFields();
      setSaving(true);
      setError('');
      const r = await apiClient.post('/api/admin/certificates/' + selected.id + '/void', {
        version: selected.version,
        reason: v.reason,
      }, { headers: { 'Idempotency-Key': key.current }});
      message.success(r.data.message);
      setSelected(undefined);
      form.resetFields();
      await reload.current();
    } catch (e: any) {
      if (!e.errorFields) setError(e.response?.data?.message || 'Void failed. Refresh if the record changed.');
    } finally {
      setSaving(false);
    }
  };

  const renderTemplateActions = (row: any, refresh: () => Promise<void>) => (
    <Space size="small">
      <Button
        icon={<ExperimentOutlined />}
        size="small"
        onClick={() => {
          setPreviewRecord({
            ...row,
            certificateNo: 'PREVIEW-' + row.id.slice(0, 8),
            issueDate: new Date().toISOString().slice(0, 10),
            studentName: 'Sample Student',
            schoolName: 'Sample School',
            schoolAddress: 'Sample Address',
            bodyContent: row.bodyContent,
            headerTitle: row.headerTitle,
            subheader: row.subheader,
            footerLeft: row.footerLeft,
            footerRight: row.footerRight,
            status: 'issued',
          });
          setPreviewDesignId('academic_blue');
          setPreviewOpen(true);
        }}
      >
        Preview
      </Button>
    </Space>
  );

  const issueColumns = [
    {
      title: 'Certificate no.',
      dataIndex: 'certificateNo',
      render: (v: string) =>
        v ? <Typography.Text copyable={{ text: v, icon: <CopyOutlined /> }}>{v}</Typography.Text> : null,
    },
    { title: 'Student', dataIndex: 'studentName' },
    {
      title: 'Type',
      dataIndex: 'type',
      render: (v: string) => <Tag color={CATEGORY_COLORS[v] || 'default'}>{humanize(v)}</Tag>,
    },
    { title: 'Date', dataIndex: 'issueDate' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v: string) =>
        v ? (
          <Space>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: STATUS_COLORS[v] || 'default' }}>{STATUS_ICONS[v] || null}</span>
              <Tag color={STATUS_COLORS[v] || 'default'}>{humanize(v)}</Tag>
            </span>
          </Space>
        ) : (
          '—'
        ),
    },
    { title: 'Action', render: (_: any, row: any) => renderIssueActions(row, reload.current) },
  ];

  const templateColumns = [
    { title: 'Name', dataIndex: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      render: (v: string) => <Tag color={CATEGORY_COLORS[v] || 'default'}>{humanize(v)}</Tag>,
    },
    { title: 'Title', dataIndex: 'headerTitle' },
    { title: 'Version', dataIndex: 'version' },
    { title: 'Action', render: (_: any, row: any) => renderTemplateActions(row, reload.current) },
  ];

  const design = certificateDesign(previewDesignId);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <ModuleTabs
        items={[
          {
            key: 'issues',
            label: 'Issued certificates',
            children: <WorkflowPage spec={issues} renderActions={renderIssueActions} />,
          },
          {
            key: 'templates',
            label: 'Actual templates',
            children: <WorkflowPage spec={templates} renderActions={renderTemplateActions} />,
          },
        ]}
      />
      <Modal
        title="Void certificate; preserve original"
        open={!!selected}
        onCancel={() => !saving && setSelected(undefined)}
        onOk={save}
        confirmLoading={saving}
        destroyOnClose
      >
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
        <Alert
          type="warning"
          showIcon
          message="This action cannot be undone."
          description="The original certificate number and wording remain in the record. Issue a new certificate separately if needed."
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical" disabled={saving}>
          <Form.Item
            name="reason"
            label="Void reason"
            rules={[{ required: true, message: 'Supply the actual reason for voiding this certificate.' }]}
            extra="This reason is stored permanently with the certificate."
          >
            <Input.TextArea rows={3} maxLength={1000} showCount placeholder="Explain why this certificate is being voided" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={
          <Space>
            <EyeOutlined />
            Certificate preview
          </Space>
        }
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setPreviewOpen(false)}>
            Close
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={async () => {
              try {
                await printCertificate(previewRecord, design, { logo: previewLogo });
              } catch (e: any) {
                message.error(e.message || 'Printing failed.');
              }
            }}
          >
            Print / Save PDF
          </Button>,
        ]}
      >
        <Divider orientation="left" orientationMargin={0}>
          Choose design
        </Divider>
        <Radio.Group
          style={{ width: '100%', marginBottom: 16 }}
          value={previewDesignId}
          onChange={(e) => setPreviewDesignId(e.target.value)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            {CERTIFICATE_DESIGNS.map((item) => (
              <Radio.Button
                key={item.id}
                value={item.id}
                style={{
                  height: 'auto',
                  padding: 8,
                  textAlign: 'left',
                  whiteSpace: 'normal',
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  <div
                    style={{
                      height: 30,
                      border: `2px solid ${item.colors.primary}`,
                      background: item.colors.background,
                      borderRadius: 2,
                    }}
                  />
                </div>
                <div style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 500 }}>{item.name}</div>
                  <Tag color={CATEGORY_COLORS[item.category]} style={{ marginTop: 2, fontSize: 10 }}>
                    {item.category}
                  </Tag>
                </div>
              </Radio.Button>
            ))}
          </div>
        </Radio.Group>
        <Divider orientation="left" orientationMargin={0}>
          Preview
        </Divider>
        <div
          style={{
            maxHeight: '70vh',
            overflowY: 'auto',
            border: '1px solid #f0f0f0',
            borderRadius: 4,
            padding: 16,
            background: '#fafafa',
          }}
        >
          {previewRecord && <CertificateSheet record={previewRecord} design={design} logo={previewLogo} />}
        </div>
      </Modal>
    </Space>
  );
}

export function CertificatePrintPage() {
  const {id} = useParams();
  const [query] = useSearchParams();
  const {hasRole, user} = useAuth();
  const admin = hasRole('schooladmin', 'superadmin');
  const studentId = query.get('studentId') || (hasRole('student') ? user?.id : undefined);
  const [record, setRecord] = useState<any>();
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);
  const [, setDesignQuery] = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/api/' + (admin ? 'admin/certificates/' : 'portal/student-certificates/') + id, {
        params: admin ? {} : { studentId },
      })
      .then((r) => {
        if (!cancelled) {
          setRecord(r.data.data);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setRecord(undefined);
          setError(e.response?.data?.message || 'Actual certificate could not be loaded.');
        }
      });
    return () => {
      cancelled = true;
      disposeCertificatePrint();
    };
  }, [id, admin, studentId]);

  const design = certificateDesign(query.get('design'));
  const [printLogo, setPrintLogo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get('/api/admin/id-cards/options').then(r => {
      if (!cancelled) setPrintLogo(r.data.data.school.logo);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const print = async () => {
    try {
      setPrinting(true);
      setError('');
      await printCertificate(record, design, { logo: printLogo });
    } catch (e: any) {
      setError(e.message || 'Printing could not start. Please try again.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2}>Certificate preview</Typography.Title>
      {error && <Alert type="error" showIcon message={error} />}
      <Card size="small" title={<Space>Choose a design <Typography.Text type="secondary">({CERTIFICATE_DESIGNS.length} options)</Typography.Text></Space>}>
        <Radio.Group
          style={{ width: '100%' }}
          aria-label="Certificate design"
          value={design.id}
          onChange={(e) => {
            const next = new URLSearchParams(query);
            next.set('design', e.target.value);
            setDesignQuery(next, { replace: true });
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {CERTIFICATE_DESIGNS.map((item) => (
              <Radio.Button
                key={item.id}
                value={item.id}
                style={{ height: 'auto', padding: 12, whiteSpace: 'normal', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'block',
                      height: 36,
                      border: `3px solid ${item.colors.primary}`,
                      background: item.colors.background,
                      borderRadius: 2,
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                    <Tag color={CATEGORY_COLORS[item.category]} style={{ marginTop: 2, fontSize: 10 }}>
                      {item.category}
                    </Tag>
                  </div>
                </div>
              </Radio.Button>
            ))}
          </div>
        </Radio.Group>
      </Card>
      <Card size="small">
        <Flex wrap gap="middle" align="center" justify="space-between">
          <Space>
            <Button type="primary" icon={<PrinterOutlined />} loading={printing} disabled={!record?.bodyContent?.trim()} onClick={print}>
              Print / save PDF
            </Button>
            <Typography.Text type="secondary">
              Prints only the selected certificate on A4. Choose "Save as PDF" in the print dialog.
            </Typography.Text>
          </Space>
          {record?.status === 'void' && (
            <Alert type="error" showIcon message={`VOID — ${record.voidReason || 'No reason provided'}`} />
          )}
        </Flex>
      </Card>
      {!record?.bodyContent?.trim() && record && (
        <Alert
          type="warning"
          showIcon
          message="Certificate wording is missing"
          description="Update the school-approved template and issue a corrected certificate. A design adds decoration, not certificate wording."
        />
      )}
      {record && <CertificateSheet record={record} design={design} />}
    </Space>
  );
}

export function StudentCertificates({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRows([]);
    apiClient
      .get('/api/portal/student-certificates', { params: { studentId, page, per_page: 20 } })
      .then((r) => {
        if (!cancelled) {
          setRows(r.data.data);
          setTotal(r.data.total);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.response?.data?.message || 'Certificate records could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, page]);

  const columns = [
    {
      title: 'Certificate no.',
      dataIndex: 'certificateNo',
      render: (v: string) =>
        v ? <Typography.Text copyable={{ text: v }}>{v}</Typography.Text> : null,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      render: (v: string) => <Tag color={CATEGORY_COLORS[v] || 'default'}>{humanize(v)}</Tag>,
    },
    { title: 'Date', dataIndex: 'issueDate' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v: string) => (
        <Tag color={STATUS_COLORS[v] || 'default'} icon={STATUS_ICONS[v] || null}>
          {humanize(v)}
        </Tag>
      ),
    },
    {
      title: 'Document',
      render: (_: any, row: any) => (
        <Link to={'/certificates/' + row.id + '/print?studentId=' + encodeURIComponent(studentId)}>
          View / print
        </Link>
      ),
    },
  ];

  return (
    <Card
      title="Actual certificates"
      extra={<Typography.Text type="secondary">{total} record{total === 1 ? '' : 's'}</Typography.Text>}
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ current: page, pageSize: 20, total, onChange: setPage }}
        scroll={{ x: true }}
        columns={columns}
        locale={{ emptyText: 'No certificates have been issued yet.' }}
      />
    </Card>
  );
}
