import { AccountingService } from './accountingService';
import { Sale, Purchase, Expense, PayrollRun, PayrollPeriod } from '../types';

export class DoubleEntryService {
  /**
   * Post a sale to the ledger
   */
  static async postSale(sale: Sale): Promise<void> {
    const accounts = await AccountingService.getAccounts();
    const findAccount = (code: string) => {
      const flatten = (accs: any[]): any[] => {
        return accs.reduce((prev, curr) => {
          return prev.concat(curr).concat(curr.children ? flatten(curr.children) : []);
        }, []);
      };
      return flatten(accounts).find(a => a.code === code);
    };

    const arAccount = findAccount('1120'); // Accounts Receivable
    const cashAccount = findAccount('1110'); // Cash
    const mpesaAccount = findAccount('1111'); // Bank - Mpesa/Card
    
    // Revenue Accounts
    let salesRevenueAccount = findAccount('4100'); // Default Sales Revenue
    
    // @ts-ignore
    if (sale.sale_type === 'school_fees') {
        salesRevenueAccount = findAccount('4300') || salesRevenueAccount;
    // @ts-ignore
    } else if (sale.sale_type === 'child_support' || sale.sale_type === 'sponsorship') {
        salesRevenueAccount = findAccount('4400') || salesRevenueAccount;
    }

    const taxPayableAccount = findAccount('2150'); // Sales Tax Payable
    const cogsAccount = findAccount('5100'); // COGS
    const inventoryAccount = findAccount('1130'); // Inventory

    if (!salesRevenueAccount) {
      console.error('Required accounts not found for sale posting');
      return;
    }

    // Determine target debit account
    let debitAccount = arAccount;
    if (sale.payment_method === 'cash') debitAccount = cashAccount;
    else if (sale.payment_method === 'mpesa' || sale.payment_method === 'card') debitAccount = mpesaAccount;

    if (!debitAccount) {
      console.error('Debit account not found for sale posting');
      return;
    }

    const lines = [
      // Debit: Cash/AR/Mpesa
      {
        account_id: debitAccount.id,
        description: `Sale ${sale.sale_number} - ${sale.sale_type || 'Standard'}`,
        debit_amount: sale.total_amount,
        credit_amount: 0,
        department_id: sale.department_id,
        child_id: sale.child_id,
        donor_id: sale.donor_id,
        fund_id: sale.fund_id
      },
      // Credit: Sales Revenue
      {
        account_id: salesRevenueAccount.id,
        description: `Sale ${sale.sale_number} - ${sale.sale_type || 'Standard'}`,
        debit_amount: 0,
        credit_amount: sale.subtotal,
        department_id: sale.department_id,
        child_id: sale.child_id,
        donor_id: sale.donor_id,
        fund_id: sale.fund_id
      }
    ];

    // Credit: Sales Tax Payable
    if (sale.tax_amount > 0 && taxPayableAccount) {
      lines.push({
        account_id: taxPayableAccount.id,
        description: `Tax on Sale ${sale.sale_number}`,
        debit_amount: 0,
        credit_amount: sale.tax_amount
      });
    }

    // COGS and Inventory Entry (Only for standard product sales)
    // @ts-ignore
    if (!sale.sale_type || sale.sale_type === 'standard') {
        let totalCOGS = 0;
        if (sale.items && sale.items.length > 0) {
          totalCOGS = sale.items.reduce((sum, item) => {
            const cost = item.product?.cost_price || (item.unit_price * 0.7); // Fallback to 70% if cost not found
            return sum + (cost * item.quantity);
          }, 0);
        } else {
          totalCOGS = sale.subtotal * 0.7; // Fallback
        }
        
        lines.push({
          account_id: cogsAccount.id,
          description: `COGS for Sale ${sale.sale_number}`,
          debit_amount: totalCOGS,
          credit_amount: 0,
          // @ts-ignore
          department_id: sale.department_id
        });
        
        lines.push({
          account_id: inventoryAccount.id,
          description: `Inventory reduction for ${sale.sale_number}`,
          debit_amount: 0,
          credit_amount: totalCOGS,
          // @ts-ignore
          department_id: sale.department_id
        });
    }

    const created = await AccountingService.createJournalEntry({
      entry_date: sale.sale_date,
      description: `Automated entry for Sale ${sale.sale_number}`,
      reference: sale.sale_number,
      lines,
      is_posted: true
    });

    if (created && !created.is_posted) {
      await AccountingService.postJournalEntry(created.id);
    }
  }

