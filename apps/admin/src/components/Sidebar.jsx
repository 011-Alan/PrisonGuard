import React from 'react';
import {
  LayoutDashboard,
  Map,
  Users,
  KeyRound,
  AlertTriangle,
  HeartPulse,
  Megaphone,
  Cpu,
  Radio,
  FileCheck,
  BarChart3,
  Settings,
  ExternalLink,
  Video
} from 'lucide-react';
import { SIMULATOR_URL } from '../config';

export default function Sidebar({ activeTab, onSelectTab }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cctv', label: 'CCTV Monitoring', icon: Video, badge: '8' },
    { id: 'facility', label: 'Facility Map', icon: Map },
    { id: 'officer-ops', label: 'Officer Operations', icon: Radio },
    { id: 'access', label: 'Access Control', icon: KeyRound },
    { id: 'tracking', label: 'People & Tracking', icon: Users },
    { id: 'security', label: 'Security Monitoring', icon: AlertTriangle, badge: '3' },
    { id: 'healthcare', label: 'Healthcare & Welfare', icon: HeartPulse },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'iot', label: 'IoT Device Status', icon: Cpu },
    { id: 'mqtt', label: 'MQTT Architecture', icon: Radio },
    { id: 'audit', label: 'Audit Logs', icon: FileCheck },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0b0f19] border-r border-borderMuted flex flex-col justify-between shrink-0 select-none">
      <div className="p-3 space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
          Operations Command
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-red-950/40 text-red-400 border border-red-500/30 shadow-sm shadow-red-950/50'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-red-400' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-600/30 text-red-400 border border-red-500/40 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Launch Simulator Button */}
        <div className="pt-4 px-2">
          <a
            href={SIMULATOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-950 to-blue-950 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-md transition"
          >
            <Map className="w-3.5 h-3.5 text-cyan-400" />
            <span>Open 2D Simulator</span>
            <ExternalLink className="w-3 h-3 text-cyan-400 ml-auto" />
          </a>
        </div>
      </div>

      {/* Footer System Status Banner */}
      <div className="p-4 border-t border-borderMuted bg-[#090d16]">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-semibold text-emerald-400">System Online</span>
        </div>
        <p className="text-[11px] text-gray-500 leading-snug">All core IoT micro-services operational</p>
        <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-gray-600 italic">
          Safer Facilities • Stronger Communities
        </div>
      </div>
    </aside>
  );
}
