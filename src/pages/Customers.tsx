import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, User, Mail, Phone } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ApiService } from '../services/api';
import { SalesService } from '../services/salesService';
import type { Customer, Sale } from '../types';
import { FileText } from 'lucide-react';
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
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleViewOrders(customer)}
                    className="text-indigo-600 hover:text-indigo-900"
                    title="View Orders"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setShowModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(customer.id)}
                    className="text-red-600 hover:text-red-900"
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

export default Customers; 