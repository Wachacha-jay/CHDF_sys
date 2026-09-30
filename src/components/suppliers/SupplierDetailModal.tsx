import React, { useState, useMemo } from 'react';
import { 
  X, Building2, Mail, Phone, MapPin, User, FileText, 
  CreditCard, Clock, CheckCircle2, AlertCircle, Printer, 
  Calendar, Layers, ShieldCheck, DollarSign, ArrowUpRight,
  TrendingDown, TrendingUp, Tag
} from 'lucide-react';
import type { Supplier, Purchase, Product } from '../../types';
import RecordPaymentModal from '../inventory/RecordPaymentModal';
import { useNavigate } from 'react-router-dom';

interface SupplierDetailModalProps {
  open: boolean;
  onClose: () => void;
  supplier: Supplier;
  purchases: Purchase[];
  services: Product[];
  currency?: string;
  onEditSupplier: (supplier: Supplier) => void;
  onRefreshPurchases: () => void;
}

const SupplierDetailModal: React.FC<SupplierDetailModalProps> = ({
  open,
  onClose,
  supplier,
  purchases,
  services,
  currency = 'KES',
  onEditSupplier,
  onRefreshPurchases
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'statement' | 'aging'>('overview');
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Purchase | null>(null);
  const [statementFilter, setStatementFilter] = useState<'all' | '30' | '90' | 'year'>('all');

  // Supplier purchases
  const supplierPurchases = useMemo(() => {
    return purchases
      .filter(p => p.supplier_id === supplier.id)
      .sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());
  }, [purchases, supplier.id]);

  // Financial summary
  const financialSummary = useMemo(() => {
    const totalBilled = supplierPurchases.reduce((acc, p) => acc + Number(p.total_amount || 0), 0);
    const totalPaid = supplierPurchases.reduce((acc, p) => acc + Number(p.paid_amount || 0), 0);
    const balanceDue = Math.max(0, totalBilled - totalPaid);
    const overdueCount = supplierPurchases.filter(p => {
      const isPaid = p.payment_status === 'paid' || Number(p.paid_amount || 0) >= Number(p.total_amount || 0);
      if (isPaid) return false;
      if (!p.due_date) return false;
      return new Date(p.due_date) < new Date();
    }).length;

    return { totalBilled, totalPaid, balanceDue, overdueCount };
  }, [supplierPurchases]);

  // Supplier matched services
  const supplierServices = useMemo(() => {
    if (!supplier.service_ids || !Array.isArray(supplier.service_ids)) return [];
    return services.filter(s => supplier.service_ids?.includes(s.id));
  }, [services, supplier.service_ids]);

  // Aging analysis
  const agingAnalysis = useMemo(() => {
    const now = new Date().getTime();
    let current = 0;   // 0-30 days
    let days31_60 = 0; // 31-60 days
    let days61_90 = 0; // 61-90 days
    let days90Plus = 0; // 90+ days

    supplierPurchases.forEach(p => {
      const balance = Math.max(0, Number(p.total_amount || 0) - Number(p.paid_amount || 0));
      if (balance <= 0) return;

      const invoiceDate = new Date(p.purchase_date).getTime();
      const ageDays = Math.max(0, Math.floor((now - invoiceDate) / (1000 * 60 * 60 * 24)));

      if (ageDays <= 30) {
        current += balance;
      } else if (ageDays <= 60) {
        days31_60 += balance;
      } else if (ageDays <= 90) {
        days61_90 += balance;
      } else {
        days90Plus += balance;
      }
    });

    const totalOutstanding = current + days31_60 + days61_90 + days90Plus;
    return {
      current,
      days31_60,
      days61_90,
      days90Plus,
      totalOutstanding
    };
  }, [supplierPurchases]);

  // Statement ledger entries with running balance
  const statementEntries = useMemo(() => {
    type LedgerEvent = {
      id: string;
      date: string;
      ref: string;
      type: 'invoice' | 'payment';
      description: string;
      debit: number;
      credit: number;
      rawDate: number;
    };

    const events: LedgerEvent[] = [];

    supplierPurchases.forEach(p => {
      events.push({
        id: `inv-${p.id}`,
        date: p.purchase_date,
        ref: p.purchase_number,
        type: 'invoice',
        description: p.notes || `Purchase Invoice ${p.purchase_number}`,
        debit: Number(p.total_amount || 0),
        credit: 0,
        rawDate: new Date(p.purchase_date).getTime()
      });

      if (Number(p.paid_amount || 0) > 0) {
        events.push({
          id: `pay-${p.id}`,
          date: p.purchase_date,
          ref: `PAY-${p.purchase_number}`,
          type: 'payment',
          description: `Payment towards ${p.purchase_number}`,
          debit: 0,
          credit: Number(p.paid_amount || 0),
          rawDate: new Date(p.purchase_date).getTime() + 1000
        });
      }
    });

    events.sort((a, b) => a.rawDate - b.rawDate);

    let runningBalance = 0;
    return events.map(ev => {
      runningBalance += (ev.debit - ev.credit);
      return {
        ...ev,
        runningBalance
      };
    });
  }, [supplierPurchases]);

  const filteredStatementEntries = useMemo(() => {
    if (statementFilter === 'all') return statementEntries;
    const now = new Date();
    let cutoff = new Date();
    if (statementFilter === '30') cutoff.setDate(now.getDate() - 30);
    else if (statementFilter === '90') cutoff.setDate(now.getDate() - 90);
    else if (statementFilter === 'year') cutoff.setFullYear(now.getFullYear(), 0, 1);

    return statementEntries.filter(e => new Date(e.date) >= cutoff);
  }, [statementEntries, statementFilter]);

  const handlePrintStatement = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Supplier Statement - ${supplier.name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 30px; color: #1f2937; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 25px; }
          .title { font-size: 24px; font-weight: bold; color: #1e3a8a; }
          .meta { font-size: 13px; color: #6b7280; }
          .supplier-box { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
          .summary-card { background: #f1f5f9; padding: 12px; border-radius: 6px; text-align: center; }
          .summary-val { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th, td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
          th { background: #f8fafc; font-weight: 600; color: #475569; }
          .text-right { text-align: right; }
          .bold { font-weight: 600; }
          .balance-cell { font-family: monospace; font-weight: bold; color: #1e293b; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">SUPPLIER STATEMENT OF ACCOUNT</div>
            <div class="meta">Generated: ${new Date().toLocaleDateString()} | Currency: ${currency}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: bold; font-size: 16px;">Vendor Code: ${supplier.code}</div>
            <div class="meta">${supplier.organization_name || ''}</div>
          </div>
        </div>

        <div class="supplier-box">
          <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">${supplier.name}</div>
          <div class="meta">Contact: ${supplier.contact_person || 'N/A'} | Email: ${supplier.email || 'N/A'} | Phone: ${supplier.phone || 'N/A'}</div>
          <div class="meta">Address: ${supplier.address || 'N/A'}</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="meta">Total Invoiced</div>
            <div class="summary-val">${currency} ${financialSummary.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-card">
            <div class="meta">Total Payments</div>
            <div class="summary-val" style="color: #059669;">${currency} ${financialSummary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-card">
            <div class="meta">Outstanding Balance Due</div>
            <div class="summary-val" style="color: #dc2626;">${currency} ${financialSummary.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference #</th>
              <th>Description</th>
              <th class="text-right">Invoiced (+)</th>
              <th class="text-right">Paid (-)</th>
              <th class="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${filteredStatementEntries.map(e => `
              <tr>
                <td>${new Date(e.date).toLocaleDateString()}</td>
                <td><strong>${e.ref}</strong></td>
                <td>${e.description}</td>
                <td class="text-right">${e.debit > 0 ? currency + ' ' + e.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                <td class="text-right">${e.credit > 0 ? currency + ' ' + e.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                <td class="text-right balance-cell">${currency} ${e.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          This is an official computer-generated statement of accounts.
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-bold text-2xl shadow-inner">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl font-bold tracking-tight text-white">{supplier.name}</h2>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200">
                  {supplier.code}
                </span>
                {supplier.is_active ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Active Vendor
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Inactive
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-300 mt-1 flex items-center gap-3">
                {supplier.organization_name && <span>{supplier.organization_name}</span>}
                {supplier.department && (
                  <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded text-xs text-indigo-200 font-medium">
                    <Layers className="w-3 h-3" /> Dept: {supplier.department.name}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditSupplier(supplier)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold text-white transition-colors"
            >
              Edit Details
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Financial KPI Banner */}
        <div className="bg-slate-50 border-b border-gray-200 px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-500" /> Total Invoiced
            </div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {currency} {financialSummary.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">{supplierPurchases.length} invoices generated</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Total Settled
            </div>
            <div className="text-lg font-bold text-emerald-600 mt-1">
              {currency} {financialSummary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Cleared via Bank/Cash</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" /> Balance Due
            </div>
            <div className={`text-lg font-bold mt-1 ${financialSummary.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {currency} {financialSummary.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {financialSummary.balanceDue > 0 ? 'Outstanding Accounts Payable' : 'Zero balance / Cleared'}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Overdue Invoices
            </div>
            <div className={`text-lg font-bold mt-1 ${financialSummary.overdueCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {financialSummary.overdueCount}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Past credit terms</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50/50 px-6 gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3.5 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="w-4 h-4" />
            Profile &amp; Financial Setup
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-3.5 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'invoices'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Purchases &amp; Invoices ({supplierPurchases.length})
          </button>
          <button
            onClick={() => setActiveTab('statement')}
            className={`py-3.5 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'statement'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Statement of Account
          </button>
          <button
            onClick={() => setActiveTab('aging')}
            className={`py-3.5 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'aging'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            Payables Aging Report
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* TAB 1: OVERVIEW & PROFILE */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Contact & Location Details */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2 border-b pb-2">
                    <User className="w-4 h-4 text-indigo-600" /> Contact &amp; Company Info
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-gray-400" /> Organization</span>
                      <span className="font-semibold text-gray-900">{supplier.organization_name || 'N/A'}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5"><User className="w-4 h-4 text-gray-400" /> Contact Person</span>
                      <span className="font-medium text-gray-800">{supplier.contact_person || 'N/A'}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5"><Mail className="w-4 h-4 text-gray-400" /> Email</span>
                      <a href={`mailto:${supplier.email}`} className="text-indigo-600 hover:underline">{supplier.email || 'N/A'}</a>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5"><Phone className="w-4 h-4 text-gray-400" /> Phone</span>
                      <span className="font-medium text-gray-800">{supplier.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" /> Address</span>
                      <span className="text-gray-700 text-right max-w-xs">{supplier.address || 'N/A'}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Tax ID / PIN</span>
                      <span className="font-mono text-gray-800">{supplier.tax_number || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Accounting & Procurement Configuration */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2 border-b pb-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" /> Accounting &amp; Fund Settings
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5"><Layers className="w-4 h-4 text-indigo-500" /> Fund Dept</span>
                      <span className="font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full text-xs">
                        {supplier.department?.name || 'All Departments (General)'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Default Expense GL</span>
                      <span className="font-medium text-gray-900 text-right">
                        {supplier.expense_account ? `[${supplier.expense_account.code}] ${supplier.expense_account.name}` : 'Default Inventory / Unassigned'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Withholding Tax (WHT)</span>
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full text-xs">
                        {Number(supplier.withholding_tax_rate || 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Payment Credit Terms</span>
                      <span className="font-semibold text-gray-900">{supplier.payment_terms || 30} Days</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Bank Name</span>
                      <span className="font-medium text-gray-900">{supplier.bank_name || 'N/A'}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-500">Bank Account #</span>
                      <span className="font-mono text-gray-900">{supplier.account_number || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Services Provided Section */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-indigo-600" /> Services &amp; Supplies Provided
                </h3>
                {supplierServices.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {supplierServices.map(srv => (
                      <div key={srv.id} className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-sm text-gray-900">{srv.name}</div>
                          <div className="text-xs font-mono text-gray-500">{srv.code}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Standard Rate</div>
                          <div className="text-sm font-bold text-indigo-700">
                            {currency} {Number(srv.cost_price || srv.selling_price || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-xl text-center">
                    No specific services tagged yet. Click "Edit Details" to assign services from your service catalog.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INVOICES & PURCHASES */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-500">Showing all purchase invoices recorded for this supplier.</p>
                <div className="text-xs text-gray-500 font-mono">
                  {supplierPurchases.length} Records Found
                </div>
              </div>

              {supplierPurchases.length > 0 ? (
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wider border-b">
                      <tr>
                        <th className="px-4 py-3">Invoice #</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Due Date</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-right">Paid</th>
                        <th className="px-4 py-3 text-right">Balance Due</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {supplierPurchases.map(purchase => {
                        const total = Number(purchase.total_amount || 0);
                        const paid = Number(purchase.paid_amount || 0);
                        const due = Math.max(0, total - paid);
                        const isOverdue = purchase.due_date && new Date(purchase.due_date) < new Date() && due > 0;

                        return (
                          <tr key={purchase.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-indigo-600">{purchase.purchase_number}</td>
                            <td className="px-4 py-3 text-gray-600">{new Date(purchase.purchase_date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-gray-500">
                              {purchase.due_date ? new Date(purchase.due_date).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                              {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                              {currency} {paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right font-bold font-mono">
                              <span className={due > 0 ? 'text-rose-600' : 'text-gray-400'}>
                                {currency} {due.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {purchase.payment_status === 'paid' || due <= 0 ? (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                  PAID
                                </span>
                              ) : isOverdue ? (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                                  OVERDUE
                                </span>
                              ) : purchase.payment_status === 'partial' ? (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                  PARTIAL
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                                  PENDING
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    onClose();
                                    navigate(`/purchases/${purchase.id}`);
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-xs font-medium"
                                  title="View Invoice Detail"
                                >
                                  <ArrowUpRight className="w-4 h-4" />
                                </button>
                                {due > 0 && (
                                  <button
                                    onClick={() => setSelectedInvoiceForPayment(purchase)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                  >
                                    <CreditCard className="w-3.5 h-3.5" /> Pay
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600">No purchase invoices on record for this vendor.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STATEMENT OF ACCOUNT */}
          {activeTab === 'statement' && (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Date Period:</span>
                  <div className="flex rounded-lg bg-white border border-gray-200 p-0.5">
                    <button
                      onClick={() => setStatementFilter('all')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        statementFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      All History
                    </button>
                    <button
                      onClick={() => setStatementFilter('30')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        statementFilter === '30' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Last 30 Days
                    </button>
                    <button
                      onClick={() => setStatementFilter('90')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        statementFilter === '90' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Last 90 Days
                    </button>
                    <button
                      onClick={() => setStatementFilter('year')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        statementFilter === 'year' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      This Year
                    </button>
                  </div>
                </div>

                <button
                  onClick={handlePrintStatement}
                  className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" /> Print Statement
                </button>
              </div>

              {filteredStatementEntries.length > 0 ? (
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wider border-b">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Reference #</th>
                        <th className="px-4 py-3">Transaction Description</th>
                        <th className="px-4 py-3 text-right">Invoiced (+)</th>
                        <th className="px-4 py-3 text-right">Payment (-)</th>
                        <th className="px-4 py-3 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStatementEntries.map(entry => (
                        <tr key={entry.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-4 py-3 text-gray-600 font-medium">
                            {new Date(entry.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-900">
                            {entry.ref}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {entry.description}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {entry.debit > 0 ? `${currency} ${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600">
                            {entry.credit > 0 ? `${currency} ${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold font-mono text-gray-900">
                            {currency} {entry.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-gray-300 font-bold">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right uppercase text-xs text-gray-600">
                          Current Closing Outstanding Balance:
                        </td>
                        <td colSpan={3} className="px-4 py-3 text-right text-base text-rose-600 font-mono">
                          {currency} {financialSummary.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600">No transactions recorded in this period.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AGING ANALYSIS REPORT */}
          {activeTab === 'aging' && (
            <div className="space-y-6">
              <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-bold">Accounts Payable Aging Schedule</h3>
                    <p className="text-xs text-slate-400 mt-1">Maturity analysis of unpaid invoices for {supplier.name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase text-slate-400 font-medium">Total Overdue / Due</div>
                    <div className="text-2xl font-black text-rose-400 font-mono mt-0.5">
                      {currency} {agingAnalysis.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Aging visual progress bar */}
                {agingAnalysis.totalOutstanding > 0 && (
                  <div className="mt-6 space-y-2">
                    <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
                      <div 
                        style={{ width: `${(agingAnalysis.current / agingAnalysis.totalOutstanding) * 100}%` }}
                        className="bg-emerald-500 h-full"
                        title="Current (0-30 Days)"
                      />
                      <div 
                        style={{ width: `${(agingAnalysis.days31_60 / agingAnalysis.totalOutstanding) * 100}%` }}
                        className="bg-blue-500 h-full"
                        title="31-60 Days"
                      />
                      <div 
                        style={{ width: `${(agingAnalysis.days61_90 / agingAnalysis.totalOutstanding) * 100}%` }}
                        className="bg-amber-500 h-full"
                        title="61-90 Days"
                      />
                      <div 
                        style={{ width: `${(agingAnalysis.days90Plus / agingAnalysis.totalOutstanding) * 100}%` }}
                        className="bg-rose-500 h-full"
                        title="90+ Days Overdue"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Aging Buckets Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-sm">
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Current (0 - 30 Days)</div>
                  <div className="text-xl font-bold font-mono text-emerald-900 mt-1.5">
                    {currency} {agingAnalysis.current.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-1 font-medium">Within standard terms</div>
                </div>

                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 shadow-sm">
                  <div className="text-xs font-bold text-blue-800 uppercase tracking-wider">31 - 60 Days</div>
                  <div className="text-xl font-bold font-mono text-blue-900 mt-1.5">
                    {currency} {agingAnalysis.days31_60.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-blue-700 mt-1 font-medium">Early attention</div>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 shadow-sm">
                  <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">61 - 90 Days</div>
                  <div className="text-xl font-bold font-mono text-amber-900 mt-1.5">
                    {currency} {agingAnalysis.days61_90.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-amber-700 mt-1 font-medium">Overdue payables</div>
                </div>

                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 shadow-sm">
                  <div className="text-xs font-bold text-rose-800 uppercase tracking-wider">90+ Days Overdue</div>
                  <div className="text-xl font-bold font-mono text-rose-900 mt-1.5">
                    {currency} {agingAnalysis.days90Plus.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-rose-700 mt-1 font-medium">Critical / Action needed</div>
                </div>
              </div>

              {/* Unpaid Invoices Aging Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-4 py-3 border-b text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Open Invoices Aging Breakdown
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 font-semibold text-xs border-b">
                    <tr>
                      <th className="px-4 py-2.5">Invoice #</th>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Age (Days)</th>
                      <th className="px-4 py-2.5">Bucket</th>
                      <th className="px-4 py-2.5 text-right">Outstanding Amount</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {supplierPurchases
                      .filter(p => (Number(p.total_amount || 0) - Number(p.paid_amount || 0)) > 0)
                      .map(p => {
                        const due = Number(p.total_amount || 0) - Number(p.paid_amount || 0);
                        const ageDays = Math.max(0, Math.floor((new Date().getTime() - new Date(p.purchase_date).getTime()) / (1000 * 60 * 60 * 24)));
                        const bucket = ageDays <= 30 ? '0-30 Days' : ageDays <= 60 ? '31-60 Days' : ageDays <= 90 ? '61-90 Days' : '90+ Days Overdue';
                        const badgeColor = ageDays <= 30 ? 'bg-emerald-100 text-emerald-800' : ageDays <= 60 ? 'bg-blue-100 text-blue-800' : ageDays <= 90 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';

                        return (
                          <tr key={p.id} className="hover:bg-gray-50/80">
                            <td className="px-4 py-3 font-mono font-bold text-indigo-600">{p.purchase_number}</td>
                            <td className="px-4 py-3 text-gray-600">{new Date(p.purchase_date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 font-medium text-gray-700">{ageDays} days</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeColor}`}>
                                {bucket}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold font-mono text-rose-600">
                              {currency} {due.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setSelectedInvoiceForPayment(p)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                              >
                                Record Payment
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
          <div>
            Vendor ID: <span className="font-mono text-gray-700">{supplier.id}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-xl text-sm transition-colors"
          >
            Close 360 View
          </button>
        </div>

      </div>

      {/* Embedded Payment Modal if triggered from Supplier Detail */}
      {selectedInvoiceForPayment && (
        <RecordPaymentModal
          open={!!selectedInvoiceForPayment}
          onClose={() => setSelectedInvoiceForPayment(null)}
          invoice={selectedInvoiceForPayment}
          onPayment={() => {
            setSelectedInvoiceForPayment(null);
            onRefreshPurchases();
          }}
        />
      )}

    </div>
  );
};

export default SupplierDetailModal;
