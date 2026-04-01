import React, { useState, useEffect } from 'react';
import {
    Typography, Card, Table, Input, Button, Space, Tag, Avatar, Tooltip, Drawer,
    Form, Select, DatePicker, message, Popconfirm, Row, Col, Modal, Upload, Alert,
    Divider, Badge, Tabs, Spin
} from 'antd';
import type { TableProps } from 'antd';
import {
    SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined,
    CheckCircleOutlined, CloseCircleOutlined, ImportOutlined,
    DownloadOutlined, WarningOutlined, FileTextOutlined, ProfileOutlined,
    SecurityScanOutlined, UploadOutlined, FileExcelOutlined
} from '@ant-design/icons';
const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;
const { TabPane } = Tabs;
import dayjs from 'dayjs';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { API_BASE_URL as API, UPLOAD_BASE_URL as UPLOAD_URL } from './api';

const { Dragger } = Upload;

interface Employee {
    id: string;
    employee_code: string;
    title: string;
    first_name: string;
    middle_name: string;
    last_name: string;
    name: string;
    department: string;
    position: string;
    joinDate: string;
    status: 'active' | 'inactive';
    phone: string;
    email: string;
    baseSalary?: number;
    id_number?: string;
    shift_id?: number;
    shift_name?: string;
    tax_form?: string;
    branch_code?: string;
    address_building?: string;
    address_room?: string;
    address_floor?: string;
    address_village?: string;
    address_no?: string;
    address_moo?: string;
    address_soi?: string;
    address_yaek?: string;
    address_road?: string;
    address_subdistrict?: string;
    address_district?: string;
    address_province?: string;
    address_zipcode?: string;
    pnd3_income_type?: string;
    pnd3_tax_rate?: number;
    bank_name?: string;
    bank_account_number?: string;
}

interface CsvRow {
    _rowIndex: number;
    employee_code: string;
    first_name: string;
    last_name: string;
    department: string;
    position: string;
    email: string;
    phone: string;
    join_date: string;
    status: string;
    base_salary: string;
    id_number: string;
    bank_name?: string;
    bank_account_number?: string;
    _valid: boolean;
    _error?: string;
}

// ── Map CSV header → internal field ──
const CSV_HEADER_MAP: Record<string, string> = {
    'รหัสพนักงาน': 'employee_code',
    'คำนำหน้า': 'title',
    'ชื่อ': 'first_name',
    'ชื่อกลาง': 'middle_name',
    'นามสกุล': 'last_name',
    'แผนก': 'department',
    'สาขา': 'department',       // alias
    'ตำแหน่ง': 'position',
    'ประเภทพนักงาน': 'position', // alias
    'อีเมล': 'email',
    'เบอร์โทรศัพท์': 'phone',
    'วันที่เริ่มงาน': 'join_date',
    'สถานะ': 'status',
    'เงินเดือนพื้นฐาน': 'base_salary',
    // English fallbacks
    'employee_code': 'employee_code',
    'first_name': 'first_name',
    'last_name': 'last_name',
    'department': 'department',
    'position': 'position',
    'email': 'email',
    'phone': 'phone',
    'join_date': 'join_date',
    'status': 'status',
    'base_salary': 'base_salary',
    'เลขบัตรประชาชน': 'id_number',
    'id_number': 'id_number',
    'ธนาคาร': 'bank_name',
    'เลขที่บัญชี': 'bank_account_number',
};

const TEMPLATE_CSV = `รหัสพนักงาน,ชื่อ,นามสกุล,แผนก,ตำแหน่ง,อีเมล,เบอร์โทรศัพท์,วันที่เริ่มงาน,สถานะ,เงินเดือนพื้นฐาน,ธนาคาร,เลขที่บัญชี
EMP001,สมชาย,ใจกล้า,HR,HR Manager,somchai@company.com,0812345678,2024-01-01,ใช้งาน,25000,กสิกรไทย,123-4-56789-0
EMP002,สมหญิง,รักดี,IT Support,Developer,somying@company.com,0898765432,2024-03-15,ใช้งาน,30000,ไทยพาณิชย์,987-6-54321-0`;

