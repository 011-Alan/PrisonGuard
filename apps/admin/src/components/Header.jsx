import React, { useState, useEffect } from 'react';
import { Shield, Search, Bell, LogOut, Radio, UserCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Header({ onSearch, activeAlertsCount = 3 }) {
  const { user, logout } = useAuth();
  const { connected, latency } = useSocket();
  const [timeStr, setTimeStr] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
      const datePart = now.toLocaleDateString('en-GB', options);
      const timePart = now.toTimeString().split(' ')[0];
      setTimeStr(`${datePart} • ${timePart}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (onSearch) onSearch(e.target.value);
  };

  return (
    <header className="h-16 bg-[#0f172a]/95 backdrop-blur border-b border-borderMuted px-6 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Brand Logo & Subtitle */}
      <div className="flex items-center gap-3 w-64">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 via-red-700 to-red-950 border border-red-500/40 shadow-lg shadow-red-950/40">
          <Shield className="w-6 h-6 text-white stroke-[2.2]" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <div className="w-1.5 h-4 bg-white/70 mx-0.5 rounded-sm"></div>
            <div className="w-1.5 h-4 bg-white/70 mx-0.5 rounded-sm"></div>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-extrabold text-lg tracking-wider text-white">Prison<span className="text-red-500">Guard</span></span>
          </div>
          <span className="text-[10px] text-gray-400 font-medium tracking-widest uppercase">Secure • Monitor • Protect</span>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-xl mx-6">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search prisoner, officer, device, gate, or incident..."
            className="w-full h-9 pl-10 pr-4 bg-[#111827]/80 border border-borderMuted rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500/70 focus:ring-1 focus:ring-red-500/40 transition-all font-sans"
          />
        </div>
      </div>

      {/* Right Controls: Clock, Notifications, Backend Ping, User Profile */}
      <div className="flex items-center gap-4">
        {/* Backend Connection Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border ${
          connected ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' : 'bg-red-950/40 border-red-500/30 text-red-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></span>
          <span>{connected ? `LIVE (${latency}ms)` : 'DISCONNECTED'}</span>
        </div>

        {/* Live Clock */}
        <div className="hidden lg:flex flex-col text-right">
          <span className="text-xs font-mono text-gray-300 font-medium">{timeStr}</span>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg bg-[#111827] border border-borderMuted text-gray-300 hover:text-white hover:border-gray-600 transition relative"
            title="Active Security Alerts"
          >
            <Bell className="w-4 h-4" />
            {activeAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {activeAlertsCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-[#111827] border border-borderSubtle rounded-xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 border-b border-borderMuted">
                <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Priority Notifications</span>
                <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">{activeAlertsCount} Active</span>
              </div>
              <div className="py-2 space-y-2 text-xs">
                <div className="p-2 bg-red-950/30 border border-red-500/30 rounded-lg text-red-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-white">East Perimeter Motion</p>
                    <p className="text-[11px] text-gray-400">IR beam broken & vibration spike</p>
                  </div>
                </div>
                <div className="p-2 bg-amber-950/30 border border-amber-500/30 rounded-lg text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-white">Cell B-102 Door Opened</p>
                    <p className="text-[11px] text-gray-400">No authorized RFID badge scan</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile & Role */}
        <div className="flex items-center gap-3 pl-2 border-l border-borderMuted">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold border border-cyan-400/30">
            {user?.name ? user.name.split(' ').map(n=>n[0]).join('') : 'AD'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-gray-200 leading-tight">{user?.name || 'S. Patel'}</div>
            <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              {user?.role || 'ADMIN'}
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/30 transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
