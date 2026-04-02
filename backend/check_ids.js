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
        console.log('--- LEAVE TYPES ---');
        const [types] = await connection.query("SELECT * FROM leave_types");
        console.table(types);
        
        console.log('--- EMPLOYEES COUNT ---');
        const [emps] = await connection.query("SELECT COUNT(*) as count FROM employees");
        console.table(emps);
        
        await connection.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

check();