  /**
   * Post a customer payment
   */
  static async postCustomerPayment(sale: Sale, amount: number, method: string, date?: string): Promise<void> {
    const accounts = await AccountingService.getAccounts();
    const findAccount = (code: string) => {
      const flatten = (accs: any[]): any[] => {
        return accs.reduce((prev, curr) => {
          return prev.concat(curr).concat(curr.children ? flatten(curr.children) : []);
        }, []);
      };
      return flatten(accounts).find(a => a.code === code);
    };

    const arAccount = findAccount('1120'); // Accounts Receivable
    const cashAccount = findAccount('1110'); // Cash
    const mpesaAccount = findAccount('1111'); // Bank - Mpesa/Card

    let debitAccount = cashAccount;
    if (method === 'mpesa' || method === 'card') debitAccount = mpesaAccount;

    if (!debitAccount || !arAccount) {
      console.error('Required accounts not found for payment posting');
      return;
    }

    const created = await AccountingService.createJournalEntry({
      entry_date: date || new Date().toISOString().split('T')[0],
      description: `Payment received for ${sale.sale_number}`,
      reference: sale.sale_number,
      lines: [
        {
          account_id: debitAccount.id,
          description: `Payment for ${sale.sale_number} via ${method}`,
          debit_amount: amount,
          credit_amount: 0
        },
        {
          account_id: arAccount.id,
          description: `Reduction of AR for ${sale.sale_number}`,
          debit_amount: 0,
          credit_amount: amount
        }
      ],
      is_posted: true
    });

    if (created && !created.is_posted) {
      await AccountingService.postJournalEntry(created.id);
    }
  }

  /**
   * Post a purchase from supplier
   */
  static async postPurchase(purchase: Purchase): Promise<void> {
    const accounts = await AccountingService.getAccounts();
    const findAccount = (code: string) => {
      const flatten = (accs: any[]): any[] => {
        return accs.reduce((prev, curr) => {
          return prev.concat(curr).concat(curr.children ? flatten(curr.children) : []);
        }, []);
      };
      return flatten(accounts).find(a => a.code === code);
    };

    const apAccount = findAccount('2110'); // Accounts Payable
    const inventoryAccount = findAccount('1130'); // Inventory

    if (!apAccount || !inventoryAccount) {
      console.error('Required accounts not found for purchase posting');
      return;
    }

    const created = await AccountingService.createJournalEntry({
      entry_date: purchase.purchase_date,
      description: `Purchase from supplier: ${purchase.purchase_number}`,
      reference: purchase.purchase_number,
      lines: [
        {
          account_id: inventoryAccount.id,
          description: `Inventory increase from ${purchase.purchase_number}`,
          debit_amount: purchase.total_amount,
          credit_amount: 0
        },
        {
          account_id: apAccount.id,
          description: `Liability to supplier for ${purchase.purchase_number}`,
          debit_amount: 0,
          credit_amount: purchase.total_amount
        }
      ],
      is_posted: true
    });

    if (created && !created.is_posted) {
      await AccountingService.postJournalEntry(created.id);
    }
  }

  /**
   * Post a payment to supplier
   */
  static async postSupplierPayment(purchase: Purchase, amount: number, method: string = 'bank', date?: string): Promise<void> {
    const accounts = await AccountingService.getAccounts();
    const findAccount = (code: string) => {
      const flatten = (accs: any[]): any[] => {
        return accs.reduce((prev, curr) => {
          return prev.concat(curr).concat(curr.children ? flatten(curr.children) : []);
        }, []);
      };
      return flatten(accounts).find(a => a.code === code);
    };

    const apAccount = findAccount('2110'); // Accounts Payable
    const cashAccount = findAccount('1110'); // Cash
    const mpesaAccount = findAccount('1111'); // Bank - Mpesa/Card

    // Select credit account based on method
    let creditAccount = mpesaAccount;
    if (method === 'cash') creditAccount = cashAccount;
    else if (!creditAccount) creditAccount = cashAccount;

    if (!apAccount || !creditAccount) {
      console.error('Required accounts not found for supplier payment posting');
      return;
    }

    const created = await AccountingService.createJournalEntry({
      entry_date: date || new Date().toISOString().split('T')[0],
      description: `Payment to supplier for ${purchase.purchase_number}`,
      reference: purchase.purchase_number,
      lines: [
        {
          account_id: apAccount.id,
          description: `Reduction of AP for ${purchase.purchase_number}`,
          debit_amount: amount,
          credit_amount: 0
        },
        {
          account_id: creditAccount.id,
          description: `Payment for ${purchase.purchase_number} via ${method}`,
          debit_amount: 0,
          credit_amount: amount
        }
      ],
      is_posted: true
    });

    if (created && !created.is_posted) {
      await AccountingService.postJournalEntry(created.id);
    }
  }

