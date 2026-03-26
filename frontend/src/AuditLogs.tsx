import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Tag, Input } from 'antd';
import { HistoryOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title } = Typography;

export const AuditLogs: React.FC = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:5000/api/admin/audit-logs');
            setLogs(res.data);
        } catch (error) {
            console.error('Failed to fetch audit logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, []);

    const columns = [
        {
            title: 'เวลา',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
            width: 150
        },
        {
            title: 'การกระทำ',
            dataIndex: 'action',
            key: 'action',
            render: (action: string) => <Tag color="blue">{action}</Tag>,
            width: 180
        },
        {
            title: 'ประเภทข้อมูล',
            dataIndex: 'target_table',
            key: 'target_table',
            width: 150
        },
        {
            title: 'ID ข้อมูล',
            dataIndex: 'target_id',
            key: 'target_id',
            width: 100
        },
        {
            title: 'รายละเอียด',
            dataIndex: 'details',
            key: 'details',
            render: (details: any) => <pre style={{ fontSize: '11px', margin: 0 }}>{JSON.stringify(details, null, 2)}</pre>
        }
    ];

    const filteredLogs = logs.filter((l: any) => 
        l.action.toLowerCase().includes(searchText.toLowerCase()) ||
        l.target_table.toLowerCase().includes(searchText.toLowerCase()) ||
        JSON.stringify(l.details).toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <div style={{ padding: '24px' }}>
            <Title level={2}><HistoryOutlined /> ประวัติการใช้งานระบบ (Audit Logs)</Title>
            <Card>
                <Input
                    placeholder="ค้นหาประวัติ..."
                    prefix={<SearchOutlined />}
                    style={{ marginBottom: 16, width: 300 }}
                    onChange={e => setSearchText(e.target.value)}
                />
                <Table 
                    columns={columns} 
                    dataSource={filteredLogs} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{ pageSize: 20 }}
                />
            </Card>
        </div>
    );
};
