const mysql = require('../server/node_modules/mysql2/promise');
require('../server/node_modules/dotenv').config({ path: '../server/.env' });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'business_management',
  });
  const [rows] = await conn.query('DESCRIBE employees');
  console.log(JSON.stringify(rows, null, 2));
  await conn.end();
}

main().catch(console.error);
