const mysql = require('mysql2');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../server/.env') });

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    }).promise();

    try {
        const [rows] = await connection.query('SELECT email FROM users WHERE email = ?', ['admin@business.com']);
        console.log('User list:', rows);
    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

run();
