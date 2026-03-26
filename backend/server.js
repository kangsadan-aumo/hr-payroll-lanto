import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve uploads as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage });

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hr-payroll-db',
    port: parseInt(process.env.DB_PORT) || 3306,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0
});

// ─────────────────────────────────────────────
// 💡 HELPER: คำนวณประกันสังคม
// ─────────────────────────────────────────────
function calculateSSO(baseSalary) {
    // ประกันสังคม 5% ของเงินเดือน แต่ไม่เกิน 750 บาท/เดือน
    return Math.min(Math.floor(baseSalary * 0.05), 750);
}

// ─────────────────────────────────────────────
// 💡 HELPER: คำนวณภาษีเงินได้บุคคลธรรมดา (PIT) - แบบขั้นบันได (รวมลดหย่อน)
// ─────────────────────────────────────────────
function calculateIncomeTax(baseSalary, allowances = {}) {
    const annualIncome = baseSalary * 12;
    
    // รายได้หลังหักค่าใช้จ่าย (หักได้ 50% แต่ไม่เกิน 100,000)
    const expenses = Math.min(annualIncome * 0.5, 100000);
    
    // ลดหย่อนพื้นฐาน
    let totalAllowances = 60000; // ส่วนตัว
    
    // ลดหย่อนอื่นๆ
    if (allowances.spouse_allowance) totalAllowances += 60000;
    totalAllowances += (parseInt(allowances.children_count || 0) * 30000);
    totalAllowances += (parseInt(allowances.parents_care_count || 0) * 30000);
    
    // ประกันชีวิต/สุขภาพ (รวมกันไม่เกิน 100,000 โดยสุขภาพไม่เกิน 25,000)
    const health = Math.min(parseFloat(allowances.health_insurance || 0), 25000);
    const life = parseFloat(allowances.life_insurance || 0);
    totalAllowances += Math.min(health + life, 100000);
    
    // ประกันสังคม (หักตามจริงรายปี - สมมติ 750 * 12 = 9,000)
    totalAllowances += 9000; 

    const taxableIncome = Math.max(0, annualIncome - expenses - totalAllowances);
    
    if (taxableIncome <= 150000) return 0;
    
    let tax = 0;
    const tiers = [
        { limit: 150000, rate: 0 },
        { limit: 300000, rate: 0.05 },
        { limit: 500000, rate: 0.10 },
        { limit: 750000, rate: 0.15 },
        { limit: 1000000, rate: 0.20 },
        { limit: 2000000, rate: 0.25 },
        { limit: 5000000, rate: 0.30 },
        { limit: Infinity, rate: 0.35 }
    ];

    let remainingIncome = taxableIncome;
    let previousLimit = 0;

    for (const tier of tiers) {
        const incomeInTier = Math.min(remainingIncome, tier.limit - previousLimit);
        if (incomeInTier <= 0) break;
        
        tax += incomeInTier * tier.rate;
        remainingIncome -= incomeInTier;
        previousLimit = tier.limit;
    }

    return Math.floor(tax / 12);
}

// ─────────────────────────────────────────────
// 💡 HELPER: คำนวณค่าล่วงเวลา (OT)
// ─────────────────────────────────────────────
function calculateOTPay(baseSalary, hours, multiplier) {
    // ฐานคำนวณ: (เงินเดือน / 30 / 8) * ชั่วโมง * ตัวคูณ
    const hourlyRate = (baseSalary / 30 / 8);
    return Math.floor(hourlyRate * hours * multiplier);
}

// ─────────────────────────────────────────────
// 💡 AUDIT LOGGER
// ─────────────────────────────────────────────
async function logAudit(userId, action, targetTable, targetId, details) {
    try {
        await pool.query(
            'INSERT INTO audit_logs (user_id, action, target_table, target_id, details) VALUES (?, ?, ?, ?, ?)',
            [userId || 1, action, targetTable, targetId, JSON.stringify(details)]
        );
    } catch (err) {
        console.error('Audit log error:', err.message);
    }
}

