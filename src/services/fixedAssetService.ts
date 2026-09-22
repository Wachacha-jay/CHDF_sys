import { ApiService } from './api';
import { AccountingService } from './accountingService';
import type { FixedAsset } from '../types';

export interface CreateAssetGLOptions {
  acquisition_method: 'bank_cash' | 'payable' | 'donation' | 'opening_balance';
  credit_account_id?: string;
}

export class FixedAssetService {
  static async getAll(): Promise<FixedAsset[]> {
    const res = await ApiService.get<FixedAsset>('fixed_assets', {
      orderBy: { column: 'created_at', ascending: false }
    });
    return res.success && res.data ? res.data : [];
  }

  static async getById(id: string): Promise<FixedAsset | null> {
    const res = await ApiService.getById<FixedAsset>('fixed_assets', id, `
      id, asset_name, description, serial_number, asset_type,
      purchase_date, purchase_cost, current_value, salvage_value,
      useful_life_years, department_id, status, created_at, updated_at,
      departments(id, name)
    `);
    return res.success && res.data ? res.data : null;
  }

  static async create(data: Omit<FixedAsset, 'id' | 'created_at' | 'updated_at' | 'department'>): Promise<FixedAsset | null> {
    const res = await ApiService.post<FixedAsset>('fixed_assets', data);
    return res.success && res.data ? res.data : null;
  }

  static async createWithGL(
    data: Omit<FixedAsset, 'id' | 'created_at' | 'updated_at' | 'department'>,
    glOptions?: CreateAssetGLOptions
  ): Promise<{ asset: FixedAsset | null; journalEntryId?: string; error?: string }> {
    const asset = await this.create(data);
    if (!asset) {
      return { asset: null, error: 'Failed to create asset in database' };
    }

    // If no GL posting requested or cost is 0, return asset
    const cost = Number(data.purchase_cost || 0);
    if (!glOptions || cost <= 0) {
      return { asset };
    }

    try {
      const accounts = await AccountingService.getAccounts({ is_active: true });
      const flatAccounts = AccountingService.flattenAccounts(accounts);
      const findAccount = (code: string) => flatAccounts.find(a => a.code === code);

      // Determine Debit Account (Fixed Asset)
      let debitAccount = null;
      const type = (data.asset_type || '').toLowerCase();
      if (type.includes('furniture')) {
        debitAccount = findAccount('1220') || flatAccounts.find(a => /furniture|fixture/i.test(a.name));
      } else if (type.includes('building') || type.includes('infrastructure')) {
        debitAccount = findAccount('1230') || flatAccounts.find(a => /building|infrastructure|land/i.test(a.name));
      } else if (type.includes('vehicle')) {
        debitAccount = findAccount('1240') || flatAccounts.find(a => /vehicle|motor|car/i.test(a.name));
      } else if (type.includes('computer') || type.includes('technology')) {
        debitAccount = findAccount('1250') || findAccount('1210') || flatAccounts.find(a => /computer|tech|it equipment/i.test(a.name));
      } else {
        debitAccount = findAccount('1210') || findAccount('1500') || findAccount('1200') || flatAccounts.find(a => /equipment|machinery|fixed/i.test(a.name) && a.account_type === 'asset');
      }

      if (!debitAccount) {
        debitAccount = findAccount('1200') || findAccount('1210') || findAccount('1500') || flatAccounts.find(a => a.account_type === 'asset' && (a.code?.startsWith('12') || a.code?.startsWith('15')));
      }

      // Determine Credit Account based on acquisition method
      let creditAccount = null;
      if (glOptions.acquisition_method === 'bank_cash') {
        if (glOptions.credit_account_id) {
          creditAccount = flatAccounts.find(a => a.id === glOptions.credit_account_id);
        }
        if (!creditAccount) {
          creditAccount = findAccount('1111') || findAccount('1110') || flatAccounts.find(a => a.account_type === 'asset' && (a.code?.startsWith('11') || /bank|cash/i.test(a.name)));
        }
      } else if (glOptions.acquisition_method === 'payable') {
        creditAccount = findAccount('2000') || findAccount('2100') || flatAccounts.find(a => a.account_type === 'liability' && (a.code?.startsWith('20') || /payable/i.test(a.name)));
      } else if (glOptions.acquisition_method === 'donation') {
        creditAccount = findAccount('4260') || findAccount('4200') || flatAccounts.find(a => a.account_type === 'revenue' && /donation|in-kind|grant/i.test(a.name));
      } else if (glOptions.acquisition_method === 'opening_balance') {
        creditAccount = findAccount('3000') || findAccount('3100') || flatAccounts.find(a => a.account_type === 'equity');
      }

      if (debitAccount && creditAccount) {
        const entry = await AccountingService.createJournalEntry({
          entry_date: data.purchase_date || new Date().toISOString().split('T')[0],
          description: `Fixed Asset Acquisition: ${data.asset_name}${data.serial_number ? ` (S/N: ${data.serial_number})` : ''}`,
          reference: data.serial_number || `AST-${asset.id.slice(0, 8).toUpperCase()}`,
          is_posted: true,
          lines: [
            {
              account_id: debitAccount.id,
              description: `Capitalized ${data.asset_type || 'Fixed Asset'}: ${data.asset_name}`,
              debit_amount: cost,
              credit_amount: 0,
              department_id: data.department_id || undefined
            },
            {
              account_id: creditAccount.id,
              description: `Funding for asset ${data.asset_name} via ${glOptions.acquisition_method.replace('_', ' ')}`,
              debit_amount: 0,
              credit_amount: cost,
              department_id: data.department_id || undefined
            }
          ]
        });

        return { asset, journalEntryId: entry?.id };
      }

      return { asset };
    } catch (err: any) {
      console.error('Failed to create GL entry for fixed asset:', err);
      return { asset, error: err?.message || 'Asset registered, but GL posting encountered an issue.' };
    }
  }

  static async update(id: string, data: Partial<FixedAsset>): Promise<FixedAsset | null> {
    const res = await ApiService.update<FixedAsset>('fixed_assets', id, {
      ...data,
      updated_at: new Date().toISOString()
    });
    return res.success && res.data ? res.data : null;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await ApiService.delete('fixed_assets', id);
    return res.success;
  }
}

