import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'business_management',
  waitForConnections: true,
  connectionLimit: 15,
  maxIdle: 10,
  idleTimeout: 30000,
  queueLimit: 0,
  decimalNumbers: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 15000
});

// Resilient pool error listener to prevent uncaught socket drop exceptions
pool.on('connection', (connection) => {
  connection.on('error', (err: any) => {
    console.error('[MySQL Pool Connection Event Error]:', err?.message || err);
  });
});

export default pool;
