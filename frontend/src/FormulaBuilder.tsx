import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Row, Col, Card, Typography, Space, Input, message, Popconfirm, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CalculatorOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const API = 'http://localhost:5000/api';

export const FormulaBuilder: React.FC = () => {
    const [formulas, setFormulas] = useState<any[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    const [formulaId, setFormulaId] = useState<number | null>(null);
    const [formulaName, setFormulaName] = useState('');
    const [expression, setExpression] = useState('');
    const [description, setDescription] = useState('');

    const fetchFormulas = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/formulas`);
            setFormulas(res.data);
        } catch (err) {
            console.error('Failed to fetch formulas', err);
            message.error('โหลดข้อมูลสูตรคำนวณไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFormulas();
    }, []);

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

        try {
            if (formulaId) {
                await axios.put(`${API}/formulas/${formulaId}`, { name: formulaName, expression, description });
                message.success('แก้ไขสูตรเรียบร้อย');
            } else {
                await axios.post(`${API}/formulas`, { name: formulaName, expression, description });
                message.success('สร้างสูตรเรียบร้อย');
            }
            setIsModalVisible(false);
            fetchFormulas();
        } catch (err) {
            console.error('Save failed', err);
            message.error('บันทึกสูตรไม่สำเร็จ');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await axios.delete(`${API}/formulas/${id}`);
            message.success('ลบสูตรเรียบร้อย');
            fetchFormulas();
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
                <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
                    <Col>
                        <Title level={4} style={{ margin: 0 }}>
                            <CalculatorOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                            ตั้งค่าสูตรคำนวณเงินเดือน
                        </Title>
                    </Col>
                    <Col>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} size="large">
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
