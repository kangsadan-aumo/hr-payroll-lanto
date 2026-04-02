import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
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
        
        const payload = {
            employee_id: 1, // assume id 1 exists
            leave_type_id: 1,
            start_date: '2026-04-03',
            end_date: '2026-04-03',
            total_days: 1,
            reason: 'Test Leave'
        };

        try {
            const [result] = await connection.query(
                'INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, total_days, reason) VALUES (?, ?, ?, ?, ?, ?)',
                [payload.employee_id, payload.leave_type_id, payload.start_date, payload.end_date, payload.total_days, payload.reason]
            );
            console.log('✅ Insert successful:', result);
        } catch (err) {
            console.error('❌ Insert failed:', err.message);
        }
        
        await connection.end();
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    }
}

test();
