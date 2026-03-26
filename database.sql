-- HR Payroll System Database Schema
-- Designed for MariaDB / MySQL

-- Create and select the database
CREATE DATABASE IF NOT EXISTS `hr-payroll-db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `hr-payroll-db`;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Shifts Table (กะการทำงาน)
CREATE TABLE IF NOT EXISTS shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    late_allowance_minutes INT DEFAULT 0,
    color VARCHAR(20) DEFAULT 'blue',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    department_id INT,
    position VARCHAR(100),
    join_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    shift_id INT,
    base_salary DECIMAL(10, 2) DEFAULT 0.00,
    phone VARCHAR(20) DEFAULT NULL,
    email VARCHAR(150) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Leave Types (ประเภทการลา)
CREATE TABLE IF NOT EXISTS leave_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_unpaid TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Leave Requests (คำขอการลา)
CREATE TABLE IF NOT EXISTS leave_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    leave_type_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(5, 2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Leave Quota Rules (สิทธิ์การลาตามอายุงาน)
CREATE TABLE IF NOT EXISTS leave_quota_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenure_years INT NOT NULL,
    vacation_days INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. System Settings (ตั้งค่าบริษัทและการหักเงิน)
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50),
    address TEXT,
    deduct_excess_sick_leave TINYINT(1) DEFAULT 0,
    deduct_excess_personal_leave TINYINT(1) DEFAULT 0,
    late_penalty_per_minute DECIMAL(10, 2) DEFAULT 0.00,
    auto_deduct_tax TINYINT(1) DEFAULT 1,
    auto_deduct_sso TINYINT(1) DEFAULT 1,
    payroll_cutoff_date INT DEFAULT 25,
    diligence_allowance DECIMAL(10, 2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Attendance Logs (ข้อมูลเข้า-ออกงาน)
CREATE TABLE IF NOT EXISTS attendance_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    check_in_time TIMESTAMP NULL,
    check_out_time TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'on_time',
    late_minutes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Payroll Records (ประวัติการจ่ายเงินเดือน)
CREATE TABLE IF NOT EXISTS payroll_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    period_month INT NOT NULL,
    period_year INT NOT NULL,
    base_salary DECIMAL(10, 2) NOT NULL,
    overtime_pay DECIMAL(10, 2) DEFAULT 0.00,
    bonus DECIMAL(10, 2) DEFAULT 0.00,
    diligence_allowance DECIMAL(10, 2) DEFAULT 0.00,
    late_deduction DECIMAL(10, 2) DEFAULT 0.00,
    leave_deduction DECIMAL(10, 2) DEFAULT 0.00,
    tax_deduction DECIMAL(10, 2) DEFAULT 0.00,
    sso_deduction DECIMAL(10, 2) DEFAULT 0.00,
    net_salary DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Public Holidays (วันหยุดนักขัตฤกษ์)
CREATE TABLE IF NOT EXISTS public_holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    holiday_date DATE NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Employee Leave Quotas (โควตาวันลาสำหรับพนักงานแต่ละคน)
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

-- Insert Default Data
INSERT INTO departments (name) VALUES
    ('HR'), ('IT Support'), ('Accounting'), ('Sales'), ('Marketing'), ('Warehouse'), ('Transport');

INSERT INTO leave_types (name, is_unpaid) VALUES
    ('ลาป่วย (Sick Leave)', 0),
    ('ลากิจ (Personal Leave)', 0),
    ('ลาพักร้อน (Vacation)', 0),
    ('ลางานไม่รับค่าจ้าง (LWOP)', 1);

INSERT INTO leave_quota_rules (tenure_years, vacation_days) VALUES
    (1, 6), (2, 7), (3, 8), (4, 9), (5, 10);

INSERT INTO system_settings (company_name, tax_id, address, deduct_excess_sick_leave, deduct_excess_personal_leave, late_penalty_per_minute, payroll_cutoff_date)
VALUES ('บริษัท ทดสอบ จำกัด', '0123456789012', '123 ถ.สุขุมวิท กรุงเทพฯ', 1, 1, 10.00, 25);
