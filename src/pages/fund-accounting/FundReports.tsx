import React, { useState, useEffect, useMemo } from 'react';
import { FundAccountingService } from '../../services/fundAccountingService';
import { AccountingService } from '../../services/accountingService';
import { ApiService } from '../../services/api';
import { BusinessSettingsService } from '../../services/businessSettingsService';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useAuthContext } from '../../contexts/useAuthContext';
import { printPaymentReceipt } from '../../utils/receiptUtils';
import { 
  FileText, Calendar, Printer, Filter, DollarSign, ArrowUpRight, 
  ArrowDownLeft, ArrowRightLeft, Users, GraduationCap, Heart, HelpCircle,
  Trash2, Download, RotateCcw, Building2, CheckCircle2, X, Landmark,
  Wallet, PieChart, BarChart3, TrendingUp, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Department, FundAccount, Child, Donor, JournalEntry, InternalTransfer, Account } from '../../types';
import { BankBalanceOverview } from '../../components/fund-accounting/BankBalanceOverview';

export type ReportTab = 'activities' | 'fees' | 'donations' | 'transfers' | 'treasury';

export interface RevenueStreamSummary {
  accountId: string;
  code: string;
  name: string;
  category?: string;
  grossCredits: number;
  adjustmentsDebits: number;
  netRevenue: number;
  percentage: number;
  count: number;
}

