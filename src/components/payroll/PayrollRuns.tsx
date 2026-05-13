import React, { useState } from 'react';
import { DollarSign, Clock, CheckCircle, AlertCircle, Eye, Edit, Printer } from 'lucide-react';
import type { PayrollRun } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { PayrollService } from '../../services/payrollService';

interface PayrollRunsProps {
  payrollRuns: PayrollRun[];
  onApproveRun: (runId: string) => Promise<void>;
  onPayRun: (runId: string) => Promise<void>;
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
  const currency = settings?.default_currency || 'KES';

  const fmt = (n: number | string) =>
    Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleApprove = async (runId: string) => {
    setLoadingRun(runId);
    try { await onApproveRun(runId); } finally { setLoadingRun(null); }
  };

  const handlePay = async (runId: string) => {
    setLoadingRun(runId);
    try { await onPayRun(runId); } finally { setLoadingRun(null); }
  };

  const handlePrintPayslip = async (run: PayrollRun) => {
    setLoadingRun(run.id);
    try {
      const payslip = await PayrollService.getPayslip(run.id);
      const data = payslip || run;
      const emp = data.employee || run.employee;
      const period = data.period;

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
              <tr><td>PAYE (Income Tax)</td><td class="amount">${fmt(data.tax_deduction)}</td></tr>
              <tr><td>NSSF</td><td class="amount">${fmt(data.nssf_deduction)}</td></tr>
              <tr><td>NHIF / SHA</td><td class="amount">${fmt(data.nhif_deduction)}</td></tr>
              <tr><td>Housing Levy</td><td class="amount">${fmt(data.housing_levy_deduction)}</td></tr>
              ${Number(data.other_deductions) > 0 ? `<tr><td>Other Deductions</td><td class="amount">${fmt(data.other_deductions)}</td></tr>` : ''}
              <tr class="total-row"><td>Total Deductions</td><td class="amount">${fmt(
                Number(data.tax_deduction) + Number(data.nssf_deduction) +
                Number(data.nhif_deduction) + Number(data.housing_levy_deduction) +
                Number(data.other_deductions)
              )}</td></tr>
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
      case 'draft':    return 'bg-gray-100 text-gray-700 border border-gray-300';
      case 'approved': return 'bg-amber-50 text-amber-700 border border-amber-300';
      case 'paid':     return 'bg-green-50 text-green-700 border border-green-300';
      default:         return 'bg-red-50 text-red-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':    return <Clock className="h-3 w-3 mr-1" />;
      case 'approved': return <CheckCircle className="h-3 w-3 mr-1" />;
      case 'paid':     return <DollarSign className="h-3 w-3 mr-1" />;
      default:         return <AlertCircle className="h-3 w-3 mr-1" />;
    }
  };

