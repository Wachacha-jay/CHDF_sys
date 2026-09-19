import React, { useState, useMemo } from 'react';
import { 
  Building2, Download, Printer, Search, Filter, DollarSign, Users, 
  TrendingUp, PieChart, ShieldCheck, ArrowUpDown, ChevronDown 
} from 'lucide-react';
import type { PayrollRun, PayrollPeriod, Department } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface DepartmentBudgetingTabProps {
  payrollRuns: PayrollRun[];
  payrollPeriods: PayrollPeriod[];
  departments: Department[];
  currentPeriod: PayrollPeriod | null;
  onSelectPeriod?: (period: PayrollPeriod) => void;
  loading?: boolean;
}

const DepartmentBudgetingTab: React.FC<DepartmentBudgetingTabProps> = ({
  payrollRuns,
  payrollPeriods,
  departments,
  currentPeriod,
  loading = false
}) => {
  const { settings } = useSettingsContext();
  const currency = settings?.default_currency || 'KES';

  // Filters state
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(currentPeriod?.id || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeView, setActiveView] = useState<'employees' | 'summary'>('employees');

  const fmt = (n: number | string | undefined) =>
    Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filtered runs based on department, period, status, and search query
  const filteredRuns = useMemo(() => {
    return payrollRuns.filter((run) => {
      // Period filter
      if (selectedPeriodId !== 'all' && run.payroll_period_id !== selectedPeriodId) {
        return false;
      }

      // Department filter
      const empDept = run.employee?.department || 'Unassigned';
      if (selectedDept !== 'all') {
        if (empDept.toLowerCase() !== selectedDept.toLowerCase()) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && run.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${run.employee?.first_name || ''} ${run.employee?.last_name || ''}`.toLowerCase();
        const code = (run.employee?.code || '').toLowerCase();
        const pos = (run.employee?.position || '').toLowerCase();
        const dept = empDept.toLowerCase();
        if (!fullName.includes(q) && !code.includes(q) && !pos.includes(q) && !dept.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [payrollRuns, selectedPeriodId, selectedDept, statusFilter, searchQuery]);

  // Overall Totals for filtered runs
  const metrics = useMemo(() => {
    let totalBasic = 0;
    let totalAllowances = 0;
    let totalOvertimeHoliday = 0;
    let totalGross = 0;
    let totalTax = 0;
    let totalNssf = 0;
    let totalNhif = 0;
    let totalHousingLevy = 0;
    let totalSacco = 0;
    let totalOther = 0;
    let totalNet = 0;

    filteredRuns.forEach((r) => {
      totalBasic += Number(r.basic_salary || 0);
      totalAllowances += Number(r.allowances || 0) + Number(r.bonuses || 0);
      totalOvertimeHoliday += Number(r.overtime_pay || 0) + Number(r.holiday_pay || 0);
      totalGross += Number(r.gross_pay || 0);
      totalTax += Number(r.tax_deduction || 0);
      totalNssf += Number(r.nssf_deduction || 0);
      totalNhif += Number(r.nhif_deduction || 0);
      totalHousingLevy += Number(r.housing_levy_deduction || 0);
      totalSacco += Number(r.sacco_welfare_deduction || 0);
      totalOther += Number(r.other_deductions || 0);
      totalNet += Number(r.net_pay || 0);
    });

    const totalStatutory = totalTax + totalNssf + totalNhif + totalHousingLevy;
    const totalDeductions = totalStatutory + totalSacco + totalOther;

    return {
      count: filteredRuns.length,
      totalBasic,
      totalAllowances,
      totalOvertimeHoliday,
      totalGross,
      totalTax,
      totalNssf,
      totalNhif,
      totalHousingLevy,
      totalSacco,
      totalStatutory,
      totalDeductions,
      totalNet
    };
  }, [filteredRuns]);

  // Group by Department for summary rollup table
  const departmentSummaries = useMemo(() => {
    const map = new Map<string, {
      department: string;
      staffCount: number;
      basicSalary: number;
      grossPay: number;
      statutory: number;
      sacco: number;
      netPay: number;
    }>();

    filteredRuns.forEach((r) => {
      const deptName = r.employee?.department || 'Unassigned';
      const existing = map.get(deptName) || {
        department: deptName,
        staffCount: 0,
        basicSalary: 0,
        grossPay: 0,
        statutory: 0,
        sacco: 0,
        netPay: 0
      };

      existing.staffCount += 1;
      existing.basicSalary += Number(r.basic_salary || 0);
      existing.grossPay += Number(r.gross_pay || 0);
      existing.statutory += Number(r.tax_deduction || 0) + Number(r.nssf_deduction || 0) + Number(r.nhif_deduction || 0) + Number(r.housing_levy_deduction || 0);
      existing.sacco += Number(r.sacco_welfare_deduction || 0);
      existing.netPay += Number(r.net_pay || 0);

      map.set(deptName, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.grossPay - a.grossPay);
  }, [filteredRuns]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredRuns.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = [
      'Department',
      'Employee Code',
      'First Name',
      'Last Name',
      'Position',
      'Basic Salary (KES)',
      'Allowances (KES)',
      'Bonuses (KES)',
      'Overtime Pay (KES)',
      'Holiday Pay (KES)',
      'Gross Pay (KES)',
      'PAYE Tax (KES)',
      'NSSF (KES)',
      'NHIF / SHA (KES)',
      'Housing Levy (KES)',
      'Sacco & Welfare (KES)',
      'Other Deductions (KES)',
      'Net Pay (KES)',
      'Status',
      'Period Name'
    ];

    const rows = filteredRuns.map((r) => {
      const p = payrollPeriods.find(period => period.id === r.payroll_period_id);
      return [
        `"${r.employee?.department || 'Unassigned'}"`,
        `"${r.employee?.code || ''}"`,
        `"${r.employee?.first_name || ''}"`,
        `"${r.employee?.last_name || ''}"`,
        `"${r.employee?.position || ''}"`,
        Number(r.basic_salary || 0).toFixed(2),
        Number(r.allowances || 0).toFixed(2),
        Number(r.bonuses || 0).toFixed(2),
        Number(r.overtime_pay || 0).toFixed(2),
        Number(r.holiday_pay || 0).toFixed(2),
        Number(r.gross_pay || 0).toFixed(2),
        Number(r.tax_deduction || 0).toFixed(2),
        Number(r.nssf_deduction || 0).toFixed(2),
        Number(r.nhif_deduction || 0).toFixed(2),
        Number(r.housing_levy_deduction || 0).toFixed(2),
        Number(r.sacco_welfare_deduction || 0).toFixed(2),
        Number(r.other_deductions || 0).toFixed(2),
        Number(r.net_pay || 0).toFixed(2),
        `"${r.status || 'draft'}"`,
        `"${p?.period_name || ''}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const periodLabel = selectedPeriodId !== 'all' 
      ? (payrollPeriods.find(p => p.id === selectedPeriodId)?.period_name || 'period')
      : 'all_periods';
    const deptLabel = selectedDept !== 'all' ? selectedDept.replace(/\s+/g, '_') : 'all_departments';
    link.setAttribute('download', `payroll_budget_${deptLabel}_${periodLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Budgeting Report
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const periodName = selectedPeriodId !== 'all'
      ? (payrollPeriods.find(p => p.id === selectedPeriodId)?.period_name || 'Selected Period')
      : 'All Periods Combined';
    const deptName = selectedDept !== 'all' ? selectedDept : 'All Departments';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Department Payroll Budget Report - ${deptName}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; margin: 20px; }
            h1 { font-size: 18px; margin: 0 0 4px 0; color: #0f172a; }
            h2 { font-size: 13px; margin: 0 0 16px 0; color: #475569; font-weight: normal; }
            .kpis { display: flex; gap: 12px; margin-bottom: 20px; }
            .kpi { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; text-align: center; }
            .kpi-val { font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 4px; }
            .kpi-lbl { font-size: 10px; color: #64748b; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
            th { background-color: #f1f5f9; font-size: 10px; text-transform: uppercase; color: #334155; }
            .amount { text-align: right; font-family: monospace; font-weight: bold; }
            tfoot tr { background-color: #f8fafc; font-weight: bold; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>Department Payroll & Budgeting Report</h1>
          <h2>Department: <strong>${deptName}</strong> · Period: <strong>${periodName}</strong> · Generated: ${new Date().toLocaleDateString('en-KE')}</h2>
          
          <div class="kpis">
            <div class="kpi">
              <div class="kpi-lbl">Staff Count</div>
              <div class="kpi-val">${metrics.count} Employees</div>
            </div>
            <div class="kpi">
              <div class="kpi-lbl">Total Basic Salary</div>
              <div class="kpi-val">${currency} ${fmt(metrics.totalBasic)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-lbl">Total Gross Budget</div>
              <div class="kpi-val" style="color: #2563eb;">${currency} ${fmt(metrics.totalGross)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-lbl">Total Statutory Deductions</div>
              <div class="kpi-val" style="color: #dc2626;">${currency} ${fmt(metrics.totalStatutory)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-lbl">Total Net Disbursement</div>
              <div class="kpi-val" style="color: #16a34a;">${currency} ${fmt(metrics.totalNet)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Dept</th>
                <th>Code</th>
                <th>Employee Name</th>
                <th>Position</th>
                <th style="text-align: right;">Basic Salary</th>
                <th style="text-align: right;">Allowances</th>
                <th style="text-align: right;">Gross Cost</th>
                <th style="text-align: right;">PAYE</th>
                <th style="text-align: right;">NSSF</th>
                <th style="text-align: right;">NHIF</th>
                <th style="text-align: right;">Net Pay</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRuns.map(r => `
                <tr>
                  <td>${r.employee?.department || 'Unassigned'}</td>
                  <td>${r.employee?.code || ''}</td>
                  <td>${r.employee?.first_name || ''} ${r.employee?.last_name || ''}</td>
                  <td>${r.employee?.position || '—'}</td>
                  <td class="amount">${fmt(r.basic_salary)}</td>
                  <td class="amount">${fmt(Number(r.allowances || 0) + Number(r.bonuses || 0))}</td>
                  <td class="amount" style="color: #2563eb;">${fmt(r.gross_pay)}</td>
                  <td class="amount">${fmt(r.tax_deduction)}</td>
                  <td class="amount">${fmt(r.nssf_deduction)}</td>
                  <td class="amount">${fmt(r.nhif_deduction)}</td>
                  <td class="amount" style="color: #16a34a;">${fmt(r.net_pay)}</td>
                  <td>${(r.status || '').toUpperCase()}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4">Total (${metrics.count} staff)</td>
                <td class="amount">${fmt(metrics.totalBasic)}</td>
                <td class="amount">${fmt(metrics.totalAllowances)}</td>
                <td class="amount" style="color: #2563eb;">${fmt(metrics.totalGross)}</td>
                <td class="amount">${fmt(metrics.totalTax)}</td>
                <td class="amount">${fmt(metrics.totalNssf)}</td>
                <td class="amount">${fmt(metrics.totalNhif)}</td>
                <td class="amount" style="color: #16a34a;">${fmt(metrics.totalNet)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <div className="space-y-5">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Department Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Department:
              </span>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Departments ({departments.length})</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Pay Period Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Period:</span>
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Periods Combined</option>
                {payrollPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_name} ({p.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          {/* Action Buttons: Export CSV & Print */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleExportCSV}
              disabled={filteredRuns.length === 0}
              className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors cursor-pointer disabled:opacity-40"
              title="Download detailed CSV report for budgeting in Excel"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              Download CSV
            </button>
            <button
              onClick={handlePrint}
              disabled={filteredRuns.length === 0}
              className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-40"
              title="Print formatted budget sheet"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print Report
            </button>
          </div>
        </div>

        {/* Search bar inside filter box */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff, code, position or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
          </div>

          {/* View toggle pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveView('employees')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                activeView === 'employees' 
                  ? 'bg-white text-blue-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Employee List ({filteredRuns.length})
            </button>
            <button
              onClick={() => setActiveView('summary')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                activeView === 'summary' 
                  ? 'bg-white text-blue-600 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dept Rollup ({departmentSummaries.length})
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Headcount</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">{metrics.count}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Staff in filter</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Basic Salary</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-sm font-black text-slate-800 mt-1 font-mono">
            {currency} {fmt(metrics.totalBasic)}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Base commitments</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Allowances & OT</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-sm font-black text-emerald-700 mt-1 font-mono">
            +{currency} {fmt(metrics.totalAllowances + metrics.totalOvertimeHoliday)}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Extra compensation</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">Gross Budget</span>
            <PieChart className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-base font-black text-blue-700 mt-1 font-mono">
            {currency} {fmt(metrics.totalGross)}
          </div>
          <p className="text-[10px] text-blue-600/70 mt-0.5">Total department cost</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Statutory Tax/Levy</span>
            <ShieldCheck className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-sm font-black text-red-600 mt-1 font-mono">
            –{currency} {fmt(metrics.totalStatutory)}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">PAYE, NSSF, NHIF, Levy</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Net Take-Home</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-base font-black text-emerald-700 mt-1 font-mono">
            {currency} {fmt(metrics.totalNet)}
          </div>
          <p className="text-[10px] text-emerald-600/70 mt-0.5">Direct staff disbursement</p>
        </div>
      </div>

      {/* Main Table View */}
      {activeView === 'employees' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Employee Runs Breakdown ({filteredRuns.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-semibold">
              Total Budget: <strong className="text-blue-700">{currency} {fmt(metrics.totalGross)}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Position</th>
                  <th className="py-3 px-4 text-right">Basic Salary</th>
                  <th className="py-3 px-4 text-right">Allowances/OT</th>
                  <th className="py-3 px-4 text-right">Gross Cost</th>
                  <th className="py-3 px-4 text-right">Statutory</th>
                  <th className="py-3 px-4 text-right">Sacco</th>
                  <th className="py-3 px-4 text-right">Net Pay</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRuns.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400">
                      <Building2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-xs">No payroll runs found for selected filters</p>
                      <p className="text-[10px] mt-0.5">Select another department or period above.</p>
                    </td>
                  </tr>
                ) : (
                  filteredRuns.map((r) => {
                    const statutory = 
                      Number(r.tax_deduction || 0) + 
                      Number(r.nssf_deduction || 0) + 
                      Number(r.nhif_deduction || 0) + 
                      Number(r.housing_levy_deduction || 0);

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            {r.employee?.department || 'Unassigned'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-black text-slate-900">
                            {r.employee?.first_name} {r.employee?.last_name}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{r.employee?.code}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {r.employee?.position || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {fmt(r.basic_salary)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">
                          +{fmt(Number(r.allowances || 0) + Number(r.bonuses || 0) + Number(r.overtime_pay || 0) + Number(r.holiday_pay || 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-blue-700 bg-blue-50/30">
                          {fmt(r.gross_pay)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-red-600 font-semibold">
                          –{fmt(statutory)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-indigo-600 font-medium">
                          {Number(r.sacco_welfare_deduction || 0) > 0 ? `–${fmt(r.sacco_welfare_deduction)}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 bg-emerald-50/30">
                          {fmt(r.net_pay)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            r.status === 'paid' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : r.status === 'approved' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {r.status || 'draft'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredRuns.length > 0 && (
                <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-slate-800">
                      Total ({metrics.count} Employees)
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{fmt(metrics.totalBasic)}</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700">
                      +{fmt(metrics.totalAllowances + metrics.totalOvertimeHoliday)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-800 bg-blue-100/50">
                      {fmt(metrics.totalGross)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-red-700">
                      –{fmt(metrics.totalStatutory)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-indigo-700">
                      {metrics.totalSacco > 0 ? `–${fmt(metrics.totalSacco)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-800 bg-emerald-100/50 text-sm">
                      {fmt(metrics.totalNet)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        /* Summary Rollup by Department */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Departmental Budget Comparison & Rollup
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">
              {departmentSummaries.length} Departments Total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Staff Count</th>
                  <th className="py-3 px-4 text-right">Basic Salary</th>
                  <th className="py-3 px-4 text-right">Gross Budget</th>
                  <th className="py-3 px-4 text-right">Statutory Deductions</th>
                  <th className="py-3 px-4 text-right">Net Payout</th>
                  <th className="py-3 px-4 text-right">% of Total Payroll</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {departmentSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      No departmental data found.
                    </td>
                  </tr>
                ) : (
                  departmentSummaries.map((dept) => {
                    const sharePct = metrics.totalGross > 0 ? (dept.grossPay / metrics.totalGross) * 100 : 0;
                    return (
                      <tr key={dept.department} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-black text-slate-900 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>{dept.department}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-bold px-2 py-0.5 bg-slate-100 rounded-full text-slate-700 text-xs">
                            {dept.staffCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          {currency} {fmt(dept.basicSalary)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-blue-700 bg-blue-50/30">
                          {currency} {fmt(dept.grossPay)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-red-600 font-semibold">
                          –{currency} {fmt(dept.statutory)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 bg-emerald-50/30">
                          {currency} {fmt(dept.netPay)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${Math.min(100, sharePct)}%` }} 
                              />
                            </div>
                            <span className="font-mono font-bold text-xs text-slate-800 w-12 text-right">
                              {sharePct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {departmentSummaries.length > 0 && (
                <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-200">
                  <tr>
                    <td className="py-3.5 px-4 text-slate-800">
                      All Departments Total ({metrics.count} staff)
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold">{metrics.count}</td>
                    <td className="py-3.5 px-4 text-right font-mono">{currency} {fmt(metrics.totalBasic)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-blue-800 bg-blue-100/50">
                      {currency} {fmt(metrics.totalGross)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-red-700">
                      –{currency} {fmt(metrics.totalStatutory)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-800 bg-emerald-100/50">
                      {currency} {fmt(metrics.totalNet)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">100.0%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentBudgetingTab;
