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
  'fund_accounts', 'donations', 'sponsorships', 'internal_transfers', 'audit_logs',
  'fixed_assets'
];

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

    // Generic insert for other tables
    if (table === 'journal_entries' && !keys.includes('entry_number')) {
      keys.push('entry_number');
      values.push(`JNL${Date.now()}${Math.floor(Math.random() * 1000)}`);
    }

    const placeholders = keys.map(() => '?').join(', ');
    const sanitizedValues = values.map(val => (val === '' ? null : val));

    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    await pool.query(query, sanitizedValues);
    
    const [rows]: any = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [newId]);
    
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
    res.json({ success: true, data: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
