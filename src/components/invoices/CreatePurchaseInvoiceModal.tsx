import React, { useEffect, useState, useMemo } from 'react';
import { SupplierService } from '../../services/supplierService';
import { ApiService } from '../../services/api';
import { FundAccountingService } from '../../services/fundAccountingService';
import { AccountingService } from '../../services/accountingService';
import type { Supplier, Product, Department, Account } from '../../types';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Building2, Sparkles, Percent, ShieldCheck, Receipt, Package, Briefcase } from 'lucide-react';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface CreatePurchaseInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreatePurchaseInvoiceModal: React.FC<CreatePurchaseInvoiceModalProps> = ({ open, onClose, onSuccess }) => {
  const { currency, settings } = useSettingsContext();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  
  // Tax Rates: VAT for goods (defaults to business settings tax_rate or 0)
  // WHT for services (defaults to supplier WHT, business settings wht_rate, or 0)
  const defaultBizVat = useMemo(() => {
    if (!settings?.tax_rate) return 0;
    const r = Number(settings.tax_rate);
    return r > 1 ? r : r * 100;
  }, [settings?.tax_rate]);

  const defaultBizWht = useMemo(() => {
    if (!settings?.wht_rate) return 0;
    const r = Number(settings.wht_rate);
    return r > 1 ? r : r * 100;
  }, [settings?.wht_rate]);

  const [vatRate, setVatRate] = useState<number>(defaultBizVat);
  const [whtRate, setWhtRate] = useState<number>(defaultBizWht);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  const [items, setItems] = useState([{ product_id: '', quantity: 1, unit_cost: 0 }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setVatRate(defaultBizVat);
      setWhtRate(defaultBizWht);

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
  }, [open, defaultBizVat, defaultBizWht]);

  // When supplier changes, auto-fill department, default expense account, and default WHT rate
  const handleSupplierChange = (supId: string) => {
    setSelectedSupplierId(supId);
    const sup = suppliers.find(s => s.id === supId);
    if (sup) {
      if (sup.department_id) setDepartmentId(sup.department_id);
      if (sup.expense_account_id) setExpenseAccountId(sup.expense_account_id);
      
      // Default WHT from supplier if configured, else default to business settings wht_rate (default 0)
      if (sup.withholding_tax_rate !== undefined && sup.withholding_tax_rate !== null && Number(sup.withholding_tax_rate) > 0) {
        setWhtRate(Number(sup.withholding_tax_rate));
      } else {
        setWhtRate(defaultBizWht);
      }
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

  // Dynamic breakdown of goods vs services
  const breakdown = useMemo(() => {
    let goodsSubtotal = 0;
    let servicesSubtotal = 0;
    let hasGoods = false;
    let hasServices = false;

    items.forEach(item => {
      const p = products.find(prod => prod.id === item.product_id);
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0);
      if (p?.is_service) {
        hasServices = true;
        servicesSubtotal += lineTotal;
      } else {
        hasGoods = true;
        goodsSubtotal += lineTotal;
      }
    });

    const totalSubtotal = goodsSubtotal + servicesSubtotal;

    // VAT applies on goods base (or total if all lines are goods or general)
    const applicableVatBase = hasGoods ? goodsSubtotal : (hasServices ? 0 : totalSubtotal);
    // WHT applies on services base (or total if all lines are services)
    const applicableWhtBase = hasServices ? servicesSubtotal : (hasGoods ? 0 : totalSubtotal);

    const calculatedVatAmount = (applicableVatBase * (Number(vatRate) || 0)) / 100;
    const calculatedWhtAmount = (applicableWhtBase * (Number(whtRate) || 0)) / 100;

    const grossTotal = totalSubtotal + calculatedVatAmount;
    const netPayable = Math.max(0, grossTotal - calculatedWhtAmount);

    return {
      goodsSubtotal,
      servicesSubtotal,
      totalSubtotal,
      hasGoods,
      hasServices,
      applicableVatBase,
      applicableWhtBase,
      calculatedVatAmount,
      calculatedWhtAmount,
      grossTotal,
      netPayable
    };
  }, [items, products, vatRate, whtRate]);

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
      vat_rate: Number(vatRate) || 0,
      tax_amount: breakdown.calculatedVatAmount,
      wht_rate: Number(whtRate) || 0,
      wht_amount: breakdown.calculatedWhtAmount,
      subtotal: breakdown.totalSubtotal,
      total_amount: breakdown.grossTotal,
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
      setVatRate(defaultBizVat);
      setWhtRate(defaultBizWht);
      setNotes('');
      setItems([{ product_id: '', quantity: 1, unit_cost: 0 }]);
      onSuccess();
    } else {
      toast.error('Failed to create invoice');
    }
  };

  if (!open) return null;

  const selectedSupplierObj = suppliers.find(s => s.id === selectedSupplierId);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl max-h-[92vh] flex flex-col border border-gray-100 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Create Purchase / Service Invoice</h2>
            <p className="text-xs text-gray-500 mt-0.5">Record billed supplies or services with VAT, WHT, and Fund GL allocation</p>
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

          {/* Taxes & Withholdings (VAT on Goods & WHT on Services) */}
          <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center">
                <Receipt className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Taxation & Withholding Calculations
              </span>
              <div className="flex items-center gap-2">
                {breakdown.hasGoods && (
                  <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full flex items-center">
                    <Package className="w-2.5 h-2.5 mr-1" /> Goods: {currency} {breakdown.goodsSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                )}
                {breakdown.hasServices && (
                  <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full flex items-center">
                    <Briefcase className="w-2.5 h-2.5 mr-1" /> Services: {currency} {breakdown.servicesSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* VAT for Goods */}
              <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 shadow-xs">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-800 flex items-center">
                    <Percent className="w-3 h-3 mr-1 text-blue-600" />
                    VAT Rate for Goods (%)
                  </label>
                  <span className="text-[10px] text-gray-500 font-medium">Default: {defaultBizVat}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={vatRate}
                      onChange={e => setVatRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="0.00"
                    />
                    <span className="absolute right-2.5 top-1.5 text-xs text-gray-400 font-bold">%</span>
                  </div>
                  <div className="text-right min-w-[90px]">
                    <span className="block text-[10px] text-gray-400 uppercase font-semibold">VAT Amount</span>
                    <span className="text-xs font-bold text-blue-700">
                      +{currency} {breakdown.calculatedVatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500">
                  {breakdown.hasGoods 
                    ? `Applied to physical goods base (${currency} ${breakdown.goodsSubtotal.toFixed(2)})`
                    : 'Picks from Business Settings (defaults to 0%)'}
                </p>
              </div>

              {/* WHT for Services */}
              <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-1.5 shadow-xs">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-amber-900 flex items-center">
                    <ShieldCheck className="w-3 h-3 mr-1 text-amber-600" />
                    Withholding Tax (WHT) (%)
                  </label>
                  <span className="text-[10px] text-amber-700 font-medium">Default: {defaultBizWht}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={whtRate}
                      onChange={e => setWhtRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full border border-amber-300 rounded-md px-2.5 py-1.5 text-sm font-bold bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="0.00"
                    />
                    <span className="absolute right-2.5 top-1.5 text-xs text-gray-400 font-bold">%</span>
                  </div>
                  <div className="text-right min-w-[90px]">
                    <span className="block text-[10px] text-amber-600 uppercase font-semibold">WHT Withheld</span>
                    <span className="text-xs font-bold text-amber-900">
                      -{currency} {breakdown.calculatedWhtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-amber-800/80">
                  {breakdown.hasServices 
                    ? `Withheld on services base (${currency} ${breakdown.servicesSubtotal.toFixed(2)})`
                    : 'Picks from Supplier / Business Settings (defaults to 0%)'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Notes & Summary */}
          <div className="border-t border-gray-100 pt-4 flex justify-between items-start gap-6">
            <div className="flex-1">
              <label className="block mb-1 text-xs font-semibold text-gray-700">Internal Reference / Notes (Optional)</label>
              <textarea 
                rows={3} 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="e.g., Monthly internet subscription, contract reference..." 
              />
            </div>
            
            <div className="w-80 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 text-xs">
                <span>Subtotal (Items & Services):</span>
                <span className="font-semibold text-slate-900">
                  {currency || 'KES'} {breakdown.totalSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 text-xs">
                <span>VAT ({vatRate}% on Goods):</span>
                <span className="font-semibold text-blue-700">
                  +{currency || 'KES'} {breakdown.calculatedVatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                <span>Gross Invoice Total:</span>
                <span className="text-slate-900 font-extrabold">
                  {currency || 'KES'} {breakdown.grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {breakdown.calculatedWhtAmount > 0 && (
                <div className="flex justify-between text-amber-900 text-xs bg-amber-50/80 px-2 py-1 rounded-md border border-amber-200/60 font-medium">
                  <span>WHT Withheld ({whtRate}%):</span>
                  <span>-{currency || 'KES'} {breakdown.calculatedWhtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t border-slate-200 pt-1.5">
                <span>Net Payable to Vendor:</span>
                <span className="text-emerald-700 font-extrabold">
                  {currency || 'KES'} {breakdown.netPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
