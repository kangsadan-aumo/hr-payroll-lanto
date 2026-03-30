import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Typography, Table, Tag, Button, Space, Input, DatePicker, Select, Modal, Form, message, Dropdown, InputNumber } from 'antd';
import {
    ClockCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    PlusOutlined,
    SearchOutlined,
    MoreOutlined,
    CalendarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';
import { API_BASE_URL as API } from './api';

const { Title, Text } = Typography;
const { Option } = Select;

interface OvertimeRequest {
    id: string;
    employee_id: number;
    employee_name: string;
    department: string;
    date: string;
    hours: number;
    multiplier: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
}

export const Overtime: React.FC = () => {
    const [requests, setRequests] = useState<OvertimeRequest[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form] = Form.useForm();

    const API_BASE = API;

    const fetchData = async () => {
        setLoading(true);
        try {
            const [otRes, empRes] = await Promise.all([
                axios.get(`${API_BASE}/overtime/requests`),
                axios.get(`${API_BASE}/employees`)
            ]);
            setRequests(otRes.data);
            setEmployees(empRes.data);
        } catch (error) {
            message.error('ไม่สามารถโหลดข้อมูล OT ได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleStatusUpdate = async (id: string, status: string) => {
        try {
            await axios.put(`${API_BASE}/overtime/requests/${id}/status`, { status });
            message.success('อัปเดตสถานะสำเร็จ');
            fetchData();
        } catch (error) {
            message.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await axios.delete(`${API_BASE}/overtime/requests/${id}`);
            message.success('ลบรายการสำเร็จ');
            fetchData();
        } catch (error) {
            message.error('ไม่สามารถลบรายการได้');
        }
    };

    const handleSubmit = async (values: any) => {
        try {
            const payload = {
                ...values,
                date: values.date.format('YYYY-MM-DD')
            };
            await axios.post(`${API_BASE}/overtime/requests`, payload);
            message.success('บันทึกรายการ OT สำเร็จ');
            setIsModalOpen(false);
            form.resetFields();
            fetchData();
        } catch (error) {
            message.error('เกิดข้อผิดพลาดในการบันทึก');
        }
    };

    const filteredRequests = requests.filter(r => {
        const matchSearch = r.employee_name?.toLowerCase().includes(searchText.toLowerCase()) || 
                           r.department?.toLowerCase().includes(searchText.toLowerCase());
        const matchStatus = statusFilter === 'all' || r.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const columns = [
        {
            title: 'พนักงาน',
            key: 'employee',
            render: (_: any, r: OvertimeRequest) => (
                <div>
                    <div style={{ fontWeight: 500 }}>{r.employee_name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{r.department}</div>
                </div>
            )
        },
        {
            title: 'วันที่ทำ OT',
            dataIndex: 'date',
            key: 'date',
            render: (date: string) => dayjs(date).format('DD MMM YYYY')
        },
        {
            title: 'จำนวนชั่วโมง',
            dataIndex: 'hours',
            key: 'hours',
            render: (h: number) => <Text strong>{h} ชม.</Text>
        },
        {
            title: 'ตัวคูณ (Multiplier)',
            dataIndex: 'multiplier',
            key: 'multiplier',
            render: (m: number) => <Tag color="blue">x {m}</Tag>
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
            render: (status: string) => {
                const colors: any = { approved: 'success', pending: 'warning', rejected: 'error' };
                const texts: any = { approved: 'อนุมัติแล้ว', pending: 'รออนุมัติ', rejected: 'ปฏิเสธ' };
                return <Tag color={colors[status]}>{texts[status]}</Tag>;
            }
        },
        {
            title: 'จัดการ',
            key: 'action',
            render: (_: any, r: OvertimeRequest) => (
                <Dropdown menu={{
                    items: [
                        { key: 'app', label: 'อนุมัติ', icon: <CheckCircleOutlined />, onClick: () => handleStatusUpdate(r.id, 'approved'), disabled: r.status === 'approved' },
                        { key: 'rej', label: 'ปฏิเสธ', icon: <CloseCircleOutlined />, onClick: () => handleStatusUpdate(r.id, 'rejected'), disabled: r.status === 'rejected' },
                        { key: 'del', label: 'ลบรายการ', icon: <CloseCircleOutlined />, danger: true, onClick: () => handleDelete(r.id) }
                    ]
                }}>
                    <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>
            )
        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>จัดการค่าล่วงเวลา (OT Management)</Title>
                    <Text type="secondary">บันทึกและอนุมัติชั่วโมงทำงานล่วงเวลาเพื่อนำไปคำนวณเงินเดือน</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>บันทึก OT ใหม่</Button>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={8}>
                    <Card size="small">
                        <Statistic title="รออนุมัติ" value={requests.filter(r => r.status === 'pending').length} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card size="small">
                        <Statistic title="อนุมัติแล้ว (เดือนนี้)" value={requests.filter(r => r.status === 'approved' && dayjs(r.date).isSame(dayjs(), 'month')).length} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card size="small">
                        <Statistic title="รวมชั่วโมง OT (เดือนนี้)" value={requests.filter(r => r.status === 'approved' && dayjs(r.date).isSame(dayjs(), 'month')).reduce((sum, r) => sum + r.hours, 0)} prefix={<CalendarOutlined />} />
                    </Card>
                </Col>
            </Row>

            <Card bordered={false}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Space>
                        <Input placeholder="ค้นหาพนักงาน..." prefix={<SearchOutlined />} style={{ width: 300 }} value={searchText} onChange={e => setSearchText(e.target.value)} />
                        <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }}>
                            <Option value="all">สถานะทั้งหมด</Option>
                            <Option value="pending">รออนุมัติ</Option>
                            <Option value="approved">อนุมัติแล้ว</Option>
                            <Option value="rejected">ปฏิเสธ</Option>
                        </Select>
                    </Space>
                </div>

                <Table columns={columns} dataSource={filteredRequests} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} />
            </Card>

            <Modal title="บันทึกข้อมูล OT" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()} width={600}>
                <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ multiplier: 1.5, hours: 1 }}>
                    <Form.Item name="employee_id" label="พนักงาน" rules={[{ required: true }]}>
                        <Select showSearch placeholder="เลือกพนักงาน" filterOption={(input, option) => String(option?.children).toLowerCase().includes(input.toLowerCase())}>
                            {employees.map(e => <Option key={e.id} value={e.id}>{e.name} ({e.department})</Option>)}
                        </Select>
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="date" label="วันที่ทำ OT" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="multiplier" label="ตัวคูณค่าแรง" rules={[{ required: true }]}>
                                <Select>
                                    <Option value={1.5}>x 1.5 (ปกติสัปดาห์)</Option>
                                    <Option value={1.0}>x 1.0 (ทำงานวันหยุด)</Option>
                                    <Option value={2.0}>x 2.0 (OT วันหยุด)</Option>
                                    <Option value={3.0}>x 3.0 (วันหยุดพิเศษ)</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="hours" label="จำนวนชั่วโมง OT" rules={[{ required: true }]}><InputNumber min={0.5} step={0.5} style={{ width: '100%' }} /></Form.Item>
                    <Form.Item name="reason" label="เหตุผล / งานที่ทำ"><Input.TextArea rows={2} /></Form.Item>
                </Form>
            </Modal>
        </div>
    );
};
