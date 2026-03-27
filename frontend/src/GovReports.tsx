import React, { useState, useEffect } from 'react';
import { Card, Select, Button, Row, Col, Typography, Space, Table, message, Divider, Tag } from 'antd';
import { FileProtectOutlined, DownloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export const GovReports: React.FC = () => {
    const [month, setMonth] = useState(dayjs().month() + 1);
    const [year, setYear] = useState(dayjs().year());
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [tawiYear, setTawiYear] = useState(dayjs().year());

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:5000/api/employees');
            setEmployees(res.data);
        } catch (error) {
            message.error('ไม่สามารถดึงข้อมูลพนักงานได้');
        } finally {
            setLoading(false);
        }
    };

    const downloadPND1 = () => {
        window.open(`http://localhost:5000/api/reports/pnd1?month=${month}&year=${year}`, '_blank');
    };

    const downloadPND1Csv = () => {
        window.open(`http://localhost:5000/api/reports/pnd1-csv?month=${month}&year=${year}`, '_blank');
    };

    const downloadPND3Csv = () => {
        window.open(`http://localhost:5000/api/reports/pnd3-csv?month=${month}&year=${year}`, '_blank');
    };

    const downloadPND53Csv = () => {
        window.open(`http://localhost:5000/api/reports/pnd53-csv?month=${month}&year=${year}`, '_blank');
    };

    const downloadSSO = () => {
        window.open(`http://localhost:5000/api/reports/sso?month=${month}&year=${year}`, '_blank');
    };

    const download50Tawi = (empId: string) => {
        window.open(`http://localhost:5000/api/reports/50tawi/${empId}?year=${tawiYear}`, '_blank');
    };

    const months = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    const years = Array.from({ length: 5 }, (_, i) => dayjs().year() - i);

    return (
        <div style={{ padding: '24px' }}>
            <Title level={2}><FileProtectOutlined /> รายงานและเอกสารราชการ (Government Compliance)</Title>
            <Text type="secondary">ดาวน์โหลดรายงานที่ต้องยื่นต่อกรมสรรพากรและสำนักงานประกันสังคม</Text>

            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                <Col span={12}>
                    <Card title={<Space><DownloadOutlined /> รายงานรายเดือน (พ.ง.ด. 1 & สปส. 1-10)</Space>}>
                        <Space direction="vertical" style={{ width: '100%' }} size="large">
                            <Space>
                                <Select value={month} onChange={setMonth} style={{ width: 120 }}>
                                    {months.map((m, i) => (
                                        <Option key={i + 1} value={i + 1}>{m}</Option>
                                    ))}
                                </Select>
                                <Select value={year} onChange={setYear} style={{ width: 100 }}>
                                    {years.map(y => (
                                        <Option key={y} value={y}>{y + 543}</Option>
                                    ))}
                                </Select>
                            </Space>
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Button type="primary" block icon={<DownloadOutlined />} onClick={downloadPND1}>
                                        พ.ง.ด. 1 (Excel)
                                    </Button>
                                    <Text type="secondary" style={{ fontSize: 10 }}>ยื่นภาษี (Excel)</Text>
                                </Col>
                                <Col span={8}>
                                    <Button type="default" block icon={<DownloadOutlined />} onClick={downloadPND1Csv} style={{ borderColor: '#fa8c16', color: '#fa8c16' }}>
                                        พ.ง.ด. 1 (CSV)
                                    </Button>
                                    <Text type="secondary" style={{ fontSize: 10 }}>สำหรับ RdPrep</Text>
                                </Col>
                                <Col span={8}>
                                    <Button type="primary" block icon={<DownloadOutlined />} onClick={downloadSSO} style={{ backgroundColor: '#1890ff' }}>
                                        สปส. 1-10
                                    </Button>
                                    <Text type="secondary" style={{ fontSize: 10 }}>ยื่นประกันสังคม</Text>
                                </Col>
                            </Row>

                            <Row gutter={16} style={{ marginTop: 16 }}>
                                <Col span={8}>
                                    <Button type="default" block icon={<DownloadOutlined />} onClick={downloadPND3Csv} style={{ borderColor: '#eb2f96', color: '#eb2f96' }}>
                                        พ.ง.ด. 3 (CSV)
                                    </Button>
                                    <Text type="secondary" style={{ fontSize: 10 }}>สำหรับ RdPrep</Text>
                                </Col>
                                <Col span={8}>
                                    <Button type="default" block icon={<DownloadOutlined />} onClick={downloadPND53Csv} style={{ borderColor: '#722ed1', color: '#722ed1' }}>
                                        พ.ง.ด. 53 (CSV)
                                    </Button>
                                    <Text type="secondary" style={{ fontSize: 10 }}>สำหรับ RdPrep</Text>
                                </Col>
                            </Row>
                        </Space>
                    </Card>
                </Col>

                <Col span={12}>
                    <Card title={<Space><SafetyCertificateOutlined /> เอกสาร 50 ทวิ (รายปี)</Space>}>
                        <Text>เลือกปีถาษีที่ต้องการออกเอกสารรับรอง:</Text>
                        <Select value={tawiYear} onChange={setTawiYear} style={{ width: '100%', marginTop: 8 }}>
                            {years.map(y => (
                                <Option key={y} value={y}>{y + 543}</Option>
                            ))}
                        </Select>
                        <Divider />
                        <Text type="secondary">ค้นหาพนักงานในตารางด้านล่างเพื่อออกเอกสาร 50 ทวิ</Text>
                    </Card>
                </Col>
            </Row>

            <Card style={{ marginTop: 24 }} title="ออกใบรับรอง 50 ทวิ รายบุคคล">
                <Table
                    loading={loading}
                    dataSource={employees}
                    rowKey="id"
                    columns={[
                        { title: 'รหัส', dataIndex: 'employee_code', key: 'code' },
                        { title: 'ชื่อ-นามสกุล', dataIndex: 'name', key: 'name' },
                        { title: 'เลขประจำตัวประชาชน', dataIndex: 'id_number', key: 'id_no', render: (val) => val || <Tag color="error">ขาดข้อมูล</Tag> },
                        {
                            title: 'จัดการ',
                            key: 'action',
                            render: (_, record) => (
                                <Button 
                                    icon={<DownloadOutlined />} 
                                    disabled={!record.id_number}
                                    onClick={() => download50Tawi(record.id)}
                                >
                                    ดาวน์โหลด 50 ทวิ
                                </Button>
                            )
                        }
                    ]}
                />
            </Card>
        </div>
    );
};
