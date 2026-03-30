import React, { useState, useEffect, useRef } from 'react';
import {
    Row, Col, Card, Statistic, Typography, Table, Tag, Button, Space,
    Input, Select, DatePicker, message, Modal, Divider, Tooltip, Alert,
    Drawer, Form, InputNumber
} from 'antd';
import type { TableProps } from 'antd';
import {
    DollarOutlined, SearchOutlined, PrinterOutlined, CheckCircleOutlined,
    FileExcelOutlined, WalletOutlined, BankOutlined, CalculatorOutlined,
    SyncOutlined, InfoCircleOutlined, EditOutlined, DownloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const { Title, Text } = Typography;
const { Option } = Select;

interface PayrollRecord {
    employeeId: string;
    employee_id?: number;
    name: string;
    department: string;
    baseSalary: number;
    earnings: { overtime: number; bonus: number; diligenceAllowance?: number; };
    deductions: { tax: number; socialSecurity: number; latePenalty: number; unpaidLeave: number; };
    netSalary?: number;
    status?: 'draft' | 'approved' | 'paid';
    period?: { month: number; year: number };
    isPreview?: boolean;
}

import { API_BASE_URL as API } from './api';

export const Payroll: React.FC<{ initialMonth?: { month: number; year: number } | null }> = ({ initialMonth }) => {
    const [payrollData, setPayrollData] = useState<PayrollRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState<dayjs.Dayjs | null>(
        initialMonth ? dayjs().year(initialMonth.year).month(initialMonth.month - 1) : dayjs()
    );
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [isPayslipModalVisible, setIsPayslipModalVisible] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<PayrollRecord | null>(null);
    const [companyName, setCompanyName] = useState('บริษัท ตัวอย่าง จำกัด');
    const printRef = useRef<HTMLDivElement>(null);
    // ── Edit Drawer state ──
    const [editDrawerOpen, setEditDrawerOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<PayrollRecord | null>(null);
    const [editSaving, setEditSaving] = useState(false);
    const [editForm] = Form.useForm();
    const [otHelperHours, setOtHelperHours] = useState<number | null>(0);
    const [otHelperRate, setOtHelperRate] = useState<number>(1.5);

    const currentMonth = monthFilter?.month() ? monthFilter.month() + 1 : dayjs().month() + 1;
    const currentYear = monthFilter?.year() || dayjs().year();

    const fetchPayroll = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/payroll`, {
                params: { month: currentMonth, year: currentYear }
            });
            setPayrollData(res.data.map((r: any) => ({ ...r, status: r.status || 'draft' })));

            // fetch settings for company name
            try {
                const setRes = await axios.get(`${API}/settings`);
                if (setRes.data && setRes.data.company_name) {
                    setCompanyName(setRes.data.company_name);
                }
            } catch (e) { console.log('No settings found'); }

        } catch (error) {
            message.error('ไม่สามารถเรียกข้อมูลบัญชีเงินเดือนได้');
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await axios.get(`${API}/settings`);
            if (res.data?.company_name) setCompanyName(res.data.company_name);
        } catch { /* silent */ }
    };

    useEffect(() => {
        fetchPayroll();
        fetchSettings();
    }, [monthFilter]);

    const handleCalculate = async () => {
        setCalculating(true);
        try {
            const res = await axios.post(`${API}/payroll/calculate`, { month: currentMonth, year: currentYear });
            message.success(res.data.message);
            await fetchPayroll();
        } catch (error: any) {
            message.error(error?.response?.data?.error || 'คำนวณเงินเดือนไม่สำเร็จ');
        } finally {
            setCalculating(false);
        }
    };

    const handleApprovePayroll = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('กรุณาเลือกพนักงานที่ต้องการอนุมัติก่อน');
            return;
        }
        try {
            const res = await axios.put(`${API}/payroll/approve`, {
                employee_codes: selectedRowKeys,
                month: currentMonth,
                year: currentYear,
            });
            message.success(res.data.message);
            setSelectedRowKeys([]);
            await fetchPayroll();
        } catch (error: any) {
            message.error(error?.response?.data?.error || 'อนุมัติไม่สำเร็จ');
        }
    };

    const handleOpenEdit = (record: PayrollRecord) => {
        setEditingEmployee(record);
        editForm.setFieldsValue({
            overtime_pay: record.earnings.overtime || 0,
            bonus: record.earnings.bonus || 0,
            diligence_allowance: record.earnings.diligenceAllowance || 0,
            late_deduction: record.deductions.latePenalty || 0,
            leave_deduction: record.deductions.unpaidLeave || 0,
            tax_deduction: record.deductions.tax || 0,
            sso_deduction: record.deductions.socialSecurity || 0,
        });
        setEditDrawerOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingEmployee) return;
        const values = await editForm.validateFields();
        setEditSaving(true);
        try {
            const res = await axios.put(`${API}/payroll/adjust`, {
                employee_code: editingEmployee.employeeId,
                month: currentMonth,
                year: currentYear,
                ...values,
            });
            message.success(res.data.message);
            setEditDrawerOpen(false);
            await fetchPayroll();
        } catch (err: any) {
            message.error(err?.response?.data?.error || 'บันทึกไม่สำเร็จ');
        } finally {
            setEditSaving(false);
        }
    };

    const handlePrintPayslip = () => {
        if (!printRef.current) return;
        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        let styles = '';
        document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
            styles += node.outerHTML;
        });

        printWindow.document.write(`
            <html lang="th">
                <head>
                    <title>Payslip - ${selectedEmployee?.name}</title>
                    ${styles}
                    <style>
                        @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            .ant-space { display: none !important; }
                        }
                    </style>
                </head>
                <body style="padding: 40px; font-family: 'Inter', sans-serif;">
                    ${printRef.current.innerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    const handleExportExcel = () => {
        const header = ['รหัสพนักงาน', 'ชื่อ-สกุล', 'แผนก', 'เงินเดือนพื้นฐาน', 'OT', 'เบี้ยขยัน', 'ค่าปรับสาย', 'ลาไม่รับเงิน', 'ภาษี', 'ประกันสังคม', 'รวมสุทธิ', 'สถานะ'];
        const formatCurrencyNum = (val: number) => Number(val.toFixed(2));
        const rows = filteredData.map(r => [
            r.employeeId, r.name, r.department, formatCurrencyNum(r.baseSalary),
            formatCurrencyNum(r.earnings.overtime), formatCurrencyNum(r.earnings.diligenceAllowance || 0),
            formatCurrencyNum(r.deductions.latePenalty), formatCurrencyNum(r.deductions.unpaidLeave),
            formatCurrencyNum(r.deductions.tax), formatCurrencyNum(r.deductions.socialSecurity),
            formatCurrencyNum(calculateNetSalary(r)), r.status === 'paid' ? 'จ่ายแล้ว' : (r.isPreview ? 'ร่าง' : 'รอตรวจสอบ')
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

        // Auto-size columns slightly
        ws['!cols'] = Array(12).fill({ wch: 15 });
        ws['!cols'][1] = { wch: 25 }; // Name

        XLSX.utils.book_append_sheet(wb, ws, "Payroll");
        XLSX.writeFile(wb, `payroll_${currentYear}_${String(currentMonth).padStart(2, '0')}.xlsx`);
        message.success('ดาวน์โหลด Excel สำเร็จ');
    };

    const handleExportBank = () => {
        window.open(`${API}/payroll/export-bank-text?month=${currentMonth}&year=${currentYear}`);
        message.success('กำลังดาวน์โหลดไฟล์สำหรับธนาคาร');
    };

    const handleDownloadPDF = async () => {
        if (!printRef.current) return;
        setLoading(true);
        try {
            const canvas = await html2canvas(printRef.current, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Payslip_${selectedEmployee?.name}_${currentMonth}_${currentYear}.pdf`);
            message.success('ดาวน์โหลด PDF สำเร็จ');
        } catch (error) {
            message.error('เกิดข้อผิดพลาดในการสร้าง PDF');
        } finally {
            setLoading(false);
        }
    };

    const calculateNetSalary = (record: PayrollRecord) => {
        if (record.netSalary !== undefined) return record.netSalary;
        const totalEarnings = record.baseSalary + record.earnings.overtime + record.earnings.bonus + (record.earnings.diligenceAllowance || 0);
        const totalDeductions = record.deductions.tax + record.deductions.socialSecurity + record.deductions.latePenalty + record.deductions.unpaidLeave;
        return totalEarnings - totalDeductions;
    };

    const calculateTotalGross = (r: PayrollRecord) =>
        r.baseSalary + r.earnings.overtime + r.earnings.bonus + (r.earnings.diligenceAllowance || 0);

    const calculateTotalDeduction = (r: PayrollRecord) =>
        r.deductions.tax + r.deductions.socialSecurity + r.deductions.latePenalty + r.deductions.unpaidLeave;

    const stats = {
        totalNetSalary: payrollData.reduce((acc, r) => acc + calculateNetSalary(r), 0),
        totalGross: payrollData.reduce((acc, r) => acc + calculateTotalGross(r), 0),
        totalTaxSocial: payrollData.reduce((acc, r) => acc + r.deductions.tax + r.deductions.socialSecurity, 0),
    };

    const departments = Array.from(new Set(payrollData.map(d => d.department)));

    const filteredData = payrollData.filter(r => {
        const matchSearch = r.name.toLowerCase().includes(searchText.toLowerCase()) || r.employeeId.toLowerCase().includes(searchText.toLowerCase());
        const matchDept = departmentFilter === 'all' || r.department === departmentFilter;
        return matchSearch && matchDept;
    });

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 }).format(value);

    const isPreview = payrollData.length > 0 && payrollData[0]?.isPreview;

    const columns: TableProps<PayrollRecord>['columns'] = [
        {
            title: 'พนักงาน', dataIndex: 'name', key: 'name',
            render: (text, record) => (
                <div>
                    <div style={{ fontWeight: 500 }}>{text}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{record.employeeId} | {record.department}</div>
                </div>
            )
        },
        {
            title: 'เงินเดือนพื้นฐาน', dataIndex: 'baseSalary', key: 'baseSalary', align: 'right',
            render: (value) => formatCurrency(value),
            sorter: (a, b) => a.baseSalary - b.baseSalary,
        },
        {
            title: 'รายรับอื่นๆ', key: 'earnings', align: 'right',
            render: (_, r) => (
                <Tooltip title={`OT: ${formatCurrency(r.earnings.overtime)} | เบี้ยขยัน: ${formatCurrency(r.earnings.diligenceAllowance || 0)} | โบนัส: ${formatCurrency(r.earnings.bonus)}`}>
                    <Text type="success">+{formatCurrency(r.earnings.overtime + r.earnings.bonus + (r.earnings.diligenceAllowance || 0))}</Text>
                </Tooltip>
            )
        },
        {
            title: 'รายการหัก', key: 'deductions', align: 'right',
            render: (_, r) => (
                <Tooltip title={`ภาษี: ${formatCurrency(r.deductions.tax)} | SSO: ${formatCurrency(r.deductions.socialSecurity)} | สาย: ${formatCurrency(r.deductions.latePenalty)} | ลาไม่รับเงิน: ${formatCurrency(r.deductions.unpaidLeave)}`}>
                    <Text type="danger">-{formatCurrency(calculateTotalDeduction(r))}</Text>
                </Tooltip>
            )
        },
        {
            title: 'รายได้สุทธิ', key: 'netSalary', align: 'right',
            render: (_, r) => <Text strong style={{ color: '#1890ff' }}>{formatCurrency(calculateNetSalary(r))}</Text>,
            sorter: (a, b) => calculateNetSalary(a) - calculateNetSalary(b)
        },
        {
            title: 'สถานะ', dataIndex: 'status', key: 'status', align: 'center',
            render: (status) => {
                if (status === 'paid') return <Tag color="blue">จ่ายแล้ว</Tag>;
                if (status === 'approved') return <Tag color="success">อนุมัติแล้ว</Tag>;
                return <Tag color="warning">รอตรวจสอบ</Tag>;
            }
        },
        {
            title: 'การดำเนินการ', key: 'action', align: 'center', width: 150,
            render: (_, record) => (
                <Space>
                    <Button
                        type="link" icon={<EditOutlined />} size="small"
                        disabled={record.isPreview}
                        onClick={() => handleOpenEdit(record)}
                    >
                        แก้ไข
                    </Button>
                    <Button type="link" icon={<PrinterOutlined />} size="small"
                        onClick={() => { setSelectedEmployee(record); setIsPayslipModalVisible(true); }}>
                        สลิป
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div>
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>ประมวลผลเงินเดือน (Payroll)</Title>
                    <Text type="secondary">ตรวจสอบค่าจ้าง รายการหัก และอนุมัติการจ่ายเงินเดือน</Text>
                </div>
                <Space wrap>
                    <DatePicker picker="month" value={monthFilter} onChange={setMonthFilter} allowClear={false} />
                    <Button icon={<SyncOutlined />} onClick={fetchPayroll} loading={loading}>รีโหลด</Button>
                    <Button
                        type="primary" icon={<CalculatorOutlined />}
                        onClick={handleCalculate} loading={calculating}
                        style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    >
                        คำนวณเงินเดือน
                    </Button>
                    <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>Excel</Button>
                    <Button icon={<BankOutlined />} onClick={handleExportBank} style={{ color: '#0050b3', borderColor: '#0050b3' }}>Bank Export</Button>
                    <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleApprovePayroll}>อนุมัติจ่าย</Button>
                </Space>
            </div>

            {/* ── Preview banner ── */}
            {isPreview && (
                <Alert
                    message="โหมด Preview — เงินเดือนยังไม่ถูกบันทึก"
                    description="กด 'คำนวณเงินเดือน' เพื่อคำนวณจากข้อมูลจริง (attendance + leave) และบันทึกลงฐานข้อมูล"
                    type="warning" showIcon icon={<InfoCircleOutlined />}
                    style={{ marginBottom: 16 }}
                />
            )}

            {/* ── Stats ── */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ borderRadius: 8, background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)' }}>
                        <Statistic
                            title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>ยอดรวมรายได้สุทธิ</span>}
                            value={stats.totalNetSalary} precision={2}
                            valueStyle={{ color: '#fff', fontWeight: 'bold' }} prefix={<DollarOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ borderRadius: 8 }}>
                        <Statistic
                            title="ยอดรวมรายจ่ายบริษัท (Gross)" value={stats.totalGross} precision={2}
                            valueStyle={{ color: '#52c41a', fontWeight: 'bold' }} prefix={<WalletOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ borderRadius: 8 }}>
                        <Statistic
                            title="ยอดนำส่งภาษี + ประกันสังคม" value={stats.totalTaxSocial} precision={2}
                            valueStyle={{ color: '#ff4d4f', fontWeight: 'bold' }} prefix={<BankOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* ── Table ── */}
            <Card bordered={false} style={{ borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <Space>
                        <Input
                            placeholder="ค้นหาชื่อ หรือรหัสพนักงาน" prefix={<SearchOutlined />}
                            style={{ width: 250 }} value={searchText}
                            onChange={e => setSearchText(e.target.value)} allowClear
                        />
                        <Select value={departmentFilter} onChange={setDepartmentFilter} style={{ width: 160 }}>
                            <Option value="all">ทุกแผนก</Option>
                            {departments.map(d => <Option key={d} value={d}>{d}</Option>)}
                        </Select>
                    </Space>
                    <Text type="secondary">เลือกแล้ว {selectedRowKeys.length} | ทั้งหมด {filteredData.length} คน</Text>
                </div>
                <Table
                    rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys, getCheckboxProps: r => ({ disabled: r.status === 'paid' }) }}
                    columns={columns} dataSource={filteredData} rowKey="employeeId"
                    loading={loading} pagination={{ pageSize: 15 }} scroll={{ x: 1000 }}
                    rowClassName={r => r.status === 'paid' ? 'ant-table-row-paid' : ''}
                />
            </Card>

            {/* ── PAYSLIP MODAL ── */}
            <Modal
                title={`สลิปเงินเดือน — ${monthFilter?.format('MMMM YYYY')}`}
                open={isPayslipModalVisible}
                onCancel={() => setIsPayslipModalVisible(false)}
                footer={
                    <Space>
                        <Button onClick={() => setIsPayslipModalVisible(false)}>ปิด</Button>
                        <Button icon={<DownloadOutlined />} onClick={handleDownloadPDF} loading={loading}>ดาวน์โหลด PDF</Button>
                        <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrintPayslip}>พิมพ์สลิป</Button>
                    </Space>
                }
                width={740}
            >
                {selectedEmployee && (
                    <div ref={printRef} style={{ padding: 20, border: '1px solid #f0f0f0', borderRadius: 8 }}>
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                            <Title level={4} style={{ margin: 0 }}>{companyName}</Title>
                            <Text>สลิปเงินเดือน ประจำเดือน {monthFilter?.format('MM/YYYY')}</Text>
                        </div>
                        <Divider style={{ margin: '10px 0' }} />
                        <Row style={{ marginBottom: 16 }}>
                            <Col span={12}>
                                <div><Text className="label">รหัสพนักงาน:</Text> <Text strong>{selectedEmployee.employeeId}</Text></div>
                                <div><Text className="label">ชื่อ-สกุล:</Text> <Text strong>{selectedEmployee.name}</Text></div>
                            </Col>
                            <Col span={12} style={{ textAlign: 'right' }}>
                                <div><Text className="label">แผนก:</Text> <Text strong>{selectedEmployee.department}</Text></div>
                                <div><Text className="label">สถานะ:</Text> {selectedEmployee.status === 'paid' ? <Tag color="blue">จ่ายแล้ว</Tag> : <Tag color="orange">รอตรวจสอบ</Tag>}</div>
                            </Col>
                        </Row>
                        <div className="payslip-grid" style={{ display: 'flex', borderTop: '2px solid #333', borderBottom: '2px solid #333' }}>
                            <div className="payslip-col" style={{ flex: 1, padding: '10px 15px 10px 0', borderRight: '1px solid #eee' }}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>รายได้ (Earnings)</Text>
                                {[
                                    ['เงินเดือนพื้นฐาน', selectedEmployee.baseSalary],
                                    ['ค่าล่วงเวลา (OT)', selectedEmployee.earnings.overtime],
                                    ['เบี้ยขยัน', selectedEmployee.earnings.diligenceAllowance || 0],
                                    ['โบนัส', selectedEmployee.earnings.bonus],
                                ].map(([label, val]) => (
                                    <div key={label as string} className="payslip-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text>{label as string}</Text>
                                        <Text>{formatCurrency(val as number)}</Text>
                                    </div>
                                ))}
                            </div>
                            <div className="payslip-col" style={{ flex: 1, padding: '10px 0 10px 15px' }}>
                                <Text strong type="danger" style={{ display: 'block', marginBottom: 8 }}>รายการหัก (Deductions)</Text>
                                {[
                                    ['ภาษีหัก ณ ที่จ่าย', selectedEmployee.deductions.tax],
                                    ['ประกันสังคม', selectedEmployee.deductions.socialSecurity],
                                    ['ค่าปรับมาสาย', selectedEmployee.deductions.latePenalty],
                                    ['ลาไม่รับค่าจ้าง', selectedEmployee.deductions.unpaidLeave],
                                ].map(([label, val]) => (
                                    <div key={label as string} className="payslip-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text>{label as string}</Text>
                                        <Text type="danger">{formatCurrency(val as number)}</Text>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="summary" style={{ display: 'flex', marginTop: 12, padding: '12px 10px', background: '#f8f8f8', borderRadius: 4 }}>
                            <div className="summary-item" style={{ flex: 1 }}>
                                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>รวมรายได้</Text>
                                <Text strong style={{ fontSize: 18, color: '#52c41a' }}>{formatCurrency(calculateTotalGross(selectedEmployee))}</Text>
                            </div>
                            <div className="summary-item" style={{ flex: 1 }}>
                                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>รวมรายการหัก</Text>
                                <Text strong style={{ fontSize: 18, color: '#ff4d4f' }}>{formatCurrency(calculateTotalDeduction(selectedEmployee))}</Text>
                            </div>
                            <div className="summary-item" style={{ flex: 1, textAlign: 'right' }}>
                                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>รายได้สุทธิ์ (Net Pay)</Text>
                                <Text strong style={{ fontSize: 24, color: '#1890ff' }}>{formatCurrency(calculateNetSalary(selectedEmployee))}</Text>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── EDIT DRAWER ── */}
            <Drawer
                title={
                    <div>
                        <div style={{ fontWeight: 600 }}>แก้ไขข้อมูลเงินเดือน</div>
                        <div style={{ fontSize: 13, fontWeight: 400, color: '#888' }}>
                            {editingEmployee?.name} ({editingEmployee?.employeeId}) — {monthFilter?.format('MM/YYYY')}
                        </div>
                    </div>
                }
                open={editDrawerOpen}
                onClose={() => setEditDrawerOpen(false)}
                width={480}
                footer={
                    <Space style={{ float: 'right' }}>
                        <Button onClick={() => setEditDrawerOpen(false)}>ยกเลิก</Button>
                        <Button type="primary" onClick={handleSaveEdit} loading={editSaving} icon={<CheckCircleOutlined />}>
                            บันทึกการแก้ไข
                        </Button>
                    </Space>
                }
            >
                {editingEmployee && (
                    <>
                        <Alert
                            type="info" showIcon
                            message={`เงินเดือนพื้นฐาน: ${formatCurrency(editingEmployee.baseSalary)}`}
                            description="การแก้ไขจะคำนวณยอดสุทธิ์ใหม่อัตโนมัติเมื่อส่งเงินเดือนพื้นฐาน + รายได้อื่นๆ - รายการหักทั้งหมด"
                            style={{ marginBottom: 20 }}
                        />
                        <Form form={editForm} layout="vertical" requiredMark={false}>
                            <div style={{ color: '#52c41a', fontWeight: 600, marginBottom: 12, borderBottom: '1px solid #52c41a22', paddingBottom: 6 }}>
                                ➕ รายได้เพิ่มเติม
                            </div>

                            {/* OT Calculator */}
                            <div style={{ background: '#f5f8ff', padding: '12px 16px', borderRadius: 8, marginBottom: 16, border: '1px dashed #91caff' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#1890ff', marginBottom: 8 }}>
                                    <CalculatorOutlined /> เครื่องมือคำนวณ OT อัตโนมัติ
                                </div>
                                <Row gutter={12} align="bottom">
                                    <Col span={7}>
                                        <div style={{ fontSize: 12, marginBottom: 4 }}>ชั่วโมงทำ OT</div>
                                        <InputNumber min={0} value={otHelperHours} onChange={setOtHelperHours} style={{ width: '100%' }} placeholder="ชม." />
                                    </Col>
                                    <Col span={8}>
                                        <div style={{ fontSize: 12, marginBottom: 4 }}>อัตรา (ตัวคูณ)</div>
                                        <Select value={otHelperRate} onChange={setOtHelperRate} style={{ width: '100%' }}>
                                            <Option value={1.0}>1.0 เท่า</Option>
                                            <Option value={1.5}>1.5 เท่า (วันปกติ)</Option>
                                            <Option value={2.0}>2.0 เท่า</Option>
                                            <Option value={3.0}>3.0 เท่า</Option>
                                        </Select>
                                    </Col>
                                    <Col span={9}>
                                        <Button
                                            type="primary"
                                            ghost
                                            style={{ width: '100%' }}
                                            onClick={() => {
                                                const h = otHelperHours || 0;
                                                const r = otHelperRate || 1.5;
                                                const base = editingEmployee?.baseSalary || 0;
                                                const calculatedPay = (base / 30 / 8) * h * r;
                                                editForm.setFieldsValue({ overtime_pay: Number(calculatedPay.toFixed(2)) });
                                                message.success(`เติมค่าเงิน OT: ${calculatedPay.toFixed(2)} บาท`);
                                            }}
                                        >
                                            คำนวณ & เติมค่า
                                        </Button>
                                    </Col>
                                </Row>
                                <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>* สูตร: (เงินเดือน ÷ 30 ÷ 8) × จำนวนชั่วโมง × ตัวคูณ</div>
                            </div>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="ค่าล่วงเวลา OT" name="overtime_pay">
                                        <InputNumber
                                            style={{ width: '100%' }} min={0} precision={2}
                                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            addonAfter="บาท"
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="โบนัส" name="bonus">
                                        <InputNumber
                                            style={{ width: '100%' }} min={0} precision={2}
                                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            addonAfter="บาท"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item label="เบี้ยขยัน" name="diligence_allowance">
                                <InputNumber
                                    style={{ width: '100%' }} min={0} precision={2}
                                    formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    addonAfter="บาท"
                                />
                            </Form.Item>

                            <div style={{ color: '#ff4d4f', fontWeight: 600, margin: '16px 0 12px', borderBottom: '1px solid #ff4d4f22', paddingBottom: 6 }}>
                                ➖ รายการหัก
                            </div>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="ค่าปรับสาย (บาท)" name="late_deduction">
                                        <InputNumber
                                            style={{ width: '100%' }} min={0} precision={2}
                                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            addonAfter="บาท"
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="หักลาไม่รับเงิน" name="leave_deduction">
                                        <InputNumber
                                            style={{ width: '100%' }} min={0} precision={2}
                                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            addonAfter="บาท"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="ภาษีเงินได้" name="tax_deduction">
                                        <InputNumber
                                            style={{ width: '100%' }} min={0} precision={2}
                                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            addonAfter="บาท"
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="ประกันสังคม (SSO)" name="sso_deduction">
                                        <InputNumber
                                            style={{ width: '100%' }} min={0} precision={2}
                                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            addonAfter="บาท"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>

                            {/* Live net preview */}
                            <Form.Item shouldUpdate style={{ marginTop: 8 }}>
                                {() => {
                                    const vals = editForm.getFieldsValue();
                                    const base = editingEmployee.baseSalary;
                                    const net = base
                                        + (vals.overtime_pay || 0)
                                        + (vals.bonus || 0)
                                        + (vals.diligence_allowance || 0)
                                        - (vals.late_deduction || 0)
                                        - (vals.leave_deduction || 0)
                                        - (vals.tax_deduction || 0)
                                        - (vals.sso_deduction || 0);
                                    return (
                                        <div style={{ background: '#f0f5ff', padding: 16, borderRadius: 8, textAlign: 'center' }}>
                                            <div style={{ color: '#888', fontSize: 12 }}>ยอดสุทธิ์ใหม่ (preview)</div>
                                            <div style={{ fontSize: 28, fontWeight: 700, color: '#1890ff' }}>
                                                {formatCurrency(net)}
                                            </div>
                                        </div>
                                    );
                                }}
                            </Form.Item>
                        </Form>
                    </>
                )}
            </Drawer>
        </div>
    );
};
