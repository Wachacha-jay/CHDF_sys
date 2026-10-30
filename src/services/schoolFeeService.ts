import { getReportWatermarkHtml, getReportPrintStyles } from '../utils/reportPrintUtils';
import { ApiService } from './api';
import { AccountingService } from './accountingService';
import type { 
  Child, 
  SchoolFeeStructure, 
  SchoolFeePayment, 
  StudentFeeTermSummary, 
  StudentFeeYearSummary, 
  JournalEntry,
  Account,
  Department,
  Donor
} from '../types';

export interface RecordFeePaymentPayload {
  child_id: string;
  academic_year: number;
  term: 'Term 1' | 'Term 2' | 'Term 3';
  amount: number;
  payment_date: string;
  payment_method: 'mpesa' | 'cash' | 'bank';
  reference_number?: string;
  bank_account_id?: string;
  department_id?: string;
  fund_id?: string;
  notes?: string;
  payer_type?: 'guardian' | 'donor' | 'ngo_scholarship';
  payer_name?: string;
  donor_id?: string;
}

export interface UnifiedSchoolFeeRecord {
  id: string;
  receipt_number: string;
  payment_date: string;
  child_id: string;
  child_name: string;
  child_code: string;
  guardian_name?: string;
  academic_year: number;
  term: 'Term 1' | 'Term 2' | 'Term 3';
  amount: number;
  payment_method: string;
  reference_number?: string;
  bank_account_id?: string;
  department_id?: string;
  department_name?: string;
  fund_id?: string;
  fund_name?: string;
  notes?: string;
  payer_type: 'guardian' | 'donor' | 'ngo_scholarship';
  payer_name?: string;
  payer_label: string;
  is_inflow: boolean;
  donor_id?: string;
  donor?: Donor;
  journal_entry_id?: string;
  journal_entry?: JournalEntry;
  child?: Child;
  date?: string;
  childName?: string;
  childCode?: string;
  type?: string;
  fund?: string;
  dept?: string;
  description?: string;
  entryNumber?: string;
  entry?: JournalEntry;
}

export class SchoolFeeService {
  /**
   * Fetch all configured fee structures (or for a specific year)
   */
  static async getFeeStructures(year?: number): Promise<SchoolFeeStructure[]> {
    const filters: Record<string, any> = {};
    if (year) filters.academic_year = year;
    const res = await ApiService.get<SchoolFeeStructure>('school_fee_structures', {
      filters,
      orderBy: { column: 'term', ascending: true }
    });
    return res.success ? (res.data || []) : [];
  }

  /**
   * Create or update a fee structure row
   */
  static async saveFeeStructure(data: Partial<SchoolFeeStructure>): Promise<SchoolFeeStructure | null> {
    if (data.id) {
      const res = await ApiService.update<SchoolFeeStructure>('school_fee_structures', data.id, {
        ...data,
        updated_at: new Date().toISOString()
      });
      return res.success ? (res.data as SchoolFeeStructure) : null;
    } else {
      const res = await ApiService.create<SchoolFeeStructure>('school_fee_structures', data);
      return res.success ? res.data : null;
    }
  }

  /**
   * Fetch school fee payments with optional filters
   */
  static async getFeePayments(filters?: {
    child_id?: string;
    academic_year?: number;
    term?: string;
  }): Promise<SchoolFeePayment[]> {
    const apiFilters: Record<string, any> = {};
    if (filters?.child_id) apiFilters.child_id = filters.child_id;
    if (filters?.academic_year && filters.academic_year !== 0) apiFilters.academic_year = filters.academic_year;
    if (filters?.term && filters.term !== 'all') apiFilters.term = filters.term;

    const res = await ApiService.get<SchoolFeePayment>('school_fee_payments', {
      filters: apiFilters,
      orderBy: { column: 'payment_date', ascending: false }
    });

    let payments = res.success ? (res.data || []) : [];

    // Normalize payment fields if missing:
    payments = payments.map(p => {
      const pYear = p.academic_year ? Number(p.academic_year) : (p.payment_date ? new Date(p.payment_date).getFullYear() : 2026);
      const pTerm = p.term || 'Term 2';
      return {
        ...p,
        academic_year: pYear,
        term: pTerm
      };
    });

    return payments;
  }

