import React, { useEffect, useState } from 'react';
import { FundAccount } from '../../types';
import { FundAccountingService } from '../../services/fundAccountingService';
import { Wallet, TrendingUp, ShieldCheck, AlertCircle } from 'lucide-react';

export const FundBalanceWidget: React.FC = () => {
  const [funds, setFunds] = useState<FundAccount[]>([]);
  const [balances, setBalances] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const [fundList, balanceMap] = await Promise.all([
        FundAccountingService.getFundAccounts(),
        FundAccountingService.getFundBalances()
      ]);
      setFunds(fundList);
      setBalances(balanceMap);
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) return <div className="animate-pulse h-48 bg-gray-100 rounded-xl"></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {funds.map((fund) => {
        const balance = balances.get(fund.id) || 0;
        const isRestricted = fund.restriction_type !== 'unrestricted';
        
        return (
          <div key={fund.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${isRestricted ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {isRestricted ? <ShieldCheck size={24} /> : <Wallet size={24} />}
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                isRestricted ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {fund.restriction_type.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            
            <h3 className="text-gray-500 text-sm font-medium mb-1">{fund.name}</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(balance)}
              </span>
              <span className={`text-xs flex items-center gap-1 ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {balance >= 0 ? <TrendingUp size={12} /> : <AlertCircle size={12} />}
                {balance >= 0 ? 'Healthy' : 'Overdrawn'}
              </span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between text-xs text-gray-400">
              <span>Code: {fund.code}</span>
              <span>ID: {fund.id.substring(0, 8)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