  const totalGross  = payrollRuns.reduce((s, r) => s + Number(r.gross_pay  || 0), 0);
  const totalNet    = payrollRuns.reduce((s, r) => s + Number(r.net_pay    || 0), 0);
  const totalTax    = payrollRuns.reduce((s, r) => s + Number(r.tax_deduction || 0), 0);
  const draftCount    = payrollRuns.filter(r => r.status === 'draft').length;
  const approvedCount = payrollRuns.filter(r => r.status === 'approved').length;
  const paidCount     = payrollRuns.filter(r => r.status === 'paid').length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Payroll Runs</h3>
          <p className="text-sm text-gray-500">
            {payrollRuns.length} employee{payrollRuns.length !== 1 ? 's' : ''} ·{' '}
            <span className="text-gray-400">{draftCount} draft</span> ·{' '}
            <span className="text-amber-600">{approvedCount} approved</span> ·{' '}
            <span className="text-green-600">{paidCount} paid</span>
          </p>
        </div>
        {payrollRuns.length > 0 && (
          <div className="text-right text-sm">
            <div className="text-gray-500">Total Gross / Net</div>
            <div className="font-semibold text-gray-900">
              {currency} {fmt(totalGross)} / {currency} {fmt(totalNet)}
            </div>
            <div className="text-xs text-red-500">Tax: {currency} {fmt(totalTax)}</div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Basic</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Deductions</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Pay</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {payrollRuns.map((run) => {
              const totalDed = Number(run.tax_deduction || 0) + Number(run.nssf_deduction || 0) +
                Number(run.nhif_deduction || 0) + Number(run.housing_levy_deduction || 0) +
                Number(run.other_deductions || 0);
              return (
                <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-700">
                          {(run.employee?.first_name?.[0] || '?')}{(run.employee?.last_name?.[0] || '')}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {run.employee?.first_name || '—'} {run.employee?.last_name || ''}
                        </div>
                        <div className="text-xs text-gray-400">{run.employee?.position || 'No position'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-700">{currency} {fmt(run.basic_salary)}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">{currency} {fmt(run.gross_pay)}</td>
                  <td className="px-5 py-3 text-right text-red-600">– {currency} {fmt(totalDed)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-green-700">{currency} {fmt(run.net_pay)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadge(run.status)}`}>
                      {getStatusIcon(run.status)}
                      {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end space-x-2">
                      {/* View details */}
                      <button onClick={() => onViewRun(run)} title="View Details"
                        className="text-blue-500 hover:text-blue-700 transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>

                      {/* Print payslip */}
                      <button onClick={() => handlePrintPayslip(run)} title="Print Payslip"
                        disabled={loadingRun === run.id}
                        className="text-purple-500 hover:text-purple-700 transition-colors disabled:opacity-40">
                        <Printer className="h-4 w-4" />
                      </button>

                      {/* Edit (only draft) */}
                      {run.status === 'draft' && (
                        <button onClick={() => onEditRun(run)} title="Edit Adjustments"
                          className="text-green-500 hover:text-green-700 transition-colors">
                          <Edit className="h-4 w-4" />
                        </button>
                      )}

                      {/* Approve (only draft) */}
                      {run.status === 'draft' && (
                        <button
                          onClick={() => handleApprove(run.id)}
                          disabled={loadingRun === run.id}
                          title="Approve"
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-40 transition-colors">
                          {loadingRun === run.id
                            ? <div className="animate-spin h-3 w-3 border-b-2 border-amber-700 rounded-full" />
                            : <><CheckCircle className="h-3 w-3 mr-1" />Approve</>}
                        </button>
                      )}

                      {/* Mark as Paid (only approved) */}
                      {run.status === 'approved' && (
                        <button
                          onClick={() => handlePay(run.id)}
                          disabled={loadingRun === run.id}
                          title="Mark as Paid & Post Journal Entry"
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40 transition-colors">
                          {loadingRun === run.id
                            ? <div className="animate-spin h-3 w-3 border-b-2 border-green-700 rounded-full" />
                            : <><DollarSign className="h-3 w-3 mr-1" />Pay</>}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer totals */}
          {payrollRuns.length > 0 && (
            <tfoot className="bg-blue-50">
              <tr>
                <td colSpan={2} className="px-5 py-3 font-semibold text-blue-900">
                  Totals ({payrollRuns.length} employees)
                </td>
                <td className="px-5 py-3 text-right font-semibold text-blue-900">{currency} {fmt(totalGross)}</td>
                <td className="px-5 py-3 text-right font-semibold text-red-600">
                  – {currency} {fmt(payrollRuns.reduce((s, r) => s + Number(r.tax_deduction||0) + Number(r.nssf_deduction||0) + Number(r.nhif_deduction||0) + Number(r.housing_levy_deduction||0) + Number(r.other_deductions||0), 0))}
                </td>
                <td className="px-5 py-3 text-right font-bold text-green-700">{currency} {fmt(totalNet)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {payrollRuns.length === 0 && (
        <div className="text-center py-16">
          <DollarSign className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-500 mb-1">No payroll runs yet</h3>
          <p className="text-sm text-gray-400">Click "Generate Payroll" to create runs for all active employees.</p>
        </div>
      )}
    </div>
  );
};

export default PayrollRuns;