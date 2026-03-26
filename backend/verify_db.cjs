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

async function verify() {
    try {
        const [tables] = await pool.query("SHOW TABLES LIKE 'claims'");
        if (tables.length > 0) {
            console.log('✅ Table "claims" exists.');
            const [columns] = await pool.query("DESCRIBE claims");
            console.log('Columns in "claims":', columns.map(c => c.Field).join(', '));
        } else {
            console.log('❌ Table "claims" does NOT exist.');
        }

        const [payrollCols] = await pool.query("DESCRIBE payroll_records");
        const hasClaimsTotal = payrollCols.some(c => c.Field === 'claims_total');
        console.log(hasClaimsTotal ? '✅ "payroll_records" has "claims_total" column.' : '❌ "payroll_records" is missing "claims_total" column.');

        process.exit(0);
    } catch (err) {
        console.error('Error verifying database:', err.message);
        process.exit(1);
    }
}

verify();
