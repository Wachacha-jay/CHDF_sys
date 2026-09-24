import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Truck, Mail, Phone, MapPin, Printer, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ApiService } from '../services/api';
import { SupplierService } from '../services/supplierService';
import type { Supplier, Purchase } from '../types';
import { useSettingsContext } from '../contexts/SettingsContext';

const Suppliers: React.FC = () => {
  const { settings } = useSettingsContext();
  const currency = (settings?.default_currency && settings.default_currency !== 'USD') ? settings.default_currency : 'KES';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    contact_person: '',
    address: '',
    organization_name: '',
    bank_name: '',
    account_number: ''
  });
  
  // Orders View State
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [supplierOrders, setSupplierOrders] = useState<Purchase[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (selectedSupplier) {
      setFormData({
        name: selectedSupplier.name,
        code: selectedSupplier.code,
        email: selectedSupplier.email || '',
        phone: selectedSupplier.phone || '',
        contact_person: selectedSupplier.contact_person || '',
        address: selectedSupplier.address || '',
        organization_name: selectedSupplier.organization_name || '',
        bank_name: selectedSupplier.bank_name || '',
        account_number: selectedSupplier.account_number || ''
      });
    } else {
      setFormData({
        name: '',
        code: '',
        email: '',
        phone: '',
        contact_person: '',
        address: '',
        organization_name: '',
        bank_name: '',
        account_number: ''
      });
    }
  }, [selectedSupplier, showModal]);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const [suppliersResponse, purchasesResponse] = await Promise.all([
        ApiService.get<Supplier>('suppliers', { filters: { is_active: true } }),
        ApiService.get<Purchase>('purchases')
      ]);
      
      if (suppliersResponse.success && suppliersResponse.data) {
        let filteredSuppliers = suppliersResponse.data;
        const purchases = purchasesResponse.success ? (purchasesResponse.data || []) : [];
        
        filteredSuppliers = filteredSuppliers.map(supplier => ({
          ...supplier,
          total_orders: purchases.filter(p => p.supplier_id === supplier.id).length
        }));
        
        if (searchTerm) {
          const lowerSearch = searchTerm.toLowerCase();
          filteredSuppliers = filteredSuppliers.filter(supplier =>
            supplier.name.toLowerCase().includes(lowerSearch) ||
            supplier.email?.toLowerCase().includes(lowerSearch) ||
            supplier.code?.toLowerCase().includes(lowerSearch)
          );
        }
        
        setSuppliers(filteredSuppliers);
      }
    } catch (error) {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadSuppliers();
  };

  const handleDelete = async (supplierId: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) {
      return;
    }

    try {
      const response = await ApiService.delete('suppliers', supplierId);
      if (response.success) {
        toast.success('Supplier deleted successfully');
        loadSuppliers();
      } else {
        toast.error(response.error || 'Failed to delete supplier');
      }
    } catch (error) {
      toast.error('Failed to delete supplier');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      let response;
      if (selectedSupplier) {
        response = await SupplierService.updateSupplier(selectedSupplier.id, formData);
      } else {
        response = await SupplierService.createSupplier(formData);
      }

      if (response) {
        toast.success(selectedSupplier ? 'Supplier updated successfully' : 'Supplier added successfully');
        setShowModal(false);
        loadSuppliers();
      } else {
        toast.error('Failed to save supplier');
      }
    } catch (error) {
      toast.error('An error occurred while saving');
    } finally {
      setLoading(false);
    }
  };

  const getSupplierStatus = (isActive: boolean) => {
    return isActive 
      ? { color: 'text-green-600', bg: 'bg-green-50', text: 'Active' }
      : { color: 'text-red-600', bg: 'bg-red-50', text: 'Inactive' };
  };

  const handleViewOrders = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setLoadingOrders(true);
    setShowOrdersModal(true);
    try {
      const response = await ApiService.get<Purchase>('purchases', {
        filters: { supplier_id: supplier.id }
      });
      if (response.success) {
        // Enforce strict filtering by supplier.id
        const filtered = (response.data || []).filter(p => p.supplier_id === supplier.id);
        setSupplierOrders(filtered);
      }
    } catch (error) {
      toast.error('Failed to load supplier orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  const handlePrintStatement = () => {
    if (!selectedSupplier) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print statement');
      return;
    }

    const totalOrdersAmount = supplierOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const totalPaidAmount = supplierOrders.reduce((sum, o) => sum + Number(o.paid_amount || 0), 0);
    const totalBalanceDue = Math.max(0, totalOrdersAmount - totalPaidAmount);
    const bName = settings?.business_name || 'Organization';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Supplier Statement - ${selectedSupplier.name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: bold; color: #0f172a; text-transform: uppercase; }
          .subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
          .info-card { background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .info-card h4 { margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; color: #64748b; }
          .info-card p { margin: 4px 0; font-size: 14px; }
          .summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px; }
          .summary-card { padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; }
          .summary-card .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
          .summary-card .val { font-size: 20px; font-weight: bold; margin-top: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
          th { background: #f1f5f9; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #cbd5e1; }
          td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
          .text-right { text-align: right; }
          .status { display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
          .status-paid { background: #dcfce7; color: #15803d; }
          .status-partial { background: #fef9c3; color: #a16207; }
          .status-pending { background: #fee2e2; color: #b91c1c; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">Supplier Account Statement</div>
            <div class="subtitle">${bName}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 13px; color: #64748b;">Date Generated: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <h4>Supplier Details</h4>
            <p><strong>Name:</strong> ${selectedSupplier.name}</p>
            <p><strong>Code:</strong> ${selectedSupplier.code || '-'}</p>
            <p><strong>Contact Person:</strong> ${selectedSupplier.contact_person || '-'}</p>
            <p><strong>Phone:</strong> ${selectedSupplier.phone || '-'}</p>
            <p><strong>Email:</strong> ${selectedSupplier.email || '-'}</p>
            ${selectedSupplier.address ? `<p><strong>Address:</strong> ${selectedSupplier.address}</p>` : ''}
          </div>
          <div class="info-card">
            <h4>Payment & Banking Details</h4>
            <p><strong>Bank Name:</strong> ${selectedSupplier.bank_name || '-'}</p>
            <p><strong>Account Number:</strong> ${selectedSupplier.account_number || '-'}</p>
            <p><strong>Organization:</strong> ${selectedSupplier.organization_name || '-'}</p>
          </div>
        </div>

        <div class="summary-cards">
          <div class="summary-card" style="background: #f8fafc;">
            <div class="label">Total Invoiced</div>
            <div class="val" style="color: #0f172a;">${currency} ${totalOrdersAmount.toLocaleString()}</div>
          </div>
          <div class="summary-card" style="background: #f0fdf4;">
            <div class="label" style="color: #15803d;">Total Paid</div>
            <div class="val" style="color: #15803d;">${currency} ${totalPaidAmount.toLocaleString()}</div>
          </div>
          <div class="summary-card" style="background: ${totalBalanceDue > 0 ? '#fff1f2' : '#f8fafc'};">
            <div class="label" style="color: ${totalBalanceDue > 0 ? '#be123c' : '#64748b'};">Balance Due</div>
            <div class="val" style="color: ${totalBalanceDue > 0 ? '#be123c' : '#0f172a'};">${currency} ${totalBalanceDue.toLocaleString()}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Order / Purchase #</th>
              <th>Date</th>
              <th class="text-right">Total Amount</th>
              <th class="text-right">Paid Amount</th>
              <th class="text-right">Balance Due</th>
              <th style="text-align: center;">Payment Status</th>
            </tr>
          </thead>
          <tbody>
            ${supplierOrders.length === 0 ? '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">No orders found for this supplier.</td></tr>' : ''}
            ${supplierOrders.map(order => {
              const bal = Math.max(0, Number(order.total_amount || 0) - Number(order.paid_amount || 0));
              const statusClass = order.payment_status === 'paid' ? 'status-paid' : order.payment_status === 'partial' ? 'status-partial' : 'status-pending';
              return `
                <tr>
                  <td><strong>${order.purchase_number}</strong></td>
                  <td>${new Date(order.purchase_date).toLocaleDateString()}</td>
                  <td class="text-right">${currency} ${Number(order.total_amount || 0).toLocaleString()}</td>
                  <td class="text-right">${currency} ${Number(order.paid_amount || 0).toLocaleString()}</td>
                  <td class="text-right"><strong>${currency} ${bal.toLocaleString()}</strong></td>
                  <td style="text-align: center;"><span class="status ${statusClass}">${order.payment_status}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background: #f8fafc; border-top: 2px solid #cbd5e1;">
              <td colspan="2">Summary Totals</td>
              <td class="text-right">${currency} ${totalOrdersAmount.toLocaleString()}</td>
              <td class="text-right">${currency} ${totalPaidAmount.toLocaleString()}</td>
              <td class="text-right">${currency} ${totalBalanceDue.toLocaleString()}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div class="footer">
          <p>Generated by ${bName} · Official Supplier Statement · ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Management</h1>
          <p className="text-gray-600">Manage your supplier relationships and purchase orders</p>
        </div>
        <button
          onClick={() => {
            setSelectedSupplier(null);
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
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
                placeholder="Search suppliers by name, email, or code..."
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

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : suppliers.length > 0 ? (
          suppliers.map((supplier) => {
            const status = getSupplierStatus(supplier.is_active);
            return (
              <div key={supplier.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                      <Truck className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{supplier.name}</h3>
                      <p className="text-sm text-gray-500">{supplier.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleViewOrders(supplier)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="View Orders"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSupplier(supplier);
                        setShowModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                      title="Edit Supplier"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(supplier.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete Supplier"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="h-4 w-4 mr-2" />
                    {supplier.email || 'No email provided'}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="h-4 w-4 mr-2" />
                    {supplier.phone || 'No phone provided'}
                  </div>
                  {supplier.address && (
                    <div className="flex items-start text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2 mt-0.5" />
                      {supplier.address}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.bg} ${status.color}`}>
                    {status.text}
                  </span>
                  
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Total Orders</div>
                    <div className="text-lg font-medium text-gray-900">
                      {supplier.total_orders || 0}
                    </div>
                  </div>
                </div>
                
                {supplier.contact_person && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="text-sm text-gray-500">Contact Person</div>
                    <div className="text-sm font-medium text-gray-900">{supplier.contact_person}</div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12">
            <Truck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No suppliers found</h3>
            <p className="text-gray-500">Get started by adding your first supplier.</p>
          </div>
        )}
      </div>

      {/* Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              
              <form onSubmit={handleSave} id="supplier-form" className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier Name
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
                    Supplier Code
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
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.organization_name}
                    onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
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
                  form="supplier-form"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {loading ? 'Saving...' : (selectedSupplier ? 'Update' : 'Add') + ' Supplier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Orders Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Orders for {selectedSupplier?.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Review purchase history and payment status</p>
              </div>
              <button
                onClick={() => setShowOrdersModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-2"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {loadingOrders ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : supplierOrders.length > 0 ? (
                <div>
                  {/* Summary Cards */}
                  {(() => {
                    const totalInvoiced = supplierOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
                    const totalPaid = supplierOrders.reduce((sum, o) => sum + (Number(o.paid_amount) || 0), 0);
                    const totalBalance = totalInvoiced - totalPaid;
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="text-xs font-semibold uppercase text-slate-500">Total Invoiced</div>
                          <div className="text-lg font-bold text-slate-900">{currency} {totalInvoiced.toLocaleString()}</div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                          <div className="text-xs font-semibold uppercase text-emerald-700">Total Paid</div>
                          <div className="text-lg font-bold text-emerald-900">{currency} {totalPaid.toLocaleString()}</div>
                        </div>
                        <div className={`border rounded-lg p-3 ${totalBalance > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                          <div className={`text-xs font-semibold uppercase ${totalBalance > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Balance Due</div>
                          <div className={`text-lg font-bold ${totalBalance > 0 ? 'text-amber-900' : 'text-slate-900'}`}>{currency} {totalBalance.toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm text-left min-w-[700px]">
                      <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Order Number</th>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Total Amount</th>
                          <th className="px-4 py-3 font-semibold">Paid Amount</th>
                          <th className="px-4 py-3 font-semibold">Balance</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {supplierOrders.map((order) => {
                          const balance = Number(order.total_amount || 0) - Number(order.paid_amount || 0);
                          const statusColors = {
                            paid: 'bg-green-100 text-green-700',
                            partial: 'bg-yellow-100 text-yellow-700',
                            pending: 'bg-red-100 text-red-700',
                            overdue: 'bg-red-200 text-red-800'
                          };
                          return (
                            <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 font-medium text-gray-900">{order.purchase_number}</td>
                              <td className="px-4 py-3 text-gray-600">{order.purchase_date ? new Date(order.purchase_date).toLocaleDateString() : '-'}</td>
                              <td className="px-4 py-3 font-medium text-gray-900">{currency} {Number(order.total_amount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-gray-600">{currency} {Number(order.paid_amount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-gray-900">{currency} {balance.toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${statusColors[order.payment_status] || 'bg-gray-100 text-gray-700'}`}>
                                  {order.payment_status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">No orders found for this supplier.</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <button
                type="button"
                onClick={handlePrintStatement}
                disabled={supplierOrders.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                Print Statement
              </button>
              <button
                onClick={() => setShowOrdersModal(false)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers; 