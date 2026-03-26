import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function alterTable() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'hr_system',
        port: parseInt(process.env.DB_PORT) || 3306,
    });

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS public_holidays (
                id INT AUTO_INCREMENT PRIMARY KEY,
                holiday_date DATE NOT NULL UNIQUE,
                name VARCHAR(150) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('Successfully created public_holidays table');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS employee_leave_quotas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT NOT NULL,
                leave_type_id INT NOT NULL,
                quota_days DECIMAL(5, 2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
                UNIQUE(employee_id, leave_type_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('Successfully created employee_leave_quotas table');

    } catch (err) {
        console.error('Error altering table:', err.message);
    } finally {
        await connection.end();
    }
}

alterTable();
