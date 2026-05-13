import { ProductService } from './productService';
import { AccountingService } from './accountingService';
import { FundAccountingService } from './fundAccountingService';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  link?: string;
}

export class NotificationService {
  static async getNotifications(): Promise<Notification[]> {
    const notifications: Notification[] = [];
    
    try {
      // 1. Low Stock Alerts
      const lowStock = await ProductService.getLowStockProducts();
      lowStock.forEach(product => {
        notifications.push({
          id: `stock-${product.id}`,
          title: 'Low Stock Alert',
          message: `${product.name} is low on stock (${product.current_stock} remaining)`,
          type: 'warning',
          timestamp: new Date().toISOString(),
          link: '/inventory'
        });
      });

      // 2. Unposted Journal Entries
      const unpostedEntries = await AccountingService.getJournalEntries({ is_posted: false });
      if (unpostedEntries.length > 0) {
        notifications.push({
          id: 'accounting-unposted',
          title: 'Unposted Journals',
          message: `There are ${unpostedEntries.length} unposted journal entries requiring review.`,
          type: 'info',
          timestamp: new Date().toISOString(),
          link: '/accounting/journal'
        });
      }

      // 3. NGO - Pending Invoices/Billing
      // Fetch sponsorships that might need billing soon or have issues
      const sponsorships = await FundAccountingService.getSponsorships();
      const activeSponsorships = sponsorships.filter(s => s.status === 'active');
      // Simple logic: If we have active sponsorships, remind user to check billing
      if (activeSponsorships.length > 0) {
          notifications.push({
              id: 'ngo-billing',
              title: 'NGO Billing Reminder',
              message: `You have ${activeSponsorships.length} active sponsorships to manage in the Billing Center.`,
              type: 'info',
              timestamp: new Date().toISOString(),
              link: '/fund-accounting/billing'
          });
      }

      // 4. NGO - Children without Sponsors (Critical Alert)
      const children = await FundAccountingService.getChildren();
      const unsponsored = children.filter(c => !c.sponsorship_status || c.sponsorship_status === 'none');
      if (unsponsored.length > 5) {
          notifications.push({
              id: 'ngo-unsponsored',
              title: 'Sponsorship Gap',
              message: `${unsponsored.length} children are currently without sponsors.`,
              type: 'warning',
              timestamp: new Date().toISOString(),
              link: '/fund-accounting/children'
          });
      }

    } catch (error) {
      console.error('Error fetching notifications:', error);
    }

    return notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}
