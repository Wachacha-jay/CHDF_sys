import { ApiService } from './api';
import { Product } from '../types';
import { AccountingService } from './accountingService';
import { FundAccountingService } from './fundAccountingService';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  category?: 'inkind' | 'stock' | 'donation' | 'invoice' | 'purchase' | 'journal' | 'sponsorship';
  timestamp: string;
  link?: string;
}

export class NotificationService {
  static async getNotifications(): Promise<Notification[]> {
    const notifications: Notification[] = [];
    const now = new Date().toISOString();

    try {
      // 1. Fetch all active products once to analyze both in-kind and commercial inventory
      const productsResp = await ApiService.get<Product>('products', {
        filters: { is_active: true },
        orderBy: { column: 'current_stock', ascending: true }
      });

      if (productsResp.success && productsResp.data) {
        const products = productsResp.data;

        // 1a. In-Kind Donations: Low Stock and Out of Stock Alerts
        const inKindProducts = products.filter(p => !!p.is_in_kind);
        inKindProducts.forEach(product => {
          const currentStock = Number(product.current_stock || 0);
          const minStock = Number(product.minimum_stock || 5);

          if (currentStock === 0) {
            notifications.push({
              id: `inkind-out-${product.id}`,
              title: 'In-Kind Out of Stock',
              message: `Donated item "${product.name}" is completely depleted (0 units).`,
              type: 'error',
              category: 'inkind',
              timestamp: now,
              link: '/inventory'
            });
          } else if (currentStock <= minStock) {
            notifications.push({
              id: `inkind-low-${product.id}`,
              title: 'In-Kind Low Stock',
              message: `Donated item "${product.name}" is low: ${currentStock} remaining (minimum threshold: ${minStock}).`,
              type: 'warning',
              category: 'inkind',
              timestamp: now,
              link: '/inventory'
            });
          }
        });

        // 1b. Commercial Products: Low Stock and Out of Stock Alerts
        const commercialProducts = products.filter(p => !p.is_in_kind);
        commercialProducts.forEach(product => {
          const currentStock = Number(product.current_stock || 0);
          const minStock = Number(product.minimum_stock || 5);

          if (currentStock === 0) {
            notifications.push({
              id: `stock-out-${product.id}`,
              title: 'Product Out of Stock',
              message: `Commercial item "${product.name}" is out of stock (0 units).`,
              type: 'error',
              category: 'stock',
              timestamp: now,
              link: '/inventory'
            });
          } else if (currentStock <= minStock) {
            notifications.push({
              id: `stock-low-${product.id}`,
              title: 'Low Stock Alert',
              message: `"${product.name}" is running low: ${currentStock} units left (threshold: ${minStock}).`,
              type: 'warning',
              category: 'stock',
              timestamp: now,
              link: '/inventory'
            });
          }
        });
      }

      // 2. Unposted Donations awaiting General Ledger posting
      try {
        const donationsResp = await ApiService.get<any>('donations', {
          filters: { is_posted: false }
        });
        if (donationsResp.success && donationsResp.data && donationsResp.data.length > 0) {
          const count = donationsResp.data.length;
          notifications.push({
            id: 'donations-unposted',
            title: 'Unposted Donations',
            message: `${count} donation(s) received but not yet posted to the General Ledger.`,
            type: 'warning',
            category: 'donation',
            timestamp: now,
            link: '/fund-accounting/donations'
          });
        }
      } catch (e) {
        console.error('Error fetching unposted donations:', e);
      }

      // 3. Unposted Journal Entries in Accounting
      try {
        const unpostedEntries = await AccountingService.getJournalEntries({ is_posted: false });
        if (unpostedEntries.length > 0) {
          notifications.push({
            id: 'accounting-unposted',
            title: 'Unposted Journals',
            message: `${unpostedEntries.length} unposted journal entries requiring review.`,
            type: 'warning',
            category: 'journal',
            timestamp: now,
            link: '/accounting/journal'
          });
        }
      } catch (e) {
        console.error('Error fetching unposted journals:', e);
      }

      // 4. Pending Supplier Purchase Invoices (Accounts Payable)
      try {
        const purchasesResp = await ApiService.get<any>('purchases', {
          filters: { payment_status: 'pending' }
        });
        if (purchasesResp.success && purchasesResp.data && purchasesResp.data.length > 0) {
          const count = purchasesResp.data.length;
          notifications.push({
            id: 'purchases-pending',
            title: 'Pending Supplier Bills',
            message: `${count} supplier purchase bill(s) awaiting payment disbursement.`,
            type: 'info',
            category: 'purchase',
            timestamp: now,
            link: '/purchases'
          });
        }
      } catch (e) {
        console.error('Error fetching pending purchases:', e);
      }

      // 5. Pending Customer Invoices / Unpaid Credit Sales
      try {
        const salesResp = await ApiService.get<any>('sales', {
          filters: { payment_status: 'pending', payment_method: 'credit' }
        });
        if (salesResp.success && salesResp.data && salesResp.data.length > 0) {
          const count = salesResp.data.length;
          notifications.push({
            id: 'sales-pending-credit',
            title: 'Unpaid Customer Invoices',
            message: `${count} credit sale invoice(s) pending payment collection.`,
            type: 'info',
            category: 'invoice',
            timestamp: now,
            link: '/invoices'
          });
        }
      } catch (e) {
        console.error('Error fetching pending credit sales:', e);
      }

      // 6. NGO Sponsorship Gap (Children without sponsors)
      try {
        const children = await FundAccountingService.getChildren();
        const unsponsored = children.filter(c => !c.sponsorship_status || c.sponsorship_status === 'none');
        if (unsponsored.length > 0) {
          notifications.push({
            id: 'ngo-unsponsored',
            title: 'Sponsorship Gap',
            message: `${unsponsored.length} child(ren) currently without sponsors.`,
            type: unsponsored.length > 5 ? 'warning' : 'info',
            category: 'sponsorship',
            timestamp: now,
            link: '/fund-accounting/children'
          });
        }
      } catch (e) {
        console.error('Error fetching unsponsored children:', e);
      }

      // 7. Active Sponsorships Reminder
      try {
        const sponsorships = await FundAccountingService.getSponsorships();
        const activeSponsorships = sponsorships.filter(s => s.status === 'active');
        if (activeSponsorships.length > 0) {
          notifications.push({
            id: 'ngo-billing',
            title: 'Active Sponsorships',
            message: `${activeSponsorships.length} active sponsorships in progress.`,
            type: 'info',
            category: 'sponsorship',
            timestamp: now,
            link: '/fund-accounting/billing'
          });
        }
      } catch (e) {
        console.error('Error fetching sponsorships:', e);
      }

    } catch (error) {
      console.error('Error fetching notifications:', error);
    }

    // Sort: errors first, then warnings, then info, then by timestamp descending
    const priorityWeight: Record<string, number> = {
      error: 3,
      warning: 2,
      info: 1,
      success: 0
    };

    return notifications.sort((a, b) => {
      const pDiff = (priorityWeight[b.type] || 0) - (priorityWeight[a.type] || 0);
      if (pDiff !== 0) return pDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }
}
