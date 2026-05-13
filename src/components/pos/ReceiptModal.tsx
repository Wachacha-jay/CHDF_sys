import React, { useState } from 'react';
import { Receipt, Printer } from 'lucide-react';
import { printReceipt, ReceiptData } from '../../utils/receiptUtils';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface ReceiptModalProps {
  receipt: ReceiptData;
  onClose: () => void;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  const { settings } = useSettingsContext();
  const [printerType, setPrinterType] = useState<'standard' | 'thermal'>('standard');

  const handlePrint = () => {
    printReceipt(receipt, {
      businessName: settings?.business_name,
      businessAddress: settings?.business_address,
      businessPhone: settings?.business_phone,
      businessEmail: settings?.business_email,
      logoUrl: settings?.logo_url,
      currency: settings?.default_currency || 'KSh'
    }, printerType === 'thermal');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md card p-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
              <Receipt className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Transaction Complete</h3>
              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-1">Receipt Generated Successfully</p>
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
            <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Total Amount</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">KSh {receipt.total.toLocaleString()}</span>
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
            className="flex-1 btn-primary flex items-center justify-center py-4"
          >
            <Printer className="h-5 w-5 mr-3" />
            Print Now
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