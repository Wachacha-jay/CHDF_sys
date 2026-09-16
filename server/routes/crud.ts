import { Router } from 'express';
import crypto from 'crypto';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';

const router = Router();

// Valid tables to allow generic CRUD access
const VALID_TABLES = [
  'products', 'categories', 'customers', 'suppliers', 'employees', 
  'sales', 'purchases', 'expenses', 'inventory', 'account_categories', 
  'accounts', 'roles', 'permissions', 'designations', 'units_of_measure', 'users',
  'business_settings', 'payroll_settings', 'payroll_periods', 'payroll_runs',
  'payroll_deductions', 'payroll_allowances', 'payroll_reports', 'payroll_journal_entries',
  'bank_reconciliations', 'journal_entries', 'journal_entry_lines',
  // NGO / Fund Accounting tables
  'departments', 'children', 'guardians', 'donors', 'sponsors', 'donor_clusters',
  'fund_accounts', 'donations', 'donation_items', 'sponsorships', 'internal_transfers', 'audit_logs',
  'fixed_assets'
];

// Self-healing schema for in-kind donations & distribution
let inKindSchemaEnsured = false;
async function ensureInKindSchema() {
  if (inKindSchemaEnsured) return;
  try {
    // 1. Ensure accounts exist
    await pool.query(`
      INSERT IGNORE INTO accounts (id, code, name, account_type, is_system) VALUES
        (UUID(), '1135', 'In-Kind Inventory', 'asset', 1),
        (UUID(), '1210', 'Fixed Assets - Equipment & Machinery', 'asset', 1),
        (UUID(), '1220', 'Fixed Assets - Furniture & Fixtures', 'asset', 1),
        (UUID(), '1230', 'Fixed Assets - Buildings & Infrastructure', 'asset', 1),
        (UUID(), '4260', 'In-Kind Donations', 'revenue', 1),
        (UUID(), '5335', 'Food & Consumables Distribution Expense', 'expense', 1)
    `);

    // 2. Ensure products.is_in_kind
    const [prodCols]: any = await pool.query('SHOW COLUMNS FROM products');
    const prodColNames = new Set(prodCols.map((c: any) => c.Field));
    if (!prodColNames.has('is_in_kind')) {
      await pool.query('ALTER TABLE products ADD COLUMN is_in_kind TINYINT(1) NOT NULL DEFAULT 0');
    }

    // 3. Ensure donations.is_in_kind & total_fair_market_value
    const [donCols]: any = await pool.query('SHOW COLUMNS FROM donations');
    const donColNames = new Set(donCols.map((c: any) => c.Field));
    if (!donColNames.has('is_in_kind')) {
      await pool.query('ALTER TABLE donations ADD COLUMN is_in_kind TINYINT(1) NOT NULL DEFAULT 0');
    }
    if (!donColNames.has('total_fair_market_value')) {
      await pool.query('ALTER TABLE donations ADD COLUMN total_fair_market_value DECIMAL(12,4) DEFAULT 0');
    }

    // 4. Ensure sales table distribution columns & sale_type VARCHAR(50)
    const [saleCols]: any = await pool.query('SHOW COLUMNS FROM sales');
    const saleColNames = new Set(saleCols.map((c: any) => c.Field));
    if (!saleColNames.has('expense_account_id')) {
      await pool.query('ALTER TABLE sales ADD COLUMN expense_account_id CHAR(36) NULL');
    }
    if (!saleColNames.has('department_id')) {
      await pool.query('ALTER TABLE sales ADD COLUMN department_id CHAR(36) NULL');
    }
    if (!saleColNames.has('child_id')) {
      await pool.query('ALTER TABLE sales ADD COLUMN child_id CHAR(36) NULL');
    }
    if (!saleColNames.has('sale_type')) {
      await pool.query("ALTER TABLE sales ADD COLUMN sale_type VARCHAR(50) DEFAULT 'standard'");
    } else {
      try {
        await pool.query("ALTER TABLE sales MODIFY COLUMN sale_type VARCHAR(50) DEFAULT 'standard'");
      } catch (_) {}
    }

    // 5. Ensure business_settings logo_url and favicon_url are LONGTEXT for data/image URLs
    try {
      await pool.query('ALTER TABLE business_settings MODIFY COLUMN logo_url LONGTEXT');
      await pool.query('ALTER TABLE business_settings MODIFY COLUMN favicon_url LONGTEXT');
    } catch (err) {
      // Ignore if already adjusted
    }

    // 6. Ensure donation_items table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS donation_items (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        donation_id CHAR(36) NOT NULL,
        item_description VARCHAR(255) NOT NULL,
        asset_class ENUM('consumable', 'fixed_asset', 'construction') NOT NULL,
        fair_market_value DECIMAL(12,4) NOT NULL DEFAULT 0,
        quantity DECIMAL(12,4) NOT NULL DEFAULT 1,
        unit_of_measure VARCHAR(50) DEFAULT 'units',
        product_id CHAR(36) NULL,
        department_id CHAR(36) NULL,
        fixed_asset_id CHAR(36) NULL,
        project_name VARCHAR(255) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_donation_id (donation_id),
        INDEX idx_product_id (product_id),
        INDEX idx_dept_id (department_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 7. Ensure units_of_measure table exists (used by ProductForm unit dropdown)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS units_of_measure (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(100) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const [uomRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM units_of_measure');
    if (uomRows[0]?.cnt === 0) {
      await pool.query(`
        INSERT INTO units_of_measure (id, name, symbol) VALUES
          (UUID(), 'Pieces', 'pcs'),
          (UUID(), 'Kilograms', 'kg'),
          (UUID(), 'Grams', 'g'),
          (UUID(), 'Litres', 'L'),
          (UUID(), 'Millilitres', 'mL'),
          (UUID(), 'Metres', 'm'),
          (UUID(), 'Boxes', 'box'),
          (UUID(), 'Cartons', 'ctn'),
          (UUID(), 'Bags', 'bag'),
          (UUID(), 'Pairs', 'pair'),
          (UUID(), 'Sets', 'set'),
          (UUID(), 'Units', 'unit')
      `);
    }

    inKindSchemaEnsured = true;
  } catch (err) {
    console.error('ensureInKindSchema check encountered an issue (non-fatal):', err);
  }
}

// Attach ensureInKindSchema middleware to router
router.use(async (_req, _res, next) => {
  await ensureInKindSchema();
  next();
});

async function logCrudActivity(req: any, action: string, table: any, entityId: any, entityLabel?: string) {
  try {
    const user = req.user;
    const userName = user?.name || user?.email || 'System';
    const auditId = crypto.randomUUID();
    const strTable = String(table || '');
    const moduleName = strTable.charAt(0).toUpperCase() + strTable.slice(1).replace(/_/g, ' ');
    await pool.query(
      `INSERT INTO activity_logs (id, user_id, user_name, action, module, entity_id, entity_label, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [auditId, user?.id || null, userName, action, moduleName, entityId ? String(entityId) : null, entityLabel || `${action} ${moduleName}`, req.ip || '']
    );
  } catch (_) {}
}

// GET list
router.get('/:table', authenticate, async (req, res): Promise<void> => {
  const { table } = req.params;
  if (!VALID_TABLES.includes(table)) {
    res.status(400).json({ success: false, error: 'Invalid table' });
    return;
  }

  try {
    const { limit, offset, orderBy, orderDir, ...filters } = req.query;
    
    let query = `SELECT * FROM ${table}`;
    const queryParams: any[] = [];
    const filterKeys = Object.keys(filters);
    
    if (filterKeys.length > 0) {
      query += ' WHERE ';
      const conditions = filterKeys.map(key => {
        let val = filters[key];
        
        if (val === 'null') {
          return `${key} IS NULL`;
        }

        // Handle >= and <= filters
        let operator = '=';
        let column = key;
        
        if (key.endsWith('_gte')) {
          operator = '>=';
          column = key.replace('_gte', '');
        } else if (key.endsWith('_lte')) {
          operator = '<=';
          column = key.replace('_lte', '');
        } else if (key.endsWith('_neq')) {
          operator = '!=';
          column = key.replace('_neq', '');
        }

        // Convert query string booleans to MySQL TinyInt 1 or 0
        if (val === 'true') val = 1;
        if (val === 'false') val = 0;
        
        queryParams.push(val);
        return `${column} ${operator} ?`;
      });
      query += conditions.join(' AND ');
    }

    if (orderBy) {
      const dir = orderDir === 'ASC' ? 'ASC' : 'DESC';
      const sortBy = typeof orderBy === 'string' ? orderBy.replace(/[^a-zA-Z0-9_]/g, '') : 'id';
      query += ` ORDER BY ${sortBy} ${dir}`;
    }

    if (limit) {
      query += ' LIMIT ?';
      queryParams.push(Number(limit));
    }

    if (offset) {
      query += ' OFFSET ?';
      queryParams.push(Number(offset));
    }

    const [rows]: any = await pool.query(query, queryParams);
    
    // Handle special joins for list views if table is sales or purchases
    if (table === 'sales') {
        for (let row of rows) {
            const [customers]: any = await pool.query('SELECT * FROM customers WHERE id = ?', [row.customer_id]);
            row.customer = customers[0] || null;
            try {
                const [itemStats]: any = await pool.query(
                    'SELECT COUNT(*) as items_count, COALESCE(SUM(quantity), 0) as total_quantity FROM sale_items WHERE sale_id = ?',
                    [row.id]
                );
                row.items_count = Number(itemStats[0]?.items_count || 0);
                row.total_quantity = Number(itemStats[0]?.total_quantity || 0);
            } catch (_) {
                row.items_count = 0;
                row.total_quantity = 0;
            }
        }
    } else if (table === 'purchases') {
        for (let row of rows) {
            const [suppliers]: any = await pool.query('SELECT * FROM suppliers WHERE id = ?', [row.supplier_id]);
            row.supplier = suppliers[0] || null;
        }
    }

    res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET by id
router.get('/:table/:id', authenticate, async (req, res): Promise<void> => {
  const { table, id } = req.params;
  if (!VALID_TABLES.includes(table)) {
    res.status(400).json({ success: false, error: 'Invalid table' });
    return;
  }

  try {
    const [rows]: any = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }

    const result = rows[0];

    // Handle special joins for detail views
    if (table === 'sales') {
        const [customers]: any = await pool.query('SELECT * FROM customers WHERE id = ?', [result.customer_id]);
        result.customer = customers[0] || null;
        
        const [items]: any = await pool.query(`
            SELECT si.*, p.name as product_name, p.description as product_description 
            FROM sale_items si 
            LEFT JOIN products p ON si.product_id = p.id 
            WHERE si.sale_id = ?
        `, [id]);
        
        // Map backend flat names to nested product object for frontend compatibility
        result.items = items.map((item: any) => ({
            ...item,
            product: {
                id: item.product_id,
                name: item.product_name,
                description: item.product_description
            }
        }));
    } else if (table === 'purchases') {
        const [suppliers]: any = await pool.query('SELECT * FROM suppliers WHERE id = ?', [result.supplier_id]);
        result.supplier = suppliers[0] || null;
        
        const [items]: any = await pool.query(`
            SELECT pi.*, p.name as product_name, p.description as product_description 
            FROM purchase_items pi 
            LEFT JOIN products p ON pi.product_id = p.id 
            WHERE pi.purchase_id = ?
        `, [id]);
        
        result.items = items.map((item: any) => ({
            ...item,
            product: {
                id: item.product_id,
                name: item.product_name,
                description: item.product_description
            }
        }));
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST
router.post('/:table', authenticate, async (req, res): Promise<void> => {
  const { table } = req.params;
  // Let generic logic allow transaction child tables if passed directly
  // Note: we might want to let sale_items, purchase_items, inventory_movements through too
  const EXTENDED_TABLES = [...VALID_TABLES, 'sale_items', 'purchase_items', 'inventory_movements', 'journal_entries', 'journal_entry_lines'];
  if (!EXTENDED_TABLES.includes(table)) {
    res.status(400).json({ success: false, error: 'Invalid table' });
    return;
  }

  try {
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);

    // Handle ID generation
    let newId = req.body.id;
    if (!newId) {
        newId = crypto.randomUUID();
        keys.push('id');
        values.push(newId);
    } else {
        // ID provided, ensure it's in the keys/values if not already
        if (!keys.includes('id')) {
            keys.push('id');
            values.push(newId);
        }
    }

    // Auto-generate missing transaction numbers
    if (table === 'sales' && !keys.includes('sale_number')) {
      keys.push('sale_number');
      values.push(`SAL${Date.now()}${Math.floor(Math.random() * 1000)}`);
    } else if (table === 'purchases' && !keys.includes('purchase_number')) {
      keys.push('purchase_number');
      values.push(`PUR${Date.now()}${Math.floor(Math.random() * 1000)}`);
    } else if (table === 'expenses' && !keys.includes('expense_number')) {
      keys.push('expense_number');
      values.push(`EXP${Date.now()}${Math.floor(Math.random() * 1000)}`);
    }

    // Product-specific sanitization
    if (table === 'products') {
      // Remove unit_id — it's a form-only field; products table stores unit_of_measure (string)
      const unitIdIdx = keys.indexOf('unit_id');
      if (unitIdIdx !== -1) {
        keys.splice(unitIdIdx, 1);
        (values as any[]).splice(unitIdIdx, 1);
      }
      // Auto-generate product code if missing or empty
      const codeIdx = keys.indexOf('code');
      const codeVal = codeIdx !== -1 ? values[codeIdx] : undefined;
      if (!codeVal || String(codeVal).trim() === '') {
        const shortId = newId.replace(/-/g, '').substring(0, 8).toUpperCase();
        const generatedCode = `PRD-${shortId}`;
        if (codeIdx !== -1) {
          (values as any[])[codeIdx] = generatedCode;
        } else {
          keys.push('code');
          (values as any[]).push(generatedCode);
        }
      }
      // Null out empty barcode/sku to avoid UNIQUE constraint on empty string
      const barcodeIdx = keys.indexOf('barcode');
      if (barcodeIdx !== -1 && (!values[barcodeIdx] || String(values[barcodeIdx]).trim() === '')) {
        (values as any[])[barcodeIdx] = null;
      }
      const skuIdx = keys.indexOf('sku');
      if (skuIdx !== -1 && (!values[skuIdx] || String(values[skuIdx]).trim() === '')) {
        (values as any[])[skuIdx] = null;
      }
    }

    // Special-case: transactional create for journal_entries with lines
    if (table === 'journal_entries' && Array.isArray(req.body.lines)) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        let entryNumber = req.body.entry_number || `JNL${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        // Ensure entry_number is unique in DB before insert
        const [existingNumberRows]: any = await connection.query(`SELECT id FROM journal_entries WHERE entry_number = ?`, [entryNumber]);
        if (existingNumberRows && existingNumberRows.length > 0) {
          const prefix = `JE${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          const [maxRows]: any = await connection.query(`SELECT entry_number FROM journal_entries WHERE entry_number LIKE ? ORDER BY id DESC LIMIT 10`, [`${prefix}%`]);
          let maxSuffix = 0;
          if (maxRows && maxRows.length > 0) {
            for (const r of maxRows) {
              const numPart = parseInt(r.entry_number.replace(prefix, ''), 10);
              if (!isNaN(numPart) && numPart > maxSuffix) maxSuffix = numPart;
            }
          }
          entryNumber = `${prefix}${String(maxSuffix + 1).padStart(4, '0')}`;
          // Final fallback
          const [checkAgain]: any = await connection.query(`SELECT id FROM journal_entries WHERE entry_number = ?`, [entryNumber]);
          if (checkAgain && checkAgain.length > 0) {
            entryNumber = `${prefix}${Date.now().toString().slice(-6)}`;
          }
        }

        // Build clean insert payload
        const entryPayload: Record<string, any> = {
          id: req.body.id || newId,
          entry_number: entryNumber,
          entry_date: req.body.entry_date || new Date().toISOString().split('T')[0],
          description: req.body.description || 'Journal Entry',
          reference: req.body.reference || null,
          total_debit: req.body.total_debit || 0,
          total_credit: req.body.total_credit || 0,
          is_posted: req.body.is_posted ? 1 : 0
        };

        const entryKeys = Object.keys(entryPayload);
        const entryValues = Object.values(entryPayload).map(v => v === undefined ? null : v);
        const placeholders = entryKeys.map(() => '?').join(', ');
        const insertQuery = `INSERT INTO journal_entries (${entryKeys.join(', ')}) VALUES (${placeholders})`;
        await connection.query(insertQuery, entryValues);

        // Insert lines
        const lines = req.body.lines;
        for (const line of lines) {
          const lineId = line.id || crypto.randomUUID();
          const lineKeys = [
            'id', 'journal_entry_id', 'account_id', 'description', 
            'debit_amount', 'credit_amount', 'department_id', 
            'child_id', 'donor_id', 'fund_id', 'sponsor_id'
          ];
          const lineValues = [
            lineId, entryPayload.id, line.account_id, line.description || null, 
            Number(line.debit_amount || 0), Number(line.credit_amount || 0),
            line.department_id || null, line.child_id || null, 
            line.donor_id || null, line.fund_id || null, line.sponsor_id || null
          ];
          const linePlaceholders = lineKeys.map(() => '?').join(', ');
          const lineQuery = `INSERT INTO journal_entry_lines (${lineKeys.join(', ')}) VALUES (${linePlaceholders})`;
          await connection.query(lineQuery, lineValues);
        }

        await connection.commit();

        const [entryRows]: any = await connection.query(`SELECT * FROM journal_entries WHERE id = ?`, [entryPayload.id]);
        const [linesRows]: any = await connection.query(`SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?`, [entryPayload.id]);

        const result = entryRows[0] || entryPayload;
        result.lines = linesRows || [];

        logCrudActivity(req, 'CREATE', 'journal_entries', entryPayload.id, `Created journal entry ${result.entry_number || entryPayload.id}`);

        res.json({ success: true, data: result });
      } catch (error: any) {
        await connection.rollback();
        console.error(`Error inserting journal entry transactionally:`, error);
        res.status(500).json({ success: false, error: error.message || 'Database error creating journal entry' });
      } finally {
        connection.release();
      }
      return;
    }

    // Special-case: transactional create for purchases with items
    if (table === 'purchases' && Array.isArray(req.body.items)) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        let purchaseNumber = req.body.purchase_number || `PUR${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const purchasePayload: Record<string, any> = {
          id: req.body.id || newId,
          purchase_number: purchaseNumber,
          supplier_id: req.body.supplier_id || null,
          purchase_date: req.body.purchase_date || new Date().toISOString().split('T')[0],
          due_date: req.body.due_date || null,
          subtotal: Number(req.body.subtotal || 0),
          tax_amount: Number(req.body.tax_amount || 0),
          discount_amount: Number(req.body.discount_amount || 0),
          total_amount: Number(req.body.total_amount || 0),
          paid_amount: Number(req.body.paid_amount || 0),
          payment_status: req.body.payment_status || 'pending',
          notes: req.body.notes || null,
          created_by: (req as any).user?.id || null
        };

        const pKeys = Object.keys(purchasePayload);
        const pValues = Object.values(purchasePayload).map(v => v === undefined ? null : v);
        const pPlaceholders = pKeys.map(() => '?').join(', ');
        await connection.query(`INSERT INTO purchases (${pKeys.join(', ')}) VALUES (${pPlaceholders})`, pValues);

        // Insert purchase items & update product inventory
        const items = req.body.items;
        for (const item of items) {
          if (!item.product_id) continue;
          const itemId = item.id || crypto.randomUUID();
          const qty = Number(item.quantity || 0);
          const unitCost = Number(item.unit_cost || 0);
          const totalLine = Number(item.total_amount || (qty * unitCost));

          await connection.query(`
            INSERT INTO purchase_items (id, purchase_id, product_id, quantity, unit_cost, discount_amount, tax_amount, total_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [itemId, purchasePayload.id, item.product_id, qty, unitCost, Number(item.discount_amount || 0), Number(item.tax_amount || 0), totalLine]);

          // Increment product inventory stock & update cost price if provided
          await connection.query(`
            UPDATE products 
            SET current_stock = current_stock + ?,
                cost_price = CASE WHEN ? > 0 THEN ? ELSE cost_price END
            WHERE id = ?
          `, [qty, unitCost, unitCost, item.product_id]);

          // Create inventory movement record
          const movementId = crypto.randomUUID();
          await connection.query(`
            INSERT INTO inventory_movements (id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, description, created_by)
            VALUES (?, ?, 'in', ?, ?, 'purchase', ?, ?, ?)
          `, [movementId, item.product_id, qty, unitCost, purchasePayload.id, `Stock added via purchase ${purchaseNumber}`, (req as any).user?.id || null]);
        }

        await connection.commit();

        const [pRows]: any = await connection.query(`SELECT * FROM purchases WHERE id = ?`, [purchasePayload.id]);
        const [pItemRows]: any = await connection.query(`SELECT * FROM purchase_items WHERE purchase_id = ?`, [purchasePayload.id]);
        const result = pRows[0] || purchasePayload;
        result.items = pItemRows || [];

        logCrudActivity(req, 'CREATE', 'purchases', purchasePayload.id, `Created purchase ${purchaseNumber}`);
        res.json({ success: true, data: result });
      } catch (error: any) {
        await connection.rollback();
        console.error('Error inserting purchase transactionally:', error);
        res.status(500).json({ success: false, error: error.message || 'Database error creating purchase' });
      } finally {
        connection.release();
      }
      return;
    }

    // Generic insert for other tables
    if (table === 'journal_entries' && !keys.includes('entry_number')) {
      keys.push('entry_number');
      values.push(`JNL${Date.now()}${Math.floor(Math.random() * 1000)}`);
    }

    // Strip virtual/child relations like 'items' from single-table insert
    const itemsIdx = keys.indexOf('items');
    if (itemsIdx !== -1) {
      keys.splice(itemsIdx, 1);
      (values as any[]).splice(itemsIdx, 1);
    }

    const placeholders = keys.map(() => '?').join(', ');
    const sanitizedValues = values.map(val => (val === '' ? null : val));

    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    await pool.query(query, sanitizedValues);
    
    const [rows]: any = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [newId]);
    const label = rows[0]?.name || rows[0]?.title || rows[0]?.code || rows[0]?.entry_number || (rows[0]?.first_name ? `${rows[0].first_name} ${rows[0].last_name || ''}`.trim() : newId);
    logCrudActivity(req, 'CREATE', table, newId, `Created ${table}: ${label}`);
    
    res.json({ success: true, data: rows[0] });
  } catch (error: any) {
    console.error(`Error inserting into ${table}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT
router.put('/:table/:id', authenticate, async (req, res): Promise<void> => {
  const { table, id } = req.params;
  if (!VALID_TABLES.includes(table)) {
    res.status(400).json({ success: false, error: 'Invalid table' });
    return;
  }

  try {
    const updateData = { ...req.body };
    delete updateData.id; // Never update ID column
    // Product-specific: remove unit_id (form-only field, not in products table)
    if (table === 'products') {
      delete updateData.unit_id;
      // Null out empty barcode/sku to avoid UNIQUE constraint on empty string
      if (updateData.barcode !== undefined && (!updateData.barcode || String(updateData.barcode).trim() === '')) {
        updateData.barcode = null;
      }
      if (updateData.sku !== undefined && (!updateData.sku || String(updateData.sku).trim() === '')) {
        updateData.sku = null;
      }
    }
    
    const keys = Object.keys(updateData);
    const values = Object.values(updateData).map(val => (val === '' ? null : val));
    
    if (keys.length === 0) {
      res.status(400).json({ success: false, error: 'No data provided' });
      return;
    }

    const setString = keys.map(key => `${key} = ?`).join(', ');
    const query = `UPDATE ${table} SET ${setString} WHERE id = ?`;
    
    await pool.query(query, [...values, id]);
    
    const [rows]: any = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    const label = rows[0]?.name || rows[0]?.title || rows[0]?.code || rows[0]?.entry_number || (rows[0]?.first_name ? `${rows[0].first_name} ${rows[0].last_name || ''}`.trim() : id);
    logCrudActivity(req, 'UPDATE', table, id, `Updated ${table}: ${label}`);
    res.json({ success: true, data: rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE
router.delete('/:table/:id', authenticate, async (req, res): Promise<void> => {
  const { table, id } = req.params;
  if (!VALID_TABLES.includes(table)) {
    res.status(400).json({ success: false, error: 'Invalid table' });
    return;
  }

  try {
    await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    logCrudActivity(req, 'DELETE', table, id, `Deleted ${table} record`);
    res.json({ success: true, data: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
