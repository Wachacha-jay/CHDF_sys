import { http, HttpResponse } from 'msw';

// Mock Supabase URL
const SUPABASE_URL = 'https://your-project.supabase.co';

export const handlers = [
  // Mock business settings
  http.get(`${SUPABASE_URL}/rest/v1/business_settings`, () => {
    return HttpResponse.json([
      {
        id: '1',
        business_name: 'Test Business',
        default_currency: 'KES',
        tax_rate: 0.16,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]);
  }),

  // Mock products
  http.get(`${SUPABASE_URL}/rest/v1/products`, () => {
    return HttpResponse.json([
      {
        id: '1',
        code: 'PRD001',
        name: 'Test Product',
        cost_price: 100,
        selling_price: 150,
        current_stock: 50,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]);
  }),

  // Mock sales
  http.get(`${SUPABASE_URL}/rest/v1/sales`, () => {
    return HttpResponse.json([
      {
        id: '1',
        sale_number: 'SALE001',
        sale_date: '2024-01-15',
        total_amount: 1500,
        payment_status: 'paid',
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z'
      }
    ]);
  }),

  // Mock customers
  http.get(`${SUPABASE_URL}/rest/v1/customers`, () => {
    return HttpResponse.json([
      {
        id: '1',
        code: 'CUS001',
        name: 'Test Customer',
        email: 'test@example.com',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]);
  }),

  // Mock employees
  http.get(`${SUPABASE_URL}/rest/v1/employees`, () => {
    return HttpResponse.json([
      {
        id: '1',
        code: 'EMP001',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]);
  }),

  // Mock suppliers
  http.get(`${SUPABASE_URL}/rest/v1/suppliers`, () => {
    return HttpResponse.json([
      {
        id: '1',
        code: 'SUP001',
        name: 'Test Supplier',
        email: 'supplier@example.com',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]);
  }),

  // Mock accounts
  http.get(`${SUPABASE_URL}/rest/v1/accounts`, () => {
    return HttpResponse.json([
      {
        id: '1',
        code: '1000',
        name: 'Cash',
        account_type: 'asset',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]);
  }),

  // Mock journal entries
  http.get(`${SUPABASE_URL}/rest/v1/journal_entries`, () => {
    return HttpResponse.json([
      {
        id: '1',
        entry_number: 'JE001',
        entry_date: '2024-01-15',
        description: 'Test entry',
        total_debit: 1000,
        total_credit: 1000,
        is_posted: true,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z'
      }
    ]);
  }),

  // Mock expenses
  http.get(`${SUPABASE_URL}/rest/v1/expenses`, () => {
    return HttpResponse.json([
      {
        id: '1',
        expense_number: 'EXP001',
        account_id: '1',
        expense_date: '2024-01-15',
        amount: 500,
        description: 'Test expense',
        is_approved: true,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z'
      }
    ]);
  }),

  // Mock purchases
  http.get(`${SUPABASE_URL}/rest/v1/purchases`, () => {
    return HttpResponse.json([
      {
        id: '1',
        purchase_number: 'PUR001',
        supplier_id: '1',
        purchase_date: '2024-01-15',
        total_amount: 2000,
        payment_status: 'pending',
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z'
      }
    ]);
  }),

  // Mock categories
  http.get(`${SUPABASE_URL}/rest/v1/categories`, () => {
    return HttpResponse.json([
      {
        id: '1',
        name: 'Electronics',
        description: 'Electronic products',
        is_active: true,
        sort_order: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]);
  }),

  // Mock inventory movements
  http.get(`${SUPABASE_URL}/rest/v1/inventory_movements`, () => {
    return HttpResponse.json([
      {
        id: '1',
        product_id: '1',
        movement_type: 'in',
        quantity: 10,
        unit_cost: 100,
        reference_type: 'purchase',
        description: 'Purchase addition',
        created_at: '2024-01-15T00:00:00Z'
      }
    ]);
  }),

  // Mock sale items
  http.get(`${SUPABASE_URL}/rest/v1/sale_items`, () => {
    return HttpResponse.json([
      {
        id: '1',
        sale_id: '1',
        product_id: '1',
        quantity: 2,
        unit_price: 150,
        total_amount: 300,
        created_at: '2024-01-15T00:00:00Z'
      }
    ]);
  }),

  // Mock purchase items
  http.get(`${SUPABASE_URL}/rest/v1/purchase_items`, () => {
    return HttpResponse.json([
      {
        id: '1',
        purchase_id: '1',
        product_id: '1',
        quantity: 5,
        unit_cost: 100,
        total_amount: 500,
        created_at: '2024-01-15T00:00:00Z'
      }
    ]);
  }),

  // Mock journal entry lines
  http.get(`${SUPABASE_URL}/rest/v1/journal_entry_lines`, () => {
    return HttpResponse.json([
      {
        id: '1',
        journal_entry_id: '1',
        account_id: '1',
        debit_amount: 1000,
        credit_amount: 0,
        created_at: '2024-01-15T00:00:00Z'
      }
    ]);
  }),

  // POST handlers for creating records
  http.post(`${SUPABASE_URL}/rest/v1/products`, () => {
    return HttpResponse.json({
      id: '2',
      code: 'PRD002',
      name: 'New Product',
      cost_price: 200,
      selling_price: 300,
      current_stock: 0,
      is_active: true,
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z'
    });
  }),

  http.post(`${SUPABASE_URL}/rest/v1/sales`, () => {
    return HttpResponse.json({
      id: '2',
      sale_number: 'SALE002',
      sale_date: '2024-01-15',
      total_amount: 300,
      payment_status: 'pending',
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z'
    });
  }),

  // PUT handlers for updating records
  http.put(`${SUPABASE_URL}/rest/v1/products/:id`, () => {
    return HttpResponse.json({
      id: '1',
      code: 'PRD001',
      name: 'Updated Product',
      cost_price: 120,
      selling_price: 180,
      current_stock: 45,
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z'
    });
  }),

  // DELETE handlers
  http.delete(`${SUPABASE_URL}/rest/v1/products/:id`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Storage handlers for file uploads
  http.post(`${SUPABASE_URL}/storage/v1/object/:bucket/:path`, () => {
    return HttpResponse.json({
      path: 'products/1/image_123456.jpg',
      id: '1',
      size: 1024
    });
  }),

  // Auth handlers
  http.post(`${SUPABASE_URL}/auth/v1/token`, () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer'
    });
  }),

  http.get(`${SUPABASE_URL}/auth/v1/user`, () => {
    return HttpResponse.json({
      id: '1',
      email: 'test@example.com',
      user_metadata: {
        name: 'Test User',
        role: 'admin'
      },
      created_at: '2024-01-01T00:00:00Z',
      last_sign_in_at: '2024-01-15T00:00:00Z'
    });
  })
]; 