// ─────────────────────────────────────────────
// TEST ROUTE
// ─────────────────────────────────────────────
app.get('/api/test', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 + 1 AS solution');
        res.json({ message: 'Database connected successfully', data: rows });
    } catch (error) {
        console.error('Database connection failed:', error);
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const today = dayjs().format('YYYY-MM-DD');
        const currentYearMonth = dayjs().format('YYYY-MM');

        // Total Counts
        const [[totalEmpRow]] = await pool.query("SELECT COUNT(*) as count FROM employees WHERE status = 'active'");
        const [[newEmpRow]] = await pool.query(
            "SELECT COUNT(*) as count FROM employees WHERE DATE_FORMAT(join_date, '%Y-%m') = ?", [currentYearMonth]
        );
        const [[pendingLeavesRow]] = await pool.query("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'");
        const [[resignedEmpRow]] = await pool.query(
            "SELECT COUNT(*) as count FROM employees WHERE status = 'inactive' AND DATE_FORMAT(updated_at, '%Y-%m') = ?", [currentYearMonth]
        );

        const totalActive = parseInt(totalEmpRow.count) || 0;

        // Today's Attendance
        const [[presentTodayRow]] = await pool.query(`
            SELECT COUNT(DISTINCT employee_id) as count 
            FROM attendance_logs 
            WHERE DATE(check_in_time) = ?
        `, [today]);

        const [[leaveTodayRow]] = await pool.query(`
            SELECT COUNT(DISTINCT employee_id) as count 
            FROM leave_requests 
            WHERE ? BETWEEN start_date AND end_date AND status = 'approved'
        `, [today]);

        const presentToday = parseInt(presentTodayRow.count) || 0;
        const leaveToday = parseInt(leaveTodayRow.count) || 0;
        const absentToday = Math.max(0, totalActive - presentToday - leaveToday);

        // 7-Day Trend (Approximate using past 7 days logs and leaves)
        const attendanceTrendData = [];
        for (let i = 6; i >= 0; i--) {
            const d = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
            const dayName = dayjs().subtract(i, 'day').locale('th').format('ddd'); // requires locale if needed, we'll use format('ddd')

            const [[pRow]] = await pool.query("SELECT COUNT(DISTINCT employee_id) as count FROM attendance_logs WHERE DATE(check_in_time) = ?", [d]);
            const [[lRow]] = await pool.query("SELECT COUNT(DISTINCT employee_id) as count FROM leave_requests WHERE ? BETWEEN start_date AND end_date AND status = 'approved'", [d]);

            const pCount = parseInt(pRow.count) || 0;
            const lCount = parseInt(lRow.count) || 0;
            const aCount = Math.max(0, totalActive - pCount - lCount);

            attendanceTrendData.push({
                name: dayName,
                present: pCount,
                leave: lCount,
                absent: aCount
            });
        }

        // Department Distribution
        const [departmentData] = await pool.query(`
            SELECT d.name, COUNT(e.id) as employees 
            FROM departments d 
            LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
            GROUP BY d.name
        `);

        // Recent Activities (Mix of recent hires, resignations, and approved leaves)
        const [recentHires] = await pool.query(`
            SELECT CONCAT('พนักงานเข้าใหม่: ', first_name, ' ', last_name, ' (', IFNULL(d.name, 'ไม่ระบุ'), ')') as title, 
                   join_date as event_time, 
                   'hire' as type 
            FROM employees e LEFT JOIN departments d ON e.department_id = d.id 
            ORDER BY join_date DESC LIMIT 3
        `);
        const [recentResigns] = await pool.query(`
            SELECT CONCAT('พนักงานลาออก: ', first_name, ' ', last_name) as title, 
                   updated_at as event_time, 
                   'resign' as type 
            FROM employees WHERE status = 'inactive' 
            ORDER BY updated_at DESC LIMIT 3
        `);
        const [recentLeaves] = await pool.query(`
            SELECT CONCAT(IF(lr.status='approved', 'อนุมัติการลา: ', 'ปฏิเสธการลา: '), IFNULL(lt.name, ''), ' (', e.first_name, ' ', e.last_name, ')') as title, 
                   lr.approved_at as event_time, 
                   'leave' as type 
            FROM leave_requests lr 
            JOIN employees e ON lr.employee_id = e.id 
            LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lr.status IN ('approved', 'rejected') AND lr.approved_at IS NOT NULL
            ORDER BY lr.approved_at DESC LIMIT 4
        `);

        // Merge, sort, and format time ago
        let recentActivities = [...recentHires, ...recentResigns, ...recentLeaves]
            .sort((a, b) => dayjs(b.event_time).valueOf() - dayjs(a.event_time).valueOf())
            .slice(0, 6)
            .map(act => {
                const diffHours = dayjs().diff(dayjs(act.event_time), 'hour');
                const diffDays = dayjs().diff(dayjs(act.event_time), 'day');
                let timeStr = 'เพิ่งเกิดขึ้น';
                if (diffDays > 0) timeStr = `${diffDays} วันที่แล้ว`;
                else if (diffHours > 0) timeStr = `${diffHours} ชั่วโมงที่แล้ว`;

                return {
                    title: act.title,
                    time: timeStr,
                    type: act.type
                };
            });

        res.json({
            stats: {
                totalEmployees: totalActive,
                newEmployees: parseInt(newEmpRow.count),
                pendingLeaves: parseInt(pendingLeavesRow.count),
                resignedEmployees: parseInt(resignedEmpRow.count),
            },
            todayAttendance: {
                present: presentToday,
                leave: leaveToday,
                absent: absentToday
            },
            recentActivities,
            charts: {
                attendanceTrendData,
                departmentData: departmentData.map(d => ({ name: d.name, employees: parseInt(d.employees) }))
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
app.get('/api/departments', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM departments ORDER BY id ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM system_settings LIMIT 1');
        res.json(rows[0] || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/settings', async (req, res) => {
    try {
        const payload = req.body;
        await pool.query(
            `UPDATE system_settings SET company_name=?, tax_id=?, address=?, deduct_excess_sick_leave=?, deduct_excess_personal_leave=?, late_penalty_per_minute=?, auto_deduct_tax=?, auto_deduct_sso=?, payroll_cutoff_date=?, diligence_allowance=? WHERE id=1`,
            [payload.company_name, payload.tax_id, payload.address, payload.deduct_excess_sick_leave, payload.deduct_excess_personal_leave, payload.late_penalty_per_minute, payload.auto_deduct_tax, payload.auto_deduct_sso, payload.payroll_cutoff_date, payload.diligence_allowance]
        );
        res.json({ message: 'Settings updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// EMPLOYEES
// ─────────────────────────────────────────────
app.get('/api/employees', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT e.*, d.name as department_name, s.name as shift_name, s.start_time as shift_start_time
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN shifts s ON e.shift_id = s.id
            ORDER BY e.id DESC
        `);
        const formatted = rows.map(r => ({
            id: r.id.toString(),
            employee_code: r.employee_code,
            name: `${r.first_name} ${r.last_name}`,
            department: r.department_name || 'ไม่ระบุ',
            position: r.position || '-',
            joinDate: r.join_date,
            status: r.status,
            phone: r.phone || '-',
            email: r.email || `${r.employee_code}@company.com`,
            baseSalary: r.base_salary,
            id_number: r.id_number,
            shift_id: r.shift_id,
            shift_name: r.shift_name,
            shift_start_time: r.shift_start_time
        }));
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/employees', async (req, res) => {
    try {
        const { employee_code, first_name, last_name, department_id, shift_id, position, join_date, status, base_salary, phone, email, id_number } = req.body;
        const code = employee_code || `EMP${Math.floor(100 + Math.random() * 900)}`;
        const [result] = await pool.query(
            `INSERT INTO employees (employee_code, first_name, last_name, department_id, shift_id, position, join_date, status, base_salary, phone, email, id_number)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [code, first_name, last_name, department_id, shift_id || null, position, join_date, status || 'active', base_salary || 0, phone || null, email || null, id_number || null]
        );
        res.status(201).json({ id: result.insertId, message: 'Employee created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, department_id, shift_id, position, join_date, status, base_salary, phone, email, id_number } = req.body;
        const [result] = await pool.query(
            `UPDATE employees SET first_name=?, last_name=?, department_id=?, shift_id=?, position=?, join_date=?, status=?, base_salary=?, phone=?, email=?, id_number=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [first_name, last_name, department_id, shift_id || null, position, join_date, status, base_salary, phone || null, email || null, id_number || null, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ message: 'Employee updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/employees/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM employees WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// IMPORT EMPLOYEE CSV
// ─────────────────────────────────────────────
app.post('/api/employees/import', async (req, res) => {
    try {
        const { employees } = req.body;
        if (!employees || !Array.isArray(employees)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }
        let created = 0, updated = 0, errors = [];
        for (const emp of employees) {
            try {
                let deptId = null;
                if (emp.department) {
                    const [deptRows] = await pool.query('SELECT id FROM departments WHERE name = ?', [emp.department]);
                    if (deptRows.length > 0) {
                        deptId = deptRows[0].id;
                    } else {
                        const [newDept] = await pool.query('INSERT INTO departments (name) VALUES (?)', [emp.department]);
                        deptId = newDept.insertId;
                    }
                }
                if (emp.id) {
                    const [exist] = await pool.query('SELECT id FROM employees WHERE id = ?', [emp.id]);
                    if (exist.length > 0) {
                        await pool.query(
                            `UPDATE employees SET first_name=?, last_name=?, department_id=?, position=?, join_date=?, status=?, base_salary=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
                            [emp.first_name, emp.last_name, deptId, emp.position, emp.join_date, emp.status || 'active', emp.base_salary || 0, emp.id]
                        );
                        updated++;
                        continue;
                    }
                }
                const code = emp.employee_code || `EMP${Math.floor(100 + Math.random() * 900)}`;
                await pool.query(
                    `INSERT INTO employees (employee_code, first_name, last_name, department_id, position, join_date, status, base_salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [code, emp.first_name, emp.last_name, deptId, emp.position, emp.join_date, emp.status || 'active', emp.base_salary || 0]
                );
                created++;
            } catch (e) {
                errors.push({ employee: emp.employee_code, error: e.message });
            }
        }
        res.json({ message: `Import complete`, created, updated, errors });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// EMPLOYEE LEAVE QUOTAS
// ─────────────────────────────────────────────
app.get('/api/employees/:id/leave-quotas', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT lt.id as leave_type_id, lt.name as leave_name, 
                   IFNULL(eq.quota_days, 0) as quota_days
            FROM leave_types lt
            LEFT JOIN employee_leave_quotas eq 
              ON lt.id = eq.leave_type_id AND eq.employee_id = ?
            WHERE lt.is_unpaid = 0
            ORDER BY lt.id ASC
        `, [req.params.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/employees/:id/leave-quotas', async (req, res) => {
    try {
        const employeeId = req.params.id;
        const { quotas } = req.body; // Array of { leave_type_id, quota_days }

        // Loop and UPSERT
        for (const q of quotas) {
            const currentQuota = parseFloat(q.quota_days) || 0;
            const [existing] = await pool.query('SELECT id FROM employee_leave_quotas WHERE employee_id=? AND leave_type_id=?', [employeeId, q.leave_type_id]);
            if (existing.length > 0) {
                await pool.query('UPDATE employee_leave_quotas SET quota_days=? WHERE employee_id=? AND leave_type_id=?', [currentQuota, employeeId, q.leave_type_id]);
            } else {
                await pool.query('INSERT INTO employee_leave_quotas (employee_id, leave_type_id, quota_days) VALUES (?, ?, ?)', [employeeId, q.leave_type_id, currentQuota]);
            }
        }
        res.json({ message: 'บันทึกโควตาวันลาสำเร็จ' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// LEAVES (วันลาต่างๆ)
// ─────────────────────────────────────────────
app.get('/api/leaves/requests', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT lr.*, l.name as leave_type_name, 
                   CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                   d.name as department
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            JOIN leave_types l ON lr.leave_type_id = l.id
            LEFT JOIN departments d ON e.department_id = d.id
            ORDER BY lr.submitted_at DESC
        `);
        const formatted = rows.map(r => ({ ...r, id: r.id.toString(), total_days: parseFloat(r.total_days) }));
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/leaves/requests', async (req, res) => {
    try {
        const { employee_id, leave_type_id, start_date, end_date, total_days, reason } = req.body;
        const [result] = await pool.query(
            'INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, total_days, reason) VALUES (?, ?, ?, ?, ?, ?)',
            [employee_id || 1, leave_type_id || 1, start_date, end_date, total_days, reason]
        );
        res.status(201).json({ id: result.insertId.toString(), message: 'Leave request created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/leaves/requests/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const [result] = await pool.query(
            'UPDATE leave_requests SET status = ?, approved_at=CURRENT_TIMESTAMP WHERE id = ?',
            [status, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Leave request not found' });
        res.json({ message: `Leave request ${status}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// LEAVES IMPORT (BULK UPSERT)
// ─────────────────────────────────────────────
app.post('/api/leaves/import', async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || records.length === 0) {
            return res.status(400).json({ error: 'ไม่มีข้อมูลที่จะนำเข้า' });
        }

        let inserted = 0;
        let replaced = 0;
        const errors = [];

        for (const rec of records) {
            try {
                // หา employee_id จาก employee_code
                const [empRows] = await pool.query(
                    'SELECT id FROM employees WHERE employee_code = ?',
                    [rec.employeeId]
                );

                if (empRows.length === 0) {
                    errors.push({ code: rec.employeeId, error: 'ไม่พบรหัสพนักงานในระบบ' });
                    continue;
                }

                const employeeId = empRows[0].id;

                // หา leave_type_id จากชื่อ
                const [typeRows] = await pool.query(
                    'SELECT id FROM leave_types WHERE name = ?',
                    [rec.leaveType]
                );

                let leaveTypeId;
                if (typeRows.length === 0) {
                    const [resType] = await pool.query('INSERT INTO leave_types (name) VALUES (?)', [rec.leaveType]);
                    leaveTypeId = resType.insertId;
                } else {
                    leaveTypeId = typeRows[0].id;
                }

                // UPSERT: เช็คว่าพนักงานคนนี้เคยลาช่วงนี้ไปแล้วหรือยัง
                const [existing] = await pool.query(
                    `SELECT id FROM leave_requests 
                     WHERE employee_id = ? AND start_date = ? AND end_date = ?`,
                    [employeeId, rec.startDate, rec.endDate]
                );

                if (existing.length > 0) {
                    await pool.query(
                        `DELETE FROM leave_requests WHERE employee_id = ? AND start_date = ? AND end_date = ?`,
                        [employeeId, rec.startDate, rec.endDate]
                    );
                    replaced++;
                } else {
                    inserted++;
                }

                await pool.query(
                    `INSERT INTO leave_requests 
                        (employee_id, leave_type_id, start_date, end_date, total_days, reason, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        employeeId,
                        leaveTypeId,
                        rec.startDate,
                        rec.endDate,
                        rec.days || 1,
                        rec.reason || 'Imported via CSV',
                        rec.status === 'รอหัวหน้าอนุมัติ' || rec.status === 'pending' ? 'pending' : 'approved'
                    ]
                );

            } catch (e) {
                errors.push({ code: rec.employeeId, error: e.message });
            }
        }

        res.json({
            message: `นำเข้าสำเร็จ: เพิ่มใหม่ ${inserted} รายการ, แทนที่ ${replaced} รายการ`,
            inserted,
            replaced,
            total: inserted + replaced,
            errors,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// SHIFTS
// ─────────────────────────────────────────────
app.get('/api/shifts', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM shifts ORDER BY id ASC');
        const formatted = rows.map(r => ({
            id: r.id.toString(), shiftName: r.name, startTime: r.start_time,
            endTime: r.end_time, lateThreshold: r.late_allowance_minutes, color: r.color || 'blue'
        }));
        res.json(formatted);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/shifts', async (req, res) => {
    try {
        const { shiftName, startTime, endTime, lateThreshold, color } = req.body;
        const [result] = await pool.query(
            'INSERT INTO shifts (name, start_time, end_time, late_allowance_minutes, color) VALUES (?, ?, ?, ?, ?)',
            [shiftName, startTime, endTime, lateThreshold, color]
        );
        res.status(201).json({ id: result.insertId.toString() });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/shifts/:id', async (req, res) => {
    try {
        const { shiftName, startTime, endTime, lateThreshold, color } = req.body;
        await pool.query(
            'UPDATE shifts SET name=?, start_time=?, end_time=?, late_allowance_minutes=?, color=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
            [shiftName, startTime, endTime, lateThreshold, color, req.params.id]
        );
        res.json({ message: 'Updated' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/shifts/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM shifts WHERE id=?', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─────────────────────────────────────────────
// LEAVE QUOTA RULES
// ─────────────────────────────────────────────
app.get('/api/leave-rules', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM leave_quota_rules ORDER BY tenure_years ASC');
        res.json(rows.map(r => ({ id: r.id.toString(), minYears: r.tenure_years, maxYears: r.tenure_years, vacationDays: r.vacation_days })));
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/leave-rules', async (req, res) => {
    try {
        const [result] = await pool.query('INSERT INTO leave_quota_rules (tenure_years, vacation_days) VALUES (?, ?)', [req.body.minYears, req.body.vacationDays]);
        res.status(201).json({ id: result.insertId.toString() });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/leave-rules/:id', async (req, res) => {
    try {
        await pool.query('UPDATE leave_quota_rules SET tenure_years=?, vacation_days=? WHERE id=?', [req.body.minYears, req.body.vacationDays, req.params.id]);
        res.json({ message: 'Updated' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/leave-rules/:id', async (req, res) => {
    try { await pool.query('DELETE FROM leave_quota_rules WHERE id=?', [req.params.id]); res.json({ message: 'Deleted' }); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

// ─────────────────────────────────────────────
// LEAVE TYPES
// ─────────────────────────────────────────────
app.get('/api/leave-types', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM leave_types ORDER BY id ASC');
        res.json(rows.map(r => ({ id: r.id.toString(), leaveName: r.name, isDeductSalary: r.is_unpaid })));
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/leave-types', async (req, res) => {
    try {
        const [result] = await pool.query('INSERT INTO leave_types (name, is_unpaid) VALUES (?, ?)', [req.body.leaveName, req.body.isDeductSalary]);
        res.status(201).json({ id: result.insertId.toString() });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/leave-types/:id', async (req, res) => {
    try {
        await pool.query('UPDATE leave_types SET name=?, is_unpaid=? WHERE id=?', [req.body.leaveName, req.body.isDeductSalary, req.params.id]);
        res.json({ message: 'Updated' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/leave-types/:id', async (req, res) => {
    try { await pool.query('DELETE FROM leave_types WHERE id=?', [req.params.id]); res.json({ message: 'Deleted' }); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

// ─────────────────────────────────────────────
// SYSTEM SETTINGS
// ─────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM system_settings LIMIT 1');
        res.json(rows[0] || {});
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/settings', async (req, res) => {
    try {
        const { company_name, tax_id, address, deduct_excess_sick_leave, deduct_excess_personal_leave,
            late_penalty_per_minute, auto_deduct_tax, auto_deduct_sso, payroll_cutoff_date, diligence_allowance } = req.body;
        await pool.query(`
            UPDATE system_settings SET 
                company_name=COALESCE(?, company_name), tax_id=COALESCE(?, tax_id), address=COALESCE(?, address),
                deduct_excess_sick_leave=COALESCE(?, deduct_excess_sick_leave),
                deduct_excess_personal_leave=COALESCE(?, deduct_excess_personal_leave),
                late_penalty_per_minute=COALESCE(?, late_penalty_per_minute),
                auto_deduct_tax=COALESCE(?, auto_deduct_tax), auto_deduct_sso=COALESCE(?, auto_deduct_sso),
                payroll_cutoff_date=COALESCE(?, payroll_cutoff_date),
                diligence_allowance=COALESCE(?, diligence_allowance),
                updated_at=CURRENT_TIMESTAMP
        `, [company_name, tax_id, address, deduct_excess_sick_leave, deduct_excess_personal_leave,
            late_penalty_per_minute, auto_deduct_tax, auto_deduct_sso, payroll_cutoff_date, diligence_allowance]);
        res.json({ message: 'Settings updated' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─────────────────────────────────────────────
// 🧠 PAYROLL — GET (ดึงจาก payroll_records ถ้ามี, ไม่มีดึง preview)
// ─────────────────────────────────────────────
app.get('/api/payroll', async (req, res) => {
    try {
        const month = parseInt(req.query.month) || dayjs().month() + 1;
        const year = parseInt(req.query.year) || dayjs().year();

        // ลองดึงจาก payroll_records ก่อน
        const [saved] = await pool.query(`
            SELECT pr.*, CONCAT(e.first_name, ' ', e.last_name) as name, e.employee_code,
                   d.name as department, e.base_salary as emp_base_salary
            FROM payroll_records pr
            JOIN employees e ON pr.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE pr.period_month = ? AND pr.period_year = ?
            ORDER BY e.id ASC
        `, [month, year]);

        if (saved.length > 0) {
            const result = saved.map(r => ({
                employeeId: r.employee_code,
                employee_id: r.employee_id,
                name: r.name,
                department: r.department || 'ไม่ระบุ',
                baseSalary: parseFloat(r.base_salary),
                earnings: {
                    overtime: parseFloat(r.overtime_pay),
                    bonus: parseFloat(r.bonus),
                    diligenceAllowance: parseFloat(r.diligence_allowance || 0),
                },
                deductions: {
                    tax: parseFloat(r.tax_deduction),
                    socialSecurity: parseFloat(r.sso_deduction),
                    latePenalty: parseFloat(r.late_deduction),
                    unpaidLeave: parseFloat(r.leave_deduction),
                },
                netSalary: parseFloat(r.net_salary),
                status: r.status,
                period: { month, year },
            }));
            return res.json(result);
        }

        // ถ้ายังไม่มี → ส่ง preview (ยังไม่บันทึก)
        const [settingsRows] = await pool.query('SELECT * FROM system_settings LIMIT 1');
        const settings = settingsRows[0] || {};
        const diligenceAllowance = parseFloat(settings.diligence_allowance || 0);
        const latePenaltyPerMin = parseFloat(settings.late_penalty_per_minute || 0);
        const autoDeductTax = settings.auto_deduct_tax !== 0;
        const autoDeductSSO = settings.auto_deduct_sso !== 0;

        const [employees] = await pool.query(`
            SELECT e.id, e.employee_code, CONCAT(e.first_name, ' ', e.last_name) as name,
                   d.name as department, e.base_salary, e.shift_id,
                   e.spouse_allowance, e.children_count, e.parents_care_count,
                   e.health_insurance, e.life_insurance, e.pvf_rate, e.pvf_employer_rate
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE e.status = 'active'
        `);

        // ดึง attendance และ OT
        const monthStr = String(month).padStart(2, '0');
        const yearStr = String(year);

        const [attendanceLogs] = await pool.query(`
            SELECT employee_id, SUM(late_minutes) as total_late_minutes,
                   COUNT(*) as work_days
            FROM attendance_logs
            WHERE DATE_FORMAT(check_in_time, '%m') = ? AND DATE_FORMAT(check_in_time, '%Y') = ?
            GROUP BY employee_id
        `, [monthStr, yearStr]);
        const attendanceMap = {};
        attendanceLogs.forEach(a => { attendanceMap[a.employee_id] = a; });

        const [otLogs] = await pool.query(`
            SELECT employee_id, multiplier, SUM(hours) as total_hours
            FROM overtime_requests
            WHERE status = 'approved' AND DATE_FORMAT(date, '%m') = ? AND DATE_FORMAT(date, '%Y') = ?
            GROUP BY employee_id, multiplier
        `, [monthStr, yearStr]);
        const otMap = {};
        otLogs.forEach(o => {
            if (!otMap[o.employee_id]) otMap[o.employee_id] = {};
            otMap[o.employee_id][o.multiplier] = parseFloat(o.total_hours);
        });

        // ดึง unpaid leave
        const [unpaidLeaves] = await pool.query(`
            SELECT lr.employee_id, SUM(lr.total_days) as unpaid_days
            FROM leave_requests lr
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lt.is_unpaid = 1 AND lr.status = 'approved'
              AND DATE_FORMAT(lr.start_date, '%m') = ? AND DATE_FORMAT(lr.start_date, '%Y') = ?
            GROUP BY lr.employee_id
        `, [monthStr, yearStr]);
        const leaveMap = {};
        unpaidLeaves.forEach(l => { leaveMap[l.employee_id] = l; });

        const preview = employees.map(e => {
            const baseSalary = parseFloat(e.base_salary || 0);
            const att = attendanceMap[e.id];
            
            // OT
            const empOt = otMap[e.id] || {};
            const ot1_5_pay = calculateOTPay(baseSalary, empOt['1.5'] || 0, 1.5);
            const ot2_pay = calculateOTPay(baseSalary, empOt['2.0'] || empOt['2'] || 0, 2.0);
            const ot3_pay = calculateOTPay(baseSalary, empOt['3.0'] || empOt['3'] || 0, 3.0);
            const totalOT = ot1_5_pay + ot2_pay + ot3_pay;

            // PVF
            const pvfEmployee = Math.floor(baseSalary * (parseFloat(e.pvf_rate || 0) / 100));
            const pvfEmployer = Math.floor(baseSalary * (parseFloat(e.pvf_employer_rate || 0) / 100));

            // ค่าปรับสาย
            const totalLateMinutes = att ? parseInt(att.total_late_minutes || 0) : 0;
            const latePenalty = Math.floor(totalLateMinutes * latePenaltyPerMin);

            // หักลา
            const lv = leaveMap[e.id];
            const unpaidDays = lv ? parseFloat(lv.unpaid_days || 0) : 0;
            const unpaidLeaveDeduction = Math.floor((baseSalary / 30) * unpaidDays);

            // เบี้ยขยัน (เงื่อนไขอัตโนมัติ: ไม่สาย และไม่มีลาไม่รับเงิน)
            const earnedDiligence = (totalLateMinutes === 0 && unpaidDays === 0) ? diligenceAllowance : 0;

            // ภาษี (PIT) - ส่ง allowances ไปคำนวณ
            const taxDeduction = autoDeductTax ? calculateIncomeTax(baseSalary, e) : 0;
            const ssoDeduction = autoDeductSSO ? calculateSSO(baseSalary) : 0;

            return {
                employeeId: e.employee_code,
                employee_id: e.id,
                name: e.name,
                department: e.department || 'ไม่ระบุ',
                baseSalary,
                earnings: { overtime: totalOT, bonus: 0, diligenceAllowance: earnedDiligence, ot1_5_pay, ot2_pay, ot3_pay },
                deductions: { tax: taxDeduction, socialSecurity: ssoDeduction, latePenalty, unpaidLeave: unpaidLeaveDeduction, pvfEmployee },
                pvfEmployer,
                netSalary: baseSalary + totalOT + earnedDiligence - taxDeduction - ssoDeduction - latePenalty - unpaidLeaveDeduction - pvfEmployee,
                status: 'draft',
                period: { month, year },
                isPreview: true,
            };
        });

        res.json(preview);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// 🧠 PAYROLL — CALCULATE & SAVE to payroll_records
// ─────────────────────────────────────────────
app.post('/api/payroll/calculate', async (req, res) => {
    try {
        const month = parseInt(req.body.month) || dayjs().month() + 1;
        const year = parseInt(req.body.year) || dayjs().year();
        const monthStr = String(month).padStart(2, '0');
        const yearStr = String(year);

        const [settingsRows] = await pool.query('SELECT * FROM system_settings LIMIT 1');
        const settings = settingsRows[0] || {};
        const diligenceAllowance = parseFloat(settings.diligence_allowance || 0);
        const latePenaltyPerMin = parseFloat(settings.late_penalty_per_minute || 0);
        const autoDeductTax = settings.auto_deduct_tax !== 0;
        const autoDeductSSO = settings.auto_deduct_sso !== 0;

        const [employees] = await pool.query(`
            SELECT e.id, e.employee_code, CONCAT(e.first_name, ' ', e.last_name) as name,
                   d.name as department, e.base_salary,
                   e.spouse_allowance, e.children_count, e.parents_care_count,
                   e.health_insurance, e.life_insurance, e.pvf_rate, e.pvf_employer_rate
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE e.status = 'active'
        `);

        // Fetch Data Maps
        const [attendanceLogs] = await pool.query(`
            SELECT employee_id, SUM(late_minutes) as total_late_minutes
            FROM attendance_logs
            WHERE DATE_FORMAT(check_in_time, '%m') = ? AND DATE_FORMAT(check_in_time, '%Y') = ?
            GROUP BY employee_id
        `, [monthStr, yearStr]);
        const attendanceMap = {};
        attendanceLogs.forEach(a => { attendanceMap[a.employee_id] = a; });

        const [otLogs] = await pool.query(`
            SELECT employee_id, multiplier, SUM(hours) as total_hours
            FROM overtime_requests
            WHERE status = 'approved' AND DATE_FORMAT(date, '%m') = ? AND DATE_FORMAT(date, '%Y') = ?
            GROUP BY employee_id, multiplier
        `, [monthStr, yearStr]);
        const otMap = {};
        otLogs.forEach(o => {
            if (!otMap[o.employee_id]) otMap[o.employee_id] = {};
            otMap[o.employee_id][o.multiplier] = parseFloat(o.total_hours);
        });

        const [claims] = await pool.query(`
            SELECT employee_id, SUM(amount) as total_claims
            FROM claims
            WHERE status = 'approved' AND payroll_id IS NULL
              AND DATE_FORMAT(receipt_date, '%m') = ? AND DATE_FORMAT(receipt_date, '%Y') = ?
            GROUP BY employee_id
        `, [monthStr, yearStr]);
        const claimsMap = {};
        claims.forEach(c => { claimsMap[c.employee_id] = c; });

        const [unpaidLeaves] = await pool.query(`
            SELECT lr.employee_id, SUM(lr.total_days) as unpaid_days
            FROM leave_requests lr
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lt.is_unpaid = 1 AND lr.status = 'approved'
              AND DATE_FORMAT(lr.start_date, '%m') = ? AND DATE_FORMAT(lr.start_date, '%Y') = ?
            GROUP BY lr.employee_id
        `, [monthStr, yearStr]);
        const leaveMap = {};
        unpaidLeaves.forEach(l => { leaveMap[l.employee_id] = l; });

        let savedCount = 0;
        for (const e of employees) {
            const baseSalary = parseFloat(e.base_salary || 0);
            
            // OT Calculation
            const empOt = otMap[e.id] || {};
            const ot1_5_pay = calculateOTPay(baseSalary, empOt['1.5'] || 0, 1.5);
            const ot2_pay = calculateOTPay(baseSalary, empOt['2.0'] || empOt['2'] || 0, 2.0);
            const ot3_pay = calculateOTPay(baseSalary, empOt['3.0'] || empOt['3'] || 0, 3.0);
            const totalOT = ot1_5_pay + ot2_pay + ot3_pay;

            // Health/Deductions
            const att = attendanceMap[e.id];
            const lateMinutes = att ? parseInt(att.total_late_minutes || 0) : 0;
            const latePenalty = Math.floor(lateMinutes * latePenaltyPerMin);
            const lv = leaveMap[e.id];
            const unpaidDays = lv ? parseFloat(lv.unpaid_days || 0) : 0;
            const unpaidLeaveDeduction = Math.floor((baseSalary / 30) * unpaidDays);

            const cl = claimsMap[e.id];
            const totalClaims = cl ? parseFloat(cl.total_claims || 0) : 0;
            const earnedDiligence = (lateMinutes === 0 && unpaidDays === 0) ? diligenceAllowance : 0;

            // PVF
            const pvfEmployee = Math.floor(baseSalary * (parseFloat(e.pvf_rate || 0) / 100));
            const pvfEmployer = Math.floor(baseSalary * (parseFloat(e.pvf_employer_rate || 0) / 100));
            
            // Tax & SSO
            const taxDeduction = autoDeductTax ? calculateIncomeTax(baseSalary, e) : 0;
            const ssoDeduction = autoDeductSSO ? calculateSSO(baseSalary) : 0;

            const netSalary = baseSalary + totalOT + earnedDiligence + totalClaims - taxDeduction - ssoDeduction - latePenalty - unpaidLeaveDeduction - pvfEmployee;

            // Upsert
            await pool.query(
                'DELETE FROM payroll_records WHERE employee_id=? AND period_month=? AND period_year=?',
                [e.id, month, year]
            );
            const [payrollRes] = await pool.query(`
                INSERT INTO payroll_records 
                    (employee_id, period_month, period_year, base_salary, overtime_pay, bonus,
                     late_deduction, leave_deduction, tax_deduction, sso_deduction, diligence_allowance, claims_total, net_salary, 
                     pvf_employee_amount, pvf_employer_amount, ot_1_5_pay, ot_2_pay, ot_3_pay, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
            `, [e.id, month, year, baseSalary, totalOT, 0, latePenalty, unpaidLeaveDeduction, taxDeduction, ssoDeduction, earnedDiligence, totalClaims, netSalary,
                pvfEmployee, pvfEmployer, ot1_5_pay, ot2_pay, ot3_pay]);
            
            const payrollId = payrollRes.insertId;

            // Fix claims
            await pool.query(
                "UPDATE claims SET payroll_id = ?, status = 'paid' WHERE employee_id = ? AND status = 'approved' AND payroll_id IS NULL AND DATE_FORMAT(receipt_date, '%m') = ? AND DATE_FORMAT(receipt_date, '%Y') = ?",
                [payrollId, e.id, monthStr, yearStr]
            );

            savedCount++;
        }

        res.json({ message: `คำนวณเงินเดือนเสร็จแล้ว บันทึก ${savedCount} รายการ`, month, year, count: savedCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// PAYROLL — APPROVE (เปลี่ยน status เป็น paid)
// ─────────────────────────────────────────────
app.put('/api/payroll/approve', async (req, res) => {
    try {
        const { employee_codes, month, year } = req.body;
        const m = parseInt(month) || dayjs().month() + 1;
        const y = parseInt(year) || dayjs().year();

        if (!employee_codes || employee_codes.length === 0) {
            return res.status(400).json({ error: 'No employees selected' });
        }

        const [empRows] = await pool.query(
            `SELECT id FROM employees WHERE employee_code IN (${employee_codes.map(() => '?').join(',')})`,
            employee_codes
        );
        const empIds = empRows.map(r => r.id);

        if (empIds.length === 0) return res.status(404).json({ error: 'No employees found' });

        await pool.query(
            `UPDATE payroll_records SET status='paid' WHERE employee_id IN (${empIds.map(() => '?').join(',')}) AND period_month=? AND period_year=?`,
            [...empIds, m, y]
        );
        res.json({ message: `อนุมัติจ่ายเงินเดือนสำเร็จ ${empIds.length} คน` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// PAYROLL — ADJUST (แก้ไขรายละเอียดเงินเดือน)
// ─────────────────────────────────────────────
app.put('/api/payroll/adjust', async (req, res) => {
    try {
        const {
            employee_code, month, year,
            overtime_pay, bonus, diligence_allowance,
            late_deduction, leave_deduction, tax_deduction, sso_deduction,
            note
        } = req.body;

        const m = parseInt(month);
        const y = parseInt(year);

        // หา employee_id
        const [empRows] = await pool.query(
            'SELECT id FROM employees WHERE employee_code = ?', [employee_code]
        );
        if (empRows.length === 0) return res.status(404).json({ error: 'ไม่พบพนักงาน' });
        const employeeId = empRows[0].id;

        // หา base_salary ปัจจุบัน
        const [recRows] = await pool.query(
            'SELECT base_salary FROM payroll_records WHERE employee_id=? AND period_month=? AND period_year=?',
            [employeeId, m, y]
        );
        if (recRows.length === 0) return res.status(404).json({ error: 'ไม่พบข้อมูลเงินเดือนรอบนี้ กรุณาคำนวณก่อน' });

        const baseSalary = parseFloat(recRows[0].base_salary);
        const ot = parseFloat(overtime_pay ?? 0);
        const bns = parseFloat(bonus ?? 0);
        const dil = parseFloat(diligence_allowance ?? 0);
        const lateDed = parseFloat(late_deduction ?? 0);
        const leaveDed = parseFloat(leave_deduction ?? 0);
        const taxDed = parseFloat(tax_deduction ?? 0);
        const ssoDed = parseFloat(sso_deduction ?? 0);

        // คำนวณ net ใหม่
        const newNet = baseSalary + ot + bns + dil - lateDed - leaveDed - taxDed - ssoDed;

        await pool.query(`
            UPDATE payroll_records SET
                overtime_pay = ?, bonus = ?, diligence_allowance = ?,
                late_deduction = ?, leave_deduction = ?, tax_deduction = ?, sso_deduction = ?,
                net_salary = ?, status = 'draft'
            WHERE employee_id = ? AND period_month = ? AND period_year = ?
        `, [ot, bns, dil, lateDed, leaveDed, taxDed, ssoDed, newNet, employeeId, m, y]);

        res.json({
            message: 'แก้ไขข้อมูลเงินเดือนสำเร็จ',
            net_salary: newNet,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ─────────────────────────────────────────────
// PAYROLL HISTORY (ประวัติรอบที่บันทึกแล้ว)
// ─────────────────────────────────────────────
app.get('/api/payroll/history', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT period_year, period_month, COUNT(*) as employee_count,
                   SUM(net_salary) as total_net, SUM(base_salary) as total_gross,
                   SUM(tax_deduction + sso_deduction) as total_tax_sso,
                   MAX(status) as status
            FROM payroll_records
            GROUP BY period_year, period_month
            ORDER BY period_year DESC, period_month DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// 📥 ATTENDANCE IMPORT (CSV → DB with upsert)
// ─────────────────────────────────────────────

// GET ดึงข้อมูล attendance จาก DB พร้อมสรุปรายพนักงาน
app.get('/api/attendance', async (req, res) => {
    try {
        const month = req.query.month ? String(req.query.month).padStart(2, '0') : null;
        const year = req.query.year ? String(req.query.year) : null;

        let whereClause = '';
        const params = [];
        if (month && year) {
            whereClause = `WHERE DATE_FORMAT(al.check_in_time, '%m') = ? AND DATE_FORMAT(al.check_in_time, '%Y') = ?`;
            params.push(month, year);
        }

        const [rows] = await pool.query(`
            SELECT al.*, 
                   e.employee_code, CONCAT(e.first_name,' ',e.last_name) as emp_name,
                   d.name as department,
                   s.start_time as shift_start_time,
                   s.late_allowance_minutes
            FROM attendance_logs al
            JOIN employees e ON al.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN shifts s ON e.shift_id = s.id
            ${whereClause}
            ORDER BY al.check_in_time DESC
        `, params);

        // โหลดกะทั้งหมดเพื่อจับคู่ในกรณีที่พนักงานไม่มีกะ (กะไม่แน่นอน)
        const [allShifts] = await pool.query('SELECT * FROM shifts ORDER BY start_time ASC');

        // สรุปรายพนักงาน
        const summaryMap = {};
        rows.forEach(r => {
            const key = r.employee_code;
            if (!summaryMap[key]) {
                summaryMap[key] = {
                    employeeId: r.employee_code,
                    name: r.emp_name,
                    department: r.department || 'ไม่ระบุ',
                    workDays: 0,        // วันทำงานทั้งหมด (รวม เสาร์-อาทิตย์)
                    weekdays: 0,        // จันทร์-ศุกร์
                    weekends: 0,        // เสาร์-อาทิตย์
                    onTimeDays: 0,      // มาตรงเวลา ไม่สาย
                    lateCount: 0,       // มาสาย
                    totalLateMinutes: 0,
                };
            }
            const s = summaryMap[key];
            s.workDays++;

            // ตรวจสอบว่าเป็นวันหยุดสุดสัปดาห์หรือไม่
            if (r.check_in_time) {
                const day = dayjs(r.check_in_time).day(); // 0=Sun, 6=Sat
                if (day === 0 || day === 6) {
                    s.weekends++;
                } else {
                    s.weekdays++;
                }

                let actualShiftStart = r.shift_start_time;
                let actualAllowance = parseInt(r.late_allowance_minutes || 0);
                
                // สำหรับพนักงานที่ไม่มีกะประจำ (กะไม่แน่นอน) ให้ตรวจจับกะที่ใกล้ที่สุดจากเวลาเช็คอิน
                if (!actualShiftStart && allShifts.length > 0) {
                    const checkInDayjs = dayjs(r.check_in_time);
                    const cMins = checkInDayjs.hour() * 60 + checkInDayjs.minute();
                    
                    let minDiff = 9999;
                    let bestShift = null;

                    allShifts.forEach(s => {
                        if (s.start_time) {
                            const [sh, sm] = s.start_time.split(':').map(Number);
                            const sMins = sh * 60 + sm;
                            let diff = Math.abs(cMins - sMins);
                            if (diff > 720) diff = 1440 - diff;
                            if (diff < minDiff) {
                                minDiff = diff;
                                bestShift = s;
                            }
                        }
                    });

                    if (bestShift && minDiff <= 300) { // ต้องไม่ห่างเกิน 5 ชั่วโมง
                        actualShiftStart = bestShift.start_time;
                        actualAllowance = parseInt(bestShift.late_allowance_minutes || 0);
                        r.detected_shift_name = bestShift.name; // แนบชื่อกะกลับไปให้ UI
                    }
                }

                // คำนวณสายอิงจากกะ
                if (actualShiftStart) {
                    const checkInDayjs = dayjs(r.check_in_time);
                    const cMins = checkInDayjs.hour() * 60 + checkInDayjs.minute();
                    const [sh, sm] = actualShiftStart.split(':').map(Number);
                    const sMins = sh * 60 + sm;
                    
                    let diff = cMins - sMins;
                    if (diff < -720) diff += 1440; // ข้ามวัน

                    if (diff > actualAllowance) {
                        r.status = 'late';
                        r.late_minutes = diff - actualAllowance;
                    } else {
                        r.status = 'on_time';
                        r.late_minutes = 0;
                    }
                }
            }

            if (r.status === 'late') {
                s.lateCount++;
                s.totalLateMinutes += parseInt(r.late_minutes || 0);
            } else {
                s.onTimeDays++; // ตรงเวลา (ไม่สาย)
            }
        });

        res.json({
            logs: rows,
            summary: Object.values(summaryMap),
            total: rows.length,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST นำเข้าข้อมูล attendance จาก CSV (upsert: ลบซ้ำแล้วใส่ใหม่)
app.post('/api/attendance/import', async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ error: 'ไม่มีข้อมูลที่จะนำเข้า' });
        }

        let inserted = 0;
        let replaced = 0;
        const errors = [];

        for (const rec of records) {
            try {
                // หา employee_id จาก employee_code
                const [empRows] = await pool.query(
                    'SELECT id FROM employees WHERE employee_code = ?',
                    [rec.employee_code]
                );

                if (empRows.length === 0) {
                    errors.push({ code: rec.employee_code, error: 'ไม่พบรหัสพนักงานในระบบ' });
                    continue;
                }

                const employeeId = empRows[0].id;
                const checkInDatetime = rec.check_in_time || null;
                const checkDate = checkInDatetime ? checkInDatetime.substring(0, 10) : null;

                // UPSERT: ถ้ามีข้อมูลวันเดิมของพนักงานนั้น → ลบทิ้งแล้วใส่ใหม่
                if (checkDate) {
                    const [existing] = await pool.query(
                        `SELECT id FROM attendance_logs 
                         WHERE employee_id = ? AND DATE(check_in_time) = ?`,
                        [employeeId, checkDate]
                    );

                    if (existing.length > 0) {
                        await pool.query(
                            `DELETE FROM attendance_logs WHERE employee_id = ? AND DATE(check_in_time) = ?`,
                            [employeeId, checkDate]
                        );
                        replaced++;
                    } else {
                        inserted++;
                    }
                } else {
                    inserted++;
                }

                // คำนวณ late_minutes จาก shift ของพนักงาน (ถ้ามี)
                const [shiftRows] = await pool.query(`
                    SELECT s.start_time, s.late_allowance_minutes
                    FROM employees e
                    LEFT JOIN shifts s ON e.shift_id = s.id
                    WHERE e.id = ?
                `, [employeeId]);

                let lateMinutes = 0;
                let attendanceStatus = rec.status || 'on_time';

                if (shiftRows.length > 0 && shiftRows[0].start_time && checkInDatetime) {
                    const shiftStart = shiftRows[0].start_time; // "HH:MM:SS"
                    const allowance = parseInt(shiftRows[0].late_allowance_minutes || 0);
                    const checkInTime = checkInDatetime.substring(11, 19) || checkInDatetime.substring(11);

                    if (checkInTime) {
                        const [sh, sm] = shiftStart.split(':').map(Number);
                        const [ch, cm] = checkInTime.split(':').map(Number);
                        const diff = (ch * 60 + cm) - (sh * 60 + sm);
                        if (diff > allowance) {
                            lateMinutes = diff - allowance;
                            attendanceStatus = 'late';
                        }
                    }
                } else if (rec.status) {
                    // ใช้ status จาก CSV
                    if (rec.status.includes('สาย') || rec.status === 'late') {
                        attendanceStatus = 'late';
                        lateMinutes = parseInt(rec.late_minutes || 0);
                    }
                }

                await pool.query(`
                    INSERT INTO attendance_logs 
                        (employee_id, check_in_time, check_out_time, status, late_minutes)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    employeeId,
                    rec.check_in_time || null,
                    rec.check_out_time || null,
                    attendanceStatus,
                    lateMinutes
                ]);

            } catch (e) {
                errors.push({ code: rec.employee_code, error: e.message });
            }
        }

        res.json({
            message: `นำเข้าสำเร็จ: เพิ่มใหม่ ${inserted} รายการ, แทนที่ ${replaced} รายการ`,
            inserted,
            replaced,
            total: inserted + replaced,
            errors,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// 💸 CLAIMS & REIMBURSEMENTS
// ─────────────────────────────────────────────
app.get('/api/claims', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT c.*, CONCAT(e.first_name, ' ', e.last_name) as employee_name, e.employee_code
            FROM claims c
            JOIN employees e ON c.employee_id = e.id
            ORDER BY c.receipt_date DESC
        `);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/claims', async (req, res) => {
    try {
        const { employee_id, claim_type, amount, receipt_date, description } = req.body;
        await pool.query(
            'INSERT INTO claims (employee_id, claim_type, amount, receipt_date, description) VALUES (?, ?, ?, ?, ?)',
            [employee_id, claim_type, amount, receipt_date, description]
        );
        res.status(201).json({ message: 'Claim submitted' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/claims/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await pool.query('UPDATE claims SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: `Claim ${status}` });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/claims/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM claims WHERE id = ?', [req.params.id]);
        res.json({ message: 'Claim deleted' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─────────────────────────────────────────────
// START SERVER + AUTO MIGRATION
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function runMigrations() {
    const migrations = [
        `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS diligence_allowance DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS diligence_allowance DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT NULL`,
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS email VARCHAR(150) DEFAULT NULL`,
        `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS claims_total DECIMAL(10,2) DEFAULT 0.00`,
        `CREATE TABLE IF NOT EXISTS claims (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            claim_type VARCHAR(100) NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            receipt_date DATE NOT NULL,
            description TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            payroll_id INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS probation_end_date DATE DEFAULT NULL`,
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_end_date DATE DEFAULT NULL`,
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL`,
        `CREATE TABLE IF NOT EXISTS employee_documents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            document_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(255) NOT NULL,
            category VARCHAR(100),
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS disciplinary_records (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            type VARCHAR(100) NOT NULL,
            description TEXT,
            issued_at DATE NOT NULL,
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            action VARCHAR(100) NOT NULL,
            target_table VARCHAR(100),
            target_id INT,
            details JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS id_number VARCHAR(13) DEFAULT NULL`,
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS spouse_allowance TINYINT(1) DEFAULT 0`,
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS children_count INT DEFAULT 0`,
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS parents_care_count INT DEFAULT 0`,
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS health_insurance DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS life_insurance DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS pvf_rate DECIMAL(5,2) DEFAULT 0.00`,
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS pvf_employer_rate DECIMAL(5,2) DEFAULT 0.00`,
        `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS pvf_employee_amount DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS pvf_employer_amount DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS ot_1_5_pay DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS ot_2_pay DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS ot_3_pay DECIMAL(10,2) DEFAULT 0.00`,
        `CREATE TABLE IF NOT EXISTS overtime_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            date DATE NOT NULL,
            hours DECIMAL(5,2) NOT NULL,
            multiplier DECIMAL(3,1) DEFAULT 1.5,
            reason TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            approved_by INT,
            approved_at TIMESTAMP NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS shift_schedules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            shift_id INT NOT NULL,
            date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
            UNIQUE(employee_id, date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ];
    for (const sql of migrations) {
        try {
            await pool.query(sql);
        } catch (err) {
            console.warn('Migration skipped:', err.message);
        }
    }
    console.log('✅ Database migrations done.');
}

// ─────────────────────────────────────────────
// PUBLIC HOLIDAYS (วันหยุดนักขัตฤกษ์)
// ─────────────────────────────────────────────
app.get('/api/settings/holidays', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM public_holidays ORDER BY holiday_date ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/settings/holidays', async (req, res) => {
    try {
        const { date, name } = req.body;
        if (!date || !name) return res.status(400).json({ error: 'กรุณาระบุวันที่และชื่อวันหยุด' });

        await pool.query('INSERT INTO public_holidays (holiday_date, name) VALUES (?, ?)', [date, name]);
        res.status(201).json({ message: 'เพิ่มวันหยุดนักขัตฤกษ์สำเร็จ' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'มีวันหยุดในระบบสำหรับวันนี้แล้ว' });
        }
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/settings/holidays/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM public_holidays WHERE id = ?', [req.params.id]);
        res.json({ message: 'ลบวันหยุดสำเร็จ' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// 📄 GOVERNMENT REPORTS (Tax & SSO)
// ─────────────────────────────────────────────

// 1. พ.ง.ด. 1 (Monthly Withholding Tax)
app.get('/api/reports/pnd1', async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) return res.status(400).json({ error: 'กรุณาระบุเดือนและปี' });

        const [rows] = await pool.query(`
            SELECT pr.*, e.first_name, e.last_name, e.id_number, d.name as department
            FROM payroll_records pr
            JOIN employees e ON pr.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE pr.period_month = ? AND pr.period_year = ? AND pr.status = 'paid'
        `, [month, year]);

        const [settings] = await pool.query('SELECT * FROM system_settings LIMIT 1');
        const company = settings[0] || {};

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('PND1');

        sheet.columns = [
            { header: 'ลำดับ', key: 'idx', width: 5 },
            { header: 'เลขประจำตัวประจำตัวผู้เสียภาษี (ID Number)', key: 'id_number', width: 20 },
            { header: 'ชื่อ-นามสกุล', key: 'name', width: 25 },
            { header: 'เงินเดือน/เงินได้', key: 'income', width: 15 },
            { header: 'ภาษีที่หักไว้', key: 'tax', width: 15 },
            { header: 'เงื่อนไขหักภาษี', key: 'type', width: 10 },
        ];

        rows.forEach((r, i) => {
            sheet.addRow({
                idx: i + 1,
                id_number: r.id_number || '-',
                name: `${r.first_name} ${r.last_name}`,
                income: parseFloat(r.base_salary) + parseFloat(r.overtime_pay) + parseFloat(r.bonus),
                tax: parseFloat(r.tax_deduction),
                type: '1' // หัก ณ ที่จ่าย
            });
        });

        // Add Header rows for company info
        sheet.insertRow(1, ['รายงานภาษีเงินได้หัก ณ ที่จ่าย (พ.ง.ด. 1)']);
        sheet.insertRow(2, [`บริษัท: ${company.company_name || '-'}`, '', `Tax ID: ${company.tax_id || '-'}`]);
        sheet.insertRow(3, [`ประจำเดือน: ${month}/${year}`]);
        sheet.insertRow(4, []); // Empty

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=PND1_${month}_${year}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 2. สปส. 1-10 (Social Security Report)
app.get('/api/reports/sso', async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) return res.status(400).json({ error: 'กรุณาระบุเดือนและปี' });

        const [rows] = await pool.query(`
            SELECT pr.*, e.first_name, e.last_name, e.id_number
            FROM payroll_records pr
            JOIN employees e ON pr.employee_id = e.id
            WHERE pr.period_month = ? AND pr.period_year = ? AND pr.status = 'paid'
        `, [month, year]);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('SSO_1_10');

        sheet.columns = [
            { header: 'ลำดับ', key: 'idx', width: 5 },
            { header: 'เลขบัตรประชาชน', key: 'id_number', width: 20 },
            { header: 'ชื่อ-นามสกุล', key: 'name', width: 25 },
            { header: 'ค่าจ้าง (ไม่เกิน 15,000)', key: 'salary', width: 15 },
            { header: 'เงินสมทบ (5%)', key: 'sso', width: 15 },
        ];

        rows.forEach((r, i) => {
            const cappedSalary = Math.min(15000, parseFloat(r.base_salary));
            sheet.addRow({
                idx: i + 1,
                id_number: r.id_number || '-',
                name: `${r.first_name} ${r.last_name}`,
                salary: cappedSalary,
                sso: parseFloat(r.sso_deduction)
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=SSO_${month}_${year}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 3. ทวิ 50 (Annual Withholding Tax Certificate)
app.get('/api/reports/50tawi/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { year } = req.query;
        if (!year) return res.status(400).json({ error: 'กรุณาระบุปี' });

        const [records] = await pool.query(`
            SELECT SUM(base_salary + overtime_pay + bonus) as total_income,
                   SUM(tax_deduction) as total_tax,
                   SUM(sso_deduction) as total_sso
            FROM payroll_records
            WHERE employee_id = ? AND period_year = ? AND status = 'paid'
        `, [id, year]);

        const [[emp]] = await pool.query('SELECT * FROM employees WHERE id = ?', [id]);
        const [[company]] = await pool.query('SELECT * FROM system_settings LIMIT 1');

        if (!emp) return res.status(404).json({ error: 'พนักงานไม่พบ' });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('50Tawi');

        sheet.addRow(['หนังสือรับรองการหักภาษี ณ ที่จ่าย (ทวิ 50)']);
        sheet.addRow([`ประจำปีภาษี: ${year}`]);
        sheet.addRow([]);
        sheet.addRow(['ผู้มีหน้าที่หัก ณ ที่จ่าย (บริษัท)']);
        sheet.addRow([`ชื่อ: ${company?.company_name || '-'}`]);
        sheet.addRow([`เลขประจำตัวผู้เสียภาษี: ${company?.tax_id || '-'}`]);
        sheet.addRow([`ที่อยู่: ${company?.address || '-'}`]);
        sheet.addRow([]);
        sheet.addRow(['ผู้ถูกหัก ณ ที่จ่าย (พนักงาน)']);
        sheet.addRow([`ชื่อ: ${emp.first_name} ${emp.last_name}`]);
        sheet.addRow([`เลขประจำตัวประชาชน: ${emp.id_number || '-'}`]);
        sheet.addRow([]);
        sheet.addRow(['รายการเงินได้', 'จำนวนเงินที่จ่าย (บาท)', 'ภาษีที่หักและนำส่ง (บาท)']);
        sheet.addRow(['1. เงินเดือน ค่าจ้าง โบนัส ฯลฯ', records[0].total_income || 0, records[0].total_tax || 0]);
        sheet.addRow([]);
        sheet.addRow([`เงินสมทบกองทุนประกันสังคม: ${records[0].total_sso || 0} บาท`]);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=50Tawi_${emp.first_name}_${year}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─────────────────────────────────────────────
// DASHBOARD & ANALYTICS
// ─────────────────────────────────────────────
app.get('/api/dashboard/payroll-trends', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT period_year as year, period_month as month, 
                SUM(net_salary) as total_net, 
                SUM(base_salary) as total_base,
                SUM(overtime_pay) as total_ot
            FROM payroll_records 
            WHERE status = 'paid'
            GROUP BY period_year, period_month 
            ORDER BY period_year DESC, period_month DESC 
            LIMIT 6
        `);
        res.json(rows.reverse());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/dashboard/attendance-stats', async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        const [lateRows] = await pool.query(`
            SELECT al.employee_id, COUNT(*) as late_count 
            FROM attendance_logs al
            JOIN employees e ON al.employee_id = e.id
            LEFT JOIN shifts s ON e.shift_id = s.id
            WHERE YEAR(al.check_in_time) = ? AND MONTH(al.check_in_time) = ? 
              AND (
                (s.start_time IS NOT NULL AND TIME_TO_SEC(TIME(al.check_in_time)) > TIME_TO_SEC(s.start_time) + (IFNULL(s.late_allowance_minutes, 0) * 60))
                OR (s.start_time IS NULL AND al.late_minutes > 0)
              )
            GROUP BY al.employee_id
            HAVING late_count >= 3
        `, [currentYear, currentMonth]);

        const [leaveRows] = await pool.query(`
            SELECT COUNT(*) as unpaid_leaves
            FROM leave_requests lr
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE YEAR(lr.start_date) = ? AND MONTH(lr.start_date) = ? AND lr.status = 'approved' AND lt.is_unpaid = 1
        `, [currentYear, currentMonth]);

        res.json({
            frequentLates: lateRows.length,
            unpaidLeaves: leaveRows[0]?.unpaid_leaves || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/analytics/cost-summary', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT d.name as department, 
                   SUM(pr.base_salary + pr.overtime_pay + pr.bonus + pr.diligence_allowance + pr.claims_total) as total_cost,
                   SUM(pr.base_salary) as base_total,
                   SUM(pr.overtime_pay) as ot_total,
                   SUM(pr.claims_total) as claims_total
            FROM payroll_records pr
            JOIN employees e ON pr.employee_id = e.id
            JOIN departments d ON e.department_id = d.id
            WHERE pr.status = 'paid'
            GROUP BY d.name
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────
// HR ADMIN — ADVANCED FEATURES
// ─────────────────────────────────────────────

// Employee Admin Info (Probation, Contract, Notes)
app.put('/api/employees/:id/admin', async (req, res) => {
    try {
        const { probation_end_date, contract_end_date, notes } = req.body;
        await pool.query(
            'UPDATE employees SET probation_end_date=?, contract_end_date=?, notes=? WHERE id=?',
            [probation_end_date, contract_end_date, notes, req.params.id]
        );
        logAudit(null, 'UPDATE_ADMIN_INFO', 'employees', req.params.id, { probation_end_date, contract_end_date });
        res.json({ message: 'ข้อมูลแอดมินอัปเดตแล้ว' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Documents Management
app.post('/api/employees/:id/documents', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const { category } = req.body;
        const [result] = await pool.query(
            'INSERT INTO employee_documents (employee_id, document_name, file_path, category) VALUES (?, ?, ?, ?)',
            [req.params.id, req.file.originalname, req.file.path, category]
        );
        logAudit(null, 'UPLOAD_DOC', 'employee_documents', result.insertId, { filename: req.file.originalname });
        res.status(201).json({ message: 'อัปโหลดเอกสารสำเร็จ' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/employees/:id/documents', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM employee_documents WHERE employee_id=?', [req.params.id]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/documents/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT file_path FROM employee_documents WHERE id=?', [req.params.id]);
        if (rows.length > 0 && fs.existsSync(rows[0].file_path)) {
            fs.unlinkSync(rows[0].file_path);
        }
        await pool.query('DELETE FROM employee_documents WHERE id=?', [req.params.id]);
        logAudit(null, 'DELETE_DOC', 'employee_documents', req.params.id, {});
        res.json({ message: 'ลบเอกสารแล้ว' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Disciplinary Records
app.post('/api/employees/:id/disciplinary', async (req, res) => {
    try {
        const { type, description, issued_at } = req.body;
        const [result] = await pool.query(
            'INSERT INTO disciplinary_records (employee_id, type, description, issued_at) VALUES (?, ?, ?, ?)',
            [req.params.id, type, description, issued_at]
        );
        logAudit(null, 'ADD_DISCIPLINARY', 'disciplinary_records', result.insertId, { type });
        res.status(201).json({ message: 'บันทึกประวัติวินัยสำเร็จ' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/employees/:id/disciplinary', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM disciplinary_records WHERE employee_id=? ORDER BY issued_at DESC', [req.params.id]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Admin Alerts (Dashboard Notifications)
app.get('/api/admin/alerts', async (req, res) => {
    try {
        const today = dayjs().format('YYYY-MM-DD');
        const nextMonth = dayjs().add(30, 'day').format('YYYY-MM-DD');

        // Contract Expiry
        const [contracts] = await pool.query(
            'SELECT id, first_name, last_name, contract_end_date FROM employees WHERE contract_end_date BETWEEN ? AND ?',
            [today, nextMonth]
        );
        // Probation Expiry
        const [probations] = await pool.query(
            'SELECT id, first_name, last_name, probation_end_date FROM employees WHERE probation_end_date BETWEEN ? AND ?',
            [today, nextMonth]
        );
        // Pending Claims
        const [claims] = await pool.query('SELECT COUNT(*) as count FROM claims WHERE status="pending"');

        res.json({
            expiringContracts: contracts.map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, date: c.contract_end_date })),
            expiringProbations: probations.map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, date: p.probation_end_date })),
            pendingClaimsCount: claims[0].count
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Calendar Events
app.get('/api/admin/calendar', async (req, res) => {
    try {
        const events = [];
        
        const [emps] = await pool.query('SELECT id, first_name, last_name, join_date, probation_end_date, contract_end_date FROM employees WHERE status="active"');
        
        emps.forEach(e => {
            const name = `${e.first_name} ${e.last_name}`;
            if (e.join_date) {
                // Simplified anniversary for current year
                const joinDay = dayjs(e.join_date).format('MM-DD');
                const currYearJoin = `${dayjs().year()}-${joinDay}`;
                events.push({ date: currYearJoin, type: 'success', content: `ครบรอบเริ่มงาน: ${name}` });
            }
            if (e.probation_end_date) {
                events.push({ date: dayjs(e.probation_end_date).format('YYYY-MM-DD'), type: 'warning', content: `ครบโปร: ${name}` });
            }
            if (e.contract_end_date) {
                events.push({ date: dayjs(e.contract_end_date).format('YYYY-MM-DD'), type: 'error', content: `หมดสัญญา: ${name}` });
            }
        });

        // Leaves
        const [leaves] = await pool.query(`
            SELECT lr.start_date, lt.name as type_name, e.first_name, e.last_name 
            FROM leave_requests lr 
            JOIN leave_types lt ON lr.leave_type_id = lt.id 
            JOIN employees e ON lr.employee_id = e.id
            WHERE lr.status = 'approved'
        `);
        leaves.forEach(l => {
            events.push({ date: dayjs(l.start_date).format('YYYY-MM-DD'), type: 'processing', content: `ลา ${l.type_name}: ${l.first_name}` });
        });

        res.json(events);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Audit Logs
app.get('/api/admin/audit-logs', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

runMigrations()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Migration error:', err);
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} (migration failed)`));
    });
