const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../server/.env') });

async function checkUser() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.query('SELECT * FROM users WHERE email = ?', ['admin@business.com']);
        console.log('User check:', rows);

        if (rows.length === 0) {
            console.log('Admin user NOT FOUND. Creating one...');
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash('admin123', salt);
            await connection.query(
                'INSERT INTO users (id, email, password_hash, first_name, last_name, is_active) VALUES (UUID(), ?, ?, ?, ?, ?)',
                ['admin@business.com', hash, 'Super', 'Admin', 1]
            );
            console.log('Admin user created successfully.');
        } else {
            console.log('Admin user found. Resetting password to admin123...');
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash('admin123', salt);
            await connection.query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, 'admin@business.com']);
            console.log('Admin password reset successfully.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

checkUser();
