import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Truck, Mail, Phone, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ApiService } from '../services/api';
import { SupplierService } from '../services/supplierService';
import type { Supplier, Purchase } from '../types';
import { FileText } from 'lucide-react';

const Suppliers: React.FC = () => {
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
    address: ''
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
        address: selectedSupplier.address || ''
      });
    } else {
      setFormData({
        name: '',
        code: '',
        email: '',
        phone: '',
        contact_person: '',
        address: ''
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
        setSupplierOrders(response.data || []);
      }
    } catch (error) {
      toast.error('Failed to load supplier orders');
    } finally {
      setLoadingOrders(false);
    }
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
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
                        const balance = order.total_amount - order.paid_amount;
                        const statusColors = {
                          paid: 'bg-green-100 text-green-700',
                          partial: 'bg-yellow-100 text-yellow-700',
                          pending: 'bg-red-100 text-red-700',
                          overdue: 'bg-red-200 text-red-800'
                        };
                        return (
                          <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">{order.purchase_number}</td>
                            <td className="px-4 py-3 text-gray-600">{new Date(order.purchase_date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">${order.total_amount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-gray-600">${order.paid_amount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-gray-900">${balance.toLocaleString()}</td>
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
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">No orders found for this supplier.</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
              <button
                onClick={() => setShowOrdersModal(false)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
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