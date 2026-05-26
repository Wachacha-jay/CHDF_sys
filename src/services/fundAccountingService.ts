import { ApiService } from './api';
import { 
  Department, 
  Donor, 
  Child, 
  FundAccount, 
  Donation, 
  InternalTransfer, 
  Sponsor,
  JournalEntryLine,
  JournalEntry,
  Sponsorship
} from '../types';
import { AccountingService } from './accountingService';

export class FundAccountingService {
  // Sponsorship Operations
  static async getSponsorships(): Promise<Sponsorship[]> {
    const response = await ApiService.get<Sponsorship>('sponsorships');
    return response.success ? (response.data || []) : [];
  }

  // Department Operations
  static async getDepartments(): Promise<Department[]> {
    const response = await ApiService.get<Department>('departments', {
      orderBy: { column: 'name', ascending: true }
    });
    return response.success ? (response.data || []) : [];
  }

  static async createDepartment(data: Partial<Department>): Promise<Department | null> {
    const response = await ApiService.create<Department>('departments', data);
    return response.success ? response.data : null;
  }

  // Donor Operations
  static async getDonors(): Promise<Donor[]> {
    const response = await ApiService.get<Donor>('donors', {
      orderBy: { column: 'name', ascending: true }
    });
    return response.success ? (response.data || []) : [];
  }

  static async createDonor(data: Partial<Donor>): Promise<Donor | null> {
    const response = await ApiService.create<Donor>('donors', data);
    return response.success ? response.data : null;
  }

  // Child Operations
  static async getChildren(): Promise<Child[]> {
    const response = await ApiService.get<Child>('children', {
      orderBy: { column: 'first_name', ascending: true }
    });
    return response.success ? (response.data || []) : [];
  }

  static async createChild(data: Partial<Child>): Promise<Child | null> {
    const response = await ApiService.post<Child>('children', data);
    return response.success ? response.data : null;
  }

  // Guardian Operations
  static async getGuardians(): Promise<Guardian[]> {
    const response = await ApiService.get<Guardian>('guardians', {
      orderBy: { column: 'name', ascending: true }
    });
    return response.success ? (response.data || []) : [];
  }

  static async createGuardian(data: Partial<Guardian>): Promise<Guardian | null> {
    const response = await ApiService.post<Guardian>('guardians', data);
    return response.success ? response.data : null;
  }

