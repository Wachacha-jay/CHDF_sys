import type { CartItem } from '../hooks/useCart';

type PaymentMethod = 'cash' | 'mpesa' | 'card';

export interface ReceiptBusinessDetails {
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessWebsite?: string;
  logoUrl?: string;
  currency?: string;
}

export interface ReceiptData {
  saleNumber: string;
  customerName: string;
  items: CartItem[];
  total: number;
  paidAmount?: number;
  balance?: number;
  paymentAmount?: number;
  paymentMethod: string;
  date: string;
  time: string;
  type?: 'sale' | 'payment' | 'donation' | 'school_fee';
  childName?: string;
  donorName?: string;
  fundName?: string;
}

export function generateReceipt(
  saleNumber: string, 
  customerName: string, 
  cart: CartItem[], 
  total: number, 
  paymentMethod: PaymentMethod,
  options?: {
    type?: 'sale' | 'payment' | 'donation' | 'school_fee';
    childName?: string;
    donorName?: string;
    fundName?: string;
  }
): ReceiptData {
  const now = new Date();
  return {
    saleNumber,
    customerName: customerName || 'Walk-in Customer',
    items: cart,
    total,
    paymentMethod,
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
    ...options
  };
}

export function printPaymentReceipt(receipt: ReceiptData, businessDetails?: ReceiptBusinessDetails, thermalPrinter: boolean = false) {
  const receiptWindow = window.open('', '_blank');
  const businessName = businessDetails?.businessName || 'BIZMANAGER';
  const businessAddress = businessDetails?.businessAddress || 'Nairobi, Kenya';
  const businessPhone = businessDetails?.businessPhone || '';
  const businessEmail = businessDetails?.businessEmail || '';
  const logoUrl = businessDetails?.logoUrl || '';
  const currency = (businessDetails?.currency && businessDetails.currency !== 'USD') ? businessDetails.currency : 'KES';
  const isSchoolFee = receipt.type === 'school_fee';
  const receiptTitle = isSchoolFee ? 'SCHOOL FEE PAYMENT RECEIPT' : 'PAYMENT RECEIPT';
  const accentColor = isSchoolFee ? '#4f46e5' : '#2563eb';

  if (receiptWindow) {
    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${receiptTitle} - ${receipt.saleNumber}</title>
        <meta charset="UTF-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 13px;
            color: #1e293b;
            background: #fff;
            padding: 32px 40px;
            line-height: 1.6;
          }

          /* ─── LETTERHEAD ─── */
          .letterhead {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid ${accentColor};
            padding-bottom: 20px;
            margin-bottom: 24px;
          }
          .letterhead-left { display: flex; align-items: center; gap: 16px; }
          .logo {
            max-width: 80px;
            max-height: 80px;
            object-fit: contain;
            border-radius: 8px;
          }
          .logo-placeholder {
            width: 64px;
            height: 64px;
            border-radius: 12px;
            background: ${accentColor};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 900;
            font-size: 20px;
            letter-spacing: -1px;
          }
          .business-name {
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.5px;
          }
          .business-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
          .letterhead-right { text-align: right; font-size: 12px; color: #64748b; line-height: 1.8; }
          .receipt-badge {
            display: inline-block;
            background: ${accentColor};
            color: white;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            padding: 4px 12px;
            border-radius: 20px;
            margin-bottom: 6px;
          }

          /* ─── RECEIPT REFERENCE ROW ─── */
          .ref-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px 20px;
            margin-bottom: 24px;
          }
          .ref-row .ref-no { font-size: 18px; font-weight: 800; color: ${accentColor}; }
          .ref-row .ref-date { font-size: 12px; color: #64748b; text-align: right; }
          .ref-row .ref-date strong { display: block; font-size: 14px; color: #1e293b; }

          /* ─── INFO GRID ─── */
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 24px;
          }
          .info-box {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px 18px;
          }
          .info-box h4 {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.2px;
            color: #94a3b8;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid #f1f5f9;
          }
          .info-box p { font-size: 13px; color: #334155; margin: 3px 0; }
          .info-box p strong { color: #0f172a; }

          /* ─── SCHOOL FEE BAND ─── */
          .fee-band {
            background: linear-gradient(135deg, ${accentColor}15 0%, ${accentColor}05 100%);
            border: 1.5px solid ${accentColor}40;
            border-radius: 12px;
            padding: 20px 24px;
            margin-bottom: 24px;
          }
          .fee-band-header {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.2px;
            color: ${accentColor};
            margin-bottom: 14px;
            padding-bottom: 8px;
            border-bottom: 1px dashed ${accentColor}40;
          }
          .fee-row {
            display: flex;
            justify-content: space-between;
            padding: 7px 0;
            font-size: 13px;
            border-bottom: 1px solid ${accentColor}15;
          }
          .fee-row:last-child { border-bottom: none; }
          .fee-row.total-row {
            margin-top: 8px;
            padding-top: 12px;
            border-top: 2px solid ${accentColor}40;
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
          }
          .amount-pill {
            background: ${accentColor};
            color: white;
            font-weight: 700;
            padding: 2px 12px;
            border-radius: 20px;
            font-size: 14px;
          }

          /* ─── TYPE BADGE ─── */
          .type-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
          }
          .type-inflow { background: #d1fae5; color: #065f46; }
          .type-outflow { background: #fef3c7; color: #92400e; }

          /* ─── FOOTER ─── */
          .receipt-footer {
            margin-top: 32px;
            padding-top: 18px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
          }
          .receipt-footer p { font-size: 11px; color: #94a3b8; margin: 3px 0; }
          .receipt-footer .thank-you { font-size: 14px; font-weight: 700; color: ${accentColor}; margin-bottom: 6px; }
          .watermark {
            margin-top: 16px;
            font-size: 10px;
            color: #cbd5e1;
            letter-spacing: 0.5px;
          }

          @media print {
            body { padding: 16px 24px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>

        <!-- LETTERHEAD -->
        <div class="letterhead">
          <div class="letterhead-left">
            ${logoUrl
              ? `<img src="${logoUrl}" alt="${businessName}" class="logo" />`
              : `<div class="logo-placeholder">${businessName.charAt(0)}</div>`
            }
            <div>
              <div class="business-name">${businessName}</div>
              <div class="business-sub">Fund &amp; Program Accounting</div>
            </div>
          </div>
          <div class="letterhead-right">
            <div class="receipt-badge">${receiptTitle}</div>
            ${businessAddress ? `<div>${businessAddress}</div>` : ''}
            ${businessPhone ? `<div>Tel: ${businessPhone}</div>` : ''}
            ${businessEmail ? `<div>${businessEmail}</div>` : ''}
          </div>
        </div>

        <!-- REFERENCE ROW -->
        <div class="ref-row">
          <div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Journal / Entry Reference</div>
            <div class="ref-no">${receipt.saleNumber}</div>
          </div>
          <div class="ref-date">
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Transaction Date</div>
            <strong>${receipt.date}</strong>
            <span style="color: #94a3b8;">${receipt.time !== 'N/A' ? receipt.time : ''}</span>
          </div>
        </div>

        <!-- INFO GRID -->
        <div class="info-grid">
          <div class="info-box">
            <h4>${isSchoolFee ? 'Guardian / Payer' : 'Customer'}</h4>
            <p><strong>${receipt.customerName || 'N/A'}</strong></p>
            ${receipt.childName ? `<p style="margin-top: 6px; font-size: 12px; color: #64748b;">Beneficiary Child</p><p><strong>${receipt.childName}</strong></p>` : ''}
          </div>
          <div class="info-box">
            <h4>Program Details</h4>
            ${receipt.fundName ? `<p><strong>Fund:</strong> ${receipt.fundName}</p>` : ''}
            <p><strong>Payment Method:</strong> ${receipt.paymentMethod.toUpperCase()}</p>
            <p><strong>Transaction Type:</strong>
              <span class="type-badge ${receipt.paymentMethod.includes('Fund') ? 'type-outflow' : 'type-inflow'}">
                ${isSchoolFee ? (receipt.paymentMethod.includes('Fund') ? 'NGO Outflow' : 'Guardian Inflow') : receipt.type || 'Payment'}
              </span>
            </p>
          </div>
        </div>

        <!-- FEE BREAKDOWN -->
        <div class="fee-band">
          <div class="fee-band-header">
            ${isSchoolFee ? 'School Fee Breakdown' : 'Payment Breakdown'}
          </div>
          ${receipt.items.map(item => `
            <div class="fee-row">
              <span>${item.name}</span>
              <span>${currency} ${(item.quantity * item.unitPrice).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
            </div>
          `).join('')}
          <div class="fee-row total-row">
            <span>Total Amount</span>
            <span class="amount-pill">${currency} ${receipt.total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="receipt-footer">
          <p class="thank-you">✓ Payment Recorded &amp; Posted to General Ledger</p>
          <p>This is a system-generated official receipt. Keep it for your records.</p>
          <p>All school fee transactions are linked to the child beneficiary for audit trail purposes.</p>
          <div class="watermark">Generated by ${businessName} Fund Accounting System — ${new Date().toLocaleString()}</div>
        </div>

      </body>
      </html>
    `);
    receiptWindow.document.close();
    receiptWindow.print();
  }
}



export function printReceipt(receipt: ReceiptData, businessDetails?: ReceiptBusinessDetails, thermalPrinter: boolean = false) {
  const receiptWindow = window.open('', '_blank');
  const businessName = businessDetails?.businessName || 'BizManager';
  const businessAddress = businessDetails?.businessAddress || '';
  const businessPhone = businessDetails?.businessPhone || '';
  const businessEmail = businessDetails?.businessEmail || '';
  const logoUrl = businessDetails?.logoUrl || '';
  const currency = (businessDetails?.currency && businessDetails.currency !== 'USD') ? businessDetails.currency : 'KES';

  if (receiptWindow) {
    if (thermalPrinter) {
      // Thermal printer optimized version - narrow, monospace font
      receiptWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - ${receipt.saleNumber}</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.2; margin: 0; padding: 5px; width: 80mm; color: #000; }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 5px 0; }
            .logo { max-width: 60px; height: auto; display: block; margin: 0 auto 5px; }
            .item-row { display: flex; justify-content: space-between; margin: 2px 0; }
            .total-row { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin: 5px 0; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="center">
            ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" class="logo" />` : ''}
            <div class="bold">${businessName}</div>
            ${businessAddress ? `<div>Address: ${businessAddress}</div>` : ''}
            ${businessPhone ? `<div>Phone: ${businessPhone}</div>` : ''}
            ${businessEmail ? `<div>Email: ${businessEmail}</div>` : ''}
            <div class="divider"></div>
            <div class="bold">SALES RECEIPT</div>
            <div class="divider"></div>
          </div>

          <div>Receipt #: ${receipt.saleNumber}</div>
          <div>Customer: ${receipt.customerName}</div>
          <div>Date: ${receipt.date} ${receipt.time}</div>
          <div>Payment: ${receipt.paymentMethod.toUpperCase()}</div>
          <div class="divider"></div>

          <div class="bold">Items:</div>
          ${receipt.items.map(item => `
            <div class="item-row">
              <span>${item.product.name.substring(0, 20)}${item.product.name.length > 20 ? '...' : ''}</span>
              <span>${item.quantity}x ${currency} ${item.unitPrice.toFixed(2)}</span>
            </div>
          `).join('')}

          <div class="divider"></div>
          <div class="total-row">
            <div class="item-row">
              <span class="bold">TOTAL:</span>
              <span class="bold">${currency} ${receipt.total.toFixed(2)}</span>
            </div>
          </div>

          <div class="center">
            <div class="divider"></div>
            <div>Thank you for your business!</div>
            <div>Generated: ${new Date().toLocaleString()}</div>
          </div>
        </body>
        </html>
      `);
    } else {
      // Standard A4 printer version
      receiptWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - ${receipt.saleNumber}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #333; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { max-width: 120px; height: auto; margin-bottom: 10px; }
            .business-name { font-size: 24px; font-weight: bold; color: #1f2937; margin: 10px 0; }
            .business-info { font-size: 14px; color: #6b7280; margin-bottom: 5px; }
            .receipt-title { font-size: 20px; font-weight: bold; color: #2563eb; margin: 15px 0; }
            .receipt-number { font-size: 18px; font-weight: bold; margin-bottom: 20px; background: #f3f4f6; padding: 10px; border-radius: 6px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .info-section { background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th, .items-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            .items-table th { background: #f9fafb; font-weight: bold; color: #374151; }
            .items-table .total-row { background: #f0f9ff; border-top: 2px solid #0ea5e9; }
            .items-table .total-row td { font-weight: bold; color: #0f172a; }
            .summary { background: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #0ea5e9; }
            .summary-item { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
            .summary-item.total { border-top: 2px solid #0ea5e9; margin-top: 15px; padding-top: 15px; font-weight: bold; font-size: 16px; color: #0f172a; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
            .highlight { color: #059669; font-weight: 600; }
            @media print { body { margin: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" class="logo" />` : ''}
            <div class="business-name">${businessName}</div>
            ${businessAddress ? `<div class="business-info"><strong>Address:</strong> ${businessAddress}</div>` : ''}
            ${businessPhone ? `<div class="business-info"><strong>Phone:</strong> ${businessPhone}</div>` : ''}
            ${businessEmail ? `<div class="business-info"><strong>Email:</strong> ${businessEmail}</div>` : ''}
            <div class="receipt-title">Sales Receipt</div>
          </div>

          <div class="receipt-number">Receipt #${receipt.saleNumber}</div>

          <div class="info-grid">
            <div class="info-section">
              <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">${receipt.type === 'donation' ? 'Donor Information' : 'Customer Information'}</h3>
              <p style="margin: 5px 0;"><strong>Name:</strong> ${receipt.customerName}</p>
              ${receipt.donorName ? `<p style="margin: 5px 0;"><strong>Sponsor:</strong> ${receipt.donorName}</p>` : ''}
              ${receipt.childName ? `<p style="margin: 5px 0;"><strong>Beneficiary:</strong> ${receipt.childName}</p>` : ''}
              ${receipt.fundName ? `<p style="margin: 5px 0;"><strong>Project/Fund:</strong> ${receipt.fundName}</p>` : ''}
            </div>
            <div class="info-section">
              <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">Transaction Details</h3>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${receipt.date}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${receipt.time}</p>
              <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${receipt.paymentMethod.toUpperCase()}</p>
              ${receipt.type ? `<p style="margin: 5px 0;"><strong>Type:</strong> <span style="text-transform: uppercase; font-weight: bold;">${receipt.type.replace('_', ' ')}</span></p>` : ''}
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${receipt.items.map(item => `
                <tr>
                  <td>${item.product.name}</td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: right;">${currency} ${item.unitPrice.toFixed(2)}</td>
                  <td style="text-align: right;">${currency} ${(item.quantity * item.unitPrice).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-item total">
              <span>Total:</span>
              <span class="highlight">${currency} ${receipt.total.toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Keep this receipt for your records.</p>
            <p>Generated by ${businessName} - ${new Date().toLocaleString()}</p>
          </div>
        </body>
        </html>
      `);
    }
    receiptWindow.document.close();
    receiptWindow.print();
  }
} 