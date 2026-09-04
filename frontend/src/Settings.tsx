import React, { useState, useEffect } from 'react';
import { Typography, Tabs, Form, Input, InputNumber, Button, Switch, DatePicker, Card, Col, Row, Select, message, Table, Space, Tag, Modal, Spin, Divider, Radio, Alert } from 'antd';
import { SaveOutlined, BankOutlined, CalendarOutlined, SafetyCertificateOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_BASE_URL as API } from './api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

export const Settings: React.FC = () => {
    // Top Level State
    const [loading, setLoading] = useState(true);

    // Form instances
    const [companyForm] = Form.useForm();
    const [leaveRuleForm] = Form.useForm();
    const [leaveTypeForm] = Form.useForm();
    const [holidayForm] = Form.useForm();

    // Data States
    const [leaveRules, setLeaveRules] = useState<any[]>([]);
    const [otherLeaves, setOtherLeaves] = useState<any[]>([]);
    const [publicHolidays, setPublicHolidays] = useState<any[]>([]);
    const [payrollRounds, setPayrollRounds] = useState<number>(1);

    // Modal Visibilities
    const [isLeaveRuleModalOpen, setIsLeaveRuleModalOpen] = useState(false);
    const [isLeaveTypeModalOpen, setIsLeaveTypeModalOpen] = useState(false);
    const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);

    // Edit states
    const [editingLeaveRuleId, setEditingLeaveRuleId] = useState<string | null>(null);
    const [editingLeaveTypeId, setEditingLeaveTypeId] = useState<string | null>(null);

    const API_BASE = API;

    // --- Data Fetching ---
    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [settingsRes, leaveRulesRes, leaveTypesRes, holidaysRes] = await Promise.all([
                axios.get(`${API_BASE}/settings`),
                axios.get(`${API_BASE}/leave-rules`),
                axios.get(`${API_BASE}/leave-types`),
                axios.get(`${API_BASE}/settings/holidays`)
            ]);

            // Set Company Info & Cutoff settings
            const s = settingsRes.data || {};
            const rounds = Number(s.payroll_rounds) === 2 ? 2 : 1;
            setPayrollRounds(rounds);
            companyForm.setFieldsValue({
                company_name: s.company_name || '',
                taxId: s.tax_id || '',
                branch_code: s.branch_code || '00000',
                address: s.address || '',
                payroll_rounds: rounds,
                payrollCutoffDate: Number(s.payroll_cutoff_date) || 25,
                payrollCutoffDate2: Number(s.payroll_cutoff_date_2) || 15
            });

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
            const rounds = Number(values.payroll_rounds) || 1;
            const payload = {
                company_name: values.company_name,
                tax_id: values.taxId,
                branch_code: values.branch_code,
                address: values.address,
                payroll_rounds: rounds,
                payroll_cutoff_date: Number(values.payrollCutoffDate) || 25,
                payroll_cutoff_date_2: rounds === 2 ? (Number(values.payrollCutoffDate2) || 15) : null
            };
            await axios.put(`${API_BASE}/settings`, payload);
            message.success('อัปเดตข้อมูลบริษัทและรอบการตัดเงินเดือนสำเร็จ');
            fetchAllData();
        } catch (error) {
            console.error('Settings update error:', error);
            message.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    };

    // --- CRUD Handlers ---

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

    const handleRecalculateAllQuotas = async () => {
        try {
            setLoading(true);
            await axios.post(`${API_BASE}/employees/recalculate-all-quotas`);
            message.success('คำนวณโควตาวันลาให้พนักงานทุกคนสำเร็จตามกฎบริษัท');
            fetchAllData();
        } catch (error) {
            message.error('เกิดข้อผิดพลาดในการคำนวณโควตา');
        } finally {
            setLoading(false);
        }
    };

    // Other Leaves (Types)
    const handleSaveLeaveType = async (values: any) => {
        const payload = {
            leaveName: values.leaveName,
            isDeductSalary: values.isDeductSalary,
            daysPerYear: values.daysPerYear
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
        { title: 'จำนวนวันที่ลาได้ (วัน/ปี)', dataIndex: 'daysPerYear', key: 'daysPerYear', render: (val: number) => val > 0 ? `${val} วัน` : 'ไม่จำกัด (หรือตามเกณฑ์อายุงาน)' },
        { title: 'หักเงินเดือนหรือไม่', dataIndex: 'isDeductSalary', key: 'isDeductSalary', render: (val: boolean) => val ? <Tag color="error">หักเงิน (Unpaid)</Tag> : <Tag color="success">ไม่หักเงิน (Paid)</Tag> },
        {
            title: 'จัดการ', key: 'action', align: 'center' as const, render: (_: any, record: any) => (
                <Space>
                    <Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => {
                        setEditingLeaveTypeId(record.id);
                        leaveTypeForm.setFieldsValue({
                            leaveName: record.leaveName,
                            isDeductSalary: record.isDeductSalary,
                            daysPerYear: record.daysPerYear
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

    // (Removed conditional return to prevent unmounting form)
    // if (loading) {
    //     return <div style={{ textAlign: 'center', marginTop: 100 }}><Spin size="large" /></div>;
    // }

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>ตั้งค่าระบบ (System Settings)</Title>
                <Text type="secondary">กำหนดค่าพื้นฐาน นโยบาย และข้อมูลบริษัท</Text>
            </div>

            <Card bordered={false} style={{ borderRadius: 8, minHeight: 'calc(100vh - 160px)' }}>
              <Spin spinning={loading} size="large">
                <Tabs defaultActiveKey="1" tabPosition="left">
                    <TabPane tab={<span><BankOutlined /> ข้อมูลบริษัท & รอบเงินเดือน</span>} key="1">
                        <div style={{ maxWidth: 800, paddingLeft: 24 }}>
                            <Title level={4}>ข้อมูลบริษัท</Title>
                            <Divider style={{ margin: '12px 0 24px 0' }} />
                            <Form form={companyForm} layout="vertical" onFinish={onSaveCompanyInfo}>
                                <Row gutter={16}>
                                    <Col span={10}>
                                        <Form.Item name="company_name" label="ชื่อบริษัท" rules={[{ required: true, message: 'กรุณาระบุชื่อบริษัท' }]}>
                                            <Input placeholder="ระบุชื่อบริษัท" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="taxId" label="หมายเลขผู้เสียภาษี">
                                            <Input placeholder="ระบุหมายเลข 13 หลัก" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item name="branch_code" label="รหัสสาขา (Branch Code)">
                                            <Input placeholder="00000" maxLength={5} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Form.Item name="address" label="ที่อยู่บริษัท">
                                    <Input.TextArea rows={2} placeholder="ระบุที่อยู่บริษัท" />
                                </Form.Item>

                                <Title level={4} style={{ marginTop: 32 }}>การตัดรอบเงินเดือน (Payroll Cutoff Cycle)</Title>
                                <Divider style={{ margin: '12px 0 20px 0' }} />

                                <Alert
                                    type="info"
                                    showIcon
                                    message="สูตรคำนวณ รายการรายได้ และรายการหักเงิน"
                                    description="สูตรคำนวณทั้งหมด (ค่าโอที, เบี้ยขยัน, ค่าปรับมาสาย, หักวันลา, ประกันสังคม ฯลฯ) ถูกย้ายไปบริหารจัดการอย่างยืดหยุ่นที่เมนู 'ตั้งค่าสูตรคำนวณ' เรียบร้อยแล้ว"
                                    style={{ marginBottom: 20 }}
                                />

                                <Form.Item 
                                    name="payroll_rounds" 
                                    label="รอบการตัดเงินเดือนในแต่ละเดือน" 
                                    tooltip="เลือกได้ว่าจะให้ตัดเงินเดือนเดือนละ 1 รอบ หรือ 2 รอบ"
                                    rules={[{ required: true }]}
                                >
                                    <Radio.Group onChange={(e) => setPayrollRounds(e.target.value)} buttonStyle="solid">
                                        <Radio.Button value={1} style={{ padding: '0 24px', marginRight: 12, borderRadius: 6 }}>
                                            🗓️ ตัดเดือนละ 1 รอบ
                                        </Radio.Button>
                                        <Radio.Button value={2} style={{ padding: '0 24px', borderRadius: 6 }}>
                                            🗓️🗓️ ตัดเดือนละ 2 รอบ
                                        </Radio.Button>
                                    </Radio.Group>
                                </Form.Item>

                                {payrollRounds === 1 ? (
                                    <Row gutter={16} style={{ marginTop: 12 }}>
                                        <Col span={14}>
                                            <Form.Item 
                                                name="payrollCutoffDate" 
                                                label="วันที่ตัดรอบเงินเดือน (ของทุกเดือน)" 
                                                tooltip="วันสุดท้ายของการนับเวลาทำงานในรอบเดือนนั้นๆ เช่น วันที่ 25 หมายถึงตัดยอดตั้งแต่วันที่ 26 เดือนก่อนหน้า ถึง 25 เดือนปัจจุบัน"
                                                rules={[{ required: true, message: 'กรุณาเลือกวันตัดยอด' }]}
                                            >
                                                <Select placeholder="เลือกวันตัดยอด">
                                                    <Select.Option value={25}>วันที่ 25 ของเดือน (รอบปกติ)</Select.Option>
                                                    <Select.Option value={31}>สิ้นเดือน (วันสุดท้ายของเดือน)</Select.Option>
                                                    <Select.Option value={30}>วันที่ 30 ของเดือน</Select.Option>
                                                    <Select.Option value={20}>วันที่ 20 ของเดือน</Select.Option>
                                                    <Select.Option value={15}>วันที่ 15 ของเดือน</Select.Option>
                                                    <Select.OptGroup label="เลือกวันที่ 1 - 30">
                                                        {Array.from({ length: 30 }, (_, i) => i + 1).map(day => (
                                                            <Select.Option key={day} value={day}>วันที่ {day} ของเดือน</Select.Option>
                                                        ))}
                                                    </Select.OptGroup>
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                ) : (
                                    <Row gutter={16} style={{ marginTop: 12 }}>
                                        <Col span={12}>
                                            <Form.Item 
                                                name="payrollCutoffDate" 
                                                label="วันที่ตัดยอด รอบที่ 1 (งวดแรก)" 
                                                tooltip="เช่น ตัดยอดวันที่ 15 ของเดือน สำหรับจ่ายงวดกลางเดือน"
                                                rules={[{ required: true, message: 'กรุณาเลือกวันตัดยอดรอบที่ 1' }]}
                                            >
                                                <Select placeholder="เลือกวันตัดยอดรอบที่ 1">
                                                    <Select.Option value={15}>วันที่ 15 ของเดือน (แนะนำงวดที่ 1)</Select.Option>
                                                    <Select.Option value={10}>วันที่ 10 ของเดือน</Select.Option>
                                                    <Select.OptGroup label="เลือกวันที่ 1 - 28">
                                                        {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                                            <Select.Option key={day} value={day}>วันที่ {day} ของเดือน</Select.Option>
                                                        ))}
                                                    </Select.OptGroup>
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item 
                                                name="payrollCutoffDate2" 
                                                label="วันที่ตัดยอด รอบที่ 2 (งวดสิ้นเดือน)" 
                                                tooltip="เช่น ตัดยอดสิ้นเดือน หรือ วันที่ 30 ของเดือน สำหรับจ่ายงวดสิ้นเดือน"
                                                rules={[{ required: true, message: 'กรุณาเลือกวันตัดยอดรอบที่ 2' }]}
                                            >
                                                <Select placeholder="เลือกวันตัดยอดรอบที่ 2">
                                                    <Select.Option value={31}>สิ้นเดือน (วันสุดท้ายของเดือน - แนะนำงวดที่ 2)</Select.Option>
                                                    <Select.Option value={30}>วันที่ 30 ของเดือน</Select.Option>
                                                    <Select.Option value={25}>วันที่ 25 ของเดือน</Select.Option>
                                                    <Select.OptGroup label="เลือกวันที่ 16 - 30">
                                                        {Array.from({ length: 15 }, (_, i) => i + 16).map(day => (
                                                            <Select.Option key={day} value={day}>วันที่ {day} ของเดือน</Select.Option>
                                                        ))}
                                                    </Select.OptGroup>
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                )}

                                <Form.Item style={{ marginTop: 24 }}>
                                    <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large">บันทึกข้อมูลและรอบเงินเดือน</Button>
                                </Form.Item>
                            </Form>
                        </div>
                    </TabPane>

                    <TabPane tab={<span><CalendarOutlined /> นโยบายวันหยุดพักผ่อน</span>} key="3">
                        <div style={{ paddingLeft: 24, maxWidth: 800 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                <Title level={4}>วันหยุดพักผ่อนประจำปีตามอายุงาน</Title>
                                <Space>
                                    <Button icon={<SafetyCertificateOutlined />} onClick={handleRecalculateAllQuotas}>คำนวณโควตาทุกคนตามระบบ</Button>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingLeaveRuleId(null); leaveRuleForm.resetFields(); setIsLeaveRuleModalOpen(true); }}>เพิ่มเกณฑ์ใหม่</Button>
                                </Space>
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
              </Spin>
            </Card>

            {/* Leave Rule Modal */}
            <Modal title={editingLeaveRuleId ? "แก้ไขเกณฑ์อายุงาน" : "เพิ่มเกณฑ์อายุงาน"} open={isLeaveRuleModalOpen} onOk={() => leaveRuleForm.submit()} onCancel={() => setIsLeaveRuleModalOpen(false)}>
                <Form form={leaveRuleForm} layout="vertical" onFinish={handleSaveLeaveRule}>
                    <Form.Item name="minYears" label="อายุงานขั้นต่ำ (ปี)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                    <Form.Item name="vacationDays" label="จำนวนวันลาพักร้อนที่ได้ (วัน)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                </Form>
            </Modal>

            {/* Leave Type Modal */}
            <Modal title={editingLeaveTypeId ? "แก้ไขประเภทการลา" : "เพิ่มประเภทการลา"} open={isLeaveTypeModalOpen} onOk={() => leaveTypeForm.submit()} onCancel={() => setIsLeaveTypeModalOpen(false)}>
                <Form form={leaveTypeForm} layout="vertical" onFinish={handleSaveLeaveType} initialValues={{ isDeductSalary: false, daysPerYear: 0 }}>
                    <Form.Item name="leaveName" label="ชื่อประเภทการลา" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="daysPerYear" label="จำนวนวันลาที่อนุญาตต่อปี (0 = ไม่จำกัด)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
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
