import React from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {CertificateSheet, getPatternComponent} from './CertificateSheet';
import type { CertificateDesignType } from './CertificateDesigns';

let dispose: (() => void) | undefined;

export function disposeCertificatePrint() {
  dispose?.();
}

export async function printCertificate(record: any, design: CertificateDesignType, options?: { logo?: string | null }) {
  if (!record.bodyContent?.trim()) throw new Error('Add the school-approved certificate wording before printing.');
  dispose?.();

  let logoDataUrl: string | undefined;
  if (options?.logo) {
    try {
      const response = await fetch(options.logo, { credentials: 'same-origin' });
      if (response.ok) {
        const blob = await response.blob();
        logoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      // Proceed without logo if the fetch fails in the print context.
    }
  }

  const frame = document.createElement('iframe');
  frame.title = 'Certificate print document';
  frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;border:0';
  document.body.append(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw new Error('The browser could not open the print document.');
  }

  doc.documentElement.lang = document.documentElement.lang;
  doc.documentElement.dir = document.documentElement.dir;
  doc.title = `Certificate ${String(record.certificateNo || '')}`;

  const printCSS = `
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${design.typography.bodyFont}; color: ${design.colors.text}; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
      .gk-certificate { visibility: visible !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  `;
  const style = doc.createElement('style');
  style.textContent = printCSS;
  doc.head.append(style);

  const mount = doc.createElement('div');
  doc.body.append(mount);
  const root = createRoot(mount);

  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    root.unmount();
    frame.remove();
    if (dispose === cleanup) dispose = undefined;
  };
  dispose = cleanup;

  win.addEventListener('afterprint', cleanup, { once: true });
  try {
    flushSync(() => root.render(<CertificateSheet record={record} design={design} logo={logoDataUrl || undefined} />));
    await doc.fonts?.ready;
    if (!frame.isConnected) throw new Error('Printing cancelled because the certificate page was closed.');
    win.focus();
    win.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}
