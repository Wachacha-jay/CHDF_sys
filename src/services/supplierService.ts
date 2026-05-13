import { ApiService } from './api';
import { Supplier, Purchase, PurchaseItem } from '../types';
import { DoubleEntryService } from './doubleEntryService';

export interface SupplierFilters {
  country?: string;
  is_active?: boolean;
  search?: string;
}

export interface SupplierStats {
  totalSuppliers: number;
  activeSuppliers: number;
  countries: { name: string; count: number }[];
  totalPurchases: number;
  averagePurchaseValue: number;
}

export interface CreatePurchaseData {
  supplier_id: string;
  purchase_date: string;
  due_date?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_cost: number;
    discount_amount?: number;
  }>;
  discount_amount?: number;
  notes?: string;
}

export class SupplierService {
  // Supplier CRUD operations
  static async getSuppliers(filters?: SupplierFilters, options?: {
    limit?: number;
    offset?: number;
    orderBy?: { column: string; ascending?: boolean };
  }): Promise<Supplier[]> {
    let apiFilters: Record<string, any> = {};
    
    if (filters?.country) apiFilters.country = filters.country;
    if (filters?.is_active !== undefined) apiFilters.is_active = filters.is_active;

    const response = await ApiService.get<Supplier>('suppliers', {
      filters: apiFilters,
      orderBy: options?.orderBy || { column: 'name', ascending: true },
      limit: options?.limit,
      offset: options?.offset
    });

    if (response.success && response.data) {
      let suppliers = response.data;
      
      // Apply search filter
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        suppliers = suppliers.filter(supplier => 
          supplier.name.toLowerCase().includes(searchTerm) ||
          supplier.code.toLowerCase().includes(searchTerm) ||
          supplier.contact_person?.toLowerCase().includes(searchTerm) ||
          supplier.email?.toLowerCase().includes(searchTerm) ||
          supplier.phone?.toLowerCase().includes(searchTerm)
        );
      }

      return suppliers;
    }

