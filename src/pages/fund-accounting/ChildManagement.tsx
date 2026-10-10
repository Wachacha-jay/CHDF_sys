import React, { useEffect, useState, useMemo } from 'react';
import { Child, Guardian, JournalEntry, FundAccount, Department, Account, SchoolFeePayment, SchoolFeeStructure, StudentFeeYearSummary } from '../../types';
import { FundAccountingService } from '../../services/fundAccountingService';
import { AccountingService } from '../../services/accountingService';
import { BusinessSettingsService } from '../../services/businessSettingsService';
import { SchoolFeeService } from '../../services/schoolFeeService';
import { 
  UserPlus, Search, Filter, GraduationCap, Plus,
  Calendar, ArrowDownLeft, Receipt, DollarSign, AlertCircle,
  Printer, Trash2, Eye, Edit2, X, School, CheckCircle2, AlertTriangle, ArrowRight,
  TrendingUp, CreditCard, ChevronRight, Layers, FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const ChildManagement: React.FC = () => {
  // Tab Management: 4 Modern School Fee & Child Support Tabs
  const [activeTab, setActiveTab] = useState<'children' | 'payments' | 'balances' | 'structures'>('children');

  // Business Settings State
  const [businessSettings, setBusinessSettings] = useState<any>(null);

  // Common Academic Year & Filters
  const currentYear = new Date().getFullYear();
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<number>(currentYear);
  const [selectedTermFilter, setSelectedTermFilter] = useState<string>('all');

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
    expected_term_fee: '',
    expected_annual_fee: '',
    guardian_id: '',
    new_guardian_name: '',
    new_guardian_phone: '',
    new_guardian_relationship: 'Parent'
  });

  // Accounting Accounts & Organization Dimensions
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // School Fee Specific Data
  const [feeStructures, setFeeStructures] = useState<SchoolFeeStructure[]>([]);
  const [feePayments, setFeePayments] = useState<SchoolFeePayment[]>([]);
  const [legacyPayments, setLegacyPayments] = useState<JournalEntry[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentSearchTerm, setPaymentSearchTerm] = useState('');
  const [balanceSearchTerm, setBalanceSearchTerm] = useState('');
  const [balanceClassFilter, setBalanceClassFilter] = useState('all');

  // School Fee Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    child_id: '',
    academic_year: currentYear,
    term: 'Term 1' as 'Term 1' | 'Term 2' | 'Term 3',
    amount: '',
    payment_method: 'mpesa' as 'mpesa' | 'cash' | 'bank',
    reference_number: '',
    payment_account_id: '',
    fund_id: '',
    department_id: '',
    notes: '',
    entry_date: new Date().toISOString().split('T')[0]
  });

  // Statement View Modal State
  const [viewingStatementSummary, setViewingStatementSummary] = useState<StudentFeeYearSummary | null>(null);

  // Fee Structure Modal State
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [structureFormData, setStructureFormData] = useState({
    id: '',
    academic_year: currentYear,
    term: 'Term 1',
    class_name: 'All',
    amount: '15000',
    description: ''
  });

  // Identified Default Accounts (Equity Bank & Empower School)
  const equityBankAccount = useMemo(() => {
    return accounts.find(a => a.name.toLowerCase().includes('equity') || a.code === '1112') ||
           accounts.find(a => a.account_type === 'asset' && a.name.toLowerCase().includes('bank')) ||
           accounts.find(a => a.account_type === 'asset');
  }, [accounts]);

  const empowerSchoolDepartment = useMemo(() => {
    return departments.find(d => d.name.toLowerCase().includes('empower')) ||
           departments.find(d => d.name.toLowerCase().includes('school')) ||
           departments[0];
  }, [departments]);

  const schoolFeeRevenueAccount = useMemo(() => {
    return accounts.find(a => a.code === '4300' || a.name.toLowerCase().includes('school fee')) ||
           accounts.find(a => a.account_type === 'revenue');
  }, [accounts]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [childrenData, guardiansData, accList, fundList, deptList, settingsData, structuresData, feePaymentsData, journalEntries] = await Promise.all([
        FundAccountingService.getChildren(),
        FundAccountingService.getGuardians(),
        AccountingService.getAccounts(),
        FundAccountingService.getFundAccounts(),
        FundAccountingService.getDepartments(),
        BusinessSettingsService.getSettings(),
        SchoolFeeService.getFeeStructures(selectedAcademicYear === 0 ? undefined : selectedAcademicYear),
        SchoolFeeService.getFeePayments({ academic_year: selectedAcademicYear }),
        AccountingService.getJournalEntries()
      ]);
      
      setChildren(childrenData);
      setGuardians(guardiansData);
      const flatAccs = accList ? AccountingService.flattenAccounts(accList) : [];
      setAccounts(flatAccs);
      setFunds(fundList);
      setDepartments(deptList);
      setBusinessSettings(settingsData);
      setFeeStructures(structuresData);

      // Synthesize any journal entries that are fee payments but not yet in school_fee_payments
      const existingJEntryIds = new Set(feePaymentsData.map(p => p.journal_entry_id).filter(Boolean));
      const childMap = new Map(childrenData.map(c => [c.id, c]));

      const synthesized: SchoolFeePayment[] = [];
      (journalEntries || []).forEach(entry => {
        if (existingJEntryIds.has(entry.id)) return;

        const descLower = (entry.description || '').toLowerCase();
        const isFeeDesc = descLower.includes('school fee') || descLower.includes('tuition') || descLower.includes('fee payment') || descLower.includes('child support');

        const lines = entry.lines || [];
        const childLine = lines.find(l => l.child_id);
        const feeRevLine = lines.find(l => l.account?.code === '4300' || l.account?.name?.toLowerCase().includes('school fee'));

        if (isFeeDesc || childLine || feeRevLine) {
          let childId = childLine?.child_id || '';
          if (!childId && childrenData.length > 0) {
            for (const c of childrenData) {
              const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
              if (descLower.includes(fullName) || (c.code && descLower.includes(c.code.toLowerCase()))) {
                childId = c.id;
                break;
              }
            }
          }
          if (!childId && childrenData.length > 0) childId = childrenData[0].id;

          const matchedChild = childMap.get(childId);
          const amount = Number(entry.total_debit || entry.total_credit || 0);
          const pDate = entry.entry_date ? new Date(entry.entry_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          const pYear = new Date(pDate).getFullYear();

          let term: 'Term 1' | 'Term 2' | 'Term 3' = 'Term 2';
          if (descLower.includes('term 1')) term = 'Term 1';
          else if (descLower.includes('term 3')) term = 'Term 3';

          synthesized.push({
            id: `syn-${entry.id}`,
            receipt_number: entry.entry_number || entry.reference || `RCP-${entry.id.slice(-6)}`,
            child_id: childId,
            child: matchedChild,
            academic_year: pYear,
            term: term,
            amount: amount,
            payment_date: pDate,
            payment_method: 'mpesa',
            reference_number: entry.reference || undefined,
            journal_entry_id: entry.id,
            notes: entry.description
          });
        }
      });

      const combinedFeePayments = [...feePaymentsData, ...synthesized];
      setFeePayments(combinedFeePayments);
    } catch (error) {
      console.error('Error loading child management data:', error);
      toast.error('Failed to load school fee data');
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    setLoadingPayments(true);
    try {
      await loadAllData();
    } catch (error) {
      console.error('Error loading fee payments:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [selectedAcademicYear]);

  // Set default Equity Bank & Empower School department in fee payment modal
  useEffect(() => {
    if (equityBankAccount && !paymentFormData.payment_account_id) {
      setPaymentFormData(prev => ({ ...prev, payment_account_id: equityBankAccount.id }));
    }
    if (empowerSchoolDepartment && !paymentFormData.department_id) {
      setPaymentFormData(prev => ({ ...prev, department_id: empowerSchoolDepartment.id }));
    }
  }, [equityBankAccount, empowerSchoolDepartment, showPaymentModal]);

  // Open Record Fee Payment with pre-selected child
  const openPaymentModal = (childId?: string, term?: 'Term 1' | 'Term 2' | 'Term 3') => {
    setPaymentFormData({
      child_id: childId || (children.length > 0 ? children[0].id : ''),
      academic_year: selectedAcademicYear,
      term: term || 'Term 1',
      amount: '',
      payment_method: 'mpesa',
      reference_number: '',
      payment_account_id: equityBankAccount?.id || '',
      fund_id: funds.find(f => f.code === 'FUND-EDU' || f.name.toLowerCase().includes('education'))?.id || (funds[0]?.id || ''),
      department_id: empowerSchoolDepartment?.id || '',
      notes: '',
      entry_date: new Date().toISOString().split('T')[0]
    });
    setShowPaymentModal(true);
  };

  // Live calculation for the selected child & term in Payment Modal
  const livePaymentSummary = useMemo(() => {
    if (!paymentFormData.child_id) return null;
    const selectedChild = children.find(c => c.id === paymentFormData.child_id);
    if (!selectedChild) return null;

    const summary = SchoolFeeService.calculateChildFeeSummary(
      selectedChild,
      Number(paymentFormData.academic_year),
      feeStructures,
      feePayments
    );

    const termKey = paymentFormData.term === 'Term 1' ? 'term1' : (paymentFormData.term === 'Term 2' ? 'term2' : 'term3');
    const termSummary = summary.terms[termKey];

    return {
      studentSummary: summary,
      termSummary
    };
  }, [paymentFormData.child_id, paymentFormData.academic_year, paymentFormData.term, children, feeStructures, feePayments]);

  // All student fee summaries for Balances Tab
  const allStudentSummaries = useMemo(() => {
    return SchoolFeeService.calculateAllStudentsFeeSummaries(
      children,
      selectedAcademicYear,
      feeStructures,
      feePayments
    );
  }, [children, selectedAcademicYear, feeStructures, feePayments]);

  // Overall Year KPI Totals
  const kpiTotals = useMemo(() => {
    let totalExpected = 0;
    let totalPaid = 0;
    let totalArrears = 0;
    let totalCredit = 0;

    allStudentSummaries.forEach(s => {
      totalExpected += s.total_expected;
      totalPaid += s.total_paid;
      if (s.net_balance > 0) {
        totalArrears += s.net_balance;
      } else if (s.net_balance < 0) {
        totalCredit += Math.abs(s.net_balance);
      }
    });

    return { totalExpected, totalPaid, totalArrears, totalCredit };
  }, [allStudentSummaries]);

  // Handle Child Profile Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let guardianId = formData.guardian_id;

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
      expected_term_fee: formData.expected_term_fee ? Number(formData.expected_term_fee) : 0,
      expected_annual_fee: formData.expected_annual_fee ? Number(formData.expected_annual_fee) : 0,
      guardian_id: guardianId
    };

    let result;
    if (editingChild) {
      result = await FundAccountingService.updateChild(editingChild.id, payload);
      if (result) {
        toast.success('Beneficiary profile updated successfully');
      }
    } else {
      result = await FundAccountingService.createChild(payload);
      if (result) {
        toast.success('Beneficiary registered successfully');
      }
    }

    if (result) {
      setShowModal(false);
      setEditingChild(null);
      loadAllData();
    }
  };

  // Handle Payment Submit: Strictly Guardian Payment -> Equity Bank & Empower School
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentFormData.child_id || !paymentFormData.amount) {
      toast.error('Please select a child and enter payment amount');
      return;
    }

    const selectedChildObj = children.find(c => c.id === paymentFormData.child_id);
    if (!selectedChildObj) {
      toast.error('Selected child not found');
      return;
    }

    const bankAcc = accounts.find(a => a.id === paymentFormData.payment_account_id) || equityBankAccount;
    if (!bankAcc) {
      toast.error('Receiving bank account (Equity Bank) is required');
      return;
    }

    try {
      setPaymentSubmitting(true);

      const result = await SchoolFeeService.recordFeePayment(
        {
          child_id: paymentFormData.child_id,
          academic_year: Number(paymentFormData.academic_year),
          term: paymentFormData.term,
          amount: Number(paymentFormData.amount),
          payment_date: paymentFormData.entry_date,
          payment_method: paymentFormData.payment_method,
          reference_number: paymentFormData.reference_number,
          bank_account_id: bankAcc.id,
          department_id: paymentFormData.department_id || empowerSchoolDepartment?.id,
          fund_id: paymentFormData.fund_id || undefined,
          notes: paymentFormData.notes || undefined
        },
        {
          child: selectedChildObj,
          equityBank: bankAcc,
          empowerDept: empowerSchoolDepartment,
          revenueAccount: schoolFeeRevenueAccount
        }
      );

      if (result.success && result.payment) {
        toast.success(`School fee payment of KSh ${Number(paymentFormData.amount).toLocaleString()} posted successfully`);
        setShowPaymentModal(false);

        // Fetch fresh payment data
        const updatedPayments = await SchoolFeeService.getFeePayments({ academic_year: selectedAcademicYear });
        setFeePayments(updatedPayments);

        // Prompt to print receipt
        const updatedSummary = SchoolFeeService.calculateChildFeeSummary(
          selectedChildObj,
          Number(paymentFormData.academic_year),
          feeStructures,
          updatedPayments
        );
        const termKey = paymentFormData.term === 'Term 1' ? 'term1' : (paymentFormData.term === 'Term 2' ? 'term2' : 'term3');

        if (window.confirm('Payment recorded successfully! Would you like to print the official School Fee Receipt now?')) {
          SchoolFeeService.printSchoolFeeReceipt(result.payment, updatedSummary.terms[termKey], businessSettings);
        }
      } else {
        toast.error(result.error || 'Failed to record school fee payment');
      }
    } catch (error: any) {
      console.error('Error submitting payment:', error);
      toast.error(error.message || 'Error recording fee payment');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Void/Delete Fee Payment
  const handleDeleteFeePayment = async (payment: SchoolFeePayment) => {
    if (!window.confirm(`Are you sure you want to void Receipt #${payment.receipt_number} for KSh ${Number(payment.amount).toLocaleString()}? This will reverse the transaction in the General Ledger.`)) return;

    const success = await SchoolFeeService.voidFeePayment(payment.id, payment.journal_entry_id);
    if (success) {
      toast.success('Fee payment voided and General Ledger entry reversed');
      loadPayments();
    } else {
      toast.error('Failed to void fee payment');
    }
  };

  // Save / Update Fee Structure
  const handleStructureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await SchoolFeeService.saveFeeStructure({
        id: structureFormData.id || undefined,
        academic_year: Number(structureFormData.academic_year),
        term: structureFormData.term,
        class_name: structureFormData.class_name,
        amount: Number(structureFormData.amount),
        description: structureFormData.description
      });
      if (res) {
        toast.success('Fee structure saved successfully');
        setShowStructureModal(false);
        const structList = await SchoolFeeService.getFeeStructures(selectedAcademicYear);
        setFeeStructures(structList);
      } else {
        toast.error('Failed to save fee structure');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving fee structure');
    }
  };

  // Filtered lists
  const filteredChildren = children.filter(c => 
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFeePayments = feePayments.filter(p => {
    const student = p.child ? `${p.child.first_name} ${p.child.last_name} ${p.child.code}`.toLowerCase() : '';
    const receipt = (p.receipt_number || '').toLowerCase();
    const matchesSearch = student.includes(paymentSearchTerm.toLowerCase()) || receipt.includes(paymentSearchTerm.toLowerCase());
    const matchesTerm = selectedTermFilter === 'all' || p.term === selectedTermFilter;
    return matchesSearch && matchesTerm;
  });

  const filteredStudentSummaries = allStudentSummaries.filter(s => {
    const name = `${s.child.first_name} ${s.child.last_name} ${s.child.code}`.toLowerCase();
    const matchesSearch = name.includes(balanceSearchTerm.toLowerCase());
    const matchesClass = balanceClassFilter === 'all' || (s.child.class_name || '').toLowerCase() === balanceClassFilter.toLowerCase();
    return matchesSearch && matchesClass;
  });

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    children.forEach(c => { if (c.class_name) set.add(c.class_name); });
    return Array.from(set);
  }, [children]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl shadow-md shadow-indigo-100">
            <School size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Child Support & School Fee Management</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Empower School
              </span>
            </div>
            <p className="text-sm text-gray-500">
              3-Term academic fee tracking, balances & overpayments carried forward, guardian payments to Equity Bank
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Academic Year Switcher */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
            <Calendar size={15} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-600">Academic Year:</span>
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-indigo-600 border-none focus:ring-0 cursor-pointer p-0 pr-2"
            >
              <option value={0}>All Academic Years</option>
              {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => openPaymentModal()}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-emerald-700 shadow-md shadow-emerald-100 text-sm transition-all"
          >
            <CreditCard size={17} />
            Record Fee Payment
          </button>

          <button
            onClick={() => {
              setEditingChild(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100 text-sm transition-all"
          >
            <UserPlus size={17} />
            Register Beneficiary
          </button>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Billed ({selectedAcademicYear})</span>
            <div className="text-2xl font-black text-gray-900 mt-1">KSh {kpiTotals.totalExpected.toLocaleString()}</div>
            <span className="text-xs text-gray-400">Expected for 3 terms</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <DollarSign size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Total Collected</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">KSh {kpiTotals.totalPaid.toLocaleString()}</div>
            <span className="text-xs text-gray-400">Paid to Equity Bank</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">Outstanding Arrears</span>
            <div className="text-2xl font-black text-rose-600 mt-1">KSh {kpiTotals.totalArrears.toLocaleString()}</div>
            <span className="text-xs text-gray-400">Uncollected balances</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Advance Overpayments</span>
            <div className="text-2xl font-black text-indigo-600 mt-1">KSh {kpiTotals.totalCredit.toLocaleString()}</div>
            <span className="text-xs text-gray-400">Credit carried forward</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* MODERN TAB NAVIGATION */}
      <div className="border-b border-gray-200 bg-white px-6 rounded-2xl shadow-sm">
        <nav className="flex space-x-8 overflow-x-auto" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('children')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'children'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <UserPlus size={16} />
            Beneficiaries Directory ({children.length})
          </button>

          <button
            onClick={() => setActiveTab('balances')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'balances'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText size={16} />
            Fee Statements & Balances (3-Term CF)
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'payments'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Receipt size={16} />
            Fee Payments Ledger ({feePayments.length})
          </button>

          <button
            onClick={() => setActiveTab('structures')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'structures'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Layers size={16} />
            Fee Structure Setup
          </button>
        </nav>
      </div>

      {/* TAB 1: BENEFICIARIES DIRECTORY */}
      {activeTab === 'children' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by student name or admission code..." 
                  className="w-full pl-10 pr-4 py-2 rounded-xl border-gray-200 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left min-w-[950px]">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Student Particulars</th>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Class / Grade</th>
                    <th className="px-6 py-4 font-semibold">Guardian Info</th>
                    <th className="px-6 py-4 font-semibold">Expected Fee</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={7} className="px-6 py-8 h-16 bg-gray-50/50"></td>
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
                          <span className="text-gray-400 text-xs italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="font-medium text-gray-900">{child.guardian?.name || 'N/A'}</div>
                        <div className="text-xs text-gray-400">{child.guardian?.phone || child.guardian?.relationship}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-700">
                        {child.expected_term_fee && Number(child.expected_term_fee) > 0 ? (
                          <span>KSh {Number(child.expected_term_fee).toLocaleString()} / term</span>
                        ) : (
                          <span className="text-xs text-gray-400">Standard School Fee</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          child.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {child.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              const summary = SchoolFeeService.calculateChildFeeSummary(child, selectedAcademicYear, feeStructures, feePayments);
                              setViewingStatementSummary(summary);
                            }}
                            className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                            title="View Fee Statement"
                          >
                            <FileText size={15} />
                            Statement
                          </button>
                          <button
                            onClick={() => openPaymentModal(child.id)}
                            className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                            title="Pay Fee"
                          >
                            <CreditCard size={15} />
                            Pay Fee
                          </button>
                          <button
                            onClick={() => {
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
                                expected_term_fee: child.expected_term_fee || '',
                                expected_annual_fee: child.expected_annual_fee || '',
                                guardian_id: child.guardian_id || '',
                                new_guardian_name: '',
                                new_guardian_phone: '',
                                new_guardian_relationship: 'Parent'
                              });
                              setShowModal(true);
                            }}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit Profile"
                          >
                            <Edit2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FEE STATEMENTS & 3-TERM BALANCES */}
      {activeTab === 'balances' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Search student or code..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border-gray-200 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                value={balanceSearchTerm}
                onChange={(e) => setBalanceSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">Class:</span>
                <select
                  value={balanceClassFilter}
                  onChange={(e) => setBalanceClassFilter(e.target.value)}
                  className="rounded-xl border-gray-200 text-xs font-medium py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Classes</option>
                  {uniqueClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left min-w-[1050px]">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Student & Code</th>
                    <th className="px-6 py-4 font-semibold">Class</th>
                    <th className="px-6 py-4 font-semibold text-right">Annual Expected</th>
                    <th className="px-6 py-4 font-semibold text-center">Term 1</th>
                    <th className="px-6 py-4 font-semibold text-center">Term 2 (CF)</th>
                    <th className="px-6 py-4 font-semibold text-center">Term 3 (CF)</th>
                    <th className="px-6 py-4 font-semibold text-right">Total Paid</th>
                    <th className="px-6 py-4 font-semibold text-right">Net Standing</th>
                    <th className="px-6 py-4 font-semibold text-right">Statement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredStudentSummaries.map((summary) => (
                    <tr key={summary.child_id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{summary.child.first_name} {summary.child.last_name}</div>
                        <div className="text-xs font-mono text-gray-400">{summary.child.code}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                          {summary.child.class_name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-gray-800">
                        KSh {summary.total_expected.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="font-mono text-xs font-semibold text-gray-700">KSh {summary.terms.term1.paid_amount.toLocaleString()}</div>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${
                          summary.terms.term1.closing_balance <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {summary.terms.term1.closing_balance < 0 ? `Credit -${Math.abs(summary.terms.term1.closing_balance).toLocaleString()}` : (summary.terms.term1.closing_balance > 0 ? `Due ${summary.terms.term1.closing_balance.toLocaleString()}` : 'Cleared')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="font-mono text-xs font-semibold text-gray-700">KSh {summary.terms.term2.paid_amount.toLocaleString()}</div>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${
                          summary.terms.term2.closing_balance <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {summary.terms.term2.closing_balance < 0 ? `Credit -${Math.abs(summary.terms.term2.closing_balance).toLocaleString()}` : (summary.terms.term2.closing_balance > 0 ? `Due ${summary.terms.term2.closing_balance.toLocaleString()}` : 'Cleared')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="font-mono text-xs font-semibold text-gray-700">KSh {summary.terms.term3.paid_amount.toLocaleString()}</div>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${
                          summary.terms.term3.closing_balance <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {summary.terms.term3.closing_balance < 0 ? `Credit -${Math.abs(summary.terms.term3.closing_balance).toLocaleString()}` : (summary.terms.term3.closing_balance > 0 ? `Due ${summary.terms.term3.closing_balance.toLocaleString()}` : 'Cleared')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">
                        KSh {summary.total_paid.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {summary.net_balance > 0 ? (
                          <div className="text-right">
                            <span className="font-mono font-bold text-rose-600">KSh {summary.net_balance.toLocaleString()}</span>
                            <div className="text-[10px] font-bold uppercase text-rose-500">Balance Arrears</div>
                          </div>
                        ) : summary.net_balance < 0 ? (
                          <div className="text-right">
                            <span className="font-mono font-bold text-indigo-600">(KSh {Math.abs(summary.net_balance).toLocaleString()})</span>
                            <div className="text-[10px] font-bold uppercase text-indigo-500">Overpaid Credit</div>
                          </div>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                            Fully Cleared
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setViewingStatementSummary(summary)}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                          >
                            <FileText size={14} />
                            View
                          </button>
                          <button
                            onClick={() => openPaymentModal(summary.child.id)}
                            className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                            title="Record Payment"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FEE PAYMENTS LEDGER */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Search by student, guardian or receipt #..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border-gray-200 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                value={paymentSearchTerm}
                onChange={(e) => setPaymentSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Term Filter:</span>
              <select
                value={selectedTermFilter}
                onChange={(e) => setSelectedTermFilter(e.target.value)}
                className="rounded-xl border-gray-200 text-xs font-medium py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Terms</option>
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left min-w-[1050px]">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Receipt No.</th>
                    <th className="px-6 py-4 font-semibold">Beneficiary (Student)</th>
                    <th className="px-6 py-4 font-semibold">Guardian Payer</th>
                    <th className="px-6 py-4 font-semibold">Academic Term</th>
                    <th className="px-6 py-4 font-semibold">Amount Paid</th>
                    <th className="px-6 py-4 font-semibold">Receiving Bank</th>
                    <th className="px-6 py-4 font-semibold">Method & Ref</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {loadingPayments ? (
                    [1, 2, 3].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={9} className="px-6 py-8 h-16 bg-gray-50/50"></td>
                      </tr>
                    ))
                  ) : filteredFeePayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-indigo-600">
                        {payment.receipt_number}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{payment.child ? `${payment.child.first_name} ${payment.child.last_name}` : 'Student'}</div>
                        <div className="text-xs font-mono text-gray-400">{payment.child?.code} • {payment.child?.class_name || 'Class N/A'}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {payment.child?.guardian?.name || 'Guardian'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold">
                          {payment.term} ({payment.academic_year})
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-black text-gray-900 text-base">
                        KSh {Number(payment.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-xs border border-emerald-200">
                          Equity Bank
                        </span>
                        <div className="text-[10px] text-gray-400 mt-0.5">Empower School</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="uppercase text-xs font-bold text-gray-700">{payment.payment_method}</span>
                        {payment.reference_number && (
                          <div className="text-xs font-mono text-gray-500">{payment.reference_number}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              const child = payment.child || children.find(c => c.id === payment.child_id);
                              if (child) {
                                const summary = SchoolFeeService.calculateChildFeeSummary(child, payment.academic_year, feeStructures, feePayments);
                                const termKey = payment.term === 'Term 1' ? 'term1' : (payment.term === 'Term 2' ? 'term2' : 'term3');
                                SchoolFeeService.printSchoolFeeReceipt(payment, summary.terms[termKey], businessSettings);
                              }
                            }}
                            className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                            title="Print Receipt"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteFeePayment(payment)}
                            className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                            title="Void Payment"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!loadingPayments && filteredFeePayments.length === 0 && (
                <div className="p-12 text-center">
                  <Receipt size={36} className="mx-auto text-gray-300 mb-3" />
                  <h3 className="text-lg font-bold text-gray-900">No fee payments recorded</h3>
                  <p className="text-gray-500 text-sm max-w-sm mx-auto mt-1">
                    Click "Record Fee Payment" to record a guardian tuition payment credited to Equity Bank.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FEE STRUCTURE SETUP */}
      {activeTab === 'structures' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Configured 3-Term Fee Structures ({selectedAcademicYear})</h2>
              <p className="text-xs text-gray-500 mt-0.5">Define standard expected tuition fees per term and class level</p>
            </div>
            <button
              onClick={() => {
                setStructureFormData({
                  id: '',
                  academic_year: selectedAcademicYear,
                  term: 'Term 1',
                  class_name: 'All',
                  amount: '15000',
                  description: 'Tuition Fee'
                });
                setShowStructureModal(true);
              }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100"
            >
              <Plus size={16} />
              Add Fee Structure
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['Term 1', 'Term 2', 'Term 3'].map(termName => {
              const termStructures = feeStructures.filter(s => s.term === termName && Number(s.academic_year) === selectedAcademicYear);
              return (
                <div key={termName} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="text-indigo-600" size={18} />
                      <h3 className="font-bold text-gray-900">{termName}</h3>
                    </div>
                    <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">
                      {selectedAcademicYear}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {termStructures.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-xs">
                        Default fallback: KSh 15,000
                      </div>
                    ) : termStructures.map(str => (
                      <div key={str.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                        <div>
                          <div className="text-xs font-bold text-gray-500 uppercase">{str.class_name || 'All Classes'}</div>
                          <div className="text-lg font-black text-gray-900 mt-0.5">KSh {Number(str.amount).toLocaleString()}</div>
                          {str.description && <div className="text-[11px] text-gray-400">{str.description}</div>}
                        </div>
                        <button
                          onClick={() => {
                            setStructureFormData({
                              id: str.id,
                              academic_year: str.academic_year,
                              term: str.term,
                              class_name: str.class_name || 'All',
                              amount: str.amount.toString(),
                              description: str.description || ''
                            });
                            setShowStructureModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RECORD SCHOOL FEE PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden overflow-y-auto max-h-[92vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-teal-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-100">
                  <CreditCard size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Record Guardian School Fee Payment</h2>
                  <p className="text-xs text-gray-500">Credited to Equity Bank • Department Empower School</p>
                </div>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-5">
              {/* Guardian Payment Confirmation Banner */}
              <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl flex items-center gap-3">
                <ArrowDownLeft className="text-emerald-600 shrink-0" size={24} />
                <div className="text-xs">
                  <span className="font-bold text-emerald-900 block">Guardian Payment (Revenue Inflow)</span>
                  <span className="text-emerald-700">Guardian pays tuition directly to the institution. Posted to School Fees Revenue.</span>
                </div>
              </div>

              {/* Child & Period Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Select Beneficiary (Student) *</label>
                  <select
                    required
                    className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-semibold"
                    value={paymentFormData.child_id}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, child_id: e.target.value })}
                  >
                    <option value="">-- Choose student --</option>
                    {children.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.code}) - {c.class_name || 'No Class'}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Academic Year</label>
                  <select
                    value={paymentFormData.academic_year}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, academic_year: Number(e.target.value) })}
                    className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-bold"
                  >
                    {[currentYear + 1, currentYear, currentYear - 1].map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Term Paid For *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Term 1', 'Term 2', 'Term 3'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPaymentFormData({ ...paymentFormData, term: t })}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border-2 transition-all ${
                          paymentFormData.term === t
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* LIVE FEE SCHEDULE DISPLAY FOR SELECTED STUDENT & TERM */}
              {livePaymentSummary && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-700 uppercase">{paymentFormData.term} ({paymentFormData.academic_year}) Fee Status</span>
                    <span className="text-gray-500">Guardian: <strong>{livePaymentSummary.studentSummary.child.guardian?.name || 'Parent'}</strong></span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">Term Expected</span>
                      <div className="text-xs font-mono font-bold text-gray-800">KSh {livePaymentSummary.termSummary.expected_fee.toLocaleString()}</div>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">Previous CF</span>
                      <div className={`text-xs font-mono font-bold ${livePaymentSummary.termSummary.opening_balance > 0 ? 'text-rose-600' : (livePaymentSummary.termSummary.opening_balance < 0 ? 'text-indigo-600' : 'text-gray-600')}`}>
                        {livePaymentSummary.termSummary.opening_balance < 0 ? `-${Math.abs(livePaymentSummary.termSummary.opening_balance).toLocaleString()} Credit` : `${livePaymentSummary.termSummary.opening_balance.toLocaleString()}`}
                      </div>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">Already Paid</span>
                      <div className="text-xs font-mono font-bold text-emerald-600">KSh {livePaymentSummary.termSummary.paid_amount.toLocaleString()}</div>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">Net Remaining</span>
                      <div className={`text-xs font-mono font-bold ${livePaymentSummary.termSummary.closing_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {livePaymentSummary.termSummary.closing_balance > 0 ? `KSh ${livePaymentSummary.termSummary.closing_balance.toLocaleString()}` : 'Cleared / Advance'}
                      </div>
                    </div>
                  </div>

                  {livePaymentSummary.termSummary.closing_balance > 0 && (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setPaymentFormData({ ...paymentFormData, amount: livePaymentSummary.termSummary.closing_balance.toString() })}
                        className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1"
                      >
                        Auto-Fill Remaining Balance (KSh {livePaymentSummary.termSummary.closing_balance.toLocaleString()})
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Amount & Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Amount Received (KSh) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-2.5 rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 font-black text-lg text-gray-900"
                      value={paymentFormData.amount}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-xs">KSh</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-semibold py-2.5"
                    value={paymentFormData.entry_date}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, entry_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Payment Method & Reference */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Payment Method</label>
                  <select
                    className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium"
                    value={paymentFormData.payment_method}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value as any })}
                  >
                    <option value="mpesa">M-Pesa (Paybill / Till / STK)</option>
                    <option value="bank">Bank Transfer / Cash Deposit</option>
                    <option value="cash">Direct Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Reference / M-Pesa Code</label>
                  <input
                    type="text"
                    placeholder="e.g. QKH789XYZ / Slip #..."
                    className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-mono"
                    value={paymentFormData.reference_number}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, reference_number: e.target.value })}
                  />
                </div>
              </div>

              {/* Receiving Bank & Department Defaults */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Receiving Bank *</label>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">Default: Equity</span>
                  </div>
                  <select
                    className="w-full rounded-xl border-emerald-300 bg-emerald-50/30 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-bold text-gray-900"
                    value={paymentFormData.payment_account_id}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_account_id: e.target.value })}
                  >
                    {accounts.filter(a => a.account_type === 'asset').map(acc => (
                      <option key={acc.id} value={acc.id}>
                        [{acc.code}] {acc.name} {acc.name.toLowerCase().includes('equity') ? '★' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Department *</label>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-bold">Default: Empower</span>
                  </div>
                  <select
                    className="w-full rounded-xl border-indigo-300 bg-indigo-50/30 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-bold text-gray-900"
                    value={paymentFormData.department_id}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, department_id: e.target.value })}
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.name.toLowerCase().includes('empower') ? '★' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Payment Notes / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Paid by father via M-Pesa"
                  className="w-full rounded-xl border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 resize-none text-sm"
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-100 transition-all text-sm flex items-center justify-center gap-2"
                >
                  <CreditCard size={18} />
                  {paymentSubmitting ? 'Posting Payment...' : 'Post School Fee Payment'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILED STUDENT FEE STATEMENT MODAL */}
      {viewingStatementSummary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden overflow-y-auto max-h-[92vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100">
                  <FileText size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Student Fee Statement ({viewingStatementSummary.academic_year})</h2>
                  <p className="text-xs text-gray-500">
                    {viewingStatementSummary.child.first_name} {viewingStatementSummary.child.last_name} • Code: {viewingStatementSummary.child.code}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewingStatementSummary(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Summary Profile Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-sm">
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase">Class / Grade Level</span>
                  <div className="font-bold text-gray-900 mt-0.5">{viewingStatementSummary.child.class_name || 'Unassigned'}</div>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase">Guardian Particulars</span>
                  <div className="font-bold text-gray-900 mt-0.5">{viewingStatementSummary.child.guardian?.name || 'N/A'}</div>
                  <div className="text-xs text-gray-500">{viewingStatementSummary.child.guardian?.phone || 'No phone'}</div>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase">Net Standing</span>
                  <div className={`font-black text-base mt-0.5 ${
                    viewingStatementSummary.net_balance > 0 ? 'text-rose-600' : (viewingStatementSummary.net_balance < 0 ? 'text-indigo-600' : 'text-emerald-600')
                  }`}>
                    {viewingStatementSummary.net_balance > 0 
                      ? `KSh ${viewingStatementSummary.net_balance.toLocaleString()} Due`
                      : (viewingStatementSummary.net_balance < 0 ? `(KSh ${Math.abs(viewingStatementSummary.net_balance).toLocaleString()}) Credit CF` : 'Fully Paid')}
                  </div>
                </div>
              </div>

              {/* 3-Term Fee Table */}
              <div>
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider mb-2">3-Term Fee Accounting Schedule</h3>
                <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-indigo-50/50 text-indigo-900 text-xs uppercase font-bold">
                      <tr>
                        <th className="px-4 py-3">Term</th>
                        <th className="px-4 py-3 text-right">Opening BF</th>
                        <th className="px-4 py-3 text-right">Expected Fee</th>
                        <th className="px-4 py-3 text-right">Total Billed</th>
                        <th className="px-4 py-3 text-right">Paid to Date</th>
                        <th className="px-4 py-3 text-right">Closing CF</th>
                        <th className="px-4 py-3 text-center">Term Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[viewingStatementSummary.terms.term1, viewingStatementSummary.terms.term2, viewingStatementSummary.terms.term3].map(t => (
                        <tr key={t.term} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-bold">{t.term}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-600">KSh {t.opening_balance.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">KSh {t.expected_fee.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-700">KSh {t.total_billed.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">KSh {t.paid_amount.toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right font-mono font-black ${t.closing_balance > 0 ? 'text-rose-600' : (t.closing_balance < 0 ? 'text-indigo-600' : 'text-emerald-600')}`}>
                            {t.closing_balance < 0 ? `(${Math.abs(t.closing_balance).toLocaleString()}) Credit` : `KSh ${t.closing_balance.toLocaleString()}`}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              t.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                              t.status === 'overpaid' ? 'bg-indigo-100 text-indigo-800' :
                              t.status === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                      <tr>
                        <td className="px-4 py-3">YEAR TOTAL</td>
                        <td className="px-4 py-3 text-right font-mono">-</td>
                        <td className="px-4 py-3 text-right font-mono">KSh {viewingStatementSummary.total_expected.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono">-</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-600">KSh {viewingStatementSummary.total_paid.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-right font-mono font-black ${viewingStatementSummary.net_balance > 0 ? 'text-rose-600' : (viewingStatementSummary.net_balance < 0 ? 'text-indigo-600' : 'text-emerald-600')}`}>
                          {viewingStatementSummary.net_balance < 0 ? `(${Math.abs(viewingStatementSummary.net_balance).toLocaleString()}) Credit` : `KSh ${viewingStatementSummary.net_balance.toLocaleString()}`}
                        </td>
                        <td className="px-4 py-3 text-center uppercase text-xs">{viewingStatementSummary.status}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => SchoolFeeService.printStudentFeeStatement(viewingStatementSummary, businessSettings)}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100 text-sm flex items-center justify-center gap-2"
                >
                  <Printer size={16} />
                  Print Official Statement
                </button>
                <button
                  onClick={() => {
                    const childId = viewingStatementSummary.child.id;
                    setViewingStatementSummary(null);
                    openPaymentModal(childId);
                  }}
                  className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-100 text-sm flex items-center justify-center gap-2"
                >
                  <CreditCard size={16} />
                  Record Payment
                </button>
                <button
                  onClick={() => setViewingStatementSummary(null)}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 rounded-xl text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FEE STRUCTURE MODAL */}
      {showStructureModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
              <h2 className="text-lg font-bold text-gray-900">{structureFormData.id ? 'Edit Fee Structure' : 'Add Fee Structure'}</h2>
              <button onClick={() => setShowStructureModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleStructureSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Academic Year</label>
                <input
                  type="number"
                  required
                  className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-bold"
                  value={structureFormData.academic_year}
                  onChange={(e) => setStructureFormData({ ...structureFormData, academic_year: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Term</label>
                <select
                  className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-bold"
                  value={structureFormData.term}
                  onChange={(e) => setStructureFormData({ ...structureFormData, term: e.target.value })}
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Class / Grade Level</label>
                <input
                  type="text"
                  placeholder="e.g. All, PP1, Grade 4"
                  className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  value={structureFormData.class_name}
                  onChange={(e) => setStructureFormData({ ...structureFormData, class_name: e.target.value })}
                />
                <span className="text-[11px] text-gray-400">Enter "All" for whole school standard fee</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Expected Fee Amount (KSh)</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-base font-black"
                  value={structureFormData.amount}
                  onChange={(e) => setStructureFormData({ ...structureFormData, amount: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description / Memo</label>
                <input
                  type="text"
                  placeholder="e.g. Standard Tuition Fee"
                  className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  value={structureFormData.description}
                  onChange={(e) => setStructureFormData({ ...structureFormData, description: e.target.value })}
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100 text-sm"
                >
                  Save Structure
                </button>
                <button
                  type="button"
                  onClick={() => setShowStructureModal(false)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 rounded-xl text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER / EDIT BENEFICIARY MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden overflow-y-auto max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
              <h2 className="text-xl font-bold text-gray-900">{editingChild ? 'Edit Beneficiary Profile' : 'Register New Beneficiary'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">First Name *</label>
                    <input 
                      type="text" 
                      required 
                      className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm" 
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Last Name *</label>
                    <input 
                      type="text" 
                      required 
                      className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm" 
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Child Code (Auto)</label>
                    <input 
                      type="text" 
                      required 
                      readOnly={!editingChild}
                      className="w-full rounded-xl border-gray-100 bg-gray-50 text-gray-500 font-mono text-sm" 
                      value={formData.code}
                      onChange={(e) => setFormData({...formData, code: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Gender</label>
                    <select 
                      className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      value={formData.gender}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Class / Grade Level</label>
                    <input 
                      type="text" 
                      placeholder="e.g. PP1, Grade 4, Form 2" 
                      className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm" 
                      value={formData.class_name}
                      onChange={(e) => setFormData({...formData, class_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Disability Status</label>
                    <select 
                      className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      value={formData.disability_type}
                      onChange={(e) => setFormData({...formData, disability_type: e.target.value})}
                    >
                      <option value="None">None</option>
                      <option value="Cerebral Palsy">Cerebral Palsy</option>
                      <option value="Physical Disability">Physical Disability</option>
                      <option value="Visual Impairment">Visual Impairment</option>
                      <option value="Hearing Impairment">Hearing Impairment</option>
                      <option value="Intellectual / Learning Disability">Intellectual Disability</option>
                      <option value="Autism Spectrum">Autism Spectrum</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Date of Birth</label>
                    <input 
                      type="date" 
                      required 
                      className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm" 
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Enrollment Date</label>
                    <input 
                      type="date" 
                      required 
                      className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm" 
                      value={formData.enrollment_date}
                      onChange={(e) => setFormData({...formData, enrollment_date: e.target.value})}
                    />
                  </div>

                  {/* Individualized Fee Customization */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Custom Term Fee (KSh)</label>
                    <input 
                      type="number" 
                      placeholder="0 for default" 
                      className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm" 
                      value={formData.expected_term_fee}
                      onChange={(e) => setFormData({...formData, expected_term_fee: e.target.value})}
                    />
                    <span className="text-[10px] text-gray-400">Leave empty to use school fee structure</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Custom Annual Fee (KSh)</label>
                    <input 
                      type="number" 
                      placeholder="0 for default" 
                      className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm" 
                      value={formData.expected_annual_fee}
                      onChange={(e) => setFormData({...formData, expected_annual_fee: e.target.value})}
                    />
                    <span className="text-[10px] text-gray-400">Total expected across 3 terms</span>
                  </div>
                </div>
              </div>

              {/* Guardian Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Guardian Details</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Select Registered Guardian</label>
                    <select 
                      className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      value={formData.guardian_id}
                      onChange={(e) => setFormData({...formData, guardian_id: e.target.value})}
                    >
                      <option value="">-- Or enter new guardian below --</option>
                      {guardians.map(g => (
                        <option key={g.id} value={g.id}>{g.name} ({g.relationship}) - {g.phone}</option>
                      ))}
                    </select>
                  </div>
                  
                  {!formData.guardian_id && (
                    <div className="bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-200 grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Guardian Name</label>
                        <input 
                          type="text" 
                          placeholder="Full Name"
                          className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm" 
                          value={formData.new_guardian_name}
                          onChange={(e) => setFormData({...formData, new_guardian_name: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Relationship</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Mother, Father"
                          className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm" 
                          value={formData.new_guardian_relationship}
                          onChange={(e) => setFormData({...formData, new_guardian_relationship: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Phone Number</label>
                        <input 
                          type="tel" 
                          placeholder="+254 7..."
                          className="w-full rounded-xl border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm" 
                          value={formData.new_guardian_phone}
                          onChange={(e) => setFormData({...formData, new_guardian_phone: e.target.value})}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 text-sm">
                  {editingChild ? 'Update Profile' : 'Register Beneficiary'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl text-sm">
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

export default ChildManagement;
