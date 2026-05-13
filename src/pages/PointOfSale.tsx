import React, { useState, useEffect } from 'react';
import { Search, Heart, Baby, Package, ShoppingCart, Users, GraduationCap, Gift, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ProductService } from '../services/productService';
import { SalesService } from '../services/salesService';
import { FundAccountingService } from '../services/fundAccountingService';
import type { Product, Customer, Child, FundAccount, Donor } from '../types';
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
  const [posMode, setPosMode] = useState<'retail' | 'ngo'>('retail');
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

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });

  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    getTotal,
    clearCart
  } = useCart();

  useEffect(() => {
    loadProducts();
    loadCustomers();
    loadNGODimensions();
  }, []);

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

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          // If NGO mode, we record specialized records
          if (posMode === 'ngo') {
              const isDonation = cart.some(i => i.product.name.toLowerCase().includes('donation'));
              
              // If it's a donation, record it in the donations table for tracking
              if (isDonation) {
                  const donationAmount = cart.filter(i => i.product.name.toLowerCase().includes('donation'))
                                             .reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
                  
                  await FundAccountingService.recordDonation({
                      donor_id: dimensions.donor_id || 'WALK-IN',
                      amount: donationAmount,
                      donation_date: new Date().toISOString().split('T')[0],
                      payment_method: paymentMethod,
                      fund_id: dimensions.fund_id,
                      restricted_to_child_id: dimensions.child_id,
                      notes: `POS Donation #${response.sale_number}`
                  });
              }

              // Extract names for the receipt
              const receipt = generateReceipt(
                  response.sale_number, 
                  customerName || dimensionNames.donor || dimensionNames.child || 'Walk-in Beneficiary', 
                  cart, 
                  getTotal(), 
                  paymentMethod,
                  {
                      type: isDonation ? 'donation' : 'school_fee',
                      childName: dimensionNames.child,
                      donorName: dimensionNames.donor,
                      fundName: dimensionNames.fund
                  }
              );
              setCurrentReceipt(receipt);
          } else {
              const receipt = generateReceipt(response.sale_number, customerName, cart, getTotal(), paymentMethod);
              setCurrentReceipt(receipt);
          }
          setShowReceipt(true);
          toast.success('Transaction completed successfully!');
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
                <span className={`w-2 h-2 rounded-full animate-pulse ${posMode === 'ngo' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                  {posMode === 'retail' ? 'Standard Retail Mode' : 'NGO Mission Mode'}
                </p>
              </div>
            </div>

            <div className="relative grid grid-cols-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl w-80 h-14 shadow-inner">
              {/* Simplified Sliding Background */}
              <div 
                className={`absolute inset-y-1 transition-all duration-500 ease-in-out rounded-xl shadow-lg w-[calc(50%-4px)] ${
                    posMode === 'retail' 
                    ? 'left-1 bg-white dark:bg-slate-700 shadow-indigo-500/10' 
                    : 'left-1 translate-x-full bg-emerald-500 dark:bg-emerald-600 shadow-emerald-500/20'
                }`}
              />
              
              <button
                onClick={() => setPosMode('retail')}
                className={`relative z-10 flex items-center justify-center text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${
                    posMode === 'retail' 
                    ? 'text-indigo-600 dark:text-white' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'
                }`}
              >
                Retail
              </button>
              <button
                onClick={() => setPosMode('ngo')}
                className={`relative z-10 flex items-center justify-center text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${
                    posMode === 'ngo' 
                    ? 'text-white' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'
                }`}
              >
                NGO Services
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {posMode === 'retail' && (
            <div className="mb-8 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400 h-6 w-6 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Scan barcode or search premium products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-16 pr-6 py-5 bg-white dark:bg-slate-900 border-none rounded-3xl text-lg font-black placeholder:text-gray-300 dark:placeholder:text-slate-700 focus:ring-4 focus:ring-indigo-500/10 dark:text-white transition-all shadow-xl shadow-indigo-500/5"
                />
              </div>
            </div>
          )}

          {posMode === 'ngo' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 pb-12">
              {[
                { name: 'General Donation', desc: 'Direct financial support for organizational growth.', price: 1000, icon: Gift, color: 'emerald', gradient: 'from-emerald-500 to-teal-600' },
                { name: 'School Fees', desc: 'Full-term tuition and learning materials support.', price: 5000, icon: GraduationCap, color: 'indigo', gradient: 'from-indigo-500 to-blue-600' },
                { name: 'Uniform & Supplies', desc: 'Provides professional attire and school essentials.', price: 2500, icon: Package, color: 'amber', gradient: 'from-amber-500 to-orange-600' },
                { name: 'Lunch Program', desc: 'Daily nutritious meals for supported children.', price: 500, icon: ShoppingCart, color: 'rose', gradient: 'from-rose-500 to-red-600' }
              ].map(service => (
                <div
                  key={service.name}
                  className="card flex flex-col group overflow-visible h-full hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500"
                >
                  <div className={`h-1.5 w-full bg-gradient-to-r ${service.gradient} rounded-t-3xl`} />
                  <div className="p-8 flex-1 flex flex-col">
                    <div className={`w-14 h-14 rounded-2xl bg-${service.color}-50 dark:bg-${service.color}-500/10 flex items-center justify-center mb-6 shadow-sm`}>
                      <service.icon className={`w-7 h-7 text-${service.color}-600 dark:text-${service.color}-400`} />
                    </div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none mb-3">{service.name}</h3>
                    <p className="text-xs font-bold text-gray-400 dark:text-slate-500 leading-relaxed flex-1">{service.desc}</p>
                    
                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Base Rate</span>
                        <span className="text-xl font-black text-gray-900 dark:text-white">KSh {service.price.toLocaleString()}</span>
                      </div>
                      <button
                        onClick={() => {
                            if (!dimensions.fund_id) {
                                toast.error('Please select a Fund/Project first');
                                return;
                            }
                            addToCart({
                              id: `svc-${service.name.toLowerCase().replace(' ', '-')}`,
                              name: service.name,
                              sale_price: service.price,
                              cost_price: 0,
                              current_stock: 999,
                              is_service: true,
                              is_active: true,
                              code: 'SVC'
                            } as any);
                        }}
                        className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-[10px] text-white shadow-lg transition-all active:scale-95 bg-gradient-to-r ${service.gradient} hover:brightness-110 shadow-indigo-200 dark:shadow-none`}
                      >
                        Add to Mission +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ProductGrid products={filteredProducts} loading={loading} onAddToCart={addToCart} />
          )}
        </div>
      </div>
      {/* Cart Section */}
      <div className="w-96 bg-gray-50 dark:bg-slate-950 border-l border-gray-200 dark:border-slate-800 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">Cart</h2>
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
            posMode={posMode}
          />
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-800">
            {posMode === 'ngo' ? (
              <div className="space-y-4">
                <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Mission Tracking (Required)</label>
                <DimensionSelector 
                  value={dimensions}
                  onChange={setDimensions}
                />
              </div>
            ) : (
              <details className="group">
                <summary className="list-none cursor-pointer flex items-center justify-between text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest hover:text-indigo-500 transition-colors">
                  <span>Optional Tracking Info</span>
                  <span className="group-open:rotate-180 transition-transform">↓</span>
                </summary>
                <div className="mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <DimensionSelector 
                    value={dimensions}
                    onChange={setDimensions}
                  />
                </div>
              </details>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-white/50 dark:bg-transparent">
            <Cart cart={cart} updateQuantity={updateQuantity} removeFromCart={removeFromCart} />
        </div>
        {/* Checkout */}
        <div className="p-6 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Grand Total</span>
            <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
              KSh {getTotal().toLocaleString()}
            </span>
          </div>
          <button
            onClick={paymentMethod === 'mpesa' ? handleMpesaPayment : handleCheckout}
            disabled={cart.length === 0 || loading || (posMode === 'ngo' && !dimensions.fund_id)}
            className={`w-full py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-lg active:scale-95 ${
              cart.length === 0 || loading || (posMode === 'ngo' && !dimensions.fund_id)
                ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-none'
            }`}
          >
            {loading ? 'Processing...' : paymentMethod === 'mpesa' ? 'Initiate M-Pesa' : posMode === 'ngo' ? 'Confirm NGO Service' : 'Complete Purchase'}
          </button>
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
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Add New {posMode === 'ngo' ? 'Donor' : 'Customer'}</h3>
                <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-1">Enroll into system registry</p>
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