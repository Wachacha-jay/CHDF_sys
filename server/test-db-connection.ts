import pool from './config/db';

async function testConnection() {
  console.log('Attempting to connect to database...');
  try {
    const connection = await pool.getConnection();
    console.log('Successfully got a connection from the pool.');
    
    const [rows] = await connection.query('SELECT 1 + 1 AS result');
    console.log('Query successful:', rows);
    
    connection.release();
    console.log('Connection released.');
    
    await pool.end();
    console.log('Pool closed.');
    process.exit(0);
  } catch (error) {
    console.error('Database connection failed:');
    console.error(error);
    process.exit(1);
  }
}

testConnection();
