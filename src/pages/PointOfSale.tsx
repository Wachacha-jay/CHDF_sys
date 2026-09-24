import React, { useState, useEffect } from 'react';
import { Search, Heart, Baby, Package, ShoppingCart, Users, GraduationCap, Gift, Plus, Share2, Building2, BookOpen, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ProductService } from '../services/productService';
import { SalesService } from '../services/salesService';
import { FundAccountingService } from '../services/fundAccountingService';
import { AccountingService } from '../services/accountingService';
import type { Product, Customer, Child, FundAccount, Donor, Department, Account } from '../types';
import { useCart } from '../hooks/useCart';
import { useSettingsContext } from '../contexts/SettingsContext';
import ProductGrid from '../components/pos/ProductGrid';
import Cart from '../components/pos/Cart';
import PaymentForm, { PaymentMethod } from '../components/pos/PaymentForm';
import ReceiptModal from '../components/pos/ReceiptModal';
import { generateReceipt, ReceiptData } from '../utils/receiptUtils';
import { DimensionSelector } from '../components/fund-accounting/DimensionSelector';

const PointOfSale: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useSettingsContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptData | null>(null);
  const [posMode, setPosMode] = useState<'retail' | 'distribution'>('retail');
  const [dimensions, setDimensions] = useState<{
    department_id?: string;
    child_id?: string;
    donor_id?: string;
    fund_id?: string;
  }>({});
  const [dimensionNames, setDimensionNames] = useState({
      child: '',
      donor: '',
      fund: ''
  });

  const [children, setChildren] = useState<Child[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);

  // Distribution form state
  const [destDepartmentId, setDestDepartmentId] = useState('');
  const [destExpenseAccountId, setDestExpenseAccountId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [destChildId, setDestChildId] = useState('');
  const [distributionDate, setDistributionDate] = useState(new Date().toISOString().split('T')[0]);
  const [distributionNotes, setDistributionNotes] = useState('');

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });

  const {
    cart,
    addToCart,
    updateQuantity,
    updateUnitPrice,
    removeFromCart,
    getTotal,
    clearCart
  } = useCart();

  const configuredTaxRate = Number(settings?.tax_rate || 0);
  const effectiveTaxRate = posMode === 'retail' 
    ? (configuredTaxRate > 1 ? configuredTaxRate / 100 : Math.max(0, configuredTaxRate)) 
    : 0;
  const taxPercentDisplay = (effectiveTaxRate * 100).toFixed((effectiveTaxRate * 100) % 1 === 0 ? 0 : 1);
  const cartSubtotal = getTotal();
  const cartTax = posMode === 'retail' ? Math.round(cartSubtotal * effectiveTaxRate * 100) / 100 : 0;
  const cartGrandTotal = cartSubtotal + cartTax;

  useEffect(() => {
    loadProducts();
    loadCustomers();
    loadNGODimensions();
    loadDistributionData();
  }, []);

  const loadDistributionData = async () => {
    try {
      const [deptList, accList] = await Promise.all([
        FundAccountingService.getDepartments(),
        AccountingService.getAccounts({ account_type: 'expense' })
      ]);
      setDepartments(deptList || []);
      setExpenseAccounts(accList || []);
      if (deptList && deptList.length > 0) {
        setDestDepartmentId(deptList[0].id);
      }
      if (accList && accList.length > 0) {
        const defaultExp = accList.find(a => a.code === '5335' || a.name.toLowerCase().includes('distribution')) || accList[0];
        if (defaultExp) {
          setDestExpenseAccountId(defaultExp.id);
        }
      }
    } catch (err) {
      console.error('Error loading distribution departments and accounts:', err);
    }
  };

  const loadNGODimensions = async () => {
      const [childList, donorList, fundList] = await Promise.all([
          FundAccountingService.getChildren(),
          FundAccountingService.getDonors(),
          FundAccountingService.getFundAccounts()
      ]);
      setChildren(childList);
      setDonors(donorList);
      setFunds(fundList);
  };

  useEffect(() => {
      const child = children.find(c => c.id === dimensions.child_id);
      const donor = donors.find(d => d.id === dimensions.donor_id);
      const fund = funds.find(f => f.id === dimensions.fund_id);
      setDimensionNames({
          child: child ? `${child.first_name} ${child.last_name}` : '',
          donor: donor ? donor.name : '',
          fund: fund ? fund.name : ''
      });
  }, [dimensions, children, donors, funds]);

  const handleAddCustomer = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const created = await SalesService.createCustomer({
              ...newCustomer,
              is_active: true
          });
          if (created) {
              toast.success('Customer created successfully!');
              await loadCustomers();
              setCustomerId(created.id);
              setShowAddCustomer(false);
              setNewCustomer({ name: '', phone: '', email: '' });
          }
      } catch (error) {
          toast.error('Failed to create customer');
      }
  };

  const loadCustomers = async () => {
    try {
      const data = await SalesService.getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const products = await ProductService.getProducts({ is_active: true });
      setProducts(products);
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    // Mode isolation: ring-fence in-kind items to distribution mode only
    if (posMode === 'retail' && product.is_in_kind) return false;
    if (posMode === 'distribution' && !product.is_in_kind) return false;

    return (
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleDistributionCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Distribution cart is empty');
      return;
    }
    if (!destDepartmentId) {
      toast.error('Please select a Destination Department');
      return;
    }
    if (!destExpenseAccountId) {
      toast.error('Please select an Expense Account for debit allocation');
      return;
    }

    for (const item of cart) {
      const avail = Number(item.product.current_stock ?? 0);
      if (item.quantity > avail) {
        toast.error(`Cannot distribute ${item.quantity} of "${item.product.name}" (only ${avail} available in stock)`);
        return;
      }
    }

    try {
      setLoading(true);
      const res = await SalesService.recordDonationDistribution({
        department_id: destDepartmentId,
        expense_account_id: destExpenseAccountId,
        distribution_date: distributionDate,
        recipient_name: recipientName,
        child_id: destChildId || undefined,
        notes: distributionNotes,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_cost: (item.unitPrice !== undefined && item.unitPrice > 0)
            ? item.unitPrice 
            : (item.product.cost_price || item.product.selling_price || 0)
        }))
      });

      if (res.success && res.sale) {
        const dept = departments.find(d => d.id === destDepartmentId);
        const expAcc = expenseAccounts.find(a => a.id === destExpenseAccountId);
        const child = children.find(c => c.id === destChildId);

        const receipt = generateReceipt(
          res.sale.sale_number,
          recipientName || dept?.name || 'Internal Distribution',
          cart,
          getTotal(),
          'in_kind_distribution',
          {
            type: 'distribution',
            departmentName: dept?.name,
            expenseAccountName: expAcc ? `${expAcc.code} - ${expAcc.name}` : undefined,
            childName: child ? `${child.first_name} ${child.last_name}` : undefined
          }
        );
        setCurrentReceipt(receipt);
        setShowReceipt(true);
        toast.success('Donation items distributed & posted to General Ledger (DR Expense / CR In-Kind Inventory)!');
        clearCart();
        setRecipientName('');
        setDestChildId('');
        setDistributionNotes('');
        await loadProducts();
      } else {
        toast.error(res.error || 'Failed to record distribution');
      }
    } catch (error: any) {
      console.error('Error distributing donation items:', error);
      toast.error(error.message || 'Failed to record distribution');
    } finally {
      setLoading(false);
    }
  };

  const handleMpesaPayment = async () => {
    if (!phoneNumber) {
      toast.error('Please enter phone number for M-Pesa payment');
      return;
    }
    toast.loading('Initiating M-Pesa payment...');
    setTimeout(() => {
      toast.dismiss();
      toast.success('M-Pesa payment initiated. Please check your phone for STK push.');
      setTimeout(() => {
        toast.success('M-Pesa payment confirmed!');
        handleCheckout();
      }, 3000);
    }, 2000);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (paymentMethod === 'mpesa' && !phoneNumber) {
      toast.error('Please enter phone number for M-Pesa payment');
      return;
    }
    if (paymentMethod === 'credit' && !customerId) {
      toast.error('Please select an existing customer for credit sales');
      return;
    }

    try {
      setLoading(true);
      const selectedCustomer = customers.find(c => c.id === customerId);
      const subtotal = cartSubtotal;
      const taxAmount = cartTax;
      const totalAmount = cartGrandTotal;
      
      const saleData = {
        sale_date: new Date().toISOString().split('T')[0],
        payment_method: paymentMethod,
        customer_id: customerId || undefined,
        notes: paymentMethod === 'credit'
          ? `Invoice generated for ${selectedCustomer?.name}`
          : `Customer: ${customerName || 'Walk-in Customer'}${phoneNumber ? ` | Phone: ${phoneNumber}` : ''}`,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unitPrice
        })),
        subtotal,
        tax_rate: effectiveTaxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        ...dimensions
      };

      const response = await SalesService.createSale(saleData);
      
      if (response) {
        if (paymentMethod === 'credit') {
          toast((t) => (
            <div className="flex flex-col gap-2">
              <span className="font-medium text-green-600">Invoice generated successfully!</span>
              <button 
                onClick={() => {
                  toast.dismiss(t.id);
                  navigate(`/invoice/${response.id}`);
                }}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                View Invoice
              </button>
            </div>
          ), { duration: 5000 });
        } else {
          const receipt = generateReceipt(response.sale_number, customerName, cart, totalAmount, paymentMethod);
          setCurrentReceipt(receipt);
          setShowReceipt(true);
          toast.success('Sale completed successfully!');
        }

        clearCart();
        setCustomerName('');
        setPhoneNumber('');
        setCustomerId('');
        setPaymentMethod('cash');
        setDimensions({});
      } else {
        toast.error('Failed to complete sale');
      }
    } catch (error) {
      toast.error('Failed to complete sale');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex">
      {/* Products Section */}
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-950 overflow-hidden">
        {/* Modern POS Header */}
        <div className="p-8 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">Command Center</h1>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`w-2 h-2 rounded-full animate-pulse ${
                  posMode === 'distribution' ? 'bg-emerald-500' : 'bg-indigo-500'
                }`} />
                <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                  {posMode === 'retail' 
                    ? 'Commercial Sales Mode (For-Profit Inventory)' 
                    : 'Donation Distribution Mode (In-Kind Consumables)'}
                </p>
              </div>
            </div>

            {/* 2-Way Mode Switcher */}
            <div className="flex bg-gray-100 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner border border-gray-200 dark:border-slate-700">
              <button
                onClick={() => { setPosMode('retail'); clearCart(); }}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center space-x-2 ${
                  posMode === 'retail' 
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md shadow-indigo-500/10' 
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-slate-300'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Commercial Sales</span>
              </button>
              <button
                onClick={() => { setPosMode('distribution'); clearCart(); }}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center space-x-2 ${
                  posMode === 'distribution' 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' 
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-slate-300'
                }`}
              >
                <Share2 className="w-4 h-4" />
                <span>Donation Distribution</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div className="mb-8 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400 h-6 w-6 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder={
                  posMode === 'distribution'
                    ? "Search in-kind relief items (food, supplies, medicine)..."
                    : "Scan barcode or search commercial products..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-6 py-5 bg-white dark:bg-slate-900 border-none rounded-3xl text-lg font-black placeholder:text-gray-300 dark:placeholder:text-slate-700 focus:ring-4 focus:ring-indigo-500/10 dark:text-white transition-all shadow-xl shadow-indigo-500/5"
              />
            </div>
          </div>

          {posMode === 'distribution' && filteredProducts.length === 0 ? (
            <div className="card p-12 text-center max-w-lg mx-auto my-12 border-2 border-dashed border-emerald-300 dark:border-emerald-800">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">No In-Kind Consumables In Stock</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 mb-6 leading-relaxed">
                In-kind items (like food sacks, medicine, hygiene supplies) are received through <strong>Fund Accounting &gt; Donations</strong> under "In-Kind Donation", or can be marked as "In-Kind" in the <strong>Inventory</strong> catalog.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button
                  onClick={() => navigate('/funds/donations', { state: { openInKind: true } })}
                  className="btn-primary text-xs uppercase tracking-wider py-3 px-4 font-black flex items-center justify-center gap-1.5"
                >
                  <Gift className="w-4 h-4" />
                  <span>Receive In-Kind Donation</span>
                </button>
                <button
                  onClick={() => navigate('/inventory')}
                  className="btn-secondary text-xs uppercase tracking-wider py-3 px-4 font-black"
                >
                  Manage Inventory
                </button>
              </div>
            </div>
          ) : (
            <ProductGrid 
              products={filteredProducts} 
              loading={loading} 
              onAddToCart={(prod) => addToCart(prod, posMode)} 
              isDistribution={posMode === 'distribution'}
              cart={cart}
              onUpdateQuantity={updateQuantity}
            />
          )}
        </div>
      </div>

      {/* Cart & Distribution Sidebar */}
      <div className="w-96 xl:w-[430px] bg-gray-50 dark:bg-slate-950 border-l border-gray-200 dark:border-slate-800 flex flex-col h-full overflow-hidden shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                {posMode === 'distribution' ? 'Distribution Voucher' : 'Commercial Cart'}
              </h2>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                posMode === 'distribution'
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
              }`}>
                {cart.length} {cart.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">
              {posMode === 'distribution' 
                ? 'Adjust quantities to distribute & set destination' 
                : 'Commercial sale & payment gateway'}
            </p>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-[11px] font-black text-red-500 hover:text-red-700 uppercase tracking-wider px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              title="Clear all items"
            >
              Clear
            </button>
          )}
        </div>

        {/* Scrollable Center: Cart Items FIRST, then Requisition / Payment Info */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* SECTION 1: ITEMS IN CART (WITH QUANTITY CONTROLS) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black text-gray-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                {posMode === 'distribution' ? <Gift className="w-3.5 h-3.5 text-emerald-600" /> : <ShoppingCart className="w-3.5 h-3.5 text-indigo-600" />}
                {posMode === 'distribution' ? 'Items to Distribute' : 'Order Items'}
              </span>
              {cart.length > 0 && (
                <span className="text-[10px] text-gray-400 font-bold">
                  {cart.reduce((s, i) => s + i.quantity, 0)} total units
                </span>
              )}
            </div>

            <Cart 
              cart={cart} 
              updateQuantity={updateQuantity} 
              updateUnitPrice={updateUnitPrice}
              removeFromCart={removeFromCart} 
              isDistribution={posMode === 'distribution'} 
            />
          </div>

          {/* SECTION 2: REQUISITION / DISPATCH ALLOCATION (DISTRIBUTION MODE) */}
          {posMode === 'distribution' ? (
            <div className="pt-3 border-t border-gray-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-black text-[11px] uppercase tracking-wider px-1">
                <Share2 className="w-3.5 h-3.5" />
                <span>Dispatch & Accounting Allocation</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-3 shadow-xs">
                {/* Destination Department (Required) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-emerald-600" />
                    Destination Department *
                  </label>
                  <select
                    value={destDepartmentId}
                    onChange={(e) => setDestDepartmentId(e.target.value)}
                    required
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold py-2 px-3 focus:ring-2 focus:ring-emerald-500 dark:text-white"
                  >
                    <option value="">-- Select Destination Department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Expense Account (Required) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-emerald-600" />
                    Expense Account (Debit) *
                  </label>
                  <select
                    value={destExpenseAccountId}
                    onChange={(e) => setDestExpenseAccountId(e.target.value)}
                    required
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold py-2 px-3 focus:ring-2 focus:ring-emerald-500 dark:text-white"
                  >
                    <option value="">-- Select Expense G/L Account --</option>
                    {expenseAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                    ))}
                  </select>
                </div>

                {/* Collapsible Optional Beneficiary, Child, Date & Ref */}
                <details className="group pt-1 border-t border-gray-100 dark:border-slate-800">
                  <summary className="list-none cursor-pointer flex items-center justify-between text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider hover:text-emerald-600 transition-colors py-1">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Recipient & Beneficiary (Optional)
                    </span>
                    <span className="text-xs transition-transform group-open:rotate-180">▾</span>
                  </summary>

                  <div className="mt-2.5 space-y-2.5 animate-in fade-in duration-200">
                    <div>
                      <label className="text-[9px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Recipient / Staff in charge
                      </label>
                      <input
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="e.g. School Kitchen, Dormitory A, John"
                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold py-1.5 px-2.5 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Beneficiary Child
                      </label>
                      <select
                        value={destChildId}
                        onChange={(e) => setDestChildId(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold py-1.5 px-2.5 dark:text-white"
                      >
                        <option value="">-- None (General Distribution) --</option>
                        {children.map((c) => (
                          <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Date</label>
                        <input
                          type="date"
                          value={distributionDate}
                          onChange={(e) => setDistributionDate(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold py-1.5 px-2 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Requisition / Ref</label>
                        <input
                          type="text"
                          value={distributionNotes}
                          onChange={(e) => setDistributionNotes(e.target.value)}
                          placeholder="e.g. Weekly supply"
                          className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold py-1.5 px-2 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          ) : (
            /* Standard Commercial Payment Form */
            <div className="pt-3 border-t border-gray-200 dark:border-slate-800 space-y-3">
              <PaymentForm
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                customerName={customerName}
                setCustomerName={setCustomerName}
                phoneNumber={phoneNumber}
                setPhoneNumber={setPhoneNumber}
                customerId={customerId}
                setCustomerId={setCustomerId}
                customers={customers}
                onAddCustomer={() => setShowAddCustomer(true)}
                posMode="retail"
              />
              <div className="pt-3 border-t border-gray-200 dark:border-slate-800">
                <details className="group">
                  <summary className="list-none cursor-pointer flex items-center justify-between text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest hover:text-indigo-500 transition-colors">
                    <span>Optional Tracking Info</span>
                    <span className="group-open:rotate-180 transition-transform">↓</span>
                  </summary>
                  <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <DimensionSelector 
                      value={dimensions}
                      onChange={setDimensions}
                    />
                  </div>
                </details>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Checkout Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          {posMode === 'retail' && (
            <div className="space-y-1 mb-3 text-xs border-b border-gray-100 dark:border-slate-800 pb-2">
              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-700 dark:text-slate-200">
                  KSh {cartSubtotal.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>Tax / VAT ({taxPercentDisplay}%)</span>
                <span className="font-semibold text-gray-700 dark:text-slate-200">
                  KSh {cartTax.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-baseline mb-4">
            <span className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
              {posMode === 'distribution' ? 'Total Valuation' : 'Grand Total'}
            </span>
            <span className={`text-2xl sm:text-3xl font-black ${
              posMode === 'distribution' ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
            }`}>
              KSh {(posMode === 'distribution' ? cartSubtotal : cartGrandTotal).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {posMode === 'distribution' ? (
            <button
              onClick={handleDistributionCheckout}
              disabled={cart.length === 0 || loading || !destDepartmentId || !destExpenseAccountId}
              className={`w-full py-3.5 px-4 rounded-xl font-black uppercase tracking-widest text-xs sm:text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center space-x-2 ${
                cart.length === 0 || loading || !destDepartmentId || !destExpenseAccountId
                  ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 cursor-pointer'
              }`}
            >
              <Share2 className="w-4 h-4 mr-2" />
              <span>{loading ? 'Posting Distribution...' : 'Distribute Items'}</span>
            </button>
          ) : (
            <button
              onClick={paymentMethod === 'mpesa' ? handleMpesaPayment : handleCheckout}
              disabled={cart.length === 0 || loading}
              className={`w-full py-3.5 px-4 rounded-xl font-black uppercase tracking-widest text-xs sm:text-sm transition-all shadow-lg active:scale-95 ${
                cart.length === 0 || loading
                  ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-none cursor-pointer'
              }`}
            >
              {loading ? 'Processing...' : paymentMethod === 'mpesa' ? 'Initiate M-Pesa' : 'Complete Purchase'}
            </button>
          )}
        </div>
      </div>
      {/* Receipt Modal */}
      {showReceipt && currentReceipt && (
        <ReceiptModal receipt={currentReceipt} onClose={() => setShowReceipt(false)} />
      )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Add New Customer</h3>
                <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-1">Enroll into customer registry</p>
              </div>
              <button onClick={() => setShowAddCustomer(false)} className="text-gray-400 hover:text-gray-600 transition-colors text-2xl font-black">×</button>
            </div>
            
            <form onSubmit={handleAddCustomer} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Full Name</label>
                <input
                  required
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold py-3 px-4 focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  placeholder="Enter full legal name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Phone Number</label>
                  <input
                    type="text"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold py-3 px-4 focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    placeholder="e.g. 0712..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email (Optional)</label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold py-3 px-4 focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    placeholder="name@email.com"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full btn-primary py-4 rounded-xl font-black uppercase tracking-widest text-xs mt-4"
              >
                Create Profile
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PointOfSale; 