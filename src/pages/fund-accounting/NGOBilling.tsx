import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, User, Heart, GraduationCap, Calendar, Plus, Trash2, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SalesService } from '../../services/salesService';
import { FundAccountingService } from '../../services/fundAccountingService';
import { useAuthContext } from '../../contexts/useAuthContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import type { Customer, Child, Sponsorship, FundAccount, Department, Donor } from '../../types';

type BillingType = 'school_fees' | 'child_support' | 'sponsorship';

const NGOBilling: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { settings } = useSettingsContext();
  
  const [billingType, setBillingType] = useState<BillingType>('school_fees');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([]);
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedChild, setSelectedChild] = useState('');
  const [selectedFund, setSelectedFund] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDonor, setSelectedDonor] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadData();
    // Set default due date to 7 days from now
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDueDate(d.toISOString().split('T')[0]);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [custs, childs, spons, fList, dList, donorList] = await Promise.all([
        SalesService.getCustomers(),
        FundAccountingService.getChildren(),
        FundAccountingService.getSponsorships(),
        FundAccountingService.getFundAccounts(),
        FundAccountingService.getDepartments(),
        FundAccountingService.getDonors()
      ]);
      setCustomers(custs);
      setChildren(childs);
      setSponsorships(spons);
      setFunds(fList);
      setDepartments(dList);
      setDonors(donorList);
    } catch (error) {
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fill when child/type changes
  useEffect(() => {
    if (billingType === 'child_support' && selectedChild) {
      const sponsorship = sponsorships.find(s => s.child_id === selectedChild && s.status === 'active');
      if (sponsorship) {
        setAmount(sponsorship.amount.toString());
        setSelectedCustomer(customers.find(c => c.name.includes(sponsorship.sponsor?.name || ''))?.id || '');
        setDescription(`Monthly Support for ${children.find(c => c.id === selectedChild)?.first_name}`);
      }
    } else if (billingType === 'school_fees' && selectedChild) {
        const child = children.find(c => c.id === selectedChild);
        if (child && child.guardian_id) {
            // Find customer that matches guardian name
            const guardianCust = customers.find(c => c.name.includes(child.guardian?.name || ''));
            if (guardianCust) setSelectedCustomer(guardianCust.id);
        }
        setDescription(`School Fees for ${child?.first_name} ${child?.last_name}`);
    }
  }, [selectedChild, billingType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !amount || !dueDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      
      const billingData = {
        sale_date: new Date().toISOString().split('T')[0],
        due_date: dueDate,
        customer_id: selectedCustomer,
        sale_type: billingType,
        child_id: selectedChild || undefined,
        department_id: selectedDept || undefined,
        fund_id: selectedFund || undefined,
        donor_id: selectedDonor || undefined,
        payment_method: 'credit', // NGO billing is typically credit/invoiced
        notes: notes,
        items: [
          {
            description: description || `${billingType.replace('_', ' ')}`,
            quantity: 1,
            unit_price: Number(amount)
          }
        ]
      };

      const response = await SalesService.createSale(billingData);
      
      if (response) {
        toast.success('NGO Invoice generated successfully');
        navigate(`/invoice/${response.id}`);
      } else {
        toast.error('Failed to generate invoice');
      }
    } catch (error) {
      toast.error('An error occurred during billing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">NGO Billing Center</h1>
        <p className="text-gray-600 mt-2">Generate professional invoices for school fees, child support, and sponsorship obligations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => setBillingType('school_fees')}
          className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
            billingType === 'school_fees' 
            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md' 
            : 'border-gray-100 bg-white text-gray-500 hover:border-blue-200'
          }`}
        >
          <GraduationCap className={`h-8 w-8 ${billingType === 'school_fees' ? 'text-blue-600' : 'text-gray-400'}`} />
          <span className="font-bold">School Fees</span>
        </button>

        <button
          onClick={() => setBillingType('child_support')}
          className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
            billingType === 'child_support' 
            ? 'border-pink-600 bg-pink-50 text-pink-700 shadow-md' 
            : 'border-gray-100 bg-white text-gray-500 hover:border-pink-200'
          }`}
        >
          <Heart className={`h-8 w-8 ${billingType === 'child_support' ? 'text-pink-600' : 'text-gray-400'}`} />
          <span className="font-bold">Child Support</span>
        </button>

        <button
          onClick={() => setBillingType('sponsorship')}
          className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
            billingType === 'sponsorship' 
            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md' 
            : 'border-gray-100 bg-white text-gray-500 hover:border-indigo-200'
          }`}
        >
          <User className={`h-8 w-8 ${billingType === 'sponsorship' ? 'text-indigo-600' : 'text-gray-400'}`} />
          <span className="font-bold">Sponsorship</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Beneficiary Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Beneficiary (Child)</label>
              <div className="relative">
                <select
                  value={selectedChild}
                  onChange={(e) => setSelectedChild(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                >
                  <option value="">Select a child...</option>
                  {children.map(child => (
                    <option key={child.id} value={child.id}>
                      {child.first_name} {child.last_name} ({child.code})
                    </option>
                  ))}
                </select>
                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
            </div>

            {/* Payer Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Payer (Parent/Sponsor)</label>
              <div className="relative">
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                >
                  <option value="">Select customer...</option>
                  {customers.map(cust => (
                    <option key={cust.id} value={cust.id}>
                      {cust.name} {cust.code ? `(${cust.code})` : ''}
                    </option>
                  ))}
                </select>
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Amount (KSh)</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">
                  KSh
                </span>
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Due Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Invoice Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Term 2 School Fees 2026"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Tracking Dimensions */}
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Accounting Dimensions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500">Department/Project</label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">No Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500">Donor Allocation</label>
                <select
                  value={selectedDonor}
                  onChange={(e) => setSelectedDonor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">No Donor</option>
                  {donors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500">Restricted Fund</label>
                <select
                  value={selectedFund}
                  onChange={(e) => setSelectedFund(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">No Fund</option>
                  {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Internal Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Private notes for accounting..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>
        </div>

        <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-3 text-gray-600 font-bold hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-10 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-gray-400 transition-all flex items-center gap-2"
          >
            {submitting ? 'Generating...' : 'Generate Invoice'}
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default NGOBilling;
