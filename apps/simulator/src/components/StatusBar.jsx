import React from 'react';
import { Shield, ExternalLink, Activity, Radio, Cpu } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { ADMIN_URL } from '../config';

export default function StatusBar() {
  const { connected, latency, state } = useSocket();

  const activeScenario = state?.activeScenario;
  const systemHealth = state?.systemHealth || 98;

  return (
    <footer className="absolute bottom-4 right-4 bg-[#0f172a]/90 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-xl px-4 py-2 z-40 flex items-center gap-4 text-xs select-none">
      {/* Active Scenario Indicator */}
      {activeScenario && (
        <div className="flex items-center gap-2 pr-3 border-r border-slate-700 text-amber-400 font-mono text-[11px] font-bold animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>SCENARIO ACTIVE: {activeScenario}</span>
        </div>
      )}

      {/* Backend Link Status */}
      <div className="flex items-center gap-2 font-mono text-[11px]">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></span>
        <span className={connected ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
          {connected ? `BACKEND LIVE (${latency}ms)` : 'OFFLINE'}
        </span>
      </div>

      <div className="text-gray-400 font-mono text-[11px] pr-2 border-r border-slate-700">
        Health: <strong className="text-white">{systemHealth}%</strong>
      </div>

      {/* Cross link to Website A (Admin Portal) */}
      <a
        href={ADMIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-semibold transition"
      >
        <Shield className="w-3.5 h-3.5" />
        <span>Open Admin Portal</span>
        <ExternalLink className="w-3 h-3 ml-0.5" />
      </a>
    </footer>
  );
}
