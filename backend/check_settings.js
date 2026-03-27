import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hr-payroll-db',
    port: parseInt(process.env.DB_PORT) || 3306,
});

async function checkSettings() {
    try {
        const [rows] = await pool.query('SELECT * FROM system_settings');
        console.log('--- System Settings ---');
        console.log(rows);
        if (rows.length === 0) {
            console.log('No settings found. Initializing...');
            await pool.query('INSERT INTO system_settings (id, company_name) VALUES (1, "My Company")');
            console.log('Initialized with ID 1');
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
checkSettings();
