import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SupplierService } from '../services/supplierService';
import { BusinessSettingsService } from '../services/businessSettingsService';
import { useSettingsContext } from '../contexts/SettingsContext';
import type { Purchase, BusinessSettings } from '../types';
import RecordPaymentModal from '../components/inventory/RecordPaymentModal';
import { ArrowLeft, Printer, CreditCard, Trash2, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getReportWatermarkHtml, getReportPrintStyles } from '../utils/reportPrintUtils';

const PurchaseInvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettingsContext();
  const [invoice, setInvoice] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [deleting, setDeleting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const currency = (settings?.default_currency && settings.default_currency !== 'USD') 
    ? settings.default_currency 
    : (business?.default_currency || 'KES');

  useEffect(() => {
    if (id) {
      setLoading(true);
      Promise.all([
        SupplierService.getPurchaseById(id),
        BusinessSettingsService.getSettings()
      ]).then(([data, bData]) => {
        setInvoice(data);
        if (bData) setBusiness(bData);
        setLoading(false);
      }).catch(err => {
        console.error('Error loading purchase invoice:', err);
        setLoading(false);
      });
    }
  }, [id]);

  const printInvoice = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && invoice) {
      const bName = business?.business_name || settings?.business_name || 'Business Manager';
      const logoUrl = business?.logo_url || settings?.logo_url || '';

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Purchase Invoice - ${invoice.purchase_number}</title>
          <meta charset="UTF-8" />
          <style>
            ${getReportPrintStyles('portrait')}

            .invoice-brand-block {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2.5px solid #0f766e;
              padding-bottom: 14px;
              margin-bottom: 20px;
            }
            .invoice-logo { max-width: 170px; max-height: 70px; object-fit: contain; }
            .business-name { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
            .business-info { font-size: 11px; color: #475569; margin-bottom: 2px; }
            .invoice-badge-title { font-size: 22px; font-weight: 800; color: #0f766e; text-align: right; text-transform: uppercase; letter-spacing: 0.5px; }

            .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 22px; page-break-inside: avoid; break-inside: avoid; }
            .supplier-info, .invoice-info { background: #f8fafc; padding: 14px 16px; border-radius: 8px; border: 1px solid #cbd5e1; }
            .supplier-info h3, .invoice-info h3 { margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
            .info-item { margin: 6px 0; font-size: 11px; display: flex; justify-content: space-between; }
            .info-label { font-weight: 600; color: #64748b; }

            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: auto; }
            .items-table th { background: #f1f5f9; padding: 9px 12px; font-weight: 700; color: #334155; border-top: 1px solid #cbd5e1; border-bottom: 1.5px solid #94a3b8; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; }
            .items-table td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
            .items-table tbody tr:nth-child(even) { background-color: #fafbfc; }

            .totals-section { display: flex; justify-content: flex-end; margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid; }
            .totals-table { width: 320px; border-collapse: collapse; }
            .totals-table td { padding: 6px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11.5px; }
            .totals-table .total-row { border-top: 2px solid #0f766e; border-bottom: 2px solid #0f766e; background: #f0fdfa; font-weight: 700; font-size: 12.5px; color: #115e59; }

            .payment-info { background: #f8fafc; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #cbd5e1; page-break-inside: avoid; break-inside: avoid; }
            .payment-info h3 { margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }

            .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 14px; page-break-inside: avoid; break-inside: avoid; }
            .highlight { color: #059669; font-weight: 700; }
            .warning { color: #dc2626; font-weight: 700; }
          </style>
        </head>
        <body>
          ${getReportWatermarkHtml(logoUrl, bName)}
          <div class="report-document-body">
            <div class="invoice-brand-block">
              <div>
                ${logoUrl ? `<img src="${logoUrl}" alt="${bName}" class="invoice-logo" />` : ''}
                <div class="business-name">${bName}</div>
                <div class="business-info"><strong>Address:</strong> ${business?.business_address || settings?.business_address || 'N/A'}</div>
                <div class="business-info"><strong>Phone:</strong> ${business?.business_phone || settings?.business_phone || 'N/A'} &bull; <strong>Email:</strong> ${business?.business_email || settings?.business_email || 'N/A'}</div>
              </div>
              <div>
                <div class="invoice-badge-title">PURCHASE BILL</div>
                <div style="font-size: 13px; font-weight: 700; color: #475569; text-align: right; margin-top: 4px;">#${invoice.purchase_number}</div>
                <div style="text-align: right; margin-top: 6px;">
                  <span class="report-badge" style="background: ${invoice.payment_status === 'paid' ? '#dcfce7' : '#fee2e2'}; color: ${invoice.payment_status === 'paid' ? '#166534' : '#991b1b'}; border-color: ${invoice.payment_status === 'paid' ? '#bbf7d0' : '#fecaca'};">
                    ${String(invoice.payment_status || 'pending').toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div class="invoice-details">
              <div class="supplier-info">
                <h3>Vendor / Supplier Information:</h3>
                <div class="info-item"><span class="info-label">Vendor Name:</span> <strong>${invoice.supplier?.name || (invoice as any).supplier_name || 'N/A'}</strong></div>
                <div class="info-item"><span class="info-label">Vendor Code:</span> ${invoice.supplier?.code || (invoice as any).supplier_code || 'N/A'}</div>
                <div class="info-item"><span class="info-label">Email:</span> ${invoice.supplier?.email || (invoice as any).supplier_email || 'N/A'}</div>
                <div class="info-item"><span class="info-label">Phone:</span> ${invoice.supplier?.phone || (invoice as any).supplier_phone || 'N/A'}</div>
                <div class="info-item"><span class="info-label">Address:</span> ${invoice.supplier?.address || (invoice as any).supplier_address || 'N/A'}</div>
              </div>
              <div class="invoice-info">
                <h3>Order &amp; Purchase Details:</h3>
                <div class="info-item"><span class="info-label">Bill Reference #:</span> <strong>${invoice.purchase_number}</strong></div>
                <div class="info-item"><span class="info-label">Order Date:</span> ${new Date(invoice.purchase_date).toLocaleDateString()}</div>
                <div class="info-item"><span class="info-label">Payment Status:</span> <span class="${invoice.payment_status === 'paid' ? 'highlight' : 'warning'}">${String(invoice.payment_status || 'pending').toUpperCase()}</span></div>
              </div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 50%;">Product / Description</th>
                  <th style="width: 15%; text-align: center;">Qty</th>
                  <th style="width: 17%; text-align: right;">Unit Cost</th>
                  <th style="width: 18%; text-align: right;">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.items?.map(item => `
                  <tr>
                    <td style="font-weight: 600; color: #0f172a;">${item.product?.name || (item as any).product_name || 'Item'}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;">${currency} ${Number(item.unit_cost || 0).toFixed(2)}</td>
                    <td style="text-align: right; font-weight: 600; color: #0f172a;">${currency} ${Number(item.total_amount || 0).toFixed(2)}</td>
                  </tr>
                `).join('') || ''}
              </tbody>
            </table>

            <div class="totals-section">
              <table class="totals-table">
                <tr><td>Subtotal:</td><td style="text-align: right;">${currency} ${Number(invoice.subtotal || 0).toFixed(2)}</td></tr>
                ${Number(invoice.tax_amount || 0) > 0 ? `<tr><td>VAT (${invoice.vat_rate || 0}%):</td><td style="text-align: right;">+${currency} ${Number(invoice.tax_amount || 0).toFixed(2)}</td></tr>` : ''}
                ${Number(invoice.discount_amount || 0) > 0 ? `<tr><td>Discount:</td><td style="text-align: right; color: #166534;">-${currency} ${Number(invoice.discount_amount || 0).toFixed(2)}</td></tr>` : ''}
                <tr class="total-row"><td><strong>Gross Total Billed:</strong></td><td style="text-align: right;"><strong>${currency} ${Number(invoice.total_amount || 0).toFixed(2)}</strong></td></tr>
                ${Number(invoice.wht_amount || 0) > 0 ? `<tr><td style="color: #92400e;">WHT Withheld (${invoice.wht_rate || 0}%):</td><td style="text-align: right; color: #92400e;">-${currency} ${Number(invoice.wht_amount || 0).toFixed(2)}</td></tr>` : ''}
                <tr><td>Paid Amount:</td><td style="text-align: right; color: #059669;">${currency} ${Number(invoice.paid_amount || 0).toFixed(2)}</td></tr>
                <tr class="total-row" style="background: ${(Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0)) > 0 ? '#fff1f2' : '#f0fdf4'}; border-color: ${(Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0)) > 0 ? '#e11d48' : '#16a34a'}; color: ${(Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0)) > 0 ? '#9f1239' : '#14532d'};">
                  <td><strong>Balance Due:</strong></td>
                  <td style="text-align: right;"><strong class="${(Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0)) > 0 ? 'warning' : 'highlight'}">${currency} ${Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0)).toFixed(2)}</strong></td>
                </tr>
              </table>
            </div>

            <div class="payment-info">
              <h3>Payment &amp; Settlement Status</h3>
              <div class="info-item"><span class="info-label">Payment Status:</span> <strong class="${invoice.payment_status === 'paid' ? 'highlight' : 'warning'}">${String(invoice.payment_status || 'pending').toUpperCase()}</strong></div>
              ${invoice.payment_status !== 'paid' ? `
                <div class="info-item" style="margin-top: 6px;"><span class="info-label">Remaining Balance Due:</span> <strong class="warning">${currency} ${Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0)).toFixed(2)}</strong></div>
              ` : ''}
            </div>

            <div class="footer">
              <p style="font-weight: 600; color: #475569; margin-bottom: 4px;">Thank you for your business!</p>
              <p>Generated by ${bName} Enterprise ERP &bull; Printed on ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 350);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Invoice Not Found</h2>
        <p className="text-gray-500 mb-4">The requested purchase invoice could not be located.</p>
        <button onClick={() => navigate('/invoices')} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Back to Invoices</button>
      </div>
    );
  }

  const subtotal = Number(invoice.subtotal || 0);
  const taxAmount = Number(invoice.tax_amount || 0);
  const discountAmount = Number(invoice.discount_amount || 0);
  const totalAmount = Number(invoice.total_amount || 0);
  const paidAmount = Number(invoice.paid_amount || 0);
  const balanceDue = Math.max(0, totalAmount - paidAmount);

  const handleDeleteInvoice = async () => {
    if (!invoice) return;
    if (!window.confirm(`Are you sure you want to delete Purchase Invoice #${invoice.purchase_number}? This will permanently remove the invoice and its items.`)) {
      return;
    }
    setDeleting(true);
    try {
      const success = await SupplierService.deletePurchase(invoice.id);
      if (success) {
        toast.success(`Purchase Invoice #${invoice.purchase_number} deleted successfully`);
        navigate('/invoices');
      } else {
        toast.error('Failed to delete purchase invoice');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error deleting purchase invoice');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            title="Back to Invoices"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Invoice</h1>
            <p className="text-gray-500 text-sm">Purchase #{invoice.purchase_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={printInvoice}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm text-sm font-medium transition-colors"
          >
            <Printer size={16} />
            Print / PDF
          </button>
          {invoice.payment_status !== 'paid' && balanceDue > 0 && (
            <button
              onClick={() => setShowPayment(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 shadow-sm text-sm font-semibold transition-colors"
            >
              <CreditCard size={16} />
              Record Payment
            </button>
          )}
          <button
            onClick={handleDeleteInvoice}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-100 shadow-sm text-sm font-semibold transition-colors disabled:opacity-50"
            title="Delete Invoice"
          >
            <Trash2 size={16} />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        <div ref={printRef}>
          {/* Header */}
          <div className="text-center border-b border-gray-100 pb-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{business?.business_name || settings?.business_name || 'Business Manager'}</h2>
            <p className="text-gray-500 text-sm mt-1">{business?.business_address || settings?.business_address || 'P.O. Box Nairobi, Kenya'}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
              <h3 className="font-semibold text-gray-800 text-xs uppercase tracking-wider mb-2">Supplier Details</h3>
              <p className="font-bold text-gray-900 text-base">{invoice.supplier?.name || (invoice as any).supplier_name || 'N/A'}</p>
              {(invoice.supplier?.code || (invoice as any).supplier_code) && (
                <p className="text-xs text-gray-500 font-mono mt-0.5">Code: {invoice.supplier?.code || (invoice as any).supplier_code}</p>
              )}
              {(invoice.supplier?.email || (invoice as any).supplier_email) && (
                <p className="text-xs text-gray-600 mt-1">{invoice.supplier?.email || (invoice as any).supplier_email}</p>
              )}
              {(invoice.supplier?.phone || (invoice as any).supplier_phone) && (
                <p className="text-xs text-gray-600">{invoice.supplier?.phone || (invoice as any).supplier_phone}</p>
              )}
            </div>
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-2">
              <h3 className="font-semibold text-gray-800 text-xs uppercase tracking-wider mb-2">Invoice Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Invoice Number:</span>
                <span className="font-mono font-bold text-gray-800">{invoice.purchase_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Purchase Date:</span>
                <span className="text-gray-800">{invoice.purchase_date ? new Date(invoice.purchase_date).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-gray-500">Payment Status:</span>
                <span className={`px-2.5 py-0.5 text-xs rounded-full uppercase font-bold ${
                  invoice.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                  invoice.payment_status === 'partial' ? 'bg-amber-100 text-amber-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {invoice.payment_status || 'pending'}
                </span>
              </div>
            </div>
          </div>

          <table className="w-full border-collapse mb-6">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="p-3">Product / Description</th>
                <th className="p-3 text-right">Quantity</th>
                <th className="p-3 text-right">Unit Cost</th>
                <th className="p-3 text-right">Total ({currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(!invoice.items || invoice.items.length === 0) ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-400 text-sm">No items in this invoice</td>
                </tr>
              ) : invoice.items.map((item, idx) => (
                <tr key={item.id || idx} className="text-sm hover:bg-gray-50/50">
                  <td className="p-3 text-gray-900 font-medium">{item.product?.name || (item as any).product_name || 'Item'}</td>
                  <td className="p-3 text-right text-gray-600 font-mono">{item.quantity}</td>
                  <td className="p-3 text-right text-gray-600 font-mono">{currency} {Number(item.unit_cost || 0).toFixed(2)}</td>
                  <td className="p-3 text-right text-gray-900 font-semibold font-mono">{currency} {Number(item.total_amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end bg-gray-50 p-6 rounded-xl border border-gray-100">
            <table className="text-right text-sm min-w-[280px]">
              <tbody className="space-y-2">
                <tr>
                  <td className="pr-4 text-gray-500">Subtotal:</td>
                  <td className="font-mono font-medium">{currency} {subtotal.toFixed(2)}</td>
                </tr>
                {taxAmount > 0 && (
                  <tr>
                    <td className="pr-4 text-gray-500">VAT ({invoice.vat_rate || 0}% on Goods):</td>
                    <td className="font-mono font-semibold text-blue-700">+{currency} {taxAmount.toFixed(2)}</td>
                  </tr>
                )}
                {discountAmount > 0 && (
                  <tr className="border-b border-gray-200 pb-2">
                    <td className="pr-4 text-gray-500">Discount:</td>
                    <td className="font-mono font-medium text-red-600">-{currency} {discountAmount.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="pt-2 border-t border-gray-200">
                  <td className="pr-4 text-gray-900 font-bold text-base">Gross Total Billed:</td>
                  <td className="font-bold text-base text-gray-900 font-mono">{currency} {totalAmount.toFixed(2)}</td>
                </tr>
                {Number(invoice.wht_amount || 0) > 0 && (
                  <tr>
                    <td className="pr-4 text-amber-800 font-medium">WHT Withheld ({invoice.wht_rate || 0}% on Services):</td>
                    <td className="font-mono font-bold text-amber-800">-{currency} {Number(invoice.wht_amount || 0).toFixed(2)}</td>
                  </tr>
                )}
                <tr>
                  <td className="pr-4 text-gray-500">Amount Paid:</td>
                  <td className="font-mono font-semibold text-emerald-600">{currency} {paidAmount.toFixed(2)}</td>
                </tr>
                <tr className="pt-1 border-t border-gray-200">
                  <td className="pr-4 text-gray-900 font-bold">Balance Due:</td>
                  <td className={`font-mono font-bold text-base ${balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {currency} {balanceDue.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText size={14} className="text-emerald-600" /> Payment & Transaction Notes
            </h4>
            <p className="text-sm text-slate-700 whitespace-pre-line font-medium leading-relaxed">{invoice.notes}</p>
          </div>
        )}

        {invoice.payment_status !== 'paid' && balanceDue > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
            <button 
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2" 
              onClick={() => setShowPayment(true)}
            >
              <CreditCard size={18} />
              Record Payment
            </button>
          </div>
        )}
      </div>

      <RecordPaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        invoice={invoice}
        onPayment={() => {
          setShowPayment(false);
          SupplierService.getPurchaseById(id!).then(data => setInvoice(data));
        }}
      />
    </div>
  );
};

export default PurchaseInvoiceDetail;
 