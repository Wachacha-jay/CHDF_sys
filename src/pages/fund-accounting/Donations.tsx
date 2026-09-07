import React, { useState, useEffect } from 'react';
import { Donor, FundAccount, Donation, DonorCluster, Child, Account } from '../../types';
import { FundAccountingService } from '../../services/fundAccountingService';
import { AccountingService } from '../../services/accountingService';
import { ApiService } from '../../services/api';
import { DimensionSelector } from '../../components/fund-accounting/DimensionSelector';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { printPaymentReceipt, ReceiptData } from '../../utils/receiptUtils';
import { 
  Plus, HandCoins, Calendar, History, Receipt, 
  Eye, Pencil, Trash2, Printer, CheckCircle, Clock, Send, AlertCircle, X, Building2 
} from 'lucide-react';
import toast from 'react-hot-toast';

const Donations: React.FC = () => {
  const { settings } = useSettingsContext();
  const [showModal, setShowModal] = useState(false);
  const [showDonorModal, setShowDonorModal] = useState(false);
  const [viewingDonation, setViewingDonation] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);
  const [editingDonationId, setEditingDonationId] = useState<string | null>(null);

  const [donors, setDonors] = useState<Donor[]>([]);
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [clusters, setClusters] = useState<DonorCluster[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<Partial<Donation>>({
    donation_date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'bank',
    payment_account_id: '',
    is_anonymous: false
  });

  const [donorFormData, setDonorFormData] = useState<Partial<Donor>>({
    name: '',
    email: '',
    phone: '',
    donor_type: 'individual',
    cluster_id: ''
  });

  const [dimensions, setDimensions] = useState<{
    fund_id?: string;
    child_id?: string;
    donor_id?: string;
  }>({});

  const loadData = async () => {
    setLoading(true);
    const [dList, fList, chList, donationList, cList, accList] = await Promise.all([
      FundAccountingService.getDonors(),
      FundAccountingService.getFundAccounts(),
      FundAccountingService.getChildren(),
      ApiService.get<any>('donations', { orderBy: { column: 'donation_date', ascending: false } }),
      FundAccountingService.getDonorClusters(),
      AccountingService.getAccounts()
    ]);
    setDonors(dList);
    setFunds(fList);
    setChildren(chList);
    setDonations(donationList.success ? (donationList.data || []) : []);
    setClusters(cList);
    setAccounts(accList ? AccountingService.flattenAccounts(accList) : []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openRecordModal = () => {
    setEditingDonationId(null);
    const bankAccounts = accounts.filter(a => a.account_type === 'asset');
    const defaultDonor = donors.length > 0 ? donors[0].id : '';
    setFormData({
      donation_date: new Date().toISOString().split('T')[0],
      amount: 0,
      payment_method: 'bank',
      payment_account_id: bankAccounts.length > 0 ? bankAccounts[0].id : '',
      is_anonymous: false
    });
    setDimensions({ donor_id: defaultDonor });
    setShowModal(true);
  };

  const openEditModal = (d: any) => {
    setEditingDonationId(d.id);
    setFormData({
      donation_date: d.donation_date ? new Date(d.donation_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      amount: Number(d.amount),
      payment_method: d.payment_method || 'bank',
      payment_account_id: d.payment_account_id || '',
      reference_number: d.reference_number || '',
      notes: d.notes || '',
      is_anonymous: !!d.is_anonymous
    });
    setDimensions({
      donor_id: d.donor_id,
      fund_id: d.fund_id,
      child_id: d.restricted_to_child_id
    });
    setShowModal(true);
  };

  const handleDonorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await FundAccountingService.createDonor(donorFormData);
    if (result) {
      toast.success('Donor added successfully');
      setShowDonorModal(false);
      setDonorFormData({ name: '', email: '', phone: '', donor_type: 'individual' });
      loadData();
    } else {
      toast.error('Failed to add donor');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) {
      toast.error('Please enter a valid donation amount');
      return;
    }

    const targetDonorId = dimensions.donor_id || (donors.length > 0 ? donors[0].id : null);
    if (!targetDonorId) {
      toast.error('Please select or add a donor first');
      return;
    }

    const payload = {
      ...formData,
      payment_account_id: formData.payment_account_id || undefined,
      donor_id: targetDonorId,
      fund_id: dimensions.fund_id || null,
      restricted_to_child_id: dimensions.child_id || null
    };

    let ok = false;
    if (editingDonationId) {
      ok = await FundAccountingService.updateDonation(editingDonationId, payload);
      if (ok) toast.success('Donation record updated successfully');
    } else {
      const result = await FundAccountingService.recordDonation(payload);
      ok = !!result;
      if (ok) toast.success('Donation recorded as Draft (Pending G/L Posting)');
    }

    if (ok) {
      setShowModal(false);
      setEditingDonationId(null);
      setFormData({
        donation_date: new Date().toISOString().split('T')[0],
        amount: 0,
        payment_method: 'bank',
        payment_account_id: '',
        is_anonymous: false
      });
      setDimensions({});
      loadData();
    } else {
      toast.error('Failed to save donation');
    }
  };

  const handlePostToGL = async (d: any) => {
    try {
      setLoading(true);
      const res = await FundAccountingService.postDonationToGL(d);
      if (res.success) {
        toast.success(`Donation of KES ${Number(d.amount).toLocaleString()} posted to General Ledger!`);
        if (viewingDonation?.id === d.id) {
          setViewingDonation({ ...viewingDonation, is_posted: true });
        }
        loadData();
      } else {
        toast.error(res.error || 'Failed to post donation to General Ledger. Please verify G/L setup.');
      }
    } catch (error: any) {
      toast.error('Error posting to G/L: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const ok = await FundAccountingService.deleteDonation(deleteConfirm.id);
    if (ok) {
      toast.success('Donation record deleted successfully');
      setDeleteConfirm(null);
      loadData();
    } else {
      toast.error('Failed to delete donation');
    }
  };

  const handlePrintReceipt = (d: any) => {
    const donor = donors.find(donor => donor.id === d.donor_id);
    const fund = funds.find(f => f.id === d.fund_id);
    const child = children.find(c => c.id === d.restricted_to_child_id);

    const donorDisplayName = d.is_anonymous 
      ? 'Anonymous Donor' 
      : (donor?.name || 'Valued Donor');

    const receiptData: ReceiptData = {
      saleNumber: d.reference_number || `DON-${(d.id || '').substring(0, 8).toUpperCase()}`,
      customerName: donorDisplayName,
      items: [{
        product: {
          id: d.id || 'don-item',
          code: 'DONATION',
          name: `Donation Contribution${fund ? ' - ' + fund.name : ''}${child ? ' (Child: ' + child.first_name + ' ' + child.last_name + ')' : ''}`,
          description: d.notes || `Donation received on ${new Date(d.donation_date).toLocaleDateString()}`,
          category_id: '',
          selling_price: Number(d.amount),
          buying_price: 0,
          cost_price: 0,
          current_stock: 0,
          min_stock: 0,
          unit_of_measure: 'unit',
          is_active: true,
          is_service: true,
          track_inventory: false,
          created_at: '',
          updated_at: ''
        },
        quantity: 1,
        unit_price: Number(d.amount),
        total_price: Number(d.amount)
      }],
      total: Number(d.amount),
      paymentMethod: d.payment_method || 'bank',
      date: new Date(d.donation_date).toLocaleDateString(),
      time: 'N/A',
      type: 'donation',
      donorName: donorDisplayName,
      fundName: fund?.name || (d.restricted_to_child_id ? 'Child Restricted' : 'Unrestricted Fund')
    };

    printPaymentReceipt(receiptData, {
      businessName: settings.company_name || 'CHDF Foundation',
      businessAddress: settings.company_address || 'Nairobi, Kenya',
      businessPhone: settings.company_phone || '',
      businessEmail: settings.company_email || ''
    });
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Donation Management</h1>
          <p className="text-gray-500">Record contributions, verify details, and post to General Ledger</p>
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
            onClick={openRecordModal}
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
              Contributions History ({donations.length})
            </h3>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[850px]">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Donor / Date</th>
                  <th className="px-6 py-4 font-semibold">Fund / Restriction</th>
                  <th className="px-6 py-4 font-semibold">Amount</th>
                  <th className="px-6 py-4 font-semibold">G/L Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Loading history...</td>
                  </tr>
                ) : donations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No donations recorded yet</td>
                  </tr>
                ) : donations.map((d) => {
                  const donorObj = donors.find(donor => donor.id === d.donor_id);
                  const fundObj = funds.find(f => f.id === d.fund_id);
                  const childObj = children.find(c => c.id === d.restricted_to_child_id);
                  const isPosted = !!d.is_posted;

                  return (
                    <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">
                          {d.is_anonymous ? 'Anonymous Donor' : (donorObj?.name || 'Unknown Donor')}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(d.donation_date).toLocaleDateString()} • {d.payment_method ? d.payment_method.toUpperCase() : 'BANK'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {fundObj && (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase">
                              {fundObj.name}
                            </span>
                          )}
                          {childObj && (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-bold uppercase">
                              Child: {childObj.first_name} {childObj.last_name}
                            </span>
                          )}
                          {!d.fund_id && !d.restricted_to_child_id && (
                            <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-[10px] font-bold uppercase">
                              Unrestricted
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-600">
                        KES {Number(d.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {isPosted ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                            <CheckCircle size={13} /> Posted
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                            <Clock size={13} /> Draft (Unposted)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          {!isPosted && (
                            <button
                              onClick={() => handlePostToGL(d)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-emerald-100 mr-1"
                              title="Review & Post to General Ledger"
                            >
                              <Send size={13} /> Post to G/L
                            </button>
                          )}
                          <button
                            onClick={() => setViewingDonation(d)}
                            className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handlePrintReceipt(d)}
                            className="p-1.5 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors"
                            title="Print Receipt"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={() => openEditModal(d)}
                            className="p-1.5 hover:bg-amber-50 text-gray-400 hover:text-amber-600 rounded-lg transition-colors"
                            title="Edit Donation"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(d)}
                            className="p-1.5 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition-colors"
                            title="Delete / Void"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                  <p className="text-lg font-bold text-emerald-700">
                    KES {donations.reduce((acc, d) => acc + Number(d.amount || 0), 0).toLocaleString()}
                  </p>
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
            <h3 className="font-bold mb-2">Controlled G/L Posting</h3>
            <p className="text-indigo-100 text-sm leading-relaxed">
              Donations are saved as <strong>Drafts</strong> first. Review the amount, donor, and restriction tags, then click <strong>"Post to G/L"</strong> to generate the double-entry journal posting.
            </p>
          </div>
        </div>
      </div>

      {/* ── VIEW DONATION DETAILS MODAL ───────────────────────────────────── */}
      {viewingDonation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
                  <HandCoins size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Donation Details</h2>
                  <p className="text-xs text-gray-500">Ref: {viewingDonation.reference_number || `DON-${viewingDonation.id.slice(0, 8).toUpperCase()}`}</p>
                </div>
              </div>
              <button onClick={() => setViewingDonation(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>
            
            <div className="p-6 space-y-4 text-sm">
              {/* G/L Status Banner */}
              <div className={`p-3 rounded-xl flex justify-between items-center ${
                viewingDonation.is_posted 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                <div className="flex items-center gap-2 font-medium">
                  {viewingDonation.is_posted ? <CheckCircle size={18} className="text-emerald-600" /> : <Clock size={18} className="text-amber-600" />}
                  <span>{viewingDonation.is_posted ? 'Posted to General Ledger' : 'Draft / Pending G/L Posting'}</span>
                </div>
                {!viewingDonation.is_posted && (
                  <button
                    onClick={() => handlePostToGL(viewingDonation)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                  >
                    Post Now
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold block">Donor</span>
                  <span className="font-bold text-gray-900">
                    {viewingDonation.is_anonymous ? 'Anonymous Donor' : (donors.find(d => d.id === viewingDonation.donor_id)?.name || 'N/A')}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold block">Amount</span>
                  <span className="font-bold text-emerald-600 text-base">
                    KES {Number(viewingDonation.amount).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold block">Date</span>
                  <span className="font-medium text-gray-700">
                    {new Date(viewingDonation.donation_date).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold block">Payment Method</span>
                  <span className="font-medium text-gray-700 capitalize">
                    {viewingDonation.payment_method || 'Bank'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs text-gray-400 uppercase font-semibold block">Allocation / Restrictions</span>
                <div className="p-3 border border-gray-200 rounded-xl space-y-1">
                  {viewingDonation.fund_id && (
                    <p className="text-gray-700"><strong className="text-gray-900">Fund Account:</strong> {funds.find(f => f.id === viewingDonation.fund_id)?.name}</p>
                  )}
                  {viewingDonation.restricted_to_child_id && (
                    <p className="text-gray-700"><strong className="text-gray-900">Restricted Child:</strong> {children.find(c => c.id === viewingDonation.restricted_to_child_id)?.first_name} {children.find(c => c.id === viewingDonation.restricted_to_child_id)?.last_name}</p>
                  )}
                  {!viewingDonation.fund_id && !viewingDonation.restricted_to_child_id && (
                    <p className="text-gray-500 italic">Unrestricted general donation</p>
                  )}
                </div>
              </div>

              {viewingDonation.notes && (
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold block mb-1">Notes</span>
                  <p className="p-3 bg-gray-50 rounded-xl text-gray-600">{viewingDonation.notes}</p>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => handlePrintReceipt(viewingDonation)}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100"
                >
                  <Printer size={18} /> Print Official Receipt
                </button>
                <button
                  onClick={() => {
                    const target = viewingDonation;
                    setViewingDonation(null);
                    openEditModal(target);
                  }}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ───────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Void / Delete Donation?</h3>
            <p className="text-gray-500 text-sm mb-6">
              Are you sure you want to remove this KES {Number(deleteConfirm.amount).toLocaleString()} contribution? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteConfirm(null)} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium">Cancel</button>
              <button onClick={handleDelete} className="px-5 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD DONOR MODAL ─────────────────────────────────────────────── */}
      {showDonorModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
              <h2 className="text-xl font-bold text-gray-900">Add New Donor</h2>
              <button onClick={() => setShowDonorModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleDonorSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name / Organization <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required 
                  className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 border" 
                  value={donorFormData.name}
                  onChange={(e) => setDonorFormData({...donorFormData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input 
                  type="email" 
                  className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 border" 
                  value={donorFormData.email}
                  onChange={(e) => setDonorFormData({...donorFormData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                <input 
                  type="text" 
                  className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 border" 
                  value={donorFormData.phone}
                  onChange={(e) => setDonorFormData({...donorFormData, phone: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Donor Type</label>
                <select 
                  className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 border"
                  value={donorFormData.donor_type}
                  onChange={(e) => setDonorFormData({...donorFormData, donor_type: e.target.value as any})}
                >
                  <option value="individual">Individual</option>
                  <option value="corporate">Corporate</option>
                  <option value="foundation">Foundation</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Donor Cluster</label>
                <select 
                  className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 border"
                  value={donorFormData.cluster_id || ''}
                  onChange={(e) => setDonorFormData({...donorFormData, cluster_id: e.target.value || undefined})}
                >
                  <option value="">-- No Cluster --</option>
                  {clusters.map(cluster => (
                    <option key={cluster.id} value={cluster.id}>{cluster.name}</option>
                  ))}
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

      {/* ── RECORD / EDIT DONATION MODAL ───────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-emerald-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <HandCoins size={24} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingDonationId ? 'Edit Contribution Record' : 'Record Contribution'}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-2xl">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Donation Amount (KES) <span className="text-red-500">*</span></label>
                    <input 
                      type="number" 
                      className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 py-3 px-4 text-xl font-bold border"
                      placeholder="0.00"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="date" 
                        className="w-full pl-10 rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 py-2 border"
                        value={formData.donation_date || ''}
                        onChange={(e) => setFormData({...formData, donation_date: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Bank / Asset Account <span className="text-red-500">*</span></label>
                    <select 
                      className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 py-2 border font-medium text-gray-900"
                      value={formData.payment_account_id || ''}
                      onChange={(e) => setFormData({...formData, payment_account_id: e.target.value})}
                      required
                    >
                      <option value="">-- Select Bank / Asset Account --</option>
                      {accounts.filter(a => a.account_type === 'asset').map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          [{acc.code}] {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select 
                      className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 py-2 border"
                      value={formData.payment_method || 'bank'}
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
                        className="w-full pl-10 rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 py-2 border"
                        placeholder="e.g. QXJ928... or CHQ#..."
                        value={formData.reference_number || ''}
                        onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Financial Dimensions &amp; Restriction Targeting <span className="text-red-500">*</span></label>
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
                  className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 p-3 border"
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
                  checked={formData.is_anonymous || false}
                  onChange={(e) => setFormData({...formData, is_anonymous: e.target.checked})}
                />
                <label htmlFor="anonymous" className="text-sm text-gray-600">Mark as anonymous donation (will hide name on public reports)</label>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="submit"
                  className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                >
                  {editingDonationId ? 'Update Contribution Record' : 'Save Contribution (Draft)'}
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
