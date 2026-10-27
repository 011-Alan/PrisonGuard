import React, { useState } from 'react';
import {
  Activity,
  Cpu,
  Radio,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Shield,
  Layers,
  ArrowRight,
  X,
  RefreshCw,
  Zap,
  Server
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function CommunicationMonitor() {
  const { connected, latency, state, commands, lastSyncTime, refreshState } = useSocket();
  const [selectedTrace, setSelectedTrace] = useState(null);

  const controllers = state?.controllers ? Object.values(state.controllers) : [];
  const onlineControllers = controllers.filter(c => c.status === 'ONLINE').length;
  const recentCommands = commands && commands.length > 0 ? commands.slice(0, 8) : [];

  return (
    <div className="bg-[#111827] border border-borderSubtle rounded-2xl p-5 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-borderMuted">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Tri-Service Communication Monitor</h3>
            <span className="text-[11px] text-gray-400">Real-Time WebSocket Pipeline & Simulated ESP32 Mesh</span>
          </div>
        </div>
        <button
          onClick={refreshState}
          className="p-1.5 rounded-lg bg-[#0b0f19] hover:bg-slate-800 text-gray-400 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
          title="Force Telemetry Sync"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync</span>
        </button>
      </div>

      {/* Primary Communication Health Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {/* Backend Node */}
        <div className="p-3 bg-[#0b0f19] border border-borderMuted rounded-xl space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Backend API & Socket</span>
          <div className="flex items-center gap-2 font-mono font-bold text-sm">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></span>
            <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
              {connected ? `ONLINE (${latency}ms)` : 'DISCONNECTED'}
            </span>
          </div>
          <span className="text-[10px] text-gray-500 block truncate">Last Sync: {new Date(lastSyncTime).toLocaleTimeString()}</span>
        </div>

        {/* ESP32 Gateways */}
        <div className="p-3 bg-[#0b0f19] border border-borderMuted rounded-xl space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">ESP32 Controllers</span>
          <div className="flex items-center gap-2 font-mono font-bold text-sm text-cyan-300">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>{onlineControllers} / {controllers.length} Active</span>
          </div>
          <span className="text-[10px] text-gray-500 block">Mesh telemetry 1Hz</span>
        </div>

        {/* Simulator Presence */}
        <div className="p-3 bg-[#0b0f19] border border-borderMuted rounded-xl space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">2D Simulator Client</span>
          <div className="flex items-center gap-2 font-mono font-bold text-sm text-indigo-300">
            <Server className="w-4 h-4 text-indigo-400" />
            <span>SYNCED VIA HUB</span>
          </div>
          <span className="text-[10px] text-gray-500 block">Authoritative backend state</span>
        </div>

        {/* Crypto Ledger */}
        <div className="p-3 bg-[#0b0f19] border border-borderMuted rounded-xl space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Audit Hash Chain</span>
          <div className="flex items-center gap-2 font-mono font-bold text-sm text-emerald-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>SHA-256 VALID</span>
          </div>
          <span className="text-[10px] text-gray-500 block">Tamper-evident log chain</span>
        </div>
      </div>

      {/* Command Lifecycle Stream */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Recent Command Lifecycles & Dispatches
          </span>
          <span className="text-[10px] font-mono text-gray-500">{commands.length} total logged</span>
        </div>

        {recentCommands.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#0b0f19] border border-borderMuted text-center text-xs text-gray-500 font-mono">
            No active commands dispatched in current session. Operate gates or doors to observe telemetry trace.
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentCommands.map((cmd) => {
              const isConfirmed = cmd.status === 'CONFIRMED' || cmd.status === 'APPLIED';
              const isExecuting = cmd.status === 'DISPATCHED' || cmd.status === 'EXECUTING';
              const isFailed = cmd.status === 'FAILED' || cmd.status === 'JAMMED';

              let badgeColor = 'bg-slate-800 text-gray-300 border-slate-700';
              if (isConfirmed) badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-500/40';
              else if (isExecuting) badgeColor = 'bg-cyan-950 text-cyan-300 border-cyan-500/40 animate-pulse';
              else if (isFailed) badgeColor = 'bg-red-950 text-red-300 border-red-500/40';

              return (
                <div
                  key={cmd.id}
                  onClick={() => setSelectedTrace(cmd)}
                  className="p-2.5 bg-[#0b0f19] hover:bg-slate-800/80 border border-borderMuted hover:border-cyan-500/50 rounded-xl transition cursor-pointer flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400 font-bold">{cmd.id}</span>
                    <span className="text-gray-300">
                      {cmd.targetType}: <strong className="text-white">{cmd.targetId}</strong> → {cmd.action}
                    </span>
                    <span className="text-[10px] text-gray-500 hidden md:inline">by {cmd.initiator} ({cmd.initiatorRole})</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeColor}`}>
                      {cmd.status}
                    </span>
                    <button className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] font-sans font-semibold">
                      <span>Trace</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Communication Trace Modal */}
      {selectedTrace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-borderSubtle rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-borderMuted">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-950 text-cyan-400 border border-cyan-500/40 uppercase">
                  Communication Sequence Trace
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  Command: {selectedTrace.id} ({selectedTrace.targetId} → {selectedTrace.action})
                </h3>
                <span className="text-xs text-gray-400 font-mono">
                  Initiator: {selectedTrace.initiator} ({selectedTrace.initiatorRole}) • {new Date(selectedTrace.timestamp).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedTrace(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stage-by-Stage Vertical Pipeline */}
            <div className="space-y-3 pt-2">
              {selectedTrace.trace ? (
                selectedTrace.trace.map((step, idx) => {
                  const isDone = step.status === 'COMPLETED';
                  const isProgress = step.status === 'IN_PROGRESS';
                  const isErr = step.status === 'FAILED';

                  return (
                    <div key={idx} className="flex items-start gap-3">
                      {/* Stage indicator circle */}
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border ${
                          isDone
                            ? 'bg-emerald-950 border-emerald-500 text-emerald-400'
                            : isProgress
                            ? 'bg-cyan-950 border-cyan-400 text-cyan-300 animate-pulse'
                            : isErr
                            ? 'bg-red-950 border-red-500 text-red-400'
                            : 'bg-slate-900 border-slate-700 text-gray-500'
                        }`}>
                          {isDone ? '✓' : idx + 1}
                        </div>
                        {idx < selectedTrace.trace.length - 1 && (
                          <div className={`w-0.5 h-8 ${isDone ? 'bg-emerald-500/40' : 'bg-slate-800'}`} />
                        )}
                      </div>

                      {/* Stage details card */}
                      <div className="flex-1 p-3 bg-[#0b0f19] border border-borderMuted rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-white text-xs font-semibold">{step.label}</strong>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            isDone ? 'bg-emerald-950 text-emerald-400' : isProgress ? 'bg-cyan-950 text-cyan-400' : isErr ? 'bg-red-950 text-red-400' : 'bg-slate-800 text-gray-500'
                          }`}>
                            {step.status}
                          </span>
                        </div>
                        <p className="text-gray-300 text-[11px] font-mono">{step.detail}</p>
                        {step.timestamp && (
                          <span className="text-[10px] text-gray-500 block font-mono">
                            Timestamp: {new Date(step.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-400 text-xs font-mono p-4 bg-[#0b0f19] rounded-xl">
                  Legacy command record. Dispatched and confirmed.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-borderMuted flex justify-end">
              <button
                onClick={() => setSelectedTrace(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
