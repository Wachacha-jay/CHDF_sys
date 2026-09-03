import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { SupplierService } from '../services/supplierService';
import { BusinessSettingsService } from '../services/businessSettingsService';
import type { Purchase, BusinessSettings } from '../types';
import RecordPaymentModal from '../components/inventory/RecordPaymentModal';

const PurchaseInvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      SupplierService.getPurchaseById(id).then(data => {
        setInvoice(data);
        setLoading(false);
      });
      BusinessSettingsService.getSettings().then(setBusiness);
    }
  }, [id]);

  const printInvoice = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && invoice && business) {
      const logoUrl = business.logo_url || '';
      const currency = (business.default_currency && business.default_currency !== 'USD') ? business.default_currency : 'KES';

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
            ${logoUrl ? `<img src="${logoUrl}" alt="${business.business_name}" class="logo" />` : ''}
            <div class="business-name">${business.business_name}</div>
            <div class="business-info"><strong>Address:</strong> ${business.business_address || 'N/A'}</div>
            <div class="business-info"><strong>Phone:</strong> ${business.business_phone || 'N/A'}</div>
            <div class="business-info"><strong>Email:</strong> ${business.business_email || 'N/A'}</div>
            <div class="invoice-title">Purchase Invoice</div>
          </div>

          <div class="invoice-details">
            <div class="supplier-info">
              <h3>Supplier Information</h3>
              <div class="info-item"><span class="info-label">Supplier:</span> ${invoice.supplier?.name || 'N/A'}</div>
              <div class="info-item"><span class="info-label">Code:</span> ${invoice.supplier?.code || 'N/A'}</div>
              <div class="info-item"><span class="info-label">Email:</span> ${invoice.supplier?.email || 'N/A'}</div>
              <div class="info-item"><span class="info-label">Phone:</span> ${invoice.supplier?.phone || 'N/A'}</div>
              <div class="info-item"><span class="info-label">Address:</span> ${invoice.supplier?.address || 'N/A'}</div>
            </div>
            <div class="invoice-info">
              <h3>Purchase Details</h3>
              <div class="info-item"><span class="info-label">Invoice #:</span> ${invoice.purchase_number}</div>
              <div class="info-item"><span class="info-label">Date:</span> ${new Date(invoice.purchase_date).toLocaleDateString()}</div>
              <div class="info-item"><span class="info-label">Status:</span> <span class="${invoice.payment_status === 'paid' ? 'highlight' : 'warning'}">${invoice.payment_status.toUpperCase()}</span></div>
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
                  <td>${item.product?.name || 'N/A'}</td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: right;">${currency} ${item.unit_cost.toFixed(2)}</td>
                  <td style="text-align: right;">${currency} ${item.total_amount.toFixed(2)}</td>
                </tr>
              `).join('') || ''}
            </tbody>
          </table>

          <div class="totals">
            <table>
              <tr><td>Subtotal:</td><td style="text-align: right;">${currency} ${invoice.subtotal.toFixed(2)}</td></tr>
              <tr><td>Tax:</td><td style="text-align: right;">${currency} ${invoice.tax_amount.toFixed(2)}</td></tr>
              <tr><td>Discount:</td><td style="text-align: right;">${currency} ${invoice.discount_amount.toFixed(2)}</td></tr>
              <tr class="total-row"><td><strong>Total:</strong></td><td style="text-align: right;"><strong>${currency} ${invoice.total_amount.toFixed(2)}</strong></td></tr>
              <tr><td>Paid:</td><td style="text-align: right;" class="highlight">${currency} ${invoice.paid_amount.toFixed(2)}</td></tr>
              <tr class="total-row"><td><strong>Balance:</strong></td><td style="text-align: right;"><strong class="warning">${currency} ${(invoice.total_amount - invoice.paid_amount).toFixed(2)}</strong></td></tr>
            </table>
          </div>

          <div class="payment-info">
            <h3>Payment Information</h3>
            <div class="info-item"><span class="info-label">Payment Status:</span> <span class="${invoice.payment_status === 'paid' ? 'highlight' : 'warning'}">${invoice.payment_status.toUpperCase()}</span></div>
            ${invoice.payment_status !== 'paid' ? `
              <div class="info-item"><strong>Outstanding Balance:</strong> <span class="warning">${currency} ${(invoice.total_amount - invoice.paid_amount).toFixed(2)}</span></div>
            ` : ''}
          </div>

          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Generated by ${business.business_name} - ${new Date().toLocaleDateString()}</p>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!invoice) return <div className="p-6">Invoice not found.</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Invoice</h1>
          <p className="text-gray-600">Purchase #{invoice.purchase_number}</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={printInvoice}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Print
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div ref={printRef}>
          {/* Header */}
          <div className="text-center border-b border-gray-200 pb-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{business?.business_name || 'Business Manager'}</h2>
            <p className="text-gray-600">{business?.business_address || 'N/A'}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Supplier Information</h3>
              <div className="bg-gray-50 p-4 rounded-lg text-sm">
                <p className="font-medium text-gray-900">{invoice.supplier?.name}</p>
                <p className="text-gray-600">{invoice.supplier?.code}</p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Invoice Highlights</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p><strong>Date:</strong> {new Date(invoice.purchase_date).toLocaleDateString()}</p>
                <p><strong>Status:</strong> 
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full uppercase font-semibold ${
                    invoice.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                    invoice.payment_status === 'partial' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {invoice.payment_status}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <table className="w-full border-collapse mb-6">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="p-3 border-b border-gray-200">Product</th>
                <th className="p-3 border-b border-gray-200 text-right">Qty</th>
                <th className="p-3 border-b border-gray-200 text-right">Unit Cost</th>
                <th className="p-3 border-b border-gray-200 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.items?.map(item => (
                <tr key={item.id} className="text-sm">
                  <td className="p-3 text-gray-900 font-medium">{item.product?.name}</td>
                  <td className="p-3 text-right text-gray-600">{item.quantity}</td>
                  <td className="p-3 text-right text-gray-600">${item.unit_cost.toFixed(2)}</td>
                  <td className="p-3 text-right text-gray-900 font-medium">${item.total_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end bg-gray-50 p-6 rounded-lg">
            <table className="text-right text-sm">
              <tbody className="space-y-2">
                <tr>
                  <td className="pr-4 text-gray-500">Subtotal:</td>
                  <td className="font-medium">${invoice.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="pr-4 text-gray-500">Tax:</td>
                  <td className="font-medium">${invoice.tax_amount.toFixed(2)}</td>
                </tr>
                <tr className="border-b border-gray-200 pb-2">
                  <td className="pr-4 text-gray-500">Discount:</td>
                  <td className="font-medium">-${invoice.discount_amount.toFixed(2)}</td>
                </tr>
                <tr className="pt-2">
                  <td className="pr-4 text-gray-900 font-bold text-lg">Total:</td>
                  <td className="font-bold text-lg text-gray-900">${invoice.total_amount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="pr-4 text-gray-500">Paid:</td>
                  <td className="font-medium text-green-600">${invoice.paid_amount.toFixed(2)}</td>
                </tr>
                <tr className="pt-1">
                  <td className="pr-4 text-gray-900 font-bold">Balance:</td>
                  <td className="font-bold text-red-600">${(invoice.total_amount - invoice.paid_amount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {invoice.payment_status !== 'paid' && (
          <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
            <button 
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 shadow-sm transition-colors" 
              onClick={() => setShowPayment(true)}
            >
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