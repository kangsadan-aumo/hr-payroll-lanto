import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Button, Space, message, Table } from 'antd';
import { FilePdfOutlined, PieChartOutlined, LineChartOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const { Title, Text } = Typography;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export const Analytics: React.FC = () => {
    const [costData, setCostData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchCostSummary = async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:5000/api/analytics/cost-summary');
            setCostData(res.data);
        } catch (err) {
            message.error('ไม่สามารถดึงข้อมูลสรุปต้นทุนได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCostSummary();
    }, []);

    const generatePDF = async (reportName: string) => {
        const element = document.getElementById('analytics-content');
        if (!element) return;
        
        message.loading({ content: 'กำลังสร้าง PDF...', key: 'pdf' });
        
        try {
            const canvas = await html2canvas(element, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${reportName}_${new Date().toISOString().slice(0, 10)}.pdf`);
            message.success({ content: 'สร้าง PDF สำเร็จ', key: 'pdf' });
        } catch (err) {
            message.error({ content: 'ไม่สามารถสร้าง PDF ได้', key: 'pdf' });
        }
    };

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <Title level={2}>รายงานและวิเคราะห์ (Reporting & Analytics)</Title>
                <Space>
                    <Button icon={<FilePdfOutlined />} onClick={() => generatePDF('PND1_Report')}>ออกรายงาน พ.ง.ด. 1</Button>
                    <Button icon={<FilePdfOutlined />} onClick={() => generatePDF('SPS_Report')}>ออกรายงาน สปส. 1-10</Button>
                </Space>
            </div>

            <div id="analytics-content">
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <Card title={<Space><PieChartOutlined /> สัดส่วนต้นทุนแยกตามแผนก</Space>} bordered={false}>
                            <div style={{ height: 350 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={costData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="total_cost"
                                            nameKey="department"
                                        >
                                            {costData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: any) => `฿${Number(value).toLocaleString()}`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card title={<Space><LineChartOutlined /> องค์ประกอบต้นทุนแรงงาน</Space>} bordered={false}>
                            <div style={{ height: 350 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={costData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="department" />
                                        <YAxis tickFormatter={(val) => `฿${val / 1000}k`} />
                                        <Tooltip formatter={(value: any) => `฿${Number(value).toLocaleString()}`} />
                                        <Legend />
                                        <Bar dataKey="base_total" name="เงินเดือนพื้นฐาน" stackId="a" fill="#0088FE" />
                                        <Bar dataKey="ot_total" name="ค่าล่วงเวลา" stackId="a" fill="#00C49F" />
                                        <Bar dataKey="claims_total" name="สวัสดิการ/เบิกจ่าย" stackId="a" fill="#FFBB28" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>
                </Row>

                <Card style={{ marginTop: '24px' }} title="ตารางสรุปต้นทุนแรงงานรายเดือน">
                    <Table 
                        dataSource={costData} 
                        rowKey="department"
                        loading={loading}
                        pagination={false}
                        columns={[
                            { title: 'แผนก', dataIndex: 'department', key: 'department' },
                            { title: 'เงินเดือนพื้นฐาน', dataIndex: 'base_total', key: 'base_total', render: (val) => `฿${val.toLocaleString()}` },
                            { title: 'ค่าล่วงเวลา', dataIndex: 'ot_total', key: 'ot_total', render: (val) => `฿${val.toLocaleString()}` },
                            { title: 'สวัสดิการ/เบิกจ่าย', dataIndex: 'claims_total', key: 'claims_total', render: (val) => `฿${val.toLocaleString()}` },
                            { title: 'รวมต้นทุนทั้งหมด', dataIndex: 'total_cost', key: 'total_cost', render: (val) => <Text strong style={{ color: '#1890ff' }}>฿{val.toLocaleString()}</Text> },
                        ]}
                    />
                </Card>
            </div>
        </div>
    );
};
