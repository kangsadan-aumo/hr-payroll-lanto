import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Row, Col, Card, Typography, Space, Input, message, Popconfirm, Divider, Tabs, Form, Select } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CalculatorOutlined, SettingOutlined, MoneyCollectOutlined, FallOutlined, SaveOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const API = 'http://localhost:5000/api';

export const FormulaBuilder: React.FC = () => {
    const [formulas, setFormulas] = useState<any[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Mappings Form
    const [mappingForm] = Form.useForm();
    const [savingMapping, setSavingMapping] = useState(false);

    const [formulaId, setFormulaId] = useState<number | null>(null);
    const [formulaName, setFormulaName] = useState('');
    const [expression, setExpression] = useState('');
    const [description, setDescription] = useState('');

    const fetchFormulasAndSettings = async () => {
        setLoading(true);
        try {
            const [formulasRes, settingsRes] = await Promise.all([
                axios.get(`${API}/formulas`),
                axios.get(`${API}/settings`)
            ]);
            setFormulas(formulasRes.data);
            const s = settingsRes.data;
            mappingForm.setFieldsValue({
                ot_formula_id: s.ot_formula_id || null,
                late_formula_id: s.late_formula_id || null,
                leave_formula_id: s.leave_formula_id || null,
                diligence_formula_id: s.diligence_formula_id || null
            });
        } catch (err) {
            console.error('Failed to fetch data', err);
            message.error('โหลดข้อมูลไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFormulasAndSettings();
    }, []);

    const onSaveMapping = async (values: any) => {
        setSavingMapping(true);
        try {
            // Need to fetch current settings first to preserve other fields
            const settingsRes = await axios.get(`${API}/settings`);
            const s = settingsRes.data;
            const payload = {
                ...s,
                company_name: s.company_name || '',
                tax_id: s.tax_id || '',
                branch_code: s.branch_code || '00000',
                address: s.address || '',
                ot_formula_id: values.ot_formula_id || null,
                late_formula_id: values.late_formula_id || null,
                leave_formula_id: values.leave_formula_id || null,
                diligence_formula_id: values.diligence_formula_id || null
            };
            await axios.put(`${API}/settings`, payload);
            message.success('บันทึกการผูกสูตรสำเร็จ');
        } catch (err) {
            console.error('Save mapping failed', err);
            message.error('เกิดข้อผิดพลาดในการบันทึกการผูกสูตร');
        } finally {
            setSavingMapping(false);
        }
    };

    const openModal = (formula?: any) => {
        if (formula) {
            setFormulaId(formula.id);
            setFormulaName(formula.name);
            setExpression(formula.expression);
            setDescription(formula.description || '');
        } else {
            setFormulaId(null);
            setFormulaName('');
            setExpression('');
            setDescription('');
        }
        setIsModalVisible(true);
    };

    const handleSave = async () => {
        if (!formulaName.trim()) {
            return message.warning('กรุณาตั้งชื่อสูตร');
        }
        if (!expression.trim()) {
            return message.warning('กรุณาสร้างสูตรคำนวณ');
        }

        const payload = { name: formulaName, expression, description };

        try {
            if (formulaId) {
                await axios.put(`${API}/formulas/${formulaId}`, payload);
                message.success('อัปเดตสูตรสำเร็จ');
            } else {
                await axios.post(`${API}/formulas`, payload);
                message.success('เพิ่มสูตรสำเร็จ');
            }
            setIsModalVisible(false);
            fetchFormulasAndSettings();
        } catch (err) {
            console.error('Save failed', err);
            message.error('บันทึกสูตรไม่สำเร็จ');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await axios.delete(`${API}/formulas/${id}`);
            message.success('ลบสูตรสำเร็จ');
            fetchFormulasAndSettings();
        } catch (err) {
            message.error('ลบสูตรไม่สำเร็จ');
        }
    };

    const insertToExpression = (val: string) => {
        setExpression(prev => prev + ' ' + val);
    };

    const variables = [
        { label: 'เงินเดือนฐาน', value: '[เงินเดือนฐาน]' },
        { label: 'รายวัน (เฉลี่ย)', value: '[รายวัน]' },
        { label: 'วันทำงานจริง', value: '[วันทำงานจริง]' },
        { label: 'วันลา (หักเงิน)', value: '[วันลา]' },
        { label: 'ชั่วโมง OT', value: '[ชั่วโมง_OT]' },
        { label: 'นาทีมาสาย', value: '[นาทีมาสาย]' },
        { label: 'เบี้ยขยัน', value: '[เบี้ยขยัน]' },
    ];

    const operators = ['+', '-', '*', '/', '(', ')'];
    const numbers = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '30', '8', '100'];

    const columns = [
        {
            title: 'ชื่อสูตร',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: 'สูตรการคำนวณ',
            dataIndex: 'expression',
            key: 'expression',
            render: (text: string) => <Text code>{text}</Text>
        },
        {
            title: 'คำอธิบาย',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'จัดการ',
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    <Button type="link" icon={<EditOutlined />} onClick={() => openModal(record)}>แก้ไข</Button>
                    <Popconfirm title="ยืนยันการลบสูตรนี้?" onConfirm={() => handleDelete(record.id)}>
                        <Button type="link" danger icon={<DeleteOutlined />}>ลบ</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
            <Card bordered={false} style={{ borderRadius: 8 }}>
                <Title level={3} style={{ marginBottom: 24 }}>
                    <CalculatorOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                    ระบบตั้งค่าและผูกสูตรคำนวณเงินเดือน
                </Title>
                <Tabs defaultActiveKey="1" size="large">
                    {/* Tab 1: Formula Settings */}
                    <TabPane tab={<span><CalculatorOutlined /> ตั้งค่าสูตร (Formulas)</span>} key="1">
                        <div style={{ maxWidth: 1000, padding: '12px 0' }}>
                            <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                <Col>
                                    <Text type="secondary">สร้างและแก้ไขสูตรคำนวณ สำหรับนำไปใช้กับการคำนวณต่างๆ</Text>
                                </Col>
                                <Col>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} size="middle">
                                        เพิ่มสูตรใหม่
                                    </Button>
                                </Col>
                            </Row>
                            
                            <Table
                                columns={columns}
                                dataSource={formulas}
                                rowKey="id"
                                loading={loading}
                                pagination={{ pageSize: 10 }}
                            />
                        </div>
                    </TabPane>

                    {/* Tab 2: Formula Mappings */}
                    <TabPane tab={<span><SettingOutlined /> ผูกสูตร (Mappings)</span>} key="2">
                        <div style={{ maxWidth: 800, padding: '12px 0' }}>
                            <Title level={4}>การผูกสูตรเข้ากับระบบเงินเดือน</Title>
                            <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                                เลือกสูตรที่คุณสร้างไว้เพื่อนำมาคำนวณในระบบเงินเดือนโดยอัตโนมัติ หากไม่เลือก ระบบจะใช้การคำนวณพื้นฐาน
                            </Text>

                            <Form form={mappingForm} layout="vertical" onFinish={onSaveMapping}>
                                <Row gutter={24}>
                                    <Col span={12}>
                                        <Form.Item name="ot_formula_id" label="สูตรคำนวณค่าล่วงเวลา (OT)">
                                            <Select allowClear placeholder="ไม่มีการผูกสูตร (ใช้ค่าเริ่มต้น)">
                                                {formulas.map(f => (
                                                    <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="late_formula_id" label="สูตรหักเงินมาสาย">
                                            <Select allowClear placeholder="ไม่มีการผูกสูตร (ใช้ค่าเริ่มต้น)">
                                                {formulas.map(f => (
                                                    <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={24}>
                                    <Col span={12}>
                                        <Form.Item name="leave_formula_id" label="สูตรหักเงินการลางาน (Unpaid Leave)">
                                            <Select allowClear placeholder="ไม่มีการผูกสูตร (ใช้ค่าเริ่มต้น)">
                                                {formulas.map(f => (
                                                    <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="diligence_formula_id" label="สูตรคำนวณเบี้ยขยัน">
                                            <Select allowClear placeholder="ไม่มีการผูกสูตร (ใช้ค่าเริ่มต้น)">
                                                {formulas.map(f => (
                                                    <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item style={{ marginTop: 16 }}>
                                    <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large" loading={savingMapping}>
                                        บันทึกการผูกสูตร
                                    </Button>
                                </Form.Item>
                            </Form>
                        </div>
                    </TabPane>

                    {/* Tab 3: Incomes Placeholder */}
                    <TabPane tab={<span><MoneyCollectOutlined /> รายได้ (Incomes)</span>} key="3">
                        <div style={{ padding: '24px 0', textAlign: 'center' }}>
                            <Title level={4} type="secondary">ฟีเจอร์นี้อยู่ระหว่างการพัฒนา</Title>
                            <Text type="secondary">พื้นที่สำหรับเพิ่มประเภทรายได้ใหม่แบบกำหนดเอง (Custom Allowances)</Text>
                        </div>
                    </TabPane>

                    {/* Tab 4: Deductions Placeholder */}
                    <TabPane tab={<span><FallOutlined /> รายการหัก (Deductions)</span>} key="4">
                        <div style={{ padding: '24px 0', textAlign: 'center' }}>
                            <Title level={4} type="secondary">ฟีเจอร์นี้อยู่ระหว่างการพัฒนา</Title>
                            <Text type="secondary">พื้นที่สำหรับเพิ่มประเภทรายการหักใหม่แบบกำหนดเอง (Custom Deductions)</Text>
                        </div>
                    </TabPane>
                </Tabs>
            </Card>

            <Modal
                title={formulaId ? "แก้ไขสูตรคำนวณ" : "สร้างสูตรคำนวณใหม่"}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                onOk={handleSave}
                width={900}
                okText="บันทึกสูตร"
                cancelText="ยกเลิก"
            >
                <Row gutter={24}>
                    {/* Left Column - Formula Tools */}
                    <Col span={12}>
                        <Card size="small" title="เครื่องมือสร้างสูตร" bordered style={{ background: '#fafafa' }}>
                            <div style={{ marginBottom: 16 }}>
                                <Text strong>ข้อมูลในระบบ (Variables)</Text>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                                    {variables.map(v => (
                                        <Button key={v.value} size="small" type="primary" ghost onClick={() => insertToExpression(v.value)}>
                                            {v.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <Divider style={{ margin: '12px 0' }} />
                            <div style={{ marginBottom: 16 }}>
                                <Text strong>เครื่องหมาย (Operators)</Text>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    {operators.map(op => (
                                        <Button key={op} size="small" type="default" onClick={() => insertToExpression(op)} style={{ fontWeight: 'bold' }}>
                                            {op}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <Divider style={{ margin: '12px 0' }} />
                            <div>
                                <Text strong>ตัวเลข (Numbers)</Text>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, maxWidth: 200 }}>
                                    {numbers.map(n => (
                                        <Button key={n} size="small" onClick={() => insertToExpression(n)}>
                                            {n}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </Col>

                    {/* Right Column - Formula Preview */}
                    <Col span={12}>
                        <Card size="small" title="ผลลัพธ์สูตร (Formula Result)" bordered style={{ height: '100%' }}>
                            <div style={{ marginBottom: 16 }}>
                                <Text strong>ชื่อสูตร <Text type="danger">*</Text></Text>
                                <Input 
                                    placeholder="เช่น สูตรคำนวณ OT วันหยุด" 
                                    value={formulaName} 
                                    onChange={e => setFormulaName(e.target.value)} 
                                    style={{ marginTop: 8 }}
                                />
                            </div>
                            
                            <div style={{ marginBottom: 16 }}>
                                <Text strong>สมการ <Text type="danger">*</Text></Text>
                                <Input.TextArea 
                                    value={expression} 
                                    onChange={e => setExpression(e.target.value)}
                                    rows={4}
                                    style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 16 }}
                                    placeholder="กดปุ่มทางซ้ายเพื่อสร้างสมการ หรือพิมพ์เองได้ที่นี่..."
                                />
                                <div style={{ marginTop: 8, textAlign: 'right' }}>
                                    <Button size="small" danger onClick={() => setExpression('')}>ล้างสูตร (Clear)</Button>
                                </div>
                            </div>

                            <div>
                                <Text strong>คำอธิบายเพิ่มเติม</Text>
                                <Input 
                                    placeholder="อธิบายว่าสูตรนี้ใช้ทำอะไร..." 
                                    value={description} 
                                    onChange={e => setDescription(e.target.value)} 
                                    style={{ marginTop: 8 }}
                                />
                            </div>
                        </Card>
                    </Col>
                </Row>
            </Modal>
        </div>
    );
};
