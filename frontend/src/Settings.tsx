import React, { useState, useEffect } from 'react';
import { Typography, Tabs, Form, Input, InputNumber, Button, Switch, TimePicker, DatePicker, Card, Col, Row, Select, message, Table, Space, Tag, Modal, Spin, Divider } from 'antd';
import { SaveOutlined, BankOutlined, FieldTimeOutlined, CalendarOutlined, SafetyCertificateOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

export const Settings: React.FC = () => {
    // Top Level State
    const [loading, setLoading] = useState(true);

    // Form instances
    const [companyForm] = Form.useForm();
    const [shiftForm] = Form.useForm();
    const [leaveRuleForm] = Form.useForm();
    const [leaveTypeForm] = Form.useForm();
    const [holidayForm] = Form.useForm();

    // Data States
    const [shifts, setShifts] = useState<any[]>([]);
    const [leaveRules, setLeaveRules] = useState<any[]>([]);
    const [otherLeaves, setOtherLeaves] = useState<any[]>([]);
    const [publicHolidays, setPublicHolidays] = useState<any[]>([]);

    // Modal Visibilities
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [isLeaveRuleModalOpen, setIsLeaveRuleModalOpen] = useState(false);
    const [isLeaveTypeModalOpen, setIsLeaveTypeModalOpen] = useState(false);
    const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);

    // Edit states
    const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
    const [editingLeaveRuleId, setEditingLeaveRuleId] = useState<string | null>(null);
    const [editingLeaveTypeId, setEditingLeaveTypeId] = useState<string | null>(null);

    const API_BASE = 'http://localhost:5000/api';

    // --- Data Fetching ---
    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [settingsRes, shiftsRes, leaveRulesRes, leaveTypesRes, holidaysRes] = await Promise.all([
                axios.get(`${API_BASE}/settings`),
                axios.get(`${API_BASE}/shifts`),
                axios.get(`${API_BASE}/leave-rules`),
                axios.get(`${API_BASE}/leave-types`),
                axios.get(`${API_BASE}/settings/holidays`)
            ]);

            // Set Company Info
            const s = settingsRes.data;
            companyForm.setFieldsValue({
                company_name: s.company_name,
                taxId: s.tax_id,
                address: s.address,
                deductExcessSickLeave: s.deduct_excess_sick_leave,
                deductExcessPersonalLeave: s.deduct_excess_personal_leave,
                latePenaltyPerMin: s.late_penalty_per_minute,
                autoDeductTax: s.auto_deduct_tax,
                autoDeductSso: s.auto_deduct_sso,
                payrollCutoffDate: s.payroll_cutoff_date,
                diligenceAllowance: s.diligence_allowance
            });

            // Set Others
            setShifts(shiftsRes.data);
            setLeaveRules(leaveRulesRes.data);
            setOtherLeaves(leaveTypesRes.data);
            setPublicHolidays(holidaysRes.data);
        } catch (error) {
            console.error(error);
            message.error('Failed to load settings data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // --- Company Info Handlers ---
    const onSaveCompanyInfo = async (values: any) => {
        try {
            const payload = {
                company_name: values.company_name,
                tax_id: values.taxId,
                address: values.address,
                deduct_excess_sick_leave: values.deductExcessSickLeave,
                deduct_excess_personal_leave: values.deductExcessPersonalLeave,
                late_penalty_per_minute: values.latePenaltyPerMin,
                auto_deduct_tax: values.autoDeductTax,
                auto_deduct_sso: values.autoDeductSso,
                payroll_cutoff_date: values.payrollCutoffDate,
                diligence_allowance: values.diligenceAllowance
            };
            await axios.put(`${API_BASE}/settings`, payload);
            message.success('อัปเดตข้อมูลบริษัทและนโยบายสำเร็จ');
        } catch (error) {
            message.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    };

    // --- CRUD Handlers ---

    // Shifts
    const handleSaveShift = async (values: any) => {
        const payload = {
            shiftName: values.shiftName,
            startTime: values.startTime.format('HH:mm:ss'),
            endTime: values.endTime.format('HH:mm:ss'),
            lateThreshold: values.lateThreshold,
            color: values.color
        };

        try {
            if (editingShiftId) {
                await axios.put(`${API_BASE}/shifts/${editingShiftId}`, payload);
                message.success('อัปเดตกะการทำงานสำเร็จ');
            } else {
                await axios.post(`${API_BASE}/shifts`, payload);
                message.success('เพิ่มกะการทำงานสำเร็จ');
            }
            setIsShiftModalOpen(false);
            setEditingShiftId(null);
            shiftForm.resetFields();
            fetchAllData();
        } catch (error) { message.error('เกิดข้อผิดพลาดในการบันทึกกะ'); }
    };

    const handleDeleteShift = async (id: string) => {
        try {
            await axios.delete(`${API_BASE}/shifts/${id}`);
            message.success('ลบกะการทำงานสำเร็จ');
            fetchAllData();
        } catch (error) { message.error('เกิดข้อผิดพลาดในการลบกะ'); }
    };

    // Leave Rules
    const handleSaveLeaveRule = async (values: any) => {
        const payload = {
            minYears: values.minYears,
            vacationDays: values.vacationDays
        };

        try {
            if (editingLeaveRuleId) {
                await axios.put(`${API_BASE}/leave-rules/${editingLeaveRuleId}`, payload);
                message.success('อัปเดตอายุงานสำเร็จ');
            } else {
                await axios.post(`${API_BASE}/leave-rules`, payload);
                message.success('เพิ่มเกณฑ์อายุงานสำเร็จ');
            }
            setIsLeaveRuleModalOpen(false);
            setEditingLeaveRuleId(null);
            leaveRuleForm.resetFields();
            fetchAllData();
        } catch (error) { message.error('เกิดข้อผิดพลาดในการบันทึกอายุงาน'); }
    };

    const handleDeleteLeaveRule = async (id: string) => {
        try {
            await axios.delete(`${API_BASE}/leave-rules/${id}`);
            message.success('ลบเกณฑ์อายุงานสำเร็จ');
            fetchAllData();
        } catch (error) { message.error('เกิดข้อผิดพลาดในการลบอายุงาน'); }
    };

    // Other Leaves (Types)
    const handleSaveLeaveType = async (values: any) => {
        const payload = {
            leaveName: values.leaveName,
            isDeductSalary: values.isDeductSalary
        };

        try {
            if (editingLeaveTypeId) {
                await axios.put(`${API_BASE}/leave-types/${editingLeaveTypeId}`, payload);
                message.success('อัปเดตประเภทการลาสำเร็จ');
            } else {
                await axios.post(`${API_BASE}/leave-types`, payload);
                message.success('เพิ่มประเภทการลาสำเร็จ');
            }
            setIsLeaveTypeModalOpen(false);
            setEditingLeaveTypeId(null);
            leaveTypeForm.resetFields();
            fetchAllData();
        } catch (error) { message.error('เกิดข้อผิดพลาดในการบันทึกประเภทการลา'); }
    };

    const handleDeleteLeaveType = async (id: string) => {
        try {
            await axios.delete(`${API_BASE}/leave-types/${id}`);
            message.success('ลบประเภทการลาสำเร็จ');
            fetchAllData();
        } catch (error) { message.error('เกิดข้อผิดพลาดในการลบประเภทการลา'); }
    };

    // Public Holidays
    const handleSaveHoliday = async (values: any) => {
        const payload = {
            date: values.holidayDate.format('YYYY-MM-DD'),
            name: values.holidayName
        };

        try {
            await axios.post(`${API_BASE}/settings/holidays`, payload);
            message.success('เพิ่มวันหยุดนักขัตฤกษ์สำเร็จ');
            setIsHolidayModalOpen(false);
            holidayForm.resetFields();
            fetchAllData();
        } catch (error: any) {
            message.error(error.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกวันหยุด');
        }
    };

    const handleDeleteHoliday = async (id: string) => {
        try {
            await axios.delete(`${API_BASE}/settings/holidays/${id}`);
            message.success('ลบวันหยุดสำเร็จ');
            fetchAllData();
        } catch (error) { message.error('เกิดข้อผิดพลาดในการลบวันหยุด'); }
    };


    // --- Columns Definitions ---

    const shiftColumns = [
        { title: 'ชื่อกะ (Shift Name)', dataIndex: 'shiftName', key: 'shiftName', render: (text: string, record: any) => <Tag color={record.color || 'blue'}>{text}</Tag> },
        { title: 'เวลาเข้างาน', dataIndex: 'startTime', key: 'startTime' },
        { title: 'เวลาเลิกงาน', dataIndex: 'endTime', key: 'endTime' },
        { title: 'สายได้ไม่เกิน (นาที)', dataIndex: 'lateThreshold', key: 'lateThreshold', render: (val: number) => `${val} นาที` },
        {
            title: 'จัดการ', key: 'action', align: 'center' as const, render: (_: any, record: any) => (
                <Space>
                    <Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => {
                        setEditingShiftId(record.id);
                        shiftForm.setFieldsValue({
                            shiftName: record.shiftName,
                            startTime: dayjs(record.startTime, 'HH:mm:ss'),
                            endTime: dayjs(record.endTime, 'HH:mm:ss'),
                            lateThreshold: record.lateThreshold,
                            color: record.color || 'blue'
                        });
                        setIsShiftModalOpen(true);
                    }} />
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteShift(record.id)} />
                </Space>
            )
        }
    ];

    const leaveRuleColumns = [
        { title: 'อายุงานขั้นต่ำ (ปี)', dataIndex: 'minYears', key: 'minYears' },
        { title: 'โควตาวันหยุดพักผ่อน (วัน/ปี)', dataIndex: 'vacationDays', key: 'vacationDays' },
        {
            title: 'จัดการ', key: 'action', align: 'center' as const, render: (_: any, record: any) => (
                <Space>
                    <Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => {
                        setEditingLeaveRuleId(record.id);
                        leaveRuleForm.setFieldsValue({
                            minYears: record.minYears,
                            vacationDays: record.vacationDays
                        });
                        setIsLeaveRuleModalOpen(true);
                    }} />
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteLeaveRule(record.id)} />
                </Space>
            )
        }
    ];

    const leaveTypeColumns = [
        { title: 'ประเภทการลา', dataIndex: 'leaveName', key: 'leaveName' },
        { title: 'หักเงินเดือนหรือไม่', dataIndex: 'isDeductSalary', key: 'isDeductSalary', render: (val: boolean) => val ? <Tag color="error">หักเงิน (Unpaid)</Tag> : <Tag color="success">ไม่หักเงิน (Paid)</Tag> },
        {
            title: 'จัดการ', key: 'action', align: 'center' as const, render: (_: any, record: any) => (
                <Space>
                    <Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => {
                        setEditingLeaveTypeId(record.id);
                        leaveTypeForm.setFieldsValue({
                            leaveName: record.leaveName,
                            isDeductSalary: record.isDeductSalary
                        });
                        setIsLeaveTypeModalOpen(true);
                    }} />
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteLeaveType(record.id)} />
                </Space>
            )
        }
    ];

    const holidayColumns = [
        { title: 'วันที่', dataIndex: 'holiday_date', key: 'holiday_date', render: (val: string) => dayjs(val).format('DD/MM/YYYY') },
        { title: 'ชื่อวันหยุด', dataIndex: 'name', key: 'name' },
        {
            title: 'จัดการ', key: 'action', align: 'center' as const, render: (_: any, record: any) => (
                <Space>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteHoliday(record.id)} />
                </Space>
            )
        }
    ];

    if (loading) {
        return <div style={{ textAlign: 'center', marginTop: 100 }}><Spin size="large" /></div>;
    }

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>ตั้งค่าระบบ (System Settings)</Title>
                <Text type="secondary">กำหนดค่าพื้นฐาน นโยบาย และข้อมูลบริษัท</Text>
            </div>

            <Card bordered={false} style={{ borderRadius: 8, minHeight: 'calc(100vh - 160px)' }}>
                <Tabs defaultActiveKey="1" tabPosition="left">
                    <TabPane tab={<span><BankOutlined /> ข้อมูลบริษัท & นโยบาย</span>} key="1">
                        <div style={{ maxWidth: 800, paddingLeft: 24 }}>
                            <Title level={4}>ข้อมูลบริษัท</Title>
                            <Divider style={{ margin: '12px 0 24px 0' }} />
                            <Form form={companyForm} layout="vertical" onFinish={onSaveCompanyInfo}>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item name="company_name" label="ชื่อบริษัท" rules={[{ required: true }]}>
                                            <Input placeholder="ระบุชื่อบริษัท" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="taxId" label="หมายเลขผู้เสียภาษี">
                                            <Input placeholder="ระบุหมายเลข 13 หลัก" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Form.Item name="address" label="ที่อยู่บริษัท">
                                    <Input.TextArea rows={2} />
                                </Form.Item>

                                <Title level={4} style={{ marginTop: 32 }}>นโยบายการหักเงิน (Payroll Policies)</Title>
                                <Divider style={{ margin: '12px 0 24px 0' }} />

                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Card size="small" style={{ marginBottom: 16 }}>
                                            <Form.Item name="deductExcessSickLeave" valuePropName="checked" style={{ margin: 0 }}>
                                                <Switch /> <Text style={{ marginLeft: 8 }}>หักเงินหากลาป่วยเกินโควตาขั้นต่ำตามกฎหมาย (30 วัน)</Text>
                                            </Form.Item>
                                        </Card>
                                    </Col>
                                    <Col span={12}>
                                        <Card size="small" style={{ marginBottom: 16 }}>
                                            <Form.Item name="deductExcessPersonalLeave" valuePropName="checked" style={{ margin: 0 }}>
                                                <Switch /> <Text style={{ marginLeft: 8 }}>หักเงินหากลากิจเกินโควตา (Paid Leave)</Text>
                                            </Form.Item>
                                        </Card>
                                    </Col>
                                </Row>

                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Card size="small" style={{ marginBottom: 16 }}>
                                            <Form.Item name="autoDeductTax" valuePropName="checked" style={{ margin: 0 }}>
                                                <Switch /> <Text style={{ marginLeft: 8 }}>คำนวณและหักภาษี ณ ที่จ่าย (ภ.ง.ด.1) อัตโนมัติ</Text>
                                            </Form.Item>
                                        </Card>
                                    </Col>
                                    <Col span={12}>
                                        <Card size="small" style={{ marginBottom: 16 }}>
                                            <Form.Item name="autoDeductSso" valuePropName="checked" style={{ margin: 0 }}>
                                                <Switch /> <Text style={{ marginLeft: 8 }}>คำนวณและหักประกันสังคม (SSO) อัตโนมัติ</Text>
                                            </Form.Item>
                                        </Card>
                                    </Col>
                                </Row>

                                <Row gutter={16} style={{ marginTop: 16 }}>
                                    <Col span={12}>
                                        <Form.Item name="latePenaltyPerMin" label="อัตราการหักเงินมาสาย (บาท / นาที)">
                                            <InputNumber min={0} defaultValue={0} style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="diligenceAllowance" label="เบี้ยขยัน (บาท / เดือน) หากไม่สายหรือลางาน">
                                            <InputNumber min={0} defaultValue={0} style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Row gutter={16} style={{ marginTop: 16 }}>
                                    <Col span={12}>
                                        <Form.Item name="payrollCutoffDate" label="วันที่ตัดรอบเงินเดือน (ของทุกเดือน)" tooltip="หากเลือก 25 หมายถึงตัดรอบตั้งแต่วันที่ 26 เดือนก่อนหน้า ถึง 25 เดือนปัจจุบัน">
                                            <Select>
                                                <Select.Option value={25}>วันที่ 25</Select.Option>
                                                <Select.Option value={30}>สิ้นเดือน (30/31)</Select.Option>
                                                <Select.Option value={15}>วันที่ 15</Select.Option>
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item style={{ marginTop: 24 }}>
                                    <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large">บันทึกข้อมูลและนโยบาย</Button>
                                </Form.Item>
                            </Form>
                        </div>
                    </TabPane>

                    <TabPane tab={<span><FieldTimeOutlined /> เวลาการทำงาน (Shifts)</span>} key="2">
                        <div style={{ paddingLeft: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                <Title level={4}>จัดการกะเวลาทำงาน</Title>
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingShiftId(null); shiftForm.resetFields(); setIsShiftModalOpen(true); }}>เพิ่มกะใหม่</Button>
                            </div>
                            <Table columns={shiftColumns} dataSource={shifts} rowKey="id" pagination={false} bordered />
                        </div>
                    </TabPane>

                    <TabPane tab={<span><CalendarOutlined /> นโยบายวันหยุดพักผ่อน</span>} key="3">
                        <div style={{ paddingLeft: 24, maxWidth: 800 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                <Title level={4}>วันหยุดพักผ่อนประจำปีตามอายุงาน</Title>
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingLeaveRuleId(null); leaveRuleForm.resetFields(); setIsLeaveRuleModalOpen(true); }}>เพิ่มเกณฑ์ใหม่</Button>
                            </div>
                            <Table columns={leaveRuleColumns} dataSource={leaveRules} rowKey="id" pagination={false} bordered />
                        </div>
                    </TabPane>

                    <TabPane tab={<span><SafetyCertificateOutlined /> ประเภทการลาอื่นๆ</span>} key="4">
                        <div style={{ paddingLeft: 24, maxWidth: 800 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                <Title level={4}>ประเภทการลาและการหักเงิน</Title>
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingLeaveTypeId(null); leaveTypeForm.resetFields(); setIsLeaveTypeModalOpen(true); }}>เพิ่มประเภทการลา</Button>
                            </div>
                            <Table columns={leaveTypeColumns} dataSource={otherLeaves} rowKey="id" pagination={false} bordered />
                        </div>
                    </TabPane>

                    <TabPane tab={<span><CalendarOutlined /> วันหยุดนักขัตฤกษ์</span>} key="5">
                        <div style={{ paddingLeft: 24, maxWidth: 800 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                <Title level={4}>วันหยุดนักขัตฤกษ์ประจำปี</Title>
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => { holidayForm.resetFields(); setIsHolidayModalOpen(true); }}>เพิ่มวันหยุด</Button>
                            </div>
                            <Table columns={holidayColumns} dataSource={publicHolidays} rowKey="id" pagination={{ pageSize: 10 }} bordered />
                        </div>
                    </TabPane>

                </Tabs>
            </Card>

            {/* Shift Modal */}
            <Modal title={editingShiftId ? "แก้ไขกะทำงาน" : "เพิ่มกะทำงานใหม่"} open={isShiftModalOpen} onOk={() => shiftForm.submit()} onCancel={() => setIsShiftModalOpen(false)}>
                <Form form={shiftForm} layout="vertical" onFinish={handleSaveShift}>
                    <Form.Item name="shiftName" label="ชื่อกะ" rules={[{ required: true }]}><Input /></Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="startTime" label="เวลาเข้างาน" rules={[{ required: true }]}>
                                <TimePicker format="HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="endTime" label="เวลาเลิกงาน" rules={[{ required: true }]}>
                                <TimePicker format="HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="lateThreshold" label="สายได้ไม่เกิน (นาที)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                    <Form.Item name="color" label="สีแสดงผล" initialValue="blue">
                        <Select>
                            <Select.Option value="blue"><Tag color="blue">Blue</Tag></Select.Option>
                            <Select.Option value="cyan"><Tag color="cyan">Cyan</Tag></Select.Option>
                            <Select.Option value="orange"><Tag color="orange">Orange</Tag></Select.Option>
                            <Select.Option value="purple"><Tag color="purple">Purple</Tag></Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Leave Rule Modal */}
            <Modal title={editingLeaveRuleId ? "แก้ไขเกณฑ์อายุงาน" : "เพิ่มเกณฑ์อายุงาน"} open={isLeaveRuleModalOpen} onOk={() => leaveRuleForm.submit()} onCancel={() => setIsLeaveRuleModalOpen(false)}>
                <Form form={leaveRuleForm} layout="vertical" onFinish={handleSaveLeaveRule}>
                    <Form.Item name="minYears" label="อายุงานขั้นต่ำ (ปี)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                    <Form.Item name="vacationDays" label="จำนวนวันลาพักร้อนที่ได้ (วัน)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                </Form>
            </Modal>

            {/* Leave Type Modal */}
            <Modal title={editingLeaveTypeId ? "แก้ไขประเภทการลา" : "เพิ่มประเภทการลา"} open={isLeaveTypeModalOpen} onOk={() => leaveTypeForm.submit()} onCancel={() => setIsLeaveTypeModalOpen(false)}>
                <Form form={leaveTypeForm} layout="vertical" onFinish={handleSaveLeaveType} initialValues={{ isDeductSalary: false }}>
                    <Form.Item name="leaveName" label="ชื่อประเภทการลา" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="isDeductSalary" valuePropName="checked" label="ตั้งค่าการหักเงิน">
                        <Switch checkedChildren="หักเงิน" unCheckedChildren="ไม่หักเงิน" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Holiday Modal */}
            <Modal title="เพิ่มวันหยุดนักขัตฤกษ์" open={isHolidayModalOpen} onOk={() => holidayForm.submit()} onCancel={() => setIsHolidayModalOpen(false)}>
                <Form form={holidayForm} layout="vertical" onFinish={handleSaveHoliday}>
                    <Form.Item name="holidayDate" label="วันที่หยุด" rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}>
                        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>
                    <Form.Item name="holidayName" label="ชื่อวันหยุด" rules={[{ required: true, message: 'กรุณาระบุชื่อวันหยุด' }]}>
                        <Input placeholder="เช่น วันขึ้นปีใหม่" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};
