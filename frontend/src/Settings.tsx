import React, { useState, useEffect } from 'react';
import { Typography, Form, Input, Button, Card, Col, Row, Select, message, Spin, Divider, Radio, Alert } from 'antd';
import { SaveOutlined, BankOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL as API } from './api';

const { Title, Text } = Typography;

export const Settings: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [companyForm] = Form.useForm();
    const [payrollRounds, setPayrollRounds] = useState<number>(1);

    const API_BASE = API;

    // --- Data Fetching ---
    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/settings`);
            const s = res.data || {};
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
        } catch (error) {
            console.error(error);
            message.error('Failed to load settings data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    // --- Company Info & Cutoff Handler ---
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
            fetchSettings();
        } catch (error) {
            console.error('Settings update error:', error);
            message.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    };

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>ตั้งค่าระบบ (System Settings)</Title>
                <Text type="secondary">กำหนดข้อมูลบริษัท และรอบการตัดเงินเดือน (Payroll Cutoff Cycle)</Text>
            </div>

            <Card bordered={false} style={{ borderRadius: 8, minHeight: 'calc(100vh - 160px)' }}>
                <Spin spinning={loading} size="large">
                    <div style={{ maxWidth: 840, margin: '0 auto', padding: '12px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <BankOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                            <Title level={4} style={{ margin: 0 }}>ข้อมูลบริษัท</Title>
                        </div>
                        <Text type="secondary">ข้อมูลที่ปรากฏบนสลิปเงินเดือนและรายงานภาษี</Text>
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

                            <Title level={4} style={{ marginTop: 36 }}>การตัดรอบเงินเดือน (Payroll Cutoff Cycle)</Title>
                            <Divider style={{ margin: '12px 0 20px 0' }} />

                            <Alert
                                type="info"
                                showIcon
                                message="สูตรคำนวณ รายการรายได้ และรายการหักเงิน"
                                description="สูตรคำนวณทั้งหมด (ค่าโอที, เบี้ยขยัน, ค่าปรับมาสาย, หักวันลา, ประกันสังคม ฯลฯ) ถูกย้ายไปบริหารจัดการอย่างยืดหยุ่นที่เมนู 'ตั้งค่าสูตรคำนวณ' และนโยบายวันหยุด/วันลาถูกย้ายไปที่เมนู 'การจัดการลา' เรียบร้อยแล้ว"
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
                                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large">
                                    บันทึกข้อมูลและรอบเงินเดือน
                                </Button>
                            </Form.Item>
                        </Form>
                    </div>
                </Spin>
            </Card>
        </div>
    );
};
