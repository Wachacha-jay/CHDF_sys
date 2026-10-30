/**
 * Enterprise Report & Invoicing Print Utilities
 * Provides standardized multi-page document pagination, page-break / orphan prevention,
 * business logo watermarking, and modern typography.
 */

export interface ReportHeaderOptions {
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  logoUrl?: string;
  reportTitle: string;
  periodLabel?: string;
  departmentName?: string;
  documentNumber?: string;
}

export interface ReportFooterOptions {
  preparedBy?: string;
  businessName: string;
  systemName?: string;
}

/**
 * Generates subtle, professional watermark overlay markup that repeats across all pages
 */
export function getReportWatermarkHtml(logoUrl?: string, businessName?: string): string {
  if (logoUrl) {
    return `
      <div class="watermark-overlay" aria-hidden="true">
        <img src="${logoUrl}" class="watermark-image" alt="Watermark" />
      </div>
    `;
  }
  if (businessName) {
    return `
      <div class="watermark-overlay" aria-hidden="true">
        <div class="watermark-text">${businessName}</div>
      </div>
    `;
  }
  return '';
}

/**
 * Returns comprehensive, production-grade CSS for seamless multi-page print continuity
 */
export function getReportPrintStyles(orientation: 'portrait' | 'landscape' = 'portrait'): string {
  return `
    @page {
      size: A4 ${orientation};
      margin: 12mm 12mm 16mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Fixed Watermark (Positioned Fixed repeats across every printed page in @media print) */
    .watermark-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }

    .watermark-image {
      max-width: 480px;
      max-height: 480px;
      width: 62%;
      opacity: 0.045; /* subtle, does not obscure printed numbers or tables */
      transform: rotate(-25deg);
      filter: grayscale(100%) contrast(120%);
      object-fit: contain;
    }

    .watermark-text {
      font-size: 52px;
      font-weight: 900;
      color: #0f172a;
      opacity: 0.035;
      transform: rotate(-25deg);
      text-transform: uppercase;
      letter-spacing: 6px;
      text-align: center;
      line-height: 1.2;
    }

    /* Relative document container above watermark */
    .report-document-body {
      position: relative;
      z-index: 1;
      background: transparent;
      padding: 6px 0;
    }

    /* Header Styling */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #2563eb;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }

    .org-brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .org-logo {
      max-height: 60px;
      max-width: 130px;
      object-fit: contain;
    }

    .org-name {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.2;
    }

    .org-contact {
      font-size: 10px;
      color: #64748b;
      margin-top: 3px;
    }

    .report-meta {
      text-align: right;
    }

    .report-title {
      font-size: 15px;
      font-weight: 800;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .report-cycle {
      font-size: 10.5px;
      font-weight: 600;
      color: #475569;
      margin-top: 3px;
    }

    .report-badge {
      display: inline-block;
      font-size: 9.5px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      background: #eef2ff;
      color: #3730a3;
      border: 1px solid #c7d2fe;
      margin-top: 4px;
    }

    /* ------------------------------------------------------------- */
    /* MULTI-PAGE CONTINUITY & ORPHAN PREVENTION (SENIOR ENG DESIGN) */
    /* ------------------------------------------------------------- */

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      page-break-inside: auto;
    }

    /* Repeat table column headers on every single printed page */
    thead {
      display: table-header-group !important;
    }

    tfoot {
      display: table-footer-group !important;
    }

    /* Prevent table rows from splitting mid-row across pages */
    tr, .table-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* HEADINGS MUST NEVER BE THE LAST ELEMENT ON A PAGE */
    /* If a heading appears near the page break, push it to start the next page */
    h1, h2, h3, h4, h5, h6,
    .section-title,
    .term-section-header,
    .category-header,
    .table-header,
    .header-row,
    .card-header {
      page-break-after: avoid !important;
      break-after: avoid !important;
      break-inside: avoid !important;
    }

    /* Prevent cards, summary panels, and signatures from splitting */
    .card,
    .card-info,
    .summary-grid,
    .standing-box,
    .profile-box,
    .signature-block,
    .report-footer,
    .payment-info {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* Prevent single trailing lines (orphans & widows) */
    p, div, td, th {
      orphans: 3;
      widows: 3;
    }

    /* Standardized typography and cells */
    th {
      background-color: #f1f5f9;
      color: #334155;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 8px;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1.5px solid #94a3b8;
      text-align: left;
    }

    td {
      padding: 6.5px 8px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 10px;
      vertical-align: top;
    }

    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }

    .text-right { text-align: right; }
    .text-center { text-align: center; }

    .total-row td {
      background: #f8fafc;
      font-weight: 800;
      font-size: 10.5px;
      border-top: 1.5px solid #94a3b8;
      border-bottom: 2px solid #334155;
      color: #0f172a;
    }

    /* Modern Footer */
    .report-footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9.5px;
      color: #64748b;
    }

    @media print {
      .no-print {
        display: none !important;
      }
    }
  `;
}

/**
 * Standardized Report Header HTML
 */
export function getReportHeaderHtml(options: ReportHeaderOptions): string {
  const {
    businessName,
    businessAddress,
    businessPhone,
    businessEmail,
    logoUrl,
    reportTitle,
    periodLabel,
    departmentName,
    documentNumber
  } = options;

  return `
    <div class="report-header">
      <div class="org-brand">
        ${logoUrl ? `<img src="${logoUrl}" class="org-logo" alt="${businessName}" />` : ''}
        <div>
          <div class="org-name">${businessName}</div>
          <div class="org-contact">
            ${businessAddress ? `<span>${businessAddress}</span> &bull; ` : ''}
            ${businessPhone ? `<span>Tel: ${businessPhone}</span> &bull; ` : ''}
            ${businessEmail ? `<span>Email: ${businessEmail}</span>` : ''}
          </div>
          ${departmentName ? `<div style="font-size: 11px; font-weight: 700; color: #1e40af; margin-top: 2px;">Department: ${departmentName}</div>` : ''}
        </div>
      </div>
      <div class="report-meta">
        <div class="report-title">${reportTitle}</div>
        ${periodLabel ? `<div class="report-cycle">${periodLabel}</div>` : ''}
        ${documentNumber ? `<div class="report-badge font-mono">${documentNumber}</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Standardized Report Footer HTML
 */
export function getReportFooterHtml(options: ReportFooterOptions): string {
  const { preparedBy, businessName, systemName = 'Accounting & ERP System' } = options;
  const printTimestamp = new Date().toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return `
    <div class="report-footer">
      <div>
        Prepared by: <strong>${preparedBy || 'Authorized Officer'}</strong>
      </div>
      <div>
        Generated on: ${printTimestamp}
      </div>
      <div>
        ${systemName} &bull; ${businessName}
      </div>
    </div>
  `;
}
