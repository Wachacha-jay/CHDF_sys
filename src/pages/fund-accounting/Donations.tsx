import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Donor, FundAccount, Donation, DonationItem, DonorCluster, Child, Account, Department, Product } from '../../types';
import { FundAccountingService } from '../../services/fundAccountingService';
import { AccountingService } from '../../services/accountingService';
import { ProductService } from '../../services/productService';
import { ApiService } from '../../services/api';
import { DimensionSelector } from '../../components/fund-accounting/DimensionSelector';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { printPaymentReceipt, ReceiptData } from '../../utils/receiptUtils';
import { 
  Plus, HandCoins, Calendar, History, Receipt, 
  Eye, Pencil, Trash2, Printer, CheckCircle, Clock, Send, AlertCircle, X, Building2, Shield,
  Package, Wrench, HardHat, Layers, DollarSign
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [donationMode, setDonationMode] = useState<'monetary' | 'in_kind'>('monetary');
  const [inKindItems, setInKindItems] = useState<DonationItem[]>([
    { item_description: '', asset_class: 'consumable', fair_market_value: 0, quantity: 1, unit_of_measure: 'units', product_id: '', department_id: '', project_name: '', notes: '' }
  ]);
  const [viewingDonationItems, setViewingDonationItems] = useState<DonationItem[]>([]);

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
    const [dList, fList, chList, donationList, cList, accList, deptsList, prodsList] = await Promise.all([
      FundAccountingService.getDonors(),
      FundAccountingService.getFundAccounts(),
      FundAccountingService.getChildren(),
      ApiService.get<any>('donations', { orderBy: { column: 'donation_date', ascending: false } }),
      FundAccountingService.getDonorClusters(),
      AccountingService.getAccounts(),
      FundAccountingService.getDepartments(),
      ProductService.getProducts({ is_active: true })
    ]);
    setDonors(dList);
    setFunds(fList);
    setChildren(chList);
    setDonations(donationList.success ? (donationList.data || []) : []);
    setClusters(cList);
    setAccounts(accList ? AccountingService.flattenAccounts(accList) : []);
    setDepartments(deptsList || []);
    setProducts(prodsList || []);
    setLoading(false);
  };

  const location = useLocation();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (location.state?.openInKind) {
      setEditingDonationId(null);
      setDonationMode('in_kind');
      setInKindItems([
        { item_description: '', asset_class: 'consumable', fair_market_value: 0, quantity: 1, unit_of_measure: 'units', product_id: '', department_id: '', project_name: '', notes: '' }
      ]);
      setFormData({
        donation_date: new Date().toISOString().split('T')[0],
        amount: 0,
        payment_method: 'in_kind',
        is_anonymous: false
      });
      setShowModal(true);
    }
  }, [location.state]);

  const openRecordModal = () => {
    setEditingDonationId(null);
    setDonationMode('monetary');
    setInKindItems([
      { item_description: '', asset_class: 'consumable', fair_market_value: 0, quantity: 1, unit_of_measure: 'units', product_id: '', department_id: '', project_name: '', notes: '' }
    ]);
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
    const isIK = !!d.is_in_kind || d.payment_method === 'in_kind';
    setDonationMode(isIK ? 'in_kind' : 'monetary');
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
    if (isIK) {
      FundAccountingService.getDonationItems(d.id).then(items => {
        if (items && items.length > 0) {
          setInKindItems(items);
        } else {
          setInKindItems([
            { item_description: '', asset_class: 'consumable', fair_market_value: Number(d.amount || 0), quantity: 1, unit_of_measure: 'units' }
          ]);
        }
      });
    }
    setShowModal(true);
  };

  const handleViewDonation = async (d: any) => {
    setViewingDonation(d);
    if (d.is_in_kind || d.payment_method === 'in_kind') {
      const items = await FundAccountingService.getDonationItems(d.id);
      setViewingDonationItems(items || []);
    } else {
      setViewingDonationItems([]);
    }
  };

  const addInKindRow = () => {
    setInKindItems(prev => [
      ...prev,
      { item_description: '', asset_class: 'consumable', fair_market_value: 0, quantity: 1, unit_of_measure: 'units', product_id: '', department_id: '', project_name: '', notes: '' }
    ]);
  };

  const updateInKindRow = (index: number, field: keyof DonationItem, value: any) => {
    setInKindItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeInKindRow = (index: number) => {
    if (inKindItems.length === 1) {
      toast.error('At least one item is required for an in-kind donation');
      return;
    }
    setInKindItems(prev => prev.filter((_, i) => i !== index));
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

    let totalAmount = Number(formData.amount || 0);

    if (donationMode === 'in_kind') {
      if (inKindItems.length === 0) {
        toast.error('Please add at least one in-kind item');
        return;
      }
      for (let i = 0; i < inKindItems.length; i++) {
        const item = inKindItems[i];
        if (!item.item_description.trim()) {
          toast.error(`Please provide a description for line item #${i + 1}`);
          return;
        }
        if (!item.fair_market_value || Number(item.fair_market_value) <= 0) {
          toast.error(`Please enter a valid Fair Market Value for "${item.item_description || `Item #${i + 1}`}"`);
          return;
        }
      }
      totalAmount = inKindItems.reduce((sum, it) => sum + (Number(it.fair_market_value) || 0), 0);
    } else {
      if (!formData.amount || formData.amount <= 0) {
        toast.error('Please enter a valid donation amount');
        return;
      }
    }

    const targetDonorId = dimensions.donor_id || (donors.length > 0 ? donors[0].id : null);
    if (!targetDonorId) {
      toast.error('Please select or add a donor first');
      return;
    }

    const payload: any = {
      ...formData,
      amount: totalAmount,
      total_fair_market_value: totalAmount,
      is_in_kind: donationMode === 'in_kind' ? 1 : 0,
      payment_method: donationMode === 'in_kind' ? 'in_kind' : (formData.payment_method || 'bank'),
      payment_account_id: donationMode === 'in_kind' ? undefined : (formData.payment_account_id || undefined),
      donor_id: targetDonorId,
      fund_id: dimensions.fund_id || null,
      restricted_to_child_id: dimensions.child_id || null,
      items: donationMode === 'in_kind' ? inKindItems : undefined
    };

    let ok = false;
    if (editingDonationId) {
      ok = await FundAccountingService.updateDonation(editingDonationId, payload);
      if (ok) toast.success('Donation record updated successfully');
    } else {
      const result = await FundAccountingService.recordDonation(payload);
      ok = !!result;
      if (ok) toast.success(donationMode === 'in_kind' ? 'In-Kind Donation recorded (Draft)' : 'Donation recorded as Draft');
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
          <p className="text-gray-500">Record contributions, verify details, and post double-entry entries to General Ledger</p>
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

      {/* Top Stats & Protocol Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stat 1: Total Receipts */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Receipts</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              KES {donations.reduce((acc, d) => acc + Number(d.amount || 0), 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">{donations.length} contribution records</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
            <HandCoins size={24} />
          </div>
        </div>

        {/* Stat 2: Pending G/L Posting */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending G/L Drafts</p>
            <p className="text-2xl font-black text-amber-600 mt-1">
              {donations.filter(d => !d.is_posted).length} Drafts
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {donations.filter(d => d.is_posted).length} Posted to Ledger
            </p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-bold">
            <Clock size={24} />
          </div>
        </div>

        {/* Protocol Banner */}
        <div className="bg-indigo-600 p-5 rounded-2xl shadow-md text-white flex flex-col justify-center">
          <h4 className="font-bold text-sm flex items-center gap-1.5 mb-1">
            <Shield size={16} /> Controlled G/L Workflow
          </h4>
          <p className="text-indigo-100 text-xs leading-relaxed">
            Donations are saved as <strong>Drafts</strong> first. Verify donor & restriction tags, then click <strong>"Post to G/L"</strong> to balance debits & credits.
          </p>
        </div>
      </div>

      {/* Full-Width Contributions History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden w-full">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <History size={18} className="text-indigo-600" />
            Contributions History ({donations.length})
          </h3>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left min-w-[950px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Ref # / Date</th>
                <th className="px-6 py-4 font-semibold">Donor Name</th>
                <th className="px-6 py-4 font-semibold">Deposit Bank Account</th>
                <th className="px-6 py-4 font-semibold">Fund / Restriction</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">G/L Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr className="animate-pulse">
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">Loading history...</td>
                </tr>
              ) : donations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">No donations recorded yet</td>
                </tr>
              ) : donations.map((d) => {
                const donorObj = donors.find(donor => donor.id === d.donor_id);
                const fundObj = funds.find(f => f.id === d.fund_id);
                const childObj = children.find(c => c.id === d.restricted_to_child_id);
                const bankObj = accounts.find(a => a.id === d.payment_account_id);
                const isPosted = !!d.is_posted;

                return (
                  <tr key={d.id || Math.random()} className="hover:bg-gray-50/50 transition-colors text-sm">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs font-bold text-gray-700">
                        {d.reference_number || (d.id ? `DON-${d.id.substring(0, 8).toUpperCase()}` : 'DON-NEW')}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {d.donation_date ? new Date(d.donation_date).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">
                        {d.is_anonymous ? 'Anonymous Donor' : (donorObj?.name || 'Unknown Donor')}
                      </div>
                      <div className="text-xs text-gray-400 capitalize flex items-center gap-1.5 mt-0.5">
                        {d.is_in_kind || d.payment_method === 'in_kind' ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px] inline-flex items-center gap-1">
                            <Package size={10} /> IN-KIND
                          </span>
                        ) : (
                          <span>{d.payment_method ? d.payment_method.toUpperCase() : 'BANK'}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {d.is_in_kind || d.payment_method === 'in_kind' ? (
                        <div className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-flex items-center gap-1">
                          <Layers size={12} /> Multi-Class Asset Routing
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-gray-800">
                          {bankObj ? `${bankObj.code} - ${bankObj.name}` : (d.payment_account_id ? `Account #${String(d.payment_account_id).substring(0, 6)}` : 'Default Cash/Bank Account')}
                        </div>
                      )}
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
                          onClick={() => handleViewDonation(d)}
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
                  <p className="text-xs text-gray-500">Ref: {viewingDonation.reference_number || (viewingDonation.id ? `DON-${viewingDonation.id.slice(0, 8).toUpperCase()}` : 'DON-NEW')}</p>
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

              {/* In-Kind Itemized Schedule */}
              {(viewingDonation.is_in_kind || viewingDonation.payment_method === 'in_kind') && viewingDonationItems.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-gray-400 uppercase font-semibold block">In-Kind Items &amp; Asset Routing</span>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                        <tr>
                          <th className="px-3 py-2">Item Description</th>
                          <th className="px-3 py-2">Asset Class</th>
                          <th className="px-3 py-2">Destination</th>
                          <th className="px-3 py-2 text-right">Fair Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {viewingDonationItems.map((it, idx) => {
                          const productObj = products.find(p => p.id === it.product_id);
                          const deptObj = departments.find(d => d.id === it.department_id);
                          return (
                            <tr key={it.id || idx} className="hover:bg-gray-50/50">
                              <td className="px-3 py-2.5 font-semibold text-gray-900">
                                {it.item_description}
                              </td>
                              <td className="px-3 py-2.5">
                                {it.asset_class === 'consumable' && (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                                    Consumable
                                  </span>
                                )}
                                {it.asset_class === 'fixed_asset' && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">
                                    Fixed Asset
                                  </span>
                                )}
                                {it.asset_class === 'construction' && (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-bold text-[10px]">
                                    Infrastructure
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-gray-600">
                                {it.asset_class === 'consumable' && (
                                  <span>{productObj ? productObj.name : 'Inventory'} ({it.quantity} {it.unit_of_measure || 'units'})</span>
                                )}
                                {it.asset_class === 'fixed_asset' && (
                                  <span>Dept: <strong>{deptObj ? deptObj.name : 'Department'}</strong></span>
                                )}
                                {it.asset_class === 'construction' && (
                                  <span>Project: <strong>{it.project_name || 'Infrastructure'}</strong></span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold text-emerald-600">
                                KES {Number(it.fair_market_value).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
              {/* Contribution Mode Switcher */}
              <div className="flex rounded-xl bg-gray-100 p-1.5">
                <button
                  type="button"
                  onClick={() => setDonationMode('monetary')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                    donationMode === 'monetary'
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <DollarSign size={16} /> Monetary Contribution (Cash / Bank / M-Pesa)
                </button>
                <button
                  type="button"
                  onClick={() => setDonationMode('in_kind')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                    donationMode === 'in_kind'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Package size={16} /> In-Kind Donation (Consumables, Assets, Construction)
                </button>
              </div>

              {/* MODE 1: MONETARY CONTRIBUTION FORM */}
              {donationMode === 'monetary' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Donation Amount (KES) <span className="text-red-500">*</span></label>
                      <input 
                        type="number" 
                        className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 py-3 px-4 text-xl font-bold border"
                        placeholder="0.00"
                        value={formData.amount || ''}
                        onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                        required={donationMode === 'monetary'}
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
                        required={donationMode === 'monetary'}
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
              )}

              {/* MODE 2: IN-KIND MULTI-LINE FORM */}
              {donationMode === 'in_kind' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Receipt / Delivery Date <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          type="date" 
                          className="w-full pl-10 rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2 border"
                          value={formData.donation_date || ''}
                          onChange={(e) => setFormData({...formData, donation_date: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Waybill / Delivery Slip / Ref #</label>
                      <div className="relative">
                        <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          type="text" 
                          className="w-full pl-10 rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 py-2 border"
                          placeholder="e.g. WB-9021 or DON-IK-01"
                          value={formData.reference_number || ''}
                          onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multi-Line Items Table */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">Itemized In-Kind Donation Items</h4>
                        <p className="text-xs text-gray-500">Add each item and select its asset class for financial routing.</p>
                      </div>
                      <button
                        type="button"
                        onClick={addInKindRow}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors"
                      >
                        <Plus size={14} /> Add Line Item
                      </button>
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[700px]">
                          <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider">
                            <tr>
                              <th className="px-3 py-2.5 w-1/4">Item Description *</th>
                              <th className="px-3 py-2.5 w-1/4">Asset Class *</th>
                              <th className="px-3 py-2.5 w-1/3">Target Destination *</th>
                              <th className="px-3 py-2.5 w-1/6 text-right">Fair Value (KES) *</th>
                              <th className="px-2 py-2.5 w-10 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {inKindItems.map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                <td className="p-2.5">
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. 50kg Bags of Maize"
                                    value={item.item_description}
                                    onChange={(e) => updateInKindRow(idx, 'item_description', e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="p-2.5">
                                  <select
                                    value={item.asset_class}
                                    onChange={(e) => updateInKindRow(idx, 'asset_class', e.target.value as any)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-indigo-500 bg-white"
                                  >
                                    <option value="consumable">Consumable (Inventory)</option>
                                    <option value="fixed_asset">Fixed Asset (Equipment/Furniture)</option>
                                    <option value="construction">Construction / Infrastructure</option>
                                  </select>
                                </td>
                                <td className="p-2.5">
                                  {item.asset_class === 'consumable' && (
                                    <div className="space-y-1">
                                      <select
                                        value={item.product_id || ''}
                                        onChange={(e) => updateInKindRow(idx, 'product_id', e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                                      >
                                        <option value="">-- Link to Inventory Product --</option>
                                        {products.filter(p => p.is_in_kind).map(p => (
                                          <option key={p.id} value={p.id}>
                                            [In-Kind] {p.name} (Stock: {p.current_stock} {p.unit_of_measure})
                                          </option>
                                        ))}
                                        {products.filter(p => !p.is_in_kind).map(p => (
                                          <option key={p.id} value={p.id}>
                                            {p.name}
                                          </option>
                                        ))}
                                      </select>
                                      <div className="flex gap-2">
                                        <input
                                          type="number"
                                          min="1"
                                          placeholder="Qty"
                                          value={item.quantity || 1}
                                          onChange={(e) => updateInKindRow(idx, 'quantity', Number(e.target.value))}
                                          className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                                        />
                                        <input
                                          type="text"
                                          placeholder="Unit (e.g. bags)"
                                          value={item.unit_of_measure || 'units'}
                                          onChange={(e) => updateInKindRow(idx, 'unit_of_measure', e.target.value)}
                                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {item.asset_class === 'fixed_asset' && (
                                    <div className="space-y-1">
                                      <select
                                        value={item.department_id || ''}
                                        onChange={(e) => updateInKindRow(idx, 'department_id', e.target.value)}
                                        required
                                        className="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                                      >
                                        <option value="">-- Target Owning Department * --</option>
                                        {departments.map(d => (
                                          <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                      </select>
                                      <input
                                        type="text"
                                        placeholder="Serial # / Model (Optional)"
                                        value={item.notes || ''}
                                        onChange={(e) => updateInKindRow(idx, 'notes', e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                      />
                                    </div>
                                  )}

                                  {item.asset_class === 'construction' && (
                                    <div>
                                      <input
                                        type="text"
                                        required
                                        placeholder="Target Building / Project Name *"
                                        value={item.project_name || ''}
                                        onChange={(e) => updateInKindRow(idx, 'project_name', e.target.value)}
                                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                                      />
                                      <p className="text-[10px] text-gray-400 mt-0.5">Capitalized into Buildings &amp; Infrastructure</p>
                                    </div>
                                  )}
                                </td>
                                <td className="p-2.5 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    placeholder="0.00"
                                    value={item.fair_market_value || ''}
                                    onChange={(e) => updateInKindRow(idx, 'fair_market_value', Number(e.target.value))}
                                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-right text-emerald-600 focus:ring-1 focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeInKindRow(idx)}
                                    className="text-gray-400 hover:text-rose-600 p-1 rounded transition-colors"
                                    title="Delete line"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Valuation Total Banner */}
                    <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-indigo-900 block">Total In-Kind Fair Market Valuation</span>
                        <span className="text-[11px] text-indigo-600">
                          Automated G/L Entry: DR In-Kind Inventory / Fixed Assets | CR 4260 In-Kind Donations
                        </span>
                      </div>
                      <div className="text-xl font-black text-indigo-700">
                        KES {inKindItems.reduce((sum, it) => sum + (Number(it.fair_market_value) || 0), 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
