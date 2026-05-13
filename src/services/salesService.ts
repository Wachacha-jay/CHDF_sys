import { ApiService } from './api';
import { Sale, SaleItem, Customer, Product } from '../types';
import { AccountingService } from './accountingService';
import { DoubleEntryService } from './doubleEntryService';

export interface SalesFilters {
  customer_id?: string;
  payment_status?: 'pending' | 'partial' | 'paid' | 'overdue';
  start_date?: string;
  end_date?: string;
  search?: string;
}

export interface SalesStats {
  totalSales: number;
  todaySales: number;
  monthlySales: number;
  pendingPayments: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export interface CreateSaleData {
  customer_id?: string;
  sale_date: string;
  due_date?: string;
  sale_type?: 'standard' | 'school_fees' | 'child_support' | 'sponsorship';
  child_id?: string;
  department_id?: string;
  fund_id?: string;
  donor_id?: string;
  items: Array<{
    product_id?: string;
    description?: string;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
  }>;
  subtotal?: number;
  tax_amount?: number;
  discount_amount?: number;
  total_amount?: number;
  payment_method?: string;
  notes?: string;
}

export class SalesService {
  // Sales CRUD operations
  static async getSales(filters?: SalesFilters, options?: {
    limit?: number;
    offset?: number;
    orderBy?: { column: string; ascending?: boolean };
  }): Promise<Sale[]> {
    const select = `
      *,
      customer:customers(*),
      child:children(*),
      items:sale_items(
        *,
        product:products(*)
      )
    `;

    let apiFilters: Record<string, any> = {};

    if (filters?.customer_id) apiFilters.customer_id = filters.customer_id;
    if (filters?.payment_status) apiFilters.payment_status = filters.payment_status;
    if (filters?.start_date) apiFilters.sale_date_gte = filters.start_date;
    if (filters?.end_date) apiFilters.sale_date_lte = filters.end_date;

    const response = await ApiService.get<Sale>('sales', {
      select,
      filters: apiFilters,
      orderBy: options?.orderBy || { column: 'sale_date', ascending: false },
      limit: options?.limit,
      offset: options?.offset
    });

    if (response.success && response.data) {
      let sales = response.data;

      // Apply search filter
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        sales = sales.filter(sale =>
          sale.sale_number.toLowerCase().includes(searchTerm) ||
          sale.customer?.name.toLowerCase().includes(searchTerm) ||
          sale.notes?.toLowerCase().includes(searchTerm)
        );
      }

      return sales;
    }

    return [];
  }

  static async getSaleById(id: string): Promise<Sale | null> {
    const select = `
      *,
      customer:customers(*),
      child:children(*),
      items:sale_items(
        *,
        product:products(*)
      )
    `;

    const response = await ApiService.getById<Sale>('sales', id, select);
    return response.success ? response.data : null;
  }

  static async createSale(saleData: CreateSaleData): Promise<Sale | null> {
    try {
      // Calculate totals
      const subtotal = saleData.subtotal || saleData.items.reduce((sum, item) =>
        sum + (item.quantity * item.unit_price) - (item.discount_amount || 0), 0
      );

      // No tax for school fees/child support unless specified
      const isNGOFee = saleData.sale_type && saleData.sale_type !== 'standard';
      const taxRate = isNGOFee ? 0 : 0.16;
      const taxAmount = saleData.tax_amount !== undefined ? saleData.tax_amount : (subtotal * taxRate);
      const totalAmount = saleData.total_amount || (subtotal + taxAmount - (saleData.discount_amount || 0));

      const isCredit = saleData.payment_method === 'credit';
      const paidAmount = isCredit ? 0 : totalAmount;
      const paymentStatus = isCredit ? 'pending' : 'paid';

      const response = await ApiService.post<any>('sales', {
        ...saleData,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        payment_status: paymentStatus
      });

      if (response.success && response.data) {
        // Create sale items manually if they are not product-based (for fees)
        const saleId = response.data.id;
        for (const item of saleData.items) {
            // If product_id is missing, it's a service/fee. We might need a dummy product or just insert into sale_items with null product_id if DB allows.
            // Check: sale_items table schema requires product_id NOT NULL.
            // I should use a "System Service" product for fees.
            await ApiService.post('sale_items', {
                sale_id: saleId,
                product_id: item.product_id || 'SERVICE-FEES-0000-0000-000000000001', 
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount_amount: item.discount_amount || 0,
                tax_amount: (item.quantity * item.unit_price) * taxRate,
                total_amount: (item.quantity * item.unit_price) * (1 + taxRate)
            });
        }

        const sale = await this.getSaleById(saleId);
        if (sale) {
          await DoubleEntryService.postSale(sale);
        }
        return sale;
      }

      return null;
    } catch (error) {
      console.error('Error creating sale:', error);
      return null;
    }
  }

