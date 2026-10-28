import React, { useState } from 'react';
import { 
  Printer, X, Download, FileText, FileSpreadsheet, 
  CheckCircle2, DollarSign, Calendar, Building2, User, 
  CreditCard, ShieldCheck, Tag
} from 'lucide-react';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useAuthContext } from '../../contexts/useAuthContext';

export interface P9ScheduleItem {
  id: string;
  payroll_period_id: string;
  period_name: string;
  month: number;
  month_name: string;
  period_start: string;
  period_end: string;
  paid_date: string;
  payment_reference: string;
  payment_account_name: string;
  basic_salary: number;
  allowances: number;
  gross_pay: number;
  tax_deduction: number;
  nhif_deduction: number;
  nssf_deduction: number;
  housing_levy_deduction: number;
  sacco_welfare_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  status: string;
  notes?: string;
  disbursements?: any[];
}

export interface P9MonthData {
  month: number;
  month_name: string;
  gross_pay: number;
  tax_deduction: number;
  nhif_deduction: number;
  nssf_deduction: number;
  housing_levy_deduction: number;
  sacco_welfare_deduction: number;
  other_deductions: number;
  total_deductions?: number;
  net_pay: number;
  period_name: string;
  paid_date?: string;
  payment_reference?: string;
}

export interface P9Data {
  employee_id: string;
  year: number;
  employee: {
    first_name: string;
    last_name: string;
    name?: string;
    code?: string;
    tax_pin?: string;
    nssf_number?: string;
    nhif_number?: string;
    department?: string;
    position?: string;
    email?: string;
    phone?: string;
    bank_name?: string;
    bank_account_no?: string;
  };
  business: {
    business_name: string;
    kra_pin?: string;
    business_address?: string;
    business_phone?: string;
    business_email?: string;
    logo_url?: string;
  };
  monthly_data: P9MonthData[];
  payment_schedule?: P9ScheduleItem[];
  totals: {
    total_basic?: number;
    total_allowances?: number;
    total_gross: number;
    total_tax: number;
    total_nhif: number;
    total_nssf: number;
    total_housing_levy: number;
    total_sacco_welfare: number;
    total_other_deductions?: number;
    total_deductions?: number;
    total_net: number;
  };
}

interface P9FormProps {
  data: P9Data;
  onClose: () => void;
}

