import React, { useEffect, useState } from 'react';
import { Child, Guardian, JournalEntry, FundAccount, Department, Account } from '../../types';
import { FundAccountingService } from '../../services/fundAccountingService';
import { AccountingService } from '../../services/accountingService';
import { BusinessSettingsService } from '../../services/businessSettingsService';
import { printPaymentReceipt } from '../../utils/receiptUtils';
import { 
  UserPlus, Search, Filter, MoreHorizontal, GraduationCap, HeartHandshake, Plus,
  Calendar, ArrowUpRight, ArrowDownLeft, Receipt, DollarSign, Activity, AlertCircle,
  Printer, Trash2, Eye, Edit2, X, School
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const ChildManagement: React.FC = () => {
  // Tab Management
  const [activeTab, setActiveTab] = useState<'children' | 'payments'>('children');

  // Business Settings State
  const [businessSettings, setBusinessSettings] = useState<any>(null);

  // Children Directory States
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [viewingChild, setViewingChild] = useState<Child | null>(null);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [formData, setFormData] = useState<any>({
    first_name: '',
    last_name: '',
    code: '',
    date_of_birth: '',
    gender: 'Male',
    class_name: '',
    disability_type: 'None',
    status: 'active',
    enrollment_date: new Date().toISOString().split('T')[0],
    guardian_id: '',
    new_guardian_name: '',
    new_guardian_phone: '',
    new_guardian_relationship: 'Parent'
  });

  // Accounting & Fee Payment States
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [payments, setPayments] = useState<JournalEntry[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentSearchTerm, setPaymentSearchTerm] = useState('');
  
  // Fee Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    child_id: '',
    amount: '',
    payment_type: 'revenue', // 'revenue' (Guardian Pays NGO) or 'expense' (NGO Pays School)
    payment_method: 'mpesa', // 'mpesa' or 'cash'
    fund_id: '',
    department_id: '',
    notes: '',
    entry_date: new Date().toISOString().split('T')[0]
  });

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [childrenData, guardiansData, accList, fundList, deptList, settingsData] = await Promise.all([
        FundAccountingService.getChildren(),
        FundAccountingService.getGuardians(),
        AccountingService.getAccounts(),
        FundAccountingService.getFundAccounts(),
        FundAccountingService.getDepartments(),
        BusinessSettingsService.getSettings()
      ]);
      setChildren(childrenData);
      setGuardians(guardiansData);
      setAccounts(accList);
      setFunds(fundList);
      setDepartments(deptList);
      setBusinessSettings(settingsData);
    } catch (error) {
      console.error('Error loading child management data:', error);
      toast.error('Failed to load child management data');
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    setLoadingPayments(true);
    try {
      const entries = await AccountingService.getJournalEntries();
      // Filter for school fees journal entries:
      const feeEntries = entries.filter(entry => {
        const descMatches = entry.description?.toLowerCase().includes('school fee');
        const lineMatches = entry.lines?.some(l => 
          l.child_id && (l.account?.code === '4300' || l.account?.code === '5310' || l.account?.code === '5350')
        );
        return descMatches || lineMatches;
      });
      setPayments(feeEntries);
    } catch (error) {
      console.error('Error loading school fee payments:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const handlePrintReceipt = (payment: JournalEntry) => {
    const lineWithChild = payment.lines?.find(l => l.child_id);
    const childId = lineWithChild?.child_id;
    const child = children.find(c => c.id === childId);
    const isRevenue = payment.description?.toLowerCase().includes('inflow') || 
                      payment.lines?.some(l => l.account?.code === '4300' && l.credit_amount > 0);
    const fund = funds.find(f => f.id === lineWithChild?.fund_id);

    const childName = child ? `${child.first_name} ${child.last_name}` : 'N/A';
    const guardianName = child?.guardian?.name || 'N/A';

    const cartItems = [{
      id: 'fee-pay',
      name: `School Fee Payment (${isRevenue ? 'Guardian Inflow' : 'NGO Outflow'})`,
      quantity: 1,
      unitPrice: payment.total_debit,
      subtotal: payment.total_debit,
      product: { cost_price: 0, selling_price: payment.total_debit } as any
    }];

    const receipt = {
      saleNumber: payment.entry_number,
      customerName: guardianName,
      items: cartItems,
      total: payment.total_debit,
      paymentMethod: isRevenue ? 'M-Pesa / Cash' : 'Fund Restricted',
      date: new Date(payment.entry_date).toLocaleDateString(),
      time: 'N/A',
      type: 'school_fee' as any,
      childName,
      donorName: guardianName,
      fundName: fund?.name || 'Education Fund'
    };

    const details = {
      businessName: businessSettings?.business_name || 'BIZMANAGER',
      businessAddress: businessSettings?.address || 'Nairobi, Kenya',
      businessPhone: businessSettings?.phone || '',
      businessEmail: businessSettings?.email || '',
      logoUrl: businessSettings?.logo || '',
      currency: businessSettings?.default_currency || 'KES'
    };

    printPaymentReceipt(receipt, details, false);
  };

  const handleDeletePayment = async (id: string) => {
    if (!window.confirm('Are you sure you want to void and delete this payment record? This will remove the transaction from the General Ledger.')) return;
    const success = await AccountingService.deleteJournalEntry(id);
    if (success) {
      toast.success('School Fee Payment voided successfully.');
      loadPayments();
    } else {
      toast.error('Failed to void school fee payment.');
    }
  };

  useEffect(() => {
    loadAllData();
    loadPayments();
  }, []);

  const openCreateModal = async () => {
    setEditingChild(null);
    const code = await FundAccountingService.getNextChildCode();
    setFormData({
      first_name: '',
      last_name: '',
      code,
      date_of_birth: '',
      gender: 'Male',
      class_name: '',
      disability_type: 'None',
      status: 'active',
      enrollment_date: new Date().toISOString().split('T')[0],
      guardian_id: '',
      new_guardian_name: '',
      new_guardian_phone: '',
      new_guardian_relationship: 'Parent'
    });
    setShowModal(true);
  };

  const openEditModal = (child: Child) => {
    setEditingChild(child);
    setFormData({
      first_name: child.first_name || '',
      last_name: child.last_name || '',
      code: child.code || '',
      date_of_birth: child.date_of_birth || '',
      gender: child.gender || 'Male',
      class_name: child.class_name || '',
      disability_type: child.disability_type || 'None',
      status: child.status || 'active',
      enrollment_date: child.enrollment_date || new Date().toISOString().split('T')[0],
      guardian_id: child.guardian_id || '',
      new_guardian_name: '',
      new_guardian_phone: '',
      new_guardian_relationship: 'Parent'
    });
    setShowModal(true);
  };

  const openViewModal = (child: Child) => {
    setViewingChild(child);
  };

  const handleDeleteChild = async (child: Child) => {
    if (!window.confirm(`Are you sure you want to delete child record "${child.first_name} ${child.last_name}" (${child.code})? This action cannot be undone.`)) {
      return;
    }
    try {
      const success = await FundAccountingService.deleteChild(child.id);
      if (success) {
        toast.success('Child profile deleted successfully');
        loadAllData();
      } else {
        toast.error('Failed to delete child profile');
      }
    } catch (error) {
      toast.error('Failed to delete child profile');
    }
  };

  // Set default fund & department in fee payment modal
  useEffect(() => {
    if (funds.length > 0 && !paymentFormData.fund_id) {
      const eduFund = funds.find(f => f.code === 'FUND-EDU' || f.name.toLowerCase().includes('education'));
      if (eduFund) {
        setPaymentFormData(prev => ({ ...prev, fund_id: eduFund.id }));
      } else {
        setPaymentFormData(prev => ({ ...prev, fund_id: funds[0].id }));
      }
    }
    if (departments.length > 0 && !paymentFormData.department_id) {
      const eduDept = departments.find(d => d.name.toLowerCase().includes('education'));
      if (eduDept) {
        setPaymentFormData(prev => ({ ...prev, department_id: eduDept.id }));
      } else {
        setPaymentFormData(prev => ({ ...prev, department_id: departments[0].id }));
      }
    }
  }, [funds, departments, showPaymentModal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let guardianId = formData.guardian_id;

    // Create new guardian if info is provided
    if (!guardianId && formData.new_guardian_name) {
      const guardian = await FundAccountingService.createGuardian({
        name: formData.new_guardian_name,
        phone: formData.new_guardian_phone,
        relationship: formData.new_guardian_relationship
      });
      if (guardian) {
        guardianId = guardian.id;
      }
    }

    const payload: Partial<Child> = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      code: formData.code,
      date_of_birth: formData.date_of_birth,
      gender: formData.gender,
      class_name: formData.class_name,
      disability_type: formData.disability_type,
      status: formData.status,
      enrollment_date: formData.enrollment_date,
      guardian_id: guardianId
    };

    let result;
    if (editingChild) {
      result = await FundAccountingService.updateChild(editingChild.id, payload);
      if (result) {
        toast.success('Child profile updated successfully');
      }
    } else {
      result = await FundAccountingService.createChild(payload);
      if (result) {
        toast.success('Child registered successfully');
      }
    }

    if (result) {
      setShowModal(false);
      setEditingChild(null);
      setFormData({
        first_name: '',
        last_name: '',
        code: '',
        date_of_birth: '',
        gender: 'Male',
        class_name: '',
        disability_type: 'None',
        status: 'active',
        enrollment_date: new Date().toISOString().split('T')[0],
        guardian_id: '',
        new_guardian_name: '',
        new_guardian_phone: '',
        new_guardian_relationship: 'Parent'
      });
      loadAllData();
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentFormData.child_id || !paymentFormData.amount) {
      toast.error('Please select a child and enter an amount');
      return;
    }

    const selectedChildObj = children.find(c => c.id === paymentFormData.child_id);
    if (!selectedChildObj) {
      toast.error('Selected child not found');
      return;
    }

    const guardianName = selectedChildObj.guardian?.name || 'N/A';
    const childFullName = `${selectedChildObj.first_name} ${selectedChildObj.last_name}`;

    try {
      setPaymentSubmitting(true);

      const findAccount = (code: string) => {
        const flatten = (accs: any[]): any[] => {
          return accs.reduce((prev, curr) => {
            return prev.concat(curr).concat(curr.children ? flatten(curr.children) : []);
          }, []);
        };
        return flatten(accounts).find(a => a.code === code);
      };

      const cashAccount = findAccount('1110');
      const mpesaAccount = findAccount('1111');
      const restrictedCashAccount = findAccount('1150');
      const revenueAccount = findAccount('4300'); // School Fees Revenue
      const expenseAccount = findAccount('5310'); // Education Program Expenses

      if (!cashAccount || !mpesaAccount || !revenueAccount || !expenseAccount) {
        toast.error('Required G/L accounts (1110, 1111, 4300, 5310) are missing in the Chart of Accounts. Please verify setups.');
        setPaymentSubmitting(false);
        return;
      }

      const amt = Number(paymentFormData.amount);
      const lines: any[] = [];

      if (paymentFormData.payment_type === 'revenue') {
        // Guardian pays NGO
        // Debit: Cash/Mpesa
        const debitAcc = paymentFormData.payment_method === 'mpesa' ? mpesaAccount : cashAccount;
        lines.push({
          account_id: debitAcc.id,
          description: `School Fee payment received from guardian ${guardianName} for child ${childFullName}`,
          debit_amount: amt,
          credit_amount: 0,
          child_id: paymentFormData.child_id,
          fund_id: paymentFormData.fund_id || undefined,
          department_id: paymentFormData.department_id || undefined
        });
        // Credit: School Fees Revenue
        lines.push({
          account_id: revenueAccount.id,
          description: `School Fee revenue recognized for child ${childFullName}`,
          debit_amount: 0,
          credit_amount: amt,
          child_id: paymentFormData.child_id,
          fund_id: paymentFormData.fund_id || undefined,
          department_id: paymentFormData.department_id || undefined
        });
      } else {
        // NGO pays School (Expense)
        // Debit: Education Program Expenses
        lines.push({
          account_id: expenseAccount.id,
          description: `School Fee disbursement for child ${childFullName} (Guardian: ${guardianName})`,
          debit_amount: amt,
          credit_amount: 0,
          child_id: paymentFormData.child_id,
          fund_id: paymentFormData.fund_id || undefined,
          department_id: paymentFormData.department_id || undefined
        });
        // Credit: Bank/Mpesa, Cash, or Restricted Fund Cash
        let creditAcc = cashAccount;
        if (paymentFormData.fund_id) {
          creditAcc = restrictedCashAccount || mpesaAccount;
        } else {
          creditAcc = paymentFormData.payment_method === 'mpesa' ? mpesaAccount : cashAccount;
        }
        
        lines.push({
          account_id: creditAcc.id,
          description: `School Fee payment disbursement from ${creditAcc.name}`,
          debit_amount: 0,
          credit_amount: amt,
          child_id: paymentFormData.child_id,
          fund_id: paymentFormData.fund_id || undefined,
          department_id: paymentFormData.department_id || undefined
        });
      }

      const description = `School Fee Payment (${paymentFormData.payment_type === 'revenue' ? 'Inflow' : 'Outflow'}): ${childFullName}`;

      const entry = await AccountingService.createJournalEntry({
        entry_date: paymentFormData.entry_date,
        description: description + (paymentFormData.notes ? ` - ${paymentFormData.notes}` : ''),
        is_posted: true,
        lines: lines
      });

      if (entry) {
        toast.success('School fee payment posted to general ledger successfully');
        setShowPaymentModal(false);
        setPaymentFormData(prev => ({
          ...prev,
          child_id: '',
          amount: '',
          notes: ''
        }));
        loadPayments();
      } else {
        toast.error('Failed to post school fee payment journal entry');
      }
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error.message || 'Failed to record school fee payment');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const filteredChildren = children.filter(c => 
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPayments = payments.filter(payment => {
    if (!paymentSearchTerm) return true;
    const term = paymentSearchTerm.toLowerCase();
    
    const lineWithChild = payment.lines?.find(l => l.child_id);
    const childId = lineWithChild?.child_id;
    const child = children.find(c => c.id === childId);
    const childName = child ? `${child.first_name} ${child.last_name} ${child.code}`.toLowerCase() : '';
    const guardianName = child?.guardian?.name?.toLowerCase() || '';

    return (
      payment.entry_number.toLowerCase().includes(term) ||
      payment.description?.toLowerCase().includes(term) ||
      childName.includes(term) ||
      guardianName.includes(term)
    );
  });

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header section */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Child Support & Fees</h1>
          <p className="text-gray-500">Manage profiles, school fee payments, and sponsorships</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'children' ? (
            <button 
              onClick={openCreateModal}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus size={18} />
              Register New Child
            </button>
          ) : (
            <button 
              onClick={() => setShowPaymentModal(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus size={18} />
              Record Fee Payment
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('children')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all ${
              activeTab === 'children'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Beneficiary Directory
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all ${
              activeTab === 'payments'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            School Fee Payments
          </button>
        </nav>
      </div>

      {/* CHILDREN TAB CONTENT */}
      {activeTab === 'children' && (
        <div className="space-y-6">
          {/* Registration Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden overflow-y-auto max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
                  <h2 className="text-xl font-bold text-gray-900">{editingChild ? 'Edit Beneficiary Profile' : 'Register New Beneficiary'}</h2>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">First Name</label>
                        <input 
                          type="text" 
                          required 
                          className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" 
                          value={formData.first_name}
                          onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last Name</label>
                        <input 
                          type="text" 
                          required 
                          className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" 
                          value={formData.last_name}
                          onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Child Code (Auto)</label>
                        <input 
                          type="text" 
                          required 
                          readOnly={!editingChild}
                          className="mt-1 w-full rounded-xl border-gray-100 bg-gray-50 text-gray-500 font-mono" 
                          value={formData.code}
                          onChange={(e) => setFormData({...formData, code: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Gender</label>
                        <select 
                          className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                          value={formData.gender}
                          onChange={(e) => setFormData({...formData, gender: e.target.value})}
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Class / Grade Level</label>
                        <input 
                          type="text" 
                          placeholder="e.g. PP1, Grade 4, Form 2" 
                          className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" 
                          value={formData.class_name}
                          onChange={(e) => setFormData({...formData, class_name: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Type of Disability</label>
                        <select 
                          className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                          value={formData.disability_type}
                          onChange={(e) => setFormData({...formData, disability_type: e.target.value})}
                        >
                          <option value="None">None (No Disability)</option>
                          <option value="Cerebral Palsy">Cerebral Palsy</option>
                          <option value="Physical Disability">Physical Disability</option>
                          <option value="Visual Impairment">Visual Impairment</option>
                          <option value="Hearing Impairment">Hearing Impairment</option>
                          <option value="Speech Impairment">Speech Impairment</option>
                          <option value="Intellectual / Learning Disability">Intellectual / Learning Disability</option>
                          <option value="Autism Spectrum">Autism Spectrum</option>
                          <option value="Multiple Disabilities">Multiple Disabilities</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                        <input 
                          type="date" 
                          required 
                          className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" 
                          value={formData.date_of_birth}
                          onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Enrollment Date</label>
                        <input 
                          type="date" 
                          required 
                          className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" 
                          value={formData.enrollment_date}
                          onChange={(e) => setFormData({...formData, enrollment_date: e.target.value})}
                        />
                      </div>
                      {editingChild && (
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700">Status</label>
                          <select 
                            className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                            value={formData.status}
                            onChange={(e) => setFormData({...formData, status: e.target.value})}
                          >
                            <option value="active">Active</option>
                            <option value="graduated">Graduated</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Guardian Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Select Existing Guardian</label>
                        <select 
                          className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                          value={formData.guardian_id}
                          onChange={(e) => setFormData({...formData, guardian_id: e.target.value})}
                        >
                          <option value="">-- Or register a new one below --</option>
                          {guardians.map(g => (
                            <option key={g.id} value={g.id}>{g.name} ({g.relationship})</option>
                          ))}
                        </select>
                      </div>
                      
                      {!formData.guardian_id && (
                        <div className="bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-200 grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">New Guardian Name</label>
                            <input 
                              type="text" 
                              placeholder="Full Name"
                              className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white" 
                              value={formData.new_guardian_name}
                              onChange={(e) => setFormData({...formData, new_guardian_name: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Relationship</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Mother, Uncle"
                              className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white" 
                              value={formData.new_guardian_relationship}
                              onChange={(e) => setFormData({...formData, new_guardian_relationship: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                            <input 
                              type="tel" 
                              placeholder="Phone"
                              className="mt-1 w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white" 
                              value={formData.new_guardian_phone}
                              onChange={(e) => setFormData({...formData, new_guardian_phone: e.target.value})}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2">
                    <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100">{editingChild ? 'Update Profile' : 'Register Child'}</button>
                    <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by name or code..." 
                  className="w-full pl-10 pr-4 py-2 rounded-xl border-gray-200 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                  <Filter size={16} />
                  Filter
                </button>
              </div>
            </div>

            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Child Details</th>
                  <th className="px-6 py-4 font-semibold">Code</th>
                  <th className="px-6 py-4 font-semibold">Class / Grade</th>
                  <th className="px-6 py-4 font-semibold">Disability Status</th>
                  <th className="px-6 py-4 font-semibold">Guardian</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Enrollment</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  [1, 2, 3].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={8} className="px-6 py-8 h-16 bg-gray-50/50"></td>
                    </tr>
                  ))
                ) : filteredChildren.map((child) => (
                  <tr key={child.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                          {child.first_name[0]}{child.last_name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{child.first_name} {child.last_name}</div>
                          <div className="text-xs text-gray-500">{child.gender} • {new Date().getFullYear() - new Date(child.date_of_birth).getFullYear()} yrs</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{child.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                      {child.class_name ? (
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold">
                          {child.class_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Unspecified</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {child.disability_type && child.disability_type !== 'None' ? (
                        <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                          <AlertCircle size={12} />
                          {child.disability_type}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                          None
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {child.guardian?.name || 'N/A'}
                      <div className="text-xs text-gray-400">{child.guardian?.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        child.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                        child.status === 'graduated' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {child.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(child.enrollment_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1 justify-end">
                        <button 
                          onClick={() => openViewModal(child)}
                          className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-all"
                          title="View Profile Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => openEditModal(child)}
                          className="p-2 hover:bg-amber-50 text-gray-400 hover:text-amber-600 rounded-lg transition-all"
                          title="Edit Child Profile"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteChild(child)}
                          className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition-all"
                          title="Delete Child Profile"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setPaymentFormData(prev => ({ ...prev, child_id: child.id, payment_type: 'revenue' }));
                            setActiveTab('payments');
                            setShowPaymentModal(true);
                          }}
                          className="p-2 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded-lg transition-all"
                          title="Pay School Fee"
                        >
                          <GraduationCap size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && filteredChildren.length === 0 && (
              <div className="p-12 text-center">
                <div className="inline-flex p-4 rounded-full bg-gray-50 text-gray-400 mb-4">
                  <UserPlus size={32} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">No children found</h3>
                <p className="text-gray-500 max-w-xs mx-auto mt-1">Try adjusting your search or add a new beneficiary to the system.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYMENTS TAB CONTENT */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search fee payments..." 
                  className="w-full pl-10 pr-4 py-2 rounded-xl border-gray-200 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  value={paymentSearchTerm}
                  onChange={(e) => setPaymentSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Entry No.</th>
                  <th className="px-6 py-4 font-semibold">Beneficiary (Child)</th>
                  <th className="px-6 py-4 font-semibold">Guardian</th>
                  <th className="px-6 py-4 font-semibold">Payment Type</th>
                  <th className="px-6 py-4 font-semibold">Amount</th>
                  <th className="px-6 py-4 font-semibold">Method / Fund</th>
                  <th className="px-6 py-4 font-semibold">Notes</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingPayments ? (
                  [1, 2, 3].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="px-6 py-8 h-16 bg-gray-50/50"></td>
                    </tr>
                  ))
                ) : filteredPayments.map((payment) => {
                  const lineWithChild = payment.lines?.find(l => l.child_id);
                  const childId = lineWithChild?.child_id;
                  const child = children.find(c => c.id === childId);
                  const isRevenue = payment.description?.toLowerCase().includes('inflow') || 
                                    payment.lines?.some(l => l.account?.code === '4300' && l.credit_amount > 0);
                  
                  const fund = funds.find(f => f.id === lineWithChild?.fund_id);

                  return (
                    <tr key={payment.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(payment.entry_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-indigo-600 font-medium">
                        {payment.entry_number}
                      </td>
                      <td className="px-6 py-4">
                        {child ? (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{child.first_name} {child.last_name}</span>
                            <span className="text-xs font-mono text-gray-400">({child.code})</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">Unspecified Child</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {child?.guardian?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          isRevenue 
                             ? 'bg-emerald-100 text-emerald-700' 
                             : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isRevenue ? (
                            <>
                              <ArrowDownLeft size={12} />
                              Guardian Inflow
                            </>
                          ) : (
                            <>
                              <ArrowUpRight size={12} />
                              NGO Outflow
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        KSh {payment.total_debit.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="font-medium">
                          {payment.lines?.find(l => l.account_id && (l.account?.code === '1111' || l.account?.code === '1110' || l.account?.code === '1150'))?.account?.name || 'M-Pesa / Cash'}
                        </div>
                        {fund && (
                          <div className="text-xs text-gray-400 font-mono">Fund: {fund.name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {payment.description?.replace(/School Fee Payment \((Inflow|Outflow)\): [^-]+ - /, '') || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handlePrintReceipt(payment)}
                            className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                            title="Print Receipt"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={() => handleDeletePayment(payment.id)}
                            className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                            title="Void / Delete"
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

            {!loadingPayments && filteredPayments.length === 0 && (
              <div className="p-12 text-center">
                <div className="inline-flex p-4 rounded-full bg-gray-50 text-gray-400 mb-4">
                  <Receipt size={32} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">No fee payments recorded</h3>
                <p className="text-gray-500 max-w-xs mx-auto mt-1">Start recording school fee payments for child beneficiaries.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* School Fee Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden overflow-y-auto max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-emerald-50/50">
              <h2 className="text-xl font-bold text-gray-900">Record School Fee Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>
            
            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-5">
              {/* Payment Type Toggles */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">Transaction Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPaymentFormData({ ...paymentFormData, payment_type: 'revenue' })}
                    className={`p-3 rounded-xl border-2 text-left flex flex-col justify-between transition-all ${
                      paymentFormData.payment_type === 'revenue'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <ArrowDownLeft className={`h-5 w-5 mb-1 ${paymentFormData.payment_type === 'revenue' ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <div>
                      <span className="block font-bold text-sm">Guardian Payment</span>
                      <span className="text-[10px] text-gray-400">Guardian pays tuition to NGO</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentFormData({ ...paymentFormData, payment_type: 'expense' })}
                    className={`p-3 rounded-xl border-2 text-left flex flex-col justify-between transition-all ${
                      paymentFormData.payment_type === 'expense'
                        ? 'border-amber-600 bg-amber-50 text-amber-800'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <ArrowUpRight className={`h-5 w-5 mb-1 ${paymentFormData.payment_type === 'expense' ? 'text-amber-600' : 'text-gray-400'}`} />
                    <div>
                      <span className="block font-bold text-sm">NGO Disbursement</span>
                      <span className="text-[10px] text-gray-400">NGO pays fee on behalf of child</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Child Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Beneficiary (Child)</label>
                <select
                  required
                  className="mt-1 w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500"
                  value={paymentFormData.child_id}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, child_id: e.target.value })}
                >
                  <option value="">-- Choose child --</option>
                  {children.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.code})</option>
                  ))}
                </select>
              </div>

              {/* Guardian Display */}
              {paymentFormData.child_id && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="text-xs uppercase font-bold text-gray-400">Guardian Info</div>
                  <div className="font-semibold text-gray-900">
                    {children.find(c => c.id === paymentFormData.child_id)?.guardian?.name || 'No registered guardian'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {children.find(c => c.id === paymentFormData.child_id)?.guardian?.relationship || ''}
                    {children.find(c => c.id === paymentFormData.child_id)?.guardian?.phone ? ` • ${children.find(c => c.id === paymentFormData.child_id)?.guardian?.phone}` : ''}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Amount (KSh)</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="0.00"
                      className="pl-12 w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 font-bold"
                      value={paymentFormData.amount}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">KSh</span>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Payment Date</label>
                  <input
                    type="date"
                    required
                    className="mt-1 w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500"
                    value={paymentFormData.entry_date}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, entry_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                  <select
                    className="mt-1 w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500"
                    value={paymentFormData.payment_method}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value })}
                  >
                    <option value="mpesa">M-Pesa / Bank</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>

                {/* Restricted Fund */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fund Source/Target</label>
                  <select
                    className="mt-1 w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500"
                    value={paymentFormData.fund_id}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, fund_id: e.target.value })}
                  >
                    <option value="">General (Unrestricted)</option>
                    {funds.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Department / Cost Center</label>
                <select
                  className="mt-1 w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500"
                  value={paymentFormData.department_id}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, department_id: e.target.value })}
                >
                  <option value="">No Department</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Memo / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Term 2 tuition fee payment"
                  className="mt-1 w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 resize-none text-sm"
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                />
              </div>

              <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2">
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className={`flex-1 text-white py-3 rounded-xl font-bold shadow-lg transition-all ${
                    paymentFormData.payment_type === 'revenue'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
                      : 'bg-amber-600 hover:bg-amber-700 shadow-amber-100'
                  }`}
                >
                  {paymentSubmitting ? 'Posting Entry...' : 'Post Payment'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Child Details Modal */}
      {viewingChild && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                  {viewingChild.first_name[0]}{viewingChild.last_name[0]}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{viewingChild.first_name} {viewingChild.last_name}</h2>
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                    <span>Code: {viewingChild.code}</span>
                    <span>•</span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      viewingChild.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      viewingChild.status === 'graduated' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {viewingChild.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setViewingChild(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase">Class / Grade</span>
                  <span className="font-bold text-gray-900 text-sm">{viewingChild.class_name || 'Not Specified'}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase">Type of Disability</span>
                  <span className={`font-bold text-sm inline-flex items-center gap-1 ${
                    viewingChild.disability_type && viewingChild.disability_type !== 'None'
                      ? 'text-purple-700'
                      : 'text-gray-700'
                  }`}>
                    {viewingChild.disability_type || 'None'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase">Gender</span>
                  <span className="font-medium text-gray-800 text-sm">{viewingChild.gender}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase">Date of Birth & Age</span>
                  <span className="font-medium text-gray-800 text-sm">
                    {viewingChild.date_of_birth} ({new Date().getFullYear() - new Date(viewingChild.date_of_birth).getFullYear()} yrs)
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase">Enrollment Date</span>
                  <span className="font-medium text-gray-800 text-sm">{new Date(viewingChild.enrollment_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase">Guardian</span>
                  <span className="font-medium text-gray-800 text-sm">
                    {viewingChild.guardian?.name || 'N/A'} {viewingChild.guardian?.relationship ? `(${viewingChild.guardian.relationship})` : ''}
                  </span>
                  {viewingChild.guardian?.phone && (
                    <div className="text-xs text-gray-500">{viewingChild.guardian.phone}</div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    const child = viewingChild;
                    setViewingChild(null);
                    openEditModal(child);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-amber-600 text-white py-2.5 rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-sm text-sm"
                >
                  <Edit2 size={16} />
                  Edit Profile
                </button>
                <button
                  onClick={() => {
                    const child = viewingChild;
                    setViewingChild(null);
                    setPaymentFormData(prev => ({ ...prev, child_id: child.id, payment_type: 'revenue' }));
                    setActiveTab('payments');
                    setShowPaymentModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm text-sm"
                >
                  <GraduationCap size={16} />
                  Pay School Fee
                </button>
                <button
                  onClick={() => setViewingChild(null)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChildManagement;
