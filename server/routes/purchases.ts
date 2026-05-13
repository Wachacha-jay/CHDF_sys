import { Router } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// GET all purchases (with supplier name)
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT p.*, s.name as supplier_name 
       FROM purchases p 
       LEFT JOIN suppliers s ON p.supplier_id = s.id 
       ORDER BY p.purchase_date DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single purchase with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const [purchases]: any = await pool.query(
      `SELECT p.*, s.name as supplier_name 
       FROM purchases p 
       LEFT JOIN suppliers s ON p.supplier_id = s.id 
       WHERE p.id = ?`,
      [id]
    );
    if (!purchases.length) {
      res.status(404).json({ success: false, error: 'Purchase not found' });
      return;
    }
    const [items]: any = await pool.query(
      `SELECT pi.*, pr.name as product_name 
       FROM purchase_items pi 
       LEFT JOIN products pr ON pi.product_id = pr.id 
       WHERE pi.purchase_id = ?`,
      [id]
    );
    res.json({ success: true, data: { ...purchases[0], items } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST — Create a new purchase with items (Transactional)
router.post('/', authenticate, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      supplier_id,
      purchase_date,
      due_date,
      items,
      subtotal,
      tax_amount,
      discount_amount,
      total_amount,
      paid_amount,
      payment_status,
      notes
    } = req.body;

    const purchaseId = crypto.randomUUID();
    const purchaseNumber = `PUR${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Safe defaults for optional fields
    const safeDiscount = discount_amount || 0;
    const safePaid = paid_amount || 0;
    const safeStatus = payment_status || 'pending';
    const safeTax = tax_amount || 0;
    const safeTotal = total_amount || (subtotal + safeTax - safeDiscount);

    // 1. Insert Purchase record
    await connection.query(
      `INSERT INTO purchases 
         (id, purchase_number, supplier_id, purchase_date, due_date, subtotal, tax_amount, discount_amount, total_amount, paid_amount, payment_status, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [purchaseId, purchaseNumber, supplier_id, purchase_date, due_date || null, subtotal, safeTax, safeDiscount, safeTotal, safePaid, safeStatus, notes || null]
    );

    // 2. Process each item
    const createdItems: any[] = [];
    for (const item of items) {
      const itemId = crypto.randomUUID();
      const {
        product_id,
        quantity,
        unit_cost,
        discount_amount: itemDiscount,
        tax_amount: itemTax,
        total_amount: itemTotalProvided
      } = item;

      // Compute totals — always force to Number to prevent NULL insertion
      const effectiveDiscount = Number(itemDiscount) || 0;
      const effectiveTax = Number(itemTax) || 0;
      const qty = Number(quantity);
      const cost = Number(unit_cost);
      const itemTotal = (itemTotalProvided !== undefined && itemTotalProvided !== null)
        ? Number(itemTotalProvided)
        : (qty * cost) - effectiveDiscount + effectiveTax;

      await connection.query(
        `INSERT INTO purchase_items 
           (id, purchase_id, product_id, quantity, unit_cost, discount_amount, tax_amount, total_amount) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, purchaseId, product_id, qty, cost, effectiveDiscount, effectiveTax, itemTotal]
      );

      // Increment stock
      await connection.query(
        `UPDATE products SET current_stock = current_stock + ? WHERE id = ?`,
        [qty, product_id]
      );

      // Log inventory movement
      await connection.query(
        `INSERT INTO inventory_movements 
           (id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, description) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), product_id, 'in', quantity, unit_cost, 'purchase', purchaseId, `Purchase ${purchaseNumber}`]
      );

      createdItems.push({ id: itemId, product_id, quantity, unit_cost, total_amount: itemTotal });
    }

    await connection.commit();

    // Return full purchase object — no second fetch needed by client
    res.json({
      success: true,
      data: {
        id: purchaseId,
        purchase_number: purchaseNumber,
        supplier_id,
        purchase_date,
        subtotal,
        tax_amount: safeTax,
        discount_amount: safeDiscount,
        total_amount: safeTotal,
        paid_amount: safePaid,
        payment_status: safeStatus,
        notes: notes || null,
        items: createdItems
      }
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Purchase Transaction Error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

export default router;
