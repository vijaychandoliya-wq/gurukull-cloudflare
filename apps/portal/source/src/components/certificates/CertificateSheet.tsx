import React from 'react';
export const CERTIFICATE_DESIGNS=[
 {id:'classic',name:'Classic navy',color:'#18345c',border:'double',font:'Georgia, serif'},
 {id:'gold',name:'Gold heritage',color:'#876321',border:'double',font:'Georgia, serif'},
 {id:'academic',name:'Academic green',color:'#21583f',border:'solid',font:'Georgia, serif'},
 {id:'crimson',name:'Crimson formal',color:'#8b2435',border:'double',font:'Georgia, serif'},
 {id:'minimal',name:'Minimal ink',color:'#202020',border:'solid',font:'Arial, sans-serif'},
 {id:'royal',name:'Royal violet',color:'#56367d',border:'double',font:'Georgia, serif'},
 {id:'modern',name:'Modern teal',color:'#17686b',border:'solid',font:'Arial, sans-serif'},
 {id:'deco',name:'Art deco',color:'#775c31',border:'ridge',font:'Georgia, serif'},
 {id:'botanical',name:'Botanical frame',color:'#436443',border:'groove',font:'Georgia, serif'},
 {id:'traditional',name:'Traditional maroon',color:'#682d35',border:'ridge',font:'Georgia, serif'},
] as const;
export type CertificateDesign=typeof CERTIFICATE_DESIGNS[number];
export function certificateDesign(id:string|null){return CERTIFICATE_DESIGNS.find(d=>d.id===id)||CERTIFICATE_DESIGNS[0];}
export const certificateCSS=`
.gk-certificate{--certificate-accent:#18345c;box-sizing:border-box;width:100%;max-width:794px;min-height:1050px;padding:48px;background:#fff!important;color:#18202b!important;border:9px double var(--certificate-accent);font-size:16px;line-height:1.75;overflow-wrap:anywhere;position:relative;display:flex;flex-direction:column;gap:22px;}
.gk-certificate *{box-sizing:border-box;color:inherit;}
.gk-certificate header{text-align:center;border-bottom:2px solid var(--certificate-accent);padding-bottom:24px;break-inside:avoid;}
.gk-certificate h1{font-size:30px;margin:0 0 10px;color:var(--certificate-accent);line-height:1.3;}
.gk-certificate h2{font-size:27px;letter-spacing:1px;margin:20px 0 8px;color:var(--certificate-accent);line-height:1.4;}
.gk-certificate p{margin:0;}
.gk-certificate-meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:13px;}
.gk-certificate-body{white-space:pre-wrap;line-height:1.9;}
.gk-certificate footer{display:flex;justify-content:space-between;gap:32px;margin-top:auto;padding-top:72px;break-inside:avoid;}
.gk-certificate footer span{max-width:45%;border-top:1px solid var(--certificate-accent);padding-top:10px;min-width:100px;}
.gk-certificate[data-design=gold]{outline:1px solid #876321;outline-offset:-18px;}
.gk-certificate[data-design=academic]{border-width:5px;border-top-width:22px;}
.gk-certificate[data-design=crimson] header{border-bottom-style:double;border-bottom-width:6px;}
.gk-certificate[data-design=minimal]{border-width:1px;}
.gk-certificate[data-design=royal]{outline:2px dotted #56367d;outline-offset:-20px;}
.gk-certificate[data-design=modern]{border-width:2px;border-inline-start-width:18px;}
.gk-certificate[data-design=deco]{border-width:12px;outline:2px solid #775c31;outline-offset:-24px;}
.gk-certificate[data-design=botanical]{border-radius:35px 0 35px 0;border-width:8px;}
.gk-certificate[data-design=traditional]{border-width:12px;border-top-width:22px;border-bottom-width:22px;}
.gk-certificate-void{border:2px solid #a00000;color:#a00000!important;padding:12px;text-align:center;font-weight:bold;}
@media(max-width:600px){.gk-certificate{padding:24px;min-height:850px}.gk-certificate h1{font-size:24px}.gk-certificate h2{font-size:22px}}
@media print{@page{size:A4 portrait;margin:12mm}html,body{margin:0!important;background:white!important}.gk-certificate,.gk-certificate *{visibility:visible!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}.gk-certificate{width:100%;max-width:none;min-height:270mm;padding:12mm;font-size:12pt;box-shadow:none;}.gk-certificate h1{font-size:24pt}.gk-certificate h2{font-size:21pt}}
`;
export function CertificateSheet({record,design}:{record:any;design:CertificateDesign}){
 return <article className="gk-certificate" data-design={design.id} style={{'--certificate-accent':design.color,borderStyle:design.border,fontFamily:design.font} as React.CSSProperties}>
  <header><h1>{record.schoolName}</h1>{record.schoolAddress&&<p>{record.schoolAddress}</p>}<h2>{record.headerTitle}</h2>{record.subheader&&<p>{record.subheader}</p>}</header>
  {record.status==='void'&&<p className="gk-certificate-void">VOID — {record.voidReason}</p>}
  <div className="gk-certificate-meta"><span>Certificate number: {record.certificateNo}</span><span>Issue date: {record.issueDate}</span></div>
  <div className="gk-certificate-body">{record.bodyContent}</div>
  {(record.footerLeft||record.footerRight)&&<footer>{record.footerLeft&&<span>{record.footerLeft}</span>}{record.footerRight&&<span>{record.footerRight}</span>}</footer>}
 </article>;
}
