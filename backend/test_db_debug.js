import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './.env' });

async function test() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'hr-payroll-db',
            port: parseInt(process.env.DB_PORT) || 3306,
        });
        console.log('✅ Connection successful!');
        const [rows] = await connection.query("SHOW TABLES");
        console.log('Tables:', rows.map(r => Object.values(r)[0]));
        await connection.end();
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    }
}

test();
