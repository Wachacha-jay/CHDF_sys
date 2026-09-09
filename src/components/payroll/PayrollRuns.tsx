import React, { useState } from 'react';
import { DollarSign, Clock, CheckCircle, AlertCircle, Eye, Edit, Printer, Building2, Check, ArrowRight } from 'lucide-react';
import type { PayrollRun } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { PayrollService } from '../../services/payrollService';
import PayrollPaymentModal from './PayrollPaymentModal';

interface PayrollRunsProps {
  payrollRuns: PayrollRun[];
  onApproveRun: (runId: string) => Promise<void>;
  onPayRun: (runId: string, paymentData?: {
    payment_account_id: string;
    payment_date: string;
    payment_reference: string;
    notes: string;
  }) => Promise<boolean | void>;
  onViewRun: (run: PayrollRun) => void;
  onEditRun: (run: PayrollRun) => void;
  periodStatus?: string;
}

const PayrollRuns: React.FC<PayrollRunsProps> = ({
  payrollRuns,
  onApproveRun,
  onPayRun,
  onViewRun,
  onEditRun,
  periodStatus,
}) => {
  const { settings } = useSettingsContext();
  const [loadingRun, setLoadingRun] = useState<string | null>(null);
  const [payingRun, setPayingRun] = useState<PayrollRun | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const currency = settings?.default_currency || 'KES';

  const fmt = (n: number | string | undefined) =>
    Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleApprove = async (runId: string) => {
    setLoadingRun(runId);
    try { await onApproveRun(runId); } finally { setLoadingRun(null); }
  };

  const handleOpenPayModal = (run: PayrollRun) => {
    setPayingRun(run);
    setShowPayModal(true);
  };

  const handleConfirmPayment = async (runId: string, paymentData: {
    payment_account_id: string;
    payment_date: string;
    payment_reference: string;
    notes: string;
  }): Promise<boolean> => {
    try {
      const ok = await onPayRun(runId, paymentData);
      return ok !== false;
    } catch {
      return false;
    }
  };

  const handlePrintPayslip = async (run: PayrollRun) => {
    setLoadingRun(run.id);
    try {
      const payslip = await PayrollService.getPayslip(run.id);
      const data = payslip || run;
      const emp = data.employee || run.employee;
      const period = data.period;

      const totalDed = 
        Number(data.tax_deduction || 0) +
        Number(data.nssf_deduction || 0) +
        Number(data.nhif_deduction || 0) +
        Number(data.housing_levy_deduction || 0) +
        Number(data.sacco_welfare_deduction || 0) +
        Number(data.other_deductions || 0);

      const html = `
        <html><head>
          <title>Payslip - ${emp?.first_name} ${emp?.last_name}</title>
          <style>
            body{font-family:'Segoe UI',sans-serif;padding:32px;color:#1e293b;max-width:680px;margin:0 auto}
            .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:24px}
            .company-name{font-size:22px;font-weight:700;color:#2563eb}
            .payslip-title{text-align:right}
            .payslip-title h2{margin:0;font-size:18px;color:#1e293b}
            .payslip-title p{margin:4px 0;font-size:13px;color:#64748b}
            .employee-section{display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:24px}
            .field label{font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
            .field p{margin:2px 0;font-size:14px;font-weight:500;color:#1e293b}
            table{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px}
            th{background:#f1f5f9;padding:10px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#475569;border:1px solid #e2e8f0}
            td{padding:10px 12px;border:1px solid #e2e8f0}
            .amount{text-align:right}
            .total-row td{background:#f8fafc;font-weight:700}
            .net-row td{background:#2563eb;color:white;font-size:15px;font-weight:700}
            .footer{margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:12px;color:#94a3b8;text-align:center}
            @media print{body{padding:16px}}
          </style>
        </head><body>
          <div class="header">
            <div>
              <div class="company-name">Payslip</div>
              <div style="font-size:13px;color:#64748b;margin-top:4px">
                Period: ${period?.period_name || '—'}
              </div>
              <div style="font-size:13px;color:#64748b">
                Pay Date: ${period?.pay_date ? new Date(period.pay_date).toLocaleDateString() : '—'}
              </div>
            </div>
            <div class="payslip-title">
              <h2>Employee Payslip</h2>
              <p>${emp?.code || ''}</p>
              <p>Status: <strong style="color:${data.status === 'paid' ? '#16a34a' : '#d97706'}">${(data.status || '').toUpperCase()}</strong></p>
            </div>
          </div>

          <div class="employee-section">
            <div class="field"><label>Employee Name</label><p>${emp?.first_name || ''} ${emp?.last_name || ''}</p></div>
            <div class="field"><label>Position</label><p>${emp?.position || '—'}</p></div>
            <div class="field"><label>Department</label><p>${emp?.department || '—'}</p></div>
            <div class="field"><label>Payment Method</label><p>${emp?.payment_method || '—'}</p></div>
            ${emp?.bank_name ? `<div class="field"><label>Bank</label><p>${emp.bank_name}</p></div>` : ''}
            ${emp?.bank_account ? `<div class="field"><label>Account No.</label><p>${emp.bank_account}</p></div>` : ''}
            ${data.payment_account ? `<div class="field"><label>Paid From Account</label><p>[${data.payment_account.code}] ${data.payment_account.name}</p></div>` : ''}
            ${data.payment_reference ? `<div class="field"><label>Payment Reference</label><p>${data.payment_reference}</p></div>` : ''}
            ${emp?.nssf_number || data.employee?.nssf_no ? `<div class="field"><label>NSSF No.</label><p>${emp?.nssf_number || data.employee?.nssf_no || ''}</p></div>` : ''}
            ${emp?.nhif_number || data.employee?.nhif_no ? `<div class="field"><label>NHIF/SHA No.</label><p>${emp?.nhif_number || data.employee?.nhif_no || ''}</p></div>` : ''}
            ${emp?.tax_pin || data.employee?.tax_pin ? `<div class="field"><label>KRA PIN</label><p>${emp?.tax_pin || data.employee?.tax_pin || ''}</p></div>` : ''}
          </div>

          <table>
            <thead><tr><th>Earnings</th><th class="amount">Amount (${currency})</th></tr></thead>
            <tbody>
              <tr><td>Basic Salary</td><td class="amount">${fmt(data.basic_salary)}</td></tr>
              ${Number(data.overtime_pay) > 0 ? `<tr><td>Overtime Pay (${fmt(data.overtime_hours)} hrs)</td><td class="amount">${fmt(data.overtime_pay)}</td></tr>` : ''}
              ${Number(data.holiday_pay) > 0 ? `<tr><td>Holiday Pay (${fmt(data.holiday_hours)} hrs)</td><td class="amount">${fmt(data.holiday_pay)}</td></tr>` : ''}
              ${Number(data.allowances) > 0 ? `<tr><td>Allowances</td><td class="amount">${fmt(data.allowances)}</td></tr>` : ''}
              ${Number(data.bonuses) > 0 ? `<tr><td>Bonuses</td><td class="amount">${fmt(data.bonuses)}</td></tr>` : ''}
              <tr class="total-row"><td>Gross Pay</td><td class="amount">${fmt(data.gross_pay)}</td></tr>
            </tbody>
          </table>

          <table>
            <thead><tr><th>Deductions</th><th class="amount">Amount (${currency})</th></tr></thead>
            <tbody>
              ${Number(data.tax_deduction) > 0 ? `<tr><td>PAYE (Income Tax)</td><td class="amount">${fmt(data.tax_deduction)}</td></tr>` : ''}
              ${Number(data.nssf_deduction) > 0 ? `<tr><td>NSSF</td><td class="amount">${fmt(data.nssf_deduction)}</td></tr>` : ''}
              ${Number(data.nhif_deduction) > 0 ? `<tr><td>NHIF / SHA</td><td class="amount">${fmt(data.nhif_deduction)}</td></tr>` : ''}
              ${Number(data.housing_levy_deduction) > 0 ? `<tr><td>Housing Levy</td><td class="amount">${fmt(data.housing_levy_deduction)}</td></tr>` : ''}
              ${Number(data.sacco_welfare_deduction) > 0 ? `<tr><td>Sacco & Staff Welfare</td><td class="amount">${fmt(data.sacco_welfare_deduction)}</td></tr>` : ''}
              ${Number(data.other_deductions) > 0 ? `<tr><td>Other Deductions</td><td class="amount">${fmt(data.other_deductions)}</td></tr>` : ''}
              <tr class="total-row"><td>Total Deductions</td><td class="amount">${fmt(totalDed)}</td></tr>
            </tbody>
          </table>

          <table>
            <tbody>
              <tr class="net-row"><td>NET PAY</td><td class="amount">${currency} ${fmt(data.net_pay)}</td></tr>
            </tbody>
          </table>

          ${data.notes && data.notes !== 'Auto-generated' ? `<p style="font-size:13px;color:#64748b">Notes: ${data.notes}</p>` : ''}

          <div class="footer">
            This payslip is computer generated and requires no signature. · Generated ${new Date().toLocaleDateString()}
          </div>
        </body></html>`;

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 500);
      }
    } catch (e) {
      console.error('Payslip error:', e);
    } finally {
      setLoadingRun(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':    return 'bg-slate-100 text-slate-700 border border-slate-300';
      case 'approved': return 'bg-amber-50 text-amber-700 border border-amber-300';
      case 'paid':     return 'bg-emerald-50 text-emerald-700 border border-emerald-300';
      default:         return 'bg-red-50 text-red-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':    return <Clock className="h-3 w-3 mr-1" />;
      case 'approved': return <CheckCircle className="h-3 w-3 mr-1" />;
      case 'paid':     return <Check className="h-3 w-3 mr-1" />;
      default:         return <AlertCircle className="h-3 w-3 mr-1" />;
    }
  };

  const totalGross   = payrollRuns.reduce((s, r) => s + Number(r.gross_pay || 0), 0);
  const totalNet     = payrollRuns.reduce((s, r) => s + Number(r.net_pay || 0), 0);
  const totalTax     = payrollRuns.reduce((s, r) => s + Number(r.tax_deduction || 0), 0);
  const totalSacco   = payrollRuns.reduce((s, r) => s + Number(r.sacco_welfare_deduction || 0), 0);
  const draftCount    = payrollRuns.filter(r => r.status === 'draft').length;
  const approvedCount = payrollRuns.filter(r => r.status === 'approved').length;
  const paidCount     = payrollRuns.filter(r => r.status === 'paid').length;

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-full">
        {/* Runs Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-gray-900">Individual Employee Runs</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {payrollRuns.length} Employees
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="text-slate-500 font-medium">{draftCount} draft</span> ·{' '}
              <span className="text-amber-600 font-medium">{approvedCount} approved</span> ·{' '}
              <span className="text-emerald-600 font-medium">{paidCount} paid & posted to GL</span>
            </p>
          </div>
          {payrollRuns.length > 0 && (
            <div className="flex items-center space-x-6 text-sm">
              <div className="text-right">
                <span className="text-xs text-gray-400 uppercase tracking-wider block">Total Gross</span>
                <span className="font-bold text-gray-900">{currency} {fmt(totalGross)}</span>
              </div>
              {totalSacco > 0 && (
                <div className="text-right">
                  <span className="text-xs text-indigo-400 uppercase tracking-wider block">Sacco/Welfare</span>
                  <span className="font-bold text-indigo-700">{currency} {fmt(totalSacco)}</span>
                </div>
              )}
              <div className="text-right pl-4 border-l border-gray-200">
                <span className="text-xs text-emerald-600 uppercase tracking-wider block">Total Net Pay</span>
                <span className="font-extrabold text-emerald-700 text-base">{currency} {fmt(totalNet)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Full-width Runs Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Employee</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Basic Salary</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Gross Pay</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Deductions</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Net Pay</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Disbursement / Status</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {payrollRuns.map((run) => {
                const totalDed = 
                  Number(run.tax_deduction || 0) + 
                  Number(run.nssf_deduction || 0) +
                  Number(run.nhif_deduction || 0) + 
                  Number(run.housing_levy_deduction || 0) +
                  Number(run.sacco_welfare_deduction || 0) + 
                  Number(run.other_deductions || 0);

                return (
                  <tr key={run.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center mr-3 flex-shrink-0 font-bold text-xs shadow-sm">
                          {(run.employee?.first_name?.[0] || '?')}{(run.employee?.last_name?.[0] || '')}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 leading-snug">
                            {run.employee?.first_name || '—'} {run.employee?.last_name || ''}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center space-x-1.5">
                            <span>{run.employee?.code || '—'}</span>
                            <span>•</span>
                            <span className="text-slate-600 font-medium">{run.employee?.department || 'General'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right font-medium text-slate-600">
                      {currency} {fmt(run.basic_salary)}
                    </td>

                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                      {currency} {fmt(run.gross_pay)}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="text-red-600 font-semibold">– {currency} {fmt(totalDed)}</div>
                      {Number(run.sacco_welfare_deduction) > 0 && (
                        <div className="text-[10px] text-indigo-600 font-medium">
                          Sacco: {currency} {fmt(run.sacco_welfare_deduction)}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="font-bold text-emerald-700 text-base">
                        {currency} {fmt(run.net_pay)}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadge(run.status)}`}>
                          {getStatusIcon(run.status)}
                          {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                        </span>
                        {run.status === 'paid' && (
                          <div className="mt-1 text-left text-[11px] text-slate-500">
                            {run.payment_account ? (
                              <span className="inline-flex items-center text-slate-700 font-medium">
                                <Building2 className="h-3 w-3 mr-0.5 text-slate-400" />
                                [{run.payment_account.code}] {run.payment_account.name}
                              </span>
                            ) : (
                              <span className="text-slate-400">Paid from Bank</span>
                            )}
                            {run.payment_reference && (
                              <span className="block text-[10px] text-slate-400">Ref: {run.payment_reference}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* View details */}
                        <button
                          onClick={() => onViewRun(run)}
                          title="View Details"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Print payslip */}
                        <button
                          onClick={() => handlePrintPayslip(run)}
                          title="Print Payslip"
                          disabled={loadingRun === run.id}
                          className="p-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-40"
                        >
                          <Printer className="h-4 w-4" />
                        </button>

                        {/* Edit (draft only) */}
                        {run.status === 'draft' && (
                          <button
                            onClick={() => onEditRun(run)}
                            title="Edit Deductions & Earnings"
                            className="p-1.5 text-slate-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}

                        {/* Approve (draft only) */}
                        {run.status === 'draft' && (
                          <button
                            onClick={() => handleApprove(run.id)}
                            disabled={loadingRun === run.id}
                            title="Approve Run"
                            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors disabled:opacity-50"
                          >
                            {loadingRun === run.id ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approve
                              </>
                            )}
                          </button>
                        )}

                        {/* Pay Individual (approved or draft) */}
                        {run.status !== 'paid' && (
                          <button
                            onClick={() => handleOpenPayModal(run)}
                            title="Choose Paying Account & Disburse"
                            className="inline-flex items-center px-3 py-1 text-xs font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all hover:shadow"
                          >
                            <DollarSign className="h-3 w-3 mr-0.5" />
                            Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Footer Totals */}
            {payrollRuns.length > 0 && (
              <tfoot className="bg-slate-100/80 border-t-2 border-slate-200">
                <tr>
                  <td className="px-5 py-3 font-bold text-slate-800">
                    Grand Totals ({payrollRuns.length} employees)
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">
                    {currency} {fmt(payrollRuns.reduce((s, r) => s + Number(r.basic_salary || 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">
                    {currency} {fmt(totalGross)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">
                    – {currency} {fmt(payrollRuns.reduce((s, r) => 
                      s + Number(r.tax_deduction || 0) + Number(r.nssf_deduction || 0) +
                      Number(r.nhif_deduction || 0) + Number(r.housing_levy_deduction || 0) +
                      Number(r.sacco_welfare_deduction || 0) + Number(r.other_deductions || 0), 0
                    ))}
                  </td>
                  <td className="px-4 py-3 text-right font-extrabold text-emerald-700 text-base">
                    {currency} {fmt(totalNet)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {payrollRuns.length === 0 && (
          <div className="text-center py-16 px-4">
            <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700 mb-1">No payroll runs found</h3>
            <p className="text-xs text-slate-500">
              Click &quot;Generate Payroll&quot; above to calculate payroll runs for this period.
            </p>
          </div>
        )}
      </div>

      {/* Professional Individual Payment Modal */}
      <PayrollPaymentModal
        isOpen={showPayModal}
        onClose={() => {
          setShowPayModal(false);
          setPayingRun(null);
        }}
        onConfirmPayment={handleConfirmPayment}
        run={payingRun}
      />
    </>
  );
};

export default PayrollRuns;