  static async updateSale(id: string, sale: Partial<Sale>): Promise<Sale | null> {
    const response = await ApiService.update<Sale>('sales', id, {
      ...sale,
      updated_at: new Date().toISOString()
    });
    return response.success ? response.data : null;
  }

  static async deleteSale(id: string): Promise<boolean> {
    // First, get the sale to restore product stock
    const sale = await this.getSaleById(id);
    if (sale && sale.items) {
      for (const item of sale.items) {
        await this.updateProductStock(item.product_id, item.quantity, 'in');
      }
    }

    const response = await ApiService.delete('sales', id);
    return response.success;
  }

  // Payment operations
  static async recordPayment(saleId: string, amount: number, paymentMethod?: string, date?: string): Promise<boolean> {
    try {
      const sale = await this.getSaleById(saleId);
      if (!sale) return false;

      const newPaidAmount = sale.paid_amount + amount;
      let paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue' = 'pending';

      if (newPaidAmount >= sale.total_amount) {
        paymentStatus = 'paid';
      } else if (newPaidAmount > 0) {
        paymentStatus = 'partial';
      }

      // Check if overdue
      if (sale.due_date && new Date() > new Date(sale.due_date) && paymentStatus !== 'paid') {
        paymentStatus = 'overdue';
      }

      const updateResponse = await this.updateSale(saleId, {
        paid_amount: newPaidAmount,
        payment_status: paymentStatus,
        payment_method: paymentMethod || sale.payment_method
      });

      if (updateResponse) {
        // Create journal entry for payment
        await DoubleEntryService.postCustomerPayment(sale, amount, paymentMethod || sale.payment_method || 'mpesa', date);
      }

      return !!updateResponse;
    } catch (error) {
      console.error('Error recording payment:', error);
      return false;
    }
  }

  // Sales statistics
  static async getSalesStats(startDate?: string, endDate?: string): Promise<SalesStats> {
    const sales = await this.getSales({
      start_date: startDate,
      end_date: endDate
    });

    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);

    const todaySales = sales.filter(sale => sale.sale_date === today);
    const monthlySales = sales.filter(sale => sale.sale_date.startsWith(thisMonth));
    const pendingPayments = sales.filter(sale => sale.payment_status === 'pending' || sale.payment_status === 'partial');

    const stats: SalesStats = {
      totalSales: sales.length,
      todaySales: todaySales.length,
      monthlySales: monthlySales.length,
      pendingPayments: pendingPayments.length,
      totalRevenue: sales.reduce((sum, sale) => sum + sale.total_amount, 0),
      averageOrderValue: sales.length > 0 ? sales.reduce((sum, sale) => sum + sale.total_amount, 0) / sales.length : 0
    };

