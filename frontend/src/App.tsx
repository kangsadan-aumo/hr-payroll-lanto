import { useState } from 'react';
import { MainLayout } from './MainLayout';
import { Dashboard } from './Dashboard';
import { DataImport } from './DataImport';
import { Payroll } from './Payroll';
import { PayrollHistory } from './PayrollHistory';
import { Settings } from './Settings';
import { Employees } from './Employees';
import { Leave } from './Leave';
import { Claims } from './Claims';
import { Analytics } from './Analytics';
import { HRCalendarView } from './HRCalendarView';
import { AuditLogs } from './AuditLogs';
import { GovReports } from './GovReports';
import './App.css';

function App() {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [payrollMonth, setPayrollMonth] = useState<{ month: number; year: number } | null>(null);

  const handleViewPayroll = (month: number, year: number) => {
    setPayrollMonth({ month, year });
    setActiveMenu('payroll');
  };

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveMenu} />;
      case 'import':
        return <DataImport />;
      case 'employees':
        return <Employees />;
      case 'leave':
        return <Leave />;
      case 'claims':
        return <Claims />;
      case 'payroll':
        return <Payroll initialMonth={payrollMonth} />;
      case 'payroll-history':
        return <PayrollHistory onViewPayroll={handleViewPayroll} />;
      case 'analytics':
        return <Analytics />;
      case 'hr-calendar':
        return <HRCalendarView />;
      case 'audit-logs':
        return <AuditLogs />;
      case 'gov-reports':
        return <GovReports />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <MainLayout activeMenu={activeMenu} onMenuClick={setActiveMenu}>
      {renderContent()}
    </MainLayout>
  );
}

export default App;
