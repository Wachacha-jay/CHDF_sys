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
  Department
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
    if (filters?.academic_year) apiFilters.academic_year = filters.academic_year;
    if (filters?.term && filters.term !== 'all') apiFilters.term = filters.term;

    const res = await ApiService.get<SchoolFeePayment>('school_fee_payments', {
      filters: apiFilters,
      orderBy: { column: 'payment_date', ascending: false }
    });
    return res.success ? (res.data || []) : [];
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
   * Record a Guardian School Fee Payment:
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

      // 1. Post to General Ledger (Double-Entry Posting)
      const debitAccount = context.equityBank;
      const creditAccount = context.revenueAccount;

      let journalEntryId: string | undefined = undefined;

      if (debitAccount && creditAccount) {
        const description = `School Fee Payment (Guardian Inflow) - ${payload.term} ${payload.academic_year}: ${studentName} (${context.child.code}) - ${receiptNumber}`;
        const refText = payload.reference_number ? `Ref: ${payload.reference_number}` : `Method: ${payload.payment_method.toUpperCase()}`;

        const lines = [
          {
            account_id: debitAccount.id,
            description: `Tuition received into ${debitAccount.name} from ${guardianName} for ${studentName} (${payload.term} ${payload.academic_year}) - ${refText}`,
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
        notes: payload.notes || undefined
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
    const childPayments = allPayments.filter(
      p => p.child_id === child.id && Number(p.academic_year) === Number(year)
    );

    const getExpectedForTerm = (term: 'Term 1' | 'Term 2' | 'Term 3'): number => {
      // 1. Child individual term fee if set
      if (child.expected_term_fee && Number(child.expected_term_fee) > 0) {
        return Number(child.expected_term_fee);
      }
      // 2. Match fee structure by year, term, and class (or 'All')
      const classMatch = structures.find(
        s => Number(s.academic_year) === Number(year) && s.term === term && s.class_name && s.class_name.toLowerCase() === (child.class_name || '').toLowerCase()
      );
      if (classMatch) return Number(classMatch.amount);

      const allMatch = structures.find(
        s => Number(s.academic_year) === Number(year) && s.term === term && (!s.class_name || s.class_name === 'All')
      );
      if (allMatch) return Number(allMatch.amount);

      // 3. Child annual fee divided by 3
      if (child.expected_annual_fee && Number(child.expected_annual_fee) > 0) {
        return Math.round(Number(child.expected_annual_fee) / 3);
      }

      // 4. Default fallback: 15,000 KSh per term
      return 15000;
    };

    // TERM 1
    const t1Expected = getExpectedForTerm('Term 1');
    const t1Payments = childPayments.filter(p => p.term === 'Term 1');
    const t1Paid = t1Payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const t1Opening = 0; // Starts clean for the year
    const t1TotalBilled = t1Opening + t1Expected;
    const t1Closing = t1TotalBilled - t1Paid; // positive = balance due, negative = credit/overpayment

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
    const t2Payments = childPayments.filter(p => p.term === 'Term 2');
    const t2Paid = t2Payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const t2TotalBilled = t2Opening + t2Expected;
    const t2Closing = t2TotalBilled - t2Paid;

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
    const t3Payments = childPayments.filter(p => p.term === 'Term 3');
    const t3Paid = t3Payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const t3TotalBilled = t3Opening + t3Expected;
    const t3Closing = t3TotalBilled - t3Paid;

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
    const netBalance = t3Closing; // Cumulative year standing

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
   * Format and print official printable student fee statement
   */
  static printStudentFeeStatement(summary: StudentFeeYearSummary, businessSettings: any) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const bName = businessSettings?.business_name || 'EMPOWER SCHOOL';
    const bAddress = businessSettings?.business_address || 'P.O. Box Nairobi, Kenya';
    const bPhone = businessSettings?.business_phone || '+254 700 000000';
    const bEmail = businessSettings?.business_email || 'finance@empowerschool.org';
    const logoUrl = businessSettings?.logo_url || '';
    const currency = businessSettings?.default_currency || 'KSh';

    const child = summary.child;
    const guardian = child.guardian;
    const allStudentPayments = [
      ...summary.terms.term1.payments,
      ...summary.terms.term2.payments,
      ...summary.terms.term3.payments
    ].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Student Fee Statement - ${child.first_name} ${child.last_name} (${summary.academic_year})</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; color: #1e293b; line-height: 1.5; font-size: 13px; }
          .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }
          .logo { max-height: 70px; margin-bottom: 8px; }
          .school-name { font-size: 22px; font-weight: 800; color: #1e1b4b; text-transform: uppercase; letter-spacing: 0.5px; }
          .school-dept { font-size: 14px; font-weight: 600; color: #4f46e5; margin-bottom: 4px; }
          .school-info { font-size: 12px; color: #64748b; }
          .title-badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 6px 18px; border-radius: 20px; font-weight: 700; font-size: 14px; margin-top: 12px; }
          
          .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
          .card-info { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; }
          .card-info h4 { margin: 0 0 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .info-label { color: #64748b; font-weight: 500; }
          .info-value { font-weight: 700; color: #0f172a; }

          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f1f5f9; color: #475569; font-weight: 700; font-size: 12px; text-transform: uppercase; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

          .term-table th { background: #eef2ff; color: #3730a3; }
          .total-row { background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1; }

          .standing-box { padding: 16px; border-radius: 12px; margin: 24px 0; display: flex; justify-content: space-between; align-items: center; }
          .standing-box.arrears { background: #fef2f2; border: 1px solid #fecaca; }
          .standing-box.credit { background: #f0fdf4; border: 1px solid #bbf7d0; }
          .standing-box.cleared { background: #f0fdfa; border: 1px solid #99f6e4; }
          
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; font-size: 11px; color: #64748b; }
          .signature-line { margin-top: 50px; border-top: 1px dashed #94a3b8; width: 80%; }

          @media print {
            body { margin: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo" />` : ''}
          <div class="school-name">${bName}</div>
          <div class="school-dept">Empower School • Department of Education & Child Support</div>
          <div class="school-info">${bAddress} • Tel: ${bPhone} • Email: ${bEmail}</div>
          <div class="title-badge">OFFICIAL STUDENT FEE STATEMENT — ${summary.academic_year}</div>
        </div>

        <div class="grid-info">
          <div class="card-info">
            <h4>Student Particulars</h4>
            <div class="info-row"><span class="info-label">Full Name:</span><span class="info-value">${child.first_name} ${child.last_name}</span></div>
            <div class="info-row"><span class="info-label">Student / Child Code:</span><span class="info-value font-mono">${child.code}</span></div>
            <div class="info-row"><span class="info-label">Grade / Class:</span><span class="info-value">${child.class_name || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">Status:</span><span class="info-value" style="text-transform: uppercase;">${child.status}</span></div>
          </div>

          <div class="card-info">
            <h4>Guardian & Account Details</h4>
            <div class="info-row"><span class="info-label">Guardian Name:</span><span class="info-value">${guardian?.name || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">Relationship:</span><span class="info-value">${guardian?.relationship || 'Parent'}</span></div>
            <div class="info-row"><span class="info-label">Phone:</span><span class="info-value">${guardian?.phone || 'N/A'}</span></div>
            <div class="info-row"><span class="info-label">Statement Date:</span><span class="info-value">${new Date().toLocaleDateString()}</span></div>
          </div>
        </div>

        <h3 style="font-size: 14px; color: #1e1b4b; margin-bottom: 8px;">1. 3-Term Fee Accounting Schedule (${summary.academic_year})</h3>
        <table class="term-table">
          <thead>
            <tr>
              <th>Term</th>
              <th class="text-right">Opening Balance (BF)</th>
              <th class="text-right">Term Expected Fee</th>
              <th class="text-right">Total Billed</th>
              <th class="text-right">Paid to Date</th>
              <th class="text-right">Closing Balance (CF)</th>
              <th class="text-center">Term Standing</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Term 1</strong></td>
              <td class="text-right font-mono">${currency} ${summary.terms.term1.opening_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td class="text-right font-mono">${currency} ${summary.terms.term1.expected_fee.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td class="text-right font-mono">${currency} ${summary.terms.term1.total_billed.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td class="text-right font-mono" style="color: #059669;">${currency} ${summary.terms.term1.paid_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td class="text-right font-mono" style="font-weight: 700; color: ${summary.terms.term1.closing_balance > 0 ? '#b91c1c' : (summary.terms.term1.closing_balance < 0 ? '#4338ca' : '#059669')};">
                ${summary.terms.term1.closing_balance < 0 ? `(${currency} ${Math.abs(summary.terms.term1.closing_balance).toLocaleString(undefined, {minimumFractionDigits: 2})}) Credit` : `${currency} ${summary.terms.term1.closing_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
              </td>
              <td class="text-center"><span style="text-transform: uppercase; font-size: 11px; font-weight: 700;">${summary.terms.term1.status}</span></td>
            </tr>
            <tr>
              <td><strong>Term 2</strong></td>
              <td class="text-right font-mono">${currency} ${summary.terms.term2.opening_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td class="text-right font-mono">${currency} ${summary.terms.term2.expected_fee.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td class="text-right font-mono">${currency} ${summary.terms.term2.total_billed.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td class="text-right font-mono" style="color: #059669;">${currency} ${summary.terms.term2.paid_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td class="text-right font-mono" style="font-weight: 700; color: ${summary.terms.term2.closing_balance > 0 ? '#b91c1c' : (summary.terms.term2.closing_balance < 0 ? '#4338ca' : '#059669')};">
                ${summary.terms.term2.closing_balance < 0 ? `(${currency} ${Math.abs(summary.terms.term2.closing_balance).toLocaleString(undefined, {minimumFractionDigits: 2})}) Credit` : `${currency} ${summary.terms.term2.closing_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
              </td>
              <td class="text-center"><span style="text-transform: uppercase; font-size: 11px; font-weight: 700;">${summary.terms.term2.status}</span></td>
            </tr>
            <tr>
              <td><strong>Term 3</strong></td>
              <td class="text-right font-mono">${currency} ${summary.terms.term3.opening_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td class="text-right font-mono">${currency} ${summary.terms.term3.expected_fee.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td class="text-right font-mono">${currency} ${summary.terms.term3.total_billed.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td class="text-right font-mono" style="color: #059669;">${currency} ${summary.terms.term3.paid_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td class="text-right font-mono" style="font-weight: 700; color: ${summary.terms.term3.closing_balance > 0 ? '#b91c1c' : (summary.terms.term3.closing_balance < 0 ? '#4338ca' : '#059669')};">
                ${summary.terms.term3.closing_balance < 0 ? `(${currency} ${Math.abs(summary.terms.term3.closing_balance).toLocaleString(undefined, {minimumFractionDigits: 2})}) Credit` : `${currency} ${summary.terms.term3.closing_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
              </td>
              <td class="text-center"><span style="text-transform: uppercase; font-size: 11px; font-weight: 700;">${summary.terms.term3.status}</span></td>
            </tr>
            <tr class="total-row">
              <td><strong>ANNUAL TOTALS</strong></td>
              <td class="text-right font-mono">-</td>
              <td class="text-right font-mono"><strong>${currency} ${summary.total_expected.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></td>
              <td class="text-right font-mono">-</td>
              <td class="text-right font-mono" style="color: #059669;"><strong>${currency} ${summary.total_paid.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></td>
              <td class="text-right font-mono" style="font-size: 14px; color: ${summary.net_balance > 0 ? '#b91c1c' : (summary.net_balance < 0 ? '#4338ca' : '#059669')};">
                <strong>${summary.net_balance < 0 ? `(${currency} ${Math.abs(summary.net_balance).toLocaleString(undefined, {minimumFractionDigits: 2})}) Credit` : `${currency} ${summary.net_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`}</strong>
              </td>
              <td class="text-center"><strong style="text-transform: uppercase; font-size: 12px;">${summary.status}</strong></td>
            </tr>
          </tbody>
        </table>

        <!-- Standing summary box -->
        <div class="standing-box ${summary.net_balance > 0 ? 'arrears' : (summary.net_balance < 0 ? 'credit' : 'cleared')}">
          <div>
            <div style="font-size: 12px; text-transform: uppercase; font-weight: 700; color: #64748b;">Current Fee Standing</div>
            <div style="font-size: 18px; font-weight: 800; color: ${summary.net_balance > 0 ? '#991b1b' : (summary.net_balance < 0 ? '#3730a3' : '#065f46')};">
              ${summary.net_balance > 0 ? `OUTSTANDING FEE ARREARS: ${currency} ${summary.net_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}` : (summary.net_balance < 0 ? `ADVANCE OVERPAYMENT CREDIT: ${currency} ${Math.abs(summary.net_balance).toLocaleString(undefined, {minimumFractionDigits: 2})} CARRIED FORWARD` : 'FEES FULLY PAID FOR THE YEAR')}
            </div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            All payments credited directly to<br/><strong>Equity Bank • Empower School Dept.</strong>
          </div>
        </div>

        <h3 style="font-size: 14px; color: #1e1b4b; margin-bottom: 8px;">2. Payment Receipts History</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Receipt No.</th>
              <th>Term</th>
              <th>Method</th>
              <th>Reference / Code</th>
              <th class="text-right">Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            ${allStudentPayments.length === 0 ? `
              <tr><td colspan="6" class="text-center" style="color: #94a3b8; padding: 20px;">No payments recorded for this academic year yet.</td></tr>
            ` : allStudentPayments.map(p => `
              <tr>
                <td>${new Date(p.payment_date).toLocaleDateString()}</td>
                <td class="font-mono" style="font-weight: 600; color: #4338ca;">${p.receipt_number}</td>
                <td>${p.term}</td>
                <td style="text-transform: uppercase;">${p.payment_method}</td>
                <td class="font-mono text-xs">${p.reference_number || '-'}</td>
                <td class="text-right font-mono" style="font-weight: 700; color: #059669;">${currency} ${Number(p.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>
            <div>Prepared by: <strong>School Finance Office</strong></div>
            <div class="signature-line"></div>
            <div style="margin-top: 6px;">Finance Officer Signature & Stamp</div>
          </div>
          <div style="text-align: right;">
            <div>Empower School — Empowering Every Child</div>
            <div>Generated on: ${new Date().toLocaleString()}</div>
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

  /**
   * Format and print official single payment receipt
   */
  static printSchoolFeeReceipt(payment: SchoolFeePayment, summary: StudentFeeTermSummary | null, businessSettings: any) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const bName = businessSettings?.business_name || 'EMPOWER SCHOOL';
    const bAddress = businessSettings?.business_address || 'P.O. Box Nairobi, Kenya';
    const bPhone = businessSettings?.business_phone || '+254 700 000000';
    const logoUrl = businessSettings?.logo_url || '';
    const currency = businessSettings?.default_currency || 'KSh';

    const childName = payment.child ? `${payment.child.first_name} ${payment.child.last_name}` : 'Student';
    const childCode = payment.child?.code || '';
    const guardianName = payment.child?.guardian?.name || 'Guardian';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${payment.receipt_number}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; color: #1e293b; line-height: 1.4; font-size: 13px; max-width: 550px; margin: 0 auto; padding: 20px; border: 1px dashed #cbd5e1; }
          .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 16px; }
          .logo { max-height: 55px; margin-bottom: 6px; }
          .school-name { font-size: 18px; font-weight: 800; color: #1e1b4b; text-transform: uppercase; }
          .sub { font-size: 12px; color: #64748b; }
          .badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 12px; font-weight: 700; font-size: 13px; margin-top: 8px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
          .label { color: #64748b; font-weight: 500; }
          .val { font-weight: 700; color: #0f172a; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, monospace; }
          .amount-box { background: #f8fafc; border: 2px solid #4f46e5; border-radius: 10px; padding: 12px; margin: 16px 0; text-align: center; }
          .amount-val { font-size: 24px; font-weight: 900; color: #4f46e5; }
          .summary-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          .summary-table td { padding: 6px 0; border-top: 1px solid #e2e8f0; }
          .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : ''}
          <div class="school-name">${bName}</div>
          <div class="sub">Empower School • Department of Education</div>
          <div class="sub">${bAddress} • ${bPhone}</div>
          <div class="badge">OFFICIAL SCHOOL FEE RECEIPT</div>
        </div>

        <div class="row"><span class="label">Receipt Number:</span><span class="val font-mono">${payment.receipt_number}</span></div>
        <div class="row"><span class="label">Date & Time:</span><span class="val">${new Date(payment.payment_date).toLocaleDateString()}</span></div>
        <div class="row"><span class="label">Academic Period:</span><span class="val">${payment.term}, ${payment.academic_year}</span></div>
        <div class="row"><span class="label">Student Name:</span><span class="val">${childName} (${childCode})</span></div>
        <div class="row"><span class="label">Payer (Guardian):</span><span class="val">${guardianName}</span></div>
        <div class="row"><span class="label">Payment Channel:</span><span class="val" style="text-transform: uppercase;">${payment.payment_method} ${payment.reference_number ? `(${payment.reference_number})` : ''}</span></div>
        <div class="row"><span class="label">Receiving Bank:</span><span class="val">Equity Bank</span></div>
        <div class="row"><span class="label">Department:</span><span class="val">Empower School</span></div>

        <div class="amount-box">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Amount Received</div>
          <div class="amount-val">${currency} ${Number(payment.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          <div style="font-size: 11px; color: #059669; font-weight: 600;">✓ Payment Posted to General Ledger</div>
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
            <tr style="font-size: 13px; font-weight: 800; border-top: 2px solid #cbd5e1;">
              <td>${payment.term} Remaining Standing:</td>
              <td style="text-align: right; color: ${summary.closing_balance > 0 ? '#b91c1c' : (summary.closing_balance < 0 ? '#4338ca' : '#059669')};">
                ${summary.closing_balance < 0 ? `(${currency} ${Math.abs(summary.closing_balance).toLocaleString(undefined, {minimumFractionDigits: 2})}) Overpaid Credit` : (summary.closing_balance > 0 ? `${currency} ${summary.closing_balance.toLocaleString(undefined, {minimumFractionDigits: 2})} Balance Due` : 'Fully Cleared')}
              </td>
            </tr>
          </table>
        ` : ''}

        ${payment.notes ? `
          <div style="margin-top: 10px; font-size: 12px; color: #64748b;">
            <strong>Note:</strong> ${payment.notes}
          </div>
        ` : ''}

        <div class="footer">
          <p>Thank you for supporting education.</p>
          <p>Generated by Empower School Finance System • ${new Date().toLocaleTimeString()}</p>
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
