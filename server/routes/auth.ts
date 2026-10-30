import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * Helper to fetch effective permissions for a user
 */
async function getUserPermissions(roleId: string | null, roleName: string | null): Promise<string[]> {
  try {
    if (roleName === 'Super Admin') {
      const [pRows]: any = await pool.query('SELECT name FROM permissions');
      return pRows.map((p: any) => p.name);
    }
    if (roleId) {
      const [pRows]: any = await pool.query(
        `SELECT p.name FROM permissions p 
         JOIN role_permissions rp ON p.id = rp.permission_id 
         WHERE rp.role_id = ?`,
        [roleId]
      );
      return pRows.map((p: any) => p.name);
    }
  } catch (error) {
    console.error('Error fetching user permissions:', error);
  }
  return [];
}

/**
 * POST /api/auth/login
 * Robust login supporting case-insensitive email or username, trimmed whitespace,
 * account status validation, and complete permission loading.
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const identifier = String(req.body.email || req.body.username || '').trim();
  const password = String(req.body.password || '');
  
  if (!identifier || !password) {
    res.status(400).json({ success: false, error: 'Email/Username and password are required' });
    return;
  }

  try {
    // 1. Fetch user with role info (case-insensitive on email or username)
    const [rows]: any = await pool.query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE LOWER(u.email) = LOWER(?) OR LOWER(u.username) = LOWER(?)
       LIMIT 1`, 
      [identifier, identifier]
    );
    const user = rows[0];

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email/username or password' });
      return;
    }

    // 2. Validate active account status
    if (user.is_active === 0 || user.is_active === false) {
      res.status(403).json({ 
        success: false, 
        error: 'Your account is deactivated. Please contact your system administrator.' 
      });
      return;
    }

    // 3. Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid email/username or password' });
      return;
    }

    // 4. Fetch permissions for the role
    const permissions = await getUserPermissions(user.role_id, user.role_name);

    // 5. Generate secure JWT token (30-day enterprise validity)
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        username: user.username,
        role: user.role_name, 
        permissions 
      }, 
      process.env.JWT_SECRET || 'your-secret-key', 
      { expiresIn: '30d' }
    );

    const { password_hash: _, ...userWithoutPassword } = user;
    res.json({
      success: true,
      data: {
        user: { 
          ...userWithoutPassword, 
          role: user.role_name, 
          role_name: user.role_name,
          permissions 
        },
        token
      }
    });

  } catch (error: any) {
    console.error('[Auth Login Error]:', error);
    res.status(500).json({ success: false, error: 'Server authentication error. Please try again.' });
  }
});

/**
 * POST /api/auth/register
 * Admin registration of new user accounts
 */
router.post('/register', authenticate, async (req: Request, res: Response): Promise<void> => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const { role_id, employee_id, first_name, last_name, is_active } = req.body;
  
  try {
    // 1. Validate requirements
    if (!email || !password || !username) {
      res.status(400).json({ success: false, error: 'Email, username and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
      return;
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const id = (req as any).crypto?.randomUUID() || require('crypto').randomUUID();
    const activeFlag = is_active === 0 || is_active === false ? 0 : 1;

    // 3. Insert user
    await pool.query(
      `INSERT INTO users (id, email, username, password_hash, role_id, employee_id, first_name, last_name, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        email, 
        username, 
        password_hash, 
        role_id || null, 
        employee_id || null, 
        first_name ? String(first_name).trim() : null, 
        last_name ? String(last_name).trim() : null,
        activeFlag
      ]
    );

    res.json({ success: true, message: 'User registered successfully', userId: id });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      const isEmail = error.message.includes('email');
      res.status(400).json({ 
        success: false, 
        error: isEmail ? 'An account with this email address already exists.' : 'An account with this username already exists.' 
      });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user details and live permissions
 */
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows]: any = await pool.query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`, 
      [req.user.id]
    );
    const user = rows[0];

    if (!user) {
      res.status(404).json({ success: false, error: 'User account not found' });
      return;
    }

    if (user.is_active === 0 || user.is_active === false) {
      res.status(403).json({ success: false, error: 'Your account has been deactivated.' });
      return;
    }

    // Fetch live permissions
    const permissions = await getUserPermissions(user.role_id, user.role_name);

    const { password_hash: _, ...userWithoutPassword } = user;
    res.json({
      success: true,
      data: { 
        ...userWithoutPassword, 
        role: user.role_name, 
        role_name: user.role_name,
        permissions 
      }
    });

  } catch (error) {
    console.error('[Auth /me Error]:', error);
    res.status(500).json({ success: false, error: 'Server error retrieving user session' });
  }
});

export default router;