  /**
   * Authoritative, unified source of truth for all school fee payments & tuition records.
   * Reconciles school_fee_payments with journal entries, resolving student, guardian, donor,
   * and properly distinguishing Guardian Direct Payments from Donor-Sponsored Payments.
   */
  static async getUnifiedFeeRecords(filters?: {
    academic_year?: number;
    term?: string;
    child_id?: string;
    department_id?: string;
    fund_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<UnifiedSchoolFeeRecord[]> {
    try {
      const [feePaymentsRes, journalEntries, childrenRes, deptsRes, fundsRes, donorsRes] = await Promise.all([
        ApiService.get<SchoolFeePayment>('school_fee_payments'),
        AccountingService.getJournalEntries(),
        ApiService.get<Child>('children'),
        ApiService.get<Department>('departments'),
        ApiService.get<any>('fund_accounts'),
        ApiService.get<any>('donors')
      ]);

      const feePayments = feePaymentsRes.success ? (feePaymentsRes.data || []) : [];
      const children = childrenRes.success ? (childrenRes.data || []) : [];
      const depts = deptsRes.success ? (deptsRes.data || []) : [];
      const funds = fundsRes.success ? (fundsRes.data || []) : [];
      const donors = donorsRes.success ? (donorsRes.data || []) : [];

      const childMap = new Map(children.map(c => [c.id, c]));
      const deptMap = new Map(depts.map(d => [d.id, d.name]));
      const fundMap = new Map(funds.map(f => [f.id, f.name]));
      const donorMap = new Map(donors.map(d => [d.id, d.name]));
      const jEntryMap = new Map((journalEntries || []).map(je => [je.id, je]));

      const unifiedRecords: UnifiedSchoolFeeRecord[] = [];
      const seenPaymentKeys = new Set<string>();

      // 1. Process persisted payments in school_fee_payments
      for (const p of feePayments) {
        const child = childMap.get(p.child_id);
        const childName = child ? `${child.first_name} ${child.last_name}` : 'Student Beneficiary';
        const childCode = child?.code || 'N/A';
        const guardianName = child?.guardian?.name || 'Guardian';
        const pDate = p.payment_date ? String(p.payment_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
        const pYear = p.academic_year ? Number(p.academic_year) : new Date(pDate).getFullYear();
        const pTerm = (p.term || 'Term 2') as 'Term 1' | 'Term 2' | 'Term 3';
        const linkedJE = p.journal_entry_id ? jEntryMap.get(p.journal_entry_id) : undefined;

        // Determine Payer Type
        const notesLower = `${p.notes || ''} ${linkedJE?.description || ''}`.toLowerCase();
        let payerType: 'guardian' | 'donor' | 'ngo_scholarship' = 'guardian';
        let payerLabel = `Inflow (Guardian Pay - ${guardianName})`;

        if (p.payer_type === 'donor' || p.donor_id || notesLower.includes('donor') || notesLower.includes('sponsor')) {
          payerType = 'donor';
          const donorName = p.donor_id ? donorMap.get(p.donor_id) : (p.payer_name || undefined);
          payerLabel = donorName ? `Inflow (Donor Sponsored - ${donorName})` : 'Inflow (Donor Sponsored)';
        } else if (p.payer_type === 'ngo_scholarship' || notesLower.includes('scholarship') || (notesLower.includes('outflow') && !notesLower.includes('inflow'))) {
          payerType = 'ngo_scholarship';
          payerLabel = 'NGO Outflow (External Tuition)';
        }

        const record: UnifiedSchoolFeeRecord = {
          id: p.id,
          receipt_number: p.receipt_number || (p.reference_number ? `REF-${p.reference_number}` : `RCP-${p.id.slice(0, 8).toUpperCase()}`),
          payment_date: pDate,
          child_id: p.child_id,
          child_name: childName,
          child_code: childCode,
          guardian_name: guardianName,
          academic_year: pYear,
          term: pTerm,
          amount: Number(p.amount || 0),
          payment_method: p.payment_method || 'mpesa',
          reference_number: p.reference_number,
          bank_account_id: p.bank_account_id,
          department_id: p.department_id,
          department_name: p.department_id ? deptMap.get(p.department_id) : 'Empower Hearts Special School',
          fund_id: p.fund_id,
          fund_name: p.fund_id ? fundMap.get(p.fund_id) : 'Education Fund',
          notes: p.notes,
          payer_type: payerType,
          payer_name: p.payer_name || (payerType === 'donor' ? (p.donor_id ? donorMap.get(p.donor_id) : 'Donor Sponsor') : guardianName),
          payer_label: payerLabel,
          is_inflow: payerType !== 'ngo_scholarship',
          donor_id: p.donor_id,
          journal_entry_id: p.journal_entry_id,
          journal_entry: linkedJE,
          child: child,
          date: pDate,
          childName,
          childCode,
          type: payerLabel,
          fund: p.fund_id ? fundMap.get(p.fund_id) : 'Education Fund',
          dept: p.department_id ? deptMap.get(p.department_id) : 'Empower Hearts Special School',
          description: p.notes,
          entryNumber: p.receipt_number,
          entry: linkedJE
        };

        const dedupeKey = `${p.child_id}-${pDate}-${Number(p.amount).toFixed(2)}`;
        seenPaymentKeys.add(dedupeKey);
        if (p.journal_entry_id) {
          seenPaymentKeys.add(p.journal_entry_id);
        }

        unifiedRecords.push(record);
      }

      // 2. Synthesize residual journal entries that are fee payments or child sponsorship revenues
      (journalEntries || []).forEach(entry => {
        if (seenPaymentKeys.has(entry.id)) return;

        const descLower = (entry.description || '').toLowerCase();
        const lines = entry.lines || [];
        const isFeeDesc = descLower.includes('school fee') || descLower.includes('tuition');
        const feeRevLine = lines.find(l => l.account?.code === '4300' || (l.credit_amount > 0 && (l.account?.name || '').toLowerCase().includes('school fee')));
        const sponsorRevLine = lines.find(l => l.account?.code === '4240' || (l.credit_amount > 0 && (l.account?.name || '').toLowerCase().includes('child sponsorship')));
        const feeExpLine = lines.find(l => l.account?.code === '5310' || l.account?.code === '5350' || (l.debit_amount > 0 && (l.account?.name || '').toLowerCase().includes('school fee')));

        if (!isFeeDesc && !feeRevLine && !sponsorRevLine && !feeExpLine) return;

        // Find associated child
        let childId = lines.find(l => l.child_id)?.child_id || '';
        if (!childId) {
          for (const c of children) {
            const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
            if (descLower.includes(fullName) || (c.code && descLower.includes(c.code.toLowerCase()))) {
              childId = c.id;
              break;
            }
          }
        }
        if (!childId && children.length > 0) {
          childId = children[0].id;
        }

        const child = childMap.get(childId);
        const childName = child ? `${child.first_name} ${child.last_name}` : 'Student Beneficiary';
        const childCode = child?.code || 'N/A';
        const guardianName = child?.guardian?.name || 'Guardian';

        const pDate = entry.entry_date ? String(entry.entry_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
        const pYear = new Date(pDate).getFullYear();
        let pTerm: 'Term 1' | 'Term 2' | 'Term 3' = 'Term 2';
        if (descLower.includes('term 1')) pTerm = 'Term 1';
        else if (descLower.includes('term 3')) pTerm = 'Term 3';

        const amount = Number(entry.total_debit || entry.total_credit || 0);
        const dedupeKey = `${childId}-${pDate}-${amount.toFixed(2)}`;
        if (seenPaymentKeys.has(dedupeKey)) return;
        seenPaymentKeys.add(dedupeKey);

        let payerType: 'guardian' | 'donor' | 'ngo_scholarship' = 'guardian';
        let payerLabel = `Inflow (Guardian Pay - ${guardianName})`;
        let payerName = guardianName;

        if (sponsorRevLine || descLower.includes('donor') || descLower.includes('sponsor')) {
          payerType = 'donor';
          let matchedDonorName = '';
          for (const d of donors) {
            if (descLower.includes(d.name.toLowerCase())) {
              matchedDonorName = d.name;
              break;
            }
          }
          payerName = matchedDonorName || 'Donor Sponsor';
          payerLabel = matchedDonorName ? `Inflow (Donor Sponsored - ${matchedDonorName})` : 'Inflow (Donor Sponsored)';
        } else if (feeExpLine && !feeRevLine && !descLower.includes('inflow')) {
          payerType = 'ngo_scholarship';
          payerLabel = 'NGO Outflow (External Tuition)';
          payerName = 'NGO Scholarship';
        }

        const lineDeptId = lines.find(l => l.department_id)?.department_id;
        const lineFundId = lines.find(l => l.fund_id)?.fund_id;
        const deptName = lineDeptId ? deptMap.get(lineDeptId) : 'Empower Hearts Special School';
        const fundName = lineFundId ? fundMap.get(lineFundId) : 'Education Fund';
        const receiptNo = entry.entry_number || entry.reference || `RCP-${entry.id.slice(0, 6).toUpperCase()}`;

        unifiedRecords.push({
          id: `syn-${entry.id}`,
          receipt_number: receiptNo,
          payment_date: pDate,
          child_id: childId,
          child_name: childName,
          child_code: childCode,
          guardian_name: guardianName,
          academic_year: pYear,
          term: pTerm,
          amount: amount,
          payment_method: 'mpesa',
          reference_number: entry.reference || undefined,
          department_id: lineDeptId,
          department_name: deptName,
          fund_id: lineFundId,
          fund_name: fundName,
          notes: entry.description,
          payer_type: payerType,
          payer_name: payerName,
          payer_label: payerLabel,
          is_inflow: payerType !== 'ngo_scholarship',
          journal_entry_id: entry.id,
          journal_entry: entry,
          child: child,
          date: pDate,
          childName,
          childCode,
          type: payerLabel,
          fund: fundName,
          dept: deptName,
          description: entry.description,
          entryNumber: receiptNo,
          entry
        });
      });

      // Apply query filters
      let filtered = unifiedRecords;

      if (filters?.academic_year && Number(filters.academic_year) !== 0) {
        filtered = filtered.filter(r => r.academic_year === Number(filters.academic_year));
      }
      if (filters?.term && filters.term !== 'all') {
        filtered = filtered.filter(r => r.term.toLowerCase() === filters.term?.toLowerCase());
      }
      if (filters?.child_id) {
        filtered = filtered.filter(r => r.child_id === filters.child_id);
      }
      if (filters?.department_id && filters.department_id !== 'all') {
        filtered = filtered.filter(r => r.department_id === filters.department_id);
      }
      if (filters?.fund_id && filters.fund_id !== 'all') {
        filtered = filtered.filter(r => r.fund_id === filters.fund_id);
      }
      if (filters?.start_date) {
        filtered = filtered.filter(r => r.payment_date >= filters.start_date!);
      }
      if (filters?.end_date) {
        filtered = filtered.filter(r => r.payment_date <= filters.end_date!);
      }

      return filtered.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
    } catch (err) {
      console.error('Error fetching unified fee records:', err);
      return [];
    }
  }

  /**
   * Delete / Void a school fee payment and its linked General Ledger journal entry
   */
  static async voidFeePayment(paymentId: string, journalEntryId?: string): Promise<boolean> {
    try {
      if (journalEntryId) {
        await AccountingService.deleteJournalEntry(journalEntryId);
      }
      const res = await ApiService.delete('school_fee_payments', paymentId);
      return res.success;
    } catch (error) {
      console.error('Error voiding school fee payment:', error);
      return false;
    }
  }

  /**
   * Record a School Fee Payment (Guardian Inflow or Donor-Sponsored Inflow):
   * 1. Creates proper double-entry Journal Entry (Debit Equity Bank, Credit School Fees Revenue)
   * 2. Persists payment in school_fee_payments
   */
  static async recordFeePayment(
    payload: RecordFeePaymentPayload,
    context: {
      child: Child;
      equityBank: Account;
      empowerDept?: Department | null;
      revenueAccount?: Account | null;
      receiptNumber?: string;
    }
  ): Promise<{ success: boolean; payment?: SchoolFeePayment; journal_entry?: JournalEntry; error?: string }> {
    try {
      const amt = Number(payload.amount);
      if (isNaN(amt) || amt <= 0) {
        return { success: false, error: 'Payment amount must be greater than 0' };
      }

      const receiptNumber = context.receiptNumber || `RCP-${Date.now().toString().slice(-6)}`;
      const guardianName = context.child.guardian?.name || 'Guardian';
      const studentName = `${context.child.first_name} ${context.child.last_name}`;
      const payerType = payload.payer_type || 'guardian';
      const payerName = payload.payer_name || (payerType === 'donor' ? 'Donor Sponsor' : guardianName);
      const payerTag = payerType === 'donor' ? `(Donor Sponsored by ${payerName})` : `(Guardian Inflow)`;

      // 1. Post to General Ledger (Double-Entry Posting)
      const debitAccount = context.equityBank;
      const creditAccount = context.revenueAccount;

      let journalEntryId: string | undefined = undefined;

      if (debitAccount && creditAccount) {
        const description = `School Fee Payment ${payerTag} - ${payload.term} ${payload.academic_year}: ${studentName} (${context.child.code}) - ${receiptNumber}`;
        const refText = payload.reference_number ? `Ref: ${payload.reference_number}` : `Method: ${payload.payment_method.toUpperCase()}`;

        const lines = [
          {
            account_id: debitAccount.id,
            description: `Tuition received into ${debitAccount.name} from ${payerName} for ${studentName} (${payload.term} ${payload.academic_year}) - ${refText}`,
            debit_amount: amt,
            credit_amount: 0,
            child_id: payload.child_id,
            department_id: payload.department_id || context.empowerDept?.id,
            fund_id: payload.fund_id
          },
          {
            account_id: creditAccount.id,
            description: `School fee revenue recognized for ${studentName} (${context.child.code}) - ${payload.term} ${payload.academic_year}`,
            debit_amount: 0,
            credit_amount: amt,
            child_id: payload.child_id,
            department_id: payload.department_id || context.empowerDept?.id,
            fund_id: payload.fund_id
          }
        ];

        const jEntry = await AccountingService.createJournalEntry({
          entry_date: payload.payment_date,
          description: description + (payload.notes ? ` - ${payload.notes}` : ''),
          reference: receiptNumber,
          is_posted: true,
          lines
        });

        if (jEntry) {
          journalEntryId = jEntry.id;
        }
      }

      // 2. Persist in school_fee_payments table
      const paymentRecord: Partial<SchoolFeePayment> = {
        receipt_number: receiptNumber,
        child_id: payload.child_id,
        academic_year: payload.academic_year,
        term: payload.term,
        amount: amt,
        payment_date: payload.payment_date,
        payment_method: payload.payment_method,
        reference_number: payload.reference_number || undefined,
        bank_account_id: payload.bank_account_id || context.equityBank?.id,
        department_id: payload.department_id || context.empowerDept?.id,
        fund_id: payload.fund_id,
        journal_entry_id: journalEntryId,
        notes: payload.notes ? `${payload.notes} [Payer: ${payerName}]` : `Payer: ${payerName}`,
        payer_type: payerType,
        payer_name: payerName,
        donor_id: payload.donor_id
      };

      const res = await ApiService.create<SchoolFeePayment>('school_fee_payments', paymentRecord);
      if (!res.success || !res.data) {
        return { success: false, error: res.error || 'Failed to save fee payment' };
      }

      return {
        success: true,
        payment: res.data
      };
    } catch (err: any) {
      console.error('recordFeePayment error:', err);
      return { success: false, error: err.message || 'Error recording school fee payment' };
    }
  }

  /**
   * Calculate 3-Term Fee Accounting and Carry-Forward Balances for a Child in an Academic Year:
   * Term 1: Opening Balance = 0, Expected = E1, Paid = P1, Closing = (E1 - P1)
   * Term 2: Opening Balance = Closing Term 1 (overpayment carries as credit; arrears carry forward!)
   * Term 3: Opening Balance = Closing Term 2
   */
  static calculateChildFeeSummary(
    child: Child,
    year: number,
    structures: SchoolFeeStructure[],
    allPayments: SchoolFeePayment[]
  ): StudentFeeYearSummary {
    const childPayments = allPayments.filter(p => {
      if (p.child_id !== child.id) return false;
      if (!year || Number(year) === 0) return true;
      const pYear = Number(p.academic_year || (p.payment_date ? new Date(p.payment_date).getFullYear() : 2026));
      return pYear === Number(year);
    });

    const getExpectedForTerm = (term: 'Term 1' | 'Term 2' | 'Term 3'): number => {
      if (child.expected_term_fee && Number(child.expected_term_fee) > 0) {
        return Number(child.expected_term_fee);
      }
      const classMatch = structures.find(
        s => (Number(year) === 0 || Number(s.academic_year) === Number(year)) && s.term === term && s.class_name && s.class_name.toLowerCase() === (child.class_name || '').toLowerCase()
      );
      if (classMatch) return Number(classMatch.amount);

      const allMatch = structures.find(
        s => (Number(year) === 0 || Number(s.academic_year) === Number(year)) && s.term === term && (!s.class_name || s.class_name === 'All')
      );
      if (allMatch) return Number(allMatch.amount);

      if (child.expected_annual_fee && Number(child.expected_annual_fee) > 0) {
        return Math.round(Number(child.expected_annual_fee) / 3);
      }

      return 15000;
    };

    const isTermMatch = (pTerm: string, targetTerm: 'Term 1' | 'Term 2' | 'Term 3', pDate?: string): boolean => {
      if (!pTerm) {
        if (pDate) {
          const month = new Date(pDate).getMonth() + 1;
          if (month >= 1 && month <= 4) return targetTerm === 'Term 1';
          if (month >= 5 && month <= 8) return targetTerm === 'Term 2';
          if (month >= 9 && month <= 12) return targetTerm === 'Term 3';
        }
        return targetTerm === 'Term 2';
      }
      const normP = pTerm.toLowerCase().replace(/\s+/g, '');
      const normT = targetTerm.toLowerCase().replace(/\s+/g, '');
      if (normP === normT) return true;
      if (normP.includes('1') && normT.includes('1')) return true;
      if (normP.includes('2') && normT.includes('2')) return true;
      if (normP.includes('3') && normT.includes('3')) return true;
      return false;
    };

    // TERM 1
    const t1Expected = getExpectedForTerm('Term 1');
    const t1Opening = 0;
    const t1TotalBilled = t1Opening + t1Expected;
    let runningT1Bal = t1TotalBilled;

    const t1Payments = childPayments
      .filter(p => isTermMatch(p.term, 'Term 1', p.payment_date))
      .sort((a, b) => new Date(a.payment_date || '').getTime() - new Date(b.payment_date || '').getTime())
      .map(p => {
        const amt = Number(p.amount || 0);
        const before = runningT1Bal;
        if (p.is_inflow !== false) {
          runningT1Bal -= amt;
        }
        return {
          ...p,
          term_expected_fee: t1Expected,
          term_total_billed: t1TotalBilled,
          balance_before_payment: before,
          balance_after_payment: runningT1Bal
        };
      });

    const t1Paid = t1Payments.filter(p => p.is_inflow !== false).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const t1Closing = runningT1Bal;

    const getTermStatus = (expected: number, paid: number, closing: number): 'paid' | 'partial' | 'unpaid' | 'overpaid' => {
      if (closing < 0) return 'overpaid';
      if (closing === 0) return 'paid';
      if (paid > 0) return 'partial';
      return 'unpaid';
    };

    const term1: StudentFeeTermSummary = {
      term: 'Term 1',
      opening_balance: t1Opening,
      expected_fee: t1Expected,
      total_billed: t1TotalBilled,
      paid_amount: t1Paid,
      closing_balance: t1Closing,
      status: getTermStatus(t1Expected, t1Paid, t1Closing),
      payments: t1Payments
    };

    // TERM 2 (Carries Forward Closing of Term 1)
    const t2Opening = t1Closing;
    const t2Expected = getExpectedForTerm('Term 2');
    const t2TotalBilled = t2Opening + t2Expected;
    let runningT2Bal = t2TotalBilled;

    const t2Payments = childPayments
      .filter(p => isTermMatch(p.term, 'Term 2', p.payment_date))
      .sort((a, b) => new Date(a.payment_date || '').getTime() - new Date(b.payment_date || '').getTime())
      .map(p => {
        const amt = Number(p.amount || 0);
        const before = runningT2Bal;
        if (p.is_inflow !== false) {
          runningT2Bal -= amt;
        }
        return {
          ...p,
          term_expected_fee: t2Expected,
          term_total_billed: t2TotalBilled,
          balance_before_payment: before,
          balance_after_payment: runningT2Bal
        };
      });

    const t2Paid = t2Payments.filter(p => p.is_inflow !== false).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const t2Closing = runningT2Bal;

    const term2: StudentFeeTermSummary = {
      term: 'Term 2',
      opening_balance: t2Opening,
      expected_fee: t2Expected,
      total_billed: t2TotalBilled,
      paid_amount: t2Paid,
      closing_balance: t2Closing,
      status: getTermStatus(t2Expected, t2Paid, t2Closing),
      payments: t2Payments
    };

    // TERM 3 (Carries Forward Closing of Term 2)
    const t3Opening = t2Closing;
    const t3Expected = getExpectedForTerm('Term 3');
    const t3TotalBilled = t3Opening + t3Expected;
    let runningT3Bal = t3TotalBilled;

    const t3Payments = childPayments
      .filter(p => isTermMatch(p.term, 'Term 3', p.payment_date))
      .sort((a, b) => new Date(a.payment_date || '').getTime() - new Date(b.payment_date || '').getTime())
      .map(p => {
        const amt = Number(p.amount || 0);
        const before = runningT3Bal;
        if (p.is_inflow !== false) {
          runningT3Bal -= amt;
        }
        return {
          ...p,
          term_expected_fee: t3Expected,
          term_total_billed: t3TotalBilled,
          balance_before_payment: before,
          balance_after_payment: runningT3Bal
        };
      });

    const t3Paid = t3Payments.filter(p => p.is_inflow !== false).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const t3Closing = runningT3Bal;

    const term3: StudentFeeTermSummary = {
      term: 'Term 3',
      opening_balance: t3Opening,
      expected_fee: t3Expected,
      total_billed: t3TotalBilled,
      paid_amount: t3Paid,
      closing_balance: t3Closing,
      status: getTermStatus(t3Expected, t3Paid, t3Closing),
      payments: t3Payments
    };

    const totalExpected = t1Expected + t2Expected + t3Expected;
    const totalPaid = t1Paid + t2Paid + t3Paid;
    const netBalance = t3Closing;

    let overallStatus: 'paid' | 'partial' | 'unpaid' | 'overpaid' = 'unpaid';
    if (netBalance < 0) {
      overallStatus = 'overpaid';
    } else if (netBalance === 0) {
      overallStatus = 'paid';
    } else if (totalPaid > 0) {
      overallStatus = 'partial';
    }

    return {
      child_id: child.id,
      academic_year: year,
      child,
      terms: {
        term1,
        term2,
        term3
      },
      total_expected: totalExpected,
      total_paid: totalPaid,
      net_balance: netBalance,
      status: overallStatus
    };
  }

  /**
   * Calculate summaries across all students
   */
  static calculateAllStudentsFeeSummaries(
    children: Child[],
    year: number,
    structures: SchoolFeeStructure[],
    payments: SchoolFeePayment[]
  ): StudentFeeYearSummary[] {
    return children.map(child => this.calculateChildFeeSummary(child, year, structures, payments));
  }

  /**
   * Export individual student fee statement as CSV
   */
  static exportStudentFeeStatementCsv(summary: StudentFeeYearSummary, currency: string = 'KSh') {
    const child = summary.child;
    const guardian = child.guardian;
    const rows: string[][] = [
      [`OFFICIAL STUDENT FEE STATEMENT & PAYMENT LEDGER`],
      [`Academic Year: ${summary.academic_year}`],
      [`Student Name: ${child.first_name} ${child.last_name}`],
      [`Student Code: ${child.code || 'N/A'}`],
      [`Class / Grade: ${child.class_name || 'N/A'}`],
      [`Guardian: ${guardian?.name || 'N/A'} (${guardian?.phone || 'No phone'})`],
      [`Statement Generated: ${new Date().toLocaleString()}`],
      [],
      [`3-TERM FEE ACCOUNTING SUMMARY`],
      [`Term`, `Opening Balance (BF)`, `Expected Fee`, `Total Billed`, `Paid to Date`, `Closing Balance (CF)`, `Term Status`],
      [
        `Term 1`,
        summary.terms.term1.opening_balance.toFixed(2),
        summary.terms.term1.expected_fee.toFixed(2),
        summary.terms.term1.total_billed.toFixed(2),
        summary.terms.term1.paid_amount.toFixed(2),
        summary.terms.term1.closing_balance.toFixed(2),
        summary.terms.term1.status.toUpperCase()
      ],
      [
        `Term 2`,
        summary.terms.term2.opening_balance.toFixed(2),
        summary.terms.term2.expected_fee.toFixed(2),
        summary.terms.term2.total_billed.toFixed(2),
        summary.terms.term2.paid_amount.toFixed(2),
        summary.terms.term2.closing_balance.toFixed(2),
        summary.terms.term2.status.toUpperCase()
      ],
      [
        `Term 3`,
        summary.terms.term3.opening_balance.toFixed(2),
        summary.terms.term3.expected_fee.toFixed(2),
        summary.terms.term3.total_billed.toFixed(2),
        summary.terms.term3.paid_amount.toFixed(2),
        summary.terms.term3.closing_balance.toFixed(2),
        summary.terms.term3.status.toUpperCase()
      ],
      [
        `ANNUAL TOTAL`,
        `-`,
        summary.total_expected.toFixed(2),
        `-`,
        summary.total_paid.toFixed(2),
        summary.net_balance.toFixed(2),
        summary.status.toUpperCase()
      ],
      [],
      [`ITEMIZED PAYMENT TRANSACTIONS & BALANCE REDUCTION LEDGER`],
      [`Term`, `Date Paid`, `Payment Ref No`, `Receipt No`, `Method`, `Payer`, `Starting Balance (${currency})`, `Amount Paid (${currency})`, `Balance Remaining (${currency})`, `Notes`]
    ];

    const terms = [summary.terms.term1, summary.terms.term2, summary.terms.term3];
    terms.forEach(t => {
      if (t.payments.length === 0) {
        rows.push([
          t.term,
          `-`,
          `-`,
          `-`,
          `-`,
          `-`,
          t.total_billed.toFixed(2),
          `0.00`,
          t.closing_balance.toFixed(2),
          `No payments received. Balance outstanding: ${currency} ${t.closing_balance.toFixed(2)}`
        ]);
      } else {
        t.payments.forEach(p => {
          rows.push([
            t.term,
            p.payment_date ? String(p.payment_date).slice(0, 10) : '',
            p.reference_number || 'N/A',
            p.receipt_number,
            (p.payment_method || '').toUpperCase(),
            p.payer_name || (p.payer_type === 'donor' ? 'Donor Sponsor' : (guardian?.name || 'Guardian')),
            (p.balance_before_payment ?? t.total_billed).toFixed(2),
            Number(p.amount || 0).toFixed(2),
            (p.balance_after_payment ?? (t.total_billed - Number(p.amount || 0))).toFixed(2),
            `"${(p.notes || '').replace(/"/g, '""')}"`
          ]);
        });
      }
    });

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Fee_Statement_${child.code || child.id}_${summary.academic_year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Format and print official printable student fee statement
   */
  static printStudentFeeStatement(summary: StudentFeeYearSummary, businessSettings: any) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const bName = businessSettings?.business_name || 'EMPOWER SCHOOL';
    const bAddress = businessSettings?.business_address || 'P.O. Box Nairobi, Kenya';
    const bPhone = businessSettings?.business_phone || '+254 700 000000';
    const bEmail = businessSettings?.business_email || 'finance@empowerschool.org';
    const logoUrl = businessSettings?.logo_url || businessSettings?.logo || '';
    const currency = businessSettings?.default_currency || 'KSh';

    const child = summary.child;
    const guardian = child.guardian;
    const allStudentPayments = [
      ...summary.terms.term1.payments,
      ...summary.terms.term2.payments,
      ...summary.terms.term3.payments
    ].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());

    const renderTermLedgerHtml = (t: StudentFeeTermSummary) => {
      if (t.payments.length === 0) {
        return `
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 14px; text-align: center; color: #64748b; font-size: 11px; page-break-inside: avoid; break-inside: avoid;">
            No payments recorded for ${t.term}. Full term fee of <strong>${currency} ${t.total_billed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> remains outstanding.
          </div>
        `;
      }

      return `
        <table style="margin-bottom: 16px;">
          <thead>
            <tr>
              <th style="width: 14%;">Date Paid</th>
              <th style="width: 18%;">Payment Ref No.</th>
              <th style="width: 14%;">Receipt No.</th>
              <th style="width: 10%;">Method</th>
              <th style="width: 16%;">Payer / Source</th>
              <th style="width: 14%; text-align: right;">Amount Paid</th>
              <th style="width: 14%; text-align: right;">Remaining Fee</th>
            </tr>
          </thead>
          <tbody>
            ${t.payments.map(p => {
              const beforeBal = p.balance_before_payment ?? t.total_billed;
              const afterBal = p.balance_after_payment ?? (beforeBal - Number(p.amount || 0));
              const refNo = p.reference_number || '-';
              return `
                <tr>
                  <td>${new Date(p.payment_date).toLocaleDateString()}</td>
                  <td>
                    <span class="font-mono" style="font-weight: 700; color: #4338ca; background: #eef2ff; padding: 2px 6px; border-radius: 4px; font-size: 10.5px;">
                      ${refNo}
                    </span>
                  </td>
                  <td class="font-mono">${p.receipt_number}</td>
                  <td style="text-transform: uppercase; font-size: 10px;">${p.payment_method}</td>
                  <td>${p.payer_name || (p.payer_type === 'donor' ? 'Donor Sponsor' : (guardian?.name || 'Guardian'))}</td>
                  <td class="text-right font-mono" style="font-weight: 700; color: #059669;">
                    ${currency} ${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td class="text-right font-mono" style="font-weight: 800; color: ${afterBal > 0 ? '#b91c1c' : (afterBal < 0 ? '#4338ca' : '#059669')};">
                    ${afterBal < 0 
                      ? `(${currency} ${Math.abs(afterBal).toLocaleString(undefined, { minimumFractionDigits: 2 })}) Cr`
                      : (afterBal === 0 ? '✓ Cleared' : `${currency} ${afterBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
                    }
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 700; font-size: 10.5px;">
              <td colspan="5">Total Paid for ${t.term} (Billed: ${currency} ${t.total_billed.toLocaleString(undefined, { minimumFractionDigits: 2 })})</td>
              <td class="text-right font-mono" style="color: #059669;">${currency} ${t.paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td class="text-right font-mono" style="font-weight: 800; color: ${t.closing_balance > 0 ? '#b91c1c' : (t.closing_balance < 0 ? '#4338ca' : '#059669')};">
                ${t.closing_balance < 0 ? `(${currency} ${Math.abs(t.closing_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}) Cr` : (t.closing_balance === 0 ? 'Cleared' : `${currency} ${t.closing_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} Due`)}
              </td>
            </tr>
          </tfoot>
        </table>
      `;
    };

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Student Fee Statement - ${child.first_name} ${child.last_name} (${summary.academic_year})</title>
        <meta charset="utf-8" />
        <style>
          ${getReportPrintStyles('portrait')}

          .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid; }
          .card-info { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; page-break-inside: avoid; break-inside: avoid; }
          .card-info h4 { margin: 0 0 8px 0; font-size: 10.5px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; }
          .info-label { color: #64748b; font-weight: 500; }
          .info-value { font-weight: 700; color: #0f172a; }

          .term-table th { background: #eef2ff; color: #3730a3; }
          .term-section-header { 
            background: #f1f5f9; 
            border-left: 4px solid #4f46e5; 
            padding: 8px 12px; 
            margin: 18px 0 8px 0; 
            border-radius: 0 6px 6px 0; 
            font-size: 11.5px; 
            font-weight: 700; 
            color: #1e1b4b; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .standing-box { 
            padding: 14px 18px; 
            border-radius: 12px; 
            margin: 18px 0; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .standing-box.arrears { background: #fef2f2; border: 1px solid #fecaca; }
          .standing-box.credit { background: #f0fdf4; border: 1px solid #bbf7d0; }
          .standing-box.cleared { background: #f0fdfa; border: 1px solid #99f6e4; }

          .footer-section { 
            margin-top: 30px; 
            padding-top: 16px; 
            border-top: 1px solid #e2e8f0; 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            font-size: 10px; 
            color: #64748b; 
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .signature-line { margin-top: 45px; border-top: 1px dashed #94a3b8; width: 80%; }
        </style>
      </head>
      <body>
        ${getReportWatermarkHtml(logoUrl, bName)}

        <div class="report-document-body">
          <div class="report-header">
            <div class="org-brand">
              ${logoUrl ? `<img src="${logoUrl}" class="org-logo" alt="${bName}" />` : ''}
              <div>
                <div class="org-name">${bName}</div>
                <div class="org-contact">Department of Education & Child Support &bull; ${bAddress} &bull; Tel: ${bPhone}</div>
                <div class="org-contact">${bEmail}</div>
              </div>
            </div>
            <div class="report-meta">
              <div class="report-title">Student Fee Statement</div>
              <div class="report-cycle">Academic Year: ${summary.academic_year}</div>
              <div class="report-badge font-mono">${child.code}</div>
            </div>
          </div>

          <div class="grid-info">
            <div class="card-info">
              <h4>Student Beneficiary Details</h4>
              <div class="info-row"><span class="info-label">Full Name:</span><span class="info-value">${child.first_name} ${child.last_name}</span></div>
              <div class="info-row"><span class="info-label">Student Code:</span><span class="info-value font-mono">${child.code}</span></div>
              <div class="info-row"><span class="info-label">Class / Grade:</span><span class="info-value">${child.class_name || 'N/A'}</span></div>
              <div class="info-row"><span class="info-label">Enrollment Status:</span><span class="info-value" style="text-transform: uppercase;">${child.status}</span></div>
            </div>

            <div class="card-info">
              <h4>Guardian & Statement Metadata</h4>
              <div class="info-row"><span class="info-label">Guardian Name:</span><span class="info-value">${guardian?.name || 'N/A'}</span></div>
              <div class="info-row"><span class="info-label">Relationship:</span><span class="info-value">${guardian?.relationship || 'Parent'}</span></div>
              <div class="info-row"><span class="info-label">Phone:</span><span class="info-value">${guardian?.phone || 'N/A'}</span></div>
              <div class="info-row"><span class="info-label">Statement Date:</span><span class="info-value">${new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
            </div>
          </div>

          <h3 class="section-title">1. 3-Term Fee Accounting Schedule (${summary.academic_year})</h3>
          <table class="term-table">
            <thead>
              <tr>
                <th>Term</th>
                <th class="text-right">Opening BF</th>
                <th class="text-right">Expected Fee</th>
                <th class="text-right">Total Billed</th>
                <th class="text-right">Paid to Date</th>
                <th class="text-right">Closing CF</th>
                <th class="text-center">Term Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Term 1</strong></td>
                <td class="text-right font-mono">${currency} ${summary.terms.term1.opening_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right font-mono">${currency} ${summary.terms.term1.expected_fee.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right font-mono">${currency} ${summary.terms.term1.total_billed.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right font-mono" style="color: #059669; font-weight: 700;">${currency} ${summary.terms.term1.paid_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right font-mono" style="font-weight: 700; color: ${summary.terms.term1.closing_balance > 0 ? '#b91c1c' : (summary.terms.term1.closing_balance < 0 ? '#4338ca' : '#059669')};">
                  ${summary.terms.term1.closing_balance < 0 ? `(${currency} ${Math.abs(summary.terms.term1.closing_balance).toLocaleString(undefined, {minimumFractionDigits: 2})}) Credit` : `${currency} ${summary.terms.term1.closing_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
                </td>
                <td class="text-center"><span style="text-transform: uppercase; font-size: 10px; font-weight: 700;">${summary.terms.term1.status}</span></td>
              </tr>
              <tr>
                <td><strong>Term 2</strong></td>
                <td class="text-right font-mono">${currency} ${summary.terms.term2.opening_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right font-mono">${currency} ${summary.terms.term2.expected_fee.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right font-mono">${currency} ${summary.terms.term2.total_billed.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right font-mono" style="color: #059669; font-weight: 700;">${currency} ${summary.terms.term2.paid_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right font-mono" style="font-weight: 700; color: ${summary.terms.term2.closing_balance > 0 ? '#b91c1c' : (summary.terms.term2.closing_balance < 0 ? '#4338ca' : '#059669')};">
                  ${summary.terms.term2.closing_balance < 0 ? `(${currency} ${Math.abs(summary.terms.term2.closing_balance).toLocaleString(undefined, {minimumFractionDigits: 2})}) Credit` : `${currency} ${summary.terms.term2.closing_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
                </td>
                <td class="text-center"><span style="text-transform: uppercase; font-size: 10px; font-weight: 700;">${summary.terms.term2.status}</span></td>
              </tr>
              <tr>
                <td><strong>Term 3</strong></td>
                <td class="text-right font-mono">${currency} ${summary.terms.term3.opening_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right font-mono">${currency} ${summary.terms.term3.expected_fee.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right font-mono">${currency} ${summary.terms.term3.total_billed.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right font-mono" style="color: #059669; font-weight: 700;">${currency} ${summary.terms.term3.paid_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right font-mono" style="font-weight: 700; color: ${summary.terms.term3.closing_balance > 0 ? '#b91c1c' : (summary.terms.term3.closing_balance < 0 ? '#4338ca' : '#059669')};">
                  ${summary.terms.term3.closing_balance < 0 ? `(${currency} ${Math.abs(summary.terms.term3.closing_balance).toLocaleString(undefined, {minimumFractionDigits: 2})}) Credit` : `${currency} ${summary.terms.term3.closing_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
                </td>
                <td class="text-center"><span style="text-transform: uppercase; font-size: 10px; font-weight: 700;">${summary.terms.term3.status}</span></td>
              </tr>
              <tr class="total-row">
                <td><strong>ANNUAL TOTALS</strong></td>
                <td class="text-right font-mono">-</td>
                <td class="text-right font-mono"><strong>${currency} ${summary.total_expected.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></td>
                <td class="text-right font-mono">-</td>
                <td class="text-right font-mono" style="color: #059669;"><strong>${currency} ${summary.total_paid.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></td>
                <td class="text-right font-mono" style="font-size: 12px; color: ${summary.net_balance > 0 ? '#b91c1c' : (summary.net_balance < 0 ? '#4338ca' : '#059669')};">
                  <strong>${summary.net_balance < 0 ? `(${currency} ${Math.abs(summary.net_balance).toLocaleString(undefined, {minimumFractionDigits: 2})}) Credit` : `${currency} ${summary.net_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`}</strong>
                </td>
                <td class="text-center"><strong style="text-transform: uppercase; font-size: 10.5px;">${summary.status}</strong></td>
              </tr>
            </tbody>
          </table>

          <!-- Standing summary box -->
          <div class="standing-box ${summary.net_balance > 0 ? 'arrears' : (summary.net_balance < 0 ? 'credit' : 'cleared')}">
            <div>
              <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b;">Annual Outstanding Standing</div>
              <div style="font-size: 15px; font-weight: 800; color: ${summary.net_balance > 0 ? '#991b1b' : (summary.net_balance < 0 ? '#3730a3' : '#065f46')};">
                ${summary.net_balance > 0 
                  ? `OUTSTANDING ARREARS: ${currency} ${summary.net_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}` 
                  : (summary.net_balance < 0 ? `ADVANCE OVERPAYMENT CREDIT: ${currency} ${Math.abs(summary.net_balance).toLocaleString(undefined, {minimumFractionDigits: 2})} CARRIED FORWARD` : 'FEES FULLY SETTLED FOR THE ACADEMIC YEAR')}
              </div>
            </div>
            <div style="text-align: right; font-size: 10.5px; color: #64748b;">
              Financial Audit Ledger &bull; <strong>${bName}</strong>
            </div>
          </div>

          <h3 class="section-title">2. Term-by-Term Payments &amp; Balance Reduction Ledger</h3>
          <p style="font-size: 10.5px; color: #64748b; margin-bottom: 12px;">
            Chronological breakdown of payments showing date received, payment reference number, and sequential reduction against the expected term fee.
          </p>

          <!-- Term 1 Ledger -->
          <div class="term-section-header">
            <span>TERM 1 LEDGER &bull; Expected Fee: ${currency} ${summary.terms.term1.expected_fee.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Opening BF: ${currency} ${summary.terms.term1.opening_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
            <span>Status: ${summary.terms.term1.status.toUpperCase()}</span>
          </div>
          ${renderTermLedgerHtml(summary.terms.term1)}

          <!-- Term 2 Ledger -->
          <div class="term-section-header">
            <span>TERM 2 LEDGER &bull; Expected Fee: ${currency} ${summary.terms.term2.expected_fee.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Carried Forward BF: ${currency} ${summary.terms.term2.opening_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
            <span>Status: ${summary.terms.term2.status.toUpperCase()}</span>
          </div>
          ${renderTermLedgerHtml(summary.terms.term2)}

          <!-- Term 3 Ledger -->
          <div class="term-section-header">
            <span>TERM 3 LEDGER &bull; Expected Fee: ${currency} ${summary.terms.term3.expected_fee.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Carried Forward BF: ${currency} ${summary.terms.term3.opening_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
            <span>Status: ${summary.terms.term3.status.toUpperCase()}</span>
          </div>
          ${renderTermLedgerHtml(summary.terms.term3)}

          <h3 class="section-title">3. Annual Payment Receipts &amp; Reference Register</h3>
          <table>
            <thead>
              <tr>
                <th>Date Paid</th>
                <th>Receipt No.</th>
                <th>Term</th>
                <th>Payment Ref No.</th>
                <th>Channel</th>
                <th>Payer</th>
                <th class="text-right">Amount Paid</th>
              </tr>
            </thead>
            <tbody>
              ${allStudentPayments.length === 0 ? `
                <tr><td colspan="7" class="text-center" style="color: #94a3b8; padding: 16px;">No payments recorded for this academic year yet.</td></tr>
              ` : allStudentPayments.map(p => `
                <tr>
                  <td>${new Date(p.payment_date).toLocaleDateString()}</td>
                  <td class="font-mono" style="font-weight: 600; color: #4338ca;">${p.receipt_number}</td>
                  <td>${p.term}</td>
                  <td>
                    <span class="font-mono" style="font-weight: 700; color: #047857; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; font-size: 10.5px;">
                      ${p.reference_number || '-'}
                    </span>
                  </td>
                  <td style="text-transform: uppercase; font-size: 10px;">${p.payment_method}</td>
                  <td>${p.payer_name || (p.payer_type === 'donor' ? 'Donor Sponsor' : (guardian?.name || 'Guardian'))}</td>
                  <td class="text-right font-mono" style="font-weight: 700; color: #059669;">${currency} ${Number(p.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer-section">
            <div>
              <div>Prepared by: <strong>Finance &amp; Accounts Department</strong></div>
              <div class="signature-line"></div>
              <div style="margin-top: 6px;">Authorized Signature &amp; Official Stamp</div>
            </div>
            <div style="text-align: right;">
              <div>${bName} &bull; Official Student Ledger</div>
              <div>Generated on: ${new Date().toLocaleString()}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }

  static printSchoolFeeReceipt(payment: SchoolFeePayment, summary: StudentFeeTermSummary | null, businessSettings: any) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const bName = businessSettings?.business_name || 'EMPOWER SCHOOL';
    const bAddress = businessSettings?.business_address || 'P.O. Box Nairobi, Kenya';
    const bPhone = businessSettings?.business_phone || '+254 700 000000';
    const logoUrl = businessSettings?.logo_url || businessSettings?.logo || '';
    const currency = businessSettings?.default_currency || 'KSh';

    const childName = payment.child ? `${payment.child.first_name} ${payment.child.last_name}` : 'Student';
    const childCode = payment.child?.code || '';
    const guardianName = payment.child?.guardian?.name || 'Guardian';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fee Receipt - ${payment.receipt_number}</title>
        <meta charset="utf-8" />
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            color: #1e293b; 
            line-height: 1.45; 
            font-size: 12px; 
            max-width: 580px; 
            margin: 0 auto; 
            background: #fff;
          }
          .receipt-card {
            border: 1.5px solid #cbd5e1;
            border-radius: 14px;
            padding: 22px;
            position: relative;
            background: #fff;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          .watermark-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            overflow: hidden;
            z-index: 0;
          }
          .watermark-image {
            max-width: 320px;
            max-height: 320px;
            width: 70%;
            opacity: 0.048;
            transform: rotate(-25deg);
            filter: grayscale(100%) contrast(120%);
          }
          .watermark-text {
            font-size: 38px;
            font-weight: 900;
            color: #0f172a;
            opacity: 0.04;
            transform: rotate(-25deg);
            text-transform: uppercase;
            letter-spacing: 4px;
          }
          .receipt-content {
            position: relative;
            z-index: 1;
          }
          .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 16px; }
          .logo { max-height: 52px; margin-bottom: 6px; }
          .school-name { font-size: 18px; font-weight: 800; color: #1e1b4b; text-transform: uppercase; letter-spacing: 0.5px; }
          .sub { font-size: 11px; color: #64748b; margin-top: 1px; }
          .badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 4px 14px; border-radius: 20px; font-weight: 800; font-size: 11px; margin-top: 8px; letter-spacing: 0.5px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11.5px; border-bottom: 1px dashed #f1f5f9; padding-bottom: 4px; }
          .label { color: #64748b; font-weight: 500; }
          .val { font-weight: 700; color: #0f172a; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, monospace; }
          .amount-box { background: #f8fafc; border: 2px solid #4f46e5; border-radius: 10px; padding: 12px; margin: 16px 0; text-align: center; }
          .amount-val { font-size: 24px; font-weight: 900; color: #4f46e5; letter-spacing: 0.5px; }
          .summary-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
          .summary-table td { padding: 6px 0; border-top: 1px solid #e2e8f0; }
          .footer { text-align: center; margin-top: 20px; font-size: 10.5px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          @media print {
            body { padding: 0; margin: 0; }
            .receipt-card { border: none; box-shadow: none; padding: 10px; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-card">
          ${getReportWatermarkHtml(logoUrl, bName)}

          <div class="receipt-content">
            <div class="header">
              ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : ''}
              <div class="school-name">${bName}</div>
              <div class="sub">Department of Education & Child Support</div>
              <div class="sub">${bAddress} &bull; ${bPhone}</div>
              <div class="badge">OFFICIAL SCHOOL FEE RECEIPT</div>
            </div>

            <div class="row"><span class="label">Receipt Number:</span><span class="val font-mono" style="color: #4338ca;">${payment.receipt_number}</span></div>
            <div class="row"><span class="label">Payment Date:</span><span class="val">${new Date(payment.payment_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
            <div class="row"><span class="label">Academic Period:</span><span class="val">${payment.term}, ${payment.academic_year}</span></div>
            <div class="row"><span class="label">Student Name:</span><span class="val">${childName} (${childCode})</span></div>
            <div class="row"><span class="label">Payer / Source:</span><span class="val">${payment.payer_name || (payment.payer_type === 'donor' ? 'Donor Sponsor' : guardianName)}</span></div>
            <div class="row"><span class="label">Payment Channel:</span><span class="val" style="text-transform: uppercase;">${payment.payment_method} ${payment.reference_number ? `(${payment.reference_number})` : ''}</span></div>
            <div class="row"><span class="label">Receiving Entity:</span><span class="val">${bName} Accounts Department</span></div>

            <div class="amount-box">
              <div style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Total Amount Received</div>
              <div class="amount-val">${currency} ${Number(payment.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              <div style="font-size: 10.5px; color: #059669; font-weight: 700; margin-top: 2px;">✓ Verified &amp; Posted to General Ledger</div>
            </div>

            ${summary ? `
              <table class="summary-table">
                <tr>
                  <td>${payment.term} Expected Fee:</td>
                  <td style="text-align: right; font-weight: 700;">${currency} ${summary.expected_fee.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
                <tr>
                  <td>Previous Balance / (Credit BF):</td>
                  <td style="text-align: right; font-weight: 700;">${currency} ${summary.opening_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
                <tr>
                  <td>Total Paid for ${payment.term}:</td>
                  <td style="text-align: right; font-weight: 700; color: #059669;">${currency} ${summary.paid_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
                <tr style="font-size: 12px; font-weight: 800; border-top: 2px solid #cbd5e1;">
                  <td>${payment.term} Remaining Standing:</td>
                  <td style="text-align: right; color: ${summary.closing_balance > 0 ? '#b91c1c' : (summary.closing_balance < 0 ? '#4338ca' : '#059669')};">
                    ${summary.closing_balance < 0 ? `(${currency} ${Math.abs(summary.closing_balance).toLocaleString(undefined, {minimumFractionDigits: 2})}) Overpaid Credit` : (summary.closing_balance > 0 ? `${currency} ${summary.closing_balance.toLocaleString(undefined, {minimumFractionDigits: 2})} Balance Due` : 'Fully Cleared')}
                  </td>
                </tr>
              </table>
            ` : ''}

            ${payment.notes ? `
              <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
                <strong>Note:</strong> ${payment.notes}
              </div>
            ` : ''}

            <div class="footer">
              <p>Official Computer Generated Payment Voucher</p>
              <p>${bName} Finance &bull; Printed: ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }
}
