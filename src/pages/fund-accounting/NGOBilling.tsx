import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Receipt, User, Heart, GraduationCap, Calendar, Plus, Trash2, ArrowRight,
  Search, Filter, CheckCircle2, AlertCircle, FileText, Printer, Eye,
  Building2, DollarSign, Layers, Shield, Phone, Mail, Sparkles, ExternalLink, RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SalesService } from '../../services/salesService';
import { FundAccountingService } from '../../services/fundAccountingService';
import { SchoolFeeService } from '../../services/schoolFeeService';
import { useAuthContext } from '../../contexts/useAuthContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import type { 
  Customer, Child, Guardian, Sponsorship, FundAccount, Department, Donor, Sponsor,
  SchoolFeeStructure, SchoolFeePayment, StudentFeeYearSummary, StudentFeeTermSummary, Sale 
} from '../../types';

type BillingType = 'school_fees' | 'child_support' | 'sponsorship';
type ActiveTab = 'create' | 'ledger' | 'history';
type PayerType = 'guardian' | 'sponsor' | 'custom';

const NGOBilling: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { settings } = useSettingsContext();

  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<ActiveTab>('create');

  // Term & Academic Year Context
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<number>(currentYear);
  const [selectedTerm, setSelectedTerm] = useState<'Term 1' | 'Term 2' | 'Term 3' | 'Full Year'>('Term 2');
  const [billingType, setBillingType] = useState<BillingType>('school_fees');

  // Primary Data Collections
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([]);
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [feeStructures, setFeeStructures] = useState<SchoolFeeStructure[]>([]);
  const [feePayments, setFeePayments] = useState<SchoolFeePayment[]>([]);
  const [issuedInvoices, setIssuedInvoices] = useState<Sale[]>([]);

  // Loading States
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State for Single Invoicing
  const [selectedChildId, setSelectedChildId] = useState('');
  const [childSearchTerm, setChildSearchTerm] = useState('');
  const [payerChoice, setPayerChoice] = useState<PayerType>('guardian');
  const [customCustomerName, setCustomCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedFundId, setSelectedFundId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedDonorId, setSelectedDonorId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [description, setDescription] = useState('');

  // Ledger Filter States
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerClassFilter, setLedgerClassFilter] = useState('all');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'all' | 'due_only' | 'cleared'>('all');

  useEffect(() => {
    loadData();
    // Default due date to 14 days from now
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDueDate(d.toISOString().split('T')[0]);
  }, [selectedAcademicYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        custs, childs, guards, spons, fList, dList, donorList,
        structs, payments, sales
      ] = await Promise.all([
        SalesService.getCustomers(),
        FundAccountingService.getChildren(),
        FundAccountingService.getGuardians(),
        FundAccountingService.getSponsorships(),
        FundAccountingService.getFundAccounts(),
        FundAccountingService.getDepartments(),
        FundAccountingService.getDonors(),
        SchoolFeeService.getFeeStructures(selectedAcademicYear),
        SchoolFeeService.getFeePayments({ academic_year: selectedAcademicYear }),
        SalesService.getSales()
      ]);

      setCustomers(custs || []);
      setGuardians(guards || []);

      // Link guardians into children profiles
      const guardMap = new Map((guards || []).map(g => [g.id, g]));
      const enrichedChildren = (childs || []).map(c => ({
        ...c,
        guardian: c.guardian || (c.guardian_id ? guardMap.get(c.guardian_id) : undefined)
      }));
      setChildren(enrichedChildren);

      setSponsorships(spons || []);
      setFunds(fList || []);
      setDepartments(dList || []);
      setDonors(donorList || []);
      setFeeStructures(structs || []);
      setFeePayments(payments || []);

      // Filter issued invoices for NGO billing / school fees / child support
      const ngoInvoices = (sales || []).filter(s =>
        s.sale_type === 'school_fees' ||
        s.sale_type === 'child_support' ||
        s.sale_type === 'sponsorship' ||
        s.child_id
      );
      setIssuedInvoices(ngoInvoices);

      // Pre-select Empower Hearts Special School department & Education fund if available
      const schoolDept = (dList || []).find(d => d.name.toLowerCase().includes('empower') || d.name.toLowerCase().includes('school')) || dList?.[0];
      if (schoolDept && !selectedDeptId) {
        setSelectedDeptId(schoolDept.id);
      }
      const eduFund = (fList || []).find(f => f.name.toLowerCase().includes('education')) || fList?.[0];
      if (eduFund && !selectedFundId) {
        setSelectedFundId(eduFund.id);
      }
    } catch (error) {
      console.error('Error loading NGO billing data:', error);
      toast.error('Failed to load billing dependencies');
    } finally {
      setLoading(false);
    }
  };

  // Selected child object
  const selectedChildObj = useMemo(() => {
    return children.find(c => c.id === selectedChildId) || null;
  }, [children, selectedChildId]);

  // Active sponsorship / sponsor for selected child
  const selectedChildSponsorship = useMemo(() => {
    if (!selectedChildId) return null;
    return sponsorships.find(s => s.child_id === selectedChildId && s.status === 'active') || null;
  }, [sponsorships, selectedChildId]);

  const selectedChildSponsor = useMemo(() => {
    return selectedChildSponsorship?.sponsor || null;
  }, [selectedChildSponsorship]);

  const selectedChildDonor = useMemo(() => {
    if (!selectedChildSponsor) return null;
    return donors.find(d => d.id === selectedChildSponsor.donor_id) || selectedChildSponsor.donor || null;
  }, [donors, selectedChildSponsor]);

  // Computed 3-Term fee summary for selected child
  const childFeeSummary = useMemo(() => {
    if (!selectedChildObj) return null;
    return SchoolFeeService.calculateChildFeeSummary(
      selectedChildObj,
      selectedAcademicYear,
      feeStructures,
      feePayments
    );
  }, [selectedChildObj, selectedAcademicYear, feeStructures, feePayments]);

  // Specific Term summary
  const selectedTermSummary = useMemo<StudentFeeTermSummary | null>(() => {
    if (!childFeeSummary) return null;
    if (selectedTerm === 'Term 1') return childFeeSummary.terms.term1;
    if (selectedTerm === 'Term 2') return childFeeSummary.terms.term2;
    if (selectedTerm === 'Term 3') return childFeeSummary.terms.term3;
    return null; // Full Year
  }, [childFeeSummary, selectedTerm]);

  // Auto-fill form values whenever child, term, or billing type changes
  useEffect(() => {
    if (!selectedChildObj) {
      setAmount('');
      setDescription('');
      return;
    }

    const studentFullName = `${selectedChildObj.first_name} ${selectedChildObj.last_name}`;
    const studentCode = selectedChildObj.code;
    const termLabel = selectedTerm === 'Full Year' ? `Full Academic Year ${selectedAcademicYear}` : `${selectedTerm} ${selectedAcademicYear}`;

    // Determine initial Payer Type
    if (billingType === 'sponsorship' || billingType === 'child_support') {
      setPayerChoice('sponsor');
    } else {
      // For school fees: if child has an active sponsor, default to sponsor, else guardian
      if (selectedChildSponsorship) {
        setPayerChoice('sponsor');
      } else {
        setPayerChoice('guardian');
      }
    }

    // Determine Term Balance
    let balanceToInvoice = 0;
    if (selectedTerm === 'Full Year') {
      balanceToInvoice = childFeeSummary ? Math.max(0, childFeeSummary.net_balance) : 0;
    } else if (selectedTermSummary) {
      balanceToInvoice = Math.max(0, selectedTermSummary.closing_balance);
    }

    // Fallback amount if balance is 0 or fee structure
    if (balanceToInvoice > 0) {
      setAmount(balanceToInvoice.toString());
    } else {
      const standardFee = selectedTermSummary?.expected_fee || selectedChildObj.expected_term_fee || 15000;
      setAmount(standardFee.toString());
    }

    // Auto-compose professional invoice description
    let desc = '';
    if (billingType === 'school_fees') {
      desc = `School Tuition Fees - ${termLabel}: ${studentFullName} (${studentCode})`;
    } else if (billingType === 'child_support') {
      desc = `Child Welfare & Support Subsidy - ${termLabel}: ${studentFullName} (${studentCode})`;
    } else {
      desc = `Education Sponsorship Obligation - ${termLabel}: ${studentFullName} (${studentCode})`;
    }
    setDescription(desc);
  }, [selectedChildObj, selectedTerm, billingType, childFeeSummary, selectedTermSummary]);

  // Update selected customer ID when payer choice changes
  useEffect(() => {
    if (!selectedChildObj) return;

    if (payerChoice === 'guardian') {
      const guardianName = selectedChildObj.guardian?.name || '';
      const matched = customers.find(c => 
        guardianName && c.name.toLowerCase().includes(guardianName.toLowerCase())
      );
      if (matched) {
        setSelectedCustomerId(matched.id);
      } else {
        setSelectedCustomerId('');
      }
      setSelectedDonorId('');
    } else if (payerChoice === 'sponsor') {
      const sponsorName = selectedChildSponsor?.name || selectedChildDonor?.name || '';
      const matched = customers.find(c => 
        sponsorName && c.name.toLowerCase().includes(sponsorName.toLowerCase())
      );
      if (matched) {
        setSelectedCustomerId(matched.id);
      } else {
        setSelectedCustomerId('');
      }
      if (selectedChildDonor) {
        setSelectedDonorId(selectedChildDonor.id);
      }
    }
  }, [payerChoice, selectedChildObj, selectedChildSponsor, selectedChildDonor, customers]);

  // Compute live term balance ledger for all children
  const allStudentLedger = useMemo(() => {
    return children.map(child => {
      const summary = SchoolFeeService.calculateChildFeeSummary(
        child,
        selectedAcademicYear,
        feeStructures,
        feePayments
      );

      const sponsorship = sponsorships.find(s => s.child_id === child.id && s.status === 'active');
      const sponsorName = sponsorship?.sponsor?.name || (sponsorship?.sponsor?.donor_id ? donors.find(d => d.id === sponsorship?.sponsor?.donor_id)?.name : null);
      const guardianName = child.guardian?.name || 'Guardian (Self)';

      let termExpected = 0;
      let termPaid = 0;
      let termBalance = 0;
      let termStatus = 'unpaid';

      if (selectedTerm === 'Full Year') {
        termExpected = summary.total_expected;
        termPaid = summary.total_paid;
        termBalance = summary.net_balance;
        termStatus = summary.status;
      } else {
        const tSummary = selectedTerm === 'Term 1' ? summary.terms.term1 : (selectedTerm === 'Term 2' ? summary.terms.term2 : summary.terms.term3);
        termExpected = tSummary.expected_fee;
        termPaid = tSummary.paid_amount;
        termBalance = tSummary.closing_balance;
        termStatus = tSummary.status;
      }

      return {
        child,
        summary,
        guardianName,
        sponsorName,
        isSponsored: !!sponsorship,
        payerLabel: sponsorName ? `Sponsor: ${sponsorName}` : `Guardian: ${guardianName}`,
        termExpected,
        termPaid,
        termBalance,
        termStatus
      };
    });
  }, [children, selectedAcademicYear, selectedTerm, feeStructures, feePayments, sponsorships, donors]);

  // Filter ledger list
  const filteredStudentLedger = useMemo(() => {
    return allStudentLedger.filter(item => {
      const fullName = `${item.child.first_name} ${item.child.last_name} ${item.child.code}`.toLowerCase();
      const payerStr = `${item.guardianName} ${item.sponsorName || ''}`.toLowerCase();
      const matchesSearch = fullName.includes(ledgerSearch.toLowerCase()) || payerStr.includes(ledgerSearch.toLowerCase());
      const matchesClass = ledgerClassFilter === 'all' || (item.child.class_name || '').toLowerCase() === ledgerClassFilter.toLowerCase();
      
      let matchesStatus = true;
      if (ledgerStatusFilter === 'due_only') {
        matchesStatus = item.termBalance > 0;
      } else if (ledgerStatusFilter === 'cleared') {
        matchesStatus = item.termBalance <= 0;
      }

      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [allStudentLedger, ledgerSearch, ledgerClassFilter, ledgerStatusFilter]);

  // Aggregate stats
  const ledgerMetrics = useMemo(() => {
    const totalExpected = allStudentLedger.reduce((sum, item) => sum + item.termExpected, 0);
    const totalPaid = allStudentLedger.reduce((sum, item) => sum + item.termPaid, 0);
    const totalArrears = allStudentLedger.reduce((sum, item) => sum + (item.termBalance > 0 ? item.termBalance : 0), 0);
    const totalAdvance = allStudentLedger.reduce((sum, item) => sum + (item.termBalance < 0 ? Math.abs(item.termBalance) : 0), 0);
    return { totalExpected, totalPaid, totalArrears, totalAdvance };
  }, [allStudentLedger]);

  // Quick action from ledger: load student into form
  const handleSelectStudentForBilling = (childId: string) => {
    setSelectedChildId(childId);
    setActiveTab('create');
  };

  // Helper to ensure customer exists in customers table
  const ensureCustomer = async (
    payerName: string, 
    phone?: string, 
    email?: string, 
    type: 'guardian' | 'sponsor' = 'guardian'
  ): Promise<Customer | null> => {
    if (!payerName.trim()) return null;
    const cleanName = payerName.trim();

    const existing = customers.find(c => 
      c.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) return existing;

    try {
      const prefix = type === 'sponsor' ? 'SPN' : 'GRD';
      const code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
      const created = await SalesService.createCustomer({
        name: cleanName,
        code,
        phone: phone || '',
        email: email || '',
        address: 'Empower School Beneficiary Sponsor/Guardian Contact',
        credit_limit: 100000,
        payment_terms: 14,
        is_active: true
      });
      if (created) {
        setCustomers(prev => [...prev, created]);
        return created;
      }
    } catch (err) {
      console.error('Failed to create customer for payer:', err);
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedChildObj) {
      toast.error('Please select a student beneficiary');
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Invoice amount must be greater than zero');
      return;
    }

    if (!dueDate) {
      toast.error('Please specify an invoice due date');
      return;
    }

    try {
      setSubmitting(true);

      // Determine payer details
      let payerName = '';
      let payerPhone = '';
      let payerEmail = '';
      let payerTypeTag: 'guardian' | 'sponsor' = 'guardian';

      if (payerChoice === 'guardian') {
        payerName = selectedChildObj.guardian?.name || `${selectedChildObj.first_name}'s Guardian`;
        payerPhone = selectedChildObj.guardian?.phone || '';
        payerEmail = selectedChildObj.guardian?.email || '';
        payerTypeTag = 'guardian';
      } else if (payerChoice === 'sponsor') {
        payerName = selectedChildSponsor?.name || selectedChildDonor?.name || 'Education Sponsor';
        payerPhone = selectedChildDonor?.phone || '';
        payerEmail = selectedChildDonor?.email || '';
        payerTypeTag = 'sponsor';
      } else {
        payerName = customCustomerName.trim() || 'Custom Billed Customer';
      }

      // Resolve or auto-create Customer record
      let targetCustomer: Customer | null = null;
      if (selectedCustomerId) {
        targetCustomer = customers.find(c => c.id === selectedCustomerId) || null;
      }
      if (!targetCustomer) {
        targetCustomer = await ensureCustomer(payerName, payerPhone, payerEmail, payerTypeTag);
      }

      if (!targetCustomer) {
        toast.error('Could not assign or create a customer account for this payer');
        return;
      }

      const termTag = selectedTerm === 'Full Year' ? `Full Academic Year ${selectedAcademicYear}` : `${selectedTerm} ${selectedAcademicYear}`;
      const lineItemDesc = description || `School Fees - ${termTag}: ${selectedChildObj.first_name} ${selectedChildObj.last_name} (${selectedChildObj.code}) - Billed to ${payerName}`;

      const billingData = {
        sale_date: new Date().toISOString().split('T')[0],
        due_date: dueDate,
        customer_id: targetCustomer.id,
        sale_type: billingType,
        child_id: selectedChildObj.id,
        department_id: selectedDeptId || undefined,
        fund_id: selectedFundId || undefined,
        donor_id: payerChoice === 'sponsor' ? (selectedDonorId || selectedChildDonor?.id || undefined) : undefined,
        payment_method: 'credit', // Invoiced on credit / accounts receivable
        subtotal: numAmount,
        tax_rate: 0,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: numAmount,
        paid_amount: 0,
        payment_status: 'pending' as 'pending',
        notes: `Beneficiary: ${selectedChildObj.first_name} ${selectedChildObj.last_name} (${selectedChildObj.code}, Class: ${selectedChildObj.class_name || 'N/A'}).\nBilled Payer: ${payerName} (${payerChoice.toUpperCase()}).\nAcademic Period: ${termTag}.\n${notes || ''}`.trim(),
        items: [
          {
            description: lineItemDesc,
            quantity: 1,
            unit_price: numAmount,
            total_amount: numAmount
          }
        ]
      };

      const response = await SalesService.createSale(billingData);
      
      if (response && response.id) {
        toast.success(`NGO Invoice #${response.sale_number} generated successfully!`);
        // Navigate to the official invoice detail page
        navigate(`/invoice/${response.id}`);
      } else {
        toast.error('Failed to generate invoice. Please review billing details.');
      }
    } catch (error: any) {
      console.error('NGO billing creation error:', error);
      toast.error(error?.message || 'An error occurred during invoice generation');
    } finally {
      setSubmitting(false);
    }
  };

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    children.forEach(c => { if (c.class_name) set.add(c.class_name); });
    return Array.from(set);
  }, [children]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl shadow-md shadow-indigo-100">
            <Receipt size={30} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">NGO Billing & Invoicing Center</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Term Balances & Receivables
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Generate official invoices for tuition fee balances, child support subsidies, and sponsor commitments.
            </p>
          </div>
        </div>

        {/* Global Academic Context Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Academic Year Switcher */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
            <Calendar size={15} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-600">Year:</span>
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-indigo-600 border-none focus:ring-0 cursor-pointer p-0 pr-1"
            >
              {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {/* Academic Term Switcher */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
            <Layers size={15} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-600">Term:</span>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value as any)}
              className="bg-transparent text-sm font-bold text-indigo-600 border-none focus:ring-0 cursor-pointer p-0 pr-1"
            >
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
              <option value="Full Year">Full Academic Year</option>
            </select>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border border-gray-200 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS FOR THE SELECTED TERM */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Billed ({selectedTerm})</span>
            <div className="text-2xl font-black text-gray-900 mt-1">KSh {ledgerMetrics.totalExpected.toLocaleString()}</div>
            <span className="text-xs text-gray-400">{allStudentLedger.length} registered students</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <DollarSign size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Total Collected</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">KSh {ledgerMetrics.totalPaid.toLocaleString()}</div>
            <span className="text-xs text-emerald-600/70 font-medium">Receipted & credited</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">Outstanding Arrears</span>
            <div className="text-2xl font-black text-rose-600 mt-1">KSh {ledgerMetrics.totalArrears.toLocaleString()}</div>
            <span className="text-xs text-rose-600/70 font-medium">Uninvoiced / Uncollected</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertCircle size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Issued Invoices</span>
            <div className="text-2xl font-black text-blue-600 mt-1">{issuedInvoices.length}</div>
            <span className="text-xs text-blue-600/70 font-medium">Recorded in AR ledger</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileText size={22} />
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="border-b border-gray-200 bg-white px-6 rounded-2xl shadow-sm">
        <nav className="flex space-x-8 overflow-x-auto" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('create')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Sparkles size={16} />
            Invoice Generator & Workbench
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'ledger'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Layers size={16} />
            Term Balances & Quick Billing ({filteredStudentLedger.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText size={16} />
            Issued Invoices History ({issuedInvoices.length})
          </button>
        </nav>
      </div>

      {/* TAB 1: SMART INVOICE GENERATOR */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Billing Form */}
          <div className="lg:col-span-8 space-y-6">
            {/* Billing Category Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setBillingType('school_fees')}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2.5 transition-all text-center ${
                  billingType === 'school_fees'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className={`p-2 rounded-xl ${billingType === 'school_fees' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <GraduationCap size={20} />
                </div>
                <div>
                  <div className="font-bold text-sm">School Tuition Fees</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">3-Term student tuition fees</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setBillingType('child_support')}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2.5 transition-all text-center ${
                  billingType === 'child_support'
                    ? 'border-pink-600 bg-pink-50 text-pink-900 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className={`p-2 rounded-xl ${billingType === 'child_support' ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <Heart size={20} />
                </div>
                <div>
                  <div className="font-bold text-sm">Child Support & Care</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Welfare & feeding subsidies</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setBillingType('sponsorship')}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2.5 transition-all text-center ${
                  billingType === 'sponsorship'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className={`p-2 rounded-xl ${billingType === 'sponsorship' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <User size={20} />
                </div>
                <div>
                  <div className="font-bold text-sm">Sponsorship Obligation</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Direct donor sponsor billing</div>
                </div>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden space-y-6 p-6">
              {/* STEP 1: SELECT BENEFICIARY */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <User size={16} className="text-indigo-600" />
                    1. Select Student Beneficiary:
                  </label>
                  {selectedChildObj && (
                    <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                      {selectedChildObj.code} | Class: {selectedChildObj.class_name || 'N/A'}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <select
                    value={selectedChildId}
                    onChange={(e) => setSelectedChildId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-gray-800 bg-white"
                  >
                    <option value="">-- Choose a student to fetch term balances and payer --</option>
                    {children.map(child => (
                      <option key={child.id} value={child.id}>
                        {child.first_name} {child.last_name} ({child.code}) - {child.class_name || 'Class N/A'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* STEP 2: SELECT BILLING PAYER (GUARDIAN OR SPONSOR) */}
              {selectedChildObj && (
                <div className="space-y-3 pt-4 border-t border-gray-100">
                  <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Building2 size={16} className="text-indigo-600" />
                    2. Name of Guardian or Sponsor Being Invoiced:
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Option A: Guardian */}
                    <div
                      onClick={() => setPayerChoice('guardian')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        payerChoice === 'guardian'
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Parent / Guardian</span>
                        <input
                          type="radio"
                          name="payerChoice"
                          checked={payerChoice === 'guardian'}
                          onChange={() => setPayerChoice('guardian')}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      <div className="font-bold text-gray-900 text-sm">
                        {selectedChildObj.guardian?.name || 'No Registered Guardian'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                        <span>Relationship: {selectedChildObj.guardian?.relationship || 'Parent'}</span>
                        {selectedChildObj.guardian?.phone && (
                          <span className="flex items-center gap-1 font-mono text-gray-600">
                            <Phone size={12} /> {selectedChildObj.guardian.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Option B: Sponsor / Donor */}
                    <div
                      onClick={() => setPayerChoice('sponsor')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        payerChoice === 'sponsor'
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Donor Sponsor</span>
                        <input
                          type="radio"
                          name="payerChoice"
                          checked={payerChoice === 'sponsor'}
                          onChange={() => setPayerChoice('sponsor')}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      <div className="font-bold text-gray-900 text-sm">
                        {selectedChildSponsor?.name || selectedChildDonor?.name || (selectedChildSponsorship ? 'Active Sponsor' : 'No Active Sponsor')}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                        <span>
                          {selectedChildSponsorship
                            ? `Commitment: KSh ${selectedChildSponsorship.amount.toLocaleString()} / ${selectedChildSponsorship.frequency}`
                            : 'Direct Sponsor Obligation'}
                        </span>
                        {selectedChildDonor?.email && (
                          <span className="flex items-center gap-1 text-gray-600">
                            <Mail size={12} /> {selectedChildDonor.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Customer Link Confirmation */}
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center justify-between text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      <span>
                        AR Ledger: Billed to{' '}
                        <strong className="text-gray-900">
                          {payerChoice === 'guardian'
                            ? (selectedChildObj.guardian?.name || 'Guardian')
                            : (selectedChildSponsor?.name || selectedChildDonor?.name || 'Education Sponsor')}
                        </strong>
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-gray-400">
                      Auto-linked to Customer AR
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 3: AMOUNT & DUE DATE */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Amount Input */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-gray-900">Invoice Amount (KSh)</label>
                      {childFeeSummary && (
                        <span className="text-xs text-indigo-600 font-bold">
                          Term Balance: KSh {(selectedTermSummary ? selectedTermSummary.closing_balance : childFeeSummary.net_balance).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-lg text-gray-900"
                        required
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">
                        KSh
                      </span>
                    </div>

                    {/* Quick Fill Balance Buttons */}
                    {childFeeSummary && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {selectedTermSummary && selectedTermSummary.closing_balance > 0 && (
                          <button
                            type="button"
                            onClick={() => setAmount(selectedTermSummary.closing_balance.toString())}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors"
                          >
                            Fill Term Arrears (KSh {selectedTermSummary.closing_balance.toLocaleString()})
                          </button>
                        )}
                        {childFeeSummary.net_balance > 0 && (
                          <button
                            type="button"
                            onClick={() => setAmount(childFeeSummary.net_balance.toString())}
                            className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors"
                          >
                            Fill Year Balance (KSh {childFeeSummary.net_balance.toLocaleString()})
                          </button>
                        )}
                        {selectedTermSummary && (
                          <button
                            type="button"
                            onClick={() => setAmount(selectedTermSummary.expected_fee.toString())}
                            className="px-2.5 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-medium transition-colors"
                          >
                            Standard Fee (KSh {selectedTermSummary.expected_fee.toLocaleString()})
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Due Date */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-900">Payment Due Date</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-gray-800"
                        required
                      />
                    </div>
                    <span className="text-xs text-gray-400">Payment terms given to the payer</span>
                  </div>
                </div>

                {/* Invoice Line Description */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-900">Official Invoice Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. School Tuition Fees - Term 2 2026: Kevin Mutua"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-gray-900"
                    required
                  />
                </div>
              </div>

              {/* STEP 4: TRACKING DIMENSIONS */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                  <Building2 size={14} className="text-indigo-600" />
                  Accounting Tracking Dimensions
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase">Department / Operations Unit</label>
                    <select
                      value={selectedDeptId}
                      onChange={(e) => setSelectedDeptId(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase">Restricted Fund</label>
                    <select
                      value={selectedFundId}
                      onChange={(e) => setSelectedFundId(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                    >
                      {funds.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Internal Notes */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-900">Internal Billing Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional notes for accounting or remarks on child subsidy..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex justify-end items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChildId('');
                    setAmount('');
                    setDescription('');
                  }}
                  className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedChildObj}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-7 py-3 rounded-xl font-bold text-sm shadow-md shadow-indigo-100 transition-all cursor-pointer"
                >
                  {submitting ? 'Generating Invoice...' : 'Generate & Issue Invoice'}
                  <ArrowRight size={17} />
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Child Fee Balance Card */}
          <div className="lg:col-span-4 space-y-6">
            {selectedChildObj ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Student Profile</span>
                    <span className="text-xs font-mono font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {selectedChildObj.code}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">
                    {selectedChildObj.first_name} {selectedChildObj.last_name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Class: <strong className="text-gray-700">{selectedChildObj.class_name || 'N/A'}</strong> | Gender: {selectedChildObj.gender}
                  </p>
                </div>

                {/* Term Breakdown */}
                {selectedTermSummary && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="font-bold text-xs text-gray-700 uppercase">{selectedTerm} {selectedAcademicYear}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedTermSummary.closing_balance <= 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {selectedTermSummary.closing_balance <= 0 ? 'Cleared' : `Due: KSh ${selectedTermSummary.closing_balance.toLocaleString()}`}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-gray-600">
                        <span>Expected Fee:</span>
                        <span className="font-bold font-mono">KSh {selectedTermSummary.expected_fee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Carried Balance (T-1):</span>
                        <span className="font-bold font-mono">
                          {selectedTermSummary.opening_balance >= 0 ? `+KSh ${selectedTermSummary.opening_balance.toLocaleString()}` : `-KSh ${Math.abs(selectedTermSummary.opening_balance).toLocaleString()} (Credit)`}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-600 font-semibold">
                        <span>Paid for this Term:</span>
                        <span className="font-bold font-mono">KSh {selectedTermSummary.paid_amount.toLocaleString()}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-sm">
                        <span className="font-bold text-gray-900">Net Term Balance:</span>
                        <span className={`font-mono font-bold ${
                          selectedTermSummary.closing_balance > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          KSh {selectedTermSummary.closing_balance.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Full Academic Year Breakdown */}
                {childFeeSummary && (
                  <div className="space-y-2 text-xs">
                    <div className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Academic Year {selectedAcademicYear} Net</div>
                    <div className="flex justify-between text-gray-600">
                      <span>Total Year Expected:</span>
                      <span className="font-mono font-bold">KSh {childFeeSummary.total_expected.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Total Year Paid:</span>
                      <span className="font-mono font-bold text-emerald-600">KSh {childFeeSummary.total_paid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1 border-t border-gray-100">
                      <span>Net Balance:</span>
                      <span className={`font-mono ${childFeeSummary.net_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        KSh {childFeeSummary.net_balance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Payer Summary Info */}
                <div className="space-y-2 pt-2 border-t border-gray-100 text-xs">
                  <div className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Identified Contacts</div>
                  <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 space-y-1">
                    <div className="font-bold text-indigo-900">Guardian: {selectedChildObj.guardian?.name || 'N/A'}</div>
                    <div className="text-indigo-700 font-mono">{selectedChildObj.guardian?.phone || 'No phone'}</div>
                    <div className="text-[11px] text-indigo-600">{selectedChildObj.guardian?.relationship || 'Parent'}</div>
                  </div>
                  {selectedChildSponsorship && (
                    <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 space-y-1">
                      <div className="font-bold text-blue-900">Sponsor: {selectedChildSponsor?.name || 'Sponsor'}</div>
                      <div className="text-blue-700">KSh {selectedChildSponsorship.amount.toLocaleString()} / {selectedChildSponsorship.frequency}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-3">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                  <GraduationCap size={28} />
                </div>
                <h4 className="font-bold text-gray-900">No Student Selected</h4>
                <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
                  Select a student from the dropdown or pick one directly from the Term Balances Ledger to fetch their fee structures, payments, and payer details.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('ledger')}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Browse Student Balances
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TERM BALANCES & QUICK BILLING LEDGER */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden space-y-4 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Student Tuition Fee Balances ({selectedTerm} {selectedAcademicYear})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Review live expected fees, payments received, and outstanding balances to invoice directly.
              </p>
            </div>

            {/* Ledger Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search student or payer..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium w-52 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <select
                value={ledgerClassFilter}
                onChange={(e) => setLedgerClassFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white"
              >
                <option value="all">All Classes</option>
                {uniqueClasses.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={ledgerStatusFilter}
                onChange={(e) => setLedgerStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white"
              >
                <option value="all">All Fee Statuses</option>
                <option value="due_only">Outstanding Arrears Only</option>
                <option value="cleared">Fully Cleared Only</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Student Beneficiary</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Invoiced Payer (Guardian / Sponsor)</th>
                  <th className="py-3 px-4 text-right">Expected Fee</th>
                  <th className="py-3 px-4 text-right">Paid to Date</th>
                  <th className="py-3 px-4 text-right">Term Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredStudentLedger.map((item) => (
                  <tr key={item.child.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-900">{item.child.first_name} {item.child.last_name}</div>
                      <div className="font-mono text-[11px] text-gray-400">{item.child.code}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium text-[11px]">
                        {item.child.class_name || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-800">
                        {item.sponsorName ? (
                          <span className="text-blue-700 flex items-center gap-1">
                            <Heart size={12} className="text-blue-500" /> {item.sponsorName}
                          </span>
                        ) : (
                          <span>{item.guardianName}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {item.isSponsored ? 'Donor Sponsored' : (item.child.guardian?.relationship || 'Parent')}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-gray-700">
                      KSh {item.termExpected.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-600">
                      KSh {item.termPaid.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      {item.termBalance > 0 ? (
                        <span className="text-rose-600">KSh {item.termBalance.toLocaleString()}</span>
                      ) : item.termBalance < 0 ? (
                        <span className="text-indigo-600">(KSh {Math.abs(item.termBalance).toLocaleString()})</span>
                      ) : (
                        <span className="text-emerald-600">KSh 0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        item.termBalance <= 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : (item.termPaid > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')
                      }`}>
                        {item.termBalance <= 0 ? 'Cleared' : (item.termPaid > 0 ? 'Partial' : 'Unpaid')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleSelectStudentForBilling(item.child.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-bold text-xs transition-colors"
                      >
                        <Receipt size={13} />
                        Invoice
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredStudentLedger.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      No students matched the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ISSUED NGO INVOICES HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden space-y-4 p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Issued NGO & School Fee Invoices</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Past generated invoices for tuition, sponsorships, and child support with accounts receivable records.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('create')}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              <Plus size={15} />
              Create New Invoice
            </button>
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date & Due</th>
                  <th className="py-3 px-4">Beneficiary</th>
                  <th className="py-3 px-4">Payer (Bill To)</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {issuedInvoices.map((inv) => {
                  const balanceDue = Number(inv.total_amount) - Number(inv.paid_amount || 0);
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                        {inv.sale_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-gray-800">{new Date(inv.sale_date).toLocaleDateString()}</div>
                        {inv.due_date && (
                          <div className="text-[10px] text-gray-400">Due: {new Date(inv.due_date).toLocaleDateString()}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-gray-900">
                          {inv.child ? `${inv.child.first_name} ${inv.child.last_name}` : 'Beneficiary'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-gray-800">
                          {inv.customer?.name || 'Guardian / Sponsor'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                        KSh {Number(inv.total_amount).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-600">
                        KSh {Number(inv.paid_amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600">
                        KSh {balanceDue.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.payment_status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : (inv.payment_status === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')
                        }`}>
                          {inv.payment_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => navigate(`/invoice/${inv.id}`)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-xs transition-colors"
                        >
                          <Eye size={13} />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {issuedInvoices.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      No NGO invoices recorded yet. Click "Create New Invoice" to generate one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default NGOBilling;
