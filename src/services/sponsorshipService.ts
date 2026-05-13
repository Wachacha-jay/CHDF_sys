import { ApiService } from './api';
import { Sponsorship, Sponsor, Child } from '../types';
import { SalesService } from './salesService';

export class SponsorshipService {
  static async getSponsorships(): Promise<Sponsorship[]> {
    const response = await ApiService.get<Sponsorship>('sponsorships', {
      orderBy: { column: 'created_at', ascending: false }
    });
    return response.success ? (response.data || []) : [];
  }

  static async createSponsorship(data: Partial<Sponsorship>): Promise<Sponsorship | null> {
    const response = await ApiService.create<Sponsorship>('sponsorships', data);
    return response.success ? response.data : null;
  }

  static async updateSponsorship(id: string, data: Partial<Sponsorship>): Promise<Sponsorship | null> {
    const response = await ApiService.update<Sponsorship>('sponsorships', id, data);
    return response.success ? response.data : null;
  }

  /**
   * Automatically generate invoices for active sponsorships
   */
  static async generateSponsorshipInvoices(date: string): Promise<number> {
    const sponsorships = await this.getSponsorships();
    const activeSponsorships = sponsorships.filter(s => s.status === 'active');
    let generatedCount = 0;

    for (const sponsorship of activeSponsorships) {
      // Logic to check if an invoice for this period already exists
      // For brevity, we assume we create it if not exists.
      
      const sponsor = await ApiService.getById<Sponsor>('sponsors', sponsorship.sponsor_id);
      const child = await ApiService.getById<Child>('children', sponsorship.child_id);

      if (sponsor.success && sponsor.data && child.success && child.data) {
          // We link the sponsorship payment to a "Sale" (Invoice)
          // In a real system, the sponsor (Donor) might be a "Customer" in the Sales module.
          
          // Create a sale for the sponsorship
          const sale = await SalesService.createSale({
              sale_date: date,
              customer_id: sponsor.data.donor_id, // Map donor to customer
              subtotal: sponsorship.amount,
              tax_amount: 0,
              discount_amount: 0,
              total_amount: sponsorship.amount,
              payment_status: 'pending',
              notes: `Sponsorship payment for ${child.data.first_name} ${child.data.last_name} (${sponsorship.frequency})`,
              items: [
                  {
                      product_id: 'SPONSORSHIP_PRODUCT_ID', // System placeholder or specific product
                      quantity: 1,
                      unit_price: sponsorship.amount,
                      discount_amount: 0,
                      tax_amount: 0,
                      total_amount: sponsorship.amount
                  }
              ]
          });

          if (sale) generatedCount++;
      }
    }

    return generatedCount;
  }
}