export const Employees: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departmentsList, setDepartmentsList] = useState<any[]>([]);
    const [positionsList, setPositionsList] = useState<any[]>([]);
    const [shiftsList, setShiftsList] = useState<any[]>([]);
    const [searchText, setSearchText] = useState('');
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    // CSV import states
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
    const [importing, setImporting] = useState(false);

    // HR Admin States
    const [adminDrawerVisible, setAdminDrawerVisible] = useState(false);
    const [selectedEmployeeForAdmin, setSelectedEmployeeForAdmin] = useState<Employee | null>(null);
    const [documents, setDocuments] = useState<any[]>([]);
    const [disciplinaryRecords, setDisciplinaryRecords] = useState<any[]>([]);
    const [adminLoading, setAdminLoading] = useState(false);
    const [adminForm] = Form.useForm();
    const [disciplineForm] = Form.useForm();

    // Leave Quota states
    const [quotaModalOpen, setQuotaModalOpen] = useState(false);
    const [quotaEmployee, setQuotaEmployee] = useState<Employee | null>(null);
    const [leaveQuotas, setLeaveQuotas] = useState<any[]>([]);
    const [quotaForm] = Form.useForm();
    const [newDeptName, setNewDeptName] = useState('');
    const [newPositionName, setNewPositionName] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [empRes, depRes, shiftRes, posRes] = await Promise.all([
                axios.get(`${API}/employees`),
                axios.get(`${API}/departments`),
                axios.get(`${API}/shifts`),
                axios.get(`${API}/positions`),
            ]);
            setEmployees(empRes.data);
            setDepartmentsList(depRes.data);
            setShiftsList(shiftRes.data);
            setPositionsList(posRes.data);
        } catch {
            message.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);
    
    const handleAddDepartment = async (e?: any) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newDeptName.trim()) return;
        try {
            const res = await axios.post(`${API}/departments`, { name: newDeptName });
            const newDept = res.data;
            setDepartmentsList(prev => [...prev, newDept]);
            form.setFieldsValue({ department_id: newDept.id });
            setNewDeptName('');
            message.success('เพิ่มแผนกใหม่เรียบร้อยแล้ว');
        } catch (error) {
            message.error('ไม่สามารถเพิ่มแผนกได้');
        }
    };

    const handleDeleteDepartment = async (id: number, name: string) => {
        try {
            await axios.delete(`${API}/departments/${id}`);
            message.success(`ลบแผนก ${name} เรียบร้อยแล้ว`);
            setDepartmentsList(prev => prev.filter(d => d.id !== id));
            // If the deleted dept is currently selected in the form, reset it
            if (form.getFieldValue('department_id') === id) {
                form.setFieldsValue({ department_id: null });
            }
        } catch (error) {
            message.error('ไม่สามารถลบแผนกได้ (อาจมีการใช้ข้อมูลนี้อยู่ในระบบ)');
        }
    };

    const handleAddPosition = async (e?: any) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newPositionName.trim()) return;
        try {
            const res = await axios.post(`${API}/positions`, { name: newPositionName });
            const newPos = res.data;
            setPositionsList(prev => [...prev, newPos]);
            form.setFieldsValue({ position: newPos.name });
            setNewPositionName('');
            message.success('เพิ่มตำแหน่งใหม่เรียบร้อยแล้ว');
        } catch (error) {
            message.error('ไม่สามารถเพิ่มตำแหน่งได้');
        }
    };

    const handleDeletePosition = async (id: number, name: string) => {
        try {
            await axios.delete(`${API}/positions/${id}`);
            message.success(`ลบตำแหน่ง ${name} เรียบร้อยแล้ว`);
            setPositionsList(prev => prev.filter(p => p.id !== id));
            if (form.getFieldValue('position') === name) {
                form.setFieldsValue({ position: null });
            }
        } catch (error) {
            message.error('ไม่สามารถลบตำแหน่งได้');
        }
    };

    // ── File Parser (CSV/Excel) ──
    const handleFileParse = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = e.target?.result;
            let rows: any[] = [];
            
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                
                if (jsonData.length > 1) {
                    const headers = jsonData[0].map(h => String(h || '').trim());
                    rows = jsonData.slice(1).map((row, i) => {
                        const mapped: any = { _rowIndex: i + 2 };
                        headers.forEach((h, idx) => {
                            const field = CSV_HEADER_MAP[h];
                            if (field) mapped[field] = String(row[idx] || '').trim();
                        });
                        return mapped;
                    });
                }
            } else {
                // Papa Parse for CSV
                const result = Papa.parse(data as string, { header: true, skipEmptyLines: true });
                rows = result.data.map((raw: any, i: number) => {
                    const mapped: any = { _rowIndex: i + 2 };
                    Object.entries(raw).forEach(([key, val]) => {
                        const field = CSV_HEADER_MAP[key.trim()];
                        if (field) mapped[field] = String(val || '').trim();
                    });
                    return mapped;
                });
            }

            // Common normalization for both CSV and Excel
            const processedRows = rows.map((mapped) => {
                const statusRaw = (mapped.status || '').toLowerCase();
                if (statusRaw.includes('ใช้งาน') || statusRaw === 'active' || statusRaw === '1') {
                    mapped.status = 'active';
                } else if (statusRaw.includes('ลาออก') || statusRaw === 'inactive' || statusRaw === '0') {
                    mapped.status = 'inactive';
                } else {
                    mapped.status = 'active';
                }

                let error = '';
                if (!mapped.first_name) error = 'ไม่มีชื่อ';
                else if (!mapped.join_date) error = 'ไม่มีวันที่เริ่มงาน';
                else if (!dayjs(mapped.join_date).isValid()) error = `วันที่ไม่ถูกต้อง: ${mapped.join_date}`;

                return {
                    ...mapped,
                    _valid: !error,
                    _error: error,
                } as CsvRow;
            });

            setCsvRows(processedRows);
            if (processedRows.length > 0) {
                message.success(`อ่านไฟล์สำเร็จ: ${processedRows.length} รายการ`);
            } else {
                message.warning('ไม่พบข้อมูลที่ถูกต้องในไฟล์');
            }
        };

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file, 'UTF-8');
        }
        return false;
    };

    const handleExportExcel = () => {
        const exportData = employees.map(e => ({
            'รหัสพนักงาน': e.employee_code,
            'ชื่อ': e.name.split(' ')[0],
            'นามสกุล': e.name.split(' ').slice(1).join(' '),
            'แผนก': e.department,
            'ตำแหน่ง': e.position,
            'อีเมล': e.email,
            'เบอร์โทรศัพท์': e.phone,
            'วันที่เริ่มงาน': e.joinDate,
            'สถานะ': e.status === 'active' ? 'ใช้งาน' : 'ลาออก',
            'เงินเดือน': e.baseSalary,
            'เลขบัตรประชาชน': e.id_number,
            'ธนาคาร': e.bank_name,
            'เลขที่บัญชี': e.bank_account_number
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
        XLSX.writeFile(workbook, `Employee_Data_${dayjs().format('YYYY-MM-DD')}.xlsx`);
        message.success('Export Excel สำเร็จ');
    };

    const handleImportConfirm = async () => {
        const validRows = csvRows.filter(r => r._valid);
        if (validRows.length === 0) {
            message.error('ไม่มีข้อมูลที่ถูกต้องสำหรับ import');
            return;
        }
        setImporting(true);
        try {
            const payload = validRows.map(r => ({
                employee_code: r.employee_code || '',
                first_name: r.first_name,
                last_name: r.last_name || '',
                department: r.department || '',
                position: r.position || '',
                email: r.email || null,
                phone: r.phone || null,
                join_date: dayjs(r.join_date).format('YYYY-MM-DD'),
                status: r.status || 'active',
                base_salary: parseFloat(r.base_salary) || 0,
                id_number: r.id_number || null,
                bank_name: r.bank_name || null,
                bank_account_number: r.bank_account_number || null,
            }));
            const res = await axios.post(`${API}/employees/import`, { employees: payload });
            message.success(`นำเข้าสำเร็จ: เพิ่มใหม่ ${res.data.created} คน, อัปเดต ${res.data.updated} คน`);
            if (res.data.errors?.length > 0) {
                message.warning(`มีข้อผิดพลาด ${res.data.errors.length} รายการ`);
            }
            setImportModalOpen(false);
            setCsvRows([]);
            fetchData();
        } catch (error: any) {
            message.error(error?.response?.data?.error || 'Import ไม่สำเร็จ');
        } finally {
            setImporting(false);
        }
    };

    const handleDownloadTemplate = () => {
        const blob = new Blob(['\uFEFF' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'employee_import_template.csv';
        link.click();
        URL.revokeObjectURL(url);
        message.success('ดาวน์โหลด Template CSV สำเร็จ');
    };


    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchText.toLowerCase()) ||
        emp.id.includes(searchText) ||
        (emp.employee_code && emp.employee_code.includes(searchText)) ||
        emp.department.toLowerCase().includes(searchText.toLowerCase())
    );

    const departments = Array.from(new Set(employees.map(e => e.department)));

    const showDrawer = (record?: Employee) => {
        if (record) {
            setEditingEmployee(record);
            const dep = departmentsList.find(d => d.name === record.department);
            form.setFieldsValue({ 
                ...record, 
                department_id: dep ? dep.id : null, 
                shift_id: record.shift_id,
                joinDate: dayjs(record.joinDate) 
            });
        } else {
            setEditingEmployee(null);
            form.resetFields();
        }
        setDrawerVisible(true);
    };

    const closeDrawer = () => { setDrawerVisible(false); form.resetFields(); };

    const handleSave = async (values: any) => {
        const payload = {
            ...values,
            join_date: values.joinDate.format('YYYY-MM-DD'),
            shift_id: values.shift_id || null,
            base_salary: values.baseSalary || 0,
            id_number: values.id_number || null,
            bank_name: values.bank_name || null,
            bank_account_number: values.bank_account_number || null,
        };
        try {
            if (editingEmployee) {
                await axios.put(`${API}/employees/${editingEmployee.id}`, payload);
                message.success('อัปเดตข้อมูลพนักงานสำเร็จ');
            } else {
                await axios.post(`${API}/employees`, payload);
                message.success('เพิ่มพนักงานใหม่สำเร็จ');
            }
            closeDrawer();
            fetchData();
        } catch (error: any) {
            message.error(error.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        try {
            await axios.delete(`${API}/employees/${id}`);
            message.success(`ลบข้อมูล ${name} เรียบร้อยแล้ว`);
            fetchData();
        } catch {
            message.error('เกิดข้อผิดพลาดในการลบข้อมูล');
        }
    };

    const openLeaveQuotaModal = async (record: Employee) => {
        setQuotaEmployee(record);
        try {
            const res = await axios.get(`${API}/employees/${record.id}/leave-quotas`);
            setLeaveQuotas(res.data);
            const formValues: any = {};
            res.data.forEach((q: any) => {
                formValues[`quota_${q.leave_type_id}`] = q.quota_days;
            });
            quotaForm.setFieldsValue(formValues);
            setQuotaModalOpen(true);
        } catch (error) {
            message.error('ไม่สามารถดึงข้อมูลโควตาวันลาได้');
        }
    };

    const handleSaveLeaveQuotas = async (values: any) => {
        if (!quotaEmployee) return;
        try {
            const quotasPayload = leaveQuotas.map(q => ({
                leave_type_id: q.leave_type_id,
                quota_days: values[`quota_${q.leave_type_id}`]
            }));
            await axios.put(`${API}/employees/${quotaEmployee.id}/leave-quotas`, { quotas: quotasPayload });
            message.success('บันทึกโควตาวันลาสำเร็จ');
            setQuotaModalOpen(false);
        } catch (error) {
            message.error('เกิดข้อผิดพลาดในการบันทึกโควตาวันลา');
        }
    };

    // ── CSV preview columns ──
    const validCount = csvRows.filter(r => r._valid).length;
    const errorCount = csvRows.filter(r => !r._valid).length;

    const csvPreviewColumns: TableProps<CsvRow>['columns'] = [
        { title: 'แถว', dataIndex: '_rowIndex', key: '_rowIndex', width: 60 },
        {
            title: 'สถานะ', key: '_valid', width: 90,
            render: (_, r) => r._valid
                ? <Tag color="success">ถูกต้อง</Tag>
                : <Tag color="error" icon={<WarningOutlined />}>{r._error}</Tag>
        },
        { title: 'รหัส', dataIndex: 'employee_code', key: 'employee_code', width: 90 },
        {
            title: 'ชื่อ-สกุล', key: 'fullname',
            render: (_, r) => `${r.first_name || ''} ${r.last_name || ''}`.trim()
        },
        { title: 'แผนก', dataIndex: 'department', key: 'department' },
        { title: 'ตำแหน่ง', dataIndex: 'position', key: 'position' },
        { title: 'อีเมล', dataIndex: 'email', key: 'email' },
        { title: 'เบอร์ติดต่อ', dataIndex: 'phone', key: 'phone' },
        { title: 'วันที่เริ่มงาน', dataIndex: 'join_date', key: 'join_date', width: 120 },
        {
            title: 'สถานะงาน', dataIndex: 'status', key: 'status', width: 100,
            render: (s) => s === 'active' ? <Tag color="green">ใช้งาน</Tag> : <Tag>ลาออก</Tag>
        },
    ];

    // ── Main table columns ──
    const columns: TableProps<Employee>['columns'] = [
        { title: 'รหัสพนักงาน', dataIndex: 'employee_code', key: 'employee_code', width: 120, sorter: (a, b) => (a.employee_code || '').localeCompare(b.employee_code || '') },
        {
            title: 'ชื่อ-นามสกุล', key: 'name',
            render: (_, record) => (
                <Space>
                    <Avatar icon={<UserOutlined />} style={{ backgroundColor: record.status === 'active' ? '#1890ff' : '#d9d9d9' }} />
                    <div>
                        <div style={{ fontWeight: 500 }}>{record.name}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{record.email} • {record.phone || 'ไม่มีเบอร์โทร'}</div>
                    </div>
                </Space>
            ),
            sorter: (a, b) => a.name.localeCompare(b.name)
        },
        {
            title: 'แผนก', dataIndex: 'department', key: 'department',
            filters: departments.map(d => ({ text: String(d), value: String(d) })),
            onFilter: (value, record) => record.department === value,
        },
        { title: 'ตำแหน่ง', dataIndex: 'position', key: 'position' },
        {
            title: 'วันที่เริ่มงาน', dataIndex: 'joinDate', key: 'joinDate',
            render: (date: string) => dayjs(date).format('DD MMM YYYY'),
            sorter: (a, b) => dayjs(a.joinDate).unix() - dayjs(b.joinDate).unix()
        },
        { 
            title: 'กะทำงาน', key: 'shift', 
            render: (_, r) => <Tag color="blue">{r.shift_name || 'ไม่ได้ระบุ'}</Tag>
        },
        {
            title: 'สถานะ', key: 'status',
            filters: [{ text: 'พนักงานปัจจุบัน', value: 'active' }, { text: 'ลาออก', value: 'inactive' }],
            onFilter: (value, record) => record.status === value,
            render: (_, record) => record.status === 'active'
                ? <Tag color="success" icon={<CheckCircleOutlined />}>ทำงานอยู่</Tag>
                : <Tag color="default" icon={<CloseCircleOutlined />}>ลาออก</Tag>
        },
        {
            title: 'จัดการ', key: 'action', align: 'center',
            render: (_, record) => (
                <Space size="middle">
                    <Tooltip title="ตั้งค่าวันลา">
                        <Button type="text" icon={<ProfileOutlined style={{ color: '#eb2f96' }} />} onClick={() => openLeaveQuotaModal(record)} />
                    </Tooltip>
                    <Tooltip title="แก้ไขข้อมูล">
                        <Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => showDrawer(record)} />
                    </Tooltip>
                    <Tooltip title="Admin Professional Tools">
                        <Button type="text" icon={<SecurityScanOutlined style={{ color: '#faad14' }} />} onClick={() => openAdminDrawer(record)} />
                    </Tooltip>
                    <Popconfirm
                        title="ยืนยันการลบข้อมูล"
                        description={`คุณต้องการลบข้อมูลของ ${record.name} หรือไม่?`}
                        onConfirm={() => handleDelete(record.id, record.name)}
                        okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
                    >
                        <Tooltip title="ลบข้อมูล">
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const openAdminDrawer = (record: any) => {
        setSelectedEmployeeForAdmin(record);
        adminForm.setFieldsValue({
            probation_end_date: record.probation_end_date ? dayjs(record.probation_end_date) : null,
            contract_end_date: record.contract_end_date ? dayjs(record.contract_end_date) : null,
            notes: record.notes
        });
        fetchAdminData(record.id);
        setAdminDrawerVisible(true);
    };

    const fetchAdminData = async (empId: string) => {
        setAdminLoading(true);
        try {
            const [docRes, discRes] = await Promise.all([
                axios.get(`${API}/employees/${empId}/documents`),
                axios.get(`${API}/employees/${empId}/disciplinary`)
            ]);
            setDocuments(docRes.data);
            setDisciplinaryRecords(discRes.data);
        } catch (error) {
            console.error(error);
        } finally {
            setAdminLoading(false);
        }
    };

    const handleAdminSave = async (values: any) => {
        try {
            await axios.put(`${API}/employees/${selectedEmployeeForAdmin?.id}/admin`, {
                ...values,
                probation_end_date: values.probation_end_date?.format('YYYY-MM-DD'),
                contract_end_date: values.contract_end_date?.format('YYYY-MM-DD'),
            });
            message.success('อัปเดตข้อมูลแอดมินสำเร็จ');
            fetchData();
        } catch (error) {
            message.error('บันทึกข้อมูลไม่สำเร็จ');
        }
    };

    const handleUpload = async (options: any) => {
        const { file } = options;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'เอกสารสำคัญ');
        try {
            await axios.post(`${API}/employees/${selectedEmployeeForAdmin?.id}/documents`, formData);
            message.success('อัปโหลดไฟล์สำเร็จ');
            fetchAdminData(selectedEmployeeForAdmin!.id);
        } catch (error) {
            message.error('อัปโหลดไฟล์ไม่สำเร็จ');
        }
    };

    const handleDeleteDoc = async (id: number) => {
        try {
            await axios.delete(`${API}/documents/${id}`);
            message.success('ลบเอกสารสำเร็จ');
            fetchAdminData(selectedEmployeeForAdmin!.id);
        } catch (error) {
            message.error('ลบไม่สำเร็จ');
        }
    };

    const handleAddDisciplinary = async (values: any) => {
        try {
            await axios.post(`${API}/employees/${selectedEmployeeForAdmin?.id}/disciplinary`, {
                ...values,
                issued_at: values.issued_at.format('YYYY-MM-DD')
            });
            message.success('บันทึกวินัยสำเร็จ');
            disciplineForm.resetFields();
            fetchAdminData(selectedEmployeeForAdmin!.id);
        } catch (error) {
            message.error('บันทึกวินัยไม่สำเร็จ');
        }
    };

    return (
        <div>
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>จัดการข้อมูลพนักงาน (Employees)</Title>
                    <Text type="secondary">เพิ่ม ลบ แก้ไข นำเข้า และค้นหาข้อมูลบุคลากรในองค์กร</Text>
                </div>
                <Space wrap>
                    <Tooltip title="ดาวน์โหลดตัวอย่างไฟล์ CSV">
                        <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>Template CSV</Button>
                    </Tooltip>
                    <Button icon={<FileExcelOutlined />} style={{ color: '#52c41a', borderColor: '#52c41a' }} onClick={handleExportExcel}>Export Excel</Button>
                    <Button
                        icon={<ImportOutlined />}
                        onClick={() => { setCsvRows([]); setImportModalOpen(true); }}
                        style={{ background: '#722ed1', borderColor: '#722ed1', color: '#fff' }}
                    >
                        Import File (Excel/CSV)
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => showDrawer()}>เพิ่มพนักงานใหม่</Button>
                </Space>
            </div>

            {/* ── Table ── */}
            <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Input
                        placeholder="ค้นหาพนักงาน: รหัส, ชื่อ หรือแผนก..."
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                        style={{ width: 300, borderRadius: 6 }}
                        value={searchText} onChange={e => setSearchText(e.target.value)} allowClear
                    />
                    <Text type="secondary">พนักงานทั้งหมด {filteredEmployees.length} คน</Text>
                </div>
                <Table
                    columns={columns} dataSource={filteredEmployees} rowKey="id"
                    loading={loading} pagination={{ pageSize: 15 }} scroll={{ x: 1000 }} bordered
                />
            </Card>

            {/* ── CSV IMPORT MODAL ── */}
            <Modal
                title={<Space><ImportOutlined /><span>นำเข้าพนักงานจากไฟล์ CSV</span></Space>}
                open={importModalOpen}
                onCancel={() => { setImportModalOpen(false); setCsvRows([]); }}
                width={900}
                footer={
                    csvRows.length > 0 ? (
                        <Space>
                            <Button onClick={() => setCsvRows([])}>เลือกไฟล์ใหม่</Button>
                            <Button
                                type="primary" loading={importing}
                                disabled={validCount === 0}
                                onClick={handleImportConfirm}
                                icon={<CheckCircleOutlined />}
                            >
                                นำเข้า {validCount} รายการที่ถูกต้อง
                            </Button>
                        </Space>
                    ) : (
                        <Button onClick={() => { setImportModalOpen(false); setCsvRows([]); }}>ปิด</Button>
                    )
                }
            >
                {csvRows.length === 0 ? (
                    <div>
                        {/* Upload Zone */}
                        <Dragger
                            accept=".csv, .xlsx, .xls"
                            showUploadList={false}
                            beforeUpload={handleFileParse}
                            style={{ marginBottom: 16 }}
                        >
                            <p className="ant-upload-drag-icon"><FileTextOutlined style={{ fontSize: 48, color: '#1890ff' }} /></p>
                            <p className="ant-upload-text">คลิกหรือลากไฟล์ CSV มาที่นี่</p>
                            <p className="ant-upload-hint">รองรับไฟล์ .csv ทั้งภาษาไทยและอังกฤษ (UTF-8)</p>
                        </Dragger>

                        {/* Column guide */}
                        <Divider>รูปแบบ CSV ที่รองรับ</Divider>
                        <Alert
                            type="info" showIcon
                            message="Column ที่รองรับ (ทั้งภาษาไทยและอังกฤษ)"
                            description={
                                <div style={{ marginTop: 8 }}>
                                    <Row gutter={[8, 4]}>
                                        {[
                                            ['รหัสพนักงาน', 'employee_code', 'ไม่บังคับ — สร้างอัตโนมัติถ้าว่าง'],
                                            ['ชื่อ', 'first_name', 'จำเป็น'],
                                            ['นามสกุล', 'last_name', 'ไม่บังคับ'],
                                            ['แผนก / สาขา', 'department', 'สร้างแผนกใหม่อัตโนมัติ'],
                                            ['ตำแหน่ง / ประเภทพนักงาน', 'position', ''],
                                            ['อีเมล', 'email', ''],
                                            ['เบอร์โทรศัพท์', 'phone', ''],
                                            ['วันที่เริ่มงาน', 'join_date', 'จำเป็น — รูปแบบ YYYY-MM-DD'],
                                            ['สถานะ', 'status', 'ใช้งาน / ลาออก (default: ใช้งาน)'],
                                            ['เงินเดือนพื้นฐาน', 'base_salary', 'ตัวเลขเท่านั้น'],
                                        ].map(([th, en, note]) => (
                                            <Col span={12} key={en}>
                                                <Text><Tag color="blue">{th}</Tag> <Text type="secondary" style={{ fontSize: 11 }}>{note}</Text></Text>
                                            </Col>
                                        ))}
                                    </Row>
                                </div>
                            }
                        />
                        <div style={{ marginTop: 12, textAlign: 'right' }}>
                            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate} size="small">
                                ดาวน์โหลด Template CSV
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {/* Summary */}
                        <Space style={{ marginBottom: 16 }}>
                            <Badge count={validCount} color="green" overflowCount={9999}>
                                <Tag color="success" style={{ fontSize: 14, padding: '4px 12px' }}>✅ ถูกต้อง</Tag>
                            </Badge>
                            {errorCount > 0 && (
                                <Badge count={errorCount} color="red" overflowCount={9999}>
                                    <Tag color="error" style={{ fontSize: 14, padding: '4px 12px' }}>❌ มีข้อผิดพลาด</Tag>
                                </Badge>
                            )}
                            <Text type="secondary">รวม {csvRows.length} รายการ</Text>
                        </Space>

                        {errorCount > 0 && (
                            <Alert
                                type="warning" showIcon style={{ marginBottom: 12 }}
                                message={`มี ${errorCount} รายการที่ไม่ถูกต้อง — จะนำเข้าเฉพาะ ${validCount} รายการที่ถูกต้องเท่านั้น`}
                            />
                        )}

                        <Table
                            dataSource={csvRows} columns={csvPreviewColumns}
                            rowKey="_rowIndex" size="small" scroll={{ x: 700 }}
                            pagination={{ pageSize: 10 }}
                            rowClassName={r => !r._valid ? 'ant-table-row-error' : ''}
                        />
                    </div>
                )}
            </Modal>

            {/* ── Add / Edit Drawer ── */}
            <Drawer
                title={editingEmployee ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
                width={520} onClose={closeDrawer} open={drawerVisible}
                extra={
                    <Space>
                        <Button onClick={closeDrawer}>ยกเลิก</Button>
                        <Button onClick={() => form.submit()} type="primary">
                            {editingEmployee ? 'บันทึกข้อมูล' : 'สร้างรายชื่อ'}
                        </Button>
                    </Space>
                }
            >
                <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ status: 'active', title: 'นาย', tax_form: 'pnd1', branch_code: '00000', pnd3_income_type: '40(2)', pnd3_tax_rate: 3.00 }}>
                    <Tabs defaultActiveKey="basic">
                        <TabPane tab="ข้อมูลทั่วไป" key="basic">
                            <Row gutter={16}>
                                <Col span={6}>
                                    <Form.Item name="title" label="คำนำหน้า" rules={[{ required: true }]}>
                                        <Select>
                                            <Option value="นาย">นาย</Option>
                                            <Option value="นาง">นาง</Option>
                                            <Option value="นางสาว">นางสาว</Option>
                                            <Option value="อื่น ๆ">อื่น ๆ</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={18}>
                                    <Form.Item name="first_name" label="ชื่อ" rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}>
                                        <Input placeholder="เช่น สมชาย" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="middle_name" label="ชื่อกลาง">
                                        <Input placeholder="(ถ้ามี)" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="last_name" label="นามสกุล" rules={[{ required: true, message: 'กรุณากรอกนามสกุล' }]}>
                                        <Input placeholder="เช่น ใจกล้า" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item 
                                        name="employee_code" 
                                        label="รหัสพนักงาน (5 หลัก)" 
                                        rules={[
                                            { required: true, message: 'กรุณากรอกรหัสพนักงาน' },
                                            { len: 5, message: 'รหัสพนักงานต้องมี 5 หลัก' }
                                        ]}
                                    >
                                        <Input placeholder="เช่น 00001" maxLength={5} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="joinDate" label="วันที่เริ่มปฏิบัติงาน" rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}>
                                        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="department_id" label="แผนก" rules={[{ required: true, message: 'กรุณาเลือกแผนก' }]}>
                                        <Select 
                                            placeholder="เลือกแผนก"
                                            showSearch
                                            optionFilterProp="children"
                                            dropdownRender={(menu) => (
                                                <>
                                                    {menu}
                                                    <Divider style={{ margin: '8px 0' }} />
                                                    <Space style={{ padding: '0 8px 4px' }}>
                                                        <Input
                                                            placeholder="เพิ่มแผนกใหม่"
                                                            value={newDeptName}
                                                            onChange={(e) => setNewDeptName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleAddDepartment(e);
                                                            }}
                                                        />
                                                        <Button type="text" icon={<PlusOutlined />} onClick={handleAddDepartment}>
                                                            เพิ่ม
                                                        </Button>
                                                    </Space>
                                                </>
                                            )}
                                        >
                                            {departmentsList.map(d => (
                                                <Option key={d.id} value={d.id}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span>{d.name}</span>
                                                        <DeleteOutlined 
                                                            style={{ color: '#ff4d4f', fontSize: '12px' }} 
                                                            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                                            onClick={() => handleDeleteDepartment(d.id, d.name)}
                                                        />
                                                    </div>
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="position" label="ตำแหน่ง" rules={[{ required: true, message: 'กรุณาเลือกตำแหน่ง' }]}>
                                        <Select 
                                            placeholder="เลือกตำแหน่ง"
                                            showSearch
                                            optionFilterProp="children"
                                            dropdownRender={(menu) => (
                                                <>
                                                    {menu}
                                                    <Divider style={{ margin: '8px 0' }} />
                                                    <Space style={{ padding: '0 8px 4px' }}>
                                                        <Input
                                                            placeholder="เพิ่มตำแหน่งใหม่"
                                                            value={newPositionName}
                                                            onChange={(e) => setNewPositionName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleAddPosition(e);
                                                            }}
                                                        />
                                                        <Button type="text" icon={<PlusOutlined />} onClick={handleAddPosition}>
                                                            เพิ่ม
                                                        </Button>
                                                    </Space>
                                                </>
                                            )}
                                        >
                                            {positionsList.map(p => (
                                                <Option key={p.id} value={p.name}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span>{p.name}</span>
                                                        <DeleteOutlined 
                                                            style={{ color: '#ff4d4f', fontSize: '12px' }} 
                                                            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                                            onClick={() => handleDeletePosition(p.id, p.name)}
                                                        />
                                                    </div>
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="phone" label="เบอร์โทรศัพท์">
                                        <Input placeholder="08x-xxx-xxxx" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="email" label="อีเมล">
                                        <Input placeholder="email@company.com" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="baseSalary" label="เงินเดือนพื้นฐาน (บาท)">
                                        <Input type="number" placeholder="เช่น 25000" prefix="฿" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="id_number" label="เลขประจำตัวประชาชน (13 หลัก)" rules={[{ len: 13, message: 'เลขบัตรประชาชนต้องมี 13 หลัก' }]}>
                                        <Input placeholder="1xxxxxxxxxxxx" maxLength={13} />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="shift_id" label="กะการทำงาน (Shift)">
                                        <Select placeholder="เลือกกะการทำงาน">
                                            <Option value={null}>-- ไม่กำหนด --</Option>
                                            {shiftsList.map(s => <Option key={s.id} value={s.id}>{s.shiftName} ({s.startTime}-{s.endTime})</Option>)}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="status" label="สถานะการทำงาน" rules={[{ required: true }]}>
                                        <Select>
                                            <Option value="active">ทำงานอยู่ (Active)</Option>
                                            <Option value="inactive">ลาออก (Inactive)</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>
                        </TabPane>
                        <TabPane tab="ที่อยู่ (Address)" key="address">
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="address_building" label="อาคาร/ตึก">
                                        <Input placeholder="เช่น อาคารไทย" />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item name="address_room" label="ห้อง">
                                        <Input placeholder="เช่น 401" />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item name="address_floor" label="ชั้น">
                                        <Input placeholder="เช่น 4" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={14}>
                                    <Form.Item name="address_village" label="หมู่บ้าน">
                                        <Input placeholder="เช่น รัตนาธิเบศร์" />
                                    </Form.Item>
                                </Col>
                                <Col span={10}>
                                    <Form.Item name="address_no" label="เลขที่บ้าน">
                                        <Input placeholder="เช่น 99/99" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={6}>
                                    <Form.Item name="address_moo" label="หมู่ที่">
                                        <Input placeholder="เช่น 1" />
                                    </Form.Item>
                                </Col>
                                <Col span={18}>
                                    <Form.Item name="address_soi" label="ตรอก/ซอย">
                                        <Input placeholder="เช่น รามอินทรา 14" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="address_yaek" label="แยก">
                                        <Input placeholder="เช่น - " />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="address_road" label="ถนน">
                                        <Input placeholder="เช่น สุขุมวิท" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="address_subdistrict" label="ตำบล/แขวง">
                                        <Input placeholder="เช่น ทุ่งครุ" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="address_district" label="อำเภอ/เขต">
                                        <Input placeholder="เช่น ทุ่งครุ" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="address_province" label="จังหวัด">
                                        <Input placeholder="เช่น กรุงเทพฯ" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="address_zipcode" label="รหัสไปรษณีย์">
                                        <Input placeholder="10140" maxLength={5} />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </TabPane>
                        <TabPane tab="ข้อมูลภาษี (Tax)" key="tax">
                            <Form.Item name="tax_form" label="ประเภทรายงานภาษี" rules={[{ required: true }]}>
                                <Select>
                                    <Option value="pnd1">พ.ง.ด. 1 (เงินเดือนพนักงานปกติ)</Option>
                                    <Option value="pnd3">พ.ง.ด. 3 (จ้างบริการ/บุคคลภายนอก)</Option>
                                    <Option value="pnd53">พ.ง.ด. 53 (นิติบุคคลข/บริษัท)</Option>
                                </Select>
                            </Form.Item>
                            <Form.Item name="branch_code" label="เลขที่สาขา (Branch Code)">
                                <Input placeholder="เช่น 00000" maxLength={5} />
                            </Form.Item>
                            
                            {/* Option for PND3/PND53 specifically */}
                            <Form.Item shouldUpdate={(prev, curr) => prev.tax_form !== curr.tax_form}>
                                {({ getFieldValue }) => (getFieldValue('tax_form') === 'pnd3' || getFieldValue('tax_form') === 'pnd53') ? (
                                    <Alert
                                        message={`การตั้งค่าสำหรับ ${getFieldValue('tax_form').toUpperCase()}`}
                                        description={
                                            <Row gutter={16} style={{ marginTop: 12 }}>
                                                <Col span={12}>
                                                    <Form.Item name="pnd3_income_type" label="ประเภทเงินได้">
                                                        <Select>
                                                            <Option value="40(2)">40(2) จ้างงาน/บริการ</Option>
                                                            <Option value="40(3)">40(3) ค่าลิขสิทธิ์</Option>
                                                            <Option value="40(8)">40(8) อื่นๆ</Option>
                                                            <Option value="ค่าบริการ">ค่าบริการ</Option>
                                                            <Option value="ค่าเช่า">ค่าเช่า</Option>
                                                            <Option value="ค่าวิชาชีพอิสระ">ค่าวิชาชีพอิสระ</Option>
                                                            <Option value="ค่าโฆษณา">ค่าโฆษณา (2%)</Option>
                                                            <Option value="ค่าขนส่ง">ค่าขนส่ง (1%)</Option>
                                                        </Select>
                                                    </Form.Item>
                                                </Col>
                                                <Col span={12}>
                                                    <Form.Item name="pnd3_tax_rate" label="อัตราภาษี (%)">
                                                        <Select>
                                                            <Option value={1.00}>1%</Option>
                                                            <Option value={2.00}>2%</Option>
                                                            <Option value={3.00}>3%</Option>
                                                            <Option value={5.00}>5%</Option>
                                                            <Option value={0.00}>ไม่หัก</Option>
                                                        </Select>
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                        }
                                        type="info"
                                        showIcon
                                    />
                                ) : null}
                            </Form.Item>
                            
                            <Divider orientation={"left" as any}>ข้อมูลธนาคาร</Divider>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="bank_name" label="ธนาคาร">
                                        <Select placeholder="เลือกธนาคาร">
                                            <Option value="กสิกรไทย">กสิกรไทย (K-Bank)</Option>
                                            <Option value="ไทยพาณิชย์">ไทยพาณิชย์ (SCB)</Option>
                                            <Option value="กรุงเทพ">กรุงเทพ (BBL)</Option>
                                            <Option value="กรุงไทย">กรุงไทย (KTB)</Option>
                                            <Option value="กรุงศรีอยุธยา">กรุงศรีอยุธยา (BAY)</Option>
                                            <Option value="ทีทีบี">ทีทีบี (ttb)</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="bank_account_number" label="เลขที่บัญชี">
                                        <Input placeholder="เช่น 123-4-56789-0" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </TabPane>
                    </Tabs>
                </Form>
            </Drawer>

            {/* ── Admin Professional Drawer ── */}
            <Drawer
                title={<Space><SecurityScanOutlined /> Admin Professional View: {selectedEmployeeForAdmin?.name}</Space>}
                width={700}
                onClose={() => setAdminDrawerVisible(false)}
                open={adminDrawerVisible}
            >
                <Spin spinning={adminLoading}>
                    <Tabs defaultActiveKey="1">
                    <TabPane tab="สถานะสัญญา & บันทึก" key="1">
                        <Form form={adminForm} layout="vertical" onFinish={handleAdminSave}>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="probation_end_date" label="วันสิ้นสุดช่วงทดลองงาน (Probation End)">
                                        <DatePicker style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="contract_end_date" label="วันสิ้นสุดสัญญาจ้าง (Contract End)">
                                        <DatePicker style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item name="notes" label="บันทึกแอดมินส่วนตัว (Private Admin Notes)">
                                <TextArea rows={6} placeholder="ระบุรายละเอียดเพิ่มเติมเกี่ยวกับพนักงานคนนี้ (เก็บเป็นความลับเฉพาะ Admin)" />
                            </Form.Item>
                            <Button type="primary" htmlType="submit" block>บันทึกข้อมูลพื้นฐาน</Button>
                        </Form>
                    </TabPane>

                    <TabPane tab="เอกสารพนักงาน" key="2">
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Upload customRequest={handleUpload} showUploadList={false}>
                                <Button icon={<UploadOutlined />} type="dashed" block>คลิกเพื่ออัปโหลดเอกสาร (Scan ID, ทะเบียนบ้าน ฯลฯ)</Button>
                            </Upload>
                            <Table
                                dataSource={documents}
                                pagination={false}
                                columns={[
                                    { title: 'ชื่อไฟล์', dataIndex: 'document_name', key: 'name' },
                                    { title: 'หมวดหมู่', dataIndex: 'category', key: 'cat' },
                                    { 
                                        title: 'จัดการ', key: 'op', 
                                        render: (_, r) => (
                                            <Space>
                                                <Button size="small" icon={<DownloadOutlined />} href={`${UPLOAD_URL}/${r.file_path}`} target="_blank" />
                                                <Popconfirm title="ลบเอกสารนี้?" onConfirm={() => handleDeleteDoc(r.id)}>
                                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                                </Popconfirm>
                                            </Space>
                                        ) 
                                    }
                                ]}
                            />
                        </Space>
                    </TabPane>

                    <TabPane tab="ประวัติวินัย" key="3">
                        <Form form={disciplineForm} layout="vertical" onFinish={handleAddDisciplinary}>
                            <Row gutter={8}>
                                <Col span={8}>
                                    <Form.Item name="type" label="ประเภท" rules={[{ required: true }]}>
                                        <Select placeholder="เลือกประเภท">
                                            <Option value="ตักเตือนด้วยวาจา">ตักเตือนด้วยวาจา</Option>
                                            <Option value="ตักเตือนด้วยลายลักษณ์อักษร">ตักเตือนด้วยลายลักษณ์อักษร</Option>
                                            <Option value="ทัณฑ์บน">ทัณฑ์บน</Option>
                                            <Option value="อื่นๆ">อื่นๆ</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="issued_at" label="วันที่ออกหนังสือ" rules={[{ required: true }]}>
                                        <DatePicker style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={8} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '24px' }}>
                                    <Button type="primary" htmlType="submit" block>เพิ่มบันทึก</Button>
                                </Col>
                            </Row>
                            <Form.Item name="description" label="รายละเอียดความผิด/เหตุการณ์">
                                <TextArea rows={3} />
                            </Form.Item>
                        </Form>
                        <Divider>ประวัติที่ผ่านมา</Divider>
                        <Table
                            dataSource={disciplinaryRecords}
                            pagination={false}
                            columns={[
                                { title: 'วันที่', dataIndex: 'issued_at', key: 'date', render: d => dayjs(d).format('DD/MM/YYYY') },
                                { title: 'ประเภท', dataIndex: 'type', key: 'type', render: t => <Tag color="orange">{t}</Tag> },
                                { title: 'รายละเอียด', dataIndex: 'description', key: 'desc' }
                            ]}
                        />
                    </TabPane>
                </Tabs>
                </Spin>
            </Drawer>

            {/* ── Leave Quota Modal ── */}
            <Modal
                title={`ตั้งค่าวันลา: ${quotaEmployee?.name}`}
                open={quotaModalOpen}
                onOk={() => quotaForm.submit()}
                onCancel={() => setQuotaModalOpen(false)}
                okText="บันทึก" cancelText="ยกเลิก"
            >
                <Alert message="หากพักร้อนหรือลากิจเกินโควตา จะถูกหักเงินเดือนอัตโนมัติตามนโยบายบริษัท" type="info" showIcon style={{ marginBottom: 16 }} />
                <Form form={quotaForm} layout="vertical" onFinish={handleSaveLeaveQuotas}>
                    {leaveQuotas.map(q => (
                        <Form.Item key={q.leave_type_id} name={`quota_${q.leave_type_id}`} label={`โควตา: ${q.leave_name} (วัน/ปี)`}>
                            <Input type="number" min={0} />
                        </Form.Item>
                    ))}
                </Form>
            </Modal>
        </div>
    );
};
