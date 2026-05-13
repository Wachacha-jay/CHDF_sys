import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get permissions for a specific role
router.get('/:roleId/permissions', authenticate, async (req: Request, res: Response) => {
  const { roleId } = req.params;
  try {
    const [rows]: any = await pool.query(
      `SELECT p.* FROM permissions p 
       JOIN role_permissions rp ON p.id = rp.permission_id 
       WHERE rp.role_id = ?`,
      [roleId]
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update permissions for a specific role
router.post('/:roleId/permissions', authenticate, async (req: Request, res: Response) => {
  const { roleId } = req.params;
  const { permissionIds } = req.body; // Array of permission UUIDs

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Remove existing permissions
    await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

    // 2. Add new permissions
    if (permissionIds && permissionIds.length > 0) {
      const values = permissionIds.map((pId: string) => [roleId, pId]);
      await connection.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Role permissions updated successfully' });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

export default router;
