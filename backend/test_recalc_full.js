import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
dotenv.config({ path: './.env' });

async function test() {
    const pool = mysql.createPool({ 
        host: process.env.DB_HOST || 'localhost', 
        user: process.env.DB_USER || 'root', 
        password: process.env.DB_PASSWORD || '', 
        database: process.env.DB_NAME || 'hr-payroll-db', 
        port: parseInt(process.env.DB_PORT) || 3306, 
    });

    try {
        console.log('🔄 Starting FULL test recalculation...');
        const [rules] = await pool.query('SELECT * FROM leave_quota_rules ORDER BY tenure_years DESC');
        const [fixedTypes] = await pool.query('SELECT * FROM leave_types WHERE days_per_year > 0 AND id != 3');
        const [employees] = await pool.query('SELECT id, join_date FROM employees WHERE status = "active"'); 
        
        const now = dayjs();
        let updatedCount = 0;

        for (const emp of employees) {
            try {
                let vacationQuota = 0;
                if (emp.join_date) {
                    const joinDate = dayjs(emp.join_date);
                    const tenureYears = Math.floor(now.diff(joinDate, 'year', true));
                    const applicableRule = rules.find(r => tenureYears >= r.tenure_years);
                    vacationQuota = applicableRule ? applicableRule.vacation_days : 0;
                }

                await pool.query(`
                    INSERT INTO employee_leave_quotas (employee_id, leave_type_id, quota_days)
                    VALUES (?, 3, ?)
                    ON DUPLICATE KEY UPDATE quota_days = VALUES(quota_days)
                `, [emp.id, vacationQuota]);

                for (const lt of fixedTypes) {
                    await pool.query(`
                        INSERT INTO employee_leave_quotas (employee_id, leave_type_id, quota_days)
                        VALUES (?, ?, ?)
                        ON DUPLICATE KEY UPDATE quota_days = VALUES(quota_days)
                    `, [emp.id, lt.id, lt.days_per_year]);
                }
                updatedCount++;
                if (updatedCount % 20 === 0) console.log(`Processed ${updatedCount} employees...`);
            } catch (innerError) {
                console.error(`❌ FAILED for employee ID ${emp.id}:`, innerError.message);
                throw innerError;
            }
        }
        console.log(`✅ Success! Updated ${updatedCount} employees.`);
    } catch (error) {
        console.error('❌ GLOBAL FAILED:', error.message);
    } finally {
        await pool.end();
    }
}

test();