  /**
   * Post an expense
   */
  static async postExpense(expense: Expense): Promise<void> {
    const accounts = await AccountingService.getAccounts();
    const findAccount = (code: string) => {
      const flatten = (accs: any[]): any[] => {
        return accs.reduce((prev, curr) => {
          return prev.concat(curr).concat(curr.children ? flatten(curr.children) : []);
        }, []);
      };
      return flatten(accounts).find(a => a.code === code);
    };

    const mpesaAccount = findAccount('1111'); // Bank/Mpesa
    const expenseAccount = await AccountingService.getAccountById(expense.account_id);

    if (!mpesaAccount || !expenseAccount) {
      console.error('Required accounts not found for expense posting');
      return;
    }

    const created = await AccountingService.createJournalEntry({
      entry_date: expense.expense_date,
      description: `Expense: ${expense.description}`,
      reference: expense.expense_number,
      lines: [
        {
          account_id: expenseAccount.id,
          description: expense.description,
          debit_amount: expense.amount,
          credit_amount: 0,
          department_id: expense.department_id,
          child_id: expense.child_id,
          fund_id: expense.fund_id,
          donor_id: expense.donor_id
        },
        {
          account_id: mpesaAccount.id,
          description: `Payment for ${expense.expense_number}`,
          debit_amount: 0,
          credit_amount: expense.amount,
          department_id: expense.department_id,
          child_id: expense.child_id,
          fund_id: expense.fund_id,
          donor_id: expense.donor_id
        }
      ],
      is_posted: true
    });

    if (created && !created.is_posted) {
      await AccountingService.postJournalEntry(created.id);
    }
  }

  /**
   * Post Payroll
   */
  static async postPayroll(runs: PayrollRun[], period: PayrollPeriod): Promise<void> {
    const accounts = await AccountingService.getAccounts();
    const findAccount = (code: string) => {
      const flatten = (accs: any[]): any[] => {
        return accs.reduce((prev, curr) => {
          return prev.concat(curr).concat(curr.children ? flatten(curr.children) : []);
        }, []);
      };
      return flatten(accounts).find(a => a.code === code);
    };

    const expenseAccount = findAccount('5210'); // Payroll Expense
    const netSalaryPayable = findAccount('2125'); // Net Salary Payable
    const payeAccount = findAccount('2121'); // PAYE
    const nssfAccount = findAccount('2122'); // NSSF
    const nhifAccount = findAccount('2123'); // NHIF/SHIF
    const housingLevyAccount = findAccount('2124'); // Housing Levy

    if (!expenseAccount || !netSalaryPayable) {
       console.error('Required payroll accounts not found');
       return;
    }

    const totalGross = runs.reduce((sum, r) => sum + r.gross_pay, 0);
    const totalNet = runs.reduce((sum, r) => sum + r.net_pay, 0);
    const totalTax = runs.reduce((sum, r) => sum + r.tax_deduction, 0);
    const totalNSSF = runs.reduce((sum, r) => sum + r.nssf_deduction, 0);
    const totalNHIF = runs.reduce((sum, r) => sum + r.nhif_deduction, 0);
    const totalHousingLevy = runs.reduce((sum, r) => sum + (r.housing_levy_deduction || 0), 0);

    const lines = [
      {
        account_id: expenseAccount.id,
        description: `Gross Salary for ${period.period_name}`,
        debit_amount: totalGross,
        credit_amount: 0
      },
      {
        account_id: netSalaryPayable.id,
        description: `Net Salary Payable for ${period.period_name}`,
        debit_amount: 0,
        credit_amount: totalNet
      }
    ];

    if (totalTax > 0 && payeAccount) {
      lines.push({
        account_id: payeAccount.id,
        description: `PAYE for ${period.period_name}`,
        debit_amount: 0,
        credit_amount: totalTax
      });
    }

    if (totalNSSF > 0 && nssfAccount) {
      lines.push({
        account_id: nssfAccount.id,
        description: `NSSF for ${period.period_name}`,
        debit_amount: 0,
        credit_amount: totalNSSF
      });
    }

    if (totalNHIF > 0 && nhifAccount) {
      lines.push({
        account_id: nhifAccount.id,
        description: `NHIF/SHIF for ${period.period_name}`,
        debit_amount: 0,
        credit_amount: totalNHIF
      });
    }

    if (totalHousingLevy > 0 && housingLevyAccount) {
      lines.push({
        account_id: housingLevyAccount.id,
        description: `Housing Levy for ${period.period_name}`,
        debit_amount: 0,
        credit_amount: totalHousingLevy
      });
    }

    const created = await AccountingService.createJournalEntry({
      entry_date: period.pay_date,
      description: `Payroll processing for ${period.period_name}`,
      reference: period.period_name,
      lines,
      is_posted: true
    });

    if (created && !created.is_posted) {
      await AccountingService.postJournalEntry(created.id);
    }
  }
}
