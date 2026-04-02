import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function check() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'hr-payroll-db',
            port: parseInt(process.env.DB_PORT) || 3306,
        });
        console.log('✅ Connection successful!');
        const [rows] = await connection.query("SHOW COLUMNS FROM leave_requests");
        console.table(rows);
        await connection.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

check();
