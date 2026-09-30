import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit, Trash2, Truck, Mail, Phone, MapPin, 
  FileText, Eye, Building2, Tag, Percent, 
  Sparkles, Check, CheckCircle2, AlertCircle, Clock,
  ArrowRight, X, Briefcase, RefreshCw, CreditCard
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ApiService } from '../services/api';
import { SupplierService } from '../services/supplierService';
import { FundAccountingService } from '../services/fundAccountingService';
import { AccountingService } from '../services/accountingService';
import type { Supplier, Purchase, Product, Department, Account } from '../types';
import { useSettingsContext } from '../contexts/SettingsContext';
import SupplierDetailModal from '../components/suppliers/SupplierDetailModal';
import CreatePurchaseInvoiceModal from '../components/invoices/CreatePurchaseInvoiceModal';
import RecordPaymentModal from '../components/inventory/RecordPaymentModal';

const Suppliers: React.FC = () => {
  const { settings } = useSettingsContext();
  const currency = (settings?.default_currency && settings.default_currency !== 'USD') ? settings.default_currency : 'KES';
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'directory' | 'services' | 'invoices'>('directory');

  // Core Data States
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [services, setServices] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('');

  // Modals
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [show360Modal, setShow360Modal] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Purchase | null>(null);
  const [showQuickAddServiceModal, setShowQuickAddServiceModal] = useState(false);

  // Supplier Form Tab & State
  const [supplierFormTab, setSupplierFormTab] = useState<'general' | 'services' | 'financial'>('general');
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    contact_person: '',
    address: '',
    organization_name: '',
    department_id: '',
    expense_account_id: '',
    withholding_tax_rate: 0,
    service_ids: [] as string[],
    bank_name: '',
    account_number: '',
    is_active: true
  });

  // Quick Add Service Form
  const [quickServiceData, setQuickServiceData] = useState({
    name: '',
    sku: '',
    cost_price: 0,
    description: ''
  });
  const [savingService, setSavingService] = useState(false);

  // Load all initial data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [supRes, purRes, prodRes, depRes, accRes] = await Promise.all([
        ApiService.get<Supplier>('suppliers'),
        ApiService.get<Purchase>('purchases', { orderBy: { column: 'purchase_date', ascending: false } }),
        ApiService.get<Product>('products'),
        FundAccountingService.getDepartments(),
        AccountingService.getAccounts()
      ]);

      if (supRes.success && supRes.data) {
        setSuppliers(supRes.data);
      }
      if (purRes.success && purRes.data) {
        setPurchases(purRes.data);
      }
      if (prodRes.success && prodRes.data) {
        setServices(prodRes.data.filter(p => p.is_service));
      }
      setDepartments(depRes || []);
      const flatAccs = AccountingService.flattenAccounts(accRes || []);
      setExpenseAccounts(flatAccs.filter(a => a.account_type === 'expense'));
    } catch (error) {
      console.error('Error loading supplier data:', error);
      toast.error('Failed to load supplier data');
    } finally {
      setLoading(false);
    }
  };

  // Sync Form Data when editing supplier changes
  useEffect(() => {
    if (editingSupplier) {
      setFormData({
        name: editingSupplier.name || '',
        code: editingSupplier.code || '',
        email: editingSupplier.email || '',
        phone: editingSupplier.phone || '',
        contact_person: editingSupplier.contact_person || '',
        address: editingSupplier.address || '',
        organization_name: editingSupplier.organization_name || '',
        department_id: editingSupplier.department_id || '',
        expense_account_id: editingSupplier.expense_account_id || '',
        withholding_tax_rate: Number(editingSupplier.withholding_tax_rate) || 0,
        service_ids: Array.isArray(editingSupplier.service_ids) ? editingSupplier.service_ids : [],
        bank_name: editingSupplier.bank_name || '',
        account_number: editingSupplier.account_number || '',
        is_active: editingSupplier.is_active ?? true
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
        department_id: '',
        expense_account_id: '',
        withholding_tax_rate: 0,
        service_ids: [],
        bank_name: '',
        account_number: '',
        is_active: true
      });
    }
    setSupplierFormTab('general');
  }, [editingSupplier, showSupplierModal]);

  // Open Add Supplier
  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setShowSupplierModal(true);
  };

  // Open Edit Supplier
  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowSupplierModal(true);
  };

  // Open 360 Detail View
  const handleOpen360 = (supplier: Supplier) => {
    setViewingSupplier(supplier);
    setShow360Modal(true);
  };

  // Delete Supplier
  const handleDelete = async (supplierId: string) => {
    if (!confirm('Are you sure you want to delete this supplier? This action cannot be undone.')) {
      return;
    }
    try {
      const response = await ApiService.delete('suppliers', supplierId);
      if (response.success) {
        toast.success('Supplier deleted successfully');
        loadAllData();
      } else {
        toast.error(response.error || 'Failed to delete supplier');
      }
    } catch (error) {
      toast.error('Failed to delete supplier');
    }
  };

  // Save Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    try {
      setLoading(true);
      const payload: Partial<Supplier> = {
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        contact_person: formData.contact_person.trim() || undefined,
        address: formData.address.trim() || undefined,
        organization_name: formData.organization_name.trim() || undefined,
        department_id: formData.department_id || undefined,
        expense_account_id: formData.expense_account_id || undefined,
        withholding_tax_rate: Number(formData.withholding_tax_rate) || 0,
        service_ids: formData.service_ids,
        bank_name: formData.bank_name.trim() || undefined,
        account_number: formData.account_number.trim() || undefined,
        is_active: formData.is_active
      };

      let result;
      if (editingSupplier) {
        result = await SupplierService.updateSupplier(editingSupplier.id, payload);
      } else {
        result = await SupplierService.createSupplier(payload);
      }

      if (result) {
        toast.success(editingSupplier ? 'Supplier updated successfully' : 'Supplier created successfully');
        setShowSupplierModal(false);
        loadAllData();
      } else {
        toast.error('Failed to save supplier');
      }
    } catch (error) {
      toast.error('An error occurred while saving supplier');
    } finally {
      setLoading(false);
    }
  };

  // Toggle service selection in form
  const toggleServiceSelection = (serviceId: string) => {
    setFormData(prev => {
      const exists = prev.service_ids.includes(serviceId);
      return {
        ...prev,
        service_ids: exists 
          ? prev.service_ids.filter(id => id !== serviceId)
          : [...prev.service_ids, serviceId]
      };
    });
  };

  // Quick Add Service Save
  const handleSaveQuickService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickServiceData.name.trim()) {
      toast.error('Service name is required');
      return;
    }

    setSavingService(true);
    try {
      const generatedSku = quickServiceData.sku.trim() || `SRV-${Date.now().toString().slice(-4)}`;
      const res = await ApiService.create<Product>('products', {
        name: quickServiceData.name.trim(),
        sku: generatedSku,
        cost_price: Number(quickServiceData.cost_price) || 0,
        selling_price: 0,
        current_stock: 0,
        min_stock_level: 0,
        is_service: true,
        is_active: true,
        description: quickServiceData.description.trim() || undefined
      });

      if (res.success && res.data) {
        toast.success(`Service "${res.data.name}" added to catalog`);
        // Refresh services
        setServices(prev => [...prev, res.data!]);
        // Auto-select in current supplier form
        setFormData(prev => ({
          ...prev,
          service_ids: [...prev.service_ids, res.data!.id]
        }));
        setQuickServiceData({ name: '', sku: '', cost_price: 0, description: '' });
        setShowQuickAddServiceModal(false);
      } else {
        toast.error(res.error || 'Failed to create service');
      }
    } catch (err) {
      toast.error('Error creating service');
    } finally {
      setSavingService(false);
    }
  };

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier => {
      const matchesSearch = !searchTerm || 
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDept = !selectedDepartmentFilter || supplier.department_id === selectedDepartmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [suppliers, searchTerm, selectedDepartmentFilter]);

  // Aggregate stats
  const totalPayablesDue = useMemo(() => {
    return purchases.reduce((sum, p) => sum + Math.max(0, Number(p.total_amount || 0) - Number(p.paid_amount || 0)), 0);
  }, [purchases]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center space-x-2">
            <Truck className="w-7 h-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Supplier & Vendor Management</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Maintain suppliers, service providers, service catalog, and procurement accounts payable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowCreateInvoiceModal(true)}
            className="inline-flex items-center px-4 py-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-semibold text-sm rounded-xl shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4 mr-2 text-slate-500" />
            New Purchase Invoice
          </button>

          <button
            onClick={() => {
              setQuickServiceData({ name: '', sku: '', cost_price: 0, description: '' });
              setShowQuickAddServiceModal(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-semibold text-sm rounded-xl shadow-sm transition-colors"
          >
            <Tag className="w-4 h-4 mr-2 text-blue-600" />
            + Add Service
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier / Vendor
          </button>
        </div>
      </div>

      {/* Top Level Navigation Tabs */}
      <div className="flex border-b border-gray-200 space-x-8">
        <button
          onClick={() => setActiveTab('directory')}
          className={`pb-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'directory'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Suppliers Directory</span>
          <span className="ml-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-semibold">
            {suppliers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`pb-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'services'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Services Catalog</span>
          <span className="ml-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-semibold">
            {services.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'invoices'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Purchase & Service Invoices</span>
          <span className="ml-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-semibold">
            {purchases.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SUPPLIERS DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          {/* KPI Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Suppliers</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{suppliers.length}</h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Truck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Suppliers</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                  {suppliers.filter(s => s.is_active).length}
                </h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Catalog Services</p>
                <h3 className="text-2xl font-bold text-purple-600 mt-1">{services.length}</h3>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <Briefcase className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Payables Due</p>
                <h3 className="text-xl font-extrabold text-amber-600 mt-1">
                  {currency} {totalPayablesDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search suppliers by name, code, contact person, or email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={selectedDepartmentFilter}
                onChange={e => setSelectedDepartmentFilter(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-700 min-w-[200px]"
              >
                <option value="">All Operating Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <button
                onClick={loadAllData}
                title="Refresh Data"
                className="p-2 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Suppliers Cards Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
              <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-800">No suppliers found</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                {searchTerm || selectedDepartmentFilter 
                  ? 'No suppliers match your current filter criteria. Try clearing search filters.'
                  : 'Start by adding your first supplier or service provider to manage procurement.'}
              </p>
              <button
                onClick={handleOpenAdd}
                className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Supplier
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSuppliers.map(supplier => {
                // Calculate supplier specific finances
                const supPurchases = purchases.filter(p => p.supplier_id === supplier.id);
                const totalBilled = supPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
                const totalPaid = supPurchases.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
                const balanceDue = Math.max(0, totalBilled - totalPaid);

                // Service names
                const assignedServiceIds = Array.isArray(supplier.service_ids) ? supplier.service_ids : [];
                const assignedServices = services.filter(s => assignedServiceIds.includes(s.id));

                return (
                  <div
                    key={supplier.id}
                    className="bg-white rounded-2xl border border-gray-200/90 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 pb-3 border-b border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-base shadow-sm">
                            {supplier.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 text-base leading-tight hover:text-blue-600 transition-colors">
                              {supplier.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-400 font-mono">
                                {supplier.code || 'NO-CODE'}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                supplier.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {supplier.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Top quick action icons */}
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleOpen360(supplier)}
                            title="View 360 Statement & Details"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(supplier)}
                            title="Edit Supplier"
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(supplier.id)}
                            title="Delete Supplier"
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Department & GL Badge */}
                      <div className="py-3 space-y-2 text-xs border-b border-gray-100">
                        <div className="flex items-center justify-between text-gray-600">
                          <span className="text-gray-400 flex items-center">
                            <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" /> Department:
                          </span>
                          <span className="font-semibold text-gray-800">
                            {supplier.department?.name || 'General / Unallocated'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-gray-600">
                          <span className="text-gray-400 flex items-center">
                            <Briefcase className="w-3.5 h-3.5 mr-1 text-slate-400" /> Default GL Expense:
                          </span>
                          <span className="font-semibold text-gray-800 truncate max-w-[170px]" title={supplier.expense_account?.name}>
                            {supplier.expense_account 
                              ? `[${supplier.expense_account.code}] ${supplier.expense_account.name}`
                              : 'Default Inventory'}
                          </span>
                        </div>
                      </div>

                      {/* Services Pills */}
                      <div className="py-2.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                          Services Provided
                        </span>
                        {assignedServices.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                            {assignedServices.map(srv => (
                              <span
                                key={srv.id}
                                className="inline-flex items-center text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200/80 px-2 py-0.5 rounded-md"
                              >
                                <Tag className="w-2.5 h-2.5 mr-1 text-purple-500" />
                                {srv.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No services linked</span>
                        )}
                      </div>

                      {/* Contact Info */}
                      <div className="pt-2 pb-3 space-y-1 text-xs text-gray-600">
                        {supplier.contact_person && (
                          <p className="truncate"><span className="text-gray-400">Contact:</span> {supplier.contact_person}</p>
                        )}
                        {supplier.phone && (
                          <p className="flex items-center truncate"><Phone className="w-3 h-3 mr-1 text-gray-400" /> {supplier.phone}</p>
                        )}
                        {supplier.email && (
                          <p className="flex items-center truncate"><Mail className="w-3 h-3 mr-1 text-gray-400" /> {supplier.email}</p>
                        )}
                      </div>
                    </div>

                    {/* Financial Footer & 360 Action */}
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-2 bg-slate-50/70 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Payable Balance</span>
                        <span className={`text-sm font-extrabold ${balanceDue > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                          {currency} {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpen360(supplier)}
                        className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline gap-1"
                      >
                        <span>View 360 Account</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SERVICES CATALOG (Unified catalog where is_service = true) */}
      {/* ========================================================================= */}
      {activeTab === 'services' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Services & Service Provider Catalog</h2>
              <p className="text-xs text-gray-500">
                Services configured here are available across purchases, supplier assignments, and expense tracking.
              </p>
            </div>
            <button
              onClick={() => {
                setQuickServiceData({ name: '', sku: '', cost_price: 0, description: '' });
                setShowQuickAddServiceModal(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> + Add New Service
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-gray-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Service Name</th>
                  <th className="px-4 py-3.5">Code / SKU</th>
                  <th className="px-4 py-3.5">Default Cost Rate</th>
                  <th className="px-5 py-3.5">Suppliers Offering Service</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {services.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400">
                      <Briefcase className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      No services in catalog yet. Click "+ Add New Service" to create one.
                    </td>
                  </tr>
                ) : (
                  services.map(service => {
                    const offeringSuppliers = suppliers.filter(s => 
                      Array.isArray(s.service_ids) && s.service_ids.includes(service.id)
                    );
                    return (
                      <tr key={service.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-gray-900">
                          <div className="flex items-center space-x-2">
                            <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                              <Tag className="w-3.5 h-3.5" />
                            </span>
                            <span>{service.name}</span>
                          </div>
                          {service.description && (
                            <p className="text-xs text-gray-400 mt-0.5 ml-7">{service.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-mono text-gray-600">
                          {service.sku || '-'}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-gray-900">
                          {currency} {Number(service.cost_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-3.5">
                          {offeringSuppliers.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {offeringSuppliers.map(s => (
                                <span key={s.id} className="text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Not assigned to any supplier yet</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            service.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {service.is_active ? 'Active' : 'Archived'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PURCHASE & SERVICE INVOICES */}
      {/* ========================================================================= */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Purchase & Service Invoices</h2>
              <p className="text-xs text-gray-500">
                Track all procurement invoices, fund department stamps, withholding tax deductions, and payment status.
              </p>
            </div>
            <button
              onClick={() => setShowCreateInvoiceModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> + New Purchase Invoice
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-gray-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Invoice #</th>
                    <th className="px-4 py-3.5">Supplier / Vendor</th>
                    <th className="px-4 py-3.5">Department</th>
                    <th className="px-4 py-3.5">Invoice Date</th>
                    <th className="px-4 py-3.5 text-right">Total Amount</th>
                    <th className="px-4 py-3.5 text-right">Paid Amount</th>
                    <th className="px-4 py-3.5 text-right">Balance Due</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-gray-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        No purchase invoices recorded yet.
                      </td>
                    </tr>
                  ) : (
                    purchases.map(invoice => {
                      const balance = Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0));
                      const statusBadges = {
                        paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        partial: 'bg-amber-50 text-amber-700 border-amber-200',
                        pending: 'bg-rose-50 text-rose-700 border-rose-200',
                        overdue: 'bg-red-100 text-red-800 border-red-300'
                      };
                      return (
                        <tr key={invoice.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5 font-bold text-gray-900">
                            {invoice.purchase_number}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-gray-800">
                            {invoice.supplier?.name || '-'}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-600">
                            {invoice.department?.name ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 font-medium">
                                <Building2 className="w-3 h-3 mr-1 text-slate-400" />
                                {invoice.department.name}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-600">
                            {invoice.purchase_date ? new Date(invoice.purchase_date).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-gray-900">
                            {currency} {Number(invoice.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-emerald-700">
                            {currency} {Number(invoice.paid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold">
                            <span className={balance > 0 ? 'text-rose-600' : 'text-slate-400'}>
                              {currency} {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                              statusBadges[invoice.payment_status] || 'bg-gray-100 text-gray-700'
                            }`}>
                              {invoice.payment_status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {balance > 0.01 ? (
                              <button
                                onClick={() => {
                                  setSelectedInvoiceForPayment(invoice);
                                  setShowRecordPaymentModal(true);
                                }}
                                className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                              >
                                Record Pay
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-600 font-semibold flex items-center justify-end">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Paid
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT SUPPLIER MODAL (3 TABS) */}
      {/* ========================================================================= */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-gray-100 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editingSupplier ? 'Edit Supplier / Service Provider' : 'Register Supplier / Service Provider'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Configure vendor details, catalog services, department alignment, and accounting defaults.
                </p>
              </div>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1"
              >
                &times;
              </button>
            </div>

            {/* Modal Subtabs */}
            <div className="flex border-b border-gray-100 bg-slate-50/70 px-5 pt-2">
              <button
                type="button"
                onClick={() => setSupplierFormTab('general')}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                  supplierFormTab === 'general'
                    ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                1. General & Contact
              </button>
              <button
                type="button"
                onClick={() => setSupplierFormTab('services')}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
                  supplierFormTab === 'services'
                    ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>2. Services & Department</span>
                {formData.service_ids.length > 0 && (
                  <span className="w-4 h-4 bg-purple-100 text-purple-700 text-[10px] rounded-full flex items-center justify-center font-bold">
                    {formData.service_ids.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSupplierFormTab('financial')}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                  supplierFormTab === 'financial'
                    ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                3. Financial & GL Defaults
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveSupplier} id="supplier-multi-form" className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* TAB 1: GENERAL & CONTACT */}
              {supplierFormTab === 'general' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Supplier / Provider Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Safaricom PLC, KenGen, Legal Advocates"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Supplier Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., SUP-001 (auto if empty)"
                        value={formData.code}
                        onChange={e => setFormData({ ...formData, code: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Jane Doe - Key Account Rep"
                        value={formData.contact_person}
                        onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Organization / Parent Company
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Telecom Group"
                        value={formData.organization_name}
                        onChange={e => setFormData({ ...formData, organization_name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="accounts@vendor.com"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+254 700 000 000"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Physical Address / Office Location
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Street address, building, town..."
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: SERVICES & DEPARTMENT */}
              {supplierFormTab === 'services' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Department Alignment */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Primary Operating Department (Fund Accounting)
                    </label>
                    <select
                      value={formData.department_id}
                      onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                    >
                      <option value="">-- General / No Specific Department --</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.code ? `(${d.code})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Used for departmental fund allocations when creating procurement orders for this vendor.
                    </p>
                  </div>

                  {/* Services Multi-Select */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700">
                          Services Offered by this Supplier (Multi-Select)
                        </label>
                        <p className="text-[11px] text-gray-400">
                          Select one or multiple services this supplier provides.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickServiceData({ name: '', sku: '', cost_price: 0, description: '' });
                          setShowQuickAddServiceModal(true);
                        }}
                        className="inline-flex items-center text-xs font-bold text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> + Quick Add Service
                      </button>
                    </div>

                    {services.length === 0 ? (
                      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-500 mb-2">No services in the catalog yet.</p>
                        <button
                          type="button"
                          onClick={() => setShowQuickAddServiceModal(true)}
                          className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700"
                        >
                          + Create First Service
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto p-2 border border-gray-200 rounded-xl bg-slate-50/50">
                        {services.map(service => {
                          const isSelected = formData.service_ids.includes(service.id);
                          return (
                            <div
                              key={service.id}
                              onClick={() => toggleServiceSelection(service.id)}
                              className={`flex items-center space-x-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-purple-50 border-purple-300 text-purple-900 font-semibold'
                                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Controlled via parent onClick
                                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                              />
                              <div className="flex-1 truncate">
                                <span className="block truncate">{service.name}</span>
                                <span className="text-[10px] text-gray-400 block font-normal">
                                  Rate: {currency} {Number(service.cost_price || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: FINANCIAL & GL DEFAULTS */}
              {supplierFormTab === 'financial' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Default Expense Account */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Default Expense Account / Category (Chart of Accounts)
                    </label>
                    <select
                      value={formData.expense_account_id}
                      onChange={e => setFormData({ ...formData, expense_account_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                    >
                      <option value="">-- Default Inventory Asset / General Expense --</option>
                      {expenseAccounts.map(a => (
                        <option key={a.id} value={a.id}>
                          [{a.code}] {a.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Automatically pre-fills the debit expense account when generating invoices for this supplier (e.g. Internet & Tel for Safaricom).
                    </p>
                  </div>

                  {/* Withholding Tax Rate */}
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                        <Percent className="w-3.5 h-3.5 text-amber-600" />
                        <span>Withholding Tax (WHT) Default</span>
                      </div>
                      <span className="text-[11px] text-amber-700 font-medium">Default: 0.00%</span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="relative w-36">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={formData.withholding_tax_rate}
                          onChange={e => setFormData({ ...formData, withholding_tax_rate: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className="w-full border border-amber-300 rounded-lg px-3 py-1.5 text-sm font-bold bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1.5 text-xs text-gray-400 font-bold">%</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-tight">
                        Defaults to 0%. When non-zero (e.g., 5% for professional services), payments will automatically calculate withholding tax.
                      </p>
                    </div>
                  </div>

                  {/* Banking Info */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Equity Bank, KCB, Standard Chartered"
                        value={formData.bank_name}
                        onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Bank Account Number / Paybill
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 0123456789 or Paybill"
                        value={formData.account_number}
                        onChange={e => setFormData({ ...formData, account_number: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Status Toggle */}
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="supplier_active_toggle"
                      checked={formData.is_active}
                      onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="supplier_active_toggle" className="text-xs font-semibold text-gray-700">
                      Supplier is Active (Allowed for procurement orders)
                    </label>
                  </div>
                </div>
              )}
            </form>

            {/* Modal Actions */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center rounded-b-2xl">
              <div className="flex space-x-1">
                {supplierFormTab !== 'general' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (supplierFormTab === 'financial') setSupplierFormTab('services');
                      else if (supplierFormTab === 'services') setSupplierFormTab('general');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg"
                  >
                    ← Previous
                  </button>
                )}
                {supplierFormTab !== 'financial' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (supplierFormTab === 'general') setSupplierFormTab('services');
                      else if (supplierFormTab === 'services') setSupplierFormTab('financial');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    Next →
                  </button>
                )}
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="supplier-multi-form"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow disabled:opacity-50"
                >
                  {loading ? 'Saving...' : (editingSupplier ? 'Update Supplier' : 'Save Supplier')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK ADD SERVICE MODAL */}
      {/* ========================================================================= */}
      {showQuickAddServiceModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-gray-900">+ Add Service to Catalog</h3>
                <p className="text-xs text-gray-500 mt-0.5">Unified catalog item (`is_service = true`)</p>
              </div>
              <button
                onClick={() => setShowQuickAddServiceModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveQuickService} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Service Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Generator Maintenance, Internet Services"
                  value={quickServiceData.name}
                  onChange={e => setQuickServiceData({ ...quickServiceData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Service Code / SKU
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., SRV-GEN"
                    value={quickServiceData.sku}
                    onChange={e => setQuickServiceData({ ...quickServiceData, sku: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Default Rate / Cost ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={quickServiceData.cost_price}
                    onChange={e => setQuickServiceData({ ...quickServiceData, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief description of service specifications..."
                  value={quickServiceData.description}
                  onChange={e => setQuickServiceData({ ...quickServiceData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowQuickAddServiceModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingService}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow disabled:opacity-50"
                >
                  {savingService ? 'Saving...' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 360 SUPPLIER DETAIL MODAL (Tabs: Overview, Invoices, Statement, Aging) */}
      {/* ========================================================================= */}
      {show360Modal && viewingSupplier && (
        <SupplierDetailModal
          open={show360Modal}
          onClose={() => {
            setShow360Modal(false);
            setViewingSupplier(null);
          }}
          supplier={viewingSupplier}
          purchases={purchases}
          services={services}
          currency={currency}
          onEditSupplier={(sup) => {
            setShow360Modal(false);
            handleOpenEdit(sup);
          }}
          onRefreshPurchases={loadAllData}
        />
      )}

      {/* CREATE PURCHASE INVOICE MODAL */}
      {showCreateInvoiceModal && (
        <CreatePurchaseInvoiceModal
          open={showCreateInvoiceModal}
          onClose={() => setShowCreateInvoiceModal(false)}
          onSuccess={() => {
            setShowCreateInvoiceModal(false);
            loadAllData();
          }}
        />
      )}

      {/* RECORD PAYMENT MODAL */}
      {showRecordPaymentModal && selectedInvoiceForPayment && (
        <RecordPaymentModal
          open={showRecordPaymentModal}
          onClose={() => {
            setShowRecordPaymentModal(false);
            setSelectedInvoiceForPayment(null);
          }}
          invoice={selectedInvoiceForPayment}
          onPayment={() => {
            setShowRecordPaymentModal(false);
            setSelectedInvoiceForPayment(null);
            loadAllData();
          }}
        />
      )}
    </div>
  );
};

export default Suppliers; 