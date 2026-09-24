import { ApiService } from './api';
import { 
  Department, 
  Donor, 
  DonorCluster,
  Child, 
  FundAccount, 
  Donation, 
  DonationItem,
  InternalTransfer, 
  Sponsor,
  JournalEntryLine,
  JournalEntry,
  Sponsorship,
  Account
} from '../types';
import { AccountingService } from './accountingService';
import { FixedAssetService } from './fixedAssetService';
import { ProductService } from './productService';

export class FundAccountingService {
  // Sponsorship Operations
  static async getSponsorships(): Promise<Sponsorship[]> {
    const response = await ApiService.get<Sponsorship>('sponsorships');
    return response.success ? (response.data || []) : [];
  }

  // Department Operations
  static async getDepartments(): Promise<Department[]> {
    const response = await ApiService.get<Department>('departments', {
      orderBy: { column: 'name', ascending: true }
    });
    return response.success ? (response.data || []) : [];
  }

  static async createDepartment(data: Partial<Department>): Promise<Department | null> {
    const response = await ApiService.create<Department>('departments', data);
    return response.success ? response.data : null;
  }

  static async updateDepartment(id: string, data: Partial<Department>): Promise<boolean> {
    const response = await ApiService.update('departments', id, data);
    return response.success;
  }

  static async deleteDepartment(id: string): Promise<boolean> {
    const response = await ApiService.delete('departments', id);
    return response.success;
  }

  // Donor Cluster Operations
  static async getDonorClusters(): Promise<DonorCluster[]> {
    const response = await ApiService.get<DonorCluster>('donor_clusters', {
      orderBy: { column: 'name', ascending: true }
    });
    return response.success ? (response.data || []) : [];
  }

  static async createDonorCluster(data: Partial<DonorCluster>): Promise<DonorCluster | null> {
    const response = await ApiService.create<DonorCluster>('donor_clusters', data);
    return response.success ? response.data : null;
  }

  static async updateDonorCluster(id: string, data: Partial<DonorCluster>): Promise<boolean> {
    const response = await ApiService.update('donor_clusters', id, data);
    return response.success;
  }

  static async deleteDonorCluster(id: string): Promise<boolean> {
    const response = await ApiService.delete('donor_clusters', id);
    return response.success;
  }

  // Donor Operations
  static async getDonors(): Promise<Donor[]> {
    const response = await ApiService.get<Donor>('donors', {
      orderBy: { column: 'name', ascending: true }
    });
    return response.success ? (response.data || []) : [];
  }

  static async createDonor(data: Partial<Donor>): Promise<Donor | null> {
    const response = await ApiService.create<Donor>('donors', data);
    return response.success ? response.data : null;
  }

  // Child Operations
  static async getChildren(): Promise<Child[]> {
    const response = await ApiService.get<Child>('children', {
      orderBy: { column: 'first_name', ascending: true }
    });
    return response.success ? (response.data || []) : [];
  }

  static async createChild(data: Partial<Child>): Promise<Child | null> {
    const response = await ApiService.create<Child>('children', data);
    return response.success ? response.data : null;
  }

  static async updateChild(id: string, data: Partial<Child>): Promise<Child | null> {
    const response = await ApiService.update<Child>('children', id, {
      ...data,
      updated_at: new Date().toISOString()
    });
    return response.success ? response.data : null;
  }

  static async deleteChild(id: string): Promise<boolean> {
    const response = await ApiService.delete('children', id);
    return response.success;
  }

  // Guardian Operations
  static async getGuardians(): Promise<Guardian[]> {
    const response = await ApiService.get<Guardian>('guardians', {
      orderBy: { column: 'name', ascending: true }
    });
    return response.success ? (response.data || []) : [];
  }

  static async createGuardian(data: Partial<Guardian>): Promise<Guardian | null> {
    const response = await ApiService.post<Guardian>('guardians', data);
    return response.success ? response.data : null;
  }

