import React, { useState, useEffect } from 'react';
import {
    Row,
    Col,
    Card,
    Statistic,
    Typography,
    Table,
    Button,
    Space,
    Input,
    InputNumber,
    Switch,
    DatePicker,
    Select,
    Modal,
    Form,
    Upload,
    message,
    Tabs,
    Tag,
    Popconfirm
} from 'antd';
import type { TableProps } from 'antd';
import {
    CalendarOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    SearchOutlined,
    PlusOutlined,
    UploadOutlined,
    SafetyCertificateOutlined,
    FileTextOutlined,
    EditOutlined,
    DeleteOutlined,
    CarryOutOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import axios from 'axios';
import { parseLeaveCSV } from './utils/csvProcessor';
import { API_BASE_URL as API } from './api';

dayjs.extend(isBetween);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface LeaveRequest {
    id: string;
    employee_name: string;
    department: string;
    leave_type_name: string;
    start_date: string;
    end_date: string;
    total_days: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
}

export const Leave: React.FC = () => {
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
    const [leaveRules, setLeaveRules] = useState<any[]>([]);
    const [publicHolidays, setPublicHolidays] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Filter states
    const [searchText, setSearchText] = useState('');
    const [dateRangeFilter, setDateRangeFilter] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

    // Modal states
    const [isRequestModalVisible, setIsRequestModalVisible] = useState(false);
    const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
    const [isLeaveRuleModalOpen, setIsLeaveRuleModalOpen] = useState(false);
    const [isLeaveTypeModalOpen, setIsLeaveTypeModalOpen] = useState(false);
    const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);

    // Edit states
    const [editingLeaveRuleId, setEditingLeaveRuleId] = useState<string | null>(null);
    const [editingLeaveTypeId, setEditingLeaveTypeId] = useState<string | null>(null);

    const [uploading, setUploading] = useState(false);

    // Form instances
    const [form] = Form.useForm();
    const [leaveRuleForm] = Form.useForm();
    const [leaveTypeForm] = Form.useForm();
    const [holidayForm] = Form.useForm();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [leavesRes, typesRes, empRes, rulesRes, holidaysRes] = await Promise.all([
                axios.get(`${API}/leaves/requests`),
                axios.get(`${API}/leave-types`),
                axios.get(`${API}/employees`),
                axios.get(`${API}/leave-rules`),
                axios.get(`${API}/settings/holidays`)
            ]);
            setLeaveRequests(leavesRes.data || []);
            setLeaveTypes(typesRes.data || []);
            setEmployees(empRes.data || []);
            setLeaveRules(rulesRes.data || []);
            setPublicHolidays(holidaysRes.data || []);
        } catch (error) {
            console.error('Error fetching leave data:', error);
            message.error('ไม่สามารถโหลดข้อมูลการลาได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Derived statistics
    const stats = {
        totalApproved: leaveRequests.filter(r => dayjs(r.start_date).isAfter(dayjs().subtract(1, 'month'))).length,
        leavesToday: leaveRequests.filter(r => dayjs().isBetween(dayjs(r.start_date), dayjs(r.end_date), 'day', '[]')).length,
    };

    // Filter data
    const filteredLeaves = leaveRequests.filter(req => {
        const matchSearch = (req.employee_name && req.employee_name.toLowerCase().includes(searchText.toLowerCase())) ||
            (req.department && req.department.toLowerCase().includes(searchText.toLowerCase()));

        let matchDate = true;
        if (dateRangeFilter) {
            const start = dateRangeFilter[0].startOf('day');
            const end = dateRangeFilter[1].endOf('day');
            const reqDate = dayjs(req.start_date);
            matchDate = reqDate.isBetween(start, end, 'day', '[]');
        }

        return matchSearch && matchDate;
    });

    const calculateWorkDays = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
        let count = 0;
        let cur = start.clone();
        while (cur.isBefore(end) || cur.isSame(end, 'day')) {
            const day = cur.day();
            if (day !== 0 && day !== 6) count++;
            cur = cur.add(1, 'day');
        }
        return count;
    };

    const handleDateRangeChange = (dates: any) => {
        if (dates && dates[0] && dates[1]) {
            const days = calculateWorkDays(dates[0], dates[1]);
            form.setFieldsValue({ total_days: days });
        }
    };

    // Form submission - Leave Request
    const handleRequestSubmit = async (values: any) => {
        try {
            const startStr = values.dateRange[0].format('YYYY-MM-DD');
            const endStr = values.dateRange[1].format('YYYY-MM-DD');

            const payload = {
                employee_id: values.employee_id,
                leave_type_id: values.leave_type_id,
                start_date: startStr,
                end_date: endStr,
                total_days: values.total_days,
                reason: values.reason
            };

            await axios.post(`${API}/leaves/requests`, payload);
            message.success('ยื่นคำร้องขอลาสำเร็จ');
            setIsRequestModalVisible(false);
            form.resetFields();
            fetchData();
        } catch (error) {
            console.error(error);
            message.error('เกิดข้อผิดพลาดในการบันทึกคำร้อง');
        }
    };

    // Normalize date string to YYYY-MM-DD
    const normalizeDateStr = (dateStr: string): string | null => {
        if (!dateStr || dateStr.trim() === '' || dateStr === '-') return null;
        try {
            let normalized = dateStr.trim().replace(/\//g, '-');
            if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(normalized)) {
                const [d, m, y] = normalized.split('-');
                normalized = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
            const parts = normalized.split('-');
            if (parts[0] && parseInt(parts[0]) > 2500) {
                parts[0] = String(parseInt(parts[0]) - 543);
                normalized = parts.join('-');
            }
            return normalized;
        } catch { return null; }
    };

    // Bulk Import Logic
    const handleFileImport = (file: File) => {
        setUploading(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const parsed = parseLeaveCSV(text);
                if (parsed.length === 0) throw new Error('ไม่พบข้อมูลการลาในไฟล์');

                const records = parsed.map(r => ({
                    employeeId: r.employeeId,
                    leaveType: r.leaveType,
                    startDate: normalizeDateStr(r.startDate),
                    endDate: normalizeDateStr(r.endDate) || normalizeDateStr(r.startDate),
                    days: r.days,
                    reason: r.reason,
                    status: r.status
                })).filter(r => r.employeeId && r.startDate);

                if (records.length === 0) throw new Error('ไม่พบข้อมูลที่สมบูรณ์ในไฟล์');

                const res = await axios.post(`${API}/leaves/import`, { records });

                message.success(res.data.message);
                setIsUploadModalVisible(false);
                fetchData();
            } catch (err: any) {
                const errMsg = err?.response?.data?.error || err?.message || 'รูปแบบไฟล์ CSV ไม่ถูกต้อง';
                message.error(errMsg);
            } finally {
                setUploading(false);
            }
        };
        reader.readAsText(file, 'UTF-8');
        return false;
    };

    // --- Leave Rules Handlers ---
    const handleSaveLeaveRule = async (values: any) => {
        const payload = {
            minYears: values.minYears,
            vacationDays: values.vacationDays
        };

        try {
            if (editingLeaveRuleId) {
                await axios.put(`${API}/leave-rules/${editingLeaveRuleId}`, payload);
                message.success('อัปเดตเกณฑ์อายุงานสำเร็จ');
            } else {
                await axios.post(`${API}/leave-rules`, payload);
                message.success('เพิ่มเกณฑ์อายุงานสำเร็จ');
            }
            setIsLeaveRuleModalOpen(false);
            setEditingLeaveRuleId(null);
            leaveRuleForm.resetFields();
            fetchData();
        } catch (error) {
            message.error('เกิดข้อผิดพลาดในการบันทึกอายุงาน');
        }
    };

    const handleDeleteLeaveRule = async (id: string) => {
        try {
            await axios.delete(`${API}/leave-rules/${id}`);
            message.success('ลบเกณฑ์อายุงานสำเร็จ');
            fetchData();
        } catch (error) {
            message.error('เกิดข้อผิดพลาดในการลบอายุงาน');
        }
    };

    const handleRecalculateAllQuotas = async () => {
        try {
            setLoading(true);
            await axios.post(`${API}/employees/recalculate-all-quotas`);
            message.success('คำนวณโควตาวันลาให้พนักงานทุกคนสำเร็จตามกฎบริษัท');
            fetchData();
        } catch (error) {
            message.error('เกิดข้อผิดพลาดในการคำนวณโควตา');
        } finally {
            setLoading(false);
        }
    };

    // --- Leave Types Handlers ---
    const handleSaveLeaveType = async (values: any) => {
        const payload = {
            leaveName: values.leaveName,
            isDeductSalary: values.isDeductSalary,
            daysPerYear: values.daysPerYear
        };

        try {
            if (editingLeaveTypeId) {
                await axios.put(`${API}/leave-types/${editingLeaveTypeId}`, payload);
                message.success('อัปเดตประเภทการลาสำเร็จ');
            } else {
                await axios.post(`${API}/leave-types`, payload);
                message.success('เพิ่มประเภทการลาสำเร็จ');
            }
            setIsLeaveTypeModalOpen(false);
            setEditingLeaveTypeId(null);
            leaveTypeForm.resetFields();
            fetchData();
        } catch (error) {
            message.error('เกิดข้อผิดพลาดในการบันทึกประเภทการลา');
        }
    };

    const handleDeleteLeaveType = async (id: string) => {
        try {
            await axios.delete(`${API}/leave-types/${id}`);
            message.success('ลบประเภทการลาสำเร็จ');
            fetchData();
        } catch (error) {
            message.error('เกิดข้อผิดพลาดในการลบประเภทการลา');
        }
    };

    // --- Public Holidays Handlers ---
    const handleSaveHoliday = async (values: any) => {
        const payload = {
            date: values.holidayDate.format('YYYY-MM-DD'),
            name: values.holidayName
        };

        try {
            await axios.post(`${API}/settings/holidays`, payload);
            message.success('เพิ่มวันหยุดนักขัตฤกษ์สำเร็จ');
            setIsHolidayModalOpen(false);
            holidayForm.resetFields();
            fetchData();
        } catch (error: any) {
            message.error(error.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกวันหยุด');
        }
    };

    const handleDeleteHoliday = async (id: string) => {
        try {
            await axios.delete(`${API}/settings/holidays/${id}`);
            message.success('ลบวันหยุดสำเร็จ');
            fetchData();
        } catch (error) {
            message.error('เกิดข้อผิดพลาดในการลบวันหยุด');
        }
    };

    // Table Columns: Leave Requests
    const columns: TableProps<LeaveRequest>['columns'] = [
        {
            title: 'ชื่อพนักงาน',
            dataIndex: 'employee_name',
            key: 'employee_name',
            render: (text, record) => (
                <div>
                    <div style={{ fontWeight: 500 }}>{text}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{record.department || 'ไม่ระบุแผนก'}</div>
                </div>
            )
        },
        {
            title: 'ประเภทการลา',
            dataIndex: 'leave_type_name',
            key: 'leave_type_name',
            filters: leaveTypes.map(t => ({ text: t.leaveName, value: t.leaveName })),
            onFilter: (value, record) => record.leave_type_name === value
        },
        {
            title: 'วันที่ลา',
            key: 'date',
            render: (_, record) => (
                <div>
                    {dayjs(record.start_date).format('DD MMM YYYY')}
                    {record.start_date !== record.end_date && ` - ${dayjs(record.end_date).format('DD MMM YYYY')}`}
                    <div style={{ fontSize: '12px', color: '#888', marginTop: 4 }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        รวม {record.total_days} วัน
                    </div>
                </div>
            )
        },
        {
            title: 'เหตุผล',
            dataIndex: 'reason',
            key: 'reason',
            ellipsis: true
        }
    ];

    // Table Columns: Leave Rules (Tenure)
    const leaveRuleColumns = [
        { title: 'อายุงานขั้นต่ำ (ปี)', dataIndex: 'minYears', key: 'minYears', width: 200 },
        { title: 'โควตาวันหยุดพักผ่อน (วัน/ปี)', dataIndex: 'vacationDays', key: 'vacationDays', width: 250 },
        {
            title: 'จัดการ',
            key: 'action',
            align: 'center' as const,
            width: 120,
            render: (_: any, record: any) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined style={{ color: '#1890ff' }} />}
                        onClick={() => {
                            setEditingLeaveRuleId(record.id);
                            leaveRuleForm.setFieldsValue({
                                minYears: record.minYears,
                                vacationDays: record.vacationDays
                            });
                            setIsLeaveRuleModalOpen(true);
                        }}
                    />
                    <Popconfirm
                        title="ลบเกณฑ์อายุงานนี้หรือไม่?"
                        onConfirm={() => handleDeleteLeaveRule(record.id)}
                        okText="ลบ"
                        cancelText="ยกเลิก"
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    // Table Columns: Leave Types
    const leaveTypeColumns = [
        { title: 'ประเภทการลา', dataIndex: 'leaveName', key: 'leaveName' },
        {
            title: 'จำนวนวันที่ลาได้ (วัน/ปี)',
            dataIndex: 'daysPerYear',
            key: 'daysPerYear',
            render: (val: number) => val > 0 ? `${val} วัน` : 'ไม่จำกัด (หรือตามเกณฑ์อายุงาน)'
        },
        {
            title: 'หักเงินเดือนหรือไม่',
            dataIndex: 'isDeductSalary',
            key: 'isDeductSalary',
            render: (val: boolean) => val ? <Tag color="error">หักเงิน (Unpaid)</Tag> : <Tag color="success">ไม่หักเงิน (Paid)</Tag>
        },
        {
            title: 'จัดการ',
            key: 'action',
            align: 'center' as const,
            width: 120,
            render: (_: any, record: any) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined style={{ color: '#1890ff' }} />}
                        onClick={() => {
                            setEditingLeaveTypeId(record.id);
                            leaveTypeForm.setFieldsValue({
                                leaveName: record.leaveName,
                                isDeductSalary: record.isDeductSalary,
                                daysPerYear: record.daysPerYear
                            });
                            setIsLeaveTypeModalOpen(true);
                        }}
                    />
                    <Popconfirm
                        title="ลบประเภทการลานี้หรือไม่?"
                        onConfirm={() => handleDeleteLeaveType(record.id)}
                        okText="ลบ"
                        cancelText="ยกเลิก"
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    // Table Columns: Public Holidays
    const holidayColumns = [
        {
            title: 'วันที่',
            dataIndex: 'holiday_date',
            key: 'holiday_date',
            width: 200,
            render: (val: string) => dayjs(val).format('DD/MM/YYYY')
        },
        { title: 'ชื่อวันหยุด', dataIndex: 'name', key: 'name' },
        {
            title: 'จัดการ',
            key: 'action',
            align: 'center' as const,
            width: 120,
            render: (_: any, record: any) => (
                <Popconfirm
                    title="ลบวันหยุดนี้หรือไม่?"
                    onConfirm={() => handleDeleteHoliday(record.id)}
                    okText="ลบ"
                    cancelText="ยกเลิก"
                >
                    <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            )
        }
    ];

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>การจัดการลา (Leave Management)</Title>
                    <Text type="secondary">ตรวจสอบ บันทึกการลา และตั้งค่านโยบายประเภทการลา/วันหยุดประจำปี</Text>
                </div>
            </div>

            <Tabs
                defaultActiveKey="records"
                type="card"
                size="middle"
                items={[
                    {
                        key: 'records',
                        label: <span><FileTextOutlined /> บันทึกและประวัติการลา</span>,
                        children: (
                            <div>
                                <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                                    <Col xs={24} sm={12} md={8}>
                                        <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                                            <Statistic
                                                title="บันทึกการลาในเดือนนี้ (Recorded)"
                                                value={stats.totalApproved}
                                                valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                                                prefix={<CheckCircleOutlined />}
                                            />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={8}>
                                        <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                                            <Statistic
                                                title="ผู้ลางานวันนี้ (On Leave Today)"
                                                value={stats.leavesToday}
                                                valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                                                prefix={<CalendarOutlined />}
                                                suffix={<span style={{ fontSize: 14, fontWeight: 'normal', color: '#888', marginLeft: 8 }}>คน</span>}
                                            />
                                        </Card>
                                    </Col>
                                </Row>

                                <Card bordered={false} style={{ borderRadius: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                                        <Space wrap>
                                            <Input
                                                placeholder="ค้นหาชื่อพนักงาน หรือ แผนก..."
                                                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                                                style={{ width: 280 }}
                                                value={searchText}
                                                onChange={e => setSearchText(e.target.value)}
                                                allowClear
                                            />

                                            <RangePicker
                                                style={{ width: 260 }}
                                                placeholder={['วันเริ่มต้น', 'วันสิ้นสุด']}
                                                onChange={(dates) => setDateRangeFilter(dates as any)}
                                                allowClear
                                            />
                                        </Space>

                                        <Space wrap>
                                            <Button icon={<UploadOutlined />} onClick={() => setIsUploadModalVisible(true)}>
                                                นำเข้าบันทึกการลา (CSV)
                                            </Button>
                                            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsRequestModalVisible(true)}>
                                                ยื่นคำร้องขอลาใหม่
                                            </Button>
                                        </Space>
                                    </div>

                                    <Table
                                        columns={columns}
                                        dataSource={filteredLeaves}
                                        rowKey="id"
                                        loading={loading}
                                        pagination={{ pageSize: 15 }}
                                        scroll={{ x: 800 }}
                                    />
                                </Card>
                            </div>
                        )
                    },
                    {
                        key: 'leave-types',
                        label: <span><CarryOutOutlined /> ประเภทการลา</span>,
                        children: (
                            <Card bordered={false} style={{ borderRadius: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                                    <div>
                                        <Title level={4} style={{ margin: 0 }}>ประเภทการลาและการหักเงินเดือน</Title>
                                        <Text type="secondary">กำหนดประเภทการลา โควตาสิทธิ์ และระบุว่าเป็นการลาแบบหักเงิน (Unpaid) หรือไม่หักเงิน (Paid)</Text>
                                    </div>
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => {
                                            setEditingLeaveTypeId(null);
                                            leaveTypeForm.resetFields();
                                            setIsLeaveTypeModalOpen(true);
                                        }}
                                    >
                                        เพิ่มประเภทการลา
                                    </Button>
                                </div>
                                <Table
                                    columns={leaveTypeColumns}
                                    dataSource={leaveTypes}
                                    rowKey="id"
                                    pagination={false}
                                    bordered
                                    loading={loading}
                                />
                            </Card>
                        )
                    },
                    {
                        key: 'vacation-rules',
                        label: <span><SafetyCertificateOutlined /> นโยบายวันหยุดพักผ่อน</span>,
                        children: (
                            <Card bordered={false} style={{ borderRadius: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                                    <div>
                                        <Title level={4} style={{ margin: 0 }}>วันหยุดพักผ่อนประจำปีตามอายุงาน</Title>
                                        <Text type="secondary">กำหนดจำนวนวันลาพักร้อนที่ได้รับเพิ่มขึ้นตามอายุงานสะสมของพนักงาน</Text>
                                    </div>
                                    <Space wrap>
                                        <Button icon={<SafetyCertificateOutlined />} onClick={handleRecalculateAllQuotas} loading={loading}>
                                            คำนวณโควตาทุกคนตามระบบ
                                        </Button>
                                        <Button
                                            type="primary"
                                            icon={<PlusOutlined />}
                                            onClick={() => {
                                                setEditingLeaveRuleId(null);
                                                leaveRuleForm.resetFields();
                                                setIsLeaveRuleModalOpen(true);
                                            }}
                                        >
                                            เพิ่มเกณฑ์ใหม่
                                        </Button>
                                    </Space>
                                </div>
                                <Table
                                    columns={leaveRuleColumns}
                                    dataSource={leaveRules}
                                    rowKey="id"
                                    pagination={false}
                                    bordered
                                    loading={loading}
                                />
                            </Card>
                        )
                    },
                    {
                        key: 'public-holidays',
                        label: <span><CalendarOutlined /> วันหยุดนักขัตฤกษ์</span>,
                        children: (
                            <Card bordered={false} style={{ borderRadius: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                                    <div>
                                        <Title level={4} style={{ margin: 0 }}>วันหยุดนักขัตฤกษ์ประจำปี</Title>
                                        <Text type="secondary">รายการวันหยุดประเพณีและวันหยุดราชการประจำปีสำหรับใช้คำนวณปฏิทินทำงาน</Text>
                                    </div>
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => {
                                            holidayForm.resetFields();
                                            setIsHolidayModalOpen(true);
                                        }}
                                    >
                                        เพิ่มวันหยุด
                                    </Button>
                                </div>
                                <Table
                                    columns={holidayColumns}
                                    dataSource={publicHolidays}
                                    rowKey="id"
                                    pagination={{ pageSize: 12 }}
                                    bordered
                                    loading={loading}
                                />
                            </Card>
                        )
                    }
                ]}
            />

            {/* Request Modal */}
            <Modal
                title="แบบฟอร์มยื่นคำร้องขอลาหยุด"
                open={isRequestModalVisible}
                onCancel={() => { setIsRequestModalVisible(false); form.resetFields(); }}
                onOk={() => form.submit()}
                okText="บันทึกคำร้อง"
                cancelText="ยกเลิก"
                width={600}
            >
                <Form form={form} layout="vertical" onFinish={handleRequestSubmit}>
                    <Form.Item name="employee_id" label="พนักงาน" rules={[{ required: true, message: 'กรุณาเลือกพนักงาน' }]}>
                        <Select
                            showSearch
                            placeholder="ระบุพนักงาน"
                            optionFilterProp="children"
                            filterOption={(input, option) =>
                                String(option?.children || '').toLowerCase().includes(input.toLowerCase())
                            }
                        >
                            {employees.map(e => <Option key={e.id} value={e.id}>{e.name} ({e.department})</Option>)}
                        </Select>
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="leave_type_id" label="ประเภทการลา" rules={[{ required: true, message: 'กรุณาเลือกประเภทการลา' }]}>
                                <Select placeholder="เลือกประเภท">
                                    {leaveTypes.map(t => <Option key={t.id} value={t.id}>{t.leaveName}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="dateRange" label="ช่วงวันลา" rules={[{ required: true, message: 'กรุณาระบุช่วงวันที่ต้องการลา' }]}>
                                <RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" onChange={handleDateRangeChange} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="total_days" label="จำนวนวันลา (วัน)" rules={[{ required: true, message: 'กรุณาระบุจำนวนวัน' }]}>
                                <Input type="number" step="0.5" placeholder="เช่น 1 หรือ 0.5" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="reason" label="เหตุผล / รายละเอียด (ถ้ามี)">
                        <Input.TextArea rows={3} placeholder="ระบุเหตุผลการลา..." />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Upload CSV Modal */}
            <Modal
                title="นำเข้าบันทึกการลา (CSV)"
                open={isUploadModalVisible}
                onCancel={() => !uploading && setIsUploadModalVisible(false)}
                footer={null}
            >
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                    <Upload
                        accept=".csv"
                        beforeUpload={handleFileImport}
                        showUploadList={false}
                    >
                        <Button type="primary" size="large" icon={<UploadOutlined />} loading={uploading}>
                            {uploading ? 'กำลังนำเข้าข้อมูล...' : 'เลือกไฟล์ CSV เพื่ออัปโหลด'}
                        </Button>
                    </Upload>
                    <div style={{ marginTop: 20 }}>
                        <Text type="secondary">ไฟล์ต้องมีคอลัมน์: รหัสพนักงาน, ประเภทการลา, วันที่เริ่มลา, วันที่สิ้นสุด, จำนวนวัน, เหตุผล</Text>
                    </div>
                </div>
            </Modal>

            {/* Leave Rule Modal */}
            <Modal
                title={editingLeaveRuleId ? "แก้ไขเกณฑ์อายุงาน" : "เพิ่มเกณฑ์อายุงาน"}
                open={isLeaveRuleModalOpen}
                onOk={() => leaveRuleForm.submit()}
                onCancel={() => setIsLeaveRuleModalOpen(false)}
                okText="บันทึก"
                cancelText="ยกเลิก"
            >
                <Form form={leaveRuleForm} layout="vertical" onFinish={handleSaveLeaveRule}>
                    <Form.Item name="minYears" label="อายุงานขั้นต่ำ (ปี)" rules={[{ required: true, message: 'กรุณากรอกอายุงานขั้นต่ำ' }]}>
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="เช่น 1" />
                    </Form.Item>
                    <Form.Item name="vacationDays" label="จำนวนวันลาพักร้อนที่ได้ (วัน/ปี)" rules={[{ required: true, message: 'กรุณากรอกจำนวนวันลาพักร้อน' }]}>
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="เช่น 6" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Leave Type Modal */}
            <Modal
                title={editingLeaveTypeId ? "แก้ไขประเภทการลา" : "เพิ่มประเภทการลา"}
                open={isLeaveTypeModalOpen}
                onOk={() => leaveTypeForm.submit()}
                onCancel={() => setIsLeaveTypeModalOpen(false)}
                okText="บันทึก"
                cancelText="ยกเลิก"
            >
                <Form form={leaveTypeForm} layout="vertical" onFinish={handleSaveLeaveType} initialValues={{ isDeductSalary: false, daysPerYear: 0 }}>
                    <Form.Item name="leaveName" label="ชื่อประเภทการลา" rules={[{ required: true, message: 'กรุณากรอกชื่อประเภทการลา' }]}>
                        <Input placeholder="เช่น ลาป่วย, ลากิจ, ลาคลอด" />
                    </Form.Item>
                    <Form.Item name="daysPerYear" label="จำนวนวันลาที่อนุญาตต่อปี (0 = ไม่จำกัด หรือตามเกณฑ์อายุงาน)" rules={[{ required: true, message: 'กรุณาระบุจำนวนวัน' }]}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="isDeductSalary" valuePropName="checked" label="ตั้งค่าการหักเงิน">
                        <Switch checkedChildren="หักเงิน (Unpaid)" unCheckedChildren="ไม่หักเงิน (Paid)" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Public Holiday Modal */}
            <Modal
                title="เพิ่มวันหยุดนักขัตฤกษ์"
                open={isHolidayModalOpen}
                onOk={() => holidayForm.submit()}
                onCancel={() => setIsHolidayModalOpen(false)}
                okText="บันทึก"
                cancelText="ยกเลิก"
            >
                <Form form={holidayForm} layout="vertical" onFinish={handleSaveHoliday}>
                    <Form.Item name="holidayDate" label="วันที่หยุด" rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}>
                        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="เลือกวันที่" />
                    </Form.Item>
                    <Form.Item name="holidayName" label="ชื่อวันหยุด" rules={[{ required: true, message: 'กรุณาระบุชื่อวันหยุด' }]}>
                        <Input placeholder="เช่น วันขึ้นปีใหม่, วันสงกรานต์" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};
