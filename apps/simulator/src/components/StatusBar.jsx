import React from 'react';
import { Shield, ExternalLink, Activity, Radio, Cpu, Volume2, VolumeX, Clock, AlertOctagon } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { ADMIN_URL } from '../config';

export default function StatusBar({ onOpenCommInspector }) {
  const { connected, latency, state, isAudioEnabled, setIsAudioEnabled } = useSocket();

  const activeScenario = state?.activeScenario;
  const systemHealth = state?.systemHealth || 98;
  const isLockdown = state?.lockdown?.isActive;
  const simClock = state?.simulationClock;
  const controllers = state?.controllers ? Object.values(state.controllers) : [];
  const onlineControllers = controllers.filter(c => c.status === 'ONLINE').length;

  return (
    <footer className="absolute bottom-4 left-4 right-4 md:left-auto bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl px-4 py-2 z-40 flex flex-wrap items-center justify-between md:justify-end gap-3 text-xs select-none">
      {/* Lockdown Alert Pill */}
      {isLockdown && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600/30 border border-red-500 text-red-400 font-mono text-[11px] font-bold animate-pulse">
          <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
          <span>LOCKDOWN ACTIVE</span>
        </div>
      )}

      {/* Active Scenario Indicator */}
      {activeScenario && !isLockdown && (
        <div className="flex items-center gap-2 pr-2 border-r border-slate-700 text-amber-400 font-mono text-[11px] font-bold animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>SCENARIO: {activeScenario}</span>
        </div>
      )}

      {/* Simulation Clock & Schedule */}
      {simClock && (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700 text-gray-300 font-mono text-[11px]">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-white">{simClock.displayTime || '09:30:00'}</span>
          <span className="text-[10px] text-gray-400 hidden sm:inline">({simClock.currentPhase?.name || 'Routine'})</span>
        </div>
      )}

      {/* Controllers Gateway Status */}
      <div className="flex items-center gap-1.5 text-gray-300 font-mono text-[11px] pr-2 border-r border-slate-700 hidden lg:flex">
        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
        <span>ESP32: <strong className="text-white">{onlineControllers}/{controllers.length}</strong></span>
      </div>

      {/* Web Speech API Audio Toggle */}
      <button
        onClick={() => setIsAudioEnabled(!isAudioEnabled)}
        title={isAudioEnabled ? 'Click to Mute Simulator Audio' : 'Click to Enable Speech Synthesis Audio'}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold border transition ${
          isAudioEnabled
            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
            : 'bg-slate-800 border-slate-700 text-gray-400 hover:text-gray-200'
        }`}
      >
        {isAudioEnabled ? (
          <>
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>P.A. AUDIO ON</span>
          </>
        ) : (
          <>
            <VolumeX className="w-3.5 h-3.5 text-gray-400" />
            <span>P.A. MUTED</span>
          </>
        )}
      </button>

      {/* Backend Link Status */}
      <div className="flex items-center gap-2 font-mono text-[11px] pr-2 border-r border-slate-700">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></span>
        <span className={connected ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
          {connected ? `LIVE (${latency}ms)` : 'OFFLINE'}
        </span>
      </div>

      {/* Cross link to Website A (Admin Portal) */}
      <a
        href={ADMIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-semibold transition"
      >
        <Shield className="w-3.5 h-3.5" />
        <span>Admin Portal</span>
        <ExternalLink className="w-3 h-3 ml-0.5" />
      </a>
    </footer>
  );
}
