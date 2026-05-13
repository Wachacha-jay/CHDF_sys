import { Router } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// Create a new sale with items (Transactional)
router.post('/', authenticate, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      customer_id,
      sale_date,
      due_date,
      items,
      subtotal,
      tax_amount,
      discount_amount,
      total_amount,
      paid_amount,
      payment_status,
      payment_method,
      notes
    } = req.body;

    const saleId = crypto.randomUUID();
    const saleNumber = `SAL${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const normalizedSubtotal = subtotal || 0;
    const normalizedTaxAmount = tax_amount || 0;
    const normalizedDiscountAmount = discount_amount || 0;
    const normalizedTotalAmount = total_amount ?? (normalizedSubtotal + normalizedTaxAmount - normalizedDiscountAmount);
    const normalizedPaidAmount = paid_amount ?? normalizedTotalAmount;

    // 1. Create Sale
    await connection.query(
      `INSERT INTO sales (id, sale_number, customer_id, sale_date, due_date, subtotal, tax_amount, discount_amount, total_amount, paid_amount, payment_status, payment_method, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [saleId, saleNumber, customer_id || null, sale_date, due_date || null, normalizedSubtotal, normalizedTaxAmount, normalizedDiscountAmount, normalizedTotalAmount, normalizedPaidAmount, payment_status, payment_method, notes]
    );

    // 2. Process Items
    for (const item of items) {
      const itemId = crypto.randomUUID();
      const { product_id, quantity, unit_price, discount_amount: itemDiscount, tax_amount: itemTax, total_amount: itemTotal } = item;

      const normalizedItemDiscount = itemDiscount || 0;
      const normalizedItemTax = itemTax || 0;
      const normalizedItemTotal = itemTotal ?? (quantity * unit_price - normalizedItemDiscount + normalizedItemTax);

      // Create Sale Item
      await connection.query(
        `INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, discount_amount, tax_amount, total_amount) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, saleId, product_id, quantity, unit_price, normalizedItemDiscount, normalizedItemTax, normalizedItemTotal]
      );

      // Update Stock (Reduce)
      await connection.query(
        `UPDATE products SET current_stock = GREATEST(0, current_stock - ?) WHERE id = ?`,
        [quantity, product_id]
      );

      // Create Inventory Movement
      await connection.query(
        `INSERT INTO inventory_movements (id, product_id, movement_type, quantity, reference_type, reference_id, description) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), product_id, 'out', quantity, 'sale', saleId, `Sale ${saleNumber}`]
      );
    }

    await connection.commit();
    res.json({ success: true, data: { id: saleId, sale_number: saleNumber } });
  } catch (error: any) {
    await connection.rollback();
    console.error('Sale Transaction Error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

export default router;
