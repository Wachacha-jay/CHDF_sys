import React, { useState } from 'react';
import { Receipt, Printer, Share2 } from 'lucide-react';
import { printReceipt, printPaymentReceipt, ReceiptData } from '../../utils/receiptUtils';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface ReceiptModalProps {
  receipt: ReceiptData;
  onClose: () => void;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  const { settings } = useSettingsContext();
  const [printerType, setPrinterType] = useState<'standard' | 'thermal'>('standard');

  const handlePrint = () => {
    if (receipt.type === 'distribution' || receipt.type === 'school_fee' || receipt.type === 'donation') {
      printPaymentReceipt(receipt, {
        businessName: settings?.business_name,
        businessAddress: settings?.business_address,
        businessPhone: settings?.business_phone,
        businessEmail: settings?.business_email,
        logoUrl: settings?.logo_url,
        currency: settings?.default_currency || 'KSh'
      }, printerType === 'thermal');
    } else {
      printReceipt(receipt, {
        businessName: settings?.business_name,
        businessAddress: settings?.business_address,
        businessPhone: settings?.business_phone,
        businessEmail: settings?.business_email,
        logoUrl: settings?.logo_url,
        currency: settings?.default_currency || 'KSh'
      }, printerType === 'thermal');
    }
  };

  const isDist = receipt.type === 'distribution';

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md card p-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-2xl ${isDist ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-indigo-50 dark:bg-indigo-500/10'}`}>
              {isDist ? (
                <Share2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Receipt className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                {isDist ? 'Distribution Complete' : 'Transaction Complete'}
              </h3>
              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                {isDist ? 'Distribution Voucher Generated' : 'Receipt Generated Successfully'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-6 mb-8 border border-gray-100 dark:border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Receipt Number</span>
            <span className="text-sm font-black text-gray-900 dark:text-white">{receipt.saleNumber}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Entity Name</span>
            <span className="text-sm font-black text-gray-900 dark:text-white truncate max-w-[200px]">{receipt.customerName}</span>
          </div>
          
          {receipt.departmentName && (
            <div className="flex justify-between items-center pt-2 border-t border-gray-200/50 dark:border-slate-700/50">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Destination Dept</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{receipt.departmentName}</span>
            </div>
          )}

          {receipt.expenseAccountName && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Expense Account</span>
              <span className="text-xs font-black text-purple-600 dark:text-purple-400 truncate max-w-[200px]">{receipt.expenseAccountName}</span>
            </div>
          )}

          {receipt.childName && (
            <div className="flex justify-between items-center pt-2 border-t border-gray-200/50 dark:border-slate-700/50">
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Beneficiary</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{receipt.childName}</span>
            </div>
          )}

          {receipt.donorName && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Sponsor</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{receipt.donorName}</span>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
            <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">
              {isDist ? 'Total Valuation' : 'Total Amount'}
            </span>
            <span className={`text-2xl font-black ${isDist ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
              KSh {receipt.total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Printer Type Selection */}
        <div className="mb-8">
          <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">
            Select Output Format
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setPrinterType('standard')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                printerType === 'standard' 
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10' 
                  : 'border-gray-100 dark:border-slate-800 bg-transparent'
              }`}
            >
              <div className={`p-2 rounded-lg ${printerType === 'standard' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-400'}`}>
                <Printer className="w-4 h-4" />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${printerType === 'standard' ? 'text-indigo-600' : 'text-gray-400'}`}>Standard A4</span>
            </button>
            
            <button
              onClick={() => setPrinterType('thermal')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                printerType === 'thermal' 
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' 
                  : 'border-gray-100 dark:border-slate-800 bg-transparent'
              }`}
            >
              <div className={`p-2 rounded-lg ${printerType === 'thermal' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-400'}`}>
                <Printer className="w-4 h-4" />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${printerType === 'thermal' ? 'text-emerald-600' : 'text-gray-400'}`}>Thermal 80mm</span>
            </button>
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={handlePrint}
            className={`flex-1 flex items-center justify-center py-4 rounded-xl font-bold text-white transition-all shadow-md active:scale-95 ${
              isDist ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
            }`}
          >
            <Printer className="h-5 w-5 mr-3" />
            {isDist ? 'Print Distribution Voucher' : 'Print Receipt'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal; 