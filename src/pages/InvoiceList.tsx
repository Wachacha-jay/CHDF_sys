import React, { useEffect, useState } from 'react';
import { SalesService } from '../services/salesService';
import { SupplierService } from '../services/supplierService';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useNavigate } from 'react-router-dom';
import type { Sale, Purchase } from '../types';

const InvoiceList: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unpaid'>('all');
  const navigate = useNavigate();
  const { settings } = useSettingsContext();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      SalesService.getSales(),
      SupplierService.getPurchases()
    ]).then(([salesData, purchaseData]) => {
      setSales(salesData);
      setPurchases(purchaseData);
      setLoading(false);
    });
  }, []);

  const filteredSales = filter === 'unpaid'
    ? sales.filter(inv => inv.payment_status !== 'paid')
    : sales;
  const filteredPurchases = filter === 'unpaid'
    ? purchases.filter(inv => inv.payment_status !== 'paid')
    : purchases;

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
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Invoices</h1>
      <div className="mb-4 flex gap-4">
        <button
          className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`px-4 py-2 rounded ${filter === 'unpaid' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setFilter('unpaid')}
        >
          Unpaid/Partial
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer/Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.map(inv => (
                <tr key={`sale-${inv.id}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">Sale</span></td>
                  <td className="px-4 py-3 font-medium text-blue-600">{inv.sale_number}</td>
                  <td className="px-4 py-3">{inv.customer?.name || 'Walk-in'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(inv.sale_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-bold">{settings?.default_currency || 'USD'} {inv.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="px-4 py-3">{getStatusBadge(inv.payment_status)}</td>
                  <td className="px-4 py-3">
                    <button className="text-blue-600 hover:text-blue-900 font-medium text-sm border border-blue-200 bg-blue-50 px-3 py-1 rounded" onClick={() => navigate(`/invoice/${inv.id}`)}>View</button>
                  </td>
                </tr>
              ))}
              {filteredPurchases.map(inv => (
                <tr key={`purchase-${inv.id}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs">Purchase</span></td>
                  <td className="px-4 py-3 font-medium text-indigo-600">{inv.purchase_number}</td>
                  <td className="px-4 py-3">{inv.supplier?.name || 'N/A'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(inv.purchase_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-bold">{settings?.default_currency || 'USD'} {inv.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="px-4 py-3">{getStatusBadge(inv.payment_status)}</td>
                  <td className="px-4 py-3">
                    <button className="text-blue-600 hover:text-blue-900 font-medium text-sm border border-blue-200 bg-blue-50 px-3 py-1 rounded" onClick={() => navigate(`/purchase-invoice/${inv.id}`)}>View</button>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">No invoices found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InvoiceList; 