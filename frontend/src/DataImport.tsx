import React, { useState, useEffect, useMemo } from 'react';
import {
    Row, Col, Card, Upload, Statistic, Typography, Table, Space, Tag, Input,
    message, Button, DatePicker, Modal, Calendar, Badge, Tooltip, Alert, Select
} from 'antd';
import type { TableProps } from 'antd';
import {
    InboxOutlined, UserOutlined, ClockCircleOutlined,
    SearchOutlined, DatabaseOutlined, SyncOutlined,
    CheckCircleOutlined, CalendarOutlined, FileExcelOutlined,
    LeftOutlined, RightOutlined, WarningOutlined, DeleteOutlined
} from '@ant-design/icons';
import { parseAttendanceCSV } from './utils/csvProcessor';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { API_BASE_URL as API } from './api';

dayjs.extend(isSameOrBefore);

const { Title, Text } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

// API constant is now imported above

interface DbSummary {
    employeeId: string;
    name: string;
    department: string;
    workDays: number;
    weekdays: number;
    weekends: number;
    onTimeDays: number;
    lateCount: number;
    totalLateMinutes: number;
}

export const DataImport: React.FC = () => {
    // ── DB state (persisted data) ──
    const [dbSummary, setDbSummary] = useState<DbSummary[]>([]);
    const [dbLogs, setDbLogs] = useState<any[]>([]);
    const [dbLoading, setDbLoading] = useState(false);
    const [dbMonth, setDbMonth] = useState<dayjs.Dayjs | null>(dayjs());
    const [dbDay, setDbDay] = useState<dayjs.Dayjs | null>(dayjs());
    const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly');
    const [dbSearch, setDbSearch] = useState('');

    // ── Upload Modal state ──
    const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewRecords, setPreviewRecords] = useState<any[]>([]);
    const [allEmployees, setAllEmployees] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [importErrors, setImportErrors] = useState<any[]>([]);


    // ── Calendar Modal state ──
    const [isCalendarModalVisible, setIsCalendarModalVisible] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
    const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
    const [publicHolidays, setPublicHolidays] = useState<any[]>([]);

    const selectedEmployeeLogs = useMemo(() => {
        if (!selectedEmployeeId) return [];
        return dbLogs.filter(log => log.employee_code === selectedEmployeeId);
    }, [dbLogs, selectedEmployeeId]);

    // ── Fetch persisted data from DB ──
    const fetchDbAttendance = async () => {
        setDbLoading(true);
        try {
            const month = dbMonth ? dbMonth.month() + 1 : undefined;
            const year = dbMonth ? dbMonth.year() : undefined;
            const [res, leaveRes, holidaysRes] = await Promise.all([
                axios.get(`${API}/attendance`, { params: { month, year } }),
                axios.get(`${API}/leaves/requests`),
                axios.get(`${API}/settings/holidays`)
            ]);
            setDbSummary(res.data.summary || []);
            setDbLogs(res.data.logs || []);
            setLeaveRequests(leaveRes.data || []);
            setPublicHolidays(holidaysRes.data || []);
        } catch {
            message.error('ไม่สามารถดึงข้อมูล attendance จากระบบได้');
        } finally {
            setDbLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await axios.get(`${API}/employees`);
            setAllEmployees(res.data);
        } catch (err) {
            console.error("Failed to fetch employees", err);
        }
    };

    useEffect(() => { 
        fetchDbAttendance();
        const fetchShifts = async () => {
            try {
                const res = await axios.get(`${API}/shifts`);
                setShifts(res.data);
            } catch (err) {
                console.error("Failed to fetch shifts", err);
            }
        };
        fetchEmployees();
        fetchShifts();
    }, [dbMonth]);


    // ── Normalize date string to YYYY-MM-DD HH:MM:SS for MariaDB ──
    const normalizeDateTime = (dateStr: string, timeStr?: string): string | null => {
        if (!dateStr || dateStr.trim() === '' || dateStr === '-') return null;
        try {
            let normalized = dateStr.trim();
            normalized = normalized.replace(/\//g, '-');
            if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(normalized)) {
                const [d, m, y] = normalized.split('-');
                normalized = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
            const parts = normalized.split('-');
            if (parts[0] && parseInt(parts[0]) > 2500) {
                parts[0] = String(parseInt(parts[0]) - 543);
                normalized = parts.join('-');
            }
            let timePart = '00:00:00';
            const t = (timeStr || '').trim();
            if (t !== '' && t !== '-') {
                const actualTime = t.includes(' ') ? t.split(' ').pop() || '' : t;
                timePart = actualTime.length <= 5 ? `${actualTime}:00` : actualTime;
            }
            return `${normalized} ${timePart}`;

        } catch {
            return null;
        }
    };

    // ── File Upload Handler (Step 1: Preview & Validate) ──
    const handleFileUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                setUploading(true);
                let rawRecords: any[] = [];
                
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                    
                    if (jsonData.length > 1) {
                        rawRecords = jsonData.slice(1).map((row, i) => ({
                            _rowIndex: i + 2,
                            employee_code: String(row[1] || '').trim(),
                            shift_name: String(row[4] || '').trim(),
                            check_in_time: normalizeDateTime(String(row[6] || ''), String(row[7] || '')),
                            check_out_time: normalizeDateTime(String(row[8] || ''), String(row[9] || '')),
                            csv_status: String(row[10] || '').trim(),
                        }));


                    }
                } else {
                    const text = e.target?.result as string;
                    const parsed = parseAttendanceCSV(text);
                    rawRecords = parsed.map((r, i) => ({
                        _rowIndex: i + 2,
                        employee_code: String(r.employeeId || '').trim(),
                        check_in_time: normalizeDateTime(r.checkInDate, r.checkInTime),
                        check_out_time: normalizeDateTime(r.checkOutDate, r.checkOutTime),
                        csv_status: r.status ? String(r.status).trim() : '',
                        shift_name: r.shiftName ? String(r.shiftName).trim() : ''
                    }));

                }

                // Transform to Preview Records with Validation
                const preview = rawRecords.map(r => {
                    const empFound = allEmployees.find(e => 
                        String(e.employee_code).trim().toLowerCase() === String(r.employee_code).trim().toLowerCase()
                    );
                    
                    const checkInObj = r.check_in_time ? dayjs(r.check_in_time) : null;
                    const checkOutObj = r.check_out_time ? dayjs(r.check_out_time) : null;
                    
                    // ป้องกันเคสลืมสแกนออก แล้วมากดออกในวันถัดไป (เกิน 16 ชั่วโมง)
                    if (checkInObj && checkOutObj) {
                        const hoursDiff = checkOutObj.diff(checkInObj, 'hour', true);
                        if (hoursDiff > 16) {
                            r.check_out_time = null; // บังคับให้เป็น n/o
                        }
                    }

                    const checkInTimeOnly = checkInObj ? checkInObj.format('HH:mm') : null;
                    let isActuallyLate = false;
                    let lateMins = 0;
                    
                    // ใช้สถานะจาก CSV เป็นหลักสำหรับพนักงานกะไม่แน่นอน
                    if (r.csv_status && (r.csv_status.includes('สาย') || r.csv_status.toLowerCase() === 'late')) {
                        isActuallyLate = true;
                        lateMins = parseInt(r.csv_status.replace(/\D/g, '')) || 0;
                    } else if (!r.csv_status || r.csv_status === '' || r.csv_status.includes('ปกติ') || r.csv_status.toLowerCase() === 'on_time') {
                        // ถ้าลูกค้าเลือกกะมาเอง (shift_name) ให้ใช้เวลากะที่เลือกแทนกะประจำ
                        const importedShift = r.shift_name ? shifts.find(s => String(s.shiftName).toLowerCase().includes(String(r.shift_name).toLowerCase())) : null;
                        const shiftStart = importedShift ? importedShift.startTime?.substring(0, 5) : (empFound && empFound.shift_start_time ? empFound.shift_start_time.substring(0, 5) : null);
                        
                        if (shiftStart !== null) {
                            // คำนวณเบื้องต้น (Backend จะคำนวณละเอียดอีกครั้ง)

                            const allowance = importedShift ? parseInt(importedShift.lateThreshold || 0) : (empFound && empFound.late_allowance_minutes ? parseInt(empFound.late_allowance_minutes) : 0);
                            
                            if (checkInTimeOnly) {
                                const [sh, sm] = shiftStart.split(':').map(Number);
                                const [ch, cm] = checkInTimeOnly.split(':').map(Number);
                                let diff = (ch * 60 + cm) - (sh * 60 + sm);
                                if (diff < -720) diff += 1440;
                                if (diff > allowance) {
                                    isActuallyLate = true;
                                    lateMins = diff - allowance;
                                }
                            }
                        } else {
                            // ถ้าไม่มีกะใดๆ ให้ถือว่าไม่สาย
                            isActuallyLate = false;
                        }
                    }


                    let error = '';
                    
                    if (!r.employee_code) error = 'ไม่พบรหัสพนักงาน';
                    else if (!empFound) error = `ไม่พบพนักงานรหัส ${r.employee_code}`;
                    else if (!r.check_in_time) error = 'รูปแบบวัน/เวลาเข้างานไม่ถูกต้อง';

                    return {
                        ...r,
                        employee_name: empFound ? empFound.name : 'N/A',
                        _valid: !error,
                        _error: error,
                        status: error ? 'invalid' : (isActuallyLate ? 'late' : 'on_time'),
                        late_minutes: lateMins
                    };
                });

                setPreviewRecords(preview);
                setIsUploadModalVisible(true);
                if (preview.length > 0) {
                    message.success(`ตรวจสอบข้อมูลสำเร็จ: ทั้งหมด ${preview.length} รายการ`);
                } else {
                    message.warning('ไม่พบข้อมูลที่สามารถนำเข้าได้ในไฟล์');
                }
            } catch (err: any) {
                message.error(err.message || 'อ่านไฟล์ไม่สำเร็จ');
            } finally {
                setUploading(false);
            }
        };

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file, 'UTF-8');
        }
        return false;
    };

    // ── Final Confirm Import (Step 2: Actual Save) ──
    const handleConfirmImport = async () => {
        const validRecords = previewRecords.filter(r => r._valid);
        if (validRecords.length === 0) {
            message.error('ไม่มีข้อมูลที่ถูกต้องในการนำเข้า');
            return;
        }

        try {
            setUploading(true);
            const recordsToUpload = validRecords.map(r => ({
                employee_code: r.employee_code,
                check_in_time: r.check_in_time,
                check_out_time: r.check_out_time,
                status: r.status, // ใช้ status ที่เราตรวจเบื้องต้น (late/on_time)
                late_minutes: r.late_minutes || 0, // ส่งค่านาทีที่ดึงมาจาก CSV
                shift_name: r.shift_name
            }));


            const res = await axios.post(`${API}/attendance/import`, { records: recordsToUpload });
            
            if (res.data.errors && res.data.errors.length > 0) {
                setImportErrors(res.data.errors);
                message.warning(`นำเข้าสำเร็จบางส่วน: พบ ${res.data.errors.length} รายการที่มีปัญหา`);
            } else {
                message.success(`นำเข้าสำเร็จ: เพิ่มใหม่ ${res.data.inserted} รายการ, ข้ามข้อมูลซ้ำ ${res.data.skipped || 0} รายการ`);
                setPreviewRecords([]);
                setImportErrors([]);
                setIsUploadModalVisible(false);
            }
            
            fetchDbAttendance();
        } catch (err: any) {
            message.error(err?.response?.data?.error || 'นำเข้าไม่สำเร็จ');
        } finally {
            setUploading(false);
        }
    };


    const handleOpenCalendar = (record: DbSummary) => {
        setSelectedEmployeeId(record.employeeId);
        setSelectedEmployeeName(record.name);
        setIsCalendarModalVisible(true);
    };

    const dateCellRender = (current: Dayjs) => {
        // Only show indicators for the currently filtered month
        if (current.month() !== dbMonth?.month() || current.year() !== dbMonth?.year()) {
            return null;
        }

        const day = current.day();
        const isWeekend = day === 0 || day === 6;
        const isFuture = current.isAfter(dayjs(), 'day');

        // Check if employee has leave on this day
        const employeeId = selectedEmployeeId;
        let isLeaveDay = false;
        let matchingLeave: any = null;

        if (employeeId) {
            // Find an approved/pending leave request that covers this date
            matchingLeave = leaveRequests.find(lr => {
                if (lr.employee_name !== selectedEmployeeName) return false;
                
                const start = dayjs(lr.start_date);
                const end = dayjs(lr.end_date);
                return current.isBetween(start, end, 'day', '[]');
            });

            if (matchingLeave && (matchingLeave.status === 'approved' || matchingLeave.status === 'pending')) {
                isLeaveDay = true;
            }
        }

        const log = selectedEmployeeLogs.find(l => dayjs(l.check_in_time).isSame(current, 'day'));
        const holiday = publicHolidays.find(h => dayjs(h.holiday_date).isSame(current, 'day'));

        const empFound = allEmployees.find(e => e.employee_code === selectedEmployeeId);
        const shiftStart = empFound && empFound.shift_start_time ? empFound.shift_start_time.substring(0, 5) : null;

        let leaveAbbr = '';
        if (isLeaveDay) {
            const leaveType = matchingLeave?.leave_type_name || 'ลางาน';
            leaveAbbr = leaveType;
            if (leaveType.includes('ป่วย')) leaveAbbr = 'SL';
            else if (leaveType.includes('กิจ')) leaveAbbr = 'PL';
            else if (leaveType.includes('พักร้อน') || leaveType.includes('พักผ่อน')) leaveAbbr = 'AL';

            const days = Number(matchingLeave?.total_days) || 0;
            if (days > 0 && days % 1 !== 0) {
                // ถ้ามีทศนิยม (เช่น ลาครึ่งวัน 0.5) ให้ต่อท้ายด้วย 0.5
                leaveAbbr += '0.5';
            }
        }

        // 1. Prioritize Attendance (แสดงข้อมูลเข้า-ออกงานก่อนเป็นอันดับแรก)
        if (log) {
            const checkIn = log.check_in_time ? dayjs(log.check_in_time).format('HH:mm') : '-';
            
            // Visual check against employee's specific shift (only if shift is fixed)
            const isLate = log.status === 'late' || (shiftStart !== null && checkIn !== '-' && checkIn > shiftStart);

            return (
                <div style={{ textAlign: 'center', lineHeight: '1.2', marginTop: '2px' }}>
                    <div style={{ fontSize: '11px', color: isLate ? '#faad14' : '#52c41a', fontWeight: isLate ? 'bold' : 'normal' }}>
                        {checkIn}
                    </div>
                    <div style={{ fontSize: '11px', color: '#1890ff' }}>
                        {log.check_out_time 
                            ? dayjs(log.check_out_time).format('HH:mm') 
                            : 'n/o'}
                    </div>
                    {/* โน้ตชื่อกะที่ตรวจจับได้ สำหรับพนักงานที่ไม่มีกะประจำ */}
                    {log.detected_shift_name && (
                        <div style={{ fontSize: '9px', color: '#888', marginTop: '1px' }}>
                            กะ: {log.detected_shift_name}
                        </div>
                    )}
                    {/* แสดงป้ายบอกกรณีมาทำงานในวันหยุดหรือวันลา */}
                    {(isLeaveDay || holiday) && (
                        <div style={{ fontSize: '8px', color: '#999', fontStyle: 'italic', marginTop: '1px' }}>
                            {isLeaveDay ? `มา (${leaveAbbr})` : holiday ? 'มาทำงาน (หยุด)' : ''}
                        </div>
                    )}
                </div>
            );
        }

        // 2. ถ้าไม่มีข้อมูลการเข้างาน ให้เช็คเรื่องการลา
        if (isLeaveDay) {
            return (
                <div style={{ textAlign: 'center', marginTop: 0 }}>
                    <Badge status="processing" color="blue" />
                    <div style={{ fontSize: '11px', color: '#1890ff', fontWeight: 'bold' }}>
                        {leaveAbbr}
                    </div>
                </div>
            );
        }

        // 3. ถ้าไม่มีทั้งการเข้างานและการลา ให้เช็ควันหยุด
        if (holiday) {
            return (
                <div style={{ textAlign: 'center', marginTop: 0 }}>
                    <Badge status="success" color="cyan" />
                    <div style={{ fontSize: '10px', color: '#08979c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {holiday.name}
                    </div>
                </div>
            );
        }

        // 4. กรณีไม่มีข้อมูลใดๆ ในวันธรรมดา ให้แสดงสถานะขาดงาน (สีแดง)
        if (!isWeekend && !isFuture) {
            return (
                <Tooltip title="ขาดงาน หรือ ไม่มีข้อมูลเข้างาน">
                    <div style={{ textAlign: 'center', marginTop: -4 }}><Badge status="error" /></div>
                </Tooltip>
            );
        }
        return null;
    };

    const calendarCellRender = (current: Dayjs, info: any) => {
        if (info.type === 'date') return dateCellRender(current);
        return info.originNode;
    };

    const filteredDbSummary = dbSummary.filter(r =>
        r.name.toLowerCase().includes(dbSearch.toLowerCase()) ||
        r.employeeId.toLowerCase().includes(dbSearch.toLowerCase()) ||
        r.department.toLowerCase().includes(dbSearch.toLowerCase())
    );

    const filteredDbLogs = useMemo(() => {
        if (viewMode === 'monthly') return [];
        return dbLogs.filter(log => {
            const matchSearch = log.employee_name?.toLowerCase().includes(dbSearch.toLowerCase()) ||
                               log.employee_code?.toLowerCase().includes(dbSearch.toLowerCase());
            const matchDay = dbDay ? dayjs(log.check_in_time).isSame(dbDay, 'day') : true;
            return matchSearch && matchDay;
        });
    }, [dbLogs, dbSearch, dbDay, viewMode]);

    const dbLateCount = dbSummary.reduce((s, r) => s + r.lateCount, 0);
    const dbWorkDays = dbSummary.reduce((s, r) => s + r.workDays, 0);
    const dbWeekends = dbSummary.reduce((s, r) => s + (r.weekends ?? 0), 0);
    const dbOnTimeDays = dbSummary.reduce((s, r) => s + (r.onTimeDays ?? 0), 0);

    const dbColumns: TableProps<DbSummary>['columns'] = [
        { title: 'รหัสพนักงาน', dataIndex: 'employeeId', key: 'employeeId', width: 110 },
        { title: 'ชื่อ-นามสกุล', dataIndex: 'name', key: 'name' },
        {
            title: 'แผนก', dataIndex: 'department', key: 'department',
            filters: Array.from(new Set(dbSummary.map(s => s.department))).map(d => ({ text: d, value: d })),
            onFilter: (value: any, record: DbSummary) => record.department === value,
        },
        {
            title: 'วันมาทำงาน', key: 'workDays',
            align: 'center' as const,
            render: (_: any, r: DbSummary) => (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{r.workDays}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>จ-ศ: {r.weekdays} | ส-อ: {r.weekends}</div>
                </div>
            ),
            sorter: (a: DbSummary, b: DbSummary) => a.workDays - b.workDays,
        },
        {
            title: 'วันหยุด เสาร์-อาทิตย์', dataIndex: 'weekends', key: 'weekends',
            align: 'center' as const,
            sorter: (a: DbSummary, b: DbSummary) => a.weekends - b.weekends,
            render: (v: number) => v > 0
                ? <Tag color="purple">{v} วัน</Tag>
                : <Tag color="default">0</Tag>
        },
        {
            title: 'ตรงเวลา (วัน)', dataIndex: 'onTimeDays', key: 'onTimeDays',
            align: 'center' as const,
            sorter: (a: DbSummary, b: DbSummary) => a.onTimeDays - b.onTimeDays,
            render: (v: number) => <Tag color="success" icon={<CheckCircleOutlined />}>{v}</Tag>
        },
        {
            title: 'มาสาย (ครั้ง)', dataIndex: 'lateCount', key: 'lateCount',
            align: 'center' as const,
            sorter: (a: DbSummary, b: DbSummary) => a.lateCount - b.lateCount,
            render: (v: number) => <Tag color={v > 3 ? 'volcano' : v > 0 ? 'orange' : 'success'}>{v}</Tag>
        },
        {
            title: 'รวมนาทีสาย', dataIndex: 'totalLateMinutes', key: 'totalLateMinutes',
            align: 'center' as const,
            sorter: (a: DbSummary, b: DbSummary) => a.totalLateMinutes - b.totalLateMinutes,
            render: (v: number, record: DbSummary) => (
                <Button 
                    type="link" 
                    size="small" 
                    icon={<CalendarOutlined />} 
                    onClick={() => handleOpenCalendar(record)}
                >
                    {v > 0 ? <Text type="danger">{v} นาที</Text> : 'ดูปฏิทิน'}
                </Button>
            )
        },
    ];

    const dailyColumns = [
        { title: 'รหัสพนักงาน', dataIndex: 'employee_code', key: 'employee_code', width: 110 },
        { title: 'ชื่อ-นามสกุล', dataIndex: 'employee_name', key: 'employee_name' },
        { title: 'แผนก', dataIndex: 'department', key: 'department' },
        { title: 'เวลาเข้า', dataIndex: 'check_in_time', key: 'check_in_time', render: (v: string) => v ? dayjs(v).format('HH:mm') : '-' },
        { title: 'เวลาออก', dataIndex: 'check_out_time', key: 'check_out_time', render: (v: string) => v ? dayjs(v).format('HH:mm') : '-' },
        { 
            title: 'สถานะ', dataIndex: 'status', key: 'status',
            render: (s: string) => {
                if (s === 'late') return <Tag color="orange">สาย</Tag>;
                if (s === 'on_time') return <Tag color="success">ปกติ</Tag>;
                return <Tag>{s}</Tag>;
            }
        },
        { title: 'สาย (นาที)', dataIndex: 'late_minutes', key: 'late_minutes', render: (v: number) => v > 0 ? <Text type="danger">{v}</Text> : 0 },
        { title: 'กะที่ตรวจพบ', dataIndex: 'detected_shift_name', key: 'detected_shift_name' },
    ];

    return (
        <div>
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>ประวัติและข้อมูลการเข้า-ออกงาน</Title>
                    <Text type="secondary">ตรวจสอบข้อมูลการลงเวลาทำงาน หรือนำเข้าข้อมูลใหม่จากเครื่องสแกน</Text>
                </div>
                <Space>
                    <Button 
                        type="primary" 
                        icon={<FileExcelOutlined />} 
                        onClick={() => { 
                            setPreviewRecords([]); 
                            setImportErrors([]);
                            fetchEmployees(); // Refresh employee list
                            setIsUploadModalVisible(true); 
                        }}
                        size="large"
                    >
                        Import File (Excel/CSV)
                    </Button>
                </Space>
            </div>

            <Card bordered={false} style={{ borderRadius: 8 }}>
                {/* Filter */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <Space>
                        <Select 
                            value={viewMode} 
                            onChange={(val: any) => setViewMode(val)} 
                            style={{ width: 140 }}
                        >
                            <Option value="monthly">ดูแบบรายเดือน</Option>
                            <Option value="daily">ดูแบบรายวัน</Option>
                        </Select>
                        {viewMode === 'monthly' ? (
                            <DatePicker picker="month" value={dbMonth} onChange={setDbMonth} allowClear={false} />
                        ) : (
                            <DatePicker value={dbDay} onChange={setDbDay} allowClear={false} placeholder="เลือกวันที่" />
                        )}
                        <Button icon={<SyncOutlined />} onClick={fetchDbAttendance} loading={dbLoading}>รีโหลด</Button>
                    </Space>
                    <Input
                        placeholder="ค้นหาพนักงาน / แผนก" prefix={<SearchOutlined />}
                        style={{ width: 250 }} value={dbSearch}
                        onChange={e => setDbSearch(e.target.value)} allowClear
                    />
                </div>

                {/* System Stats */}
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={12} lg={6}>
                        <Card size="small" style={{ borderRadius: 6 }}>
                            <Statistic title="พนักงานที่มีข้อมูล" value={dbSummary.length} prefix={<UserOutlined />} valueStyle={{ color: '#3f8600' }} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card size="small" style={{ borderRadius: 6 }}>
                            <Statistic title="รวมวันมาทำงานทั้งหมด" value={dbWorkDays} prefix={<DatabaseOutlined />} valueStyle={{ color: '#1890ff' }}
                                suffix={<span style={{ fontSize: 12, color: '#888' }}> (เสาร์-อาทิตย์: {dbWeekends})</span>} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card size="small" style={{ borderRadius: 6 }}>
                            <Statistic title="มาตรงเวลา ไม่สาย" value={dbOnTimeDays} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card size="small" style={{ borderRadius: 6 }}>
                            <Statistic title="มาสายรวม (ครั้ง)" value={dbLateCount} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#cf1322' }} />
                        </Card>
                    </Col>
                </Row>

                {/* Table or Empty State */}
                {viewMode === 'monthly' ? (
                    dbSummary.length === 0 && !dbLoading ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#999',  background: '#fafafa', borderRadius: 8 }}>
                            <DatabaseOutlined style={{ fontSize: 48, marginBottom: 16, color: '#d9d9d9' }} />
                            <div style={{ fontSize: 16, fontWeight: 500, color: '#666', marginBottom: 8 }}>ยังไม่มีข้อมูลการเข้างานสำหรับเดือนนี้</div>
                            <Text type="secondary">โปรดกดปุ่ม <b>นำเข้าไฟล์ CSV</b> มุมขวาบนเพื่ออัปโหลดข้อมูลจากเครื่องสแกน</Text>
                        </div>
                    ) : (
                        <Table
                            dataSource={filteredDbSummary} columns={dbColumns}
                            rowKey="employeeId" loading={dbLoading}
                            pagination={{ pageSize: 15 }} bordered size="middle"
                            scroll={{ x: 1000 }}
                        />
                    )
                ) : (
                    <Table
                        dataSource={filteredDbLogs} columns={dailyColumns}
                        rowKey="id" loading={dbLoading}
                        pagination={{ pageSize: 20 }} bordered size="middle"
                        scroll={{ x: 1000 }}
                    />
                )}
            </Card>

            {/* ── UPLOAD MODAL ── */}
            <Modal
                title={
                    <Space>
                        <FileExcelOutlined style={{ color: '#52c41a' }} />
                        <span>ตรวจสอบและนำเข้าข้อมูลการเข้า-ออกงาน</span>
                    </Space>
                }
                open={isUploadModalVisible}
                onCancel={() => !uploading && setIsUploadModalVisible(false)}
                width={1000}
                style={{ top: 20 }}
                footer={
                    previewRecords.length > 0 ? (
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Button danger icon={<DeleteOutlined />} onClick={() => setPreviewRecords([])} disabled={uploading}>
                                ยกเลิกและเลือกไฟล์ใหม่
                            </Button>
                            <Space>
                                <Button onClick={() => setIsUploadModalVisible(false)} disabled={uploading}>ปิด</Button>
                                <Button 
                                    type="primary" 
                                    icon={<CheckCircleOutlined />} 
                                    onClick={handleConfirmImport} 
                                    loading={uploading}
                                    disabled={previewRecords.filter(r => r._valid).length === 0}
                                >
                                    ยืนยันการนำเข้า {previewRecords.filter(r => r._valid).length} รายการ
                                </Button>
                            </Space>
                        </Space>
                    ) : null
                }
            >
                {previewRecords.length === 0 ? (
                    <div>
                        <div style={{ marginBottom: 16 }}>
                            <Text type="secondary">อัปโหลดไฟล์ Excel หรือ CSV จากเครื่องสแกนเพื่อตรวจสอบข้อมูลก่อนบันทึกลงระบบ</Text>
                        </div>
                        <Dragger 
                            accept=".csv, .xlsx, .xls" 
                            showUploadList={false} 
                            beforeUpload={handleFileUpload} 
                            style={{ padding: '40px 0', background: '#fafafa' }}
                            disabled={uploading}
                        >
                            <p className="ant-upload-drag-icon">
                                {uploading ? <SyncOutlined spin style={{ color: '#1890ff' }} /> : <InboxOutlined style={{ color: '#1890ff' }} />}
                            </p>
                            <p className="ant-upload-text">
                                {uploading ? 'กำลังวิเคราะห์ไฟล์...' : 'คลิกหรือลากไฟล์ Time Attendance มาที่นี่'}
                            </p>
                            <div className="ant-upload-hint" style={{ marginTop: 12 }}>
                                <Text type="secondary">รองรับไฟล์ .xlsx, .xls และ .csv</Text>
                            </div>
                        </Dragger>
                    </div>
                ) : (
                    <div>
                        <Alert 
                            message={`พบข้อมูลทั้งหมด ${previewRecords.length} รายการ (ถูกต้อง ${previewRecords.filter(r => r._valid).length} รายการ, มีข้อผิดพลาด ${previewRecords.filter(r => !r._valid).length} รายการ)`}
                            type={previewRecords.some(r => !r._valid) ? "warning" : "success"}
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        <Table
                            dataSource={previewRecords}
                            rowKey="_rowIndex"
                            size="small"
                            pagination={{ pageSize: 15 }}
                            scroll={{ y: 400 }}
                            columns={[
                                { title: 'แถว', dataIndex: '_rowIndex', key: '_rowIndex', width: 60, align: 'center' },
                                {
                                    title: 'สถานะ', key: '_valid', width: 120,
                                    render: (_, r) => r._valid
                                        ? <Tag color="success">ถูกต้อง</Tag>
                                        : <Tag color="error" icon={<WarningOutlined />}>ผิดพลาด</Tag>
                                },
                                { title: 'รหัสพนักงาน', dataIndex: 'employee_code', key: 'employee_code', width: 110 },
                                { title: 'ชื่อพนักงาน', dataIndex: 'employee_name', key: 'employee_name', width: 150 },
                                {
                                    title: 'เวลาเข้างาน', dataIndex: 'check_in_time', key: 'check_in_time',
                                    render: (v) => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '-',
                                },
                                {
                                    title: 'เวลาออกงาน', dataIndex: 'check_out_time', key: 'check_out_time',
                                    render: (v) => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '-',
                                },
                                {
                                    title: 'กะการทำงาน', dataIndex: 'shift_name', key: 'shift_name', width: 120,
                                    render: (v) => v || <Text type="secondary">-</Text>
                                },
                                {
                                    title: 'สาเหตุที่ผิดพลาด', dataIndex: '_error', key: '_error',

                                    render: (e) => <Text type="danger">{e}</Text>
                                },
                            ]}
                        />
                        {importErrors.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                                <Alert
                                    message="รายการที่มีปัญหาหลังจากกดยืนยัน (ไม่ถูกบันทึก)"
                                    description={
                                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                            {importErrors.map((err, idx) => (
                                                <div key={idx} style={{ color: '#ff4d4f', fontSize: '12px', borderBottom: '1px solid #f0f0f0', padding: '4px 0' }}>
                                                    <strong>รหัสพนักงาน {err.code}:</strong> {err.error}
                                                </div>
                                            ))}
                                        </div>
                                    }
                                    type="error"
                                    showIcon
                                />
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* ── CALENDAR MODAL ── */}
            <Modal
                title={`ปฏิทินเข้างาน: ${selectedEmployeeName}`}
                open={isCalendarModalVisible}
                onCancel={() => setIsCalendarModalVisible(false)}
                footer={null}
                width={800}
                style={{ top: 20 }}
            >
                <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
                    <div><Badge status="success" text="มาตรงเวลา" /></div>
                    <div><Badge status="warning" text="มาสาย" /></div>
                    <div><Badge status="error" text="ขาดงาน (ไม่มีข้อมูล)" /></div>
                    <div><Badge status="processing" color="blue" text="ลางาน" /></div>
                </div>
                <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 8 }}>
                    <Calendar 
                        value={dbMonth || dayjs()} 
                        cellRender={calendarCellRender}
                        onSelect={(date) => setDbMonth(date)}
                        headerRender={({ value }) => (
                            <div style={{ padding: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Title level={5} style={{ margin: 0, color: '#1890ff' }}>
                                    {value.format('MMMM YYYY')}
                                </Title>
                                <Space>
                                    <Button 
                                        size="small" 
                                        icon={<LeftOutlined />} 
                                        onClick={() => setDbMonth(value.subtract(1, 'month'))}
                                    />
                                    <Button 
                                        size="small" 
                                        onClick={() => setDbMonth(dayjs())}
                                    >
                                        เดือนปัจจุบัน
                                    </Button>
                                    <Button 
                                        size="small" 
                                        icon={<RightOutlined />} 
                                        onClick={() => setDbMonth(value.add(1, 'month'))}
                                    />
                                </Space>
                            </div>
                        )}
                    />
                </div>
            </Modal>
        </div>
    );
};
