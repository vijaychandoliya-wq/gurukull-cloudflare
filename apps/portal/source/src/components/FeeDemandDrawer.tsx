import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Drawer, Empty, Space, Spin, Table, Tag, Typography } from 'antd';
import { PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api';
import { money } from '../ux/format';

export type FeeDemandRow = {
  invoiceNo: string; feeHead: string; structureName: string; term: string;
  billedMinor: number; paidMinor: number; concessionMinor: number; balanceMinor: number;
  currency: string; dueOn: string; status: string;
};
export type FeeDemand = {
  student: { name: string; admissionNo: string; className: string | null; sectionName: string | null; yearName: string | null; currency: string | null };
  heads: FeeDemandRow[];
  totals: { billedMinor: number; paidMinor: number; concessionMinor: number; balanceMinor: number };
  nextDue: string | null;
  lastReceiptNo: string | null;
};

const demandCSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font: 13px/1.5 Arial, sans-serif; color: #14213d; margin: 0; }
  .gk-demand { max-width: 190mm; }
  .gk-demand-letterhead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1d3557; padding-bottom: 10px; }
  .gk-demand-school { font-size: 18px; font-weight: 700; }
  .gk-demand-sub { color: #52606d; font-size: 11px; margin-top: 2px; }
  .gk-demand-title { text-align: right; }
  .gk-demand-title h1 { margin: 0; font-size: 15px; letter-spacing: 2px; text-transform: uppercase; }
  .gk-demand-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 14px 0; font-size: 12px; }
  .gk-demand-meta div span { color: #52606d; display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #1d3557; color: #fff; font-size: 11px; text-align: left; padding: 6px 8px; text-transform: uppercase; letter-spacing: .4px; }
  th.num, td.num { text-align: right; white-space: nowrap; }
  td { border-bottom: 1px solid #ccd5e0; padding: 6px 8px; }
  tr:last-child td { border-bottom: none; }
  .gk-demand-foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 22px; }
  .gk-demand-total { font-size: 15px; font-weight: 700; }
  .gk-demand-total span { color: #d90429; }
  .gk-demand-note { font-size: 10px; color: #52606d; margin-top: 14px; }
`;

/** Render the demand inside a same-origin print frame, like the certificate
 *  print flow. The school name is read from the session; the document is a
 *  view of the demand data, not a copy. */
export async function printFeeDemand(demand: FeeDemand, schoolName: string | null) {
  const mountHtml = document.documentElement.lang ? '' : '';
  void mountHtml;
  const frame = document.createElement('iframe');
  frame.title = 'Fee demand print document';
  frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;border:0';
  document.body.append(frame);
  const doc = frame.contentDocument, win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); throw new Error('The browser could not open the print document.'); }
  doc.documentElement.lang = document.documentElement.lang;
  doc.documentElement.dir = document.documentElement.dir;
  doc.title = `Fee demand ${demand.student.admissionNo}`;
  const style = doc.createElement('style'); style.textContent = demandCSS; doc.head.append(style);
  const cur = demand.student.currency || 'INR';
  const money = (v: number) => v ? `${new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(v / 100)}` : '—';
  const rows = demand.heads.map(h => `<tr><td>${h.invoiceNo}</td><td>${h.feeHead}${h.term ? ` (${h.term})` : ''}</td><td class="num">${money(h.billedMinor)}</td><td class="num">${money(h.paidMinor)}</td><td class="num">${money(h.concessionMinor)}</td><td class="num">${money(h.balanceMinor)}</td><td class="num">${h.dueOn}</td></tr>`).join('');
  const mount = doc.createElement('div');
  mount.innerHTML = `<div class="gk-demand">
    <div class="gk-demand-letterhead">
      <div><div class="gk-demand-school">${schoolName || 'School'}</div><div class="gk-demand-sub">Fee demand statement</div></div>
      <div class="gk-demand-title"><h1>Fee Demand</h1><div class="gk-demand-sub">As of ${new Date().toLocaleDateString()}</div></div>
    </div>
    <div class="gk-demand-meta">
      <div><span>Student</span>${demand.student.name}</div>
      <div><span>Admission no</span>${demand.student.admissionNo}</div>
      <div><span>Class / section</span>${[demand.student.className, demand.student.sectionName].filter(Boolean).join(' · ') || '—'}</div>
      <div><span>Academic year</span>${demand.student.yearName || '—'}</div>
    </div>
    <table><thead><tr><th>Invoice</th><th>Fee head</th><th class="num">Billed</th><th class="num">Paid</th><th class="num">Concession</th><th class="num">Balance</th><th class="num">Due</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7" style="text-align:center;color:#52606d;padding:16px">No outstanding fees for this student.</td></tr>`}</tbody>
    </table>
    <div class="gk-demand-foot">
      <div class="gk-demand-note">Total outstanding: ${money(demand.totals.balanceMinor)}${demand.nextDue ? ` · Next due date ${demand.nextDue}` : ''}${demand.lastReceiptNo ? ` · Last receipt ${demand.lastReceiptNo}` : ''}</div>
      <div class="gk-demand-total">Total <span>${money(demand.totals.balanceMinor)}</span></div>
    </div>
  </div>`;
  doc.body.append(mount);
  const cleanup = () => { frame.remove(); };
  win.addEventListener('afterprint', cleanup, { once: true });
  try { win.focus(); win.print(); } catch (error) { cleanup(); throw error; }
}

/** Admin/parent fee-demand drawer for one student: consolidated open dues
 *  per fee head with totals, plus the printable A4 demand document. */
export const FeeDemandDrawer: React.FC<{ studentId: string; studentLabel?: string; open: boolean; onClose: () => void }> = ({ studentId, studentLabel, open, onClose }) => {
  const { schoolName } = useAuth();
  const [data, setData] = useState<FeeDemand>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);
  const load = useCallback(async () => {
    if (!studentId || !open) return;
    setLoading(true); setError('');
    try {
      const r = await apiClient.get(`/api/portal/fee-demand/${studentId}`);
      setData(r.data.data); setError('');
    } catch (e: any) { setData(undefined); setError(e.response?.data?.message || 'Fee demand could not be loaded.'); }
    finally { setLoading(false); }
  }, [studentId, open]);
  useEffect(() => { load(); }, [load]);
  const print = async () => {
    if (!data) return;
    setPrinting(true);
    try { await printFeeDemand(data, schoolName); }
    catch (e: any) { setError(e.message || 'Printing could not start. Please try again.'); }
    finally { setPrinting(false); }
  };
  const cur = data?.student.currency;
  return <Drawer title={`Fee demand — ${studentLabel || data?.student.name || studentId}`} width={720} open={open} onClose={onClose}
    extra={<Space><Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button><Button type="primary" icon={<PrinterOutlined />} loading={printing || loading} disabled={!data} onClick={print}>Print demand</Button></Space>}>
    {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
    <Spin spinning={loading}>{!data ? <Empty description="No fee demand could be loaded." /> : <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Paragraph style={{ marginBottom: 0 }}>
        <Tag>{data.student.name}</Tag><Tag>{data.student.admissionNo}</Tag>
        {[data.student.className, data.student.sectionName].filter(Boolean).map(part => <Tag key={part}>{String(part)}</Tag>)}
        <Typography.Text type="secondary"> {data.student.yearName || ''}</Typography.Text>
      </Typography.Paragraph>
      <Space size={24}>
        <Typography.Text strong>Total outstanding&nbsp;&nbsp;{money(data.totals.balanceMinor, cur)}</Typography.Text>
        {data.nextDue && <Typography.Text type="secondary">Next due&nbsp;&nbsp;{data.nextDue}</Typography.Text>}
        {data.lastReceiptNo && <Typography.Text type="secondary">Last receipt&nbsp;&nbsp;{data.lastReceiptNo}</Typography.Text>}
      </Space>
      <Table size="small" rowKey="invoiceNo" dataSource={data.heads} pagination={false} locale={{ emptyText: <Empty description="No outstanding fees for this student." /> }} columns={[
        { title: 'Invoice', dataIndex: 'invoiceNo' },
        { title: 'Fee head', render: (_: any, r: FeeDemandRow) => `${r.feeHead}${r.term ? ` (${r.term})` : ''}` },
        { title: 'Billed', dataIndex: 'billedMinor', align: 'right' as const, render: (v: number) => money(v, cur) },
        { title: 'Paid', dataIndex: 'paidMinor', align: 'right' as const, render: (v: number) => money(v, cur) },
        { title: 'Concession', dataIndex: 'concessionMinor', align: 'right' as const, render: (v: number) => v ? money(v, cur) : '—' },
        { title: 'Balance', dataIndex: 'balanceMinor', align: 'right' as const, render: (v: number) => <Typography.Text strong>{money(v, cur)}</Typography.Text> },
        { title: 'Due', dataIndex: 'dueOn' },
      ]} />
    </Space>}
    </Spin>
  </Drawer>;
};
