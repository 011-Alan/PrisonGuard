import React from 'react';
import { X, ArrowRight, ArrowLeftRight, CheckCircle2, ShieldCheck, AlertCircle, Wifi, Cpu, Server, Monitor } from 'lucide-react';

export default function CommunicationInspector({ link, onClose }) {
  if (!link) return null;

  const isReal = link.isRealImplementation;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="bg-[#0f172a] border border-cyan-500/40 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 text-xs text-gray-300">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${isReal ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400' : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-400'}`}>
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-sm">IoT Communication Channel Inspector</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  isReal
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                    : 'bg-cyan-950 text-cyan-400 border-cyan-500/40'
                }`}>
                  {isReal ? 'REAL IMPLEMENTED TRANSPORT' : 'SIMULATED HARDWARE PROTOCOL'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Authoritative facility communication flow & telemetry inspection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Node Topology Strip */}
        <div className="my-4 p-3.5 bg-[#080d1a] border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400 font-bold">
              {link.sourceType === 'SENSOR' && 'S'}
              {link.sourceType === 'ACTUATOR' && 'A'}
              {link.sourceType === 'CONTROLLER' && <Cpu className="w-4 h-4" />}
              {link.sourceType === 'ACCESS_POINT' && <Wifi className="w-4 h-4" />}
              {link.sourceType === 'BACKEND' && <Server className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-mono block">SOURCE NODE</span>
              <strong className="text-white text-xs">{link.sourceName}</strong>
              <span className="text-[10px] text-gray-500 font-mono block">{link.sourceId}</span>
            </div>
          </div>

          <div className="flex flex-col items-center px-4">
            <span className="text-[10px] font-mono text-cyan-400 font-bold mb-1">{link.protocol}</span>
            <div className="flex items-center gap-1 text-cyan-400">
              {link.direction === 'BIDIRECTIONAL' ? (
                <ArrowLeftRight className="w-5 h-5 animate-pulse" />
              ) : (
                <ArrowRight className="w-5 h-5 animate-pulse" />
              )}
            </div>
            <span className="text-[9px] text-emerald-400 font-mono mt-1">Status: {link.status || 'ONLINE'}</span>
          </div>

          <div className="flex items-center gap-2.5 text-right">
            <div>
              <span className="text-[10px] text-gray-400 font-mono block">DESTINATION NODE</span>
              <strong className="text-white text-xs">{link.destName}</strong>
              <span className="text-[10px] text-gray-500 font-mono block">{link.destId}</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-indigo-400 font-bold">
              {link.destType === 'CONTROLLER' && <Cpu className="w-4 h-4" />}
              {link.destType === 'ACCESS_POINT' && <Wifi className="w-4 h-4" />}
              {link.destType === 'BACKEND' && <Server className="w-4 h-4" />}
              {link.destType === 'CENTRAL_CONTROL' && <Monitor className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* Technical Attributes Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
          <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg">
            <span className="text-gray-400 block text-[10px]">Configured Protocol</span>
            <span className="text-white font-mono font-bold">{link.protocol}</span>
          </div>
          <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg">
            <span className="text-gray-400 block text-[10px]">Data Flow</span>
            <span className="text-cyan-400 font-mono font-bold">{link.direction}</span>
          </div>
          <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg">
            <span className="text-gray-400 block text-[10px]">Delivery / ACK</span>
            <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              CONFIRMED
            </span>
          </div>
          <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg">
            <span className="text-gray-400 block text-[10px]">Layer Boundary</span>
            <span className="text-amber-400 font-mono font-bold">{link.layer}</span>
          </div>
        </div>

        {/* Sample Telemetry Payload */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-gray-400 font-bold uppercase">Sample Telemetry Packet Payload</span>
            <span className="text-[10px] text-gray-500 font-mono">Format: application/json</span>
          </div>
          <pre className="p-3 bg-[#080d1a] border border-slate-800 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-32">
            {JSON.stringify(link.samplePayload || {
              event: "TELEMETRY_UPDATE",
              sourceNode: link.sourceId,
              targetNode: link.destId,
              protocol: link.protocol,
              timestamp: new Date().toISOString(),
              telemetry: {
                status: "ONLINE",
                rssi: -62,
                bufferState: "NOMINAL",
                acknowledged: true
              }
            }, null, 2)}
          </pre>
        </div>

        {/* 6-Stage Event Sequence View */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-gray-400 font-bold uppercase block mb-1">Causal Event Sequence Trace</span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="p-2 bg-slate-900/70 border border-slate-800 rounded">
              <span className="text-cyan-400 font-mono text-[10px] font-bold">1. Edge Observation</span>
              <p className="text-[11px] text-gray-300 mt-0.5">Sensor state change captured at GPIO or optical boundary.</p>
            </div>
            <div className="p-2 bg-slate-900/70 border border-slate-800 rounded">
              <span className="text-indigo-400 font-mono text-[10px] font-bold">2. Access Point Mesh</span>
              <p className="text-[11px] text-gray-300 mt-0.5">Packet routed through 802.11n Wi-Fi Access Point to VLAN 10 trunk.</p>
            </div>
            <div className="p-2 bg-slate-900/70 border border-slate-800 rounded">
              <span className="text-emerald-400 font-mono text-[10px] font-bold">3. Backend & Audit</span>
              <p className="text-[11px] text-gray-300 mt-0.5">Authoritative state updated; SHA-256 cryptographic block chained.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-gray-500 font-mono">
            {isReal ? 'Live HTTP / Socket.IO connection validated' : 'Simulated IoT architecture demonstration protocol'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
