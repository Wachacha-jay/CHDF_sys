import React from 'react';
import { Printer, X } from 'lucide-react';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useAuthContext } from '../../contexts/useAuthContext';

interface P9MonthData {
  month: number;
  month_name: string;
  gross_pay: number;
  tax_deduction: number;
  nhif_deduction: number;
  nssf_deduction: number;
  housing_levy_deduction: number;
  sacco_welfare_deduction: number;
  other_deductions: number;
  net_pay: number;
  period_name: string;
}

interface P9Data {
  employee_id: string;
  year: number;
  employee: {
    first_name: string;
    last_name: string;
    code: string;
    tax_pin: string;
    nssf_number: string;
    nhif_number: string;
    department: string;
    position: string;
  };
  business: {
    business_name: string;
    kra_pin?: string;
    business_address?: string;
    business_phone?: string;
  };
  monthly_data: P9MonthData[];
  totals: {
    total_gross: number;
    total_tax: number;
    total_nhif: number;
    total_nssf: number;
    total_housing_levy: number;
    total_sacco_welfare: number;
    total_net: number;
  };
}

interface P9FormProps {
  data: P9Data;
  onClose: () => void;
}

const ALL_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const P9Form: React.FC<P9FormProps> = ({ data, onClose }) => {
  const { settings } = useSettingsContext();
  const { user } = useAuthContext();
  const currency = settings?.default_currency || 'KES';
  const fmt = (n: number) =>
    Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' });

  const monthMap = new Map<number, P9MonthData>();
  data.monthly_data.forEach(m => monthMap.set(m.month, m));
  const allMonthRows = ALL_MONTHS.map((name, idx) => {
    const m = monthMap.get(idx + 1);
    return m || { month: idx + 1, month_name: name, gross_pay: 0, tax_deduction: 0, nhif_deduction: 0, nssf_deduction: 0, housing_levy_deduction: 0, sacco_welfare_deduction: 0, other_deductions: 0, net_pay: 0, period_name: '' };
  });

  const handlePrint = () => {
    const printContent = document.getElementById('p9-print-area');
    if (!printContent) return;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write('<html><head><title>P9 Form - ' + data.employee.first_name + ' ' + data.employee.last_name + ' - ' + data.year + '</title><style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px; } .p9-header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 10px; } .p9-header h1 { font-size: 16px; font-weight: bold; text-transform: uppercase; } .p9-header h2 { font-size: 13px; font-weight: bold; margin-top: 4px; } table { width: 100%; border-collapse: collapse; margin-bottom: 14px; } th { border: 1px solid #000; padding: 4px 5px; font-size: 9px; text-align: center; background: #f0f0f0; font-weight: bold; text-transform: uppercase; } td { border: 1px solid #ccc; padding: 4px 5px; font-size: 10px; text-align: right; } td.month-col { text-align: left; font-weight: 600; } tr.total-row td { font-weight: bold; background: #1e293b; color: #fff; border-color: #1e293b; } .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; } .info-box { border: 1px solid #aaa; padding: 8px; border-radius: 4px; } .footer-area { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 20px; padding-top: 14px; border-top: 1px solid #000; font-size: 10px; } .prepared-box { background: #f8f8f8; border: 1px solid #ccc; padding: 8px; } .disclaimer { font-size: 9px; color: #888; margin-top: 10px; text-align: center; }</style></head><body>' + printContent.innerHTML + '</body></html>');
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 400);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="w-full max-w-5xl bg-white rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-gray-900">P9 Tax Deduction Certificate</h3>
            <p className="text-sm text-gray-500">{data.employee.first_name} {data.employee.last_name} &middot; Tax Year {data.year}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div id="p9-print-area" className="p-6">
          <div className="p9-header text-center border-b-2 border-black pb-4 mb-5">
            <h1 className="text-xl font-extrabold uppercase tracking-wide">Kenya Revenue Authority</h1>
            <h2 className="text-base font-bold mt-1">P9 - Tax Deduction Card (Annual)</h2>
            <p className="text-sm mt-1 text-gray-700">Tax Year: <strong>{data.year}</strong></p>
          </div>

          <div className="info-grid grid grid-cols-2 gap-4 mb-5">
            <div className="info-box border border-gray-300 rounded-lg p-4 space-y-1.5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Employer Details</p>
              <div className="text-sm"><span className="text-gray-500">Employer Name: </span><strong>{data.business.business_name}</strong></div>
              {data.business.kra_pin && <div className="text-sm"><span className="text-gray-500">Employer KRA PIN: </span><strong>{data.business.kra_pin}</strong></div>}
              {data.business.business_address && <div className="text-sm"><span className="text-gray-500">Address: </span><span>{data.business.business_address}</span></div>}
              {data.business.business_phone && <div className="text-sm"><span className="text-gray-500">Phone: </span><span>{data.business.business_phone}</span></div>}
            </div>
            <div className="info-box border border-gray-300 rounded-lg p-4 space-y-1.5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Employee Details</p>
              <div className="text-sm"><span className="text-gray-500">Name: </span><strong>{data.employee.first_name} {data.employee.last_name}</strong></div>
              <div className="text-sm"><span className="text-gray-500">Employee No.: </span><span>{data.employee.code || '-'}</span></div>
              <div className="text-sm"><span className="text-gray-500">KRA PIN: </span><strong>{data.employee.tax_pin || '-'}</strong></div>
              <div className="text-sm"><span className="text-gray-500">NSSF No.: </span><span>{data.employee.nssf_number || '-'}</span></div>
              <div className="text-sm"><span className="text-gray-500">NHIF/SHA No.: </span><span>{data.employee.nhif_number || '-'}</span></div>
              <div className="text-sm"><span className="text-gray-500">Department: </span><span>{data.employee.department || '-'}</span></div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-gray-300 px-2 py-2 text-left font-bold uppercase text-xs">Month</th>
                  <th className="border border-gray-300 px-2 py-2 font-bold uppercase text-xs text-right">Gross Pay ({currency})</th>
                  <th className="border border-gray-300 px-2 py-2 font-bold uppercase text-xs text-right">PAYE Tax ({currency})</th>
                  <th className="border border-gray-300 px-2 py-2 font-bold uppercase text-xs text-right">NHIF/SHA ({currency})</th>
                  <th className="border border-gray-300 px-2 py-2 font-bold uppercase text-xs text-right">NSSF ({currency})</th>
                  <th className="border border-gray-300 px-2 py-2 font-bold uppercase text-xs text-right">Housing Levy ({currency})</th>
                  <th className="border border-gray-300 px-2 py-2 font-bold uppercase text-xs text-right">Other Ded. ({currency})</th>
                  <th className="border border-gray-300 px-2 py-2 font-bold uppercase text-xs text-right">Net Pay ({currency})</th>
                </tr>
              </thead>
              <tbody>
                {allMonthRows.map((row, idx) => (
                  <tr key={idx} className={row.gross_pay > 0 ? 'bg-white hover:bg-blue-50/30' : 'bg-gray-50'}>
                    <td className="month-col border border-gray-200 px-2 py-1.5 font-semibold text-gray-800">{row.month_name}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right">{row.gross_pay > 0 ? fmt(row.gross_pay) : '-'}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right text-red-600">{row.tax_deduction > 0 ? fmt(row.tax_deduction) : '-'}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right text-red-600">{row.nhif_deduction > 0 ? fmt(row.nhif_deduction) : '-'}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right text-red-600">{row.nssf_deduction > 0 ? fmt(row.nssf_deduction) : '-'}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right text-red-600">{row.housing_levy_deduction > 0 ? fmt(row.housing_levy_deduction) : '-'}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right text-red-600">{(row.sacco_welfare_deduction + row.other_deductions) > 0 ? fmt(row.sacco_welfare_deduction + row.other_deductions) : '-'}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right font-semibold text-green-700">{row.net_pay > 0 ? fmt(row.net_pay) : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row bg-slate-800 text-white font-bold">
                  <td className="border border-slate-700 px-2 py-2 text-white font-bold">ANNUAL TOTAL</td>
                  <td className="border border-slate-700 px-2 py-2 text-right text-white">{fmt(data.totals.total_gross)}</td>
                  <td className="border border-slate-700 px-2 py-2 text-right text-white">{fmt(data.totals.total_tax)}</td>
                  <td className="border border-slate-700 px-2 py-2 text-right text-white">{fmt(data.totals.total_nhif)}</td>
                  <td className="border border-slate-700 px-2 py-2 text-right text-white">{fmt(data.totals.total_nssf)}</td>
                  <td className="border border-slate-700 px-2 py-2 text-right text-white">{fmt(data.totals.total_housing_levy)}</td>
                  <td className="border border-slate-700 px-2 py-2 text-right text-white">{fmt(data.totals.total_sacco_welfare)}</td>
                  <td className="border border-slate-700 px-2 py-2 text-right text-white">{fmt(data.totals.total_net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="footer-area mt-6 grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs text-gray-500 italic">
                I certify that the above particulars are correct and complete to the best of my knowledge and belief,
                and that income tax has been properly deducted from the emoluments of the above named employee
                in accordance with the Income Tax Act (Cap. 470) of Kenya.
              </p>
              <div className="border-t border-gray-400 pt-2 mt-6">
                <p className="text-xs text-gray-500">Authorized Signature &amp; Date</p>
              </div>
            </div>
            <div>
              <div className="prepared-box text-xs text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="font-semibold text-gray-700 mb-1">Prepared by:</p>
                <p className="text-sm font-medium">{user?.name || user?.email || 'System User'}</p>
                <p className="text-gray-400 mt-1">Printed on: {today}</p>
                <p className="text-gray-400">Computer-generated - no signature required</p>
              </div>
            </div>
          </div>

          <p className="disclaimer text-center text-xs text-gray-400 mt-4">
            This P9 form is auto-generated from payroll records. Verify against official KRA filing requirements.
          </p>
        </div>
      </div>
    </div>
  );
};

export default P9Form;
