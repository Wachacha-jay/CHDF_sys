import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, Download, Printer, Search, Filter, DollarSign, Users, 
  TrendingUp, PieChart, ShieldCheck, ArrowUpDown, ChevronDown,
  SlidersHorizontal, CheckSquare, Square, X, RotateCcw, Check
} from 'lucide-react';
import type { PayrollRun, PayrollPeriod, Department } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';

export interface BudgetColumnDef {
  id: string;
  label: string;
  shortLabel: string;
  group: 'Employee Info' | 'Earnings' | 'Deductions' | 'Disbursement';
  align: 'left' | 'right' | 'center';
  isNumeric?: boolean;
}

export const ALL_BUDGET_COLUMNS: BudgetColumnDef[] = [
  { id: 'dept', label: 'Department', shortLabel: 'Dept', group: 'Employee Info', align: 'left' },
  { id: 'code', label: 'Staff Code', shortLabel: 'Code', group: 'Employee Info', align: 'left' },
  { id: 'name', label: 'Employee Name', shortLabel: 'Employee', group: 'Employee Info', align: 'left' },
  { id: 'position', label: 'Position / Role', shortLabel: 'Position', group: 'Employee Info', align: 'left' },
  { id: 'basic', label: 'Basic Salary', shortLabel: 'Basic Salary', group: 'Earnings', align: 'right', isNumeric: true },
  { id: 'allowances', label: 'Allowances & OT', shortLabel: 'Allowances/OT', group: 'Earnings', align: 'right', isNumeric: true },
  { id: 'gross', label: 'Gross Pay (Budget)', shortLabel: 'Gross Cost', group: 'Earnings', align: 'right', isNumeric: true },
  { id: 'paye', label: 'PAYE Tax', shortLabel: 'PAYE', group: 'Deductions', align: 'right', isNumeric: true },
  { id: 'nssf', label: 'NSSF Deduction', shortLabel: 'NSSF', group: 'Deductions', align: 'right', isNumeric: true },
  { id: 'nhif', label: 'NHIF / SHA Deduction', shortLabel: 'NHIF/SHA', group: 'Deductions', align: 'right', isNumeric: true },
  { id: 'housingLevy', label: 'Housing Levy', shortLabel: 'Housing Levy', group: 'Deductions', align: 'right', isNumeric: true },
  { id: 'sacco', label: 'Sacco & Welfare', shortLabel: 'Sacco', group: 'Deductions', align: 'right', isNumeric: true },
  { id: 'other', label: 'Other Deductions', shortLabel: 'Other Ded.', group: 'Deductions', align: 'right', isNumeric: true },
  { id: 'net', label: 'Net Pay Disbursement', shortLabel: 'Net Pay', group: 'Disbursement', align: 'right', isNumeric: true },
  { id: 'paymentRef', label: 'Payment Ref / Cheque', shortLabel: 'Payment Ref / Cheque', group: 'Disbursement', align: 'left' },
  { id: 'status', label: 'Status', shortLabel: 'Status', group: 'Disbursement', align: 'center' }
];

