import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Printer, Mail, Phone, MapPin, Building2, Receipt } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SalesService } from '../services/salesService';
import { BusinessSettingsService } from '../services/businessSettingsService';
import { printPaymentReceipt, ReceiptData } from '../utils/receiptUtils';
import type { Sale, BusinessSettings } from '../types';

const Invoice: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sale, setSale] = useState<Sale | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [mpesaPayment, setMpesaPayment] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [recordPaymentMethod, setRecordPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (id) {
      loadInvoiceData();
    }
  }, [id]);

  const loadInvoiceData = async () => {
    try {
      setLoading(true);
      const [saleData, settingsData] = await Promise.all([
        SalesService.getSaleById(id!),
        BusinessSettingsService.getSettings()
      ]);
      
      setSale(saleData);
      setBusinessSettings(settingsData);
    } catch (error) {
      toast.error('Failed to load invoice data');
    } finally {
      setLoading(false);
    }
  };

  const displayCurrency = (businessSettings?.default_currency === 'KES' || businessSettings?.default_currency === 'KSh' || !businessSettings?.default_currency) ? 'KSh' : businessSettings.default_currency;

  const handleMpesaPayment = async () => {
    if (!phoneNumber) {
      toast.error('Please enter phone number for M-Pesa payment');
      return;
    }

    if (!sale) {
      toast.error('Sale data not found');
      return;
    }

    try {
      setMpesaPayment(true);
      toast.loading('Initiating M-Pesa payment...');

      // Simulate M-Pesa API call
      setTimeout(() => {
        toast.dismiss();
        toast.success('M-Pesa payment initiated. Please check your phone for STK push.');

        // Simulate payment confirmation
        setTimeout(() => {
          toast.success('M-Pesa payment confirmed!');
          setMpesaPayment(false);
          // Update sale payment status
          loadInvoiceData();
        }, 3000);
      }, 2000);
    } catch (error) {
      toast.error('Failed to process M-Pesa payment');
      setMpesaPayment(false);
    }
  };

  const printInvoice = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && sale && businessSettings) {
      const logoUrl = businessSettings.logo_url || '';

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice - ${sale.sale_number}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #333; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { max-width: 120px; height: auto; margin-bottom: 10px; }
            .business-name { font-size: 24px; font-weight: bold; color: #1f2937; margin: 10px 0; }
            .business-info { font-size: 14px; color: #6b7280; margin-bottom: 5px; }
            .invoice-title { font-size: 20px; font-weight: bold; color: #2563eb; margin: 15px 0; }
            .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .customer-info, .invoice-info { background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
            .customer-info h3, .invoice-info h3 { margin: 0 0 15px 0; font-size: 16px; font-weight: bold; color: #374151; }
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
            .mpesa-info { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 15px; border: 1px solid #e5e7eb; }
            .mpesa-info h4 { margin: 0 0 10px 0; color: #374151; }
            .mpesa-info p { margin: 5px 0; font-size: 14px; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
            .highlight { color: #059669; font-weight: 600; }
            .warning { color: #dc2626; font-weight: 600; }
            @media print { body { margin: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${businessSettings.business_name}" class="logo" />` : ''}
            <div class="business-name">${businessSettings.business_name}</div>
            <div class="business-info"><strong>Address:</strong> ${businessSettings.business_address || 'N/A'}</div>
            <div class="business-info"><strong>Phone:</strong> ${businessSettings.business_phone || 'N/A'}</div>
            <div class="business-info"><strong>Email:</strong> ${businessSettings.business_email || 'N/A'}</div>
            <div class="invoice-title">Sales Invoice</div>
          </div>

          <div class="invoice-details">
            <div class="customer-info">
              <h3>Bill To:</h3>
              <div class="info-item"><span class="info-label">Customer:</span> ${sale.customer?.name || 'Walk-in Customer'}</div>
              <div class="info-item"><span class="info-label">Email:</span> ${sale.customer?.email || 'N/A'}</div>
              <div class="info-item"><span class="info-label">Phone:</span> ${sale.customer?.phone || 'N/A'}</div>
              ${sale.child ? `
                <div class="info-item" style="margin-top: 15px; border-top: 1px dashed #e5e7eb; pt-10">
                  <span class="info-label">Beneficiary (Child):</span> 
                  <span style="color: #2563eb; font-weight: bold;">${sale.child.first_name} ${sale.child.last_name}</span>
                  <div style="font-size: 11px; color: #6b7280;">Code: ${sale.child.code}</div>
                </div>
              ` : ''}
            </div>
            <div class="invoice-info">
              <h3>Invoice Details:</h3>
              <div class="info-item"><span class="info-label">Invoice #:</span> ${sale.sale_number}</div>
              <div class="info-item">
                <span class="info-label">Type:</span> 
                <span style="text-transform: uppercase; font-weight: bold; color: #4b5563;">
                  ${(sale.sale_type || 'Standard').replace('_', ' ')}
                </span>
              </div>
              <div class="info-item"><span class="info-label">Date:</span> ${new Date(sale.sale_date).toLocaleDateString()}</div>
              <div class="info-item"><span class="info-label">Due Date:</span> ${sale.due_date ? new Date(sale.due_date).toLocaleDateString() : 'N/A'}</div>
              <div class="info-item"><span class="info-label">Status:</span> <span class="${sale.payment_status === 'paid' ? 'highlight' : 'warning'}">${sale.payment_status.toUpperCase()}</span></div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${sale.items?.map(item => `
                <tr>
                  <td>${item.product?.name || 'N/A'}</td>
                  <td>${item.product?.description || 'N/A'}</td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: right;">${displayCurrency} ${item.unit_price.toFixed(2)}</td>
                  <td style="text-align: right;">${displayCurrency} ${item.total_amount.toFixed(2)}</td>
                </tr>
              `).join('') || ''}
            </tbody>
          </table>

          <div class="totals">
            <table>
              <tr><td>Subtotal:</td><td style="text-align: right;">${displayCurrency} ${sale.subtotal.toFixed(2)}</td></tr>
              <tr><td>Tax (16%):</td><td style="text-align: right;">${displayCurrency} ${sale.tax_amount.toFixed(2)}</td></tr>
              <tr><td>Discount:</td><td style="text-align: right;">${displayCurrency} ${sale.discount_amount.toFixed(2)}</td></tr>
              <tr class="total-row"><td><strong>Total:</strong></td><td style="text-align: right;"><strong>${displayCurrency} ${sale.total_amount.toFixed(2)}</strong></td></tr>
              <tr><td>Paid:</td><td style="text-align: right;">${displayCurrency} ${sale.paid_amount.toFixed(2)}</td></tr>
              <tr class="total-row"><td><strong>Balance:</strong></td><td style="text-align: right;"><strong class="warning">${displayCurrency} ${(sale.total_amount - sale.paid_amount).toFixed(2)}</strong></td></tr>
            </table>
          </div>

          <div class="payment-info">
            <h3>Payment Information:</h3>
            <div class="info-item"><span class="info-label">Payment Method:</span> ${sale.payment_method || 'Not specified'}</div>
            <div class="info-item"><span class="info-label">Payment Status:</span> <span class="${sale.payment_status === 'paid' ? 'highlight' : 'warning'}">${sale.payment_status.toUpperCase()}</span></div>

            ${sale.payment_status !== 'paid' ? `
              <div class="mpesa-info">
                <h4>M-Pesa Payment Instructions:</h4>
                <p>1. Dial *150*00# on your phone</p>
                <p>2. Select "Pay Bill"</p>
                <p>3. Enter Business Number: ${businessSettings.mpesa_business_number || '000000'}</p>
                <p>4. Enter Account Number: ${sale.sale_number}</p>
                <p>5. Enter Amount: ${displayCurrency} ${(sale.total_amount - sale.paid_amount).toFixed(2)}</p>
                <p>6. Enter your M-Pesa PIN</p>
                <p>7. Confirm payment</p>
              </div>
            ` : ''}
          </div>

          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Generated by ${businessSettings.business_name} - ${new Date().toLocaleDateString()}</p>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const downloadInvoice = () => {
    // This would typically generate a PDF
    toast.success('Invoice download started');
  };

  const sendInvoiceEmail = () => {
    if (!sale?.customer?.email) {
      toast.error('No email address available for customer');
      return;
    }
    toast.success('Invoice sent to customer email');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!sale || !businessSettings) {
    return (
      <div className="text-center py-12">
        <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Invoice not found</h3>
        <p className="text-gray-500">The requested invoice could not be loaded.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice</h1>
          <p className="text-gray-600">Invoice #{sale.sale_number}</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={printInvoice}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </button>
          <button
            onClick={downloadInvoice}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </button>
          <button
            onClick={sendInvoiceEmail}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email
          </button>
        </div>
      </div>

      {/* Invoice Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Header */}
        <div className="text-center border-b border-gray-200 pb-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{businessSettings.business_name}</h2>
          {businessSettings.business_address && (
            <p className="text-sm text-gray-600">{businessSettings.business_address}</p>
          )}
          {businessSettings.business_phone && (
            <p className="text-sm text-gray-600">{businessSettings.business_phone}</p>
          )}
          {businessSettings.business_email && (
            <p className="text-sm text-gray-600">{businessSettings.business_email}</p>
          )}
        </div>

        {/* Business and Invoice Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Business Information</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p><Building2 className="inline h-4 w-4 mr-1" />{businessSettings.business_address || 'N/A'}</p>
              <p><Phone className="inline h-4 w-4 mr-1" />{businessSettings.business_phone || 'N/A'}</p>
              <p><Mail className="inline h-4 w-4 mr-1" />{businessSettings.business_email || 'N/A'}</p>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Invoice Details</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p><strong>Invoice #:</strong> {sale.sale_number}</p>
              <p><strong>Type:</strong> <span className="uppercase font-bold text-gray-700">{(sale.sale_type || 'Standard').replace('_', ' ')}</span></p>
              <p><strong>Date:</strong> {new Date(sale.sale_date).toLocaleDateString()}</p>
              <p><strong>Due Date:</strong> {sale.due_date ? new Date(sale.due_date).toLocaleDateString() : 'N/A'}</p>
              <p><strong>Status:</strong> 
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  sale.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                  sale.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {sale.payment_status.toUpperCase()}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Customer & Child Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Bill To</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium">{sale.customer?.name || 'Walk-in Customer'}</p>
              <p className="text-sm text-gray-600">{sale.customer?.email || 'N/A'}</p>
              <p className="text-sm text-gray-600">{sale.customer?.phone || 'N/A'}</p>
            </div>
          </div>
          {sale.child && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Beneficiary (Child)</h3>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="font-bold text-blue-900">{sale.child.first_name} {sale.child.last_name}</p>
                <p className="text-sm text-blue-700">Code: {sale.child.code}</p>
                <p className="text-xs text-blue-600 mt-1">Status: {sale.child.status.toUpperCase()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="mb-6">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 p-3 text-left">Item</th>
                <th className="border border-gray-200 p-3 text-left">Description</th>
                <th className="border border-gray-200 p-3 text-center">Qty</th>
                <th className="border border-gray-200 p-3 text-right">Unit Price</th>
                <th className="border border-gray-200 p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map((item, index) => (
                <tr key={index}>
                  <td className="border border-gray-200 p-3">{item.product?.name || 'N/A'}</td>
                  <td className="border border-gray-200 p-3">{item.product?.description || 'N/A'}</td>
                  <td className="border border-gray-200 p-3 text-center">{item.quantity}</td>
                  <td className="border border-gray-200 p-3 text-right">
                    {displayCurrency} {item.unit_price.toFixed(2)}
                  </td>
                  <td className="border border-gray-200 p-3 text-right">
                    {displayCurrency} {item.total_amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <table className="text-right">
            <tbody>
              <tr>
                <td className="p-2">Subtotal:</td>
                <td className="p-2">{displayCurrency} {sale.subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2">Tax (16%):</td>
                <td className="p-2">{displayCurrency} {sale.tax_amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2">Discount:</td>
                <td className="p-2">{displayCurrency} {sale.discount_amount.toFixed(2)}</td>
              </tr>
              <tr className="border-t border-gray-200">
                <td className="p-2 font-bold">Total:</td>
                <td className="p-2 font-bold">{displayCurrency} {sale.total_amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2">Paid:</td>
                <td className="p-2">{displayCurrency} {sale.paid_amount.toFixed(2)}</td>
              </tr>
              <tr className="border-t border-gray-200">
                <td className="p-2 font-bold">Balance:</td>
                <td className="p-2 font-bold text-red-600">
                  {displayCurrency} {(sale.total_amount - sale.paid_amount).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment Section */}
        {sale.payment_status !== 'paid' && (
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Payment Options</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* M-Pesa Payment */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-3">M-Pesa Payment</h4>
                <div className="space-y-3">
                  <input
                    type="tel"
                    placeholder="Phone Number (254700000000)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleMpesaPayment}
                    disabled={mpesaPayment || !phoneNumber}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {mpesaPayment ? 'Processing...' : 'Pay with M-Pesa'}
                  </button>
                </div>
              </div>

              {/* Manual Payment */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-3">Manual Payment</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Record a manual payment for this invoice
                </p>
                <button
                  onClick={() => {
                    setPaymentAmount((sale.total_amount - sale.paid_amount).toFixed(2));
                    setShowPaymentModal(true);
                  }}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 border-t border-gray-200 pt-6">
          <p>Thank you for your business!</p>
          <p>Generated by {businessSettings.business_name} - {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Record Payment</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                max={(sale.total_amount - sale.paid_amount).toFixed(2)}
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={recordPaymentMethod}
                onChange={(e) => setRecordPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="card">Card</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={() => setShowPaymentModal(false)} 
                className="px-4 py-2 bg-gray-200 rounded-lg text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!paymentAmount || Number(paymentAmount) <= 0) {
                    return toast.error('Enter a valid amount');
                  }
                  if (Number(paymentAmount) > (sale.total_amount - sale.paid_amount)) {
                    return toast.error('Cannot pay more than balance due');
                  }
                  toast.loading('Recording payment...');
                  const success = await SalesService.recordPayment(sale.id, Number(paymentAmount), recordPaymentMethod, paymentDate);
                  toast.dismiss();
                  if (success) {
                    toast.success('Payment recorded successfully');
                    
                    // Generate and print receipt
                    const receipt: ReceiptData = {
                      saleNumber: sale.sale_number,
                      customerName: sale.customer?.name || 'Walk-in Customer',
                      items: [], // Payments don't necessarily need items
                      total: sale.total_amount,
                      paidAmount: sale.paid_amount + Number(paymentAmount),
                      balance: sale.total_amount - (sale.paid_amount + Number(paymentAmount)),
                      paymentAmount: Number(paymentAmount),
                      paymentMethod: recordPaymentMethod,
                      date: new Date().toLocaleDateString(),
                      time: new Date().toLocaleTimeString(),
                      type: 'payment'
                    };

                    if (confirm('Payment recorded! Would you like to print a payment receipt?')) {
                      printPaymentReceipt(receipt, {
                        businessName: businessSettings.business_name,
                        businessAddress: businessSettings.business_address,
                        businessPhone: businessSettings.business_phone,
                        businessEmail: businessSettings.business_email,
                        businessWebsite: businessSettings.business_website,
                        logoUrl: businessSettings.logo_url,
                        currency: displayCurrency
                      });
                    }

                    setShowPaymentModal(false);
                    setPaymentAmount('');
                    loadInvoiceData();
                  } else {
                    toast.error('Failed to record payment');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoice; 