export interface Database {
  public: {
    Tables: {
      business_settings: {
        Row: {
          id: string;
          business_name: string;
          business_address: string | null;
          business_phone: string | null;
          business_email: string | null;
          business_website: string | null;
          logo_url: string | null;
          favicon_url: string | null;
          default_currency: string;
          tax_rate: number;
          receipt_prefix: string;
          invoice_prefix: string;
          product_code_prefix: string;
          customer_code_prefix: string;
          supplier_code_prefix: string;
          employee_code_prefix: string;
          fiscal_year_start: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['business_settings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['business_settings']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          parent_id: string | null;
          code: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      products: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          category_id: string | null;
          subcategory_id: string | null;
          unit_of_measure: string;
          cost_price: number;
          selling_price: number;
          current_stock: number;
          minimum_stock: number;
          maximum_stock: number | null;
          barcode: string | null;
          sku: string | null;
          image_url: string | null;
          is_active: boolean;
          is_service: boolean;
          tax_rate: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      customers: {
        Row: {
          id: string;
          code: string;
          name: string;
          email: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          country: string | null;
          tax_number: string | null;
          credit_limit: number;
          payment_terms: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      suppliers: {
        Row: {
          id: string;
          code: string;
          name: string;
          contact_person: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          country: string | null;
          tax_number: string | null;
          payment_terms: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['suppliers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>;
      };
      employees: {
        Row: {
          id: string;
          user_id: string | null;
          code: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          address: string | null;
          department: string | null;
          position: string | null;
          salary: number | null;
          hire_date: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['employees']['Insert']>;
      };
      account_categories: {
        Row: {
          id: string;
          name: string;
          account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['account_categories']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['account_categories']['Insert']>;
      };
      accounts: {
        Row: {
          id: string;
          code: string;
          name: string;
          account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          category_id: string | null;
          account_subtype: string | null;
          parent_id: string | null;
          is_active: boolean;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['accounts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['accounts']['Insert']>;
      };
      journal_entries: {
        Row: {
          id: string;
          entry_number: string;
          entry_date: string;
          description: string;
          reference: string | null;
          total_debit: number;
          total_credit: number;
          is_posted: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['journal_entries']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['journal_entries']['Insert']>;
      };
      journal_entry_lines: {
        Row: {
          id: string;
          journal_entry_id: string;
          account_id: string;
          description: string | null;
          debit_amount: number;
          credit_amount: number;
          department_id: string | null;
          child_id: string | null;
          donor_id: string | null;
          fund_id: string | null;
          sponsor_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['journal_entry_lines']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['journal_entry_lines']['Insert']>;
      };
      sales: {
        Row: {
          id: string;
          sale_number: string;
          customer_id: string | null;
          sale_date: string;
          due_date: string | null;
          subtotal: number;
          tax_amount: number;
          discount_amount: number;
          total_amount: number;
          paid_amount: number;
          payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
          payment_method: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sales']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['sales']['Insert']>;
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          discount_amount: number;
          tax_amount: number;
          total_amount: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sale_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['sale_items']['Insert']>;
      };
      purchases: {
        Row: {
          id: string;
          purchase_number: string;
          supplier_id: string | null;
          purchase_date: string;
          due_date: string | null;
          subtotal: number;
          tax_amount: number;
          discount_amount: number;
          total_amount: number;
          paid_amount: number;
          payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['purchases']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['purchases']['Insert']>;
      };
      purchase_items: {
        Row: {
          id: string;
          purchase_id: string;
          product_id: string;
          quantity: number;
          unit_cost: number;
          discount_amount: number;
          tax_amount: number;
          total_amount: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['purchase_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['purchase_items']['Insert']>;
      };
      expenses: {
        Row: {
          id: string;
          expense_number: string;
          account_id: string;
          supplier_id: string | null;
          expense_date: string;
          amount: number;
          tax_amount: number;
          description: string;
          reference: string | null;
          receipt_url: string | null;
          is_approved: boolean;
          approved_by: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>;
      };
      inventory_movements: {
        Row: {
          id: string;
          product_id: string;
          movement_type: 'in' | 'out' | 'adjustment';
          quantity: number;
          unit_cost: number | null;
          reference_type: string | null;
          reference_id: string | null;
          description: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory_movements']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['inventory_movements']['Insert']>;
      };
      departments: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          manager_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['departments']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
      };
      guardians: {
        Row: {
          id: string;
          name: string;
          relationship: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['guardians']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['guardians']['Insert']>;
      };
      children: {
        Row: {
          id: string;
          code: string;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          gender: string;
          guardian_id: string | null;
          status: 'active' | 'graduated' | 'inactive';
          enrollment_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['children']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['children']['Insert']>;
      };
      donors: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          donor_type: 'individual' | 'corporate' | 'foundation';
          address: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['donors']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['donors']['Insert']>;
      };
      sponsors: {
        Row: {
          id: string;
          donor_id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sponsors']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['sponsors']['Insert']>;
      };
      fund_accounts: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          restriction_type: 'unrestricted' | 'temporarily_restricted' | 'permanently_restricted';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['fund_accounts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['fund_accounts']['Insert']>;
      };
      sponsorships: {
        Row: {
          id: string;
          child_id: string;
          sponsor_id: string;
          amount: number;
          currency: string;
          frequency: 'monthly' | 'quarterly' | 'yearly';
          start_date: string;
          end_date: string | null;
          status: 'active' | 'cancelled' | 'on_hold';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sponsorships']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['sponsorships']['Insert']>;
      };
      donations: {
        Row: {
          id: string;
          donor_id: string;
          fund_id: string | null;
          amount: number;
          currency: string;
          donation_date: string;
          payment_method: string;
          reference_number: string | null;
          is_anonymous: boolean;
          restricted_to_child_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['donations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['donations']['Insert']>;
      };
      internal_transfers: {
        Row: {
          id: string;
          from_department_id: string;
          to_department_id: string;
          amount: number;
          transfer_date: string;
          description: string;
          status: 'pending' | 'approved' | 'rejected';
          approved_by: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['internal_transfers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['internal_transfers']['Insert']>;
      };
    };
  };
}