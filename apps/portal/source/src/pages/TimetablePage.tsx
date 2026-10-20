import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Table,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  TimePicker,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import {Link} from 'react-router-dom';
dayjs.extend(customParseFormat);
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiClient, API, withId } from '../services/api';

const { Text, Title } = Typography;

/**
 * Timetable builder.
 *
 * Laid out as a day × period grid rather than a flat list: a timetable is read
 * spatially, and clashes are obvious in a grid in a way they are not in rows.
 * Collision rules are enforced server-side — this screen surfaces the reason
 * the server gives rather than reimplementing the checks.
 */

interface Option {
  value: string;
  label: string;
}

interface Options {
  configuration: {days:string[];periodsPerDay:number;version:number}|null;
  days: string[];
  periods: number[];
  classes: Option[];
  subjects: Option[];
  teachers: Option[];
}

interface Slot {
  id: string;
  version: number;
  day: string;
  periodNo: number;
  startTime: string | null;
  endTime: string | null;
  roomNo: string | null;
  teacherId: string | null;
  teacherName: string | null;
  subjectId: string | null;
  subjectName: string | null;
}

const dayLabel = (d: string) => d.charAt(0).toUpperCase() + d.slice(1, 3);

export const TimetablePage: React.FC = () => {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [configurationForm] = Form.useForm();
  const slotKey=useRef(''),configurationKey=useRef('');
  const actionKeys=useRef<Record<string,string>>({});
  const [removed,setRemoved]=useState<any[]>([]);

  const [options, setOptions] = useState<Options | null>(null);
  const [standardLinkId, setStandardLinkId] = useState<string | undefined>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [editorCell, setEditorCell] = useState<{ day: string; periodNo: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const response = await apiClient.get(API.timetableOptionsApi);
        setOptions(response.data.data);
        if(response.data.data.configuration)configurationForm.setFieldsValue(response.data.data.configuration);
        const archives=await apiClient.get('/api/admin/timetable/removed');setRemoved(archives.data.data);
        const first = response.data.data.classes[0];
        if (first) setStandardLinkId(first.value);
      } catch (e: any) {
        setError(e.response?.data?.message || 'Timetable options could not be loaded.');
      }
    })();
  }, []);

  const loadGrid = useCallback(async () => {
    if (!standardLinkId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(withId(API.timetableGridApi, standardLinkId));
      setSlots(response.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Timetable could not be loaded.');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [standardLinkId]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  const byCell = useMemo(() => {
    const map = new Map<string, Slot>();
    slots.forEach((s) => map.set(`${s.day}-${s.periodNo}`, s));
    return map;
  }, [slots]);

  const openEditor = (day: string, periodNo: number) => {
    const existing = byCell.get(`${day}-${periodNo}`) ?? null;
    slotKey.current=crypto.randomUUID();
    setEditing(existing);
    setEditorCell({ day, periodNo });
    setFormError(null);
    form.setFieldsValue({
      subjectId: existing?.subjectId ?? undefined,
      teacherId: existing?.teacherId ?? undefined,
      roomNo: existing?.roomNo ?? undefined,
      time:
        existing?.startTime && existing?.endTime
          ? [dayjs(existing.startTime.slice(0,5), 'HH:mm'), dayjs(existing.endTime.slice(0,5), 'HH:mm')]
          : undefined,
    });
    setEditorOpen(true);
  };

  const saveSlot = async () => {
    if (!editorCell || !standardLinkId) return;
    setSaving(true);
    setFormError(null);
    try {
      const values = await form.validateFields();
      const payload = {
        standardLinkId,
        ...(editing?{version:editing.version}:{}),
        day: editorCell.day,
        periodNo: editorCell.periodNo,
        subjectId: values.subjectId ?? null,
        teacherId: values.teacherId ?? null,
        roomNo: values.roomNo || null,
        startTime: values.time?.[0] ? values.time[0].format('HH:mm') : null,
        endTime: values.time?.[1] ? values.time[1].format('HH:mm') : null,
      };

      if (editing) {
        await apiClient.put(withId(API.timetableSlotApi, editing.id), payload,{headers:{'Idempotency-Key':slotKey.current}});
        message.success('Timetable slot updated.');
      } else {
        await apiClient.post(API.timetableApi, payload,{headers:{'Idempotency-Key':slotKey.current}});
        message.success('Timetable slot created.');
      }

      setEditorOpen(false);
      await loadGrid();
    } catch (e: any) {
      if (!e?.response) {if(!e.errorFields)setFormError('Connection interrupted. Retry uses the same command.');return;}
      // The server owns collision rules; show exactly which one was hit.
      setFormError(e.response.data?.message || 'The slot could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const configure=async()=>{try{const values=await configurationForm.validateFields();configurationKey.current||=crypto.randomUUID();setSaving(true);await apiClient.put('/api/admin/timetable/configuration',{...values,version:options?.configuration?.version||0},{headers:{'Idempotency-Key':configurationKey.current}});configurationKey.current='';const r=await apiClient.get(API.timetableOptionsApi);setOptions(r.data.data);configurationForm.setFieldsValue(r.data.data.configuration);message.success('Timetable configuration saved.');}catch(e:any){if(!e.errorFields)setError(e.response?.data?.message||'Configuration could not be saved. Retry uses the same command.');}finally{setSaving(false);}};
  const restore=async(row:any)=>{try{actionKeys.current['restore-'+row.id]||=crypto.randomUUID();await apiClient.post('/api/admin/timetable/'+row.id+'/restore',{version:row.version},{headers:{'Idempotency-Key':actionKeys.current['restore-'+row.id]}});delete actionKeys.current['restore-'+row.id];setRemoved((await apiClient.get('/api/admin/timetable/removed')).data.data);await loadGrid();message.success('Slot restored.');}catch(e:any){setError(e.response?.data?.message||'Slot could not be restored.');}};
  const removeSlot = async (slot: Slot) => {
    try {
      actionKeys.current['remove-'+slot.id]||=crypto.randomUUID();
      await apiClient.delete(withId(API.timetableSlotApi, slot.id),{data:{version:slot.version},headers:{'Idempotency-Key':actionKeys.current['remove-'+slot.id]}});
      delete actionKeys.current['remove-'+slot.id];
      setRemoved((await apiClient.get('/api/admin/timetable/removed')).data.data);
      message.success('Timetable slot removed.');
      await loadGrid();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'The slot could not be removed.');
    }
  };

  if (!options) {
    return (
      <Card>
        {error ? <Alert type="error" showIcon message={error} /> : <Spin />}
      </Card>
    );
  }

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Timetable</Title>
          <Text type="secondary">
            Click any slot to assign a subject, teacher and room. Clashes are rejected.
          </Text>
        </div>
        <Space wrap>
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: 260 }}
            placeholder="Select class"
            value={standardLinkId}
            onChange={setStandardLinkId}
            options={options.classes}
          />
          <Button icon={<ReloadOutlined />} onClick={loadGrid}>Refresh</Button>
        </Space>
      </Flex>

      {error && <Alert type="error" showIcon message={error} />}

      <Card title="School timetable configuration"><Form form={configurationForm} layout="vertical"><Form.Item name="days" label="Teaching days" rules={[{required:true}]}><Select mode="multiple" options={['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(value=>({value,label:value}))}/></Form.Item><Form.Item name="periodsPerDay" label="Periods per day" rules={[{required:true}]}><InputNumber min={1} max={16}/></Form.Item><Button loading={saving} onClick={configure}>Save timetable configuration</Button></Form><Typography.Paragraph type="secondary">Enter the actual school schedule. Configure subjects and <Link to="/subjects">teacher assignments</Link> before adding slots.</Typography.Paragraph></Card>
      {!options.configuration&&<Alert type="info" showIcon message="Save the actual teaching days and period count to open the timetable grid."/>}

      <Card>
        {!standardLinkId ? (
          <Empty description="Select a class to build its timetable" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ ...cellBase, background: '#f8fafc', width: 90 }}>Period</th>
                  {options.days.map((d) => (
                    <th key={d} style={{ ...cellBase, background: '#f8fafc' }}>
                      {dayLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {options.periods.map((p) => (
                  <tr key={p}>
                    <td style={{ ...cellBase, background: '#f8fafc', fontWeight: 600 }}>{p}</td>
                    {options.days.map((d) => {
                      const slot = byCell.get(`${d}-${p}`);
                      return (
                        <td
                          key={d}
                          style={{
                            ...cellBase,
                            cursor: 'pointer',
                            background: slot ? '#fff' : '#fcfdff',
                            verticalAlign: 'top',
                          }}
                          onClick={() => openEditor(d, p)}
                        >
                          {slot ? (
                            <Space direction="vertical" size={2} style={{ width: '100%' }}>
                              <Text strong style={{ fontSize: 12 }}>
                                {slot.subjectName || 'No subject'}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {slot.teacherName || 'No teacher'}
                              </Text>
                              <Space size={4} wrap>
                                {slot.roomNo && <Tag style={{ fontSize: 10 }}>{slot.roomNo}</Tag>}
                                <Popconfirm
                                  title="Remove this slot?"
                                  onConfirm={(e) => {
                                    (e as any)?.stopPropagation?.();
                                    removeSlot(slot);
                                  }}
                                  onCancel={(e) => (e as any)?.stopPropagation?.()}
                                >
                                  <Button
                                    size="small"
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </Popconfirm>
                              </Space>
                            </Space>
                          ) : (
                            <Flex justify="center" align="center" style={{ minHeight: 44, opacity: 0.35 }}>
                              <PlusOutlined />
                            </Flex>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {loading && <div style={{ padding: 12 }}><Spin /></div>}
      </Card>

      <Card title="Removed slots"><Table rowKey="id" dataSource={removed} columns={[{title:'Day',dataIndex:'day'},{title:'Period',dataIndex:'periodNo'},{title:'Subject',dataIndex:'subjectName'},{title:'Action',render:(_,row)=><Button onClick={()=>restore(row)}>Restore</Button>}]}/></Card>
      <Modal
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={saveSlot}
        confirmLoading={saving}
        okText={editing ? 'Update slot' : 'Add slot'}
        title={
          editorCell
            ? `${dayLabel(editorCell.day)} · Period ${editorCell.periodNo}`
            : 'Timetable slot'
        }
      >
        {formError && <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical">
          <Form.Item name="subjectId" label="Subject" rules={[{required:true}]}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={options.subjects.filter((s:any)=>s.sectionId===standardLinkId)}
              placeholder="Select subject"
            />
          </Form.Item>
          <Form.Item name="teacherId" label="Teacher" rules={[{required:true}]}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={options.teachers}
              placeholder="Select teacher"
            />
          </Form.Item>
          <Form.Item name="roomNo" label="Room">
            <Input placeholder="Actual room, if assigned" maxLength={50} />
          </Form.Item>
          <Form.Item name="time" label="Time">
            <TimePicker.RangePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
};

const cellBase: React.CSSProperties = {
  border: '1px solid #eef0f4',
  padding: 8,
  fontSize: 12,
  textAlign: 'left',
};
