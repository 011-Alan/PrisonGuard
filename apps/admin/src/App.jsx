import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import CctvMonitoring from './pages/CctvMonitoring';
import FacilityOverview from './pages/FacilityOverview';
import PeopleTracking from './pages/PeopleTracking';
import OfficerOperations from './pages/OfficerOperations';
import AccessControl from './pages/AccessControl';
import SecurityMonitoring from './pages/SecurityMonitoring';
import HealthcareWelfare from './pages/HealthcareWelfare';
import Announcements from './pages/Announcements';
import IoTDeviceStatus from './pages/IoTDeviceStatus';
import MqttArchitecture from './pages/MqttArchitecture';
import AuditLogs from './pages/AuditLogs';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';

function AuthenticatedApp() {
  const { isAuthenticated, loading } = useAuth();
  const { state } = useSocket();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-white font-mono text-sm">
        Initializing Security Operations Center...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const activeAlertsCount = state?.incidents ? state.incidents.filter(i => i.status === 'ACTIVE').length : 3;

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col font-sans">
      <Header onSearch={setSearchQuery} activeAlertsCount={activeAlertsCount} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />
        <main className="flex-1 overflow-y-auto bg-[#0b0f19]">
          {activeTab === 'dashboard' && <Dashboard onNavigateTab={setActiveTab} />}
          {activeTab === 'cctv' && <CctvMonitoring />}
          {activeTab === 'facility' && <FacilityOverview />}
          {activeTab === 'officer-ops' && <OfficerOperations />}
          {activeTab === 'tracking' && <PeopleTracking />}
          {activeTab === 'access' && <AccessControl />}
          {activeTab === 'security' && <SecurityMonitoring />}
          {activeTab === 'healthcare' && <HealthcareWelfare />}
          {activeTab === 'announcements' && <Announcements />}
          {activeTab === 'iot' && <IoTDeviceStatus />}
          {activeTab === 'mqtt' && <MqttArchitecture />}
          {activeTab === 'audit' && <AuditLogs />}
          {activeTab === 'reports' && <Reports />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AuthenticatedApp />
      </SocketProvider>
    </AuthProvider>
  );
}
