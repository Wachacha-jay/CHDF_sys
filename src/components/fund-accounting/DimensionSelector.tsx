import React, { useEffect, useState } from 'react';
import { Department, Child, Donor, FundAccount } from '../../types';
import { FundAccountingService } from '../../services/fundAccountingService';

interface DimensionSelectorProps {
  value?: {
    department_id?: string;
    child_id?: string;
    donor_id?: string;
    fund_id?: string;
  };
  onChange: (dimensions: {
    department_id?: string;
    child_id?: string;
    donor_id?: string;
    fund_id?: string;
  }) => void;
  showAll?: boolean;
}

export const DimensionSelector: React.FC<DimensionSelectorProps> = ({ value, onChange, showAll = true }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [funds, setFunds] = useState<FundAccount[]>([]);

  useEffect(() => {
    const loadDimensions = async () => {
      const [deptList, childList, donorList, fundList] = await Promise.all([
        FundAccountingService.getDepartments(),
        FundAccountingService.getChildren(),
        FundAccountingService.getDonors(),
        FundAccountingService.getFundAccounts()
      ]);
      setDepartments(deptList);
      setChildren(childList);
      setDonors(donorList);
      setFunds(fundList);
    };
    loadDimensions();
  }, []);

  const handleChange = (field: string, val: string) => {
    onChange({
      ...value,
      [field]: val === '' ? undefined : val
    });
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest block">Department</label>
        <select 
          className="w-full bg-white dark:bg-slate-900 border-none rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all shadow-sm"
          value={value?.department_id || ''}
          onChange={(e) => handleChange('department_id', e.target.value)}
        >
          <option value="">Select Department</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">Fund / Project</label>
        <select 
          className="w-full bg-amber-50/30 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-amber-500 dark:text-white transition-all shadow-sm"
          value={value?.fund_id || ''}
          onChange={(e) => handleChange('fund_id', e.target.value)}
        >
          <option value="">Select Fund</option>
          {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">Beneficiary (Child)</label>
        <select 
          className="w-full bg-emerald-50/30 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-emerald-500 dark:text-white transition-all shadow-sm"
          value={value?.child_id || ''}
          onChange={(e) => handleChange('child_id', e.target.value)}
        >
          <option value="">Select Child</option>
          {children.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-purple-500 uppercase tracking-widest block">Donor / Sponsor</label>
        <select 
          className="w-full bg-purple-50/30 dark:bg-purple-500/5 border border-purple-100 dark:border-purple-500/20 rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-purple-500 dark:text-white transition-all shadow-sm"
          value={value?.donor_id || ''}
          onChange={(e) => handleChange('donor_id', e.target.value)}
        >
          <option value="">Select Donor</option>
          {donors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
    </div>
  );
};