const FundReports: React.FC = () => {
  const { settings: contextSettings } = useSettingsContext();
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState<ReportTab>('activities');
  const [loading, setLoading] = useState(true);
  const [businessSettings, setBusinessSettings] = useState<any>(null);

  // Business Name and Details from Settings (reflects Business Settings, not hardcoded BIZMANAGER)
  const currentSettings = contextSettings || businessSettings;
  const businessName = currentSettings?.business_name || 'Organization';
  const currency = currentSettings?.default_currency || 'KES';
  const logoUrl = currentSettings?.logo_url || currentSettings?.logo || '';
  const businessAddress = currentSettings?.business_address || currentSettings?.address || '';
  const businessPhone = currentSettings?.business_phone || currentSettings?.phone || '';
  const businessEmail = currentSettings?.business_email || currentSettings?.email || '';

  // Filter States: Default to Jan 1st of current year to ensure records across the year appear
  const currentYearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(currentYearStart);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedFund, setSelectedFund] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedChild, setSelectedChild] = useState('');
  const [selectedDonor, setSelectedDonor] = useState('');

  // Dropdown Master Data
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [bankBalances, setBankBalances] = useState<Array<{ account: Account; balance: number; currency: string }>>([]);

  // Loaded Transaction Data
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [transfers, setTransfers] = useState<InternalTransfer[]>([]);
  const [donationsList, setDonationsList] = useState<any[]>([]);

  // Master Data Loader
  const loadMasterData = async () => {
    try {
      const [fList, dList, cList, donorList, settings, rawAccounts, liveBankBalances] = await Promise.all([
        FundAccountingService.getFundAccounts(),
        FundAccountingService.getDepartments(),
        FundAccountingService.getChildren(),
        FundAccountingService.getDonors(),
        BusinessSettingsService.getSettings(),
        AccountingService.getAccounts(),
        FundAccountingService.getBankAndCashBalances()
      ]);
      setFunds(fList || []);
      setDepartments(dList || []);
      setChildren(cList || []);
      setDonors(donorList || []);
      setBusinessSettings(settings);
      setAllAccounts(AccountingService.flattenAccounts(rawAccounts || []));
      setBankBalances(liveBankBalances || []);
    } catch (e) {
      console.error('Error loading master data', e);
    }
  };

  const accountMap = useMemo(() => {
    return new Map<string, Account>(allAccounts.map(a => [a.id, a]));
  }, [allAccounts]);

  // Helper to normalize any date string to YYYY-MM-DD
  const normalizeDate = (d: any): string => {
    if (!d) return '';
    return String(d).slice(0, 10);
  };

  // Quick Date Presets
  const handlePresetDate = (type: 'this-month' | 'this-year' | 'last-30' | 'all') => {
    const now = new Date();
    if (type === 'this-month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(todayStr);
    } else if (type === 'this-year') {
      const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(todayStr);
    } else if (type === 'last-30') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(todayStr);
    } else if (type === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleResetFilters = () => {
    setStartDate(currentYearStart);
    setEndDate(todayStr);
    setSelectedFund('');
    setSelectedDept('');
    setSelectedChild('');
    setSelectedDonor('');
    toast.success('Filters reset to default');
  };

  const handlePrintReceipt = (payment: JournalEntry) => {
    const lineWithChild = payment.lines?.find(l => l.child_id);
    const childId = lineWithChild?.child_id;
    const child = children.find(c => c.id === childId);
    const isRevenue = payment.description?.toLowerCase().includes('inflow') || 
                      payment.lines?.some(l => (l.account?.code === '4300' || l.account?.account_type === 'revenue') && l.credit_amount > 0);
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
      date: normalizeDate(payment.entry_date),
      time: 'N/A',
      type: 'school_fee' as any,
      childName,
      donorName: guardianName,
      fundName: fund?.name || 'Education Fund'
    };

    const details = {
      businessName: businessName,
      businessAddress: businessAddress || 'Nairobi, Kenya',
      businessPhone: businessPhone || '',
      businessEmail: businessEmail || '',
      logoUrl: logoUrl || '',
      currency: currency
    };

    printPaymentReceipt(receipt, details, false);
  };

  const handleDeletePayment = async (id: string) => {
    if (!window.confirm('Are you sure you want to void and delete this payment record? This will remove the transaction from the General Ledger.')) return;
    const success = await AccountingService.deleteJournalEntry(id);
    if (success) {
      toast.success('School Fee Payment voided successfully.');
      loadReportData();
    } else {
      toast.error('Failed to void school fee payment.');
    }
  };

  // Report Loader
  const loadReportData = async () => {
    setLoading(true);
    try {
      // 1. Fetch journal entries - do not filter is_posted strictly so all recorded transactions are visible
      const entries = await AccountingService.getJournalEntries({
        start_date: startDate || undefined,
        end_date: endDate || undefined
      });
      setJournalEntries(entries || []);

      // 2. Fetch direct donations
      const donationsResponse = await ApiService.get<any>('donations');
      if (donationsResponse.success && donationsResponse.data) {
        let list = donationsResponse.data;
        if (startDate) list = list.filter(d => normalizeDate(d.donation_date) >= startDate);
        if (endDate) list = list.filter(d => normalizeDate(d.donation_date) <= endDate);
        setDonationsList(list);
      }

      // 3. Fetch transfers
      const transfersResponse = await ApiService.get<InternalTransfer>('internal_transfers');
      if (transfersResponse.success && transfersResponse.data) {
        let list = transfersResponse.data;
        if (startDate) list = list.filter(t => normalizeDate(t.transfer_date) >= startDate);
        if (endDate) list = list.filter(t => normalizeDate(t.transfer_date) <= endDate);
        setTransfers(list);
      }

      // 4. Refresh live bank balances
      const balances = await FundAccountingService.getBankAndCashBalances();
      setBankBalances(balances || []);
    } catch (e) {
      toast.error('Failed to load financial records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    loadReportData();
  }, [startDate, endDate]);

  // ----------------------------------------------------
  // COMPUTED DATA FOR EACH TAB (with robust filtering & double-entry accounting)
  // ----------------------------------------------------

  // Tab 1: Statement of Activities Computed Lines & Double-Entry Revenue Stream Breakdown
  const activitiesData = useMemo(() => {
    const revenueLines: any[] = [];
    const expenseLines: any[] = [];

    // Revenue streams aggregation map (Credits: Inflows minus Debits: Adjustments)
    const revenueStreamsMap = new Map<string, {
      accountId: string;
      code: string;
      name: string;
      category?: string;
      grossCredits: number;
      adjustmentsDebits: number;
      netRevenue: number;
      count: number;
    }>();

    // Expense streams aggregation map (Debits: Expenses minus Credits: Rebates)
    const expenseStreamsMap = new Map<string, {
      accountId: string;
      code: string;
      name: string;
      grossDebits: number;
      adjustmentsCredits: number;
      netExpense: number;
      count: number;
    }>();

    journalEntries.forEach(entry => {
      entry.lines?.forEach(line => {
        const lineAccount = line.account || accountMap.get(line.account_id);
        const code = lineAccount?.code || '';
        const type = (lineAccount?.account_type || '').toLowerCase();

        // Tagged fund/dept on either the line or parent entry lines
        const entryFundId = line.fund_id || entry.lines?.find(l => l.fund_id)?.fund_id;
        const entryDeptId = line.department_id || entry.lines?.find(l => l.department_id)?.department_id;
        const entryChildId = line.child_id || entry.lines?.find(l => l.child_id)?.child_id;
        const entryDonorId = line.donor_id || entry.lines?.find(l => l.donor_id)?.donor_id;

        if (selectedFund && entryFundId !== selectedFund) return;
        if (selectedDept && entryDeptId !== selectedDept) return;
        if (selectedChild && entryChildId !== selectedChild) return;
        if (selectedDonor && entryDonorId !== selectedDonor) return;

        // Double-entry classification:
        // Revenue accounts are 4xxx or account_type = 'revenue'
        const isRevenue = type === 'revenue' || code.startsWith('4');
        // Expense accounts are 5xxx or account_type = 'expense'
        const isExpense = type === 'expense' || code.startsWith('5');

        const cr = Number(line.credit_amount || 0);
        const dr = Number(line.debit_amount || 0);

        if (isRevenue) {
          const streamKey = lineAccount?.id || code || '4000';
          const defaultName = code === '4300' ? 'School Fees & Tuition' :
                              code === '4240' ? 'Child Sponsorship Contributions' :
                              code === '4260' ? 'In-Kind Donations' :
                              code === '4220' ? 'Temporarily Restricted Donations' :
                              code === '4210' ? 'Unrestricted Donations' :
                              code === '4200' ? 'General Donations' :
                              code === '4900' ? 'Inter-Departmental Allocation Inflow' : 'Operating Revenue';
          const streamName = lineAccount?.name || defaultName;

          if (!revenueStreamsMap.has(streamKey)) {
            revenueStreamsMap.set(streamKey, {
              accountId: streamKey,
              code: code || '4xxx',
              name: streamName,
              category: lineAccount?.category,
              grossCredits: 0,
              adjustmentsDebits: 0,
              netRevenue: 0,
              count: 0
            });
          }

          const stream = revenueStreamsMap.get(streamKey)!;
          stream.grossCredits += cr;
          stream.adjustmentsDebits += dr;
          stream.netRevenue += (cr - dr); // CR increases revenue, DR decreases (contra-revenue/refund)
          stream.count += 1;

          if (cr > 0 || dr > 0) {
            revenueLines.push({
              date: normalizeDate(entry.entry_date),
              entryNumber: entry.entry_number,
              accountCode: code,
              accountName: streamName,
              description: line.description || entry.description,
              credit: cr,
              debit: dr,
              amount: cr > 0 ? cr : -dr,
              netAmount: cr - dr,
              fund: funds.find(f => f.id === entryFundId)?.name || 'General Operations',
              dept: departments.find(d => d.id === entryDeptId)?.name || 'General Admin'
            });
          }
        } else if (isExpense) {
          const streamKey = lineAccount?.id || code || '5000';
          const streamName = lineAccount?.name || 'General Program Expenditure';

          if (!expenseStreamsMap.has(streamKey)) {
            expenseStreamsMap.set(streamKey, {
              accountId: streamKey,
              code: code || '5xxx',
              name: streamName,
              grossDebits: 0,
              adjustmentsCredits: 0,
              netExpense: 0,
              count: 0
            });
          }

          const stream = expenseStreamsMap.get(streamKey)!;
          stream.grossDebits += dr;
          stream.adjustmentsCredits += cr;
          stream.netExpense += (dr - cr); // DR increases expense, CR decreases (rebate/recovery)
          stream.count += 1;

          if (dr > 0 || cr > 0) {
            expenseLines.push({
              date: normalizeDate(entry.entry_date),
              entryNumber: entry.entry_number,
              accountCode: code,
              accountName: streamName,
              description: line.description || entry.description,
              debit: dr,
              credit: cr,
              amount: dr > 0 ? dr : -cr,
              netAmount: dr - cr,
              fund: funds.find(f => f.id === entryFundId)?.name || 'General Operations',
              dept: departments.find(d => d.id === entryDeptId)?.name || 'General Admin'
            });
          }
        }
      });
    });

    const totalGrossRevenue = Array.from(revenueStreamsMap.values()).reduce((sum, s) => sum + s.grossCredits, 0);
    const totalRevenueAdjustments = Array.from(revenueStreamsMap.values()).reduce((sum, s) => sum + s.adjustmentsDebits, 0);
    const totalNetRevenue = totalGrossRevenue - totalRevenueAdjustments;

    const totalGrossExpense = Array.from(expenseStreamsMap.values()).reduce((sum, s) => sum + s.grossDebits, 0);
    const totalExpenseAdjustments = Array.from(expenseStreamsMap.values()).reduce((sum, s) => sum + s.adjustmentsCredits, 0);
    const totalNetExpense = totalGrossExpense - totalExpenseAdjustments;

    const netChange = totalNetRevenue - totalNetExpense;

    // Structured revenue stream summaries with calculated % share
    const revenueStreams: RevenueStreamSummary[] = Array.from(revenueStreamsMap.values())
      .map(s => ({
        ...s,
        percentage: totalNetRevenue > 0 ? Math.max(0, (s.netRevenue / totalNetRevenue) * 100) : 0
      }))
      .sort((a, b) => b.netRevenue - a.netRevenue);

    return { 
      revenueLines, 
      expenseLines, 
      revenueStreams,
      totalGrossRevenue,
      totalRevenueAdjustments,
      totalRevenue: totalNetRevenue, 
      totalGrossExpense,
      totalExpenseAdjustments,
      totalExpense: totalNetExpense, 
      netChange 
    };
  }, [journalEntries, accountMap, selectedFund, selectedDept, selectedChild, selectedDonor, funds, departments]);

  // Tab 2: School Fee Records Computed
  const schoolFeeRecords = useMemo(() => {
    const feeRecords: any[] = [];
    const seenEntryIds = new Set<string>();

    journalEntries.forEach(entry => {
      const desc = (entry.description || '').toLowerCase();
      const isFeeEntry = desc.includes('school fee') || desc.includes('tuition') || desc.includes('fee payment');
      
      entry.lines?.forEach(line => {
        const lineDesc = (line.description || '').toLowerCase();
        const lineAccountCode = line.account?.code || '';
        const isFeeLine = line.child_id || 
                          lineAccountCode === '4300' || lineAccountCode === '5310' || lineAccountCode === '5350' ||
                          lineAccountCode === '4240' || lineAccountCode === '5300' ||
                          isFeeEntry || lineDesc.includes('school fee') || lineDesc.includes('tuition');

        if (!isFeeLine) return;

        // Target either revenue/expense line to avoid double counting bank/cash line
        const isRevLine = line.account?.account_type === 'revenue' || lineAccountCode.startsWith('4') || line.credit_amount > 0;
        const isExpLine = line.account?.account_type === 'expense' || lineAccountCode.startsWith('5') || (!lineAccountCode.startsWith('1') && line.debit_amount > 0);

        if (!isRevLine && !isExpLine) return;

        // Child tag from line or sibling lines
        const childId = line.child_id || entry.lines?.find(l => l.child_id)?.child_id;
        const fundId = line.fund_id || entry.lines?.find(l => l.fund_id)?.fund_id;
        const deptId = line.department_id || entry.lines?.find(l => l.department_id)?.department_id;

        // Apply filters
        if (selectedChild && childId !== selectedChild) return;
        if (selectedFund && fundId !== selectedFund) return;
        if (selectedDept && deptId !== selectedDept) return;

        // Deduplicate per journal entry line
        const uniqueKey = `${entry.id}-${line.id || lineAccountCode}`;
        if (seenEntryIds.has(uniqueKey)) return;
        seenEntryIds.add(uniqueKey);

        const childObj = children.find(c => c.id === childId);
        const childName = childObj ? `${childObj.first_name} ${childObj.last_name}` : 'Beneficiary Child';
        const childCode = childObj?.code || 'N/A';

        const isInflow = isRevLine || desc.includes('inflow');
        const amount = Number(line.credit_amount > 0 ? line.credit_amount : line.debit_amount);

        feeRecords.push({
          id: entry.id,
          entry,
          entryNumber: entry.entry_number,
          date: normalizeDate(entry.entry_date),
          childName,
          childCode,
          description: line.description || entry.description,
          type: isInflow ? 'Inflow (Guardian Pay)' : 'Outflow (NGO Pay School)',
          amount,
          fund: funds.find(f => f.id === fundId)?.name || 'General Education',
          dept: departments.find(d => d.id === deptId)?.name || 'Education'
        });
      });
    });

    return feeRecords;
  }, [journalEntries, selectedChild, selectedFund, selectedDept, children, funds, departments]);

  // Tab 3: Donations Records Computed
  const filteredDonations = useMemo(() => {
    return donationsList.filter(don => {
      if (selectedDonor && don.donor_id !== selectedDonor) return false;
      if (selectedFund && don.fund_id !== selectedFund) return false;
      if (selectedChild && don.restricted_to_child_id !== selectedChild) return false;
      return true;
    });
  }, [donationsList, selectedDonor, selectedFund, selectedChild]);

  // Tab 4: Internal Transfers Computed
  const filteredTransfers = useMemo(() => {
    return transfers.filter(tr => {
      if (selectedDept && tr.from_department_id !== selectedDept && tr.to_department_id !== selectedDept) return false;
      return true;
    });
  }, [transfers, selectedDept]);

  // ----------------------------------------------------
  // MULTI-PAGE STANDALONE PRINT / PDF GENERATOR (Fixes 1-page truncation)
  // ----------------------------------------------------
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print/export reports.');
      return;
    }

    const todayDateFormatted = new Date().toLocaleDateString('en-KE', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    const printTime = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    const periodLabel = startDate && endDate 
      ? `Period: ${startDate} to ${endDate}`
      : startDate 
      ? `From: ${startDate}` 
      : endDate 
      ? `Up to: ${endDate}` 
      : 'All Recorded History';

    let reportTitle = '';
    let reportTableHtml = '';
    let summaryCardsHtml = '';

    if (activeTab === 'activities') {
      reportTitle = 'Statement of Activities (Income & Expenditure)';
      summaryCardsHtml = `
        <div class="summary-grid">
          <div class="card in-card">
            <div class="card-label">Total Revenues / Inflows (Net)</div>
            <div class="card-val">${currency} ${activitiesData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div style="font-size: 8.5px; opacity: 0.8; margin-top: 2px;">Gross CR: ${activitiesData.totalGrossRevenue.toLocaleString()} | Less DR Adjustments: ${activitiesData.totalRevenueAdjustments.toLocaleString()}</div>
          </div>
          <div class="card out-card">
            <div class="card-label">Total Program Expenditures (Net)</div>
            <div class="card-val">${currency} ${activitiesData.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div style="font-size: 8.5px; opacity: 0.8; margin-top: 2px;">Gross DR: ${activitiesData.totalGrossExpense.toLocaleString()} | Less CR Rebates: ${activitiesData.totalExpenseAdjustments.toLocaleString()}</div>
          </div>
          <div class="card net-card">
            <div class="card-label">Net Assets Change</div>
            <div class="card-val">${currency} ${activitiesData.netChange.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      `;

      reportTableHtml = `
        <h3 class="section-title">Revenue Streams & Inflow Breakdown (Double-Entry Analysis)</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 14%">Account Code</th>
              <th style="width: 38%">Revenue Stream / Source</th>
              <th style="width: 16%; text-align: right;">Gross Inflow (CR)</th>
              <th style="width: 16%; text-align: right;">Adjustments (DR)</th>
              <th style="width: 16%; text-align: right;">Net Recognized (${currency})</th>
            </tr>
          </thead>
          <tbody>
            ${activitiesData.revenueStreams.length === 0 
              ? '<tr><td colspan="5" class="empty-cell">No revenue stream records found matching filters</td></tr>'
              : activitiesData.revenueStreams.map(s => `
                <tr>
                  <td><strong>${s.code}</strong></td>
                  <td>${s.name} <small style="color: #64748b">(${s.percentage.toFixed(1)}%)</small></td>
                  <td style="text-align: right;">${s.grossCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td style="text-align: right; color: #b91c1c;">${s.adjustmentsDebits > 0 ? `(${s.adjustmentsDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })})` : '0.00'}</td>
                  <td style="text-align: right; font-weight: bold; color: #047857;">${s.netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')
            }
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="2">TOTAL NET RECOGNIZED REVENUES</td>
              <td style="text-align: right;">${activitiesData.totalGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td style="text-align: right; color: #b91c1c;">${activitiesData.totalRevenueAdjustments > 0 ? `(${activitiesData.totalRevenueAdjustments.toLocaleString(undefined, { minimumFractionDigits: 2 })})` : '0.00'}</td>
              <td style="text-align: right;">${currency} ${activitiesData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        <div style="height: 18px;"></div>

        <h3 class="section-title">Inflow Ledger (Transaction Line Items)</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 12%">Date</th>
              <th style="width: 25%">Fund / Department</th>
              <th style="width: 45%">Description / Reference</th>
              <th style="width: 18%; text-align: right;">Amount (${currency})</th>
            </tr>
          </thead>
          <tbody>
            ${activitiesData.revenueLines.length === 0 
              ? '<tr><td colspan="4" class="empty-cell">No revenue records found matching filters</td></tr>'
              : activitiesData.revenueLines.map(r => `
                <tr>
                  <td>${r.date}</td>
                  <td><strong>${r.fund}</strong><br><small style="color: #64748b">${r.dept}</small></td>
                  <td>${r.description}</td>
                  <td style="text-align: right; font-weight: bold; color: #047857;">${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')
            }
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3">TOTAL REVENUES / INFLOWS</td>
              <td style="text-align: right;">${currency} ${activitiesData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        <div style="height: 18px;"></div>

        <h3 class="section-title">Outflow Ledger (Expenditures)</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 12%">Date</th>
              <th style="width: 25%">Fund / Department</th>
              <th style="width: 45%">Description / Reference</th>
              <th style="width: 18%; text-align: right;">Amount (${currency})</th>
            </tr>
          </thead>
          <tbody>
            ${activitiesData.expenseLines.length === 0 
              ? '<tr><td colspan="4" class="empty-cell">No expenditure records found matching filters</td></tr>'
              : activitiesData.expenseLines.map(e => `
                <tr>
                  <td>${e.date}</td>
                  <td><strong>${e.fund}</strong><br><small style="color: #64748b">${e.dept}</small></td>
                  <td>${e.description}</td>
                  <td style="text-align: right; font-weight: bold; color: #b91c1c;">${e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')
            }
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3">TOTAL EXPENDITURES / OUTFLOWS</td>
              <td style="text-align: right;">${currency} ${activitiesData.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
      `;
    } else if (activeTab === 'fees') {
      reportTitle = 'School Fee Payments & Tuition Ledger';
      const totalFees = schoolFeeRecords.reduce((sum, r) => sum + r.amount, 0);
      summaryCardsHtml = `
        <div class="summary-grid">
          <div class="card in-card">
            <div class="card-label">Total School Fees Processed</div>
            <div class="card-val">${currency} ${totalFees.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="card net-card">
            <div class="card-label">Total Fee Transactions</div>
            <div class="card-val">${schoolFeeRecords.length} Record(s)</div>
          </div>
        </div>
      `;

      reportTableHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 12%">Date</th>
              <th style="width: 22%">Beneficiary Child</th>
              <th style="width: 18%">Type</th>
              <th style="width: 20%">Fund / Center</th>
              <th style="width: 16%">Memo / Description</th>
              <th style="width: 12%; text-align: right;">Amount (${currency})</th>
            </tr>
          </thead>
          <tbody>
            ${schoolFeeRecords.length === 0 
              ? '<tr><td colspan="6" class="empty-cell">No school fee payments match chosen filters</td></tr>'
              : schoolFeeRecords.map(r => `
                <tr>
                  <td>${r.date}</td>
                  <td><strong>${r.childName}</strong><br><small style="color: #64748b">${r.childCode}</small></td>
                  <td><span class="badge ${r.type.startsWith('Inflow') ? 'badge-green' : 'badge-amber'}">${r.type}</span></td>
                  <td><strong>${r.fund}</strong><br><small style="color: #64748b">${r.dept}</small></td>
                  <td>${r.description}</td>
                  <td style="text-align: right; font-weight: bold;">${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')
            }
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="5">TOTAL AMOUNT</td>
              <td style="text-align: right;">${currency} ${totalFees.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
      `;
    } else if (activeTab === 'donations') {
      reportTitle = 'Donations & Sponsorship Contributions Ledger';
      const totalDonations = filteredDonations.reduce((sum, d) => sum + Number(d.amount || d.total_fair_market_value || 0), 0);
      summaryCardsHtml = `
        <div class="summary-grid">
          <div class="card in-card">
            <div class="card-label">Total Contributions Value</div>
            <div class="card-val">${currency} ${totalDonations.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="card net-card">
            <div class="card-label">Total Contributions Recorded</div>
            <div class="card-val">${filteredDonations.length} Payments</div>
          </div>
        </div>
      `;

      reportTableHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 12%">Date</th>
              <th style="width: 25%">Donor / Sponsor</th>
              <th style="width: 20%">Method / Reference</th>
              <th style="width: 25%">Restricted Dimension</th>
              <th style="width: 18%; text-align: right;">Contribution (${currency})</th>
            </tr>
          </thead>
          <tbody>
            ${filteredDonations.length === 0 
              ? '<tr><td colspan="5" class="empty-cell">No donor contributions match selection criteria</td></tr>'
              : filteredDonations.map(row => {
                const donorName = donors.find(d => d.id === row.donor_id)?.name || 'Anonymous Donor';
                const child = children.find(c => c.id === row.restricted_to_child_id);
                const childLabel = child ? `Child: ${child.first_name} ${child.last_name}` : null;
                const fundLabel = funds.find(f => f.id === row.fund_id)?.name;
                const amt = Number(row.amount || row.total_fair_market_value || 0);

                return `
                  <tr>
                    <td>${normalizeDate(row.donation_date)}</td>
                    <td><strong>${donorName}</strong></td>
                    <td><span class="badge">${(row.payment_method || 'Direct').toUpperCase()}</span><br><small style="color: #64748b">${row.reference_number || 'No Ref'}</small></td>
                    <td>
                      ${childLabel ? `<span class="badge badge-purple">${childLabel}</span> ` : ''}
                      ${fundLabel ? `<span class="badge badge-green">${fundLabel}</span>` : ''}
                      ${!childLabel && !fundLabel ? '<small style="color: #94a3b8; font-style: italic">Unrestricted Fund</small>' : ''}
                    </td>
                    <td style="text-align: right; font-weight: bold; color: #047857;">${amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                `;
              }).join('')
            }
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="4">TOTAL CONTRIBUTIONS</td>
              <td style="text-align: right;">${currency} ${totalDonations.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
      `;
    } else if (activeTab === 'transfers') {
      reportTitle = 'Inter-Departmental Clearing & Transfers Report';
      const totalTransfers = filteredTransfers.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      summaryCardsHtml = `
        <div class="summary-grid">
          <div class="card in-card">
            <div class="card-label">Total Transferred Volume</div>
            <div class="card-val">${currency} ${totalTransfers.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="card net-card">
            <div class="card-label">Total Inter-Dept Transfers</div>
            <div class="card-val">${filteredTransfers.length} Transfers</div>
          </div>
        </div>
      `;

      reportTableHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 14%">Date</th>
              <th style="width: 24%">Source (From Dept)</th>
              <th style="width: 24%">Destination (To Dept)</th>
              <th style="width: 15%">Status</th>
              <th style="width: 23%; text-align: right;">Amount (${currency})</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTransfers.length === 0 
              ? '<tr><td colspan="5" class="empty-cell">No internal transfers match chosen parameters</td></tr>'
              : filteredTransfers.map(row => {
                const fromDeptName = departments.find(d => d.id === row.from_department_id)?.name || 'N/A';
                const toDeptName = departments.find(d => d.id === row.to_department_id)?.name || 'N/A';
                return `
                  <tr>
                    <td>${normalizeDate(row.transfer_date)}</td>
                    <td style="color: #b91c1c; font-weight: 600;">${fromDeptName}</td>
                    <td style="color: #047857; font-weight: 600;">${toDeptName}</td>
                    <td><span class="badge ${row.status === 'approved' ? 'badge-green' : 'badge-amber'}">${(row.status || 'Pending').toUpperCase()}</span></td>
                    <td style="text-align: right; font-weight: bold;">${Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                `;
              }).join('')
            }
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="4">TOTAL INTERNAL TRANSFERS</td>
              <td style="text-align: right;">${currency} ${totalTransfers.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
      `;
    } else if (activeTab === 'treasury') {
      reportTitle = 'Bank & Cash Positions (Treasury Liquidity Report)';
      const totalLiquid = bankBalances.reduce((sum, b) => sum + b.balance, 0);
      summaryCardsHtml = `
        <div class="summary-grid">
          <div class="card in-card">
            <div class="card-label">Total Liquid Funds Available</div>
            <div class="card-val">${currency} ${totalLiquid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="card net-card">
            <div class="card-label">Active Bank & Cash Accounts</div>
            <div class="card-val">${bankBalances.length} Accounts</div>
          </div>
        </div>
      `;

      reportTableHtml = `
        <h3 class="section-title">Bank & Cash Accounts Ledger Balances (Assets: Debits minus Credits)</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 15%">Account Code</th>
              <th style="width: 45%">Account Name</th>
              <th style="width: 20%">Classification</th>
              <th style="width: 20%; text-align: right;">Available Balance (${currency})</th>
            </tr>
          </thead>
          <tbody>
            ${bankBalances.length === 0 
              ? '<tr><td colspan="4" class="empty-cell">No bank or cash accounts found</td></tr>'
              : bankBalances.map(b => `
                <tr>
                  <td><strong>${b.account.code}</strong></td>
                  <td><strong>${b.account.name}</strong><br><small style="color: #64748b">${b.account.description || 'Operating Account'}</small></td>
                  <td>${b.account.category || 'Liquid Assets'}</td>
                  <td style="text-align: right; font-weight: bold; color: ${b.balance >= 0 ? '#047857' : '#b91c1c'};">${b.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')
            }
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3">TOTAL AVAILABLE LIQUID ASSETS</td>
              <td style="text-align: right;">${currency} ${totalLiquid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportTitle} - ${businessName}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 12mm 15mm 12mm;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 11px;
            color: #0f172a;
            background: #fff;
            line-height: 1.4;
            padding: 15px;
          }
          .report-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 12px;
            margin-bottom: 15px;
          }
          .org-brand {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .org-logo {
            max-height: 55px;
            max-width: 120px;
            object-fit: contain;
          }
          .org-name {
            font-size: 20px;
            font-weight: 800;
            color: #1e293b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .org-contact {
            font-size: 10px;
            color: #64748b;
            margin-top: 2px;
          }
          .report-meta {
            text-align: right;
          }
          .report-title {
            font-size: 15px;
            font-weight: 700;
            color: #1e40af;
          }
          .report-cycle {
            font-size: 10px;
            font-weight: 600;
            color: #475569;
            margin-top: 2px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 16px;
          }
          .card {
            padding: 10px 14px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
          }
          .in-card { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
          .out-card { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
          .net-card { background: #eff6ff; border-color: #bfdbfe; color: #1e40af; }
          .card-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; }
          .card-val { font-size: 15px; font-weight: 800; margin-top: 2px; }
          .section-title {
            font-size: 12px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            page-break-inside: auto;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          th {
            background-color: #f1f5f9;
            color: #334155;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 7px 8px;
            border-top: 1px solid #cbd5e1;
            border-bottom: 1.5px solid #94a3b8;
            text-align: left;
          }
          td {
            padding: 6px 8px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 10px;
            vertical-align: top;
          }
          .total-row td {
            background: #f8fafc;
            font-weight: 800;
            font-size: 11px;
            border-top: 1.5px solid #94a3b8;
            border-bottom: 2px solid #334155;
            color: #0f172a;
          }
          .empty-cell {
            text-align: center;
            color: #94a3b8;
            padding: 16px;
            font-style: italic;
          }
          .badge {
            display: inline-block;
            font-size: 8.5px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            background: #f1f5f9;
            color: #334155;
          }
          .badge-green { background: #dcfce7; color: #166534; }
          .badge-amber { background: #fef3c7; color: #92400e; }
          .badge-purple { background: #f3e8ff; color: #6b21a8; }
          .report-footer {
            margin-top: 24px;
            padding-top: 10px;
            border-top: 1px solid #cbd5e1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9.5px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div class="org-brand">
            ${logoUrl ? `<img src="${logoUrl}" class="org-logo" alt="Logo" />` : ''}
            <div>
              <div class="org-name">${businessName}</div>
              <div class="org-contact">
                ${businessAddress ? `<span>${businessAddress}</span> &middot; ` : ''}
                ${businessPhone ? `<span>Tel: ${businessPhone}</span> &middot; ` : ''}
                ${businessEmail ? `<span>Email: ${businessEmail}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="report-meta">
            <div class="report-title">${reportTitle}</div>
            <div class="report-cycle">${periodLabel}</div>
          </div>
        </div>

        ${summaryCardsHtml}
        ${reportTableHtml}

        <div class="report-footer">
          <div>
            Prepared by: <strong>${user?.name || user?.email || 'Authorized Officer'}</strong>
          </div>
          <div>
            Printed on: ${todayDateFormatted} at ${printTime}
          </div>
          <div>
            Fund Accounting Sub-system &middot; ${businessName}
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
  };

  // ----------------------------------------------------
  // DIRECT CSV EXPORT (Full dataset download)
  // ----------------------------------------------------
  const handleExportCSV = () => {
    let csvRows: string[][] = [];
    let filename = '';

    if (activeTab === 'activities') {
      filename = `statement_of_activities_${startDate || 'all'}_to_${endDate || 'all'}.csv`;
      csvRows.push(['STATEMENT OF ACTIVITIES - ' + businessName]);
      csvRows.push([`Period: ${startDate || 'Start'} to ${endDate || 'End'}`]);
      csvRows.push([]);
      
      // 1. Revenue Streams Breakdown Section
      csvRows.push(['REVENUE STREAMS & ALLOCATION BREAKDOWN (DOUBLE-ENTRY)']);
      csvRows.push(['Account Code', 'Revenue Stream Name', `Gross Inflows (CR)`, `Adjustments (DR)`, `Net Recognized (${currency})`, 'Share %']);
      activitiesData.revenueStreams.forEach(s => {
        csvRows.push([
          s.code,
          `"${s.name.replace(/"/g, '""')}"`,
          s.grossCredits.toFixed(2),
          s.adjustmentsDebits.toFixed(2),
          s.netRevenue.toFixed(2),
          `${s.percentage.toFixed(1)}%`
        ]);
      });
      csvRows.push(['TOTAL NET REVENUES', '', activitiesData.totalGrossRevenue.toFixed(2), activitiesData.totalRevenueAdjustments.toFixed(2), activitiesData.totalRevenue.toFixed(2), '100.0%']);
      csvRows.push([]);

      // 2. Inflow Ledger Section
      csvRows.push(['INFLOW LEDGER (LINE ITEMS)']);
      csvRows.push(['Type', 'Date', 'Code', 'Stream Name', 'Fund', 'Department', 'Description', `Amount (${currency})`]);
      activitiesData.revenueLines.forEach(r => {
        csvRows.push(['Revenue', r.date, r.accountCode || '', `"${(r.accountName || '').replace(/"/g, '""')}"`, r.fund, r.dept, `"${(r.description || '').replace(/"/g, '""')}"`, r.amount.toFixed(2)]);
      });
      csvRows.push(['Total Revenue Inflow', '', '', '', '', '', '', activitiesData.totalRevenue.toFixed(2)]);
      csvRows.push([]);

      // 3. Outflow Ledger Section
      csvRows.push(['OUTFLOW LEDGER (EXPENDITURES)']);
      csvRows.push(['Type', 'Date', 'Code', 'Stream Name', 'Fund', 'Department', 'Description', `Amount (${currency})`]);
      activitiesData.expenseLines.forEach(e => {
        csvRows.push(['Expense', e.date, e.accountCode || '', `"${(e.accountName || '').replace(/"/g, '""')}"`, e.fund, e.dept, `"${(e.description || '').replace(/"/g, '""')}"`, e.amount.toFixed(2)]);
      });
      csvRows.push(['Total Expense Outflow', '', '', '', '', '', '', activitiesData.totalExpense.toFixed(2)]);
      csvRows.push([]);
      csvRows.push(['NET ASSETS CHANGE (SURPLUS / DEFICIT)', '', '', '', '', '', '', activitiesData.netChange.toFixed(2)]);
    } else if (activeTab === 'fees') {
      filename = `school_fees_report_${startDate || 'all'}_to_${endDate || 'all'}.csv`;
      csvRows.push(['SCHOOL FEES REPORT - ' + businessName]);
      csvRows.push([`Period: ${startDate || 'Start'} to ${endDate || 'End'}`]);
      csvRows.push([]);
      csvRows.push(['Date', 'Beneficiary', 'Code', 'Type', 'Fund', 'Department', 'Description', `Amount (${currency})`]);
      schoolFeeRecords.forEach(r => {
        csvRows.push([r.date, r.childName, r.childCode, r.type, r.fund, r.dept, `"${(r.description || '').replace(/"/g, '""')}"`, r.amount.toFixed(2)]);
      });
      const total = schoolFeeRecords.reduce((s, r) => s + r.amount, 0);
      csvRows.push(['TOTAL', '', '', '', '', '', '', total.toFixed(2)]);
    } else if (activeTab === 'donations') {
      filename = `donations_report_${startDate || 'all'}_to_${endDate || 'all'}.csv`;
      csvRows.push(['DONATIONS AND SPONSORSHIPS - ' + businessName]);
      csvRows.push([`Period: ${startDate || 'Start'} to ${endDate || 'End'}`]);
      csvRows.push([]);
      csvRows.push(['Date', 'Donor', 'Payment Method', 'Reference', 'Child Beneficiary', 'Fund', `Amount (${currency})`]);
      filteredDonations.forEach(d => {
        const donorName = donors.find(dn => dn.id === d.donor_id)?.name || 'Anonymous Donor';
        const child = children.find(c => c.id === d.restricted_to_child_id);
        const childLabel = child ? `${child.first_name} ${child.last_name}` : 'Unrestricted';
        const fundLabel = funds.find(f => f.id === d.fund_id)?.name || 'Unrestricted';
        const amt = Number(d.amount || d.total_fair_market_value || 0);
        csvRows.push([normalizeDate(d.donation_date), donorName, d.payment_method || '', d.reference_number || '', childLabel, fundLabel, amt.toFixed(2)]);
      });
      const total = filteredDonations.reduce((s, d) => s + Number(d.amount || d.total_fair_market_value || 0), 0);
      csvRows.push(['TOTAL', '', '', '', '', '', total.toFixed(2)]);
    } else if (activeTab === 'transfers') {
      filename = `internal_transfers_${startDate || 'all'}_to_${endDate || 'all'}.csv`;
      csvRows.push(['INTERNAL TRANSFERS REPORT - ' + businessName]);
      csvRows.push([`Period: ${startDate || 'Start'} to ${endDate || 'End'}`]);
      csvRows.push([]);
      csvRows.push(['Date', 'Source (From)', 'Destination (To)', 'Status', `Amount (${currency})`]);
      filteredTransfers.forEach(t => {
        const fromDept = departments.find(d => d.id === t.from_department_id)?.name || 'N/A';
        const toDept = departments.find(d => d.id === t.to_department_id)?.name || 'N/A';
        csvRows.push([normalizeDate(t.transfer_date), fromDept, toDept, t.status || 'pending', Number(t.amount || 0).toFixed(2)]);
      });
      const total = filteredTransfers.reduce((s, t) => s + Number(t.amount || 0), 0);
      csvRows.push(['TOTAL', '', '', '', total.toFixed(2)]);
    } else if (activeTab === 'treasury') {
      filename = `treasury_bank_positions_${startDate || 'all'}_to_${endDate || 'all'}.csv`;
      csvRows.push(['BANK & CASH POSITIONS (TREASURY LIQUIDITY) - ' + businessName]);
      csvRows.push([`Generated on: ${new Date().toLocaleDateString()}`]);
      csvRows.push([]);
      csvRows.push(['Account Code', 'Account Name', 'Classification', 'Normal Balance', `Available Balance (${currency})`]);
      bankBalances.forEach(b => {
        csvRows.push([b.account.code, `"${b.account.name.replace(/"/g, '""')}"`, b.account.category || 'Liquid Assets', 'DEBIT (Asset)', b.balance.toFixed(2)]);
      });
      const totalLiquid = bankBalances.reduce((s, b) => s + b.balance, 0);
      csvRows.push(['TOTAL LIQUID AVAILABLE ASSETS', '', '', '', totalLiquid.toFixed(2)]);
    }

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filename} successfully`);
  };

  // ----------------------------------------------------
  // ON-SCREEN TAB RENDERS
  // ----------------------------------------------------

  const renderStatementOfActivities = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Total Inflow / Revenues (Net)</span>
            <span className="text-2xl md:text-3xl font-bold text-emerald-950 mt-1 block">{currency} {activitiesData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-xs text-emerald-600 mt-1 block">
              Gross CR: {currency} {activitiesData.totalGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })} &middot; DR Contra: {currency} {activitiesData.totalRevenueAdjustments.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </span>
          </div>
          <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block">Total Program Expenditures (Net)</span>
            <span className="text-2xl md:text-3xl font-bold text-rose-950 mt-1 block">{currency} {activitiesData.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-xs text-rose-600 mt-1 block">
              Gross DR: {currency} {activitiesData.totalGrossExpense.toLocaleString(undefined, { minimumFractionDigits: 0 })} &middot; CR Rebates: {currency} {activitiesData.totalExpenseAdjustments.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </span>
          </div>
          <div className={`p-5 rounded-2xl border ${activitiesData.netChange >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}>
            <span className={`text-xs font-bold uppercase tracking-wider block ${activitiesData.netChange >= 0 ? 'text-indigo-800' : 'text-amber-800'}`}>
              Net Assets Change ({activitiesData.netChange >= 0 ? 'Surplus' : 'Deficit'})
            </span>
            <span className={`text-2xl md:text-3xl font-bold mt-1 block ${activitiesData.netChange >= 0 ? 'text-indigo-950' : 'text-amber-950'}`}>
              {currency} {activitiesData.netChange.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-gray-500 mt-1 block">Recognized Net Revenues minus Net Expenses</span>
          </div>
        </div>

        {/* Revenue Streams Breakdown Table adhering strictly to double-entry accounting */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-emerald-50/60 to-indigo-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <PieChart className="text-emerald-600" size={20} />
                <h3 className="font-bold text-gray-900 text-base">
                  Revenue Streams & Funding Inflows Breakdown
                </h3>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Double-entry revenue recognition: Gross Credits (Inflows) minus Debits (Adjustments / Refunds)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                {activitiesData.revenueStreams.length} Revenue Stream(s)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Account Code</th>
                  <th className="py-3.5 px-6">Revenue Stream Name</th>
                  <th className="py-3.5 px-6 text-right">Gross Inflow (CR)</th>
                  <th className="py-3.5 px-6 text-right">Adjustments (DR)</th>
                  <th className="py-3.5 px-6 text-right">Net Recognized ({currency})</th>
                  <th className="py-3.5 px-6 text-right">% Share</th>
                  <th className="py-3.5 px-6 w-32">Allocation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {activitiesData.revenueStreams.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">
                      No revenue stream transactions recorded in this period. Try clearing date filters or clicking "All Records".
                    </td>
                  </tr>
                ) : (
                  activitiesData.revenueStreams.map((stream, idx) => (
                    <tr key={stream.accountId || idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 px-6 font-mono text-xs font-bold text-indigo-700">
                        {stream.code}
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="font-bold text-gray-900">{stream.name}</span>
                        {stream.category && (
                          <span className="text-[11px] text-gray-400 block">{stream.category}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right font-medium text-gray-700">
                        {currency} {stream.grossCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-6 text-right font-medium text-rose-600">
                        {stream.adjustmentsDebits > 0 
                          ? `(${currency} ${stream.adjustmentsDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` 
                          : '—'}
                      </td>
                      <td className="py-3.5 px-6 text-right font-extrabold text-emerald-700">
                        {currency} {stream.netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-6 text-right font-semibold text-gray-800">
                        {stream.percentage.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, stream.percentage))}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {activitiesData.revenueStreams.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-700">
                  <tr>
                    <td colSpan={2} className="py-3.5 px-6">Total Net Recognized Revenues</td>
                    <td className="py-3.5 px-6 text-right font-bold text-gray-900">
                      {currency} {activitiesData.totalGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-6 text-right font-bold text-rose-700">
                      {activitiesData.totalRevenueAdjustments > 0 ? `(${currency} ${activitiesData.totalRevenueAdjustments.toLocaleString(undefined, { minimumFractionDigits: 2 })})` : '—'}
                    </td>
                    <td className="py-3.5 px-6 text-right font-extrabold text-emerald-700 text-sm">
                      {currency} {activitiesData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-6 text-right">100.0%</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Revenues Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ArrowUpRight className="text-emerald-600" /> Inflow Ledger (Revenues)
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {activitiesData.revenueLines.length} items
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Fund / Department</th>
                  <th className="py-3 px-6">Description</th>
                  <th className="py-3 px-6 text-right">Amount ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {activitiesData.revenueLines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">
                      No revenue records found matching filters. Try clicking "All Records" or changing date range.
                    </td>
                  </tr>
                ) : (
                  activitiesData.revenueLines.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-6 font-mono text-xs">{row.date}</td>
                      <td className="py-3 px-6">
                        <span className="font-semibold text-gray-800">{row.fund}</span>
                        <span className="text-xs text-gray-400 block">{row.dept}</span>
                      </td>
                      <td className="py-3 px-6 text-gray-600">{row.description}</td>
                      <td className="py-3 px-6 text-right font-bold text-emerald-600">
                        {currency} {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expenditures Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ArrowDownLeft className="text-rose-600" /> Outflow Ledger (Expenditures)
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700">
              {activitiesData.expenseLines.length} items
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Fund / Department</th>
                  <th className="py-3 px-6">Description</th>
                  <th className="py-3 px-6 text-right">Amount ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {activitiesData.expenseLines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">
                      No expenditure records found matching filters. Try clicking "All Records" or changing date range.
                    </td>
                  </tr>
                ) : (
                  activitiesData.expenseLines.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-6 font-mono text-xs">{row.date}</td>
                      <td className="py-3 px-6">
                        <span className="font-semibold text-gray-800">{row.fund}</span>
                        <span className="text-xs text-gray-400 block">{row.dept}</span>
                      </td>
                      <td className="py-3 px-6 text-gray-600">{row.description}</td>
                      <td className="py-3 px-6 text-right font-bold text-rose-600">
                        {currency} {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderSchoolFeesReport = () => {
    const totalFees = schoolFeeRecords.reduce((sum, r) => sum + r.amount, 0);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl">
            <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider block">Total School Fees Processed</span>
            <span className="text-2xl md:text-3xl font-bold text-indigo-950 mt-1 block">{currency} {totalFees.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Total Recorded Transactions</span>
            <span className="text-2xl md:text-3xl font-bold text-slate-900 mt-1 block">{schoolFeeRecords.length} Payment(s)</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <GraduationCap className="text-indigo-600" /> School Fee Payments & Tuition Ledger
            </h3>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold">
              {schoolFeeRecords.length} Record(s) found
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Beneficiary</th>
                  <th className="py-3 px-6">Transaction Type</th>
                  <th className="py-3 px-6">Fund / Center</th>
                  <th className="py-3 px-6">Memo / Notes</th>
                  <th className="py-3 px-6 text-right">Amount ({currency})</th>
                  <th className="py-3 px-6 text-right print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {schoolFeeRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">
                      No school fee transactions match the filter criteria. Try clicking "All Records" or "Reset All Filters".
                    </td>
                  </tr>
                ) : (
                  schoolFeeRecords.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-6 font-mono text-xs">{row.date}</td>
                      <td className="py-3 px-6">
                        <span className="font-bold text-gray-800">{row.childName}</span>
                        <span className="text-xs text-gray-400 block">{row.childCode}</span>
                      </td>
                      <td className="py-3 px-6">
                        <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                          row.type.startsWith('Inflow') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-gray-600">
                        <span className="block font-medium">{row.fund}</span>
                        <span className="text-xs text-gray-400 block">{row.dept}</span>
                      </td>
                      <td className="py-3 px-6 text-gray-500 max-w-xs truncate">{row.description}</td>
                      <td className="py-3 px-6 text-right font-bold text-gray-900">
                        {currency} {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-6 text-right print:hidden">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handlePrintReceipt(row.entry)}
                            className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                            title="Print Receipt"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            onClick={() => handleDeletePayment(row.id)}
                            className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                            title="Void / Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderDonationsReport = () => {
    const totalDonations = filteredDonations.reduce((sum, d) => sum + Number(d.amount || d.total_fair_market_value || 0), 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Total Donor Contributions</span>
            <span className="text-2xl md:text-3xl font-bold text-emerald-950 mt-1 block">{currency} {totalDonations.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl">
            <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider block">Total Contributions Recorded</span>
            <span className="text-2xl md:text-3xl font-bold text-indigo-950 mt-1 block">{filteredDonations.length} Payments</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Heart className="text-rose-600" /> Donor Contributions Ledger
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {filteredDonations.length} records
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Donor</th>
                  <th className="py-3 px-6">Method / Ref</th>
                  <th className="py-3 px-6">Restricted Dimension</th>
                  <th className="py-3 px-6 text-right">Contribution ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredDonations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-medium">
                      No donation contributions match selection criteria. Try clicking "All Records" or "Reset All Filters".
                    </td>
                  </tr>
                ) : (
                  filteredDonations.map((row, idx) => {
                    const donorName = donors.find(d => d.id === row.donor_id)?.name || 'Anonymous Donor';
                    const child = children.find(c => c.id === row.restricted_to_child_id);
                    const childLabel = child ? `Child: ${child.first_name} ${child.last_name}` : null;
                    const fundLabel = funds.find(f => f.id === row.fund_id)?.name;
                    const amt = Number(row.amount || row.total_fair_market_value || 0);

                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-6 font-mono text-xs">{normalizeDate(row.donation_date)}</td>
                        <td className="py-3 px-6 font-bold text-gray-800">{donorName}</td>
                        <td className="py-3 px-6">
                          <span className="uppercase text-xs bg-slate-100 px-2 py-0.5 rounded font-bold text-gray-700">
                            {row.payment_method || 'Direct'}
                          </span>
                          <span className="text-xs text-gray-400 block mt-0.5">{row.reference_number || 'No Ref'}</span>
                        </td>
                        <td className="py-3 px-6 text-gray-600 text-xs font-medium">
                          {childLabel && <span className="block text-indigo-700 bg-indigo-50 w-fit px-2 py-0.5 rounded-full mb-1">{childLabel}</span>}
                          {fundLabel && <span className="block text-emerald-700 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">{fundLabel}</span>}
                          {!childLabel && !fundLabel && <span className="text-gray-400 italic">Unrestricted Fund</span>}
                        </td>
                        <td className="py-3 px-6 text-right font-bold text-emerald-600">
                          {currency} {amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderTransfersReport = () => {
    const totalTransfers = filteredTransfers.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl">
            <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider block">Total Inter-Department Transfers</span>
            <span className="text-2xl md:text-3xl font-bold text-indigo-950 mt-1 block">{currency} {totalTransfers.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Transfer Records</span>
            <span className="text-2xl md:text-3xl font-bold text-slate-900 mt-1 block">{filteredTransfers.length} Transfers</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ArrowRightLeft className="text-indigo-600" /> Inter-Departmental Transfers & Clearing Ledger
            </h3>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold">
              {filteredTransfers.length} Transfer(s)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Source (From)</th>
                  <th className="py-3 px-6">Destination (To)</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Amount ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-medium">
                      No internal transfers match chosen parameters. Try clicking "All Records" or "Reset All Filters".
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((row, idx) => {
                    const fromDeptName = departments.find(d => d.id === row.from_department_id)?.name || 'N/A';
                    const toDeptName = departments.find(d => d.id === row.to_department_id)?.name || 'N/A';

                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-6 font-mono text-xs">{normalizeDate(row.transfer_date)}</td>
                        <td className="py-3 px-6 font-medium text-rose-700">{fromDeptName}</td>
                        <td className="py-3 px-6 font-medium text-emerald-700">{toDeptName}</td>
                        <td className="py-3 px-6">
                          <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase ${
                            row.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {row.status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right font-bold text-gray-900">
                          {currency} {Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderTreasuryReport = () => {
    const totalLiquid = bankBalances.reduce((sum, b) => sum + b.balance, 0);

    return (
      <div className="space-y-6">
        {/* Bank & Cash Overview Cards with Transfer shortcut */}
        <BankBalanceOverview showTransferAction={true} />

        {/* Detailed Bank & Cash Accounts Ledger Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Landmark className="text-indigo-600" /> Bank & Liquid Asset Accounts Ledger
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Asset accounts normal balance is DEBIT: Real-time balance = Cumulative Debits minus Credits
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700">
              {bankBalances.length} Liquid Accounts
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Account Code</th>
                  <th className="py-3 px-6">Account / Bank Name</th>
                  <th className="py-3 px-6">Classification</th>
                  <th className="py-3 px-6">Normal Accounting Balance</th>
                  <th className="py-3 px-6 text-right">Liquid Balance ({currency})</th>
                  <th className="py-3 px-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {bankBalances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      No liquid bank or cash asset accounts found in Chart of Accounts.
                    </td>
                  </tr>
                ) : (
                  bankBalances.map(({ account, balance }) => {
                    const isHealthy = balance >= 0;
                    return (
                      <tr key={account.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3.5 px-6 font-mono text-xs font-bold text-indigo-700">
                          {account.code}
                        </td>
                        <td className="py-3.5 px-6">
                          <span className="font-bold text-gray-900 block">{account.name}</span>
                          <span className="text-xs text-gray-400">{account.description || 'Operating Account'}</span>
                        </td>
                        <td className="py-3.5 px-6 text-gray-600">
                          {account.category || 'Cash & Bank'}
                        </td>
                        <td className="py-3.5 px-6 font-mono text-xs text-gray-500">
                          DEBIT (Assets)
                        </td>
                        <td className={`py-3.5 px-6 text-right font-extrabold text-base ${isHealthy ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {currency} {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-6 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isHealthy ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {isHealthy ? <TrendingUp size={12} /> : <AlertCircle size={12} />}
                            {isHealthy ? 'Solvent' : 'Overdrawn'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {bankBalances.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-700">
                  <tr>
                    <td colSpan={4} className="py-3.5 px-6">TOTAL LIQUID BANK & CASH ASSETS</td>
                    <td className="py-3.5 px-6 text-right font-extrabold text-emerald-700 text-base">
                      {currency} {totalLiquid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Count active filters
  const activeFilterCount = [
    startDate !== currentYearStart && startDate ? 1 : 0,
    endDate !== todayStr && endDate ? 1 : 0,
    selectedFund ? 1 : 0,
    selectedDept ? 1 : 0,
    selectedChild ? 1 : 0,
    selectedDonor ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <FileText className="text-indigo-600" /> Fund Accounting Reports Workspace
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Audit fund allocations, donor contributions, internal transfers, and tuition fees for <strong>{businessName}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-xs"
            title="Download full dataset to CSV (Excel)"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
            title="Print entire multi-page report or save to PDF"
          >
            <Printer size={16} />
            Print / PDF Export
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-1 bg-white p-1.5 rounded-2xl border border-gray-200 w-full md:w-fit overflow-x-auto print:hidden shadow-xs">
        <button
          onClick={() => setActiveTab('activities')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'activities' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Statement of Activities
        </button>
        <button
          onClick={() => setActiveTab('fees')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'fees' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          School Fee Payments
        </button>
        <button
          onClick={() => setActiveTab('donations')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'donations' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Donations & Sponsorships
        </button>
        <button
          onClick={() => setActiveTab('transfers')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'transfers' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Internal Transfers
        </button>
        <button
          onClick={() => setActiveTab('treasury')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'treasury' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Bank & Cash Positions
        </button>
      </div>

      {/* Dynamic Filters Panel */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-200 space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-900">Query & Report Filters</h2>
            {activeFilterCount > 0 && (
              <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                {activeFilterCount} active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-gray-400 font-semibold uppercase">Presets:</span>
            <button
              onClick={() => handlePresetDate('this-month')}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium cursor-pointer"
            >
              This Month
            </button>
            <button
              onClick={() => handlePresetDate('this-year')}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium cursor-pointer"
            >
              This Year
            </button>
            <button
              onClick={() => handlePresetDate('last-30')}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium cursor-pointer"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => handlePresetDate('all')}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold cursor-pointer"
            >
              All Records
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold ml-2 cursor-pointer"
              >
                <RotateCcw size={12} />
                Reset Filters
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          {/* Start Date */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="pl-9 w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="pl-9 w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Fund selection */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Funding Account</label>
            <select
              value={selectedFund}
              onChange={e => setSelectedFund(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            >
              <option value="">All Funding Accounts</option>
              {funds.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
              ))}
            </select>
          </div>

          {/* Dept selection */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Department / Center</label>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary filters for targeted queries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-3">
          {/* Child Selection */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Sponsored Child (Beneficiary)</label>
            <select
              value={selectedChild}
              onChange={e => setSelectedChild(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            >
              <option value="">All Children</option>
              {children.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.code})</option>
              ))}
            </select>
          </div>

          {/* Donor Selection */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Donor / Sponsor</label>
            <select
              value={selectedDonor}
              onChange={e => setSelectedDonor(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            >
              <option value="">All Donors</option>
              {donors.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.email || 'No email'})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Primary Report Renders */}
      {loading ? (
        <div className="bg-white py-16 text-center rounded-2xl shadow-xs border border-gray-100">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <span className="text-sm font-semibold text-gray-500">Querying financial records for {businessName}...</span>
        </div>
      ) : (
        <div>
          {activeTab === 'activities' && renderStatementOfActivities()}
          {activeTab === 'fees' && renderSchoolFeesReport()}
          {activeTab === 'donations' && renderDonationsReport()}
          {activeTab === 'transfers' && renderTransfersReport()}
          {activeTab === 'treasury' && renderTreasuryReport()}
        </div>
      )}

      {/* Backup In-Page Print Stylesheet overriding overflow restrictions */}
      <style>{`
        @media print {
          html, body, #root, #root > div, .h-screen, main, div, .overflow-auto, .overflow-hidden, .overflow-x-auto {
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            position: static !important;
          }
          .print\\:hidden, header, nav, sidebar, button {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
};

export default FundReports;
