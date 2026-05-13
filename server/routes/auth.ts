import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password required' });
    return;
  }

  try {
    // 1. Fetch user with role info
    const [rows]: any = await pool.query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.email = ? OR u.username = ?`, 
      [email, email]
    );
    const user = rows[0];

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // 2. Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // 3. Fetch permissions for the role
    let permissions: string[] = [];
    if (user.role_id) {
       const [pRows]: any = await pool.query(
         `SELECT p.name FROM permissions p 
          JOIN role_permissions rp ON p.id = rp.permission_id 
          WHERE rp.role_id = ?`,
         [user.role_id]
       );
       permissions = pRows.map((p: any) => p.name);
    }

    // 4. Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role_name, permissions }, 
      process.env.JWT_SECRET || 'your-secret-key', 
      { expiresIn: '7d' }
    );

    const { password_hash: _, ...userWithoutPassword } = user;
    res.json({
      success: true,
      data: {
        user: { ...userWithoutPassword, role: user.role_name, permissions },
        token
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/register', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { email, username, password, role_id, employee_id, first_name, last_name } = req.body;
  
  try {
    // 1. Validate requirements
    if (!email || !password || !username) {
      res.status(400).json({ success: false, error: 'Email, username and password required' });
      return;
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const id = (req as any).crypto?.randomUUID() || require('crypto').randomUUID();

    // 3. Insert user
    await pool.query(
      `INSERT INTO users (id, email, username, password_hash, role_id, employee_id, first_name, last_name) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, email, username, password_hash, role_id || null, employee_id || null, first_name || null, last_name || null]
    );

    res.json({ success: true, message: 'User registered successfully' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, error: 'Email or username already exists' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

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
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Fetch permissions
    let permissions: string[] = [];
    if (user.role_id) {
       const [pRows]: any = await pool.query(
         `SELECT p.name FROM permissions p 
          JOIN role_permissions rp ON p.id = rp.permission_id 
          WHERE rp.role_id = ?`,
         [user.role_id]
       );
       permissions = pRows.map((p: any) => p.name);
    }

    const { password_hash: _, ...userWithoutPassword } = user;
    res.json({
      success: true,
      data: { ...userWithoutPassword, role: user.role_name, permissions }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
