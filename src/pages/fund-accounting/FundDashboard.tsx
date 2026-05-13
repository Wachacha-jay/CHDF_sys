import React, { useState, useEffect } from 'react';
import { FundBalanceWidget } from '../../components/fund-accounting/FundBalanceWidget';
import { DimensionSelector } from '../../components/fund-accounting/DimensionSelector';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Users, Heart, School, ShieldAlert, HandCoins, Calendar, Receipt, Plus } from 'lucide-react';
import { FundAccountingService } from '../../services/fundAccountingService';
import toast from 'react-hot-toast';
import type { Donor, FundAccount, Donation } from '../../types';

const FundDashboard: React.FC = () => {
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<Partial<Donation>>({
    donation_date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'bank',
    is_anonymous: false
  });

  const [dimensions, setDimensions] = useState<{
    fund_id?: string;
    child_id?: string;
    donor_id?: string;
  }>({});

  useEffect(() => {
    const loadDropdowns = async () => {
      const [dList, fList, cList] = await Promise.all([
        FundAccountingService.getDonors(),
        FundAccountingService.getFundAccounts(),
        FundAccountingService.getChildren()
      ]);
      setDonors(dList);
      setFunds(fList);
      setChildren(cList);
    };
    loadDropdowns();
  }, []);

  const handleDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0 || !dimensions.donor_id) {
      toast.error('Please enter an amount and select a donor');
      return;
    }
    setSubmitting(true);
    const result = await FundAccountingService.recordDonation({
      ...formData,
      donor_id: dimensions.donor_id,
      fund_id: dimensions.fund_id,
      restricted_to_child_id: dimensions.child_id
    });
    setSubmitting(false);
    if (result) {
      toast.success('Donation recorded and posted to General Ledger');
      setShowDonationModal(false);
      setFormData({ donation_date: new Date().toISOString().split('T')[0], amount: 0, payment_method: 'bank', is_anonymous: false });
      setDimensions({});
    } else {
      toast.error('Failed to record donation');
    }
  };

  const fundDistribution = [
    { name: 'Education', value: 450000 },
    { name: 'Feeding', value: 300000 },
    { name: 'Healthcare', value: 150000 },
    { name: 'Unrestricted', value: 200000 },
  ];
  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444'];
  const monthlyTrends = [
    { name: 'Jan', donations: 4000, expenses: 2400 },
    { name: 'Feb', donations: 3000, expenses: 1398 },
    { name: 'Mar', donations: 2000, expenses: 9800 },
    { name: 'Apr', donations: 2780, expenses: 3908 },
    { name: 'May', donations: 1890, expenses: 4800 },
  ];

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Fund Accounting Command Center</h1>
          <p className="text-gray-500 mt-1">Real-time financial oversight and dimensional tracking</p>
        </div>
        <button
          onClick={() => setShowDonationModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-200 transition-all"
        >
          <Plus size={18} />
          Record Donation
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Sponsored Children', value: children.length || '—', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active Donors', value: donors.length || '—', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Fund Accounts', value: funds.length || '—', icon: School, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Restricted Fund Alerts', value: funds.filter(f => f.restriction_type !== 'unrestricted').length || '0', icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} w-fit mb-4`}>
              <stat.icon size={24} />
            </div>
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Main Balances */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Fund Account Balances</h2>
        <FundBalanceWidget />
      </section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6 flex items-center justify-between">
            Departmental Allocation
            <span className="text-xs font-normal text-gray-400 uppercase tracking-widest">Live Ledger Data</span>
          </h3>
          <div className="space-y-5">
            {[
              { name: 'Education Dept', amount: 450000, target: 1000000, color: 'bg-indigo-500' },
              { name: 'Medical/Health', amount: 150000, target: 500000, color: 'bg-emerald-500' },
              { name: 'Social Welfare', amount: 300000, target: 400000, color: 'bg-amber-500' },
              { name: 'Administration', amount: 200000, target: 250000, color: 'bg-rose-500' },
            ].map((dept, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{dept.name}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Current Balance</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">KES {dept.amount.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-500">Goal: {((dept.amount / dept.target) * 100).toFixed(0)}%</p>
                  </div>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${dept.color} transition-all duration-1000`}
                    style={{ width: `${Math.min((dept.amount / dept.target) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">Fund Allocation Distribution</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={fundDistribution} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {fundDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">Donation vs Utilization Trend</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrends}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend />
              <Bar dataKey="donations" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#10B981" radius={[4, 4, 0, 0]} />
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
                <h2 className="text-xl font-bold text-gray-900">Record Donation</h2>
              </div>
              <button onClick={() => setShowDonationModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleDonationSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES) <span className="text-red-500">*</span></label>
                  <input
                    type="number" required min={1}
                    className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-3 px-4 text-xl font-bold"
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
                      className="w-full pl-9 rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.donation_date}
                      onChange={e => setFormData({ ...formData, donation_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Receipt No.</label>
                  <div className="relative">
                    <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      className="w-full pl-9 rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g. MPESA-XXXX"
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
                  className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Any special instructions..."
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox" id="anon"
                  className="rounded text-indigo-600"
                  checked={formData.is_anonymous}
                  onChange={e => setFormData({ ...formData, is_anonymous: e.target.checked })}
                />
                <label htmlFor="anon" className="text-sm text-gray-600">Mark as anonymous donation</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit" disabled={submitting}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-60 shadow-lg shadow-indigo-100"
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
