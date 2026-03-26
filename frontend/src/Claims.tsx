import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, Select, Tag, Space, Card, Typography, message } from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

interface Claim {
    id: number;
    employee_id: number;
    employee_name: string;
    employee_code: string;
    claim_type: string;
    amount: number;
    receipt_date: string;
    description: string;
    status: 'pending' | 'approved' | 'rejected' | 'paid';
}

export const Claims: React.FC = () => {
    const [claims, setClaims] = useState<Claim[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [employees, setEmployees] = useState<{id: string, name: string}[]>([]);
    const [form] = Form.useForm();

    const fetchClaims = async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:5000/api/claims');
            setClaims(res.data);
        } catch (err) {
            message.error('ไม่สามารถดึงข้อมูลเบิกจ่ายได้');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/employees');
            setEmployees(res.data.map((e: any) => ({ id: e.id, name: e.name })));
        } catch (err) {
            message.error('ไม่สามารถดึงข้อมูลพนักงานได้');
        }
    };

    useEffect(() => {
        fetchClaims();
        fetchEmployees();
    }, []);

    const handleAddClaim = async (values: any) => {
        try {
            await axios.post('http://localhost:5000/api/claims', {
                ...values,
                receipt_date: values.receipt_date.format('YYYY-MM-DD')
            });
            message.success('ส่งคำขอเบิกจ่ายสำเร็จ');
            setIsModalVisible(false);
            form.resetFields();
            fetchClaims();
        } catch (err) {
            message.error('เกิดข้อผิดพลาดในการส่งคำขอ');
        }
    };

    const updateStatus = async (id: number, status: string) => {
        try {
            await axios.put(`http://localhost:5000/api/claims/${id}/status`, { status });
            message.success(`อัปเดตสถานะเป็น ${status} สำเร็จ`);
            fetchClaims();
        } catch (err) {
            message.error('ไม่สามารถอัปเดตสถานะได้');
        }
    };

    const deleteClaim = async (id: number) => {
        try {
            await axios.delete(`http://localhost:5000/api/claims/${id}`);
            message.success('ลบข้อมูลสำเร็จ');
            fetchClaims();
        } catch (err) {
            message.error('ไม่สามารถลบข้อมูลได้');
        }
    };

    const columns = [
        {
            title: 'พนักงาน',
            dataIndex: 'employee_name',
            key: 'employee_name',
            render: (text: string, record: Claim) => (
                <div>
                    <div>{text}</div>
                    <small style={{ color: '#888' }}>{record.employee_code}</small>
                </div>
            )
        },
        { title: 'ประเภท', dataIndex: 'claim_type', key: 'claim_type' },
        {
            title: 'วันที่ใบเสร็จ',
            dataIndex: 'receipt_date',
            key: 'receipt_date',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY')
        },
        {
            title: 'จำนวนเงิน',
            dataIndex: 'amount',
            key: 'amount',
            render: (val: number) => `฿${val.toLocaleString()}`
        },
        {
            title: 'สถานะ',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                let color = 'gold';
                if (status === 'approved') color = 'blue';
                if (status === 'paid') color = 'green';
                if (status === 'rejected') color = 'red';
                return <Tag color={color}>{status.toUpperCase()}</Tag>;
            }
        },
        {
            title: 'จัดการ',
            key: 'action',
            render: (_: any, record: Claim) => (
                <Space>
                    {record.status === 'pending' && (
                        <>
                            <Button 
                                type="primary" 
                                ghost 
                                icon={<CheckCircleOutlined />} 
                                onClick={() => updateStatus(record.id, 'approved')}
                            >
                                อนุมัติ
                            </Button>
                            <Button 
                                danger 
                                ghost 
                                icon={<CloseCircleOutlined />} 
                                onClick={() => updateStatus(record.id, 'rejected')}
                            >
                                ปฏิเสธ
                            </Button>
                        </>
                    )}
                    <Button 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={() => Modal.confirm({
                            title: 'ยืนยันการลบ',
                            content: 'คุณต้องการลบรายการนี้ใช่หรือไม่?',
                            onOk: () => deleteClaim(record.id)
                        })} 
                    />
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <Title level={2}>สวัสดิการและเบิกจ่าย (Claims & Benefits)</Title>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
                        สร้างคำขอเบิกจ่าย
                    </Button>
                </div>

                <Table 
                    columns={columns} 
                    dataSource={claims} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            <Modal
                title="สร้างคำขอเบิกจ่ายใหม่"
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                onOk={() => form.submit()}
            >
                <Form form={form} layout="vertical" onFinish={handleAddClaim}>
                    <Form.Item name="employee_id" label="พนักงาน" rules={[{ required: true }]}>
                        <Select showSearch placeholder="เลือกพนักงาน" filterOption={(input, option) =>
                            (option?.children as any).toLowerCase().indexOf(input.toLowerCase()) >= 0
                        }>
                            {employees.map(emp => (
                                <Option key={emp.id} value={emp.id}>{emp.name}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="claim_type" label="ประเภทการเบิก" rules={[{ required: true }]}>
                        <Select placeholder="เลือกประเภท">
                            <Option value="ค่าเดินทาง">ค่าเดินทาง</Option>
                            <Option value="ค่ารักษาพยาบาล">ค่ารักษาพยาบาล</Option>
                            <Option value="ค่าอาหาร/รับรอง">ค่าอาหาร/รับรอง</Option>
                            <Option value="อื่นๆ">อื่นๆ</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="amount" label="จำนวนเงิน" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} min={1} precision={2} />
                    </Form.Item>
                    <Form.Item name="receipt_date" label="วันที่ในใบเสร็จ" rules={[{ required: true }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="description" label="รายละเอียด/หมายเหตุ">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};
