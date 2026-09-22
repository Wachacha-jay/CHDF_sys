import React, { useEffect, useState } from 'react';
import { FundAccountingService } from '../../services/fundAccountingService';
import { Landmark, Wallet, ArrowRightLeft, TrendingUp, AlertCircle, RefreshCw, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Account } from '../../types';

interface BankBalanceOverviewProps {
  refreshTrigger?: number;
  onInitiateTransfer?: (sourceBankId?: string) => void;
  showTransferAction?: boolean;
}

export const BankBalanceOverview: React.FC<BankBalanceOverviewProps> = ({
  refreshTrigger,
  onInitiateTransfer,
  showTransferAction = true
}) => {
  const navigate = useNavigate();
  const [bankAccounts, setBankAccounts] = useState<Array<{
    account: Account;
    balance: number;
    currency: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  const loadBankBalances = async () => {
    try {
      setLoading(true);
      const data = await FundAccountingService.getBankAndCashBalances();
      setBankAccounts(data || []);
    } catch (err) {
      console.error('Failed to load bank balances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBankBalances();
  }, [refreshTrigger]);

  const totalLiquidBalance = bankAccounts.reduce((sum, b) => sum + b.balance, 0);

  const handleTransferClick = (accountId: string) => {
    if (onInitiateTransfer) {
      onInitiateTransfer(accountId);
    } else {
      navigate('/funds/transfers', { state: { preselectedSourceBankId: accountId } });
    }
  };

  if (loading && bankAccounts.length === 0) {
    return <div className="animate-pulse h-32 bg-gray-100 dark:bg-slate-800 rounded-2xl"></div>;
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Landmark className="text-indigo-600" size={20} />
            <h3 className="text-lg font-bold text-gray-900">Bank & Cash Accounts Overview</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time liquid cash available across operating banks and till accounts (Debits minus Credits)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Total Liquid Funds</span>
            <span className="text-lg font-bold text-emerald-600">
              KES {totalLiquidBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          {showTransferAction && (
            <button
              onClick={() => handleTransferClick('')}
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Move funds between bank accounts or departments"
            >
              <ArrowRightLeft size={14} />
              Transfer Funds
            </button>
          )}
        </div>
      </div>

      {bankAccounts.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 italic">
          No bank or cash asset accounts found in Chart of Accounts.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {bankAccounts.map(({ account, balance, currency }) => {
            const isHealthy = balance >= 0;
            const isBank = (account.name || '').toLowerCase().includes('bank');

            return (
              <div
                key={account.id}
                className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-white hover:border-indigo-100 hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${isBank ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {isBank ? <Landmark size={16} /> : <Wallet size={16} />}
                      </div>
                      <div>
                        <span className="font-mono text-[11px] font-bold text-gray-400">Code {account.code}</span>
                        <h4 className="text-xs font-bold text-gray-900 line-clamp-1" title={account.name}>
                          {account.name}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">Available Balance</span>
                    <span className={`text-lg font-extrabold tracking-tight ${isHealthy ? 'text-gray-900' : 'text-rose-600'}`}>
                      {currency} {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className={`flex items-center gap-1 font-semibold text-[11px] ${isHealthy ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isHealthy ? <TrendingUp size={12} /> : <AlertCircle size={12} />}
                    {isHealthy ? 'Available' : 'Overdrawn'}
                  </span>
                  {showTransferAction && (
                    <button
                      onClick={() => handleTransferClick(account.id)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                    >
                      Transfer <ArrowRightLeft size={10} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
