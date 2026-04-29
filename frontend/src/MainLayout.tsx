import React, { useState } from 'react';
import { Layout, Menu, Typography, Avatar, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
    DashboardOutlined,
    TeamOutlined,
    CalendarOutlined,
    DollarOutlined,
    SettingOutlined,
    ImportOutlined,
    UserOutlined,
    LogoutOutlined,
    MenuUnfoldOutlined,
    MenuFoldOutlined,
    HistoryOutlined,
    AuditOutlined,
    BarChartOutlined,
    FileProtectOutlined,
    ClockCircleOutlined, // Added ClockCircleOutlined
} from '@ant-design/icons';
import './MainLayout.css';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

interface MainLayoutProps {
    children: React.ReactNode;
    activeMenu: string;
    onMenuClick: (key: string) => void;
    onLogout?: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, activeMenu, onMenuClick, onLogout }) => {
    const [collapsed, setCollapsed] = useState(false);

    const menuItems = [
        { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard (หน้าแรก)' },
        { key: 'import', icon: <ImportOutlined />, label: 'นำเข้าข้อมูลเข้า-ออกงาน' },
        { key: 'employees', icon: <TeamOutlined />, label: 'จัดการพนักงาน' },
        { key: 'leave', icon: <CalendarOutlined />, label: 'อนุมัติการลา' },
        { key: 'hr-calendar', icon: <CalendarOutlined style={{ color: '#ff4d4f' }} />, label: 'ปฏิทินงาน HR' },
        { key: 'claims', icon: <AuditOutlined />, label: 'สวัสดิการและเบิกจ่าย' },
        { key: 'payroll', icon: <DollarOutlined />, label: 'จัดการเงินเดือน' },
        { key: 'payroll-history', icon: <HistoryOutlined />, label: 'ประวัติเงินเดือน' },
        { key: 'overtime', icon: <ClockCircleOutlined />, label: 'จัดการค่าล่วงเวลา (OT)' },
        { key: 'analytics', icon: <BarChartOutlined />, label: 'รายงานและวิเคราะห์' },
        { key: 'audit-logs', icon: <HistoryOutlined style={{ color: '#ff7a45' }} />, label: 'ประวัติการใช้งาน (Logs)' },
        { key: 'gov-reports', icon: <FileProtectOutlined />, label: 'รายงานรัฐบาล (Compliance)' },
        { key: 'settings', icon: <SettingOutlined />, label: 'ตั้งค่าระบบ' },
    ];

    const userMenu: MenuProps = {
        items: [
            { key: 'profile', icon: <UserOutlined />, label: 'โปรไฟล์ส่วนตัว' },
            { type: 'divider' },
            { key: 'logout', icon: <LogoutOutlined />, label: 'ออกจากระบบ', danger: true },
        ],
        onClick: (e) => {
            if (e.key === 'logout' && onLogout) {
                onLogout();
            }
        }
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                theme="dark"
                width={250}
                style={{
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                }}
            >
                <div className="sidebar-logo">
                    {!collapsed ? (
                        <Title level={4} style={{ color: 'white', margin: 0 }}>HR System</Title>
                    ) : (
                        <Title level={4} style={{ color: 'white', margin: 0, textAlign: 'center' }}>HR</Title>
                    )}
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[activeMenu]}
                    items={menuItems}
                    onClick={(e) => onMenuClick(e.key)}
                />
            </Sider>

            <Layout style={{ marginLeft: collapsed ? 80 : 250, transition: 'all 0.2s' }}>
                <Header
                    style={{
                        padding: '0 24px',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        width: '100%'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
                            className: 'trigger',
                            onClick: () => setCollapsed(!collapsed),
                            style: { fontSize: '18px', cursor: 'pointer', marginRight: '16px' }
                        })}
                        <Text strong style={{ fontSize: '16px' }}>HR Management System</Text>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <Dropdown menu={userMenu} placement="bottomRight" arrow>
                            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                                <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
                                <Text strong>Admin HR</Text>
                            </div>
                        </Dropdown>
                    </div>
                </Header>

                <Content style={{ margin: '24px 16px', overflow: 'initial' }}>
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
};
