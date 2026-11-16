// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import {CertificateSheet} from '../components/certificates/CertificateSheet';
import {CERTIFICATE_DESIGNS,certificateDesign} from '../components/certificates/CertificateDesigns';

it('CertificateSheet renders with all ten designs',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const record={schoolName:'Test School',schoolAddress:'Address',headerTitle:'Certificate',certificateNo:'CERT-1',issueDate:'2026-01-01',bodyContent:'Test body',status:'issued'};
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 try{
  for(const design of CERTIFICATE_DESIGNS){
   await act(async()=>root.render(<CertificateSheet record={record} design={design}/>));
   expect(container.innerHTML.length).toBeGreaterThan(0);
   expect(container.textContent).toContain('Test School');
   expect(container.textContent).toContain('Test body');
  }
 }finally{await act(async()=>root.unmount());container.remove();}
});

it('renders all ten certificate designs with valid structure',()=>{
 expect(new Set(CERTIFICATE_DESIGNS.map(d=>d.id)).size).toBe(10);
 CERTIFICATE_DESIGNS.forEach(d=>{
  expect(d.name.length).toBeGreaterThan(0);
  expect(d.colors.primary).toMatch(/^#[0-9a-f]{6}$/i);
  expect(['ornate','minimal','modern','classic','elegant']).toContain(d.layout.borderStyle);
  expect(d.category).toBeTruthy();
  expect(d.layout.hasCornerFlourish).toBeDefined();
  expect(d.layout.hasSeal).toBeDefined();
  expect(d.layout.hasRibbon).toBeDefined();
  expect(d.typography.headingFont.length).toBeGreaterThan(0);
 });
});

it('returns the academic_blue design for an invalid id',()=>{
 expect(certificateDesign('nonexistent').id).toBe('academic_blue');
});

it('preserves design ids through lookup',()=>{
 CERTIFICATE_DESIGNS.forEach(d=>{
  expect(certificateDesign(d.id).id).toBe(d.id);
 });
});