  static async getNextChildCode(): Promise<string> {
    const children = await this.getChildren();
    if (children.length === 0) return 'CHD-001';

    // Find the highest number in existing codes
    const codes = children
      .map(c => {
        const match = c.code.match(/CHD-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);

    const maxCode = codes.length > 0 ? Math.max(...codes) : 0;
    const nextNumber = maxCode + 1;
    return `CHD-${nextNumber.toString().padStart(3, '0')}`;
  }

  // Fund Account Operations
  static async getFundAccounts(): Promise<FundAccount[]> {
    const response = await ApiService.get<FundAccount>('fund_accounts', {
      orderBy: { column: 'code', ascending: true }
    });
    return response.success ? (response.data || []) : [];
  }

  static async createFundAccount(data: Partial<FundAccount>): Promise<FundAccount | null> {
    const response = await ApiService.create<FundAccount>('fund_accounts', data);
    return response.success ? response.data : null;
  }

  static async updateFundAccount(id: string, data: Partial<FundAccount>): Promise<boolean> {
    const response = await ApiService.update('fund_accounts', id, data);
    return response.success;
  }

  static async deleteFundAccount(id: string): Promise<boolean> {
    const response = await ApiService.delete('fund_accounts', id);
    return response.success;
  }

  // Donation Operations
  static async getDonationItems(donationId: string): Promise<DonationItem[]> {
    try {
      const response = await ApiService.get<DonationItem>('donation_items', {
        filters: { donation_id: donationId }
      });
      return response.success && response.data ? response.data : [];
    } catch (err) {
      console.error('Failed to get donation items:', err);
      return [];
    }
  }

  static async recordDonation(donation: Partial<Donation>): Promise<Donation | null> {
    const { items, ...donationData } = donation;
    
    // If in-kind items provided, compute total fair market value
    let totalFMV = Number(donationData.amount || 0);
    if (items && items.length > 0) {
      totalFMV = items.reduce((sum, it) => sum + Number(it.fair_market_value || 0), 0);
    }

    const payload: any = {
      ...donationData,
      amount: totalFMV,
      total_fair_market_value: totalFMV,
      is_in_kind: donation.is_in_kind ? 1 : 0,
      is_posted: false
    };

    const response = await ApiService.create<Donation>('donations', payload);
    if (response.success && response.data) {
      const savedDonation = response.data;
      if (items && items.length > 0) {
        for (const item of items) {
          let linkedProductId = item.product_id || null;

          // If this is a consumable in-kind item, ensure it's added to inventory
          if (item.asset_class === 'consumable') {
            const qty = Number(item.quantity || 1);
            const lineFMV = Number(item.fair_market_value || 0);
            const unitCost = qty > 0 ? (lineFMV / qty) : lineFMV;

            if (linkedProductId) {
              // Existing product linked -> increment its stock
              try {
                await ProductService.updateStock(linkedProductId, qty, 'in');
                await ApiService.create('inventory_movements', {
                  product_id: linkedProductId,
                  movement_type: 'in',
                  quantity: qty,
                  unit_cost: unitCost,
                  reference_type: 'donation',
                  reference_id: savedDonation.id,
                  description: `In-Kind Donation: ${item.item_description}`
                });
              } catch (stockErr) {
                console.warn('Failed to update stock for linked product:', stockErr);
              }
            } else if (item.item_description && item.item_description.trim()) {
              // No product was selected: Auto-create in-kind product in inventory
              try {
                const newProduct = await ProductService.createProduct({
                  name: item.item_description.trim(),
                  is_in_kind: true,
                  cost_price: unitCost,
                  selling_price: 0,
                  current_stock: qty,
                  minimum_stock: 0,
                  unit_of_measure: item.unit_of_measure || 'pcs',
                  is_active: true,
                  is_service: false,
                  description: `In-Kind Donated Consumable (${savedDonation.donation_date || new Date().toISOString().split('T')[0]})`
                });
                if (newProduct) {
                  linkedProductId = newProduct.id;
                  try {
                    await ApiService.create('inventory_movements', {
                      product_id: newProduct.id,
                      movement_type: 'in',
                      quantity: qty,
                      unit_cost: unitCost,
                      reference_type: 'donation',
                      reference_id: savedDonation.id,
                      description: `In-Kind Donation initial stock: ${item.item_description}`
                    });
                  } catch (_) {}
                }
              } catch (prodErr) {
                console.warn('Failed to auto-create in-kind product in inventory:', prodErr);
              }
            }
          }

          await ApiService.create('donation_items', {
            donation_id: savedDonation.id,
            item_description: item.item_description,
            asset_class: item.asset_class,
            fair_market_value: Number(item.fair_market_value || 0),
            quantity: Number(item.quantity || 1),
            unit_of_measure: item.unit_of_measure || 'units',
            product_id: linkedProductId,
            department_id: item.department_id || null,
            fixed_asset_id: item.fixed_asset_id || null,
            project_name: item.project_name || null,
            notes: item.notes || null
          });
        }
      }
      return savedDonation;
    }
    return null;
  }

  static async postDonationToGL(donation: Donation): Promise<{ success: boolean; error?: string }> {
    try {
      const entry = await this.postDonationToLedger(donation);
      if (entry) {
        await ApiService.update('donations', donation.id, { is_posted: true });
        return { success: true };
      }
      return { success: false, error: 'Could not create journal entry. Please verify Chart of Accounts.' };
    } catch (error: any) {
      console.error('Error in postDonationToGL:', error);
      return { success: false, error: error.message || 'Failed to post donation to General Ledger.' };
    }
  }

  static async updateDonation(id: string, donation: Partial<Donation>): Promise<boolean> {
    const { items, ...donationData } = donation;
    
    let totalFMV = Number(donationData.amount || 0);
    if (items && items.length > 0) {
      totalFMV = items.reduce((sum, it) => sum + Number(it.fair_market_value || 0), 0);
    }

    const payload: any = {
      ...donationData,
      amount: totalFMV,
      total_fair_market_value: totalFMV
    };
    if (donation.is_in_kind !== undefined) {
      payload.is_in_kind = donation.is_in_kind ? 1 : 0;
    }

    const response = await ApiService.update<Donation>('donations', id, payload);
    if (response.success) {
      if (items !== undefined) {
        try {
          const existingItems = await this.getDonationItems(id);
          for (const ex of existingItems) {
            if (ex.id) await ApiService.delete('donation_items', ex.id);
          }
          for (const item of items) {
            await ApiService.create('donation_items', {
              donation_id: id,
              item_description: item.item_description,
              asset_class: item.asset_class,
              fair_market_value: Number(item.fair_market_value || 0),
              quantity: Number(item.quantity || 1),
              unit_of_measure: item.unit_of_measure || 'units',
              product_id: item.product_id || null,
              department_id: item.department_id || null,
              fixed_asset_id: item.fixed_asset_id || null,
              project_name: item.project_name || null,
              notes: item.notes || null
            });
          }
        } catch (itemErr) {
          console.error('Failed to sync donation items during update:', itemErr);
        }
      }

      if (response.data && response.data.is_posted) {
        try {
          await this.postDonationToLedger(response.data);
        } catch (err) {
          console.error('Failed to re-post updated donation to ledger:', err);
        }
      }
      return true;
    }
    return false;
  }

  static async deleteDonation(id: string): Promise<boolean> {
    const response = await ApiService.delete('donations', id);
    return response.success;
  }

  private static async postDonationToLedger(donation: Donation): Promise<any> {
    const accounts = await AccountingService.getAccounts();
    const allFlatAccounts = AccountingService.flattenAccounts(accounts);
    const findAccount = (code: string) => allFlatAccounts.find(a => a.code === code);

    // Build human-readable donor label & restriction note for General Ledger
    let donorName = 'General Donor';
    if (donation.is_anonymous) {
      donorName = 'Anonymous Donor';
    } else if (donation.donor_id) {
      try {
        const donors = await this.getDonors();
        const matchedDonor = donors.find(d => d.id === donation.donor_id);
        if (matchedDonor) donorName = matchedDonor.name;
      } catch (e) {
        console.warn('Could not fetch donor name for GL description:', e);
      }
    }

    let restrictionNote = ' [Unrestricted]';
    if (donation.restricted_to_child_id) {
      try {
        const childrenList = await this.getChildren();
        const matchedChild = childrenList.find(c => c.id === donation.restricted_to_child_id);
        restrictionNote = matchedChild 
          ? ` [Child: ${matchedChild.first_name} ${matchedChild.last_name}]`
          : ` [Child-Restricted]`;
      } catch (e) {
        restrictionNote = ' [Child-Restricted]';
      }
    } else if (donation.fund_id) {
      try {
        const fundAccounts = await this.getFundAccounts();
        const matchedFund = fundAccounts.find(f => f.id === donation.fund_id);
        restrictionNote = matchedFund 
          ? ` [Fund: ${matchedFund.name}]` 
          : ` [Fund-Restricted]`;
      } catch (e) {
        restrictionNote = ' [Fund-Restricted]';
      }
    }

    const entryDate = donation.donation_date 
      ? new Date(donation.donation_date).toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0];

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 1: IN-KIND MULTI-CLASS DONATION ROUTING
    // ─────────────────────────────────────────────────────────────────────────
    if (donation.is_in_kind) {
      // 1. In-Kind Revenue Account
      const inKindRevenueAccount = findAccount('4260') || 
        findAccount('4200') || 
        allFlatAccounts.find(a => a.account_type === 'revenue' && a.code?.startsWith('4'));

      if (!inKindRevenueAccount) {
        throw new Error('In-Kind Donation Revenue account (Code 4260) not found in Chart of Accounts.');
      }

      // 2. Destination Asset Accounts
      const inKindInventoryAccount = findAccount('1135') || findAccount('1130') || allFlatAccounts.find(a => a.account_type === 'asset' && a.code?.startsWith('11'));
      const equipmentAccount = findAccount('1210') || findAccount('1200') || allFlatAccounts.find(a => a.account_type === 'asset' && a.code?.startsWith('12'));
      const buildingAccount = findAccount('1230') || findAccount('1200') || equipmentAccount;

      if (!inKindInventoryAccount || !equipmentAccount || !buildingAccount) {
        throw new Error('Required Asset accounts (1135 In-Kind Inventory, 1210 Equipment, 1230 Buildings) not found in Chart of Accounts.');
      }

      // Fetch items if not already on the donation object
      const items = (donation.items && donation.items.length > 0)
        ? donation.items 
        : await this.getDonationItems(donation.id);

      if (items.length === 0) {
        throw new Error('In-Kind donation contains no line items to post.');
      }

      const lines: any[] = [];
      let totalFMV = 0;

      for (const item of items) {
        const lineVal = Number(item.fair_market_value || 0);
        totalFMV += lineVal;

        if (item.asset_class === 'consumable') {
          // A. Consumable Inventory: Debit 1135 In-Kind Inventory
          lines.push({
            account_id: inKindInventoryAccount.id,
            description: `In-Kind Consumable: ${item.item_description} (${item.quantity} ${item.unit_of_measure || 'units'})`,
            debit_amount: lineVal,
            credit_amount: 0,
            donor_id: donation.donor_id || undefined,
            fund_id: donation.fund_id || undefined,
            child_id: donation.restricted_to_child_id || undefined
          });

          // Increment Product Inventory Stock (only if not already credited during recordDonation)
          if (item.product_id) {
            try {
              const movementsRes = await ApiService.get<any>('inventory_movements', {
                filters: { reference_id: donation.id, product_id: item.product_id }
              });
              if (!movementsRes.success || !movementsRes.data || movementsRes.data.length === 0) {
                await ProductService.updateStock(item.product_id, Number(item.quantity || 1), 'in');
              }
            } catch (stockErr) {
              console.warn(`Failed to verify or update stock for product ${item.product_id}:`, stockErr);
            }
          }

        } else if (item.asset_class === 'fixed_asset') {
          // B. Fixed Asset (Equipment, Furniture, Vehicles, Tech)
          const descLower = (item.item_description || '').toLowerCase();
          let targetAccount = equipmentAccount;
          let assetType = 'Equipment & Machinery';
          let usefulLife = 5;

          if (descLower.includes('vehicle') || descLower.includes('car') || descLower.includes('motor') || descLower.includes('van')) {
            targetAccount = findAccount('1240') || equipmentAccount;
            assetType = 'Vehicles';
            usefulLife = 7;
          } else if (descLower.includes('furniture') || descLower.includes('desk') || descLower.includes('chair') || descLower.includes('table')) {
            targetAccount = findAccount('1220') || equipmentAccount;
            assetType = 'Furniture & Fixtures';
            usefulLife = 8;
          } else if (descLower.includes('computer') || descLower.includes('laptop') || descLower.includes('server') || descLower.includes('printer')) {
            targetAccount = findAccount('1250') || findAccount('1210') || equipmentAccount;
            assetType = 'Computer & Technology';
            usefulLife = 4;
          }

          lines.push({
            account_id: targetAccount.id,
            description: `In-Kind ${assetType}: ${item.item_description}`,
            debit_amount: lineVal,
            credit_amount: 0,
            department_id: item.department_id || donation.department_id || undefined,
            donor_id: donation.donor_id || undefined,
            fund_id: donation.fund_id || undefined
          });

          // Log in Fixed Asset Register & link ID
          try {
            const created = await FixedAssetService.create({
              asset_name: item.item_description,
              description: `In-Kind donation from ${donorName}. ${item.notes || ''}`.trim(),
              asset_type: assetType,
              purchase_date: entryDate,
              purchase_cost: lineVal,
              current_value: lineVal,
              salvage_value: 0,
              useful_life_years: usefulLife,
              department_id: item.department_id || donation.department_id || undefined,
              status: 'Active'
            });
            if (created?.id && item.id) {
              await ApiService.update('donation_items', item.id, { fixed_asset_id: created.id });
            }
          } catch (assetErr) {
            console.warn('Failed to auto-register fixed asset:', assetErr);
          }

        } else if (item.asset_class === 'construction') {
          // C. Construction / Infrastructure: Debit 1230 Buildings & Infrastructure
          lines.push({
            account_id: buildingAccount.id,
            description: `In-Kind Infrastructure: ${item.item_description}${item.project_name ? ` (${item.project_name})` : ''}`,
            debit_amount: lineVal,
            credit_amount: 0,
            department_id: item.department_id || donation.department_id || undefined,
            donor_id: donation.donor_id || undefined,
            fund_id: donation.fund_id || undefined
          });

          // Log in Fixed Asset Register under Buildings & Infrastructure & link ID
          try {
            const created = await FixedAssetService.create({
              asset_name: `${item.item_description}${item.project_name ? ` - ${item.project_name}` : ''}`,
              description: `In-Kind construction/materials for ${item.project_name || 'infrastructure project'} from ${donorName}. ${item.notes || ''}`.trim(),
              asset_type: 'Buildings & Infrastructure',
              purchase_date: entryDate,
              purchase_cost: lineVal,
              current_value: lineVal,
              salvage_value: 0,
              useful_life_years: 25,
              department_id: item.department_id || donation.department_id || undefined,
              status: 'Active'
            });
            if (created?.id && item.id) {
              await ApiService.update('donation_items', item.id, { fixed_asset_id: created.id });
            }
          } catch (assetErr) {
            console.warn('Failed to auto-register construction fixed asset:', assetErr);
          }
        }
      }

      // Credit: In-Kind Donation Revenue
      lines.push({
        account_id: inKindRevenueAccount.id,
        description: `In-Kind Donation Revenue recognised: ${donorName}${restrictionNote}`,
        debit_amount: 0,
        credit_amount: totalFMV,
        donor_id: donation.donor_id || undefined,
        fund_id: donation.fund_id || undefined,
        child_id: donation.restricted_to_child_id || undefined,
        department_id: donation.department_id || undefined
      });

      const entry = await AccountingService.createJournalEntry({
        entry_date: entryDate,
        description: `In-Kind Donation: ${donorName}${restrictionNote}${donation.notes ? ' — ' + donation.notes : ''}`,
        reference: donation.reference_number || undefined,
        is_posted: true,
        lines
      });

      if (!entry) {
        throw new Error('Journal Entry creation returned null.');
      }
      return entry;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 2: STANDARD MONETARY (CASH / BANK / M-PESA) DONATION ROUTING
    // ─────────────────────────────────────────────────────────────────────────
    let donationRevenueAccount = null;
    if (donation.restricted_to_child_id) {
      donationRevenueAccount = findAccount('4240') || findAccount('4220') || findAccount('4200');
    } else if (donation.fund_id) {
      donationRevenueAccount = findAccount('4220') || findAccount('4200');
    } else {
      donationRevenueAccount = findAccount('4210') || findAccount('4200');
    }

    if (!donationRevenueAccount) {
      donationRevenueAccount = findAccount('4200') || 
        findAccount('4000') || 
        findAccount('4100') || 
        allFlatAccounts.find(a => a.account_type === 'revenue' || a.code?.startsWith('4'));
    }

    if (!donationRevenueAccount) {
      throw new Error('No Revenue account found in Chart of Accounts. Please create a Revenue account (e.g. Code 4200 Donation Revenue).');
    }

    const cashAccount = findAccount('1110') || findAccount('1000') || allFlatAccounts.find(a => a.account_type === 'asset' && (a.code?.startsWith('11') || a.code?.startsWith('10')));
    const mpesaAccount = findAccount('1111') || cashAccount;

    let debitAccount = null;
    if (donation.payment_account_id) {
      debitAccount = allFlatAccounts.find(a => a.id === donation.payment_account_id);
    }
    if (!debitAccount) {
      if (donation.payment_method === 'mpesa' || donation.payment_method === 'bank' || donation.payment_method === 'cheque') {
        debitAccount = mpesaAccount || cashAccount;
      } else {
        debitAccount = cashAccount;
      }
    }
    if (!debitAccount) {
      debitAccount = allFlatAccounts.find(a => a.account_type === 'asset' || a.code?.startsWith('1'));
    }

    if (!debitAccount) {
      throw new Error('No Cash or Bank asset account found in Chart of Accounts. Please create an Asset account (e.g. Code 1110 Cash or 1111 Bank).');
    }

    const amt = Number(donation.amount || 0);

    const entry = await AccountingService.createJournalEntry({
      entry_date: entryDate,
      description: `Donation: ${donorName}${restrictionNote}${donation.notes ? ' — ' + donation.notes : ''}`,
      reference: donation.reference_number || undefined,
      is_posted: true,
      lines: [
        // DR: Asset (Cash/Bank)
        {
          account_id: debitAccount.id,
          description: `Donation received via ${donation.payment_method || 'bank'}`,
          debit_amount: amt,
          credit_amount: 0,
          donor_id: donation.donor_id || undefined,
          fund_id: donation.fund_id || undefined,
          department_id: donation.department_id || undefined,
          child_id: donation.restricted_to_child_id || undefined
        },
        // CR: NGO Donation Revenue (4200 / 4210 / 4220 / 4240)
        {
          account_id: donationRevenueAccount.id,
          description: `Donation revenue recognised${restrictionNote}`,
          debit_amount: 0,
          credit_amount: amt,
          donor_id: donation.donor_id || undefined,
          fund_id: donation.fund_id || undefined,
          department_id: donation.department_id || undefined,
          child_id: donation.restricted_to_child_id || undefined
        }
      ]
    });

    if (!entry) {
      throw new Error('Journal Entry creation returned null.');
    }
    return entry;
  }

  // Internal Transfers & Loans
  static async recordTransfer(transfer: Partial<InternalTransfer>): Promise<InternalTransfer | null> {
    const payload = { status: 'pending', ...transfer };
    const response = await ApiService.create<InternalTransfer>('internal_transfers', payload);
    return response.success ? response.data : null;
  }

  static async updateTransfer(id: string, transfer: Partial<InternalTransfer>): Promise<InternalTransfer | null> {
    const response = await ApiService.update<InternalTransfer>('internal_transfers', id, transfer);
    return response.success ? response.data : null;
  }

  static async deleteTransfer(id: string): Promise<boolean> {
    const response = await ApiService.delete('internal_transfers', id);
    return response.success;
  }

  static async approveTransfer(transferId: string, approverId: string): Promise<{ success: boolean; error?: string }> {
    const response = await ApiService.update<InternalTransfer>('internal_transfers', transferId, {
        status: 'approved',
        approved_by: approverId
    });

    if (!response.success || !response.data) {
        return { success: false, error: 'Failed to update transfer status.' };
    }

    try {
        await this.postTransferToLedger(response.data);
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message || 'GL posting failed. Transfer status updated but not posted to ledger.' };
    }
  }

  private static async postTransferToLedger(transfer: InternalTransfer): Promise<void> {
    const [accounts, departments] = await Promise.all([
        AccountingService.getAccounts(),
        FundAccountingService.getDepartments()
    ]);

    const flattenAccounts = (accs: any[]): any[] =>
        accs.reduce((prev, curr) =>
            prev.concat(curr).concat(curr.children ? flattenAccounts(curr.children) : [])
        , []);
    const flat = flattenAccounts(accounts);
    const findAccount = (code: string) => flat.find(a => a.code === code);

    // Resolve human-readable department names
    const deptName = (id: string | undefined) => {
        if (!id) return 'Unknown';
        const dept = departments.find(d => d.id === id);
        return dept ? dept.name : id;
    };

    // Primary lookup; fallback to regex-matched accounts if migration 013 hasn't been run
    const defaultBankAccount =
        findAccount('1111') || findAccount('1110') || flat.find(a => a.account_type === 'asset');

    const interDeptReceivable =
        findAccount('1300') ||
        flat.find(a => /receivable|due.from/i.test(a.name) && a.account_type === 'asset');

    const interDeptPayable =
        findAccount('2300') ||
        flat.find(a => /payable|due.to/i.test(a.name) && a.account_type === 'liability');

    const transferIn =
        findAccount('4900') ||
        flat.find(a => /transfer.in|inter.?dept.+revenue/i.test(a.name));

    const transferOut =
        findAccount('5900') ||
        flat.find(a => /transfer.out|inter.?dept.+expense/i.test(a.name));

    const missing: string[] = [];
    if (!defaultBankAccount)  missing.push('Bank/Cash (1111 or 1110)');
    if (!interDeptReceivable) missing.push('Inter-Dept Receivable (1300)');
    if (!interDeptPayable)    missing.push('Inter-Dept Payable (2300)');
    if (!transferIn)          missing.push('Transfer In (4900)');
    if (!transferOut)         missing.push('Transfer Out (5900)');

    if (missing.length > 0) {
        throw new Error(
            `Required G/L accounts not found: ${missing.join(', ')}. ` +
            `Run migration 013_inter_departmental_accounting.sql to seed them.`
        );
    }

    // Resolve specific source and destination bank accounts if selected
    const sourceBank = (transfer.from_bank_account_id ? flat.find(a => a.id === transfer.from_bank_account_id) : null) || defaultBankAccount!;
    const destBank = (transfer.to_bank_account_id ? flat.find(a => a.id === transfer.to_bank_account_id) : null) || defaultBankAccount!;

    const fromName = deptName(transfer.from_department_id);
    const toName   = deptName(transfer.to_department_id);

    const lines: any[] = [];
    const type = transfer.transfer_type || 'direct_transfer';

    if (type === 'direct_transfer') {
        if (transfer.from_bank_account_id || transfer.to_bank_account_id) {
            // Source Dept: DR Transfer Out (5900), CR Source Bank
            lines.push(
                {
                    account_id: transferOut.id,
                    description: `Direct Transfer Out to ${toName}`,
                    debit_amount: transfer.amount,
                    credit_amount: 0,
                    department_id: transfer.from_department_id
                },
                {
                    account_id: sourceBank.id,
                    description: `Transfer payout from ${sourceBank.name} to ${toName}`,
                    debit_amount: 0,
                    credit_amount: transfer.amount,
                    department_id: transfer.from_department_id
                }
            );
            // Dest Dept: DR Dest Bank, CR Transfer In (4900)
            lines.push(
                {
                    account_id: destBank.id,
                    description: `Transfer received into ${destBank.name} from ${fromName}`,
                    debit_amount: transfer.amount,
                    credit_amount: 0,
                    department_id: transfer.to_department_id
                },
                {
                    account_id: transferIn.id,
                    description: `Direct Transfer In from ${fromName}`,
                    debit_amount: 0,
                    credit_amount: transfer.amount,
                    department_id: transfer.to_department_id
                }
            );
        } else {
            lines.push(
                {
                    account_id: transferOut.id,
                    description: `Direct Transfer Out → ${toName}`,
                    debit_amount: transfer.amount,
                    credit_amount: 0,
                    department_id: transfer.from_department_id
                },
                {
                    account_id: transferIn.id,
                    description: `Direct Transfer In ← ${fromName}`,
                    debit_amount: 0,
                    credit_amount: transfer.amount,
                    department_id: transfer.to_department_id
                }
            );
        }
    } else if (type === 'internal_loan') {
        // Lender Dept: DR Due-From (1300), CR Paying Bank
        lines.push(
            {
                account_id: interDeptReceivable.id,
                description: `Loan Receivable from ${toName}`,
                debit_amount: transfer.amount,
                credit_amount: 0,
                department_id: transfer.from_department_id
            },
            {
                account_id: sourceBank.id,
                description: `Funds disbursed from ${sourceBank.name} to ${toName}`,
                debit_amount: 0,
                credit_amount: transfer.amount,
                department_id: transfer.from_department_id
            }
        );
        // Borrower Dept: DR Receiving Bank, CR Due-To (2300)
        lines.push(
            {
                account_id: destBank.id,
                description: `Loan received in ${destBank.name} from ${fromName}`,
                debit_amount: transfer.amount,
                credit_amount: 0,
                department_id: transfer.to_department_id
            },
            {
                account_id: interDeptPayable.id,
                description: `Loan Payable to ${fromName}`,
                debit_amount: 0,
                credit_amount: transfer.amount,
                department_id: transfer.to_department_id
            }
        );
    } else if (type === 'loan_repayment') {
        // Repayer (Borrower) Dept: DR Due-To (2300), CR Paying Bank
        lines.push(
            {
                account_id: interDeptPayable.id,
                description: `Loan Repayment to ${toName}`,
                debit_amount: transfer.amount,
                credit_amount: 0,
                department_id: transfer.from_department_id
            },
            {
                account_id: sourceBank.id,
                description: `Repayment sent from ${sourceBank.name} to ${toName}`,
                debit_amount: 0,
                credit_amount: transfer.amount,
                department_id: transfer.from_department_id
            }
        );
        // Receiving (Lender) Dept: DR Receiving Bank, CR Due-From (1300)
        lines.push(
            {
                account_id: destBank.id,
                description: `Repayment received in ${destBank.name} from ${fromName}`,
                debit_amount: transfer.amount,
                credit_amount: 0,
                department_id: transfer.to_department_id
            },
            {
                account_id: interDeptReceivable.id,
                description: `Loan Receivable settled from ${fromName}`,
                debit_amount: 0,
                credit_amount: transfer.amount,
                department_id: transfer.to_department_id
            }
        );
    }

    await AccountingService.createJournalEntry({
      entry_date: transfer.transfer_date,
      description: `Interdepartmental ${type.replace(/_/g, ' ')} — ${fromName} → ${toName}: ${transfer.description}`,
      is_posted: true,
      lines: lines
    });
  }

  // Fund Balances (Calculated accurately from Ledger without self-cancelling asset counterpart)
  static async getFundBalance(fundId: string): Promise<number> {
    const [linesResponse, accounts] = await Promise.all([
      ApiService.get<JournalEntryLine>('journal_entry_lines', { filters: { fund_id: fundId } }),
      AccountingService.getAccounts()
    ]);
    const flatAccounts = AccountingService.flattenAccounts(accounts || []);
    const accountMap = new Map(flatAccounts.map(a => [a.id, a]));

    if (linesResponse.success && linesResponse.data) {
      return linesResponse.data.reduce((acc, line) => {
        const accObj = accountMap.get(line.account_id);
        const type = (accObj?.account_type || '').toLowerCase();
        const code = accObj?.code || '';

        let change = 0;
        if (type === 'revenue' || code.startsWith('4')) {
          change = Number(line.credit_amount || 0) - Number(line.debit_amount || 0);
        } else if (type === 'expense' || code.startsWith('5')) {
          change = -(Number(line.debit_amount || 0) - Number(line.credit_amount || 0));
        } else if (type === 'equity' || code.startsWith('3')) {
          change = Number(line.credit_amount || 0) - Number(line.debit_amount || 0);
        }
        return acc + change;
      }, 0);
    }
    return 0;
  }

  static async getFundBalances(): Promise<Map<string, number>> {
    const [linesResponse, accounts] = await Promise.all([
      ApiService.get<JournalEntryLine>('journal_entry_lines'),
      AccountingService.getAccounts()
    ]);
    const flatAccounts = AccountingService.flattenAccounts(accounts || []);
    const accountMap = new Map(flatAccounts.map(a => [a.id, a]));
    const balances = new Map<string, number>();

    if (linesResponse.success && linesResponse.data) {
      for (const line of linesResponse.data) {
        if (line.fund_id) {
          const current = balances.get(line.fund_id) || 0;
          const accObj = accountMap.get(line.account_id);
          const type = (accObj?.account_type || '').toLowerCase();
          const code = accObj?.code || '';

          let change = 0;
          if (type === 'revenue' || code.startsWith('4')) {
            change = Number(line.credit_amount || 0) - Number(line.debit_amount || 0);
          } else if (type === 'expense' || code.startsWith('5')) {
            change = -(Number(line.debit_amount || 0) - Number(line.credit_amount || 0));
          } else if (type === 'equity' || code.startsWith('3')) {
            change = Number(line.credit_amount || 0) - Number(line.debit_amount || 0);
          }
          balances.set(line.fund_id, current + change);
        }
      }
    }
    return balances;
  }

  static async getDepartmentBalances(): Promise<Map<string, number>> {
    const [linesResponse, accounts] = await Promise.all([
      ApiService.get<JournalEntryLine>('journal_entry_lines'),
      AccountingService.getAccounts()
    ]);
    const flatAccounts = AccountingService.flattenAccounts(accounts || []);
    const accountMap = new Map(flatAccounts.map(a => [a.id, a]));
    const balances = new Map<string, number>();

    if (linesResponse.success && linesResponse.data) {
      for (const line of linesResponse.data) {
        if (line.department_id) {
          const current = balances.get(line.department_id) || 0;
          const accObj = accountMap.get(line.account_id);
          const type = (accObj?.account_type || '').toLowerCase();
          const code = accObj?.code || '';

          let change = 0;
          if (type === 'revenue' || code.startsWith('4')) {
            change = Number(line.credit_amount || 0) - Number(line.debit_amount || 0);
          } else if (type === 'expense' || code.startsWith('5')) {
            change = -(Number(line.debit_amount || 0) - Number(line.credit_amount || 0));
          } else if (type === 'equity' || code.startsWith('3')) {
            change = Number(line.credit_amount || 0) - Number(line.debit_amount || 0);
          }
          balances.set(line.department_id, current + change);
        }
      }
    }
    return balances;
  }

  // Live Bank & Cash Asset Accounts Overview (Strict Double-Entry: Asset Balance = Debits - Credits)
  static async getBankAndCashBalances(): Promise<Array<{
    account: Account;
    balance: number;
    currency: string;
  }>> {
    const [linesResponse, accounts] = await Promise.all([
      ApiService.get<JournalEntryLine>('journal_entry_lines'),
      AccountingService.getAccounts()
    ]);
    const flatAccounts = AccountingService.flattenAccounts(accounts || []);
    
    // Liquid asset accounts (Cash, Bank, Mobile Money, Clearing)
    const bankKeywords = [
      'bank', 'cash', 'mpesa', 'm-pesa', 'till', 'paybill', 'float', 'wallet',
      'checking', 'savings', 'equity', 'kcb', 'coop', 'co-op', 'absa', 'stanbic',
      'petty cash', 'liquid'
    ];

    const isBankOrCash = (a: Account) => {
      const type = (a.account_type || '').toLowerCase();
      const code = a.code || '';
      const name = (a.name || '').toLowerCase();
      if (type !== 'asset' && !code.startsWith('1')) return false;
      if (code.startsWith('111') || code.startsWith('110') || code.startsWith('100') || code.startsWith('115')) return true;
      return bankKeywords.some(kw => name.includes(kw));
    };

    const liquidAccounts = flatAccounts.filter(isBankOrCash);

    // Calculate live balance: Normal balance for Asset accounts is DEBIT (Balance = Debits - Credits)
    const balanceMap = new Map<string, number>();
    if (linesResponse.success && linesResponse.data) {
      for (const line of linesResponse.data) {
        const current = balanceMap.get(line.account_id) || 0;
        const netChange = Number(line.debit_amount || 0) - Number(line.credit_amount || 0);
        balanceMap.set(line.account_id, current + netChange);
      }
    }

    return liquidAccounts.map(account => ({
      account,
      balance: balanceMap.get(account.id) || 0,
      currency: 'KES'
    }));
  }

  // Detailed Departmental Financial Summaries (Inflows, Expenditures, Net Balance adhering to Debits/Credits)
  static async getDepartmentFinancialSummaries(): Promise<Array<{
    department: Department;
    allocated: number;   // Revenue Inflows + Transfers In
    expenditures: number; // Expense Outflows + Transfers Out
    netBalance: number;   // Allocated - Expenditures
    budget: number;
  }>> {
    const [departments, linesResponse, accounts] = await Promise.all([
      this.getDepartments(),
      ApiService.get<JournalEntryLine>('journal_entry_lines'),
      AccountingService.getAccounts()
    ]);
    const flatAccounts = AccountingService.flattenAccounts(accounts || []);
    const accountMap = new Map(flatAccounts.map(a => [a.id, a]));

    const summaries = new Map<string, { allocated: number; expenditures: number }>();
    departments.forEach(d => summaries.set(d.id, { allocated: 0, expenditures: 0 }));

    if (linesResponse.success && linesResponse.data) {
      for (const line of linesResponse.data) {
        if (line.department_id && summaries.has(line.department_id)) {
          const sum = summaries.get(line.department_id)!;
          const acc = accountMap.get(line.account_id);
          const type = (acc?.account_type || '').toLowerCase();
          const code = acc?.code || '';

          // Revenue (4xxx) & Transfers In (4900): Credit increases recognized allocation, Debit decreases
          if (type === 'revenue' || code.startsWith('4')) {
            sum.allocated += (Number(line.credit_amount || 0) - Number(line.debit_amount || 0));
          }
          // Expense (5xxx) & Transfers Out (5900): Debit increases expenditure, Credit decreases
          else if (type === 'expense' || code.startsWith('5')) {
            sum.expenditures += (Number(line.debit_amount || 0) - Number(line.credit_amount || 0));
          }
        }
      }
    }

    return departments.map(d => {
      const s = summaries.get(d.id) || { allocated: 0, expenditures: 0 };
      const budget = (d as any).budget_limit || (d as any).annual_budget || 500000;
      return {
        department: d,
        allocated: s.allocated,
        expenditures: s.expenditures,
        netBalance: s.allocated - s.expenditures,
        budget
      };
    });
  }
}
