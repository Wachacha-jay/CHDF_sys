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
  const businessName = businessDetails?.businessName || 'BizManager';
  const businessAddress = businessDetails?.businessAddress || '';
  const businessPhone = businessDetails?.businessPhone || '';
  const businessEmail = businessDetails?.businessEmail || '';
  const logoUrl = businessDetails?.logoUrl || '';
  const currency = businessDetails?.currency || 'USD';

  if (receiptWindow) {
    if (thermalPrinter) {
      // Thermal printer optimized version
      receiptWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Receipt - ${receipt.saleNumber}</title>
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
            <div class="bold">PAYMENT RECEIPT</div>
            <div class="divider"></div>
          </div>

          <div>Invoice #: ${receipt.saleNumber}</div>
          <div>Customer: ${receipt.customerName}</div>
          <div>Date: ${receipt.date} ${receipt.time}</div>
          <div class="divider"></div>

          <div class="item-row">
            <span>Invoice Total:</span>
            <span>${currency} ${receipt.total.toFixed(2)}</span>
          </div>
          <div class="item-row">
            <span>Previously Paid:</span>
            <span>${currency} ${((receipt.paidAmount || 0) - (receipt.paymentAmount || 0)).toFixed(2)}</span>
          </div>
          <div class="item-row bold">
            <span>Amount Paid Today (${receipt.paymentMethod.toUpperCase()}):</span>
            <span>${currency} ${receipt.paymentAmount?.toFixed(2) || '0.00'}</span>
          </div>
          <div class="total-row">
            <div class="item-row bold">
              <span>Remaining Balance:</span>
              <span>${currency} ${receipt.balance?.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          <div class="center">
            <div class="divider"></div>
            <div>Thank you for your payment!</div>
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
          <title>Payment Receipt - ${receipt.saleNumber}</title>
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
            .payment-details { background: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #0ea5e9; }
            .payment-item { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
            .payment-item.total { border-top: 2px solid #0ea5e9; margin-top: 15px; padding-top: 15px; font-weight: bold; font-size: 16px; color: #0f172a; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
            .highlight { color: #059669; font-weight: 600; }
            .warning { color: #dc2626; font-weight: 600; }
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
            <div class="receipt-title">Payment Receipt</div>
          </div>

          <div class="receipt-number">Invoice #${receipt.saleNumber}</div>

          <div class="info-grid">
            <div class="info-section">
              <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">Customer Information</h3>
              <p style="margin: 5px 0;"><strong>Name:</strong> ${receipt.customerName}</p>
            </div>
            <div class="info-section">
              <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">Payment Details</h3>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${receipt.date}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${receipt.time}</p>
            </div>
          </div>

          <div class="payment-details">
            <div class="payment-item">
              <span>Invoice Total:</span>
              <span>${currency} ${receipt.total.toFixed(2)}</span>
            </div>
            <div class="payment-item">
              <span>Previously Paid:</span>
              <span>${currency} ${((receipt.paidAmount || 0) - (receipt.paymentAmount || 0)).toFixed(2)}</span>
            </div>
            <div class="payment-item highlight">
              <span>Amount Paid Today (${receipt.paymentMethod.toUpperCase()}):</span>
              <span>${currency} ${(receipt.paymentAmount || 0).toFixed(2)}</span>
            </div>
            <div class="payment-item total">
              <span>Remaining Balance:</span>
              <span class="warning">${currency} ${(receipt.balance || 0).toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for your payment!</p>
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

export function printReceipt(receipt: ReceiptData, businessDetails?: ReceiptBusinessDetails, thermalPrinter: boolean = false) {
  const receiptWindow = window.open('', '_blank');
  const businessName = businessDetails?.businessName || 'BizManager';
  const businessAddress = businessDetails?.businessAddress || '';
  const businessPhone = businessDetails?.businessPhone || '';
  const businessEmail = businessDetails?.businessEmail || '';
  const logoUrl = businessDetails?.logoUrl || '';
  const currency = businessDetails?.currency || 'USD';

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