const ALL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const P9Form: React.FC<P9FormProps> = ({ data, onClose }) => {
  const { settings } = useSettingsContext();
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState<'statement' | 'p9'>('statement');

  const currency = settings?.default_currency || 'KES';
  const fmt = (n: number) =>
    Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' });

  // Map 12 months for standard statutory P9
  const monthMap = new Map<number, P9MonthData>();
  (data.monthly_data || []).forEach(m => monthMap.set(m.month, m));
  const allMonthRows = ALL_MONTHS.map((name, idx) => {
    const m = monthMap.get(idx + 1);
    return m || {
      month: idx + 1,
      month_name: name,
      gross_pay: 0,
      tax_deduction: 0,
      nhif_deduction: 0,
      nssf_deduction: 0,
      housing_levy_deduction: 0,
      sacco_welfare_deduction: 0,
      other_deductions: 0,
      total_deductions: 0,
      net_pay: 0,
      period_name: ''
    };
  });

  // Effective payment schedule list
  const scheduleList: P9ScheduleItem[] = (data.payment_schedule && data.payment_schedule.length > 0)
    ? data.payment_schedule
    : (data.monthly_data || []).map((m, i) => ({
        id: `sched-${i}`,
        payroll_period_id: '',
        period_name: m.period_name || `${m.month_name} Payroll`,
        month: m.month,
        month_name: m.month_name,
        period_start: `${data.year}-${String(m.month).padStart(2, '0')}-01`,
        period_end: `${data.year}-${String(m.month).padStart(2, '0')}-28`,
        paid_date: m.paid_date || '',
        payment_reference: m.payment_reference || '-',
        payment_account_name: 'Operating Bank Account',
        basic_salary: m.gross_pay,
        allowances: 0,
        gross_pay: m.gross_pay,
        tax_deduction: m.tax_deduction,
        nhif_deduction: m.nhif_deduction,
        nssf_deduction: m.nssf_deduction,
        housing_levy_deduction: m.housing_levy_deduction,
        sacco_welfare_deduction: m.sacco_welfare_deduction,
        other_deductions: m.other_deductions,
        total_deductions: (m.tax_deduction + m.nhif_deduction + m.nssf_deduction + m.housing_levy_deduction + m.sacco_welfare_deduction + m.other_deductions),
        net_pay: m.net_pay,
        status: 'paid'
      }));

  // Calculated totals
  const totalBasic = data.totals.total_basic ?? scheduleList.reduce((acc, s) => acc + (s.basic_salary || 0), 0);
  const totalAllowances = data.totals.total_allowances ?? scheduleList.reduce((acc, s) => acc + (s.allowances || 0), 0);
  const totalOtherDed = data.totals.total_other_deductions ?? scheduleList.reduce((acc, s) => acc + (s.other_deductions || 0), 0);
  const totalDeductionsAll = data.totals.total_deductions ?? (
    (data.totals.total_tax || 0) +
    (data.totals.total_nhif || 0) +
    (data.totals.total_nssf || 0) +
    (data.totals.total_housing_levy || 0) +
    (data.totals.total_sacco_welfare || 0) +
    totalOtherDed
  );

  // CSV Export for the Worker Payment Schedule
  const handleExportCsv = () => {
    const headers = [
      '#',
      'Month / Period',
      'Period Start',
      'Period End',
      'Payment Date',
      'Payment Ref No',
      'Disbursing Account',
      `Basic Pay (${currency})`,
      `Allowances (${currency})`,
      `Gross Pay (${currency})`,
      `PAYE Tax (${currency})`,
      `NSSF (${currency})`,
      `NHIF/SHA (${currency})`,
      `Housing Levy (${currency})`,
      `SACCO/Welfare (${currency})`,
      `Other Deductions (${currency})`,
      `Total Deductions (${currency})`,
      `Net Pay (${currency})`,
      'Status'
    ];

    const rows = scheduleList.map((item, idx) => [
      idx + 1,
      `"${item.month_name} - ${item.period_name || ''}"`,
      `"${item.period_start || ''}"`,
      `"${item.period_end || ''}"`,
      `"${item.paid_date || ''}"`,
      `"${item.payment_reference || '-'}"`,
      `"${item.payment_account_name || '-'}"`,
      (item.basic_salary || 0).toFixed(2),
      (item.allowances || 0).toFixed(2),
      (item.gross_pay || 0).toFixed(2),
      (item.tax_deduction || 0).toFixed(2),
      (item.nssf_deduction || 0).toFixed(2),
      (item.nhif_deduction || 0).toFixed(2),
      (item.housing_levy_deduction || 0).toFixed(2),
      (item.sacco_welfare_deduction || 0).toFixed(2),
      (item.other_deductions || 0).toFixed(2),
      (item.total_deductions || 0).toFixed(2),
      (item.net_pay || 0).toFixed(2),
      `"${item.status || 'Paid'}"`
    ]);

    // Summary row
    rows.push([
      'TOTALS',
      `"YEAR ${data.year} TOTALS"`,
      '""',
      '""',
      '""',
      '""',
      '""',
      totalBasic.toFixed(2),
      totalAllowances.toFixed(2),
      (data.totals.total_gross || 0).toFixed(2),
      (data.totals.total_tax || 0).toFixed(2),
      (data.totals.total_nssf || 0).toFixed(2),
      (data.totals.total_nhif || 0).toFixed(2),
      (data.totals.total_housing_levy || 0).toFixed(2),
      (data.totals.total_sacco_welfare || 0).toFixed(2),
      totalOtherDed.toFixed(2),
      totalDeductionsAll.toFixed(2),
      (data.totals.total_net || 0).toFixed(2),
      '""'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const safeEmp = `${data.employee.first_name}_${data.employee.last_name}`.replace(/\s+/g, '_');
    link.setAttribute('download', `Worker_Payment_Statement_${safeEmp}_${data.year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // High Quality Printable Handler
  const handlePrint = () => {
    const printElementId = activeTab === 'statement' ? 'statement-print-area' : 'p9-print-area';
    const printContent = document.getElementById(printElementId);
    if (!printContent) return;

    const title = activeTab === 'statement'
      ? `Payment_Statement_${data.employee.first_name}_${data.employee.last_name}_${data.year}`
      : `P9_Tax_Form_${data.employee.first_name}_${data.employee.last_name}_${data.year}`;

    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              font-size: 11px; 
              color: #0f172a; 
              padding: 24px;
              background: #fff;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .header h1 {
              font-size: 16px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .header h2 {
              font-size: 13px;
              font-weight: 700;
              color: #334155;
              margin-top: 4px;
            }
            .header p {
              font-size: 11px;
              color: #64748b;
              margin-top: 2px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 16px;
            }
            .info-box {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 10px;
              background: #f8fafc;
            }
            .info-box-title {
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.5px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
              margin-bottom: 6px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
              font-size: 10.5px;
            }
            .info-label { color: #64748b; }
            .info-val { font-weight: 600; color: #0f172a; }
            
            .summary-cards {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 16px;
            }
            .summary-card {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 8px;
              text-align: center;
              background: #f8fafc;
            }
            .summary-card-title {
              font-size: 9px;
              text-transform: uppercase;
              font-weight: 700;
              color: #64748b;
            }
            .summary-card-amount {
              font-size: 13px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 2px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            th {
              background: #0f172a;
              color: #ffffff;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              border: 1px solid #0f172a;
              padding: 6px 5px;
              text-align: right;
            }
            th.text-left { text-align: left; }
            th.text-center { text-align: center; }
            td {
              border: 1px solid #cbd5e1;
              padding: 5px 6px;
              font-size: 10px;
              text-align: right;
            }
            td.text-left { text-align: left; }
            td.text-center { text-align: center; }
            tr:nth-child(even) { background: #f8fafc; }
            tr.total-row {
              background: #1e293b !important;
              color: #ffffff;
              font-weight: 700;
            }
            tr.total-row td {
              border-color: #1e293b;
              color: #ffffff;
              font-weight: 700;
            }
            .ref-badge {
              font-family: monospace;
              font-size: 9.5px;
              font-weight: 700;
              background: #e0f2fe;
              color: #0369a1;
              padding: 1px 4px;
              border-radius: 3px;
              display: inline-block;
            }
            .footer-signatures {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 16px;
              margin-top: 28px;
              padding-top: 16px;
              border-top: 1px dashed #94a3b8;
            }
            .sig-box {
              font-size: 9.5px;
            }
            .sig-line {
              border-bottom: 1px solid #0f172a;
              margin-top: 36px;
              margin-bottom: 4px;
            }
            .system-watermark {
              text-align: center;
              font-size: 8.5px;
              color: #94a3b8;
              margin-top: 16px;
            }
            @media print {
              body { padding: 0; }
              @page { size: landscape; margin: 12mm; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 450);
  };

  const employeeFullName = `${data.employee.first_name || ''} ${data.employee.last_name || ''}`.trim() || data.employee.name || 'Employee';

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-start justify-center overflow-y-auto py-6 px-3 sm:px-6">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        
        {/* Header Modal Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-purple-100 text-purple-700">
                Payroll Statement
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                {employeeFullName}
              </h3>
              <span className="text-xs text-slate-400 font-mono">({data.employee.code || 'EMP'})</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Year {data.year} &middot; {data.business.business_name} &middot; {data.employee.position || 'Staff'} ({data.employee.department || 'General'})
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* View Switcher Tabs */}
            <div className="flex bg-slate-200/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('statement')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'statement'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Payment Schedule Statement
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('p9')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'p9'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                KRA P9A Tax Card
              </button>
            </div>

            {/* Actions */}
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              title="Download detailed payment schedule CSV"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors"
              title="Print document or save as PDF"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB 1: WORKER PAYMENT SCHEDULE STATEMENT                           */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === 'statement' && (
          <div className="p-6 overflow-x-auto max-h-[78vh] overflow-y-auto">
            <div id="statement-print-area">
              
              {/* Document Header */}
              <div className="header text-center border-b-2 border-slate-900 pb-3 mb-4">
                <h1 className="text-xl font-extrabold tracking-wide uppercase text-slate-900">
                  {data.business.business_name || 'EMPOWER SCHOOL / CHDF'}
                </h1>
                <h2 className="text-sm font-bold text-slate-700 mt-1 uppercase tracking-wider">
                  Worker Remuneration &amp; Payment Schedule Statement
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Tax / Calendar Year: <strong>{data.year}</strong> &middot; Generated On: <strong>{today}</strong>
                </p>
              </div>

              {/* Top Details Grid */}
              <div className="info-grid grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Employer Details */}
                <div className="info-box border border-slate-200 bg-slate-50/60 rounded-xl p-3.5">
                  <div className="info-box-title text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      Employer Information
                    </span>
                    {data.business.kra_pin && (
                      <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                        PIN: {data.business.kra_pin}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Business / Entity:</span>
                      <strong className="text-slate-800">{data.business.business_name}</strong>
                    </div>
                    {data.business.business_address && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Address:</span>
                        <span className="text-slate-700">{data.business.business_address}</span>
                      </div>
                    )}
                    {data.business.business_phone && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Contact Phone:</span>
                        <span className="text-slate-700">{data.business.business_phone}</span>
                      </div>
                    )}
                    {data.business.business_email && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Email:</span>
                        <span className="text-slate-700">{data.business.business_email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Worker Details */}
                <div className="info-box border border-slate-200 bg-slate-50/60 rounded-xl p-3.5">
                  <div className="info-box-title text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      Worker Information
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">
                      EMP ID: {data.employee.code || 'N/A'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Full Name:</span>
                      <strong className="text-slate-900">{employeeFullName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">KRA PIN:</span>
                      <strong className="text-slate-800 font-mono">{data.employee.tax_pin || 'N/A'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Department:</span>
                      <span className="text-slate-700">{data.employee.department || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">NSSF No:</span>
                      <span className="text-slate-800 font-mono">{data.employee.nssf_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Role / Position:</span>
                      <span className="text-slate-700">{data.employee.position || 'Staff'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">NHIF/SHA:</span>
                      <span className="text-slate-800 font-mono">{data.employee.nhif_number || 'N/A'}</span>
                    </div>
                    <div className="col-span-2 flex justify-between border-t border-slate-200 pt-1 mt-0.5">
                      <span className="text-slate-500 flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-slate-400" />
                        Remittance Account:
                      </span>
                      <span className="font-semibold text-slate-700">
                        {data.employee.bank_name ? `${data.employee.bank_name} - ${data.employee.bank_account_no || 'Acct on File'}` : 'Cash / Mobile Remittance'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="summary-cards grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="summary-card border border-slate-200 bg-white rounded-xl p-3 shadow-xs">
                  <div className="summary-card-title text-[10px] font-bold text-slate-500 uppercase">Total Basic Salary</div>
                  <div className="summary-card-amount text-base font-extrabold text-slate-800 mt-1">
                    {currency} {fmt(totalBasic)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Base contractual pay</div>
                </div>

                <div className="summary-card border border-blue-200 bg-blue-50/40 rounded-xl p-3 shadow-xs">
                  <div className="summary-card-title text-[10px] font-bold text-blue-700 uppercase">Gross Remuneration</div>
                  <div className="summary-card-amount text-base font-extrabold text-blue-900 mt-1">
                    {currency} {fmt(data.totals.total_gross)}
                  </div>
                  <div className="text-[10px] text-blue-600/80 mt-0.5">Includes {currency} {fmt(totalAllowances)} allowances</div>
                </div>

                <div className="summary-card border border-rose-200 bg-rose-50/40 rounded-xl p-3 shadow-xs">
                  <div className="summary-card-title text-[10px] font-bold text-rose-700 uppercase">Total Deductions Applied</div>
                  <div className="summary-card-amount text-base font-extrabold text-rose-700 mt-1">
                    - {currency} {fmt(totalDeductionsAll)}
                  </div>
                  <div className="text-[10px] text-rose-600/80 mt-0.5">Statutory &amp; other withholdings</div>
                </div>

                <div className="summary-card border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 shadow-xs">
                  <div className="summary-card-title text-[10px] font-bold text-emerald-800 uppercase">Total Net Remuneration</div>
                  <div className="summary-card-amount text-base font-extrabold text-emerald-800 mt-1">
                    {currency} {fmt(data.totals.total_net)}
                  </div>
                  <div className="text-[10px] text-emerald-700/80 mt-0.5">Net take-home pay</div>
                </div>
              </div>

              {/* Detailed Payment Schedule Table */}
              {scheduleList.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                  <DollarSign className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No payroll runs recorded for {data.year}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Process and approve payroll periods for this employee in the HR &amp; Payroll module to view payment schedules.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="py-2.5 px-2.5 text-center font-bold text-[10px] uppercase w-8">#</th>
                        <th className="py-2.5 px-3 text-left font-bold text-[10px] uppercase">Month Paid For</th>
                        <th className="py-2.5 px-2.5 text-left font-bold text-[10px] uppercase">Period Dates</th>
                        <th className="py-2.5 px-2.5 text-left font-bold text-[10px] uppercase">Payment Date</th>
                        <th className="py-2.5 px-2.5 text-left font-bold text-[10px] uppercase">Payment Ref No</th>
                        <th className="py-2.5 px-2.5 text-left font-bold text-[10px] uppercase">Paying Account</th>
                        <th className="py-2.5 px-2.5 text-right font-bold text-[10px] uppercase">Basic ({currency})</th>
                        <th className="py-2.5 px-2.5 text-right font-bold text-[10px] uppercase">Gross ({currency})</th>
                        <th className="py-2.5 px-2.5 text-right font-bold text-[10px] uppercase text-rose-200">PAYE</th>
                        <th className="py-2.5 px-2.5 text-right font-bold text-[10px] uppercase text-rose-200">NSSF</th>
                        <th className="py-2.5 px-2.5 text-right font-bold text-[10px] uppercase text-rose-200">NHIF/SHA</th>
                        <th className="py-2.5 px-2.5 text-right font-bold text-[10px] uppercase text-rose-200">Hse Levy</th>
                        <th className="py-2.5 px-2.5 text-right font-bold text-[10px] uppercase text-rose-200">Other Ded.</th>
                        <th className="py-2.5 px-2.5 text-right font-bold text-[10px] uppercase text-rose-300 font-extrabold">Total Ded.</th>
                        <th className="py-2.5 px-3 text-right font-bold text-[10px] uppercase text-emerald-200">Net Pay ({currency})</th>
                        <th className="py-2.5 px-2 text-center font-bold text-[10px] uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {scheduleList.map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-2 px-2.5 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-bold text-slate-800">{row.month_name}</div>
                            <div className="text-[10px] text-slate-500">{row.period_name || `Month ${row.month}`}</div>
                          </td>
                          <td className="py-2 px-2.5 text-slate-600 font-mono text-[10.5px] whitespace-nowrap">
                            {row.period_start ? (
                              <span>{row.period_start} &rarr; {row.period_end}</span>
                            ) : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-slate-800 font-medium whitespace-nowrap">
                            {row.paid_date ? (
                              <span className="flex items-center gap-1 font-mono text-[11px]">
                                <Calendar className="h-3 w-3 text-slate-400" />
                                {row.paid_date}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Pending</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 whitespace-nowrap">
                            {row.payment_reference && row.payment_reference !== '-' && row.payment_reference !== 'N/A' ? (
                              <span className="ref-badge inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <Tag className="h-2.5 w-2.5 mr-1" />
                                {row.payment_reference}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-slate-600 text-[11px] truncate max-w-[140px]" title={row.payment_account_name}>
                            {row.payment_account_name || 'Operating Bank'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-medium text-slate-700">{fmt(row.basic_salary)}</td>
                          <td className="py-2 px-2.5 text-right font-bold text-slate-900 bg-slate-50/50">{fmt(row.gross_pay)}</td>
                          <td className="py-2 px-2.5 text-right text-rose-600 font-medium">{row.tax_deduction > 0 ? fmt(row.tax_deduction) : '-'}</td>
                          <td className="py-2 px-2.5 text-right text-rose-600 font-medium">{row.nssf_deduction > 0 ? fmt(row.nssf_deduction) : '-'}</td>
                          <td className="py-2 px-2.5 text-right text-rose-600 font-medium">{row.nhif_deduction > 0 ? fmt(row.nhif_deduction) : '-'}</td>
                          <td className="py-2 px-2.5 text-right text-rose-600 font-medium">{row.housing_levy_deduction > 0 ? fmt(row.housing_levy_deduction) : '-'}</td>
                          <td className="py-2 px-2.5 text-right text-rose-600 font-medium">
                            {(row.sacco_welfare_deduction + row.other_deductions) > 0 ? fmt(row.sacco_welfare_deduction + row.other_deductions) : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold text-rose-700 bg-rose-50/30">
                            {row.total_deductions > 0 ? fmt(row.total_deductions) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-extrabold text-emerald-700 bg-emerald-50/40 text-[11.5px]">
                            {fmt(row.net_pay)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                              {row.status || 'Paid'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="total-row bg-slate-900 text-white font-bold text-xs">
                        <td colSpan={6} className="py-3 px-3 text-left uppercase tracking-wider font-extrabold text-white">
                          Total Remuneration for Year {data.year}
                        </td>
                        <td className="py-3 px-2.5 text-right text-white font-bold">{fmt(totalBasic)}</td>
                        <td className="py-3 px-2.5 text-right text-white font-extrabold">{fmt(data.totals.total_gross)}</td>
                        <td className="py-3 px-2.5 text-right text-rose-200 font-bold">{fmt(data.totals.total_tax)}</td>
                        <td className="py-3 px-2.5 text-right text-rose-200 font-bold">{fmt(data.totals.total_nssf)}</td>
                        <td className="py-3 px-2.5 text-right text-rose-200 font-bold">{fmt(data.totals.total_nhif)}</td>
                        <td className="py-3 px-2.5 text-right text-rose-200 font-bold">{fmt(data.totals.total_housing_levy)}</td>
                        <td className="py-3 px-2.5 text-right text-rose-200 font-bold">
                          {fmt((data.totals.total_sacco_welfare || 0) + totalOtherDed)}
                        </td>
                        <td className="py-3 px-2.5 text-right text-rose-200 font-extrabold text-sm">
                          {fmt(totalDeductionsAll)}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-300 font-extrabold text-sm">
                          {fmt(data.totals.total_net)}
                        </td>
                        <td className="py-3 px-2 text-center text-white font-mono text-[10px]">{scheduleList.length} Runs</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Sign-off & Audit Box */}
              <div className="footer-signatures grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-5 border-t border-slate-200 text-xs">
                <div className="sig-box bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Prepared By:</p>
                  <p className="font-semibold text-slate-900">{user?.name || user?.email || 'Payroll Administrator'}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Date: {today}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">System Computer-Generated Statement</p>
                </div>

                <div className="sig-box bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Approved &amp; Certified By:</p>
                  <div className="sig-line border-b border-slate-400 mt-5 mb-1.5"></div>
                  <p className="text-[10px] text-slate-500 text-center">Finance Director / Human Resource Lead</p>
                </div>

                <div className="sig-box bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Employee Acknowledgment:</p>
                  <div className="sig-line border-b border-slate-400 mt-5 mb-1.5"></div>
                  <p className="text-[10px] text-slate-500 text-center">Signature &amp; Date</p>
                </div>
              </div>

              <p className="system-watermark text-center text-[10px] text-slate-400 mt-4">
                This document serves as an official remitted payment schedule and deduction statement for {data.employee.first_name} {data.employee.last_name} for the period {data.year}.
              </p>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB 2: KRA P9A TAX DEDUCTION CERTIFICATE                           */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === 'p9' && (
          <div className="p-6 overflow-x-auto max-h-[78vh] overflow-y-auto">
            <div id="p9-print-area">
              <div className="header text-center border-b-2 border-slate-900 pb-3 mb-4">
                <h1 className="text-xl font-extrabold uppercase tracking-wide text-slate-900">
                  Kenya Revenue Authority
                </h1>
                <h2 className="text-sm font-bold mt-1 text-slate-700">
                  DOMESTIC TAXES DEPARTMENT &middot; P9A TAX DEDUCTION CARD
                </h2>
                <p className="text-xs mt-1 text-slate-600">
                  Employer's Certificate of Pay As You Earn &middot; Tax Year: <strong>{data.year}</strong>
                </p>
              </div>

              {/* Employer / Employee P9 Grid */}
              <div className="info-grid grid grid-cols-2 gap-4 mb-4">
                <div className="info-box border border-slate-300 rounded-lg p-3 space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Employer Information</p>
                  <div className="text-xs"><span className="text-slate-500">Name: </span><strong>{data.business.business_name}</strong></div>
                  <div className="text-xs"><span className="text-slate-500">Employer PIN: </span><strong className="font-mono">{data.business.kra_pin || 'NOT SET'}</strong></div>
                  {data.business.business_address && <div className="text-xs"><span className="text-slate-500">Address: </span><span>{data.business.business_address}</span></div>}
                  {data.business.business_phone && <div className="text-xs"><span className="text-slate-500">Phone: </span><span>{data.business.business_phone}</span></div>}
                </div>
                <div className="info-box border border-slate-300 rounded-lg p-3 space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Employee Details</p>
                  <div className="text-xs"><span className="text-slate-500">Employee Name: </span><strong>{employeeFullName}</strong></div>
                  <div className="text-xs"><span className="text-slate-500">Employee PIN: </span><strong className="font-mono">{data.employee.tax_pin || 'NOT SET'}</strong></div>
                  <div className="text-xs"><span className="text-slate-500">Payroll Code: </span><span className="font-mono">{data.employee.code || '-'}</span></div>
                  <div className="text-xs"><span className="text-slate-500">NSSF Number: </span><span className="font-mono">{data.employee.nssf_number || '-'}</span></div>
                  <div className="text-xs"><span className="text-slate-500">NHIF/SHA Number: </span><span className="font-mono">{data.employee.nhif_number || '-'}</span></div>
                </div>
              </div>

              {/* 12 Months Standard KRA Table */}
              <div className="overflow-x-auto border border-slate-300 rounded-lg">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                      <th className="border border-slate-300 px-2 py-2 text-left font-bold uppercase text-[10px]">Month</th>
                      <th className="border border-slate-300 px-2 py-2 font-bold uppercase text-[10px] text-right">Gross Pay ({currency})</th>
                      <th className="border border-slate-300 px-2 py-2 font-bold uppercase text-[10px] text-right">Defined Pension/NSSF ({currency})</th>
                      <th className="border border-slate-300 px-2 py-2 font-bold uppercase text-[10px] text-right">NHIF / SHA ({currency})</th>
                      <th className="border border-slate-300 px-2 py-2 font-bold uppercase text-[10px] text-right">Housing Levy ({currency})</th>
                      <th className="border border-slate-300 px-2 py-2 font-bold uppercase text-[10px] text-right">Other Ded. ({currency})</th>
                      <th className="border border-slate-300 px-2 py-2 font-bold uppercase text-[10px] text-right text-rose-700">Tax Charged / PAYE ({currency})</th>
                      <th className="border border-slate-300 px-2 py-2 font-bold uppercase text-[10px] text-right text-emerald-700">Net Pay ({currency})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMonthRows.map((row, idx) => (
                      <tr key={idx} className={row.gross_pay > 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50'}>
                        <td className="month-col border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-800 text-left">
                          {row.month_name}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1.5 text-right font-medium">
                          {row.gross_pay > 0 ? fmt(row.gross_pay) : '-'}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1.5 text-right text-slate-700">
                          {row.nssf_deduction > 0 ? fmt(row.nssf_deduction) : '-'}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1.5 text-right text-slate-700">
                          {row.nhif_deduction > 0 ? fmt(row.nhif_deduction) : '-'}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1.5 text-right text-slate-700">
                          {row.housing_levy_deduction > 0 ? fmt(row.housing_levy_deduction) : '-'}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1.5 text-right text-slate-700">
                          {(row.sacco_welfare_deduction + row.other_deductions) > 0 ? fmt(row.sacco_welfare_deduction + row.other_deductions) : '-'}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1.5 text-right font-bold text-rose-600">
                          {row.tax_deduction > 0 ? fmt(row.tax_deduction) : '-'}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1.5 text-right font-bold text-emerald-700">
                          {row.net_pay > 0 ? fmt(row.net_pay) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row bg-slate-900 text-white font-bold">
                      <td className="border border-slate-800 px-2.5 py-2 text-white font-bold text-left">ANNUAL TOTAL</td>
                      <td className="border border-slate-800 px-2.5 py-2 text-right text-white font-extrabold">{fmt(data.totals.total_gross)}</td>
                      <td className="border border-slate-800 px-2.5 py-2 text-right text-white">{fmt(data.totals.total_nssf)}</td>
                      <td className="border border-slate-800 px-2.5 py-2 text-right text-white">{fmt(data.totals.total_nhif)}</td>
                      <td className="border border-slate-800 px-2.5 py-2 text-right text-white">{fmt(data.totals.total_housing_levy)}</td>
                      <td className="border border-slate-800 px-2.5 py-2 text-right text-white">{fmt(data.totals.total_sacco_welfare)}</td>
                      <td className="border border-slate-800 px-2.5 py-2 text-right text-rose-300 font-extrabold">{fmt(data.totals.total_tax)}</td>
                      <td className="border border-slate-800 px-2.5 py-2 text-right text-emerald-300 font-extrabold">{fmt(data.totals.total_net)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Statutory Declaration */}
              <div className="footer-area mt-6 grid grid-cols-2 gap-8 border-t border-slate-300 pt-4">
                <div>
                  <p className="text-xs text-slate-600 italic leading-relaxed">
                    I certify that the above particulars are correct and complete to the best of my knowledge and belief,
                    and that income tax has been properly deducted from the emoluments of the above named employee
                    in accordance with the Income Tax Act (Cap. 470) of the Laws of Kenya.
                  </p>
                  <div className="border-t border-slate-400 pt-2 mt-8">
                    <p className="text-xs text-slate-600 font-semibold">Authorized Employer Signature &amp; Official Rubber Stamp</p>
                  </div>
                </div>
                <div>
                  <div className="prepared-box text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-1">
                    <p className="font-semibold text-slate-800">Employer Certificate Details:</p>
                    <p><span className="text-slate-500">Prepared By: </span>{user?.name || user?.email || 'System User'}</p>
                    <p><span className="text-slate-500">Certified Date: </span>{today}</p>
                    <p className="text-[11px] text-slate-400">Electronic verification generated by CHDF / Empower School ERP</p>
                  </div>
                </div>
              </div>

              <p className="disclaimer text-center text-[10px] text-slate-400 mt-4">
                This P9 form is auto-generated from approved payroll records. Submit during annual individual tax returns on KRA iTax.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default P9Form;
