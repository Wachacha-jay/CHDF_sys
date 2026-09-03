import React, { useEffect, useState } from 'react';
import { SalesService } from '../services/salesService';
import { SupplierService } from '../services/supplierService';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useNavigate } from 'react-router-dom';
import type { Sale, Purchase } from '../types';
import CreatePurchaseInvoiceModal from '../components/invoices/CreatePurchaseInvoiceModal';
import { Plus } from 'lucide-react';

const InvoiceList: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unpaid'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const navigate = useNavigate();
  const { settings } = useSettingsContext();

  const loadData = () => {
    setLoading(true);
    Promise.all([
      SalesService.getSales(),
      SupplierService.getPurchases()
    ]).then(([salesData, purchaseData]) => {
      setSales(salesData);
      setPurchases(purchaseData);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const applyFilters = (items: any[], type: 'sale' | 'purchase') => {
    return items.filter(inv => {
      // Status filter
      if (filter === 'unpaid' && inv.payment_status === 'paid') return false;
      
      // Date filter
      const invDate = new Date(type === 'sale' ? inv.sale_date : inv.purchase_date).getTime();
      if (startDate && invDate < new Date(startDate).getTime()) return false;
      if (endDate && invDate > new Date(endDate).getTime()) return false;
      
      // Person filter
      if (personSearch) {
        const personName = (type === 'sale' ? inv.customer?.name : inv.supplier?.name) || '';
        if (!personName.toLowerCase().includes(personSearch.toLowerCase())) return false;
      }
      
      return true;
    });
  };

  const filteredSales = applyFilters(sales, 'sale');
  const filteredPurchases = applyFilters(purchases, 'purchase');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold uppercase">{status}</span>;
      case 'partial':
        return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-semibold uppercase">{status}</span>;
      case 'pending':
        return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold uppercase">{status}</span>;
      case 'overdue':
        return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold uppercase">{status}</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-semibold uppercase">{status}</span>;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Create Invoice
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Status</label>
          <div className="flex gap-2">
            <button
              className={`px-4 py-2 rounded-lg border ${filter === 'all' ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`px-4 py-2 rounded-lg border ${filter === 'unpaid' ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
              onClick={() => setFilter('unpaid')}
            >
              Unpaid/Partial
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm text-gray-600 mb-1">Customer / Supplier</label>
          <input
            type="text"
            placeholder="Search by name..."
            value={personSearch}
            onChange={(e) => setPersonSearch(e.target.value)}
            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        {(startDate || endDate || personSearch || filter !== 'all') && (
          <div>
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setPersonSearch(''); setFilter('all'); }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer/Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.map(inv => (
                <tr key={`sale-${inv.id}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3"><span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium border border-purple-200">Sale</span></td>
                  <td className="px-4 py-3 font-medium text-blue-600">{inv.sale_number}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.customer?.name || 'Walk-in'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(inv.sale_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-bold">{settings?.default_currency && settings.default_currency !== 'USD' ? settings.default_currency : 'KES'} {inv.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="px-4 py-3">{getStatusBadge(inv.payment_status)}</td>
                  <td className="px-4 py-3">
                    <button className="text-blue-600 hover:text-blue-900 font-medium text-sm border border-blue-200 bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition-colors" onClick={() => navigate(`/invoice/${inv.id}`)}>View</button>
                  </td>
                </tr>
              ))}
              {filteredPurchases.map(inv => (
                <tr key={`purchase-${inv.id}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3"><span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs font-medium border border-indigo-200">Purchase</span></td>
                  <td className="px-4 py-3 font-medium text-indigo-600">{inv.purchase_number}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.supplier?.name || 'N/A'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(inv.purchase_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-bold">{settings?.default_currency && settings.default_currency !== 'USD' ? settings.default_currency : 'KES'} {inv.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="px-4 py-3">{getStatusBadge(inv.payment_status)}</td>
                  <td className="px-4 py-3">
                    <button className="text-blue-600 hover:text-blue-900 font-medium text-sm border border-blue-200 bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition-colors" onClick={() => navigate(`/purchase-invoice/${inv.id}`)}>View</button>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    <p className="text-lg font-medium text-gray-900 mb-1">No invoices found</p>
                    <p>Try adjusting your filters or date range.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      
      <CreatePurchaseInvoiceModal 
        open={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadData();
        }}
      />
    </div>
  );
};

export default InvoiceList; 