export const DEFAULT_COLUMNS = [
  'dept',
  'code',
  'name',
  'position',
  'basic',
  'allowances',
  'gross',
  'paye',
  'nssf',
  'nhif',
  'sacco',
  'net',
  'paymentRef',
  'status'
];

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

  // Columns & Print Customization State
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dept_budget_columns');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_COLUMNS;
  });
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');

  // Persist selected columns
  useEffect(() => {
    try {
      localStorage.setItem('dept_budget_columns', JSON.stringify(selectedColumns));
    } catch {}
  }, [selectedColumns]);

  const toggleColumn = (id: string) => {
    setSelectedColumns((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // Keep at least one column
        return prev.filter((colId) => colId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const applyColumnPreset = (preset: 'default' | 'compact' | 'disbursement' | 'all') => {
    if (preset === 'default') {
      setSelectedColumns(DEFAULT_COLUMNS);
    } else if (preset === 'compact') {
      // Omit Allowances and NSSF as requested by user
      setSelectedColumns(DEFAULT_COLUMNS.filter(c => c !== 'allowances' && c !== 'nssf'));
    } else if (preset === 'disbursement') {
      setSelectedColumns(['dept', 'code', 'name', 'position', 'basic', 'gross', 'sacco', 'net', 'paymentRef', 'status']);
    } else if (preset === 'all') {
      setSelectedColumns(ALL_BUDGET_COLUMNS.map(c => c.id));
    }
  };

  const visibleCols = useMemo(() => {
    return ALL_BUDGET_COLUMNS.filter(c => selectedColumns.includes(c.id));
  }, [selectedColumns]);

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
      'Payment Reference / Cheque',
      'Bank Name',
      'Bank Account',
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
        `"${r.payment_reference || ''}"`,
        `"${r.employee?.bank_name || ''}"`,
        `"${r.employee?.bank_account || ''}"`,
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

  // Print Budgeting Report with official Business Settings letterhead, logo, landscape layout, and customized columns
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const periodName = selectedPeriodId !== 'all'
      ? (payrollPeriods.find(p => p.id === selectedPeriodId)?.period_name || 'Selected Period')
      : 'All Periods Combined';
    const deptName = selectedDept !== 'all' ? selectedDept : 'All Departments';
    const statusLabel = statusFilter !== 'all' ? statusFilter.toUpperCase() : 'ALL STATUSES';

    // Business branding & letterhead details
    const bName = settings?.business_name || 'EMPOWER HEARTS SPECIAL SCHOOL';
    const bLogo = settings?.logo_url || '';
    const bAddress = settings?.business_address || '';
    const bPhone = settings?.business_phone || '';
    const bEmail = settings?.business_email || '';
    const bWebsite = settings?.business_website || '';
    const kraPin = (settings as any)?.kra_pin || (settings as any)?.tax_pin || '';

    // Active visible columns for printing
    const colsToPrint = visibleCols;
    const firstNumIdx = colsToPrint.findIndex(c => c.isNumeric);
    const infoColSpan = firstNumIdx > 0 ? firstNumIdx : 1;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Department Payroll Budget Report - ${deptName} (${periodName})</title>
          <style>
            @page {
              size: ${printOrientation};
              margin: 8mm 10mm 10mm 10mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              font-size: 9.5px;
              color: #1e293b;
              margin: 0;
              padding: 10px 14px;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            /* LETTERHEAD */
            .letterhead {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2.5px solid #2563eb;
              padding-bottom: 12px;
              margin-bottom: 12px;
            }
            .letterhead-brand {
              display: flex;
              align-items: center;
              gap: 14px;
            }
            .biz-logo {
              max-height: 60px;
              max-width: 150px;
              object-fit: contain;
            }
            .biz-name {
              font-size: 17px;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: -0.3px;
              text-transform: uppercase;
              margin: 0 0 2px 0;
            }
            .biz-contact {
              font-size: 8.5px;
              color: #64748b;
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
              margin-top: 3px;
            }
            .letterhead-meta {
              text-align: right;
            }
            .report-badge {
              display: inline-block;
              background: #eff6ff;
              color: #1d4ed8;
              font-weight: 800;
              font-size: 8px;
              padding: 2px 7px;
              border-radius: 4px;
              border: 1px solid #bfdbfe;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .report-title {
              font-size: 14px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 2px 0;
            }
            .report-sub {
              font-size: 8.5px;
              color: #64748b;
              margin-top: 2px;
            }
            /* META STRIP */
            .meta-strip {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 6px 12px;
              margin-bottom: 12px;
              font-size: 9px;
            }
            .meta-pill {
              display: inline-flex;
              gap: 4px;
              color: #475569;
            }
            .meta-pill strong {
              color: #0f172a;
            }
            /* KPIS */
            .kpis {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 8px;
              margin-bottom: 12px;
            }
            .kpi {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 6px 8px;
              background: #f8fafc;
              text-align: center;
            }
            .kpi-lbl {
              font-size: 7.5px;
              color: #64748b;
              text-transform: uppercase;
              font-weight: 700;
            }
            .kpi-val {
              font-size: 11.5px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 2px;
            }
            /* TABLE */
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
              font-size: 8.5px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 4px 6px;
              line-height: 1.25;
            }
            th {
              background-color: #f1f5f9;
              font-weight: 800;
              text-transform: uppercase;
              color: #334155;
              font-size: 8px;
              letter-spacing: 0.25px;
            }
            tbody tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .amount {
              text-align: right;
              font-family: Consolas, "Courier New", monospace;
              font-weight: 600;
              white-space: nowrap;
            }
            .center {
              text-align: center;
            }
            tfoot tr {
              background-color: #f1f5f9;
              font-weight: 800;
              border-top: 2px solid #64748b;
            }
            tfoot td {
              font-weight: 800;
            }
            /* SIGNATURES */
            .signatures {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 28px;
              margin-top: 26px;
              padding-top: 8px;
              page-break-inside: avoid;
            }
            .sig-box {
              border-top: 1px dashed #94a3b8;
              padding-top: 5px;
              font-size: 8.5px;
              color: #475569;
            }
            .sig-title {
              font-weight: 700;
              color: #1e293b;
              margin-bottom: 2px;
            }
            .sig-line {
              margin-top: 16px;
              font-size: 8px;
              color: #64748b;
            }
            .footer-note {
              margin-top: 16px;
              text-align: center;
              font-size: 7.5px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 6px;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <!-- Official Letterhead -->
          <div class="letterhead">
            <div class="letterhead-brand">
              ${bLogo ? `<img src="${bLogo}" alt="${bName}" class="biz-logo" />` : ''}
              <div>
                <div class="biz-name">${bName}</div>
                <div class="biz-contact">
                  ${bAddress ? `<span>📍 ${bAddress}</span>` : ''}
                  ${bPhone ? `<span>📞 ${bPhone}</span>` : ''}
                  ${bEmail ? `<span>✉️ ${bEmail}</span>` : ''}
                  ${bWebsite ? `<span>🌐 ${bWebsite}</span>` : ''}
                  ${kraPin ? `<span><strong>PIN:</strong> ${kraPin}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="letterhead-meta">
              <div class="report-badge">OFFICIAL BUDGET REPORT</div>
              <div class="report-title">${activeView === 'summary' ? 'Departmental Payroll Rollup & Budget' : 'Staff Payroll & Budget Disbursement'}</div>
              <div class="report-sub">Department: <strong>${deptName}</strong> · Period: <strong>${periodName}</strong></div>
              <div class="report-sub">Generated: <strong>${new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></div>
            </div>
          </div>

          <!-- Meta Strip -->
          <div class="meta-strip">
            <span class="meta-pill">Department: <strong>${deptName}</strong></span>
            <span class="meta-pill">Pay Period: <strong>${periodName}</strong></span>
            <span class="meta-pill">Run Status: <strong>${statusLabel}</strong></span>
            <span class="meta-pill">Total Filtered: <strong>${metrics.count} Staff</strong></span>
            <span class="meta-pill">Currency: <strong>${currency}</strong></span>
          </div>
          
          <!-- KPI Summary Strip -->
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
              <div class="kpi-lbl">Sacco & Welfare Deductions</div>
              <div class="kpi-val" style="color: #4338ca;">${currency} ${fmt(metrics.totalSacco)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-lbl">Total Net Disbursement</div>
              <div class="kpi-val" style="color: #16a34a;">${currency} ${fmt(metrics.totalNet)}</div>
            </div>
          </div>

          ${activeView === 'summary' ? `
            <!-- Department Rollup Table -->
            <table>
              <thead>
                <tr>
                  <th style="text-align: left;">Department</th>
                  <th style="text-align: center;">Staff Count</th>
                  <th style="text-align: right;">Basic Salary (${currency})</th>
                  <th style="text-align: right;">Gross Budget (${currency})</th>
                  <th style="text-align: right;">Statutory Deductions (${currency})</th>
                  <th style="text-align: right;">Sacco & Welfare (${currency})</th>
                  <th style="text-align: right;">Net Payout (${currency})</th>
                  <th style="text-align: right;">% of Total Payroll</th>
                </tr>
              </thead>
              <tbody>
                ${departmentSummaries.map(dept => {
                  const sharePct = metrics.totalGross > 0 ? (dept.grossPay / metrics.totalGross) * 100 : 0;
                  return `
                    <tr>
                      <td style="font-weight: bold;">${dept.department}</td>
                      <td class="center">${dept.staffCount}</td>
                      <td class="amount">${fmt(dept.basicSalary)}</td>
                      <td class="amount" style="color: #2563eb; font-weight: bold;">${fmt(dept.grossPay)}</td>
                      <td class="amount" style="color: #dc2626;">${fmt(dept.statutory)}</td>
                      <td class="amount" style="color: #4338ca; font-weight: bold;">${fmt(dept.sacco)}</td>
                      <td class="amount" style="color: #16a34a; font-weight: bold;">${fmt(dept.netPay)}</td>
                      <td class="amount">${sharePct.toFixed(1)}%</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td>Grand Total (${departmentSummaries.length} Departments)</td>
                  <td class="center">${metrics.count}</td>
                  <td class="amount">${fmt(metrics.totalBasic)}</td>
                  <td class="amount" style="color: #2563eb;">${fmt(metrics.totalGross)}</td>
                  <td class="amount" style="color: #dc2626;">${fmt(metrics.totalStatutory)}</td>
                  <td class="amount" style="color: #4338ca;">${fmt(metrics.totalSacco)}</td>
                  <td class="amount" style="color: #16a34a;">${fmt(metrics.totalNet)}</td>
                  <td class="amount">100.0%</td>
                </tr>
              </tfoot>
            </table>
          ` : `
            <!-- Detailed Staff Payroll Table with selected columns -->
            <table>
              <thead>
                <tr>
                  ${colsToPrint.map(c => `
                    <th style="${c.align === 'right' ? 'text-align: right;' : c.align === 'center' ? 'text-align: center;' : 'text-align: left;'}">
                      ${c.label}
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${filteredRuns.map(r => `
                  <tr>
                    ${colsToPrint.map(c => {
                      if (c.id === 'dept') return `<td>${r.employee?.department || 'Unassigned'}</td>`;
                      if (c.id === 'code') return `<td style="font-family: monospace;">${r.employee?.code || ''}</td>`;
                      if (c.id === 'name') return `<td><strong>${r.employee?.first_name || ''} ${r.employee?.last_name || ''}</strong></td>`;
                      if (c.id === 'position') return `<td>${r.employee?.position || '—'}</td>`;
                      if (c.id === 'basic') return `<td class="amount">${fmt(r.basic_salary)}</td>`;
                      if (c.id === 'allowances') return `<td class="amount">${fmt(Number(r.allowances || 0) + Number(r.bonuses || 0) + Number(r.overtime_pay || 0) + Number(r.holiday_pay || 0))}</td>`;
                      if (c.id === 'gross') return `<td class="amount" style="color: #2563eb; font-weight: bold;">${fmt(r.gross_pay)}</td>`;
                      if (c.id === 'paye') return `<td class="amount">${fmt(r.tax_deduction)}</td>`;
                      if (c.id === 'nssf') return `<td class="amount">${fmt(r.nssf_deduction)}</td>`;
                      if (c.id === 'nhif') return `<td class="amount">${fmt(r.nhif_deduction)}</td>`;
                      if (c.id === 'housingLevy') return `<td class="amount">${fmt(r.housing_levy_deduction)}</td>`;
                      if (c.id === 'sacco') return `<td class="amount" style="color: #4338ca; font-weight: bold;">${Number(r.sacco_welfare_deduction || 0) > 0 ? fmt(r.sacco_welfare_deduction) : '—'}</td>`;
                      if (c.id === 'other') return `<td class="amount">${Number(r.other_deductions || 0) > 0 ? fmt(r.other_deductions) : '—'}</td>`;
                      if (c.id === 'net') return `<td class="amount" style="color: #16a34a; font-weight: bold;">${fmt(r.net_pay)}</td>`;
                      if (c.id === 'paymentRef') {
                        const ref = r.payment_reference || (r.employee?.bank_name ? `${r.employee.bank_name}: ${r.employee.bank_account || ''}` : '—');
                        return `<td style="font-family: monospace; font-size: 8px;">${ref}</td>`;
                      }
                      if (c.id === 'status') return `<td class="center"><strong>${(r.status || 'draft').toUpperCase()}</strong></td>`;
                      return `<td></td>`;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="${infoColSpan}">Total (${metrics.count} Staff)</td>
                  ${colsToPrint.slice(infoColSpan).map(c => {
                    if (c.id === 'basic') return `<td class="amount">${fmt(metrics.totalBasic)}</td>`;
                    if (c.id === 'allowances') return `<td class="amount">${fmt(metrics.totalAllowances + metrics.totalOvertimeHoliday)}</td>`;
                    if (c.id === 'gross') return `<td class="amount" style="color: #2563eb;">${fmt(metrics.totalGross)}</td>`;
                    if (c.id === 'paye') return `<td class="amount">${fmt(metrics.totalTax)}</td>`;
                    if (c.id === 'nssf') return `<td class="amount">${fmt(metrics.totalNssf)}</td>`;
                    if (c.id === 'nhif') return `<td class="amount">${fmt(metrics.totalNhif)}</td>`;
                    if (c.id === 'housingLevy') return `<td class="amount">${fmt(metrics.totalHousingLevy)}</td>`;
                    if (c.id === 'sacco') return `<td class="amount" style="color: #4338ca;">${fmt(metrics.totalSacco)}</td>`;
                    if (c.id === 'other') return `<td class="amount">${fmt(metrics.totalOther)}</td>`;
                    if (c.id === 'net') return `<td class="amount" style="color: #16a34a;">${fmt(metrics.totalNet)}</td>`;
                    return `<td></td>`;
                  }).join('')}
                </tr>
              </tfoot>
            </table>
          `}

          <!-- Signatures Section -->
          <div class="signatures">
            <div class="sig-box">
              <div class="sig-title">Prepared By (Payroll Accountant):</div>
              <div class="sig-line">Signature: __________________________</div>
              <div class="sig-line">Date: _______________________________</div>
            </div>
            <div class="sig-box">
              <div class="sig-title">Checked & Verified (HR / Head of Dept):</div>
              <div class="sig-line">Signature: __________________________</div>
              <div class="sig-line">Date: _______________________________</div>
            </div>
            <div class="sig-box">
              <div class="sig-title">Authorized By (Director / Board Treasurer):</div>
              <div class="sig-line">Signature: __________________________</div>
              <div class="sig-line">Date: _______________________________</div>
            </div>
          </div>

          <div class="footer-note">
            Confidential Document — Generated automatically by ${bName} ERP System. Valid without seal when verified by authorized signatories.
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

          {/* Action Buttons: Columns, Export CSV & Print */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setShowColumnModal(true)}
              className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
              title="Configure report columns and print layout (e.g. Sacco, Payment Ref / Cheque, Allowances, NSSF)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Columns ({selectedColumns.length})
            </button>
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
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500 font-semibold">
                Visible Columns: <strong className="text-indigo-600">{visibleCols.length}</strong>
              </span>
              <span className="text-[11px] text-slate-500 font-semibold">
                Total Budget: <strong className="text-blue-700">{currency} {fmt(metrics.totalGross)}</strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  {visibleCols.map(col => (
                    <th
                      key={col.id}
                      className={`py-3 px-3.5 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {col.shortLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRuns.length === 0 ? (
                  <tr>
                    <td colSpan={visibleCols.length} className="text-center py-12 text-slate-400">
                      <Building2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-xs">No payroll runs found for selected filters</p>
                      <p className="text-[10px] mt-0.5">Select another department or period above.</p>
                    </td>
                  </tr>
                ) : (
                  filteredRuns.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      {visibleCols.map((col) => {
                        if (col.id === 'dept') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                <Building2 className="w-3 h-3 text-slate-500" />
                                {r.employee?.department || 'Unassigned'}
                              </span>
                            </td>
                          );
                        }
                        if (col.id === 'code') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 font-mono text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                              {r.employee?.code || '—'}
                            </td>
                          );
                        }
                        if (col.id === 'name') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 whitespace-nowrap">
                              <div className="font-black text-slate-900">
                                {r.employee?.first_name} {r.employee?.last_name}
                              </div>
                            </td>
                          );
                        }
                        if (col.id === 'position') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-slate-600 font-medium whitespace-nowrap">
                              {r.employee?.position || '—'}
                            </td>
                          );
                        }
                        if (col.id === 'basic') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right font-mono font-bold whitespace-nowrap">
                              {fmt(r.basic_salary)}
                            </td>
                          );
                        }
                        if (col.id === 'allowances') {
                          const totAllow = Number(r.allowances || 0) + Number(r.bonuses || 0) + Number(r.overtime_pay || 0) + Number(r.holiday_pay || 0);
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right font-mono text-emerald-600 font-semibold whitespace-nowrap">
                              +{fmt(totAllow)}
                            </td>
                          );
                        }
                        if (col.id === 'gross') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right font-mono font-black text-blue-700 bg-blue-50/30 whitespace-nowrap">
                              {fmt(r.gross_pay)}
                            </td>
                          );
                        }
                        if (col.id === 'paye') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right font-mono text-red-600 font-semibold whitespace-nowrap">
                              –{fmt(r.tax_deduction)}
                            </td>
                          );
                        }
                        if (col.id === 'nssf') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right font-mono text-red-600 font-semibold whitespace-nowrap">
                              –{fmt(r.nssf_deduction)}
                            </td>
                          );
                        }
                        if (col.id === 'nhif') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right font-mono text-red-600 font-semibold whitespace-nowrap">
                              –{fmt(r.nhif_deduction)}
                            </td>
                          );
                        }
                        if (col.id === 'housingLevy') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right font-mono text-red-600 font-semibold whitespace-nowrap">
                              –{fmt(r.housing_levy_deduction)}
                            </td>
                          );
                        }
                        if (col.id === 'sacco') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right font-mono text-indigo-600 font-bold whitespace-nowrap">
                              {Number(r.sacco_welfare_deduction || 0) > 0 ? `–${fmt(r.sacco_welfare_deduction)}` : '—'}
                            </td>
                          );
                        }
                        if (col.id === 'other') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right font-mono text-red-600 font-medium whitespace-nowrap">
                              {Number(r.other_deductions || 0) > 0 ? `–${fmt(r.other_deductions)}` : '—'}
                            </td>
                          );
                        }
                        if (col.id === 'net') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right font-mono font-black text-emerald-700 bg-emerald-50/30 whitespace-nowrap">
                              {fmt(r.net_pay)}
                            </td>
                          );
                        }
                        if (col.id === 'paymentRef') {
                          const ref = r.payment_reference || (r.employee?.bank_name ? `${r.employee.bank_name}: ${r.employee.bank_account || ''}` : '—');
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-slate-700 text-[11px] font-mono whitespace-nowrap">
                              {ref}
                            </td>
                          );
                        }
                        if (col.id === 'status') {
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-center whitespace-nowrap">
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
                          );
                        }
                        return <td key={col.id} />;
                      })}
                    </tr>
                  ))
                )}
              </tbody>
              {filteredRuns.length > 0 && (() => {
                const firstNumIndex = visibleCols.findIndex(c => c.isNumeric);
                const infoSpan = firstNumIndex > 0 ? firstNumIndex : 1;
                return (
                  <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-200">
                    <tr>
                      {firstNumIndex > 0 && (
                        <td colSpan={infoSpan} className="py-3 px-3.5 text-slate-800">
                          Total ({metrics.count} Employees)
                        </td>
                      )}
                      {visibleCols.slice(firstNumIndex > 0 ? firstNumIndex : 0).map((col) => {
                        if (col.id === 'basic') return <td key={col.id} className="py-3 px-3.5 text-right font-mono">{fmt(metrics.totalBasic)}</td>;
                        if (col.id === 'allowances') return <td key={col.id} className="py-3 px-3.5 text-right font-mono text-emerald-700">+{fmt(metrics.totalAllowances + metrics.totalOvertimeHoliday)}</td>;
                        if (col.id === 'gross') return <td key={col.id} className="py-3 px-3.5 text-right font-mono text-blue-800 bg-blue-100/50">{fmt(metrics.totalGross)}</td>;
                        if (col.id === 'paye') return <td key={col.id} className="py-3 px-3.5 text-right font-mono text-red-700">–{fmt(metrics.totalTax)}</td>;
                        if (col.id === 'nssf') return <td key={col.id} className="py-3 px-3.5 text-right font-mono text-red-700">–{fmt(metrics.totalNssf)}</td>;
                        if (col.id === 'nhif') return <td key={col.id} className="py-3 px-3.5 text-right font-mono text-red-700">–{fmt(metrics.totalNhif)}</td>;
                        if (col.id === 'housingLevy') return <td key={col.id} className="py-3 px-3.5 text-right font-mono text-red-700">–{fmt(metrics.totalHousingLevy)}</td>;
                        if (col.id === 'sacco') return <td key={col.id} className="py-3 px-3.5 text-right font-mono text-indigo-700">{metrics.totalSacco > 0 ? `–${fmt(metrics.totalSacco)}` : '—'}</td>;
                        if (col.id === 'other') return <td key={col.id} className="py-3 px-3.5 text-right font-mono text-red-700">{metrics.totalOther > 0 ? `–${fmt(metrics.totalOther)}` : '—'}</td>;
                        if (col.id === 'net') return <td key={col.id} className="py-3 px-3.5 text-right font-mono text-emerald-800 bg-emerald-100/50 text-sm">{fmt(metrics.totalNet)}</td>;
                        return <td key={col.id} className="py-3 px-3.5" />;
                      })}
                    </tr>
                  </tfoot>
                );
              })()}
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

      {/* Column Customization & Print Settings Modal */}
      {showColumnModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Customize Report & Print Columns</h3>
                  <p className="text-xs text-slate-500">
                    Choose columns to display on screen and in printed budget reports.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowColumnModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Orientation Setting */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Print Page Orientation</span>
                  <span className="text-[11px] text-slate-500">
                    Landscape is recommended to fit Sacco & Payment Reference without crowding.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('landscape')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      printOrientation === 'landscape'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Landscape (Recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('portrait')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      printOrientation === 'portrait'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Portrait
                  </button>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-2">Quick Column Presets:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyColumnPreset('default')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                  >
                    Default (with Sacco & Ref)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyColumnPreset('compact')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                    title="Omits Allowances and NSSF to save horizontal space"
                  >
                    Omit Allowances & NSSF
                  </button>
                  <button
                    type="button"
                    onClick={() => applyColumnPreset('disbursement')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                  >
                    Disbursement Focus
                  </button>
                  <button
                    type="button"
                    onClick={() => applyColumnPreset('all')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                  >
                    Select All ({ALL_BUDGET_COLUMNS.length})
                  </button>
                </div>
              </div>

              {/* Checkboxes grouped */}
              <div className="space-y-4 pt-1">
                {(['Employee Info', 'Earnings', 'Deductions', 'Disbursement'] as const).map((grp) => {
                  const grpCols = ALL_BUDGET_COLUMNS.filter(c => c.group === grp);
                  return (
                    <div key={grp} className="border border-slate-200 rounded-xl p-3.5 bg-white shadow-2xs">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-2.5">
                        {grp}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {grpCols.map((c) => {
                          const isChecked = selectedColumns.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              onClick={() => toggleColumn(c.id)}
                              className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                                isChecked
                                  ? 'bg-blue-50/70 border-blue-200 text-slate-900 font-bold'
                                  : 'bg-slate-50/50 border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // handled by label onClick
                                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                              />
                              <span>{c.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => applyColumnPreset('default')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowColumnModal(false);
                    setTimeout(() => handlePrint(), 150);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 inline mr-1.5" />
                  Print Now
                </button>
                <button
                  type="button"
                  onClick={() => setShowColumnModal(false)}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentBudgetingTab;
