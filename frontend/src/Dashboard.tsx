import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Typography, List, Avatar, Progress, Space, Button, message, Spin, Alert } from 'antd';
import {
    TeamOutlined,
    UserAddOutlined,
    UserDeleteOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    WarningOutlined,
    SettingOutlined,
    DollarOutlined
} from '@ant-design/icons';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar
} from 'recharts';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface DashboardProps {
    onNavigate?: (menu: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
    const [stats, setStats] = useState({
        totalEmployees: 0,
        newEmployees: 0,
        pendingLeaves: 0,
        resignedEmployees: 0
    });

    const [attendanceTrendData, setAttendanceTrendData] = useState<any[]>([]);
    const [departmentData, setDepartmentData] = useState<any[]>([]);
    const [payrollTrends, setPayrollTrends] = useState<any[]>([]);
    const [attendanceStats, setAttendanceStats] = useState({ frequentLates: 0, unpaidLeaves: 0 });
    const [todayAttendance, setTodayAttendance] = useState({ present: 0, leave: 0, absent: 0 });
    const [recentActivities, setRecentActivities] = useState<any[]>([]);
    const [adminAlerts, setAdminAlerts] = useState({ expiringContracts: [], expiringProbations: [], pendingClaimsCount: 0 });
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [mainRes, payrollRes, attRes, alertRes] = await Promise.all([
                axios.get('http://localhost:5000/api/dashboard/stats'),
                axios.get('http://localhost:5000/api/dashboard/payroll-trends'),
                axios.get('http://localhost:5000/api/dashboard/attendance-stats'),
                axios.get('http://localhost:5000/api/admin/alerts')
            ]);
            setStats(mainRes.data.stats);
            setAttendanceTrendData(mainRes.data.charts.attendanceTrendData);
            setDepartmentData(mainRes.data.charts.departmentData);
            setTodayAttendance(mainRes.data.todayAttendance || { present: 0, leave: 0, absent: 0 });
            setRecentActivities(mainRes.data.recentActivities || []);
            setPayrollTrends(payrollRes.data);
            setAttendanceStats(attRes.data);
            setAdminAlerts(alertRes.data);
        } catch (error) {
            console.error(error);
            message.error('ไม่สามารถโหลดข้อมูลสถิติได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const todayStr = dayjs().locale('th').format('D MMMM YYYY');

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>ภาพรวมระบบ HR</Title>
                    <Text type="secondary">ยินดีต้อนรับกลับเข้าสู่ระบบ, สรุปสถานะประจำวันที่ {todayStr}</Text>
                </div>
                <Space>
                    <Button icon={<DollarOutlined />} type="primary" onClick={() => onNavigate?.('payroll')}>จัดการเงินเดือน</Button>
                </Space>
            </div>

            {/* Top Stats Cards */}
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                    <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)' }} loading={loading}>
                        <Statistic
                            title="พนักงานทั้งหมด"
                            value={stats.totalEmployees}
                            prefix={<TeamOutlined />}
                            valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)' }} loading={loading}>
                        <Statistic
                            title="พนักงานเข้าใหม่ (เดือนนี้)"
                            value={stats.newEmployees}
                            prefix={<UserAddOutlined />}
                            valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)' }} loading={loading}>
                        <Statistic
                            title="รออนุมัติการลา"
                            value={stats.pendingLeaves}
                            prefix={<ClockCircleOutlined />}
                            valueStyle={{ color: '#faad14', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)' }} loading={loading}>
                        <Statistic
                            title="พนักงานลาออก (เดือนนี้)"
                            value={stats.resignedEmployees}
                            prefix={<UserDeleteOutlined />}
                            valueStyle={{ color: '#ff4d4f', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Admin Alerts Panel */}
            {(adminAlerts.expiringContracts.length > 0 || adminAlerts.expiringProbations.length > 0 || adminAlerts.pendingClaimsCount > 0) && (
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                    <Col span={24}>
                        <Card title={<Space><WarningOutlined style={{ color: '#faad14' }} /> สรุปแจ้งเตือนสำหรับ Admin (Action Required)</Space>} bordered={false} bodyStyle={{ padding: '12px 24px' }}>
                            <Row gutter={24}>
                                {adminAlerts.expiringContracts.length > 0 && (
                                    <Col span={8}>
                                        <Alert
                                            message="สัญญาจ้างที่กำลังจะหมดอายุ (30 วัน)"
                                            description={adminAlerts.expiringContracts.map((c: any) => (
                                                <div key={c.id}>• {c.name} ({dayjs(c.date).format('DD MMM')})</div>
                                            ))}
                                            type="error"
                                            showIcon
                                        />
                                    </Col>
                                )}
                                {adminAlerts.expiringProbations.length > 0 && (
                                    <Col span={8}>
                                        <Alert
                                            message="พนักงานที่กำลังจะครบช่วงทดลองงาน"
                                            description={adminAlerts.expiringProbations.map((p: any) => (
                                                <div key={p.id}>• {p.name} ({dayjs(p.date).format('DD MMM')})</div>
                                            ))}
                                            type="warning"
                                            showIcon
                                        />
                                    </Col>
                                )}
                                {adminAlerts.pendingClaimsCount > 0 && (
                                    <Col span={8}>
                                        <Alert
                                            message="พบคลิมรอดำเนินการ (Pending Claims)"
                                            description={`มีทั้งหมด ${adminAlerts.pendingClaimsCount} รายการที่รอ Admin ตรวจสอบ`}
                                            type="info"
                                            showIcon
                                            action={<Button size="small" type="default" href="/claims">ไปที่หน้าเบิกจ่าย</Button>}
                                        />
                                    </Col>
                                )}
                            </Row>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Charts Section */}
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} lg={12}>
                    <Card
                        title="แนวโน้มการมาทำงาน (ล่าสุด)"
                        bordered={false}
                        style={{ borderRadius: 8, height: '100%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                        loading={loading}
                    >
                        <div style={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={attendanceTrendData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="present" name="มาทำงาน" stroke="#52c41a" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey="leave" name="ลางาน" stroke="#faad14" strokeWidth={2} />
                                    <Line type="monotone" dataKey="absent" name="ขาดงาน" stroke="#ff4d4f" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card
                        title="สัดส่วนพนักงานแยกตามแผนก"
                        bordered={false}
                        style={{ borderRadius: 8, height: '100%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                        loading={loading}
                    >
                        <div style={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={departmentData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{ fill: '#f5f5f5' }} />
                                    <Bar dataKey="employees" name="จำนวน (คน)" fill="#1890ff" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Main Content Areas */}
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} lg={12}>
                    <Card
                        title="สถิติการมาทำงาน (วันนี้)"
                        bordered={false}
                        style={{ borderRadius: 8, height: '100%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                        loading={loading}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {(() => {
                                const total = stats.totalEmployees || 1; // avoid divide by zero
                                const pPresent = Math.round((todayAttendance.present / total) * 100);
                                const pLeave = Math.round((todayAttendance.leave / total) * 100);
                                const pAbsent = Math.round((todayAttendance.absent / total) * 100);
                                
                                return (
                                    <>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <Text strong>มาทำงาน ({todayAttendance.present} คน)</Text>
                                                <Text type="success">{pPresent}%</Text>
                                            </div>
                                            <Progress percent={pPresent} status="active" strokeColor="#52c41a" showInfo={false} />
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <Text strong>ลางาน ({todayAttendance.leave} คน)</Text>
                                                <Text type="warning">{pLeave}%</Text>
                                            </div>
                                            <Progress percent={pLeave} status="active" strokeColor="#faad14" showInfo={false} />
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <Text strong>ขาดงาน/ไม่พบข้อมูล ({todayAttendance.absent} คน)</Text>
                                                <Text type="danger">{pAbsent}%</Text>
                                            </div>
                                            <Progress percent={pAbsent} status="exception" strokeColor="#ff4d4f" showInfo={false} />
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        <div style={{ marginTop: 32, padding: 16, backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4 }}>
                            <Space align="start">
                                <WarningOutlined style={{ color: '#faad14', fontSize: 24, marginTop: 4 }} />
                                <div>
                                    <Text strong style={{ display: 'block' }}>พบพนักงานมาสายมากกว่า 3 ครั้งในเดือนนี้ (จำนวน {attendanceStats.frequentLates || 0} คน)</Text>
                                    <Text type="secondary" style={{ display: 'block' }}>มีพนักงานลางานโดยไม่รับค่าจ้าง จำนวน {attendanceStats.unpaidLeaves || 0} วันในเดือนนี้</Text>
                                    <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>กรุณาตรวจสอบรายงาน <a href="/import">ข้อมูลเข้า-ออกงาน</a> และ <a href="/payroll">บัญชีเงินเดือน</a> เพื่อดูรายละเอียด</Text>
                                </div>
                            </Space>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} lg={12}>
                    <Card
                        title="สรุปการจ่ายเงินเดือน (6 เดือนล่าสุด)"
                        bordered={false}
                        style={{ borderRadius: 8, height: '100%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                        loading={loading}
                    >
                        <div style={{ height: 350 }}>
                            {payrollTrends.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={payrollTrends.map(d => ({ ...d, monthName: dayjs(`${d.year}-${d.month}-01`).format('MMM YYYY') }))} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="monthName" axisLine={false} tickLine={false} />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tickFormatter={(value) => `฿${(value / 1000).toFixed(0)}k`} 
                                    />
                                    <Tooltip 
                                        cursor={{ fill: '#f5f5f5' }} 
                                        formatter={(value: any) => `฿ ${Number(value).toLocaleString()}`}
                                    />
                                    <Legend />
                                    <Bar dataKey="total_net" name="เงินเดือนสุทธิ" fill="#52c41a" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="total_base" name="เงินเดือนพื้นฐาน" fill="#1890ff" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="total_ot" name="ค่าล่วงเวลา (OT)" fill="#faad14" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                            ) : (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#999' }}>
                                    ยังไม่มีประวัติการจ่ายเงินเดือน
                                </div>
                            )}
                        </div>
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24}>
                    <Card
                        title="กิจกรรมล่าสุด"
                        bordered={false}
                        style={{ borderRadius: 8, height: '100%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                    >
                        <Spin spinning={loading}>
                            {recentActivities.length > 0 ? (
                            <List
                                itemLayout="horizontal"
                                dataSource={recentActivities}
                                renderItem={item => (
                                    <List.Item>
                                        <List.Item.Meta
                                            avatar={
                                                <Avatar
                                                    icon={
                                                        item.type === 'hire' ? <UserAddOutlined /> :
                                                            item.type === 'leave' ? <CheckCircleOutlined /> :
                                                                item.type === 'system' ? <SettingOutlined /> : <UserDeleteOutlined />
                                                    }
                                                    style={{
                                                        backgroundColor:
                                                            item.type === 'hire' ? '#52c41a' :
                                                                item.type === 'leave' ? '#1890ff' :
                                                                    item.type === 'system' ? '#faad14' : '#ff4d4f'
                                                    }}
                                                />
                                            }
                                            title={item.title}
                                            description={item.time}
                                        />
                                    </List.Item>
                                )}
                            />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>ไม่มีกิจกรรมล่าสุด</div>
                            )}
                        </Spin>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};
