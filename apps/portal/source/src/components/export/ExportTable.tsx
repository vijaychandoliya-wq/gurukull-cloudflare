import {useRef,useState,type ReactNode} from 'react';
import {Alert,Button,Table as AntTable,type TableProps} from 'antd';
import {FilePdfOutlined} from '@ant-design/icons';
import {printTablePdf,snapshotTable} from './tablePdf';
export function TablePdfPanel({children,disabled=false}:{children:ReactNode;disabled?:boolean}){
 const root=useRef<HTMLDivElement>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const exportPdf=async()=>{try{setBusy(true);setError('');if(!root.current)return;const title=document.querySelector('#portal-main h1,#portal-main h2,.gk-content h1,.gk-content h2')?.textContent||document.title||'Table report';const school=document.querySelector('.gk-shell')?.getAttribute('data-school-name')||'';await printTablePdf(snapshotTable(root.current),title,school);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <div className="gk-exportable-table" ref={root}><div className="gk-table-pdf-toolbar"><span>PDF includes current loaded rows. Choose “Save as PDF” in the print dialog.</span><Button icon={<FilePdfOutlined/>} size="small" loading={busy} disabled={disabled} onClick={()=>void exportPdf()}>Export PDF</Button></div>{error&&<Alert type="error" message={error} showIcon closable onClose={()=>setError('')}/>}{children}</div>;
}
function ExportableTable<Row extends object=Record<string,unknown>>(props:TableProps<Row>){return <TablePdfPanel disabled={!!props.loading||!props.dataSource?.length}><AntTable<Row> {...props}/></TablePdfPanel>;}
export const Table=Object.assign(ExportableTable,AntTable) as typeof AntTable;
