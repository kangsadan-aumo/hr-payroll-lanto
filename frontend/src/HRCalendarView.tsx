import React, { useState, useEffect } from 'react';
import { Calendar, Badge, Card, Typography, Alert } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_BASE_URL as API } from './api';

const { Title } = Typography;

export const HRCalendarView: React.FC = () => {
    const [events, setEvents] = useState<any[]>([]);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const res = await axios.get(`${API}/admin/calendar`);
                setEvents(res.data);
            } catch (error) {
                console.error('Failed to fetch calendar events');
            }
        };
        fetchEvents();
    }, []);

    const dateCellRender = (value: dayjs.Dayjs) => {
        const listData = events.filter(e => dayjs(e.date).format('YYYY-MM-DD') === value.format('YYYY-MM-DD'));
        return (
            <ul className="events" style={{ listStyle: 'none', padding: 0 }}>
                {listData.map((item, index) => (
                    <li key={index}>
                        <Badge status={item.type as any} text={item.content} style={{ fontSize: '11px' }} />
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <div style={{ padding: '24px' }}>
            <Title level={2}><CalendarOutlined /> ปฏิทินงาน HR (HR Calendar)</Title>
            <Alert 
                message="ปฏิทินแสดงภาพรวม: วันครบรอบเริ่มงาน, วันลาที่อนุมัติแล้ว, วันหมดสัญญา และวันครบโปรโมชั่น" 
                type="info" 
                showIcon 
                style={{ marginBottom: 16 }}
            />
            <Card>
                <Calendar cellRender={dateCellRender} />
            </Card>
        </div>
    );
};
