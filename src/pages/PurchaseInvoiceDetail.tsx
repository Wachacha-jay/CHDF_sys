import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SupplierService } from '../services/supplierService';
import { BusinessSettingsService } from '../services/businessSettingsService';
import { useSettingsContext } from '../contexts/SettingsContext';
import type { Purchase, BusinessSettings } from '../types';
import RecordPaymentModal from '../components/inventory/RecordPaymentModal';
import { ArrowLeft, Printer, CreditCard } from 'lucide-react';

const PurchaseInvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettingsContext();
  const [invoice, setInvoice] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
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
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #333; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { max-width: 120px; height: auto; margin-bottom: 10px; }
            .business-name { font-size: 24px; font-weight: bold; color: #1f2937; margin: 10px 0; }
            .business-info { font-size: 14px; color: #6b7280; margin-bottom: 5px; }
            .invoice-title { font-size: 20px; font-weight: bold; color: #2563eb; margin: 15px 0; }
            .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .supplier-info, .invoice-info { background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
            .supplier-info h3, .invoice-info h3 { margin: 0 0 15px 0; font-size: 16px; font-weight: bold; color: #374151; }
            .info-item { margin: 8px 0; }
            .info-label { font-weight: 600; color: #6b7280; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th, .items-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            .items-table th { background: #f9fafb; font-weight: bold; color: #374151; }
            .items-table .total-row { background: #f0f9ff; border-top: 2px solid #0ea5e9; }
            .items-table .total-row td { font-weight: bold; color: #0f172a; }
            .totals { text-align: right; margin-bottom: 30px; }
            .totals table { margin-left: auto; border-collapse: collapse; }
            .totals td { padding: 8px 20px; border-bottom: 1px solid #e5e7eb; }
            .totals .total-row { border-bottom: 2px solid #0ea5e9; font-weight: bold; font-size: 16px; color: #0f172a; }
            .payment-info { background: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #0ea5e9; }
            .payment-info h3 { margin: 0 0 15px 0; color: #0f172a; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
            .highlight { color: #059669; font-weight: 600; }
            .warning { color: #dc2626; font-weight: 600; }
            @media print { body { margin: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${bName}" class="logo" />` : ''}
            <div class="business-name">${bName}</div>
            <div class="business-info"><strong>Address:</strong> ${business?.business_address || settings?.business_address || 'N/A'}</div>
            <div class="business-info"><strong>Phone:</strong> ${business?.business_phone || settings?.business_phone || 'N/A'}</div>
            <div class="business-info"><strong>Email:</strong> ${business?.business_email || settings?.business_email || 'N/A'}</div>
            <div class="invoice-title">Purchase Invoice</div>
          </div>

          <div class="invoice-details">
            <div class="supplier-info">
              <h3>Supplier Information</h3>
              <div class="info-item"><span class="info-label">Supplier:</span> ${invoice.supplier?.name || (invoice as any).supplier_name || 'N/A'}</div>
              <div class="info-item"><span class="info-label">Code:</span> ${invoice.supplier?.code || (invoice as any).supplier_code || 'N/A'}</div>
              <div class="info-item"><span class="info-label">Email:</span> ${invoice.supplier?.email || (invoice as any).supplier_email || 'N/A'}</div>
              <div class="info-item"><span class="info-label">Phone:</span> ${invoice.supplier?.phone || (invoice as any).supplier_phone || 'N/A'}</div>
              <div class="info-item"><span class="info-label">Address:</span> ${invoice.supplier?.address || (invoice as any).supplier_address || 'N/A'}</div>
            </div>
            <div class="invoice-info">
              <h3>Purchase Details</h3>
              <div class="info-item"><span class="info-label">Invoice #:</span> ${invoice.purchase_number}</div>
              <div class="info-item"><span class="info-label">Date:</span> ${new Date(invoice.purchase_date).toLocaleDateString()}</div>
              <div class="info-item"><span class="info-label">Status:</span> <span class="${invoice.payment_status === 'paid' ? 'highlight' : 'warning'}">${String(invoice.payment_status || 'pending').toUpperCase()}</span></div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Cost</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items?.map(item => `
                <tr>
                  <td>${item.product?.name || (item as any).product_name || 'Item'}</td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: right;">${currency} ${Number(item.unit_cost || 0).toFixed(2)}</td>
                  <td style="text-align: right;">${currency} ${Number(item.total_amount || 0).toFixed(2)}</td>
                </tr>
              `).join('') || ''}
            </tbody>
          </table>

          <div class="totals">
            <table>
              <tr><td>Subtotal:</td><td style="text-align: right;">${currency} ${Number(invoice.subtotal || 0).toFixed(2)}</td></tr>
              <tr><td>Tax:</td><td style="text-align: right;">${currency} ${Number(invoice.tax_amount || 0).toFixed(2)}</td></tr>
              <tr><td>Discount:</td><td style="text-align: right;">${currency} ${Number(invoice.discount_amount || 0).toFixed(2)}</td></tr>
              <tr class="total-row"><td><strong>Total:</strong></td><td style="text-align: right;"><strong>${currency} ${Number(invoice.total_amount || 0).toFixed(2)}</strong></td></tr>
              <tr><td>Paid:</td><td style="text-align: right;" class="highlight">${currency} ${Number(invoice.paid_amount || 0).toFixed(2)}</td></tr>
              <tr class="total-row"><td><strong>Balance:</strong></td><td style="text-align: right;"><strong class="warning">${currency} ${Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0)).toFixed(2)}</strong></td></tr>
            </table>
          </div>

          <div class="payment-info">
            <h3>Payment Information</h3>
            <div class="info-item"><span class="info-label">Payment Status:</span> <span class="${invoice.payment_status === 'paid' ? 'highlight' : 'warning'}">${String(invoice.payment_status || 'pending').toUpperCase()}</span></div>
            ${invoice.payment_status !== 'paid' ? `
              <div class="info-item"><strong>Outstanding Balance:</strong> <span class="warning">${currency} ${Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0)).toFixed(2)}</span></div>
            ` : ''}
          </div>

          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Generated by ${bName} - ${new Date().toLocaleDateString()}</p>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
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
                    <td className="pr-4 text-gray-500">Tax (VAT):</td>
                    <td className="font-mono font-medium">{currency} {taxAmount.toFixed(2)}</td>
                  </tr>
                )}
                {discountAmount > 0 && (
                  <tr className="border-b border-gray-200 pb-2">
                    <td className="pr-4 text-gray-500">Discount:</td>
                    <td className="font-mono font-medium text-red-600">-{currency} {discountAmount.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="pt-2 border-t border-gray-200">
                  <td className="pr-4 text-gray-900 font-bold text-base">Total Amount:</td>
                  <td className="font-bold text-base text-gray-900 font-mono">{currency} {totalAmount.toFixed(2)}</td>
                </tr>
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
 