-- HR Payroll System Database Schema
-- Designed for MySQL / MariaDB

CREATE DATABASE IF NOT EXISTS `hr_payroll_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `hr_payroll_db`;

-- 1. Departments Table
CREATE TABLE `departments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Shifts Table (กะการทำงาน)
CREATE TABLE `shifts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL,
    `late_allowance_minutes` INT DEFAULT 0,
    `color` VARCHAR(20) DEFAULT 'blue',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Employees Table
CREATE TABLE `employees` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_code` VARCHAR(50) UNIQUE NOT NULL, -- เช่น EMP001
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `department_id` INT,
    `position` VARCHAR(100),
    `join_date` DATE NOT NULL,
    `status` ENUM('active', 'inactive') DEFAULT 'active',
    `shift_id` INT,
    `base_salary` DECIMAL(10, 2) DEFAULT 0.00,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL
);

-- 4. Leave Types (ประเภทการลา)
CREATE TABLE `leave_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `is_unpaid` BOOLEAN DEFAULT FALSE, -- หักเงินเดือนหรือไม่ (0 = ไม่หัก, 1 = หัก)
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Leave Requests (คำขอการลา)
CREATE TABLE `leave_requests` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `leave_type_id` INT NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `total_days` DECIMAL(5, 2) NOT NULL,
    `reason` TEXT,
    `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    `submitted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `approved_by` INT, -- ID ของหัวหน้าหรือ HR
    `approved_at` TIMESTAMP NULL,
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`approved_by`) REFERENCES `employees`(`id`) ON DELETE SET NULL
);

-- 6. Leave Quota Rules (สิทธิ์การลาตามอายุงาน)
CREATE TABLE `leave_quota_rules` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `tenure_years` INT NOT NULL,
    `vacation_days` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. System Settings (ตั้งค่าบริษัทและการหักเงิน)
CREATE TABLE `system_settings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `company_name` VARCHAR(255) NOT NULL,
    `tax_id` VARCHAR(50),
    `address` TEXT,
    `deduct_excess_sick_leave` BOOLEAN DEFAULT FALSE,
    `deduct_excess_personal_leave` BOOLEAN DEFAULT FALSE,
    `late_penalty_per_minute` DECIMAL(10, 2) DEFAULT 0.00,
    `auto_deduct_tax` BOOLEAN DEFAULT TRUE,
    `auto_deduct_sso` BOOLEAN DEFAULT TRUE,
    `payroll_cutoff_date` INT DEFAULT 25,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 8. Attendance (ข้อมูลเข้า-ออกงาน)
CREATE TABLE `attendance_logs` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `check_in_time` DATETIME NULL,
    `check_out_time` DATETIME NULL,
    `status` ENUM('on_time', 'late', 'absent', 'half_day') DEFAULT 'on_time',
    `late_minutes` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE
);

-- 9. Payroll Records (ประวัติการจ่ายเงินเดือน)
CREATE TABLE `payroll_records` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `period_month` INT NOT NULL, -- 1-12
    `period_year` INT NOT NULL,  -- e.g., 2026
    `base_salary` DECIMAL(10, 2) NOT NULL,
    `overtime_pay` DECIMAL(10, 2) DEFAULT 0.00,
    `bonus` DECIMAL(10, 2) DEFAULT 0.00,
    `late_deduction` DECIMAL(10, 2) DEFAULT 0.00,
    `leave_deduction` DECIMAL(10, 2) DEFAULT 0.00, -- หักจาก unpaid leave หรือลาเกินโควต้า
    `tax_deduction` DECIMAL(10, 2) DEFAULT 0.00,
    `sso_deduction` DECIMAL(10, 2) DEFAULT 0.00,
    `net_salary` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('draft', 'paid') DEFAULT 'draft',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE
);

-- Insert Default Data
INSERT INTO `departments` (`name`) VALUES ('HR'), ('IT Support'), ('Accounting'), ('Sales'), ('Marketing'), ('Warehouse'), ('Transport');
INSERT INTO `leave_types` (`name`, `is_unpaid`) VALUES ('ลาป่วย (Sick Leave)', 0), ('ลากิจ (Personal Leave)', 0), ('ลาพักร้อน (Vacation)', 0), ('ลางานไม่รับค่าจ้าง (LWOP)', 1);
INSERT INTO `leave_quota_rules` (`tenure_years`, `vacation_days`) VALUES (1, 6), (2, 7), (3, 8), (4, 9), (5, 10);
INSERT INTO `system_settings` (`company_name`, `tax_id`, `address`, `deduct_excess_sick_leave`, `deduct_excess_personal_leave`, `late_penalty_per_minute`, `payroll_cutoff_date`)
VALUES ('บริษัท ทดสอบ จำกัด', '0123456789012', '123 ถ.สุขุมวิท กรุงเทพฯ', 1, 1, 10.00, 25);
