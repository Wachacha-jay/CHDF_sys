import mysql from 'mysql2/promise';

async function testConnection() {
  console.log('Attempting to connect to 127.0.0.1...');
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'business_management'
    });
    console.log('Successfully connected to 127.0.0.1');
    const [rows] = await connection.query('SELECT 1 + 1 AS result');
    console.log('Query successful:', rows);
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Connection failed:');
    console.error(error);
    process.exit(1);
  }
}

testConnection();
