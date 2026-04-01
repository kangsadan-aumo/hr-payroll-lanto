export interface AttendanceRecord {
    date: string; // วันที่
    employeeId: string; // รหัสพนักงาน
    name: string; // ชื่อ-นามสกุล
    department: string; // แผนก
    branch: string; // สาขาที่เข้างาน
    checkInDate: string; // วันที่เข้างาน
    checkInTime: string; // เวลาเข้างาน
    checkOutDate: string; // วันที่ออกงาน
    checkOutTime: string; // เวลาออกงาน
    status: string; // สถานะ
}

export interface LeaveRecord {
    notifyDate: string; // วันที่แจ้ง
    employeeId: string; // รหัสพนักงาน
    name: string; // ชื่อ-นามสกุล
    department: string; // แผนก
    leaveType: string; // ประเภทการลา
    startDate: string; // วันที่เริ่มลา
    endDate: string; // วันที่สิ้นสุด
    days: number; // จำนวนวัน
    status: string; // สถานะ
    reason: string; // เหตุผล
}

export interface EmployeeSummary {
    employeeId: string;
    name: string;
    department: string;
    lateCount: number;
    leaveDays: number;
    leaveDetails: {
        sickLeave: number;
        personalLeave: number;
        vacation: number;
        other: number;
    };
}

// Helper to reliably split CSV lines handling quotes
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let currentWord = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(currentWord.trim());
            currentWord = '';
        } else {
            currentWord += char;
        }
    }
    result.push(currentWord.trim());

    return result.map(val => val.replace(/^"|"$/g, '').trim());
}

export function parseAttendanceCSV(csvContent: string): AttendanceRecord[] {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const records: AttendanceRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length >= 10) {
            records.push({
                date: values[0],
                employeeId: values[1],
                name: values[2],
                department: values[3],
                branch: values[4],
                checkInDate: values[5],
                checkInTime: values[6],
                checkOutDate: values[7],
                checkOutTime: values[8],
                status: values[9],
            });
        }
    }
    return records;
}

export function parseLeaveCSV(csvContent: string): LeaveRecord[] {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    const map: Record<string, number> = {};
    
    const HEADER_MAP: Record<string, string[]> = {
        employeeId: ['รหัสพนักงาน', 'employee_id', 'employee id', 'รหัส', 'code'],
        leaveType: ['ประเภทการลา', 'leave_type', 'leave type', 'ประเภท'],
        startDate: ['วันที่เริ่มลา', 'start_date', 'start date', 'เริ่ม'],
        endDate: ['วันที่สิ้นสุด', 'end_date', 'end date', 'สิ้นสุด'],
        days: ['จำนวนวัน', 'days', 'count', 'วัน'],
        reason: ['เหตุผล', 'reason', 'remark'],
        status: ['สถานะ', 'status']
    };

    headers.forEach((h, i) => {
        const lowerH = h.toLowerCase();
        for (const [key, aliases] of Object.entries(HEADER_MAP)) {
            if (aliases.some(a => lowerH.includes(a.toLowerCase()))) {
                map[key] = i;
            }
        }
    });

    const records: LeaveRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length > 0) {
            records.push({
                notifyDate: map['notifyDate'] !== undefined ? values[map['notifyDate']] : '',
                employeeId: map['employeeId'] !== undefined ? values[map['employeeId']] : '',
                name: map['name'] !== undefined ? values[map['name']] : '',
                department: map['department'] !== undefined ? values[map['department']] : '',
                leaveType: map['leaveType'] !== undefined ? values[map['leaveType']] : '',
                startDate: map['startDate'] !== undefined ? values[map['startDate']] : '',
                endDate: map['endDate'] !== undefined ? values[map['endDate']] : '',
                days: map['days'] !== undefined ? parseFloat(values[map['days']]) : 0,
                status: map['status'] !== undefined ? values[map['status']] : 'approved',
                reason: map['reason'] !== undefined ? values[map['reason']] : '',
            });
        }
    }
    return records;
}

export function generateEmployeeSummaries(
    attendanceRecords: AttendanceRecord[],
    leaveRecords: LeaveRecord[]
): EmployeeSummary[] {
    const employeeMap = new Map<string, EmployeeSummary>();

    // Process Attendance (Count Lates)
    attendanceRecords.forEach(record => {
        if (!employeeMap.has(record.employeeId)) {
            employeeMap.set(record.employeeId, {
                employeeId: record.employeeId,
                name: record.name,
                department: record.department,
                lateCount: 0,
                leaveDays: 0,
                leaveDetails: { sickLeave: 0, personalLeave: 0, vacation: 0, other: 0 }
            });
        }

        const summary = employeeMap.get(record.employeeId)!;
        if (record.status.includes('สาย')) {
            summary.lateCount += 1;
        }
    });

    // Process Leaves
    leaveRecords.forEach(record => {
        // Only count approved leaves or depending on policy, typically "อนุมัติ"
        // Since images show some in "รอหัวหน้าอนุมัติ", we might count all or just approved.
        // Assuming we count all for this summary or we can add a filter. Let's count all for now.

        if (!employeeMap.has(record.employeeId)) {
            employeeMap.set(record.employeeId, {
                employeeId: record.employeeId,
                name: record.name,
                department: record.department,
                lateCount: 0,
                leaveDays: 0,
                leaveDetails: { sickLeave: 0, personalLeave: 0, vacation: 0, other: 0 }
            });
        }

        const summary = employeeMap.get(record.employeeId)!;
        summary.leaveDays += record.days;

        if (record.leaveType.includes('ลาป่วย')) {
            summary.leaveDetails.sickLeave += record.days;
        } else if (record.leaveType.includes('ลากิจ')) {
            summary.leaveDetails.personalLeave += record.days;
        } else if (record.leaveType.includes('ลาพักร้อน')) {
            summary.leaveDetails.vacation += record.days;
        } else {
            summary.leaveDetails.other += record.days;
        }
    });

    return Array.from(employeeMap.values());
}
