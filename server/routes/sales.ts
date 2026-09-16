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
      sale_number: customSaleNumber,
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
      notes,
      sale_type,
      child_id,
      department_id,
      expense_account_id,
      fund_id,
      donor_id
    } = req.body;

    const saleId = crypto.randomUUID();
    const isDistribution = sale_type === 'donation_distribution' || payment_method === 'in_kind_distribution';
    const saleNumber = customSaleNumber || (
      isDistribution 
        ? `DIST-${Date.now().toString().slice(-6)}` 
        : `SAL${Date.now()}${Math.floor(Math.random() * 1000)}`
    );

    const normalizedSubtotal = Number(subtotal || 0);
    const normalizedTaxAmount = Number(tax_amount || 0);
    const normalizedDiscountAmount = Number(discount_amount || 0);
    const normalizedTotalAmount = total_amount !== undefined 
      ? Number(total_amount) 
      : (normalizedSubtotal + normalizedTaxAmount - normalizedDiscountAmount);
    const normalizedPaidAmount = paid_amount !== undefined ? Number(paid_amount) : normalizedTotalAmount;

    // 1. Create Sale Record
    await connection.query(
      `INSERT INTO sales (
        id, sale_number, customer_id, sale_date, due_date, 
        subtotal, tax_amount, discount_amount, total_amount, paid_amount, 
        payment_status, payment_method, notes, sale_type, 
        child_id, department_id, expense_account_id, fund_id, donor_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleId, 
        saleNumber, 
        customer_id || null, 
        sale_date, 
        due_date || null, 
        normalizedSubtotal, 
        normalizedTaxAmount, 
        normalizedDiscountAmount, 
        normalizedTotalAmount, 
        normalizedPaidAmount, 
        payment_status || 'paid', 
        payment_method || 'cash', 
        notes || null,
        sale_type || (isDistribution ? 'donation_distribution' : 'standard'),
        child_id || null,
        department_id || null,
        expense_account_id || null,
        fund_id || null,
        donor_id || null
      ]
    );

    // 2. Process Items safely
    const safeItems = Array.isArray(items) ? items : [];
    const refType = isDistribution ? 'distribution' : 'sale';

    for (const item of safeItems) {
      if (!item.product_id) continue;

      const itemId = crypto.randomUUID();
      const product_id = item.product_id;
      const quantity = Number(item.quantity || 1);
      const unit_price = Number(item.unit_price || item.unit_cost || 0);
      const itemDiscount = Number(item.discount_amount || 0);
      const itemTax = Number(item.tax_amount || 0);
      const itemTotal = Number(item.total_amount ?? (quantity * unit_price - itemDiscount + itemTax));

      // Create Sale Item
      await connection.query(
        `INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, discount_amount, tax_amount, total_amount) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, saleId, product_id, quantity, unit_price, itemDiscount, itemTax, itemTotal]
      );

      // Update Stock (Reduce)
      await connection.query(
        `UPDATE products SET current_stock = GREATEST(0, current_stock - ?) WHERE id = ?`,
        [quantity, product_id]
      );

      // Create Inventory Movement
      const movDesc = isDistribution 
        ? `In-Kind Distribution #${saleNumber}` 
        : `Sale #${saleNumber}`;

      await connection.query(
        `INSERT INTO inventory_movements (id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, description) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), product_id, 'out', quantity, unit_price, refType, saleId, movDesc]
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
