import React, { useEffect, useState } from 'react';
import { SupplierService } from '../../services/supplierService';
import { ApiService } from '../../services/api';
import { FundAccountingService } from '../../services/fundAccountingService';
import { AccountingService } from '../../services/accountingService';
import type { Supplier, Product, Department, Account } from '../../types';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Building2, Tag, BookOpen, Sparkles } from 'lucide-react';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface CreatePurchaseInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreatePurchaseInvoiceModal: React.FC<CreatePurchaseInvoiceModalProps> = ({ open, onClose, onSuccess }) => {
  const { currency } = useSettingsContext();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [whtRate, setWhtRate] = useState<number>(0);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  const [items, setItems] = useState([{ product_id: '', quantity: 1, unit_cost: 0 }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      ApiService.get<Supplier>('suppliers', { filters: { is_active: true } }).then(res => {
        if (res.success && res.data) setSuppliers(res.data);
      });
      ApiService.get<Product>('products', { filters: { is_active: true } }).then(res => {
        if (res.success && res.data) setProducts(res.data);
      });
      FundAccountingService.getDepartments().then(deps => {
        setDepartments(deps);
      });
      AccountingService.getAccounts().then(accs => {
        const flat = AccountingService.flattenAccounts(accs);
        setExpenseAccounts(flat.filter(a => a.account_type === 'expense'));
      });
    }
  }, [open]);

  // When supplier changes, auto-fill department, default expense account, and default WHT rate
  const handleSupplierChange = (supId: string) => {
    setSelectedSupplierId(supId);
    const sup = suppliers.find(s => s.id === supId);
    if (sup) {
      if (sup.department_id) setDepartmentId(sup.department_id);
      if (sup.expense_account_id) setExpenseAccountId(sup.expense_account_id);
      setWhtRate(Number(sup.withholding_tax_rate) || 0);
    }
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    const newItems = [...items];
    newItems[index].product_id = productId;
    if (product) {
      newItems[index].unit_cost = product.cost_price || 0;
    }
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: 'quantity' | 'unit_cost', value: number) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1, unit_cost: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      toast.error('Please select a supplier or service provider');
      return;
    }
    if (items.some(i => !i.product_id || i.quantity <= 0 || i.unit_cost < 0)) {
      toast.error('Please complete all item fields with valid amounts');
      return;
    }
    
    setLoading(true);
    const purchaseData = {
      supplier_id: selectedSupplierId,
      department_id: departmentId || undefined,
      expense_account_id: expenseAccountId || undefined,
      wht_rate: Number(whtRate) || 0,
      purchase_date: purchaseDate,
      notes: notes,
      items: items.map(item => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost)
      })),
    };
    
    const result = await SupplierService.createPurchase(purchaseData);
    setLoading(false);
    
    if (result) {
      toast.success('Purchase invoice created successfully and posted to General Ledger');
      setSelectedSupplierId('');
      setDepartmentId('');
      setExpenseAccountId('');
      setWhtRate(0);
      setNotes('');
      setItems([{ product_id: '', quantity: 1, unit_cost: 0 }]);
      onSuccess();
    } else {
      toast.error('Failed to create invoice');
    }
  };

  if (!open) return null;

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  const taxAmount = totalAmount * 0.16; // 16% VAT

  const selectedSupplierObj = suppliers.find(s => s.id === selectedSupplierId);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl max-h-[92vh] flex flex-col border border-gray-100 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Create Purchase / Service Invoice</h2>
            <p className="text-xs text-gray-500 mt-0.5">Record billed supplies or services with Fund & GL allocation</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-2xl leading-none">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 pr-2 space-y-5">
          {/* Supplier & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-700">Supplier / Service Provider *</label>
              <select 
                value={selectedSupplierId} 
                onChange={e => handleSupplierChange(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium" 
                required
              >
                <option value="">-- Select Vendor --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.organization_name ? `(${s.organization_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-700">Invoice / Bill Date *</label>
              <input 
                type="date" 
                value={purchaseDate} 
                onChange={e => setPurchaseDate(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" 
                required 
              />
            </div>
          </div>

          {/* Fund Accounting & GL Allocation Defaults */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center">
                <Building2 className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Fund Accounting & General Ledger Allocation
              </span>
              {selectedSupplierObj?.expense_account_id && (
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full flex items-center">
                  <Sparkles className="w-3 h-3 mr-1 text-blue-600" />
                  Auto-populated from Supplier Profile
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-xs font-medium text-slate-700">Operating Department (Fund)</label>
                <select
                  value={departmentId}
                  onChange={e => setDepartmentId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">-- General / No Department --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.code ? `(${d.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-xs font-medium text-slate-700">Expense Account (GL Debit)</label>
                <select
                  value={expenseAccountId}
                  onChange={e => setExpenseAccountId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                >
                  <option value="">-- Default Inventory Asset / General Expense --</option>
                  {expenseAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      [{a.code}] {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Line Items (Products & Services)
              </label>
              <button 
                type="button" 
                onClick={addItem} 
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors"
              >
                <Plus size={14} className="mr-1" /> Add Line
              </button>
            </div>
            
            <div className="space-y-2.5">
              {items.map((item, index) => {
                const prod = products.find(p => p.id === item.product_id);
                return (
                  <div key={index} className="flex gap-2 items-center bg-gray-50/70 p-2 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <select 
                        value={item.product_id} 
                        onChange={e => handleProductChange(index, e.target.value)} 
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium" 
                        required
                      >
                        <option value="">Select product or service...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.is_service ? '⚡ [Service] ' : '📦 [Item] '}
                            {p.name} {p.sku ? `(${p.sku})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="w-24">
                      <input 
                        type="number" 
                        min="0.01" 
                        step="0.01" 
                        placeholder="Qty" 
                        value={item.quantity} 
                        onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value))} 
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold text-center" 
                        required 
                      />
                    </div>
                    
                    <div className="w-32">
                      <input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        placeholder="Unit Cost" 
                        value={item.unit_cost} 
                        onChange={e => handleItemChange(index, 'unit_cost', parseFloat(e.target.value))} 
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold text-right" 
                        required 
                      />
                    </div>
                    
                    <div className="w-32 text-right font-bold text-sm text-gray-900 pr-1">
                      {currency || 'KES'} {(item.quantity * item.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={() => removeItem(index)} 
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30" 
                      disabled={items.length === 1}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Notes & Summary */}
          <div className="border-t border-gray-100 pt-4 flex justify-between items-start gap-6">
            <div className="flex-1">
              <label className="block mb-1 text-xs font-semibold text-gray-700">Internal Reference / Notes (Optional)</label>
              <textarea 
                rows={2} 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="e.g., Monthly internet subscription, contract reference..." 
              />
            </div>
            
            <div className="w-72 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900">
                  {currency || 'KES'} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax (16% VAT):</span>
                <span className="font-semibold text-slate-900">
                  {currency || 'KES'} {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-200 pt-2">
                <span>Total Invoice:</span>
                <span className="text-blue-600">
                  {currency || 'KES'} {(totalAmount + taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold text-sm transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-bold text-sm shadow transition-colors disabled:opacity-50" 
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Invoice & Post to GL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePurchaseInvoiceModal;
