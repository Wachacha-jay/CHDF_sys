import React from 'react';
import { X, Printer } from 'lucide-react';
import type { PayrollRun, PayrollDeduction, PayrollAllowance } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface PayrollDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollRun: PayrollRun | null;
  deductions: PayrollDeduction[];
  allowances: PayrollAllowance[];
}

const PayrollDetailsModal: React.FC<PayrollDetailsModalProps> = ({
  isOpen,
  onClose,
  payrollRun,
  deductions,
  allowances,
}) => {
  const { settings } = useSettingsContext();
  if (!isOpen || !payrollRun) return null;

  const currency = settings?.default_currency || 'KES';
  const fmt = (n: number | string) =>
    Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const emp = payrollRun.employee;
  const totalDeductions =
    Number(payrollRun.tax_deduction || 0) +
    Number(payrollRun.nssf_deduction || 0) +
    Number(payrollRun.nhif_deduction || 0) +
    Number(payrollRun.housing_levy_deduction || 0) +
    Number(payrollRun.other_deductions || 0) +
    deductions.reduce((s, d) => s + Number(d.amount || 0), 0);

  const handlePrint = () => {
    const printArea = document.getElementById('payslip-print-area');
    if (!printArea) return;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`
        <html><head>
          <title>Payslip - ${emp?.first_name} ${emp?.last_name}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', sans-serif; padding: 24px; color: #1e293b; max-width: 700px; margin: 0 auto; }
            h1 { font-size: 20px; font-weight: 700; margin: 0; }
            .header { border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
            .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
            .badge-paid { background: #dcfce7; color: #16a34a; }
            .badge-approved { background: #fef3c7; color: #d97706; }
            .badge-draft { background: #f1f5f9; color: #475569; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
            .label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
            .value { font-size: 14px; font-weight: 500; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
            th { text-align: left; padding: 8px 10px; background: #f1f5f9; border: 1px solid #e2e8f0; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
            th.right, td.right { text-align: right; }
            td { padding: 8px 10px; border: 1px solid #e2e8f0; }
            .total td { font-weight: 700; background: #f8fafc; }
            .net td { font-weight: 800; background: #2563eb; color: white; font-size: 15px; }
            .footer { border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center; margin-top: 20px; }
          </style>
        </head><body>
          ${printArea.innerHTML}
          <div class="footer">This is a computer-generated payslip and does not require a signature. · ${new Date().toLocaleDateString()}</div>
        </body></html>`);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 400);
    }
  };

  const statusBadge = payrollRun.status === 'paid'
    ? 'bg-green-100 text-green-700 border border-green-300'
    : payrollRun.status === 'approved'
    ? 'bg-amber-100 text-amber-700 border border-amber-300'
    : 'bg-gray-100 text-gray-600 border border-gray-300';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Payslip Details</h3>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge}`}>
              {payrollRun.status.charAt(0).toUpperCase() + payrollRun.status.slice(1)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print Payslip
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Payslip body (printable) */}
        <div id="payslip-print-area" className="p-8">
          {/* Payslip Header */}
          <div className="flex justify-between items-start border-b-2 border-blue-600 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-blue-700">{settings?.business_name || 'Business'}</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {settings?.business_address || ''} {settings?.business_phone ? `· ${settings.business_phone}` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">Employee Payslip</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${statusBadge} mt-1`}>
                {payrollRun.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Employee & Period Info */}
          <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg mb-6 text-sm">
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Employee</p>
              <div><span className="text-gray-500">Name: </span><strong>{emp?.first_name} {emp?.last_name}</strong></div>
              <div><span className="text-gray-500">Code: </span>{emp?.code || '—'}</div>
              <div><span className="text-gray-500">Position: </span>{emp?.position || '—'}</div>
              <div><span className="text-gray-500">Department: </span>{emp?.department || '—'}</div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Payment Info</p>
              <div><span className="text-gray-500">Method: </span>{emp?.payment_method || 'bank'}</div>
              {emp?.bank_name && <div><span className="text-gray-500">Bank: </span>{emp.bank_name}</div>}
              {emp?.bank_account && <div><span className="text-gray-500">Account: </span>{emp.bank_account}</div>}
              {(emp as any)?.nssf_no && <div><span className="text-gray-500">NSSF: </span>{(emp as any).nssf_no}</div>}
              {(emp as any)?.nhif_no && <div><span className="text-gray-500">NHIF/SHA: </span>{(emp as any).nhif_no}</div>}
              {(emp as any)?.tax_pin && <div><span className="text-gray-500">KRA PIN: </span>{(emp as any).tax_pin}</div>}
            </div>
          </div>

          {/* Earnings & Deductions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Earnings */}
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 bg-gray-100 border border-gray-200 rounded-tl">Earnings</th>
                    <th className="text-right py-2 px-3 bg-gray-100 border border-gray-200 rounded-tr">Amount ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-2 px-3 border border-gray-100 text-gray-700">Basic Salary</td>
                    <td className="py-2 px-3 border border-gray-100 text-right font-medium">{fmt(payrollRun.basic_salary)}</td>
                  </tr>
                  {Number(payrollRun.overtime_pay) > 0 && (
                    <tr>
                      <td className="py-2 px-3 border border-gray-100 text-gray-700">Overtime ({fmt(payrollRun.overtime_hours)} hrs)</td>
                      <td className="py-2 px-3 border border-gray-100 text-right font-medium">{fmt(payrollRun.overtime_pay)}</td>
                    </tr>
                  )}
                  {Number(payrollRun.holiday_pay) > 0 && (
                    <tr>
                      <td className="py-2 px-3 border border-gray-100 text-gray-700">Holiday Pay ({fmt(payrollRun.holiday_hours)} hrs)</td>
                      <td className="py-2 px-3 border border-gray-100 text-right font-medium">{fmt(payrollRun.holiday_pay)}</td>
                    </tr>
                  )}
                  {Number(payrollRun.allowances) > 0 && (
                    <tr>
                      <td className="py-2 px-3 border border-gray-100 text-gray-700">Allowances</td>
                      <td className="py-2 px-3 border border-gray-100 text-right font-medium">{fmt(payrollRun.allowances)}</td>
                    </tr>
                  )}
                  {Number(payrollRun.bonuses) > 0 && (
                    <tr>
                      <td className="py-2 px-3 border border-gray-100 text-gray-700">Bonuses</td>
                      <td className="py-2 px-3 border border-gray-100 text-right font-medium">{fmt(payrollRun.bonuses)}</td>
                    </tr>
                  )}
                  {allowances.map((a, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 border border-gray-100 text-gray-700">{a.description}</td>
                      <td className="py-2 px-3 border border-gray-100 text-right font-medium">{fmt(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50">
                    <td className="py-2 px-3 border border-gray-200 font-bold text-blue-900">Gross Pay</td>
                    <td className="py-2 px-3 border border-gray-200 text-right font-bold text-blue-900">{fmt(payrollRun.gross_pay)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Deductions */}
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 bg-gray-100 border border-gray-200 rounded-tl">Deductions</th>
                    <th className="text-right py-2 px-3 bg-gray-100 border border-gray-200 rounded-tr">Amount ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-2 px-3 border border-gray-100 text-gray-700">PAYE (Income Tax)</td>
                    <td className="py-2 px-3 border border-gray-100 text-right text-red-600 font-medium">{fmt(payrollRun.tax_deduction)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 border border-gray-100 text-gray-700">NSSF</td>
                    <td className="py-2 px-3 border border-gray-100 text-right text-red-600 font-medium">{fmt(payrollRun.nssf_deduction)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 border border-gray-100 text-gray-700">NHIF / SHA</td>
                    <td className="py-2 px-3 border border-gray-100 text-right text-red-600 font-medium">{fmt(payrollRun.nhif_deduction)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 border border-gray-100 text-gray-700">Housing Levy</td>
                    <td className="py-2 px-3 border border-gray-100 text-right text-red-600 font-medium">{fmt(payrollRun.housing_levy_deduction)}</td>
                  </tr>
                  {Number(payrollRun.other_deductions) > 0 && (
                    <tr>
                      <td className="py-2 px-3 border border-gray-100 text-gray-700">Other Deductions</td>
                      <td className="py-2 px-3 border border-gray-100 text-right text-red-600 font-medium">{fmt(payrollRun.other_deductions)}</td>
                    </tr>
                  )}
                  {deductions.map((d, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 border border-gray-100 text-gray-700">{d.description}</td>
                      <td className="py-2 px-3 border border-gray-100 text-right text-red-600 font-medium">{fmt(d.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-red-50">
                    <td className="py-2 px-3 border border-gray-200 font-bold text-red-700">Total Deductions</td>
                    <td className="py-2 px-3 border border-gray-200 text-right font-bold text-red-700">{fmt(totalDeductions)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Net Pay Banner */}
          <div className="bg-blue-700 rounded-xl p-5 text-white flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium uppercase tracking-widest">Net Pay</p>
              <p className="text-xs text-blue-300 mt-1">After all deductions</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-extrabold">{currency} {fmt(payrollRun.net_pay)}</p>
            </div>
          </div>

          {payrollRun.notes && payrollRun.notes !== 'Auto-generated' && (
            <p className="mt-4 text-sm text-gray-500 italic">Notes: {payrollRun.notes}</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print Payslip
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayrollDetailsModal;