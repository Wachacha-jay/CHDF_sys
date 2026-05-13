const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  
  await conn.query(`
    ALTER TABLE internal_transfers 
    ADD COLUMN IF NOT EXISTS transfer_type ENUM('direct_transfer', 'internal_loan', 'loan_repayment') 
    DEFAULT 'direct_transfer'
  `);
  
  console.log('Column transfer_type added to internal_transfers');
  await conn.end();
}

run().catch(console.error);