    return [];
  }

  static async getSupplierById(id: string): Promise<Supplier | null> {
    const response = await ApiService.getById<Supplier>('suppliers', id);
    return response.success ? response.data : null;
  }

  static async createSupplier(supplier: Partial<Supplier>): Promise<Supplier | null> {
    const response = await ApiService.create<Supplier>('suppliers', supplier);
    return response.success ? response.data : null;
  }

  static async updateSupplier(id: string, supplier: Partial<Supplier>): Promise<Supplier | null> {
    const response = await ApiService.update<Supplier>('suppliers', id, {
      ...supplier,
      updated_at: new Date().toISOString()
    });
    return response.success ? response.data : null;
  }

  static async deleteSupplier(id: string): Promise<boolean> {
    const response = await ApiService.delete('suppliers', id);
    return response.success;
  }

  // Purchase operations
  static async getPurchases(filters?: {
    supplier_id?: string;
    payment_status?: 'pending' | 'partial' | 'paid' | 'overdue';
    start_date?: string;
    end_date?: string;
    search?: string;
  }, options?: {
    limit?: number;
    offset?: number;
  }): Promise<Purchase[]> {
    const select = `
      *,
      supplier:suppliers(*),
      items:purchase_items(
        *,
        product:products(*)
      )
    `;

    let apiFilters: Record<string, any> = {};
    
    if (filters?.supplier_id) apiFilters.supplier_id = filters.supplier_id;
    if (filters?.payment_status) apiFilters.payment_status = filters.payment_status;
    if (filters?.start_date) apiFilters.purchase_date_gte = filters.start_date;
    if (filters?.end_date) apiFilters.purchase_date_lte = filters.end_date;

    const response = await ApiService.get<Purchase>('purchases', {
      select,
      filters: apiFilters,
      orderBy: { column: 'purchase_date', ascending: false },
      limit: options?.limit,
      offset: options?.offset
    });

    if (response.success && response.data) {
      let purchases = response.data;
      


      // Apply search filter
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        purchases = purchases.filter(purchase => 
          purchase.purchase_number.toLowerCase().includes(searchTerm) ||
          purchase.supplier?.name.toLowerCase().includes(searchTerm) ||
          purchase.notes?.toLowerCase().includes(searchTerm)
        );
      }

      return purchases;
    }

    return [];
  }

  static async getPurchaseById(id: string): Promise<Purchase | null> {
    const select = `
      *,
      supplier:suppliers(*),
      items:purchase_items(
        *,
        product:products(*)
      )
    `;

    const response = await ApiService.getById<Purchase>('purchases', id, select);
    return response.success ? response.data : null;
  }

  static async createPurchase(purchaseData: CreatePurchaseData): Promise<Purchase | null> {
    try {
      const subtotal = purchaseData.items.reduce((sum, item) =>
        sum + (item.quantity * item.unit_cost) - (item.discount_amount || 0), 0
      );
      const taxAmount = subtotal * 0.16;
      const totalAmount = subtotal + taxAmount - (purchaseData.discount_amount || 0);

      const response = await ApiService.post<Purchase>('purchases', {
        ...purchaseData,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        paid_amount: 0,
        payment_status: 'pending'
      });

      if (response.success && response.data) {
        const purchase = response.data;
        // Post to double entry ledger
        await DoubleEntryService.postPurchase(purchase);
        return purchase;
      }
      return null;
    } catch (error) {
      console.error('Error creating purchase:', error);
      return null;
    }
  }

  static async updatePurchase(id: string, purchase: Partial<Purchase>): Promise<Purchase | null> {
    const response = await ApiService.update<Purchase>('purchases', id, {
      ...purchase,
      updated_at: new Date().toISOString()
    });
    return response.success ? response.data : null;
  }

  static async deletePurchase(id: string): Promise<boolean> {
    // First, get the purchase to reverse product stock
    const purchase = await this.getPurchaseById(id);
    if (purchase && purchase.items) {
      for (const item of purchase.items) {
        await this.updateProductStock(item.product_id, item.quantity, 'out');
      }
    }

    const response = await ApiService.delete('purchases', id);
    return response.success;
  }

  // Payment operations for purchases
  static async recordPurchasePayment(purchaseId: string, amount: number, method: string = 'bank', date?: string): Promise<boolean> {
    try {
      const purchase = await this.getPurchaseById(purchaseId);
      if (!purchase) return false;

      const newPaidAmount = purchase.paid_amount + amount;
      let paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue' = 'pending';

      if (newPaidAmount >= purchase.total_amount) {
        paymentStatus = 'paid';
      } else if (newPaidAmount > 0) {
        paymentStatus = 'partial';
      }

      // Check if overdue
      if (purchase.due_date && new Date() > new Date(purchase.due_date) && paymentStatus !== 'paid') {
        paymentStatus = 'overdue';
      }

      const updateResponse = await this.updatePurchase(purchaseId, {
        paid_amount: newPaidAmount,
        payment_status: paymentStatus
      });

      if (updateResponse) {
        await DoubleEntryService.postSupplierPayment(purchase, amount, method, date);
      }

      return !!updateResponse;
    } catch (error) {
      console.error('Error recording purchase payment:', error);
      return false;
    }
  }

  // Supplier statistics
  static async getSupplierStats(): Promise<SupplierStats> {
    const suppliers = await this.getSuppliers({ is_active: true });
    const purchases = await this.getPurchases();
    
    const countries = new Map<string, number>();
    let totalPurchases = 0;
    let totalPurchaseValue = 0;

    suppliers.forEach(supplier => {
      if (supplier.is_active && supplier.country) {
        countries.set(supplier.country, (countries.get(supplier.country) || 0) + 1);
      }
    });

    purchases.forEach(purchase => {
      totalPurchases++;
      totalPurchaseValue += purchase.total_amount;
    });

    const countryStats = Array.from(countries.entries()).map(([name, count]) => ({
      name,
      count
    }));

    const stats: SupplierStats = {
      totalSuppliers: suppliers.length,
      activeSuppliers: suppliers.filter(s => s.is_active).length,
      countries: countryStats,
      totalPurchases,
      averagePurchaseValue: totalPurchases > 0 ? totalPurchaseValue / totalPurchases : 0
    };

    return stats;
  }

  // Country operations
  static async getCountries(): Promise<string[]> {
    const suppliers = await this.getSuppliers({ is_active: true });
    const countries = new Set<string>();
    
    suppliers.forEach(supplier => {
      if (supplier.country) {
        countries.add(supplier.country);
      }
    });

    return Array.from(countries).sort();
  }

  // Supplier search by email
  static async getSupplierByEmail(email: string): Promise<Supplier | null> {
    const response = await ApiService.get<Supplier>('suppliers', {
      filters: { email },
      limit: 1
    });

    if (response.success && response.data && response.data.length > 0) {
      return response.data[0];
    }

    return null;
  }

  // Bulk operations
  static async bulkUpdateSuppliers(updates: Array<{ id: string; updates: Partial<Supplier> }>): Promise<boolean> {
    try {
      for (const update of updates) {
        await this.updateSupplier(update.id, update.updates);
      }
      return true;
    } catch (error) {
      console.error('Error in bulk update:', error);
      return false;
    }
  }

  // Supplier validation
  static validateSupplier(supplier: Partial<Supplier>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!supplier.name?.trim()) {
      errors.push('Supplier name is required');
    }

    if (supplier.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplier.email)) {
      errors.push('Invalid email format');
    }

    if (supplier.payment_terms && supplier.payment_terms < 0) {
      errors.push('Payment terms cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Helper method to update product stock
  private static async updateProductStock(productId: string, quantity: number, type: 'in' | 'out'): Promise<boolean> {
    try {
      const productResponse = await ApiService.getById<any>('products', productId);
      if (!productResponse.success || !productResponse.data) return false;

      const product = productResponse.data;
      let newStock = product.current_stock;
      
      if (type === 'in') {
        newStock += quantity;
      } else {
        newStock = Math.max(0, newStock - quantity);
      }

      const updateResponse = await ApiService.update('products', productId, {
        current_stock: newStock,
        updated_at: new Date().toISOString()
      });

      if (!updateResponse.success) return false;

      // Create inventory movement record
      await ApiService.create('inventory_movements', {
        product_id: productId,
        movement_type: type,
        quantity,
        unit_cost: product.cost_price,
        reference_type: 'purchase',
        description: `Purchase ${type === 'in' ? 'addition' : 'reversal'}`
      });

      return true;
    } catch (error) {
      console.error('Error updating product stock:', error);
      return false;
    }
  }
} 