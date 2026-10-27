import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, CheckCircle2, Clock, Filter, Eye, ExternalLink } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { SIMULATOR_URL } from '../config';

export default function SecurityMonitoring() {
  const { state, ackIncident, resolveIncident } = useSocket();
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [selectedIncident, setSelectedIncident] = useState(null);

  const incidents = state?.incidents || [];

  const filtered = incidents.filter(i => {
    if (filterSeverity === 'ALL') return true;
    return i.severity === filterSeverity;
  });

  const handleAck = async (id) => {
    await ackIncident(id);
    if (selectedIncident?.id === id) {
      setSelectedIncident(prev => ({ ...prev, status: 'ACKNOWLEDGED' }));
    }
  };

  const handleResolve = async (id) => {
    await resolveIncident(id);
    if (selectedIncident?.id === id) {
      setSelectedIncident(prev => ({ ...prev, status: 'RESOLVED' }));
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      {/* Evidence Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-borderSubtle rounded-2xl w-full max-w-xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-borderMuted">
              <div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  selectedIncident.severity === 'CRITICAL' ? 'bg-red-600 text-white' : selectedIncident.severity === 'WARNING' ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                  {selectedIncident.severity}
                </span>
                <h3 className="text-base font-bold text-white mt-2">{selectedIncident.title}</h3>
                <span className="text-xs text-gray-400 font-mono">Incident ID: {selectedIncident.id}</span>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-3 bg-[#0b0f19] rounded-lg border border-slate-800">
                <span className="text-gray-400 block mb-1">Applied Sensor Fusion Rule</span>
                <span className="font-semibold text-cyan-300">{selectedIncident.rule}</span>
              </div>

              <div className="p-3 bg-[#0b0f19] rounded-lg border border-slate-800">
                <span className="text-gray-400 block mb-1">Triggering Evidence Chain</span>
                <ul className="list-disc list-inside space-y-1 text-gray-200">
                  {selectedIncident.evidence?.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#0b0f19] rounded-lg border border-slate-800">
                  <span className="text-gray-400 block mb-1">Physical Location</span>
                  <span className="font-bold text-white">{selectedIncident.location}</span>
                </div>
                <div className="p-3 bg-[#0b0f19] rounded-lg border border-slate-800">
                  <span className="text-gray-400 block mb-1">Trigger Timestamp</span>
                  <span className="font-mono text-gray-300">{new Date(selectedIncident.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-borderMuted flex items-center justify-between">
              <a
                href={`${SIMULATOR_URL}?focusIncident=${selectedIncident.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5"
              >
                <span>Focus in 2D Simulator</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <div className="flex items-center gap-2">
                {selectedIncident.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleAck(selectedIncident.id)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold"
                  >
                    Acknowledge Alert
                  </button>
                )}
                {selectedIncident.status !== 'RESOLVED' && (
                  <button
                    onClick={() => handleResolve(selectedIncident.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold"
                  >
                    Resolve Incident
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Security Monitoring & Sensor Fusion Engine</h2>
          <p className="text-xs text-gray-400 mt-1">Multi-sensor correlation rules, real-time breach detection, and incident response</p>
        </div>

        {/* Severity Filters */}
        <div className="flex bg-[#111827] border border-borderMuted p-1 rounded-lg text-xs">
          {['ALL', 'CRITICAL', 'WARNING', 'MEDIUM', 'INFO'].map(sev => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1 rounded font-semibold transition ${filterSeverity === sev ? 'bg-slate-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Rules Explainer Banner */}
      <div className="bg-[#111827] border border-borderMuted rounded-xl p-4 text-xs space-y-2">
        <h4 className="font-bold text-white tracking-wide">Active Deterministic Sensor Fusion Rules:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] text-gray-300">
          <div className="p-2.5 bg-[#0b0f19] rounded border border-slate-800">
            <span className="font-bold text-emerald-400 block">RULE A (Normal):</span>
            Authorized RFID scan + expected door reed switch opening within 30s.
          </div>
          <div className="p-2.5 bg-[#0b0f19] rounded border border-slate-800">
            <span className="font-bold text-amber-400 block">RULE B (Warning):</span>
            Door reed switch opening without prior authorized RFID presentation.
          </div>
          <div className="p-2.5 bg-[#0b0f19] rounded border border-slate-800">
            <span className="font-bold text-red-400 block">RULE C (Critical):</span>
            Cell door breach followed by motion tripped in restricted corridor.
          </div>
          <div className="p-2.5 bg-[#0b0f19] rounded border border-slate-800">
            <span className="font-bold text-red-400 block">RULE D (Critical):</span>
            Perimeter fence vibration combined with broken infrared optical barrier.
          </div>
          <div className="p-2.5 bg-[#0b0f19] rounded border border-slate-800">
            <span className="font-bold text-amber-400 block">RULE E (Warning):</span>
            Gate closure commanded but limit switch unconfirmed / actuator motor jam.
          </div>
          <div className="p-2.5 bg-[#0b0f19] rounded border border-slate-800">
            <span className="font-bold text-blue-400 block">RULE G (Welfare):</span>
            Medical duress panic switch engaged at clinic triage station.
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-[#111827] border border-borderMuted rounded-xl overflow-hidden shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0f19] text-gray-400 font-semibold border-b border-borderMuted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Incident Title & ID</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Applied Fusion Rule</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((inc) => {
                const isCrit = inc.severity === 'CRITICAL';
                const isWarn = inc.severity === 'WARNING';
                return (
                  <tr key={inc.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isCrit ? 'bg-red-600 text-white animate-pulse' : isWarn ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{inc.title}</div>
                      <div className="text-[10px] font-mono text-gray-500">{inc.id}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-300">{inc.location}</td>
                    <td className="py-3 px-4 text-gray-400 font-mono text-[11px] truncate max-w-xs">{inc.rule}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inc.status === 'ACTIVE'
                          ? 'bg-red-950/60 text-red-300 border border-red-500/30'
                          : inc.status === 'ACKNOWLEDGED'
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-400">{new Date(inc.timestamp).toLocaleTimeString()}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedIncident(inc)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded text-xs font-semibold transition"
                      >
                        Inspect
                      </button>
                      {inc.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleAck(inc.id)}
                          className="px-2.5 py-1 bg-amber-900/40 hover:bg-amber-800 text-amber-300 border border-amber-500/30 rounded text-xs font-semibold transition"
                        >
                          Ack
                        </button>
                      )}
                      {inc.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleResolve(inc.id)}
                          className="px-2.5 py-1 bg-emerald-900/40 hover:bg-emerald-800 text-emerald-300 border border-emerald-500/30 rounded text-xs font-semibold transition"
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
