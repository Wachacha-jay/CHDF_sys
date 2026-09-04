import { ApiService } from './api';
import type { FixedAsset } from '../types';

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
