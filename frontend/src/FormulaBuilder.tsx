import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Row, Col, Card, Typography, Space, Input, message,
    Popconfirm, Divider, Tabs, Select, Radio, Tag, Switch, Tooltip
} from 'antd';
import {
    PlusOutlined, DeleteOutlined, EditOutlined, CalculatorOutlined,
    MoneyCollectOutlined, FallOutlined, LinkOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import axios from 'axios';

import { API_BASE_URL as API } from './api';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface Formula {
    id: number;
    name: string;
    expression: string;
    description: string;
    type: 'income' | 'deduction' | 'general';
    is_active: number | boolean;
    created_at?: string;
    updated_at?: string;
}

export const FormulaBuilder: React.FC = () => {
    const [formulas, setFormulas] = useState<Formula[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('1');

    // ── Formula Modal State ──
    const [isFormulaModalVisible, setIsFormulaModalVisible] = useState(false);
    const [formulaId, setFormulaId] = useState<number | null>(null);
    const [formulaName, setFormulaName] = useState('');
    const [expression, setExpression] = useState('');
    const [description, setDescription] = useState('');
    const [formulaType, setFormulaType] = useState<'income' | 'deduction' | 'general'>('general');
    const [formulaIsActive, setFormulaIsActive] = useState(true);

    // ── Add Item to Income/Deduction Modal State ──
    const [isItemModalVisible, setIsItemModalVisible] = useState(false);
    const [targetCategory, setTargetCategory] = useState<'income' | 'deduction'>('income');
    const [itemSelectionMode, setItemSelectionMode] = useState<'existing' | 'new'>('existing');
    const [selectedFormulaId, setSelectedFormulaId] = useState<number | null>(null);

    const fetchFormulas = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/formulas`);
            setFormulas(res.data);
        } catch (err) {
            console.error('Failed to fetch formulas', err);
            message.error('โหลดสูตรการคำนวณไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFormulas();
    }, []);

    // ── Open Full Formula Builder Modal ──
    const openFormulaModal = (formula?: Formula, defaultType?: 'income' | 'deduction' | 'general') => {
        if (formula) {
            setFormulaId(formula.id);
            setFormulaName(formula.name);
            setExpression(formula.expression);
            setDescription(formula.description || '');
            setFormulaType(formula.type || 'general');
            setFormulaIsActive(Boolean(formula.is_active !== 0 && formula.is_active !== false));
        } else {
            setFormulaId(null);
            setFormulaName('');
            setExpression('');
            setDescription('');
            setFormulaType(defaultType || 'general');
            setFormulaIsActive(true);
        }
        setIsFormulaModalVisible(true);
    };

    // ── Save Formula ──
    const handleSaveFormula = async () => {
        if (!formulaName.trim()) {
            return message.warning('กรุณาตั้งชื่อสูตร');
        }
        if (!expression.trim()) {
            return message.warning('กรุณาสร้างสูตรคำนวณ');
        }

        const payload = {
            name: formulaName.trim(),
            expression: expression.trim(),
            description: description.trim(),
            type: formulaType,
            is_active: formulaIsActive ? 1 : 0
        };

        try {
            if (formulaId) {
                await axios.put(`${API}/formulas/${formulaId}`, payload);
                message.success('อัปเดตสูตรสำเร็จ');
            } else {
                await axios.post(`${API}/formulas`, payload);
                message.success('เพิ่มสูตรสำเร็จ');
            }
            setIsFormulaModalVisible(false);
            fetchFormulas();
        } catch (err) {
            console.error('Save failed', err);
            message.error('บันทึกสูตรไม่สำเร็จ');
        }
    };

    // ── Toggle Formula Status ──
    const handleToggleStatus = async (id: number, currentStatus: boolean | number) => {
        const nextStatus = !(currentStatus === 1 || currentStatus === true);
        try {
            await axios.patch(`${API}/formulas/${id}/status`, { is_active: nextStatus ? 1 : 0 });
            message.success(nextStatus ? 'เปิดใช้งานสูตรแล้ว' : 'ปิดใช้งานสูตรแล้ว');
            setFormulas(prev => prev.map(f => f.id === id ? { ...f, is_active: nextStatus ? 1 : 0 } : f));
        } catch (err) {
            message.error('เปลี่ยนสถานะไม่สำเร็จ');
        }
    };

    // ── Delete Formula ──
    const handleDelete = async (id: number) => {
        try {
            await axios.delete(`${API}/formulas/${id}`);
            message.success('ลบสูตรสำเร็จ');
            fetchFormulas();
        } catch (err) {
            message.error('ลบสูตรไม่สำเร็จ');
        }
    };

    // ── Remove from Income/Deduction (revert to general) ──
    const handleRevertToGeneral = async (id: number) => {
        try {
            await axios.patch(`${API}/formulas/${id}/status`, { type: 'general' });
            message.success('นำรายการออกจากหมวดหมู่นี้แล้ว');
            fetchFormulas();
        } catch (err) {
            message.error('ดำเนินการไม่สำเร็จ');
        }
    };

    // ── Open "Add Item" Modal for Incomes or Deductions ──
    const openAddItemModal = (cat: 'income' | 'deduction') => {
        setTargetCategory(cat);
        setItemSelectionMode('existing');
        setSelectedFormulaId(null);
        setIsItemModalVisible(true);
    };

    // ── Assign existing formula to category ──
    const handleAssignExisting = async () => {
        if (!selectedFormulaId) {
            return message.warning('กรุณาเลือกสูตรที่ต้องการนำมาใช้');
        }
        try {
            await axios.patch(`${API}/formulas/${selectedFormulaId}/status`, {
                type: targetCategory,
                is_active: 1
            });
            message.success(`นำสูตรมาเป็นรายการ${targetCategory === 'income' ? 'รายได้' : 'รายการหัก'}สำเร็จ`);
            setIsItemModalVisible(false);
            fetchFormulas();
        } catch (err) {
            message.error('ดำเนินการไม่สำเร็จ');
        }
    };

    const insertToExpression = (val: string) => {
        setExpression(prev => (prev ? prev + ' ' : '') + val);
    };

    const variables = [
        { label: 'เงินเดือนฐาน / ค่าจ้างฐาน', value: '[เงินเดือนฐาน]', desc: 'เงินเดือน (รายเดือน) หรือ ค่าจ้างรายวัน × วันทำงานจริง (รายวัน)' },
        { label: 'อัตราค่าจ้างรายวัน', value: '[รายวัน]', desc: 'ค่าจ้างรายวัน (รายวัน) หรือ เงินเดือน ÷ 30 (รายเดือน)' },
        { label: 'วันทำงานจริง', value: '[วันทำงานจริง]', desc: 'วันสแกนเข้างานจริง (รายวัน) หรือ 30 - วันลา (รายเดือน)' },
        { label: 'วันลา (หักเงิน)', value: '[วันลา]', desc: 'จำนวนวันลาไม่รับเงิน' },
        { label: 'ชั่วโมง OT รวม', value: '[ชั่วโมง_OT]', desc: 'ผลรวมชั่วโมง OT ทุกตัวคูณ' },
        { label: 'นาทีมาสาย', value: '[นาทีมาสาย]', desc: 'จำนวนนาทีที่มาสายรวม' },
        { label: 'เบี้ยขยันตั้งต้น', value: '[เบี้ยขยัน]', desc: 'ค่าเบี้ยขยันตามนโยบาย' },
    ];

    const operators = ['+', '-', '*', '/', '(', ')'];
    const numbers = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '30', '8', '100', '1.5', '2.0', '3.0'];

    const renderTypeTag = (type: string) => {
        if (type === 'income') return <Tag color="success" style={{ fontWeight: 500 }}>รายได้ (Income)</Tag>;
        if (type === 'deduction') return <Tag color="error" style={{ fontWeight: 500 }}>รายการหัก (Deduction)</Tag>;
        return <Tag color="default">ทั่วไป (General)</Tag>;
    };

    // Columns for Tab 1: All Formulas
    const allFormulasColumns = [
        {
            title: 'ชื่อสูตร',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: Formula) => (
                <div>
                    <Text strong style={{ fontSize: 15 }}>{text}</Text>
                    {record.description && (
                        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{record.description}</div>
                    )}
                </div>
            )
        },
        {
            title: 'ประเภทรายการ',
            dataIndex: 'type',
            key: 'type',
            width: 170,
            render: (type: string) => renderTypeTag(type)
        },
        {
            title: 'สูตรการคำนวณ',
            dataIndex: 'expression',
            key: 'expression',
            render: (text: string) => (
                <Text code style={{ fontSize: 13, background: '#f5f5f5', padding: '4px 8px', borderRadius: 4 }}>
                    {text}
                </Text>
            )
        },
        {
            title: 'สถานะ',
            dataIndex: 'is_active',
            key: 'is_active',
            width: 100,
            align: 'center' as const,
            render: (active: any, record: Formula) => (
                <Switch
                    checked={active === 1 || active === true}
                    onChange={() => handleToggleStatus(record.id, active)}
                    checkedChildren="เปิด"
                    unCheckedChildren="ปิด"
                />
            )
        },
        {
            title: 'จัดการ',
            key: 'action',
            width: 140,
            align: 'center' as const,
            render: (_: any, record: Formula) => (
                <Space>
                    <Button type="link" icon={<EditOutlined />} onClick={() => openFormulaModal(record)}>
                        แก้ไข
                    </Button>
                    <Popconfirm title="ยืนยันการลบสูตรนี้?" onConfirm={() => handleDelete(record.id)} okText="ลบ" cancelText="ยกเลิก">
                        <Button type="link" danger icon={<DeleteOutlined />}>ลบ</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    // Columns for Tab 2 & 3: Category Items
    const categoryColumns = (cat: 'income' | 'deduction') => [
        {
            title: cat === 'income' ? 'ชื่อรายการรายได้' : 'ชื่อรายการหัก',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: Formula) => (
                <div>
                    <Text strong style={{ fontSize: 15, color: cat === 'income' ? '#237804' : '#cf1322' }}>
                        {cat === 'income' ? '➕ ' : '➖ '}{text}
                    </Text>
                    {record.description && (
                        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{record.description}</div>
                    )}
                </div>
            )
        },
        {
            title: 'สูตรที่ใช้คำนวณ',
            dataIndex: 'expression',
            key: 'expression',
            render: (text: string) => (
                <Text code style={{ fontSize: 13, background: '#fafafa', border: '1px solid #e8e8e8', padding: '4px 8px', borderRadius: 4 }}>
                    {text}
                </Text>
            )
        },
        {
            title: 'คำนวณในเงินเดือน',
            dataIndex: 'is_active',
            key: 'is_active',
            width: 140,
            align: 'center' as const,
            render: (active: any, record: Formula) => (
                <Tooltip title={active ? 'สูตรนี้จะถูกนำไปคำนวณในรอบเงินเดือน' : 'ปิดการคำนวณสูตรนี้ชั่วคราว'}>
                    <Switch
                        checked={active === 1 || active === true}
                        onChange={() => handleToggleStatus(record.id, active)}
                        checkedChildren="ใช้งาน"
                        unCheckedChildren="ปิดไว้"
                    />
                </Tooltip>
            )
        },
        {
            title: 'จัดการ',
            key: 'action',
            width: 170,
            align: 'center' as const,
            render: (_: any, record: Formula) => (
                <Space>
                    <Button type="link" icon={<EditOutlined />} onClick={() => openFormulaModal(record, cat)}>
                        แก้ไขสูตร
                    </Button>
                    <Popconfirm
                        title={`นำรายการนี้ออกจากหมวด${cat === 'income' ? 'รายได้' : 'รายการหัก'}?`}
                        description="สูตรนี้จะยังคงอยู่ในระบบแต่จะกลายเป็นสูตรทั่วไป ไม่คิดในเงินเดือน"
                        onConfirm={() => handleRevertToGeneral(record.id)}
                        okText="นำออก"
                        cancelText="ยกเลิก"
                    >
                        <Button type="link" danger icon={<DeleteOutlined />}>นำออก</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const incomeList = formulas.filter(f => f.type === 'income');
    const deductionList = formulas.filter(f => f.type === 'deduction');
    const availableForIncome = formulas.filter(f => f.type !== 'income');
    const availableForDeduction = formulas.filter(f => f.type !== 'deduction');

    return (
        <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
            <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                {/* ── Page Header ── */}
                <div style={{ marginBottom: 20 }}>
                    <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CalculatorOutlined style={{ color: '#1890ff' }} />
                        ระบบสูตรและรายการรายได้-รายหักเงินเดือน
                    </Title>
                    <Text type="secondary" style={{ marginTop: 4, display: 'block' }}>
                        กำหนดสูตรการคำนวณ และระบุรายการรายได้หรือรายการหักเงินเดือนได้ทันที ข้อมูลจะซิงค์ไปยังหน้าประมวลผลเงินเดือนอัตโนมัติ
                    </Text>
                </div>

                <Tabs activeKey={activeTab} onChange={setActiveTab} size="large" type="card">
                    {/* ══════════════════════════════════════════
                        TAB 1: ALL FORMULAS (ตั้งค่าสูตร)
                       ══════════════════════════════════════════ */}
                    <TabPane
                        tab={
                            <span>
                                <CalculatorOutlined /> ตั้งค่าสูตร (Formulas)
                                <Tag color="blue" style={{ marginLeft: 8 }}>{formulas.length}</Tag>
                            </span>
                        }
                        key="1"
                    >
                        <div style={{ padding: '8px 0' }}>
                            <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                <Col>
                                    <Text type="secondary">
                                        สูตรคำนวณทั้งหมดในระบบ สามารถกำหนดประเภทเป็น <b>รายได้</b> หรือ <b>รายการหัก</b> เพื่อนำไปคิดเงินเดือนได้ทันที
                                    </Text>
                                </Col>
                                <Col>
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => openFormulaModal()}
                                        size="middle"
                                        style={{ background: '#1890ff' }}
                                    >
                                        สร้างสูตรใหม่
                                    </Button>
                                </Col>
                            </Row>

                            <Table
                                columns={allFormulasColumns}
                                dataSource={formulas}
                                rowKey="id"
                                loading={loading}
                                pagination={{ pageSize: 10 }}
                                bordered
                            />
                        </div>
                    </TabPane>

                    {/* ══════════════════════════════════════════
                        TAB 2: INCOMES (หน้ารายได้)
                       ══════════════════════════════════════════ */}
                    <TabPane
                        tab={
                            <span>
                                <MoneyCollectOutlined style={{ color: '#52c41a' }} /> หน้ารายได้ (Incomes)
                                <Tag color="green" style={{ marginLeft: 8 }}>{incomeList.length}</Tag>
                            </span>
                        }
                        key="2"
                    >
                        <div style={{ padding: '8px 0' }}>
                            <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                <Col>
                                    <Text strong style={{ fontSize: 16 }}>รายการรายได้ที่ใช้งาน ({incomeList.length} รายการ)</Text>
                                </Col>
                                <Col>
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => openAddItemModal('income')}
                                        size="middle"
                                        style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                    >
                                        เพิ่มรายการรายได้
                                    </Button>
                                </Col>
                            </Row>

                            <Table
                                columns={categoryColumns('income')}
                                dataSource={incomeList}
                                rowKey="id"
                                loading={loading}
                                pagination={{ pageSize: 10 }}
                                bordered
                                locale={{ emptyText: 'ยังไม่มีรายการรายได้ กด "เพิ่มรายการรายได้" เพื่อดึงสูตรมาใช้' }}
                            />
                        </div>
                    </TabPane>

                    {/* ══════════════════════════════════════════
                        TAB 3: DEDUCTIONS (หน้ารายหัก)
                       ══════════════════════════════════════════ */}
                    <TabPane
                        tab={
                            <span>
                                <FallOutlined style={{ color: '#ff4d4f' }} /> หน้ารายหัก (Deductions)
                                <Tag color="red" style={{ marginLeft: 8 }}>{deductionList.length}</Tag>
                            </span>
                        }
                        key="3"
                    >
                        <div style={{ padding: '8px 0' }}>
                            <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                <Col>
                                    <Text strong style={{ fontSize: 16 }}>รายการหักที่ใช้งาน ({deductionList.length} รายการ)</Text>
                                </Col>
                                <Col>
                                    <Button
                                        type="primary"
                                        danger
                                        icon={<PlusOutlined />}
                                        onClick={() => openAddItemModal('deduction')}
                                        size="middle"
                                    >
                                        เพิ่มรายการหัก
                                    </Button>
                                </Col>
                            </Row>

                            <Table
                                columns={categoryColumns('deduction')}
                                dataSource={deductionList}
                                rowKey="id"
                                loading={loading}
                                pagination={{ pageSize: 10 }}
                                bordered
                                locale={{ emptyText: 'ยังไม่มีรายการหัก กด "เพิ่มรายการหัก" เพื่อดึงสูตรมาใช้' }}
                            />
                        </div>
                    </TabPane>
                </Tabs>
            </Card>

            {/* ════════════════════════════════════════════════════════════════════
                MODAL 1: ADD ITEM TO INCOME / DEDUCTION (เลือกสูตรเดิม หรือสร้างใหม่)
               ════════════════════════════════════════════════════════════════════ */}
            <Modal
                title={
                    <Space>
                        {targetCategory === 'income' ? <MoneyCollectOutlined style={{ color: '#52c41a' }} /> : <FallOutlined style={{ color: '#ff4d4f' }} />}
                        <span>เพิ่มรายการ{targetCategory === 'income' ? 'รายได้' : 'รายการหักเงิน'}</span>
                    </Space>
                }
                open={isItemModalVisible}
                onCancel={() => setIsItemModalVisible(false)}
                footer={null}
                width={600}
                destroyOnClose
            >
                <div style={{ padding: '10px 0' }}>
                    <div style={{ marginBottom: 20, textAlign: 'center' }}>
                        <Radio.Group
                            value={itemSelectionMode}
                            onChange={e => setItemSelectionMode(e.target.value)}
                            buttonStyle="solid"
                            size="large"
                        >
                            <Radio.Button value="existing">
                                <LinkOutlined /> ดึงจากสูตรที่ตั้งไว้แล้ว
                            </Radio.Button>
                            <Radio.Button value="new">
                                <PlusOutlined /> สร้างสูตรใหม่ทันที
                            </Radio.Button>
                        </Radio.Group>
                    </div>

                    {itemSelectionMode === 'existing' ? (
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                เลือกสูตรเพื่อนำมาเป็นรายการ{targetCategory === 'income' ? 'รายได้' : 'รายการหัก'}:
                            </Text>
                            <Select
                                placeholder="เลือกสูตรจากรายการที่มี..."
                                style={{ width: '100%', marginBottom: 16 }}
                                size="large"
                                value={selectedFormulaId}
                                onChange={setSelectedFormulaId}
                            >
                                {(targetCategory === 'income' ? availableForIncome : availableForDeduction).map(f => (
                                    <Select.Option key={f.id} value={f.id}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 500 }}>{f.name}</span>
                                            <span style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>{f.expression}</span>
                                        </div>
                                    </Select.Option>
                                ))}
                            </Select>

                            {(targetCategory === 'income' ? availableForIncome : availableForDeduction).length === 0 && (
                                <Text type="secondary" style={{ display: 'block', marginBottom: 16, color: '#fa8c16' }}>
                                    ไม่มีสูตรที่ว่างอยู่ กรุณาเลือก "สร้างสูตรใหม่ทันที" เพื่อสร้างสูตรใหม่
                                </Text>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                                <Button onClick={() => setIsItemModalVisible(false)}>ยกเลิก</Button>
                                <Button
                                    type="primary"
                                    onClick={handleAssignExisting}
                                    disabled={!selectedFormulaId}
                                    style={targetCategory === 'income' ? { background: '#52c41a', borderColor: '#52c41a' } : { background: '#ff4d4f', borderColor: '#ff4d4f' }}
                                >
                                    ยืนยันนำมาเป็น{targetCategory === 'income' ? 'รายได้' : 'รายการหัก'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <Paragraph type="secondary">
                                เปิดหน้าต่างสร้างสูตรคำนวณ พร้อมกำหนดเป็น <b>{targetCategory === 'income' ? 'รายได้' : 'รายการหัก'}</b> โดยอัตโนมัติ
                            </Paragraph>
                            <Button
                                type="primary"
                                icon={<ArrowRightOutlined />}
                                size="large"
                                onClick={() => {
                                    setIsItemModalVisible(false);
                                    openFormulaModal(undefined, targetCategory);
                                }}
                                style={targetCategory === 'income' ? { background: '#52c41a', borderColor: '#52c41a' } : { background: '#ff4d4f', borderColor: '#ff4d4f' }}
                            >
                                ไปยังหน้าต่างสร้างสูตรใหม่
                            </Button>
                        </div>
                    )}
                </div>
            </Modal>

            {/* ════════════════════════════════════════════════════════════════════
                MODAL 2: FORMULA BUILDER / EDITOR
               ════════════════════════════════════════════════════════════════════ */}
            <Modal
                title={
                    <Space>
                        <CalculatorOutlined style={{ color: '#1890ff' }} />
                        <span>{formulaId ? 'แก้ไขสูตรคำนวณ' : 'สร้างสูตรคำนวณใหม่'}</span>
                    </Space>
                }
                open={isFormulaModalVisible}
                onCancel={() => setIsFormulaModalVisible(false)}
                onOk={handleSaveFormula}
                width={950}
                okText="บันทึกสูตร"
                cancelText="ยกเลิก"
                destroyOnClose
            >
                <Row gutter={24} style={{ marginTop: 8 }}>
                    {/* ── Left Column: Formula Tools ── */}
                    <Col span={12}>
                        <Card
                            size="small"
                            title="เครื่องมือสร้างสูตร (กดเพื่อแทรกลงในสูตร)"
                            bordered
                            style={{ background: '#fafafa', borderRadius: 8 }}
                        >
                            {/* Variables */}
                            <div style={{ marginBottom: 16 }}>
                                <Text strong style={{ fontSize: 13, color: '#1890ff' }}>📌 ข้อมูลในระบบ (Variables)</Text>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                    {variables.map(v => (
                                        <Tooltip key={v.value} title={v.desc}>
                                            <Button
                                                size="small"
                                                type="primary"
                                                ghost
                                                onClick={() => insertToExpression(v.value)}
                                                style={{ borderRadius: 4 }}
                                            >
                                                {v.label}
                                            </Button>
                                        </Tooltip>
                                    ))}
                                </div>
                            </div>

                            <Divider style={{ margin: '12px 0' }} />

                            {/* Operators */}
                            <div style={{ marginBottom: 16 }}>
                                <Text strong style={{ fontSize: 13, color: '#722ed1' }}>➕ เครื่องหมายคำนวณ (Operators)</Text>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                    {operators.map(op => (
                                        <Button
                                            key={op}
                                            size="middle"
                                            onClick={() => insertToExpression(op)}
                                            style={{ fontWeight: 'bold', width: 42, height: 36, fontSize: 16 }}
                                        >
                                            {op}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <Divider style={{ margin: '12px 0' }} />

                            {/* Numbers */}
                            <div>
                                <Text strong style={{ fontSize: 13, color: '#fa8c16' }}>🔢 ตัวเลขและค่าคงที่ (Numbers)</Text>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                    {numbers.map(n => (
                                        <Button
                                            key={n}
                                            size="small"
                                            onClick={() => insertToExpression(n)}
                                            style={{ minWidth: 36, height: 32 }}
                                        >
                                            {n}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </Col>

                    {/* ── Right Column: Formula Details ── */}
                    <Col span={12}>
                        <Card
                            size="small"
                            title="รายละเอียดและผลลัพธ์สูตร"
                            bordered
                            style={{ borderRadius: 8, height: '100%' }}
                        >
                            {/* Formula Name */}
                            <div style={{ marginBottom: 14 }}>
                                <Text strong>ชื่อสูตร <Text type="danger">*</Text></Text>
                                <Input
                                    placeholder="เช่น ค่าโอที 1.5 เท่า, หักประกันสังคม, เบี้ยขยัน"
                                    value={formulaName}
                                    onChange={e => setFormulaName(e.target.value)}
                                    style={{ marginTop: 6 }}
                                />
                            </div>

                            {/* Formula Type (Category) */}
                            <div style={{ marginBottom: 14 }}>
                                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                                    ประเภทรายการ (นำไปใช้เป็น) <Text type="danger">*</Text>
                                </Text>
                                <Radio.Group
                                    value={formulaType}
                                    onChange={e => setFormulaType(e.target.value)}
                                    buttonStyle="solid"
                                    style={{ width: '100%' }}
                                >
                                    <Radio.Button value="income" style={{ width: '33.33%', textAlign: 'center' }}>
                                        <span style={{ color: formulaType === 'income' ? '#fff' : '#52c41a', fontWeight: 600 }}>🟢 รายได้</span>
                                    </Radio.Button>
                                    <Radio.Button value="deduction" style={{ width: '33.33%', textAlign: 'center' }}>
                                        <span style={{ color: formulaType === 'deduction' ? '#fff' : '#ff4d4f', fontWeight: 600 }}>🔴 รายการหัก</span>
                                    </Radio.Button>
                                    <Radio.Button value="general" style={{ width: '33.33%', textAlign: 'center' }}>
                                        <span>⚪ ทั่วไป</span>
                                    </Radio.Button>
                                </Radio.Group>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                                    {formulaType === 'income' && '✨ รายการนี้จะไปปรากฏใน "หน้ารายได้" และถูกบวกเพิ่มในรอบเงินเดือน'}
                                    {formulaType === 'deduction' && '✨ รายการนี้จะไปปรากฏใน "หน้ารายหัก" และถูกหักออกจากเงินเดือน'}
                                    {formulaType === 'general' && 'สูตรทั่วไป ไม่นำไปบวกหรือหักในเงินเดือนโดยตรง'}
                                </Text>
                            </div>

                            {/* Expression */}
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text strong>สมการการคำนวณ <Text type="danger">*</Text></Text>
                                    <Button size="small" type="link" danger onClick={() => setExpression('')}>
                                        ล้างสมการ
                                    </Button>
                                </div>
                                <Input.TextArea
                                    value={expression}
                                    onChange={e => setExpression(e.target.value)}
                                    rows={4}
                                    style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 15, background: '#fafafa' }}
                                    placeholder="กดปุ่มจากเครื่องมือทางซ้าย หรือพิมพ์สมการที่นี่..."
                                />
                            </div>

                            {/* Description */}
                            <div style={{ marginBottom: 14 }}>
                                <Text strong>คำอธิบายเพิ่มเติม</Text>
                                <Input
                                    placeholder="เช่น คำนวณค่าล่วงเวลาวันทำงานปกติ"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    style={{ marginTop: 6 }}
                                />
                            </div>

                            {/* Active Switch */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
                                <Text strong>เปิดใช้งานสูตรนี้</Text>
                                <Switch
                                    checked={formulaIsActive}
                                    onChange={setFormulaIsActive}
                                    checkedChildren="เปิด"
                                    unCheckedChildren="ปิด"
                                />
                            </div>
                        </Card>
                    </Col>
                </Row>
            </Modal>
        </div>
    );
};

export default FormulaBuilder;
