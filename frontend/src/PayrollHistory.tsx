import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Tag, Button, Space, Statistic, Row, Col, Tooltip } from 'antd';
import type { TableProps } from 'antd';
import { HistoryOutlined, DollarOutlined, TeamOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL as API } from './api';

const { Title, Text } = Typography;

// API constant is now imported above

interface HistoryRow {
    period_year: number;
    period_month: number;
    employee_count: number;
    total_net: number;
    total_gross: number;
    total_tax_sso: number;
    status: string;
}

const MONTH_TH = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export const PayrollHistory: React.FC<{ onViewPayroll?: (month: number, year: number) => void }> = ({ onViewPayroll }) => {
    const [history, setHistory] = useState<HistoryRow[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/payroll/history`);
            setHistory(res.data);
        } catch {
            // no data yet is fine
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchHistory(); }, []);

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(v || 0);

    const totalPaid = history.filter(r => r.status === 'paid').reduce((s, r) => s + parseFloat(r.total_net as any), 0);
    const totalEmployees = history.length > 0 ? Math.max(...history.map(r => parseInt(r.employee_count as any))) : 0;

    const columns: TableProps<HistoryRow>['columns'] = [
        {
            title: 'รอบเงินเดือน', key: 'period',
            render: (_, r) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{MONTH_TH[r.period_month]} {r.period_year + 543}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{r.period_month}/{r.period_year}</Text>
                </Space>
            ),
            sorter: (a, b) => (a.period_year * 100 + a.period_month) - (b.period_year * 100 + b.period_month),
            defaultSortOrder: 'descend',
        },
        {
            title: 'จำนวนพนักงาน', dataIndex: 'employee_count', key: 'employee_count', align: 'center',
            render: (v) => <Tag color="blue" icon={<TeamOutlined />}>{v} คน</Tag>
        },
        {
            title: 'รวม Gross', dataIndex: 'total_gross', key: 'total_gross', align: 'right',
            render: (v) => <Text style={{ color: '#52c41a' }}>{formatCurrency(parseFloat(v))}</Text>,
            sorter: (a, b) => parseFloat(a.total_gross as any) - parseFloat(b.total_gross as any),
        },
        {
            title: 'ภาษี + SSO', dataIndex: 'total_tax_sso', key: 'total_tax_sso', align: 'right',
            render: (v) => <Text type="danger">{formatCurrency(parseFloat(v))}</Text>
        },
        {
            title: 'รวมสุทธิ (Net)', dataIndex: 'total_net', key: 'total_net', align: 'right',
            render: (v) => <Text strong style={{ color: '#1890ff', fontSize: 15 }}>{formatCurrency(parseFloat(v))}</Text>,
            sorter: (a, b) => parseFloat(a.total_net as any) - parseFloat(b.total_net as any),
        },
        {
            title: 'สถานะ', dataIndex: 'status', key: 'status', align: 'center',
            render: (s) => s === 'paid'
                ? <Tag color="blue">จ่ายแล้ว</Tag>
                : <Tag color="orange">รอดำเนินการ</Tag>
        },
        {
            title: '', key: 'action', align: 'center', width: 80,
            render: (_, r) => (
                <Tooltip title="ดูรายละเอียด">
                    <Button type="link" size="small" icon={<EyeOutlined />}
                        onClick={() => onViewPayroll?.(r.period_month, r.period_year)}>
                        ดู
                    </Button>
                </Tooltip>
            )
        }
    ];

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>ประวัติการจ่ายเงินเดือน</Title>
                <Text type="secondary">บันทึกรอบการประมวลผลเงินเดือนทั้งหมดในระบบ</Text>
            </div>

            {/* Summary cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ borderRadius: 8, background: 'linear-gradient(135deg, #1890ff, #096dd9)' }}>
                        <Statistic
                            title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>รวมจ่ายเงินเดือนทั้งหมด</span>}
                            value={totalPaid} precision={0}
                            valueStyle={{ color: '#fff', fontWeight: 'bold' }}
                            prefix={<DollarOutlined />}
                            formatter={(v) => formatCurrency(Number(v))}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ borderRadius: 8 }}>
                        <Statistic
                            title="รอบเงินเดือนที่บันทึก" value={history.length}
                            suffix="รอบ" valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                            prefix={<HistoryOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ borderRadius: 8 }}>
                        <Statistic
                            title="พนักงานสูงสุด (รอบล่าสุด)" value={totalEmployees}
                            suffix="คน" valueStyle={{ color: '#722ed1', fontWeight: 'bold' }}
                            prefix={<TeamOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            <Card bordered={false} style={{ borderRadius: 8 }}>
                {history.length === 0 && !loading ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                        <HistoryOutlined style={{ fontSize: 48, marginBottom: 12 }} />
                        <div>ยังไม่มีประวัติการจ่ายเงินเดือน</div>
                        <Text type="secondary">ไปที่หน้า "จัดการเงินเดือน" แล้วกด "คำนวณเงินเดือน" เพื่อเริ่มต้น</Text>
                    </div>
                ) : (
                    <Table
                        columns={columns} dataSource={history}
                        rowKey={(r) => `${r.period_year}-${r.period_month}`}
                        loading={loading} pagination={{ pageSize: 12 }}
                        bordered size="middle"
                    />
                )}
            </Card>
        </div>
    );
};