  static async getNextChildCode(): Promise<string> {
    const children = await this.getChildren();
    if (children.length === 0) return 'CHD-001';

    // Find the highest number in existing codes
    const codes = children
      .map(c => {
        const match = c.code.match(/CHD-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);

    const maxCode = codes.length > 0 ? Math.max(...codes) : 0;
    const nextNumber = maxCode + 1;
    return `CHD-${nextNumber.toString().padStart(3, '0')}`;
  }

  // Fund Account Operations
  static async getFundAccounts(): Promise<FundAccount[]> {
    const response = await ApiService.get<FundAccount>('fund_accounts', {
      orderBy: { column: 'code', ascending: true }
    });
    return response.success ? (response.data || []) : [];
  }

  static async createFundAccount(data: Partial<FundAccount>): Promise<FundAccount | null> {
    const response = await ApiService.create<FundAccount>('fund_accounts', data);
    return response.success ? response.data : null;
  }

  // Donation Operations
  static async recordDonation(donation: Partial<Donation>): Promise<Donation | null> {
    const response = await ApiService.create<Donation>('donations', donation);
    if (response.success && response.data) {
      // Post to GL
      await this.postDonationToLedger(response.data);
      return response.data;
    }
    return null;
  }

  private static async postDonationToLedger(donation: Donation): Promise<void> {
    const accounts = await AccountingService.getAccounts();
    const findAccount = (code: string) => {
      const flatten = (accs: any[]): any[] => {
        return accs.reduce((prev, curr) => {
          return prev.concat(curr).concat(curr.children ? flatten(curr.children) : []);
        }, []);
      };
      return flatten(accounts).find(a => a.code === code);
    };

    // 1110 = Cash (physical), 1111 = Bank / M-Pesa / Card
    const cashAccount    = findAccount('1110');
    const mpesaAccount   = findAccount('1111');
    // 4200 = NGO Donation Revenue — MUST be distinct from 4100 (Retail Sales Revenue)
    const donationRevenueAccount = findAccount('4200');

    if (!donationRevenueAccount) {
        console.error('Donation Revenue account 4200 not found. Please ensure NGO Chart of Accounts migration has been run.');
        return;
    }

    // Pick the correct asset account to debit based on payment method
    let debitAccount = cashAccount; // default: physical cash
    if (donation.payment_method === 'mpesa' || donation.payment_method === 'bank' || donation.payment_method === 'cheque') {
        debitAccount = mpesaAccount || cashAccount;
    }

    if (!debitAccount) {
        console.error('Cash / Bank account (1110 or 1111) not found for donation posting.');
        return;
    }

    // Build a human-readable donor label for the journal description
    const donorLabel = donation.donor_id ? `Donor #${donation.donor_id}` : 'Anonymous Donor';
    const restrictionNote = donation.restricted_to_child_id
        ? ` [Child-Restricted: ${donation.restricted_to_child_id}]`
        : donation.fund_id
            ? ` [Fund-Restricted]`
            : ' [Unrestricted]';

    await AccountingService.createJournalEntry({
      entry_date: donation.donation_date,
      description: `Donation from ${donorLabel}${restrictionNote}${donation.notes ? ' — ' + donation.notes : ''}`,
      reference: donation.reference_number || undefined,
      is_posted: true,
      lines: [
        // DR: Cash or Bank/M-Pesa
        {
          account_id: debitAccount.id,
          description: `Donation received via ${donation.payment_method || 'bank'}`,
          debit_amount: donation.amount,
          credit_amount: 0,
          donor_id: donation.donor_id,
          fund_id: donation.fund_id || undefined,
          child_id: donation.restricted_to_child_id || undefined
        },
        // CR: NGO Donation Revenue (4200) — never fallback to Sales Revenue (4100)
        {
          account_id: donationRevenueAccount.id,
          description: `Donation revenue recognised${restrictionNote}`,
          debit_amount: 0,
          credit_amount: donation.amount,
          donor_id: donation.donor_id,
          fund_id: donation.fund_id || undefined,
          child_id: donation.restricted_to_child_id || undefined
        }
      ]
    });
  }

  // Internal Transfers & Loans
  static async recordTransfer(transfer: Partial<InternalTransfer>): Promise<InternalTransfer | null> {
    const payload = { ...transfer, status: 'pending' };
    const response = await ApiService.create<InternalTransfer>('internal_transfers', payload);
    return response.success ? response.data : null;
  }

  static async approveTransfer(transferId: string, approverId: string): Promise<boolean> {
    const response = await ApiService.update<InternalTransfer>('internal_transfers', transferId, {
        status: 'approved',
        approved_by: approverId
    });
    
    if (response.success && response.data) {
        await this.postTransferToLedger(response.data);
        return true;
    }
    return false;
  }

  private static async postTransferToLedger(transfer: InternalTransfer): Promise<void> {
    const accounts = await AccountingService.getAccounts();
    const findAccount = (code: string) => {
        const flatten = (accs: any[]): any[] => {
          return accs.reduce((prev, curr) => {
            return prev.concat(curr).concat(curr.children ? flatten(curr.children) : []);
          }, []);
        };
        return flatten(accounts).find(a => a.code === code);
    };

    // 1111 = Bank/M-Pesa (primary liquid account for inter-dept movement)
    // Fall back to 1110 (Cash) if not found
    const bankAccount         = findAccount('1111') || findAccount('1110');
    const interDeptReceivable = findAccount('1300'); // Due From Other Departments
    const interDeptPayable    = findAccount('2300'); // Due To Other Departments
    const transferIn          = findAccount('4900'); // Transfer In
    const transferOut         = findAccount('5900'); // Transfer Out

    if (!bankAccount || !interDeptReceivable || !interDeptPayable || !transferIn || !transferOut) {
        console.error(
          'Inter-departmental G/L accounts missing. Expected: 1111/1110, 1300, 2300, 4900, 5900.'
        );
        return;
    }

    const lines: any[] = [];

    // @ts-ignore - access transfer_type which was added via migration
    const type = transfer.transfer_type || 'direct_transfer';

    if (type === 'direct_transfer') {
        // DR: Transfer Out (expense-side) in Source Dept
        // CR: Transfer In  (revenue-side) in Destination Dept
        // These two clearing accounts net to zero at the org level.
        lines.push(
            {
                account_id: transferOut.id,
                description: `Direct Transfer Out → ${transfer.to_department_id}`,
                debit_amount: transfer.amount,
                credit_amount: 0,
                department_id: transfer.from_department_id
            },
            {
                account_id: transferIn.id,
                description: `Direct Transfer In ← ${transfer.from_department_id}`,
                debit_amount: 0,
                credit_amount: transfer.amount,
                department_id: transfer.to_department_id
            }
        );
    } else if (type === 'internal_loan') {
        // Lender Dept: DR Due-From (1300), CR Bank (1111)
        lines.push(
            {
                account_id: interDeptReceivable.id,
                description: `Loan Receivable from Dept ${transfer.to_department_id}`,
                debit_amount: transfer.amount,
                credit_amount: 0,
                department_id: transfer.from_department_id
            },
            {
                account_id: bankAccount.id,
                description: `Funds disbursed to Dept ${transfer.to_department_id}`,
                debit_amount: 0,
                credit_amount: transfer.amount,
                department_id: transfer.from_department_id
            }
        );
        // Borrower Dept: DR Bank (1111), CR Due-To (2300)
        lines.push(
            {
                account_id: bankAccount.id,
                description: `Loan received from Dept ${transfer.from_department_id}`,
                debit_amount: transfer.amount,
                credit_amount: 0,
                department_id: transfer.to_department_id
            },
            {
                account_id: interDeptPayable.id,
                description: `Loan Payable to Dept ${transfer.from_department_id}`,
                debit_amount: 0,
                credit_amount: transfer.amount,
                department_id: transfer.to_department_id
            }
        );
    } else if (type === 'loan_repayment') {
        // Repayer (Borrower) Dept: DR Due-To (2300), CR Bank (1111)
        lines.push(
            {
                account_id: interDeptPayable.id,
                description: `Loan Repayment to Dept ${transfer.to_department_id}`,
                debit_amount: transfer.amount,
                credit_amount: 0,
                department_id: transfer.from_department_id
            },
            {
                account_id: bankAccount.id,
                description: `Repayment funds sent to Dept ${transfer.to_department_id}`,
                debit_amount: 0,
                credit_amount: transfer.amount,
                department_id: transfer.from_department_id
            }
        );
        // Receiving (Lender) Dept: DR Bank (1111), CR Due-From (1300)
        lines.push(
            {
                account_id: bankAccount.id,
                description: `Repayment received from Dept ${transfer.from_department_id}`,
                debit_amount: transfer.amount,
                credit_amount: 0,
                department_id: transfer.to_department_id
            },
            {
                account_id: interDeptReceivable.id,
                description: `Loan Receivable settled from Dept ${transfer.from_department_id}`,
                debit_amount: 0,
                credit_amount: transfer.amount,
                department_id: transfer.to_department_id
            }
        );
    }

    await AccountingService.createJournalEntry({
      entry_date: transfer.transfer_date,
      description: `Interdepartmental ${type.replace('_', ' ')}: ${transfer.description}`,
      is_posted: true,
      lines: lines
    });
  }

  // Fund Balances (Calculated from Ledger)
  static async getFundBalance(fundId: string): Promise<number> {
    const linesResponse = await ApiService.get<JournalEntryLine>('journal_entry_lines', {
        filters: { fund_id: fundId }
    });
    
    if (linesResponse.success && linesResponse.data) {
        return linesResponse.data.reduce((acc, line) => {
            // Fund Balance increases with Revenue (Credit) and decreases with Expense (Debit).
            return acc + (Number(line.credit_amount || 0) - Number(line.debit_amount || 0));
        }, 0);
    }
    return 0;
  }

  static async getFundBalances(): Promise<Map<string, number>> {
    const linesResponse = await ApiService.get<JournalEntryLine>('journal_entry_lines');
    const balances = new Map<string, number>();

    if (linesResponse.success && linesResponse.data) {
        for (const line of linesResponse.data) {
            if (line.fund_id) {
                const current = balances.get(line.fund_id) || 0;
                // Simplified: Assets increase with Debit, Revenue with Credit.
                // In fund accounting, we track the "Fund Balance" (Equity-like).
                // Fund Balance increases with Revenue (Credit) and decreases with Expense (Debit).
                balances.set(line.fund_id, current + (line.credit_amount - line.debit_amount));
            }
        }
    }
    return balances;
  }

  static async getDepartmentBalances(): Promise<Map<string, number>> {
    const linesResponse = await ApiService.get<JournalEntryLine>('journal_entry_lines');
    const balances = new Map<string, number>();

    if (linesResponse.success && linesResponse.data) {
        for (const line of linesResponse.data) {
            if (line.department_id) {
                const current = balances.get(line.department_id) || 0;
                balances.set(line.department_id, current + (line.credit_amount - line.debit_amount));
            }
        }
    }
    return balances;
  }
}
