import React, { useState, useEffect } from 'react';
import { Donor, FundAccount, Donation } from '../../types';
import { FundAccountingService } from '../../services/fundAccountingService';
import { ApiService } from '../../services/api';
import { DimensionSelector } from '../../components/fund-accounting/DimensionSelector';
import { Plus, HandCoins, Calendar, History, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';

const Donations: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [showDonorModal, setShowDonorModal] = useState(false);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<Partial<Donation>>({
    donation_date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'bank',
    is_anonymous: false
  });

  const [donorFormData, setDonorFormData] = useState<Partial<Donor>>({
    name: '',
    email: '',
    phone: '',
    donor_type: 'individual'
  });

  const [dimensions, setDimensions] = useState<{
    fund_id?: string;
    child_id?: string;
    donor_id?: string;
  }>({});

  const loadData = async () => {
    setLoading(true);
    const [dList, fList, donationList] = await Promise.all([
      FundAccountingService.getDonors(),
      FundAccountingService.getFundAccounts(),
      ApiService.get<any>('donations', { orderBy: { column: 'donation_date', ascending: false }, limit: 10 })
    ]);
    setDonors(dList);
    setFunds(fList);
    setDonations(donationList.success ? (donationList.data || []) : []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDonorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await FundAccountingService.createDonor(donorFormData);
    if (result) {
        toast.success('Donor added successfully');
        setShowDonorModal(false);
        setDonorFormData({ name: '', email: '', phone: '', donor_type: 'individual' });
        loadData();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0 || !dimensions.donor_id) {
        toast.error('Please enter amount and select a donor');
        return;
    }

    const payload = {
        ...formData,
        donor_id: dimensions.donor_id,
        fund_id: dimensions.fund_id,
        restricted_to_child_id: dimensions.child_id
    };

    const result = await FundAccountingService.recordDonation(payload);
    if (result) {
        toast.success('Donation recorded and posted to General Ledger');
        setShowModal(false);
        setFormData({
            donation_date: new Date().toISOString().split('T')[0],
            amount: 0,
            payment_method: 'bank',
            is_anonymous: false
        });
        setDimensions({});
    } else {
        toast.error('Failed to record donation');
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Donation Management</h1>
          <p className="text-gray-500">Track and allocate contributions with full audit trails</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowDonorModal(true)}
            className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-xl font-medium hover:bg-indigo-50 transition-colors shadow-sm"
          >
            <Plus size={18} />
            Add Donor
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <HandCoins size={18} />
            Record New Donation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Donations List */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <History size={18} className="text-indigo-600" />
              Recent Contributions
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Donor / Date</th>
                  <th className="px-6 py-4 font-semibold">Fund / Tag</th>
                  <th className="px-6 py-4 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr className="animate-pulse">
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-400">Loading history...</td>
                  </tr>
                ) : donations.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500">No donations recorded yet</td>
                  </tr>
                ) : donations.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{donors.find(donor => donor.id === d.donor_id)?.name || 'Unknown Donor'}</div>
                      <div className="text-xs text-gray-400">{new Date(d.donation_date).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {d.fund_id && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase">
                            {funds.find(f => f.id === d.fund_id)?.name || 'Fund'}
                          </span>
                        )}
                        {d.restricted_to_child_id && (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-bold uppercase">Child Restricted</span>
                        )}
                        {!d.fund_id && !d.restricted_to_child_id && (
                          <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-[10px] font-bold uppercase">Unrestricted</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                      KES {Number(d.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Insights Card */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Funding Insights</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl">
                <div>
                  <p className="text-xs text-emerald-600 font-bold uppercase">Total Receipts</p>
                  <p className="text-lg font-bold text-emerald-700">KES {donations.reduce((acc, d) => acc + Number(d.amount), 0).toLocaleString()}</p>
                </div>
                <HandCoins className="text-emerald-300" size={32} />
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase">Restricted Allocation</p>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[65%]"></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Restricted (65%)</span>
                  <span>Unrestricted (35%)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-100 text-white">
            <h3 className="font-bold mb-2">Audit Ready</h3>
            <p className="text-indigo-100 text-sm leading-relaxed">
              Every donation recorded here instantly creates a balanced Journal Entry in the General Ledger. 
              Restricted funds are tagged at the line level for real-time compliance reporting.
            </p>
          </div>
        </div>
      </div>

      {/* Add Donor Modal */}
      {showDonorModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
              <h2 className="text-xl font-bold text-gray-900">Add New Donor</h2>
              <button onClick={() => setShowDonorModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleDonorSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name / Organization</label>
                <input 
                  type="text" 
                  required 
                  className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" 
                  value={donorFormData.name}
                  onChange={(e) => setDonorFormData({...donorFormData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input 
                  type="email" 
                  className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" 
                  value={donorFormData.email}
                  onChange={(e) => setDonorFormData({...donorFormData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                <input 
                  type="text" 
                  className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" 
                  value={donorFormData.phone}
                  onChange={(e) => setDonorFormData({...donorFormData, phone: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Donor Type</label>
                <select 
                  className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                  value={donorFormData.donor_type}
                  onChange={(e) => setDonorFormData({...donorFormData, donor_type: e.target.value as any})}
                >
                  <option value="individual">Individual</option>
                  <option value="corporate">Corporate</option>
                  <option value="foundation">Foundation</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-xl font-bold hover:bg-indigo-700">Save Donor</button>
                <button type="button" onClick={() => setShowDonorModal(false)} className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Donation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-emerald-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <HandCoins size={24} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Record Contribution</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-2xl">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Donation Amount (KES)</label>
                    <input 
                      type="number" 
                      className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 py-3 px-4 text-xl font-bold"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="date" 
                        className="w-full pl-10 rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500"
                        value={formData.donation_date}
                        onChange={(e) => setFormData({...formData, donation_date: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select 
                      className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500"
                      value={formData.payment_method}
                      onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                    >
                      <option value="bank">Bank Transfer</option>
                      <option value="mpesa">M-Pesa STK</option>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number / Receipt ID</label>
                    <div className="relative">
                      <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        className="w-full pl-10 rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="e.g. QXJ928... or CHQ#..."
                        value={formData.reference_number || ''}
                        onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Financial Dimensions & Restriction Targeting</label>
                <DimensionSelector 
                  value={dimensions}
                  onChange={(dims) => setDimensions(dims)}
                />
                <p className="text-xs text-gray-400 italic mt-2">
                  * Selecting a Child or Fund will automatically mark these funds as "Restricted" in the ledger.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Special Instructions</label>
                <textarea 
                  className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500"
                  rows={3}
                  placeholder="Any specific donor requests or conditions..."
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                ></textarea>
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="anonymous"
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                  checked={formData.is_anonymous}
                  onChange={(e) => setFormData({...formData, is_anonymous: e.target.checked})}
                />
                <label htmlFor="anonymous" className="text-sm text-gray-600">Mark as anonymous donation (will hide name on public reports)</label>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="submit"
                  className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                >
                  Record and Post to Ledger
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-8 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
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

export default Donations;