    return stats;
  }

  // Customer operations
  static async getCustomers(): Promise<Customer[]> {
    const response = await ApiService.get<Customer>('customers', {
      filters: { is_active: true },
      orderBy: { column: 'name', ascending: true }
    });

    return response.success ? response.data || [] : [];
  }

  static async createCustomer(customer: Partial<Customer>): Promise<Customer | null> {
    const response = await ApiService.create<Customer>('customers', customer);
    return response.success ? response.data : null;
  }

  static async updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer | null> {
    const response = await ApiService.update<Customer>('customers', id, {
      ...customer,
      updated_at: new Date().toISOString()
    });
    return response.success ? response.data : null;
  }

  static async deleteCustomer(id: string): Promise<boolean> {
    const response = await ApiService.delete('customers', id);
    return response.success;
  }

  // Product operations for sales
  static async getProductsForSale(): Promise<Product[]> {
    const response = await ApiService.get<Product>('products', {
      filters: { is_active: true },
      orderBy: { column: 'name', ascending: true }
    });

    return response.success ? response.data || [] : [];
  }

  // Helper method to update product stock
  private static async updateProductStock(productId: string, quantity: number, type: 'in' | 'out'): Promise<boolean> {
    try {
      const productResponse = await ApiService.getById<Product>('products', productId);
      if (!productResponse.success || !productResponse.data) return false;

      const product = productResponse.data;
      let newStock = product.current_stock;

      if (type === 'out') {
        newStock = Math.max(0, newStock - quantity);
      } else {
        newStock += quantity;
      }

      const updateResponse = await ApiService.update<Product>('products', productId, {
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
        reference_type: 'sale',
        description: `Sale ${type === 'out' ? 'reduction' : 'return'}`
      });

      return true;
    } catch (error) {
      console.error('Error updating product stock:', error);
      return false;
    }
  }

  // Create journal entry for sale
  private static async createSaleJournalEntry(sale: Sale, saleData: CreateSaleData): Promise<void> {
    try {
      // Get required accounts
      const accounts = await AccountingService.getAccounts();

      // Find account IDs by code
      const cashAccount = accounts.find(a => a.code === '1000'); // Cash
      const arAccount = accounts.find(a => a.code === '1100'); // Accounts Receivable
      const salesRevenueAccount = accounts.find(a => a.code === '4000'); // Sales Revenue
      const cogsAccount = accounts.find(a => a.code === '5000'); // Cost of Goods Sold
      const inventoryAccount = accounts.find(a => a.code === '1200'); // Inventory

      if (!cashAccount || !arAccount || !salesRevenueAccount || !cogsAccount || !inventoryAccount) {
        console.warn('Required accounts not found for journal entry. Skipping accounting integration.');
        return;
      }

      // Determine if cash or credit sale
      const isCashSale = saleData.payment_method === 'cash' || saleData.payment_method === 'mpesa' || saleData.payment_method === 'card';
      const receivableAccount = isCashSale ? cashAccount : arAccount;

      // Calculate COGS (using 60% of sales as default - should be from product cost)
      const totalCOGS = sale.subtotal * 0.6; // This is a simplified calculation

      // Create journal entry lines
      const journalLines = [
        // Debit Cash/AR for total sale amount
        {
          account_id: receivableAccount.id,
          description: `Sale ${sale.sale_number}`,
          debit_amount: sale.total_amount,
          credit_amount: 0
        },
        // Credit Sales Revenue for subtotal
        {
          account_id: salesRevenueAccount.id,
          description: `Sale ${sale.sale_number}`,
          debit_amount: 0,
          credit_amount: sale.subtotal
        },
        // Credit Sales Tax Payable for tax amount (if tax > 0)
        ...(sale.tax_amount > 0 ? [{
          account_id: salesRevenueAccount.id, // Simplified - should be tax payable account
          description: `Sales Tax on ${sale.sale_number}`,
          debit_amount: 0,
          credit_amount: sale.tax_amount
        }] : []),
        // Debit COGS
        {
          account_id: cogsAccount.id,
          description: `COGS for ${sale.sale_number}`,
          debit_amount: totalCOGS,
          credit_amount: 0
        },
        // Credit Inventory
        {
          account_id: inventoryAccount.id,
          description: `Inventory reduction for ${sale.sale_number}`,
          debit_amount: 0,
          credit_amount: totalCOGS
        }
      ];

      // Create the journal entry (request posted)
      const created = await AccountingService.createJournalEntry({
        entry_date: sale.sale_date,
        description: `Sale ${sale.sale_number} - ${saleData.notes || 'POS Sale'}`,
        reference: sale.sale_number,
        lines: journalLines,
        is_posted: true
      });

      if (created && !created.is_posted) {
        await AccountingService.postJournalEntry(created.id);
      }

      console.log(`Journal entry created for sale ${sale.sale_number}`);
    } catch (error) {
      console.error('Error creating journal entry for sale:', error);
      // Don't throw error - sale should still succeed even if journal entry fails
    }
  }
}