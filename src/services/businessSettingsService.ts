import { ApiService } from './api';
import { BusinessSettings } from '../types';

export class BusinessSettingsService {
  static async getSettings(): Promise<BusinessSettings | null> {
    const response = await ApiService.get<BusinessSettings>('business_settings', {
      limit: 1
    });

    if (response.success && response.data && response.data.length > 0) {
      return response.data[0];
    }

    return null;
  }

  static async getBusinessSettings(): Promise<BusinessSettings | null> {
    return this.getSettings();
  }

  static async createSettings(settings: Partial<BusinessSettings>): Promise<BusinessSettings | null> {
    const response = await ApiService.create<BusinessSettings>('business_settings', settings);
    return response.success ? response.data : null;
  }

  static async updateSettings(id: string, settings: Partial<BusinessSettings>): Promise<BusinessSettings | null> {
    const response = await ApiService.update<BusinessSettings>('business_settings', id, {
      ...settings,
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });
    return response.success ? response.data : null;
  }

  static async uploadLogo(file: File): Promise<string | null> {
    const response = await ApiService.uploadFile('business-assets', file);
    return response.success ? response.data : null;
  }

  static async uploadFavicon(file: File): Promise<string | null> {
    const response = await ApiService.uploadFile('business-assets', file);
    return response.success ? response.data : null;
  }

  static async initializeDefaultSettings(): Promise<BusinessSettings | null> {
    const defaultSettings: Partial<BusinessSettings> = {
      business_name: 'My Business',
      default_currency: 'USD',
      tax_rate: 0.16,
      receipt_prefix: 'RCP',
      invoice_prefix: 'INV',
      product_code_prefix: 'PRD',
      customer_code_prefix: 'CUS',
      supplier_code_prefix: 'SUP',
      employee_code_prefix: 'EMP',
      fiscal_year_start: 1
    };

    return await this.createSettings(defaultSettings);
  }
} 