import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, User, Mail, Phone, FileText, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ApiService } from '../services/api';
import { SalesService } from '../services/salesService';
import type { Customer, Sale } from '../types';
import { useSettingsContext } from '../contexts/SettingsContext';

const Customers: React.FC = () => {
  const { settings } = useSettingsContext();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: ''
  });

  // Orders View State
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Sale[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (selectedCustomer) {
      setFormData({
        name: selectedCustomer.name,
        code: selectedCustomer.code,
        email: selectedCustomer.email || '',
        phone: selectedCustomer.phone || '',
        address: selectedCustomer.address || ''
      });
    } else {
      setFormData({
        name: '',
        code: '',
        email: '',
        phone: '',
        address: ''
      });
    }
  }, [selectedCustomer, showModal]);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const [customersResponse, salesResponse] = await Promise.all([
        ApiService.get<Customer>('customers', { filters: { is_active: true } }),
        ApiService.get<Sale>('sales')
      ]);
      
      if (customersResponse.success && customersResponse.data) {
        let filteredCustomers = customersResponse.data;
        const sales = salesResponse.success ? (salesResponse.data || []) : [];
        
        filteredCustomers = filteredCustomers.map(customer => {
          const cSales = sales.filter(s => s.customer_id === customer.id);
          return {
            ...customer,
            total_orders: cSales.length,
            total_spent: cSales.reduce((sum, s) => sum + (Number(s.paid_amount) || 0), 0)
          };
        });
        
        if (searchTerm) {
          const lowerSearch = searchTerm.toLowerCase();
          filteredCustomers = filteredCustomers.filter(customer =>
            customer.name.toLowerCase().includes(lowerSearch) ||
            customer.email?.toLowerCase().includes(lowerSearch) ||
            customer.code?.toLowerCase().includes(lowerSearch)
          );
        }
        
        setCustomers(filteredCustomers);
      }
    } catch (error) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadCustomers();
  };

  const handleViewOrders = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingOrders(true);
    setShowOrdersModal(true);
    try {
      const response = await ApiService.get<Sale>('sales', {
        filters: { customer_id: customer.id }
      });
      if (response.success) {
        setCustomerOrders(response.data || []);
      }
    } catch (error) {
      toast.error('Failed to load customer orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  const isWalkInCustomer = (customer: Customer | null) => {
    if (!customer) return true;
    const name = (customer.name || '').toLowerCase().trim();
    const code = (customer.code || '').toLowerCase().trim();
    return name === 'walk-in' || name === 'walk in' || name === 'walk-in customer' || code === 'walk-in';
  };

  const handlePrintCustomerStatement = async (customer: Customer, existingOrders?: Sale[]) => {
    if (isWalkInCustomer(customer)) {
      toast.error('Customer statement cannot be generated for walk-in customers. Statements are only available for registered customer accounts.');
      return;
    }

    let orders = existingOrders;
    if (!orders) {
      toast.loading('Fetching customer transaction ledger...');
      try {
        const response = await ApiService.get<Sale>('sales', {
          filters: { customer_id: customer.id }
        });
        toast.dismiss();
        if (response.success && response.data) {
          orders = response.data;
        } else {
          orders = [];
        }
      } catch (err) {
        toast.dismiss();
        toast.error('Failed to load transactions for statement');
        return;
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print customer statement');
      return;
    }

    const businessName = settings?.business_name || 'Business Management System';
    const businessAddress = settings?.business_address || '';
    const businessPhone = settings?.business_phone || '';
    const businessEmail = settings?.business_email || '';
    const logoUrl = settings?.logo_url || '';
    const currency = settings?.default_currency || 'KES';

    // Sort chronologically
    const sortedOrders = [...orders].sort(
      (a, b) => new Date(a.sale_date || a.created_at || '').getTime() - new Date(b.sale_date || b.created_at || '').getTime()
    );

    let runningBalance = 0;
    const ledger = sortedOrders.map(sale => {
      const billed = Number(sale.total_amount) || 0;
      const paid = Number(sale.paid_amount) || 0;
      runningBalance += (billed - paid);
      return {
        ...sale,
        billed,
        paid,
        balanceAtPoint: runningBalance
      };
    });

    const totalBilled = ledger.reduce((sum, r) => sum + r.billed, 0);
    const totalPaid = ledger.reduce((sum, r) => sum + r.paid, 0);
    const netBalanceDue = totalBilled - totalPaid;
    const asOfDate = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
    const statementNo = `STMT-${customer.code || customer.id.substring(0, 6).toUpperCase()}-${new Date().getFullYear()}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Statement - ${customer.name}</title>
        <meta charset="UTF-8" />
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background: #fff;
            margin: 0;
            padding: 20px;
            font-size: 13px;
            line-height: 1.5;
          }
          .statement-container { max-width: 850px; margin: 0 auto; }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .company-logo { max-height: 70px; max-width: 180px; object-fit: contain; margin-bottom: 8px; }
          .company-name { font-size: 20px; font-weight: 800; color: #0f172a; }
          .company-sub { font-size: 11px; color: #64748b; line-height: 1.4; }
          .statement-title-badge {
            text-align: right;
          }
          .title-tag {
            font-size: 18px;
            font-weight: 900;
            color: #2563eb;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .meta-line { font-size: 12px; color: #64748b; margin-top: 3px; }
          .meta-line strong { color: #1e293b; }

          .profile-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 20px;
          }
          .profile-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 16px;
          }
          .profile-box h4 {
            margin: 0 0 8px 0;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #64748b;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
          }
          .profile-box p { margin: 3px 0; font-size: 12px; }

          .summary-cards {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          .card {
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            background: #fff;
          }
          .card-billed { background: #f8fafc; }
          .card-paid { background: #f0fdf4; border-color: #bbf7d0; }
          .card-balance { background: #fef2f2; border-color: #fecaca; }
          .card-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
          .card-val { font-size: 18px; font-weight: 900; margin-top: 4px; }
          .text-billed { color: #1e293b; }
          .text-paid { color: #16a34a; }
          .text-balance { color: #dc2626; }

          table.statement-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
            font-size: 12px;
          }
          table.statement-table th {
            background: #0f172a;
            color: #ffffff;
            font-weight: 700;
            text-align: left;
            padding: 8px 10px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          table.statement-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          table.statement-table tr:nth-child(even) td { background: #f8fafc; }
          table.statement-table .num { text-align: right; font-variant-numeric: tabular-nums; }
          table.statement-table .total-row td {
            font-weight: 800;
            background: #f1f5f9;
            border-top: 2px solid #94a3b8;
            border-bottom: 2px solid #94a3b8;
            font-size: 13px;
          }

          .remittance-box {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 24px;
            font-size: 12px;
          }
          .remittance-box h5 {
            margin: 0 0 6px 0;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            color: #1d4ed8;
          }

          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 36px;
            padding-top: 16px;
          }
          .sig-line {
            width: 200px;
            border-top: 1px solid #94a3b8;
            text-align: center;
            font-size: 11px;
            color: #64748b;
            padding-top: 4px;
          }

          .footer-note {
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            margin-top: 30px;
            border-top: 1px dashed #e2e8f0;
            padding-top: 12px;
          }

          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="statement-container">
          <div class="header-row">
            <div>
              ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="company-logo" />` : ''}
              <div class="company-name">${businessName}</div>
              <div class="company-sub">
                ${businessAddress ? `<div>${businessAddress}</div>` : ''}
                ${businessPhone ? `<div>Tel: ${businessPhone}</div>` : ''}
                ${businessEmail ? `<div>Email: ${businessEmail}</div>` : ''}
              </div>
            </div>
            <div class="statement-title-badge">
              <div class="title-tag">Customer Statement</div>
              <div class="meta-line">Statement No: <strong>${statementNo}</strong></div>
              <div class="meta-line">Statement Date: <strong>${asOfDate}</strong></div>
              <div class="meta-line">Account Currency: <strong>${currency}</strong></div>
            </div>
          </div>

          <div class="profile-grid">
            <div class="profile-box">
              <h4>Customer Details</h4>
              <p><strong>Name:</strong> ${customer.name}</p>
              <p><strong>Customer Code:</strong> ${customer.code || 'N/A'}</p>
              <p><strong>Contact Phone:</strong> ${customer.phone || 'N/A'}</p>
              <p><strong>Email Address:</strong> ${customer.email || 'N/A'}</p>
              ${customer.address ? `<p><strong>Address:</strong> ${customer.address}</p>` : ''}
            </div>
            <div class="profile-box">
              <h4>Statement Summary</h4>
              <p><strong>Account Status:</strong> <span style="color: #16a34a; font-weight: bold;">ACTIVE</span></p>
              <p><strong>Total Invoices Billed:</strong> ${orders.length}</p>
              <p><strong>As of Date:</strong> ${asOfDate}</p>
              <p><strong>Terms:</strong> Due Upon Receipt / 30 Days</p>
            </div>
          </div>

          <div class="summary-cards">
            <div class="card card-billed">
              <div class="card-label">Total Billed</div>
              <div class="card-val text-billed">${currency} ${totalBilled.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="card card-paid">
              <div class="card-label">Total Payments Received</div>
              <div class="card-val text-paid">${currency} ${totalPaid.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="card card-balance">
              <div class="card-label">Outstanding Balance Due</div>
              <div class="card-val ${netBalanceDue > 0 ? 'text-balance' : 'text-paid'}">
                ${currency} ${netBalanceDue.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <table class="statement-table">
            <thead>
              <tr>
                <th style="width: 85px;">Date</th>
                <th style="width: 120px;">Ref / Invoice #</th>
                <th>Description / Method</th>
                <th style="width: 80px;">Status</th>
                <th class="num" style="width: 100px;">Debit (${currency})</th>
                <th class="num" style="width: 100px;">Credit (${currency})</th>
                <th class="num" style="width: 110px;">Balance (${currency})</th>
              </tr>
            </thead>
            <tbody>
              ${ledger.length > 0 ? ledger.map(row => {
                const dateStr = row.sale_date ? new Date(row.sale_date).toLocaleDateString() : new Date(row.created_at || '').toLocaleDateString();
                const statusColor = row.payment_status === 'paid' ? '#16a34a' : row.payment_status === 'partial' ? '#d97706' : '#dc2626';
                return `
                  <tr>
                    <td>${dateStr}</td>
                    <td><strong>${row.sale_number}</strong></td>
                    <td>
                      <div>${(row.sale_type || 'Standard Sale').toUpperCase().replace('_', ' ')}</div>
                      <div style="font-size: 10px; color: #64748b;">Method: ${(row.payment_method || 'N/A').toUpperCase().replace('_', ' ')}</div>
                    </td>
                    <td><span style="color: ${statusColor}; font-weight: bold; text-transform: uppercase; font-size: 10px;">${row.payment_status || 'PENDING'}</span></td>
                    <td class="num font-medium">${row.billed > 0 ? row.billed.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                    <td class="num font-medium" style="color: #16a34a;">${row.paid > 0 ? row.paid.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                    <td class="num font-bold" style="color: ${row.balanceAtPoint > 0 ? '#dc2626' : '#16a34a'};">
                      ${row.balanceAtPoint.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 24px; color: #94a3b8;">
                    No transactions recorded for this customer account.
                  </td>
                </tr>
              `}
              <tr class="total-row">
                <td colspan="4">TOTALS</td>
                <td class="num">${currency} ${totalBilled.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="num" style="color: #16a34a;">${currency} ${totalPaid.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="num" style="color: ${netBalanceDue > 0 ? '#dc2626' : '#16a34a'};">${currency} ${netBalanceDue.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          ${netBalanceDue > 0 ? `
            <div class="remittance-box">
              <h5>Remittance / Payment Instructions</h5>
              <div>Please remit payments referencing your Customer Code <strong>${customer.code || customer.name}</strong>.</div>
              ${settings?.mpesa_business_number ? `<div>• <strong>M-Pesa Paybill / Till:</strong> ${settings.mpesa_business_number} &nbsp;|&nbsp; <strong>Account:</strong> ${customer.code || customer.name}</div>` : ''}
              ${businessPhone ? `<div>• For payment confirmation inquiries, call <strong>${businessPhone}</strong></div>` : ''}
            </div>
          ` : `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; color: #16a34a; font-weight: 600; font-size: 12px;">
              ✓ This customer account is fully settled with zero balance due. Thank you for your prompt payments!
            </div>
          `}

          <div class="signatures">
            <div class="sig-line">Prepared By (Accounts)</div>
            <div class="sig-line">Verified By / Finance Stamp</div>
          </div>

          <div class="footer-note">
            Generated by ${businessName} Accounting &amp; ERP System &bull; Printed on ${new Date().toLocaleString()}
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 350);
  };

  const handleDelete = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) {
      return;
    }

    try {
      const response = await ApiService.delete('customers', customerId);
      if (response.success) {
        toast.success('Customer deleted successfully');
        loadCustomers();
      } else {
        toast.error(response.error || 'Failed to delete customer');
      }
    } catch (error) {
      toast.error('Failed to delete customer');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      let response;
      if (selectedCustomer) {
        response = await SalesService.updateCustomer(selectedCustomer.id, formData);
      } else {
        response = await SalesService.createCustomer(formData);
      }

      if (response) {
        toast.success(selectedCustomer ? 'Customer updated successfully' : 'Customer added successfully');
        setShowModal(false);
        loadCustomers();
      } else {
        toast.error('Failed to save customer');
      }
    } catch (error) {
      toast.error('An error occurred while saving');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600">Manage your customer relationships and information</p>
        </div>
        <button
          onClick={() => {
            setSelectedCustomer(null);
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search customers by name, email, or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={handleSearch}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Search
          </button>
        </div>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : customers.length > 0 ? (
          customers.map((customer) => (
            <div key={customer.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{customer.name}</h3>
                    <p className="text-sm text-gray-500">{customer.code}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleViewOrders(customer)}
                    className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="View Orders & Ledger"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  {!isWalkInCustomer(customer) && (
                    <button
                      onClick={() => handlePrintCustomerStatement(customer)}
                      className="p-1.5 text-emerald-600 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Print Customer Statement"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setShowModal(true);
                    }}
                    className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Customer"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(customer.id)}
                    className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Customer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  {customer.email || 'No email provided'}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  {customer.phone || 'No phone provided'}
                </div>
                {customer.address && (
                  <div className="text-sm text-gray-600">
                    {customer.address}
                  </div>
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Orders:</span>
                  <span className="font-medium text-gray-900">
                    {customer.total_orders || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Spent:</span>
                  <span className="font-medium text-gray-900">
                    {settings?.default_currency && settings.default_currency !== 'USD' ? settings.default_currency : 'KES'} {(customer.total_spent || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
            <p className="text-gray-500">Get started by adding your first customer.</p>
          </div>
        )}
      </div>

      {/* Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              
              <form onSubmit={handleSave} id="customer-form" className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Code
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Auto-generated if empty"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    rows={3}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </form>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="customer-form"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {loading ? 'Saving...' : (selectedCustomer ? 'Update' : 'Add') + ' Customer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Orders Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Sales History for {selectedCustomer?.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Review purchase history, balances, and payment status</p>
              </div>
              <div className="flex items-center gap-3">
                {selectedCustomer && !isWalkInCustomer(selectedCustomer) && (
                  <button
                    onClick={() => handlePrintCustomerStatement(selectedCustomer, customerOrders)}
                    className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-xs flex items-center shadow-xs"
                    title="Print Statement"
                  >
                    <Printer className="h-3.5 w-3.5 mr-1.5" />
                    Print Statement
                  </button>
                )}
                <button
                  onClick={() => setShowOrdersModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1 rounded-lg"
                >
                  &times;
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {loadingOrders ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : customerOrders.length > 0 ? (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-sm text-left min-w-[700px]">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Receipt Number</th>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Total Amount</th>
                        <th className="px-4 py-3 font-semibold">Paid Amount</th>
                        <th className="px-4 py-3 font-semibold">Balance</th>
                        <th className="px-4 py-3 font-semibold">Method</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {customerOrders.map((sale) => {
                        const balance = (Number(sale.total_amount) || 0) - (Number(sale.paid_amount) || 0);
                        const statusColors = {
                          paid: 'bg-green-100 text-green-700',
                          partial: 'bg-yellow-100 text-yellow-700',
                          pending: 'bg-red-100 text-red-700',
                          overdue: 'bg-red-200 text-red-800'
                        };
                        const pStatus = sale.payment_status || 'pending';
                        return (
                          <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">{sale.receipt_number || sale.id.substring(0, 8)}</td>
                            <td className="px-4 py-3 text-gray-600">{new Date(sale.created_at || new Date()).toLocaleDateString()}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{settings?.default_currency || '$'}{(Number(sale.total_amount) || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-gray-600">{settings?.default_currency || '$'}{(Number(sale.paid_amount) || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-gray-900 font-medium">{settings?.default_currency || '$'}{balance.toLocaleString()}</td>
                            <td className="px-4 py-3 text-gray-600 capitalize">{sale.payment_method?.replace('_',' ') || 'N/A'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${statusColors[pStatus as keyof typeof statusColors] || 'bg-gray-100 text-gray-700'}`}>
                                {pStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">No sales found for this customer.</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                {selectedCustomer && isWalkInCustomer(selectedCustomer) ? (
                  <span className="text-xs text-amber-600 font-semibold italic">
                    * Customer statements are not available for walk-in customers.
                  </span>
                ) : (
                  <span className="text-xs text-gray-500 font-medium">
                    {customerOrders.length} transaction(s) recorded for this account.
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {selectedCustomer && !isWalkInCustomer(selectedCustomer) && (
                  <button
                    onClick={() => handlePrintCustomerStatement(selectedCustomer, customerOrders)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm flex items-center shadow-xs"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Statement
                  </button>
                )}
                <button
                  onClick={() => setShowOrdersModal(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers; 