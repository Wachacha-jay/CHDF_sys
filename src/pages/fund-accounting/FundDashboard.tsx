import React, { useState, useEffect, useMemo } from 'react';
import { FundBalanceWidget } from '../../components/fund-accounting/FundBalanceWidget';
import { DimensionSelector } from '../../components/fund-accounting/DimensionSelector';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Users, Heart, School, ShieldAlert, HandCoins, Calendar, Receipt, Plus, Wallet, DollarSign, Building2, RefreshCw } from 'lucide-react';
import { FundAccountingService } from '../../services/fundAccountingService';
import { AccountingService } from '../../services/accountingService';
import { ApiService } from '../../services/api';
import toast from 'react-hot-toast';
import type { Donor, FundAccount, Donation, Department, Account, Sponsorship } from '../../types';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899'];

const FundDashboard: React.FC = () => {
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentBalances, setDepartmentBalances] = useState<Map<string, number>>(new Map());
  const [fundBalances, setFundBalances] = useState<Map<string, number>>(new Map());
  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formData, setFormData] = useState<Partial<Donation>>({
    donation_date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'bank',
    payment_account_id: '',
    reference_number: '',
    notes: '',
    is_anonymous: false
  });

  const [dimensions, setDimensions] = useState<{
    fund_id?: string;
    child_id?: string;
    donor_id?: string;
  }>({});

  const loadAllDashboardData = async () => {
    try {
      setLoading(true);
      const [
        dList,
        fList,
        cList,
        sList,
        deptList,
        deptBalMap,
        fundBalMap,
        rawAccounts,
        donationsRes,
        expensesRes
      ] = await Promise.all([
        FundAccountingService.getDonors(),
        FundAccountingService.getFundAccounts(),
        FundAccountingService.getChildren(),
        FundAccountingService.getSponsorships(),
        FundAccountingService.getDepartments(),
        FundAccountingService.getDepartmentBalances(),
        FundAccountingService.getFundBalances(),
        AccountingService.getAccounts(),
        ApiService.get<Donation>('donations'),
        ApiService.get<any>('expenses')
      ]);

      setDonors(dList || []);
      setFunds(fList || []);
      setChildren(cList || []);
      setSponsorships(sList || []);
      setDepartments(deptList || []);
      setDepartmentBalances(deptBalMap || new Map());
      setFundBalances(fundBalMap || new Map());

      // Flatten accounts & extract asset/bank accounts
      const flat = AccountingService.flattenAccounts(rawAccounts || []);
      const assets = flat.filter(a => a.account_type === 'asset' || a.code?.startsWith('1'));
      setBankAccounts(assets);

      setDonations(donationsRes.success ? (donationsRes.data || []) : []);
      setExpenses(expensesRes.success ? (expensesRes.data || []) : []);

      // Default payment account if not set
      if (assets.length > 0 && !formData.payment_account_id) {
        setFormData(prev => ({ ...prev, payment_account_id: assets[0].id }));
      }
    } catch (err) {
      console.error('Failed to load fund dashboard data:', err);
      toast.error('Error loading live dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllDashboardData();
  }, [refreshKey]);

  const handleDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0 || !dimensions.donor_id) {
      toast.error('Please enter a valid amount and select a donor');
      return;
    }
    setSubmitting(true);
    try {
      const result = await FundAccountingService.recordDonation({
        ...formData,
        donor_id: dimensions.donor_id,
        fund_id: dimensions.fund_id,
        restricted_to_child_id: dimensions.child_id
      });

      if (result) {
        // Immediately post to GL to ensure ledger accuracy
        try {
          await FundAccountingService.postDonationToGL(result);
        } catch (glErr: any) {
          console.warn('GL auto-post notice:', glErr);
        }
        toast.success('Donation recorded and posted to General Ledger');
        setShowDonationModal(false);
        setFormData({
          donation_date: new Date().toISOString().split('T')[0],
          amount: 0,
          payment_method: 'bank',
          payment_account_id: bankAccounts.length > 0 ? bankAccounts[0].id : '',
          reference_number: '',
          notes: '',
          is_anonymous: false
        });
        setDimensions({});
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error('Failed to record donation');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error recording donation');
    } finally {
      setSubmitting(false);
    }
  };

  // Aggregate stats
  const activeSponsorshipCount = useMemo(() => {
    return sponsorships.filter(s => s.status === 'active').length;
  }, [sponsorships]);

  const totalFundBalance = useMemo(() => {
    let sum = 0;
    fundBalances.forEach(bal => {
      sum += bal;
    });
    return sum;
  }, [fundBalances]);

  const totalDonationsAmount = useMemo(() => {
    return donations.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  }, [donations]);

  // Dynamic Fund Distribution for Pie Chart
  const fundDistribution = useMemo(() => {
    const list = funds.map(f => {
      const bal = fundBalances.get(f.id) || 0;
      return {
        name: f.name,
        value: Math.max(0, bal)
      };
    }).filter(item => item.value > 0);

    if (list.length === 0) {
      // If balances are 0, show fund count with nominal weights or fallback
      return funds.map(f => ({ name: f.name, value: 1 }));
    }
    return list;
  }, [funds, fundBalances]);

  // Dynamic 6-Month Trend Data
  const monthlyTrends = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('default', { month: 'short' });
      const prefix = `${year}-${month}`;

      const monthDonations = donations
        .filter(dn => (dn.donation_date || '').startsWith(prefix))
        .reduce((sum, dn) => sum + Number(dn.amount || 0), 0);

      const monthExpenses = expenses
        .filter(ex => (ex.expense_date || '').startsWith(prefix))
        .reduce((sum, ex) => sum + Number(ex.amount || 0), 0);

      months.push({
        name: label,
        donations: monthDonations,
        expenses: monthExpenses
      });
    }
    return months;
  }, [donations, expenses]);

  // Dynamic Departmental Allocations
  const deptAllocations = useMemo(() => {
    if (departments.length === 0) return [];
    return departments.map((dept, index) => {
      const bal = departmentBalances.get(dept.id) || 0;
      const target = (dept as any).budget_limit || (dept as any).annual_budget || 500000;
      const safeAmount = Math.max(0, bal);
      const percentage = target > 0 ? Math.min((safeAmount / target) * 100, 100) : 0;
      return {
        name: dept.name,
        amount: safeAmount,
        target,
        percentage,
        color: COLORS[index % COLORS.length]
      };
    });
  }, [departments, departmentBalances]);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Fund Accounting Command Center</h1>
          <p className="text-gray-500 mt-1">Real-time financial oversight and dimensional tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            disabled={loading}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-all shadow-sm"
            title="Refresh live figures from database"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowDonationModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-200 transition-all"
          >
            <Plus size={18} />
            Record Donation
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600 w-fit mb-4">
            <Users size={24} />
          </div>
          <p className="text-sm font-medium text-gray-500">Sponsored Children</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-gray-900">{activeSponsorshipCount}</p>
            <span className="text-xs text-gray-400">of {children.length} enrolled</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600 w-fit mb-4">
            <Heart size={24} />
          </div>
          <p className="text-sm font-medium text-gray-500">Active Donors</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-gray-900">{donors.length}</p>
            <span className="text-xs text-gray-400">Total Donated: KES {totalDonationsAmount.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 w-fit mb-4">
            <Wallet size={24} />
          </div>
          <p className="text-sm font-medium text-gray-500">Total Fund Net Balance</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-emerald-700">
              KES {totalFundBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600 w-fit mb-4">
            <ShieldAlert size={24} />
          </div>
          <p className="text-sm font-medium text-gray-500">Restricted Funds</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-gray-900">
              {funds.filter(f => f.restriction_type !== 'unrestricted').length}
            </p>
            <span className="text-xs text-gray-400">of {funds.length} total funds</span>
          </div>
        </div>
      </div>

      {/* Main Balances */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Fund Account Balances</h2>
            <p className="text-xs text-gray-500">Live ledger balances calculated from general ledger journal entries</p>
          </div>
        </div>
        <FundBalanceWidget refreshTrigger={refreshKey} />
      </section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Departmental Allocation */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
            <span>Departmental Allocation</span>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Live Ledger Data</span>
          </h3>
          {deptAllocations.length === 0 ? (
            <p className="text-sm text-gray-400 py-12 text-center italic">No active departments found.</p>
          ) : (
            <div className="space-y-5">
              {deptAllocations.map((dept, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{dept.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase">Live Net Balance</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">KES {dept.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-500">Goal / Target: KES {dept.target.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${dept.percentage}%`,
                        backgroundColor: dept.color
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fund Allocation Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-2">Fund Allocation Distribution</h3>
          <p className="text-xs text-gray-400 mb-4">Breakdown of available funds across restricted & operational accounts</p>
          <div className="h-[280px]">
            {fundDistribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400 italic">
                No active fund allocations recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fundDistribution}
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {fundDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `KES ${Number(value).toLocaleString()}`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Donation vs Utilization Trend */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Donation vs Utilization Trend</h3>
            <p className="text-xs text-gray-400">Monthly comparison of donation inflows vs program expenses</p>
          </div>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrends}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={val => `${(val / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(val: any) => `KES ${Number(val).toLocaleString()}`}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend />
              <Bar dataKey="donations" name="Donations Received" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Operating Expenses" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Record Donation Modal */}
      {showDonationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <HandCoins size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Record Donation</h2>
                  <p className="text-xs text-gray-500">Record receipt and post directly to General Ledger</p>
                </div>
              </div>
              <button onClick={() => setShowDonationModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleDonationSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES) <span className="text-red-500">*</span></label>
                  <input
                    type="number" required min={1}
                    className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 px-4 text-xl font-bold border"
                    placeholder="0.00"
                    value={formData.amount || ''}
                    onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="date" required
                      className="w-full pl-9 rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 border"
                      value={formData.donation_date}
                      onChange={e => setFormData({ ...formData, donation_date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 border"
                    value={formData.payment_method}
                    onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                  >
                    <option value="bank">Bank Transfer</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Receiving Bank / Asset Account <span className="text-red-500">*</span></label>
                  <select
                    required
                    className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 border font-medium text-gray-900"
                    value={formData.payment_account_id || ''}
                    onChange={e => setFormData({ ...formData, payment_account_id: e.target.value })}
                  >
                    <option value="">-- Select Receiving Account --</option>
                    {bankAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        [{acc.code}] {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Receipt No.</label>
                  <div className="relative">
                    <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      className="w-full pl-9 rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2.5 border"
                      placeholder="e.g. MPESA-QWE12345 or CHEQUE-9081"
                      value={formData.reference_number || ''}
                      onChange={e => setFormData({ ...formData, reference_number: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Donor / Fund / Child Targeting <span className="text-red-500">*</span></label>
                <DimensionSelector value={dimensions} onChange={setDimensions} />
                <p className="text-xs text-gray-400 italic mt-1">Select a donor (required), then optionally restrict to a fund or child.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 border p-2"
                  placeholder="Any special donor instructions or project details..."
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox" id="anon"
                  className="rounded text-indigo-600 h-4 w-4"
                  checked={formData.is_anonymous}
                  onChange={e => setFormData({ ...formData, is_anonymous: e.target.checked })}
                />
                <label htmlFor="anon" className="text-sm text-gray-700 font-medium cursor-pointer">Mark as anonymous donation</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit" disabled={submitting}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-60 shadow-lg shadow-indigo-100 transition-all"
                >
                  {submitting ? 'Posting to Ledger...' : 'Record & Post to General Ledger'}
                </button>
                <button
                  type="button" onClick={() => setShowDonationModal(false)}
                  className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundDashboard;
