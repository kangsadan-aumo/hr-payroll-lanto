import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Typography, Table, Tag, Button, Space, Input, DatePicker, Select, Modal, Form, Upload, message, Dropdown } from 'antd';
import type { TableProps, MenuProps } from 'antd';
import {
    CalendarOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    SearchOutlined,
    FilterOutlined,
    PlusOutlined,
    UploadOutlined,
    DownloadOutlined,
    MoreOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import axios from 'axios';
import { parseLeaveCSV } from './utils/csvProcessor';

dayjs.extend(isBetween);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

import { API_BASE_URL as API } from './api';

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
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Filter states
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateRangeFilter, setDateRangeFilter] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

    // Modal states
    const [isRequestModalVisible, setIsRequestModalVisible] = useState(false);
    const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [form] = Form.useForm();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [leavesRes, typesRes, empRes] = await Promise.all([
                axios.get(`${API}/leaves/requests`),
                axios.get(`${API}/leave-types`),
                axios.get(`${API}/employees`)
            ]);
            setLeaveRequests(leavesRes.data);
            setLeaveTypes(typesRes.data);
            setEmployees(empRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
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
        totalPending: leaveRequests.filter(r => r.status === 'pending').length,
        totalApproved: leaveRequests.filter(r => r.status === 'approved' && dayjs(r.start_date).isAfter(dayjs().subtract(1, 'month'))).length,
        leavesToday: leaveRequests.filter(r => r.status === 'approved' && dayjs().isBetween(dayjs(r.start_date), dayjs(r.end_date), 'day', '[]')).length,
    };

    // Filter data
    const filteredLeaves = leaveRequests.filter(req => {
        const matchSearch = req.employee_name.toLowerCase().includes(searchText.toLowerCase()) ||
            (req.department && req.department.toLowerCase().includes(searchText.toLowerCase()));
        const matchStatus = statusFilter === 'all' || req.status === statusFilter;
        
        let matchDate = true;
        if (dateRangeFilter) {
            const start = dateRangeFilter[0].startOf('day');
            const end = dateRangeFilter[1].endOf('day');
            const reqDate = dayjs(req.start_date);
            matchDate = reqDate.isBetween(start, end, 'day', '[]');
        }
        
        return matchSearch && matchStatus && matchDate;
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

    // Form submission
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

    // Handle Status change (Approve / Reject)
    const handleStatusUpdate = async (id: string, newStatus: 'approved' | 'rejected') => {
        try {
            await axios.put(`${API}/leaves/requests/${id}/status`, { status: newStatus });
            message.success(`อัปเดตสถานะเป็น ${newStatus === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ'} เรียบร้อย`);
            setLeaveRequests(prev => prev.map(req => req.id === id ? { ...req, status: newStatus } : req));
        } catch (error) {
            message.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
        }
    };

    // Table Context Menu
    const getActionMenu = (record: LeaveRequest): MenuProps => {
        return {
            items: [
                {
                    key: 'approve',
                    label: 'อนุมัติการลา',
                    icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
                    disabled: record.status === 'approved',
                    onClick: () => handleStatusUpdate(record.id, 'approved')
                },
                {
                    key: 'reject',
                    label: 'ไม่อนุมัติ',
                    icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                    disabled: record.status === 'rejected',
                    onClick: () => handleStatusUpdate(record.id, 'rejected')
                }
            ]
        };
    };

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
        },
        {
            title: 'สถานะ',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                let color = 'default';
                let text = status;
                let icon = null;

                if (status === 'approved') { color = 'success'; text = 'อนุมัติแล้ว'; icon = <CheckCircleOutlined />; }
                else if (status === 'rejected') { color = 'error'; text = 'ไม่อนุมัติ'; icon = <CloseCircleOutlined />; }
                else if (status === 'pending') { color = 'warning'; text = 'รอพิจารณา'; icon = <ClockCircleOutlined />; }

                return <Tag color={color} icon={icon}>{text}</Tag>;
            }
        },
        {
            title: 'จัดการ',
            key: 'action',
            align: 'center',
            render: (_, record) => (
                <Dropdown menu={getActionMenu(record)} trigger={['click']}>
                    <Button type="text" icon={<MoreOutlined style={{ fontSize: 16 }} />} />
                </Dropdown>
            )
        }
    ];

    // ── Normalize date string to YYYY-MM-DD ──
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
        return false; // Prevent default upload
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>ระบบจัดการการลา (Leave Management)</Title>
                    <Text type="secondary">ตรวจสอบ อนุมัติ และจัดการโควตาวันหยุดพนักงาน</Text>
                </div>
                <Space>
                    <Button icon={<DownloadOutlined />}>นำออกรายงาน</Button>
                    <Button icon={<UploadOutlined />} onClick={() => setIsUploadModalVisible(true)}>นำเข้าบันทึกการลา</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsRequestModalVisible(true)}>
                        ยื่นคำร้องขอลาใหม่
                    </Button>
                </Space>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ borderRadius: 8 }}>
                        <Statistic
                            title="รออนุมัติ (Pending)"
                            value={stats.totalPending}
                            valueStyle={{ color: '#faad14', fontWeight: 'bold' }}
                            prefix={<ClockCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ borderRadius: 8 }}>
                        <Statistic
                            title="อนุมัติเดือนนี้ (Approved)"
                            value={stats.totalApproved}
                            valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                            prefix={<CheckCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ borderRadius: 8 }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Space>
                        <Input
                            placeholder="ค้นหาชื่อพนักงาน หรือ แผนก..."
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            style={{ width: 300 }}
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            allowClear
                        />
                        <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }} prefix={<FilterOutlined />}>
                            <Option value="all">สถานะทั้งหมด</Option>
                            <Option value="pending">รอพิจารณา</Option>
                            <Option value="approved">อนุมัติแล้ว</Option>
                            <Option value="rejected">ไม่อนุมัติ</Option>
                        </Select>
                        <RangePicker 
                            style={{ width: 280 }} 
                            placeholder={['วันเริ่มต้น', 'วันสิ้นสุด']}
                            onChange={(dates) => setDateRangeFilter(dates as any)}
                            allowClear
                        />
                    </Space>
                    <Text type="secondary">พบข้อมูล {filteredLeaves.length} รายการ</Text>
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
        </div>
    );
};
