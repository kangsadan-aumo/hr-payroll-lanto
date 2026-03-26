const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function verify() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'hr-payroll-db',
        port: parseInt(process.env.DB_PORT) || 3306,
    });

    try {
        const [tables] = await pool.query("SHOW TABLES LIKE 'claims'");
        if (tables.length > 0) {
            console.log('✅ Table "claims" exists.');
        } else {
            console.log('❌ Table "claims" does NOT exist.');
        }

        const [cols] = await pool.query("DESCRIBE payroll_records");
        const hasClaimsTotal = cols.some(c => c.Field === 'claims_total');
        console.log(hasClaimsTotal ? '✅ Column "claims_total" exists.' : '❌ Column "claims_total" missing.');
        
        await pool.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

verify();
