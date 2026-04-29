import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);

  const onFinish = (values: any) => {
    setLoading(true);
    // Mock login delay
    setTimeout(() => {
      setLoading(false);
      // For demonstration purposes, any credentials work or specifically admin/admin
      if (values.username === 'admin' && values.password === 'admin123') {
        message.success('เข้าสู่ระบบสำเร็จ');
        onLogin();
      } else {
        message.error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    }, 1000);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      <Card
        style={{
          width: 400,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          borderRadius: 12
        }}
        bordered={false}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ margin: 0, color: '#1890ff', fontWeight: 600 }}>HR Lanto</Title>
          <Text type="secondary" style={{ fontSize: '16px' }}>ระบบบริหารทรัพยากรบุคคลและเงินเดือน</Text>
        </div>

        <Form
          name="login_form"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'กรุณากรอกชื่อผู้ใช้!' }]}
          >
            <Input prefix={<UserOutlined style={{ color: '#1890ff' }} />} placeholder="ชื่อผู้ใช้ (admin)" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'กรุณากรอกรหัสผ่าน!' }]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#1890ff' }} />} placeholder="รหัสผ่าน (admin)" />
          </Form.Item>

          <Form.Item style={{ marginTop: 32 }}>
            <Button type="primary" htmlType="submit" style={{ width: '100%', height: '48px', fontSize: '16px', borderRadius: '8px' }} loading={loading}>
              เข้าสู่ระบบ
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
