import React from 'react';
import { BarChart3, Download, Printer, Shield, CheckCircle2, TrendingUp } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function Reports() {
  const { state } = useSocket();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Security Analytics & Compliance Reports</h2>
          <p className="text-xs text-gray-400 mt-1">Operational summaries, incident resolution velocity, and sensor uptime compliance</p>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shadow transition"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print / Export Shift Report</span>
        </button>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[#111827] border border-borderMuted rounded-xl">
          <span className="text-xs text-gray-400">Total Security Incidents (30d)</span>
          <div className="text-2xl font-extrabold text-white mt-1">28</div>
          <span className="text-[11px] text-emerald-400 font-medium">92% Resolved within SLA</span>
        </div>
        <div className="p-4 bg-[#111827] border border-borderMuted rounded-xl">
          <span className="text-xs text-gray-400">Mean RFID Verification Latency</span>
          <div className="text-2xl font-extrabold text-cyan-400 mt-1">42 ms</div>
          <span className="text-[11px] text-gray-400">Edge controller cached tokens</span>
        </div>
        <div className="p-4 bg-[#111827] border border-borderMuted rounded-xl">
          <span className="text-xs text-gray-400">Perimeter Defense Integrity</span>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">99.8%</div>
          <span className="text-[11px] text-gray-400">Optical beam & vibration mesh</span>
        </div>
        <div className="p-4 bg-[#111827] border border-borderMuted rounded-xl">
          <span className="text-xs text-gray-400">Gate Actuation Cycles (24h)</span>
          <div className="text-2xl font-extrabold text-white mt-1">146</div>
          <span className="text-[11px] text-amber-400 font-medium">1 Actuator Obstruction logged</span>
        </div>
      </div>

      {/* Compliance Certification Card */}
      <div className="p-5 bg-[#111827] border border-borderMuted rounded-xl space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Academic IoT Security Compliance Verified</h4>
            <p className="text-xs text-gray-400">Meets full requirements for sensor-to-cloud bidirectional authoritative state governance.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
