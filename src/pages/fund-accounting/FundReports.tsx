import React, { useState, useEffect } from 'react';
import { FundAccountingService } from '../../services/fundAccountingService';
import { AccountingService } from '../../services/accountingService';
import { ApiService } from '../../services/api';
import { BusinessSettingsService } from '../../services/businessSettingsService';
import { printPaymentReceipt } from '../../utils/receiptUtils';
import { 
  FileText, Calendar, Printer, Filter, DollarSign, ArrowUpRight, 
  ArrowDownLeft, ArrowRightLeft, Users, GraduationCap, Heart, HelpCircle,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Department, FundAccount, Child, Donor, JournalEntry, InternalTransfer } from '../../types';


type ReportTab = 'activities' | 'fees' | 'donations' | 'transfers';

const FundReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('activities');
  const [loading, setLoading] = useState(true);
  const [businessSettings, setBusinessSettings] = useState<any>(null);

  // Filter States
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFund, setSelectedFund] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedChild, setSelectedChild] = useState('');
  const [selectedDonor, setSelectedDonor] = useState('');

  // Dropdown Master Data
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);

  // Loaded Transaction Data
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [transfers, setTransfers] = useState<InternalTransfer[]>([]);
  const [donationsList, setDonationsList] = useState<any[]>([]);

  // Master Data Loader
  const loadMasterData = async () => {
    try {
      const [fList, dList, cList, donorList, settings] = await Promise.all([
        FundAccountingService.getFundAccounts(),
        FundAccountingService.getDepartments(),
        FundAccountingService.getChildren(),
        FundAccountingService.getDonors(),
        BusinessSettingsService.getSettings()
      ]);
      setFunds(fList);
      setDepartments(dList);
      setChildren(cList);
      setDonors(donorList);
      setBusinessSettings(settings);
    } catch (e) {
      console.error('Error loading master data', e);
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
      loadReportData();
    } else {
      toast.error('Failed to void school fee payment.');
    }
  };

  // Report Loader
  const loadReportData = async () => {
    setLoading(true);
    try {
      // 1. Fetch journal entries
      const entries = await AccountingService.getJournalEntries({
        start_date: startDate,
        end_date: endDate,
        is_posted: true
      });
      setJournalEntries(entries);

      // 2. Fetch direct donations
      const donationsResponse = await ApiService.get<any>('donations');
      if (donationsResponse.success && donationsResponse.data) {
        let list = donationsResponse.data;
        if (startDate) list = list.filter(d => d.donation_date >= startDate);
        if (endDate) list = list.filter(d => d.donation_date <= endDate);
        setDonationsList(list);
      }

      // 3. Fetch transfers
      const transfersResponse = await ApiService.get<InternalTransfer>('internal_transfers');
      if (transfersResponse.success && transfersResponse.data) {
        let list = transfersResponse.data;
        if (startDate) list = list.filter(t => t.transfer_date >= startDate);
        if (endDate) list = list.filter(t => t.transfer_date <= endDate);
        setTransfers(list);
      }
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

  const handlePrint = () => {
    window.print();
  };

  // ----------------------------------------------------
  // REPORT 1: STATEMENT OF ACTIVITIES (Income/Expenditure)
  // ----------------------------------------------------
  const renderStatementOfActivities = () => {
    let revenueLines: any[] = [];
    let expenseLines: any[] = [];

    journalEntries.forEach(entry => {
      entry.lines?.forEach(line => {
        // Apply Filters
        if (selectedFund && line.fund_id !== selectedFund) return;
        if (selectedDept && line.department_id !== selectedDept) return;

        const isRevenue = line.account?.account_type === 'revenue' || line.account?.code?.startsWith('4');
        const isExpense = line.account?.account_type === 'expense' || line.account?.code?.startsWith('5');

        if (isRevenue) {
          revenueLines.push({
            date: entry.entry_date,
            description: line.description || entry.description,
            amount: line.credit_amount || 0,
            fund: funds.find(f => f.id === line.fund_id)?.name || 'General NGO',
            dept: departments.find(d => d.id === line.department_id)?.name || 'General Admin'
          });
        } else if (isExpense) {
          expenseLines.push({
            date: entry.entry_date,
            description: line.description || entry.description,
            amount: line.debit_amount || 0,
            fund: funds.find(f => f.id === line.fund_id)?.name || 'General NGO',
            dept: departments.find(d => d.id === line.department_id)?.name || 'General Admin'
          });
        }
      });
    });

    const totalRevenue = revenueLines.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expenseLines.reduce((sum, e) => sum + e.amount, 0);
    const netChange = totalRevenue - totalExpense;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl">
            <span className="text-sm font-semibold text-emerald-800 uppercase tracking-wider block">Total Inflow / Revenues</span>
            <span className="text-3xl font-bold text-emerald-950 mt-1 block">KES {totalRevenue.toLocaleString()}</span>
          </div>
          <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl">
            <span className="text-sm font-semibold text-rose-800 uppercase tracking-wider block">Total Program Expenditures</span>
            <span className="text-3xl font-bold text-rose-950 mt-1 block">KES {totalExpense.toLocaleString()}</span>
          </div>
          <div className={`p-5 rounded-2xl border ${netChange >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}>
            <span className={`text-sm font-semibold uppercase tracking-wider block ${netChange >= 0 ? 'text-indigo-800' : 'text-amber-800'}`}>
              Net Assets Change
            </span>
            <span className={`text-3xl font-bold mt-1 block ${netChange >= 0 ? 'text-indigo-950' : 'text-amber-950'}`}>
              KES {netChange.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><ArrowUpRight className="text-emerald-600"/> Inflow Ledger (Revenues)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Fund / Department</th>
                  <th className="py-3 px-6">Description</th>
                  <th className="py-3 px-6 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {revenueLines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-400">No revenue records found matching filters</td>
                  </tr>
                ) : (
                  revenueLines.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-3 px-6 font-mono text-xs">{row.date}</td>
                      <td className="py-3 px-6">
                        <span className="font-medium text-gray-800">{row.fund}</span>
                        <span className="text-xs text-gray-400 block">{row.dept}</span>
                      </td>
                      <td className="py-3 px-6 text-gray-600">{row.description}</td>
                      <td className="py-3 px-6 text-right font-semibold text-emerald-600">KES {row.amount.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><ArrowDownLeft className="text-rose-600"/> Outflow Ledger (Expenditures)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Fund / Department</th>
                  <th className="py-3 px-6">Description</th>
                  <th className="py-3 px-6 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {expenseLines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-400">No expenditure records found matching filters</td>
                  </tr>
                ) : (
                  expenseLines.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-3 px-6 font-mono text-xs">{row.date}</td>
                      <td className="py-3 px-6">
                        <span className="font-medium text-gray-800">{row.fund}</span>
                        <span className="text-xs text-gray-400 block">{row.dept}</span>
                      </td>
                      <td className="py-3 px-6 text-gray-600">{row.description}</td>
                      <td className="py-3 px-6 text-right font-semibold text-rose-600">KES {row.amount.toLocaleString()}</td>
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

  // ----------------------------------------------------
  // REPORT 2: SCHOOL FEE PAYMENTS REPORT
  // ----------------------------------------------------
  const renderSchoolFeesReport = () => {
    const feeRecords: any[] = [];

    journalEntries.forEach(entry => {
      entry.lines?.forEach(line => {
        // Must be tagged to a Child beneficiary, and relate to tuition revenue/expense (4300 or 5310)
        const isFeeRelated = line.account?.code === '4300' || line.account?.code === '5310' || line.account?.code === '5350';
        if (!isFeeRelated) return;
        if (!line.child_id) return;

        // Apply Filters
        if (selectedChild && line.child_id !== selectedChild) return;
        if (selectedFund && line.fund_id !== selectedFund) return;
        if (selectedDept && line.department_id !== selectedDept) return;

        const childObj = children.find(c => c.id === line.child_id);
        const childName = childObj ? `${childObj.first_name} ${childObj.last_name}` : 'N/A';
        const childCode = childObj?.code || 'N/A';

        feeRecords.push({
          id: entry.id,
          entry: entry,
          date: entry.entry_date,
          childName,
          childCode,
          description: line.description || entry.description,
          type: line.account?.code === '4300' ? 'Inflow (Guardian Pay)' : 'Outflow (NGO Pay School)',
          amount: line.credit_amount > 0 ? line.credit_amount : line.debit_amount,
          fund: funds.find(f => f.id === line.fund_id)?.name || 'General Education',
          dept: departments.find(d => d.id === line.department_id)?.name || 'Education'
        });
      });
    });

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><GraduationCap className="text-indigo-600"/> School Fee Payments & Tuition Ledger</h3>
          <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold">
            {feeRecords.length} Record(s) found
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
                <th className="py-3 px-6 text-right">Amount</th>
                <th className="py-3 px-6 text-right print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {feeRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">No school fee transactions match the filter criteria</td>
                </tr>
              ) : (
                feeRecords.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
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
                    <td className="py-3 px-6 text-right font-bold text-gray-900">KES {row.amount.toLocaleString()}</td>
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
    );
  };

  // ----------------------------------------------------
  // REPORT 3: DONATIONS & SPONSORSHIPS REPORT
  // ----------------------------------------------------
  const renderDonationsReport = () => {
    // Filter Donations based on dropdowns
    const filteredDonations = donationsList.filter(don => {
      if (selectedDonor && don.donor_id !== selectedDonor) return false;
      if (selectedFund && don.fund_id !== selectedFund) return false;
      if (selectedChild && don.restricted_to_child_id !== selectedChild) return false;
      return true;
    });

    const totalDonations = filteredDonations.reduce((sum, d) => sum + Number(d.amount), 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl">
            <span className="text-sm font-semibold text-emerald-800 uppercase tracking-wider block">Total Donor Contributions</span>
            <span className="text-3xl font-bold text-emerald-950 mt-1 block">KES {totalDonations.toLocaleString()}</span>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl">
            <span className="text-sm font-semibold text-indigo-800 uppercase tracking-wider block">Total Donations Recorded</span>
            <span className="text-3xl font-bold text-indigo-950 mt-1 block">{filteredDonations.length} Payments</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><Heart className="text-rose-600"/> Donor Contributions Ledger</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Donor</th>
                  <th className="py-3 px-6">Method / Ref</th>
                  <th className="py-3 px-6">Restricted Dimension</th>
                  <th className="py-3 px-6 text-right">Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredDonations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-medium">No donation contributions match selection criteria</td>
                  </tr>
                ) : (
                  filteredDonations.map((row, idx) => {
                    const donorName = donors.find(d => d.id === row.donor_id)?.name || 'Anonymous Donor';
                    const childName = children.find(c => c.id === row.restricted_to_child_id);
                    const childLabel = childName ? `Child: ${childName.first_name} ${childName.last_name}` : null;
                    const fundLabel = funds.find(f => f.id === row.fund_id)?.name;

                    return (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-3 px-6 font-mono text-xs">{row.donation_date}</td>
                        <td className="py-3 px-6 font-bold text-gray-800">{donorName}</td>
                        <td className="py-3 px-6">
                          <span className="uppercase text-xs bg-slate-100 px-2 py-0.5 rounded font-bold text-gray-700">
                            {row.payment_method}
                          </span>
                          <span className="text-xs text-gray-400 block mt-0.5">{row.reference_number || 'No Ref'}</span>
                        </td>
                        <td className="py-3 px-6 text-gray-600 text-xs font-medium">
                          {childLabel && <span className="block text-indigo-700 bg-indigo-50 w-fit px-2 py-0.5 rounded-full mb-1">{childLabel}</span>}
                          {fundLabel && <span className="block text-emerald-700 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">{fundLabel}</span>}
                          {!childLabel && !fundLabel && <span className="text-gray-400 italic">Unrestricted Fund</span>}
                        </td>
                        <td className="py-3 px-6 text-right font-bold text-emerald-600">KES {Number(row.amount).toLocaleString()}</td>
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

  // ----------------------------------------------------
  // REPORT 4: INTERNAL TRANSFERS & LOANS
  // ----------------------------------------------------
  const renderTransfersReport = () => {
    // Filter internal transfers
    const filteredTransfers = transfers.filter(tr => {
      if (selectedDept && tr.from_department_id !== selectedDept && tr.to_department_id !== selectedDept) return false;
      return true;
    });

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><ArrowRightLeft className="text-indigo-600"/> Inter-Departmental Transfers & Clearing Ledger</h3>
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
                <th className="py-3 px-6">Transfer Class</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 font-medium">No internal transfers match chosen parameters</td>
                </tr>
              ) : (
                filteredTransfers.map((row, idx) => {
                  const fromDeptName = departments.find(d => d.id === row.from_department_id)?.name || 'N/A';
                  const toDeptName = departments.find(d => d.id === row.to_department_id)?.name || 'N/A';
                  // @ts-ignore
                  const tClass = row.transfer_type || 'Direct Transfer';

                  return (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-3 px-6 font-mono text-xs">{row.transfer_date}</td>
                      <td className="py-3 px-6 font-medium text-rose-700">{fromDeptName}</td>
                      <td className="py-3 px-6 font-medium text-emerald-700">{toDeptName}</td>
                      <td className="py-3 px-6">
                        <span className="capitalize text-xs bg-slate-100 font-bold px-2 py-0.5 rounded-full text-slate-700">
                          {tClass.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-6">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full uppercase ${
                          row.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right font-bold text-gray-900">KES {row.amount.toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header Panel - HIDDEN ON PRINT */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FileText className="text-indigo-600"/> Fund Accounting Reports Workspace
          </h1>
          <p className="text-gray-500 mt-1">Designated workspace to audit fund allocations, donations, internal transfers, and tuition fees</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
        >
          <Printer size={18} />
          Print / PDF Export
        </button>
      </div>

      {/* Tabs Menu - HIDDEN ON PRINT */}
      <div className="flex gap-1 bg-white p-1.5 rounded-2xl border border-gray-200 w-full md:w-fit overflow-x-auto print:hidden shadow-sm">
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
      </div>

      {/* Dynamic Filters Panel - HIDDEN ON PRINT */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 print:hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <Filter size={16} className="text-gray-400"/>
          <h2 className="text-sm font-bold text-gray-900">Query & Report Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          {/* Start Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="pl-9 w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="pl-9 w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
          </div>

          {/* Fund selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Funding Account</label>
            <select
              value={selectedFund}
              onChange={e => setSelectedFund(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
            >
              <option value="">All Funding Accounts</option>
              {funds.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
              ))}
            </select>
          </div>

          {/* Dept selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Department / Cost Center</label>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Extended Filters for targeted tabs */}
        {(activeTab === 'fees' || activeTab === 'donations') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-4">
            {/* Child Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Sponsored Beneficiary (Child)</label>
              <select
                value={selectedChild}
                onChange={e => setSelectedChild(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              >
                <option value="">All Children</option>
                {children.map(c => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.code})</option>
                ))}
              </select>
            </div>

            {/* Donor Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">NGO Donor / Sponsor</label>
              <select
                value={selectedDonor}
                onChange={e => setSelectedDonor(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              >
                <option value="">All Donors</option>
                {donors.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.email || 'No email'})</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block border-b-2 border-indigo-600 pb-4 mb-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">BIZMANAGER</h1>
            <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              NGO Fund Accounting Sub-system
            </span>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-800">
              {activeTab === 'activities' && 'Statement of Activities Report'}
              {activeTab === 'fees' && 'School Fees Payment & Tuition Report'}
              {activeTab === 'donations' && 'Donor Contributions Ledger'}
              {activeTab === 'transfers' && 'Inter-Departmental Clearing Report'}
            </h2>
            <span className="text-xs text-slate-500 font-medium block mt-1">
              Reporting Cycle: {startDate} to {endDate}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Report Renders */}
      {loading ? (
        <div className="bg-white py-16 text-center rounded-2xl shadow-sm border border-gray-100">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <span className="text-sm font-semibold text-gray-500">Querying transactions and allocating ledger lines...</span>
        </div>
      ) : (
        <div className="print:p-0">
          {activeTab === 'activities' && renderStatementOfActivities()}
          {activeTab === 'fees' && renderSchoolFeesReport()}
          {activeTab === 'donations' && renderDonationsReport()}
          {activeTab === 'transfers' && renderTransfersReport()}
        </div>
      )}

      {/* Printable custom stylesheet injection */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .min-h-screen {
            min-height: auto !important;
            background-color: white !important;
          }
          .p-6 {
            padding: 0 !important;
          }
          /* Hide non-printable panels */
          .print\\:hidden,
          header,
          nav,
          sidebar,
          button,
          .bg-indigo-600,
          .w-fit {
            display: none !important;
          }
          /* Ensure full tables width */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            border-bottom: 2px solid #cbd5e1 !important;
          }
          td, th {
            padding: 10px 12px !important;
            font-size: 11px !important;
            border-bottom: 1px solid #e2e8f0 !important;
          }
          .bg-white {
            box-shadow: none !important;
            border: none !important;
          }
          .shadow-sm, .shadow-md, .shadow-lg {
            box-shadow: none !important;
          }
          /* Keep grid structures simple */
          .grid {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 12px !important;
            margin-bottom: 20px !important;
          }
          .bg-emerald-50, .bg-rose-50, .bg-indigo-50, .bg-amber-50 {
            background-color: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            padding: 12px !important;
          }
          .text-emerald-950, .text-rose-950, .text-indigo-950, .text-amber-950 {
            color: #0f172a !important;
          }
        }
      `}</style>
    </div>
  );
};

export default FundReports;
