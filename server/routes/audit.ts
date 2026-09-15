import { Router } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

let auditSchemaEnsured = false;
async function ensureAuditSchema() {
  if (auditSchemaEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36),
        user_name VARCHAR(150),
        action VARCHAR(50),
        module VARCHAR(80),
        entity_id VARCHAR(100),
        entity_label VARCHAR(255),
        details TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_module (module),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);
    auditSchemaEnsured = true;
  } catch (err) {
    console.error('Error in ensureAuditSchema:', err);
  }
}

// GET /api/audit - list activity logs with optional filters
router.get('/', authenticate, async (req, res): Promise<void> => {
  await ensureAuditSchema();
  const { module, user_id, from, to, limit = 100 } = req.query;
  try {
    let query = 'SELECT * FROM activity_logs WHERE 1=1';
    const params: any[] = [];
    if (module) { query += ' AND module = ?'; params.push(module); }
    if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
    if (from) { query += ' AND created_at >= ?'; params.push(from); }
    if (to) { query += ' AND created_at <= ?'; params.push(to + ' 23:59:59'); }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Number(limit));
    const [rows]: any = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/audit/users - list distinct users who have logs
router.get('/users', authenticate, async (req, res): Promise<void> => {
  await ensureAuditSchema();
  try {
    const [rows]: any = await pool.query(
      'SELECT DISTINCT user_id, user_name FROM activity_logs WHERE user_id IS NOT NULL ORDER BY user_name'
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/audit - write a log entry (internal)
router.post('/', authenticate, async (req, res): Promise<void> => {
  await ensureAuditSchema();
  const user = (req as any).user;
  const { action, module, entity_id, entity_label, details } = req.body;
  const ip = req.ip || req.connection.remoteAddress || '';
  try {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO activity_logs (id, user_id, user_name, action, module, entity_id, entity_label, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user?.id || null, user?.name || user?.email || 'System', action, module, entity_id || null, entity_label || null, details ? JSON.stringify(details) : null, ip]
    );
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export { ensureAuditSchema };
export default router;
