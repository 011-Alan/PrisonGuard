import React, { useState } from 'react';
import { Shield, Lock, Unlock, AlertTriangle, ExternalLink, Activity, DoorClosed } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import ConfirmationModal from '../components/ConfirmationModal';
import { SIMULATOR_URL } from '../config';

export default function FacilityOverview() {
  const { state, commandGate, jamGate } = useSocket();
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null, isDanger: true });

  const gates = state?.gates ? Object.values(state.gates) : [];
  const controllers = state?.controllers ? Object.values(state.controllers) : [];

  const handleGateAction = (gateId, targetState) => {
    setConfirmModal({
      isOpen: true,
      title: `Command Gate ${targetState}`,
      message: `Issue command to set ${state.gates[gateId]?.name} to ${targetState}?`,
      isDanger: targetState === 'OPEN',
      action: async () => {
        await commandGate(gateId, targetState);
        setConfirmModal({ isOpen: false });
      }
    });
  };

  const handleJamTest = (gateId) => {
    setConfirmModal({
      isOpen: true,
      title: `Simulate Gate Actuator Jam`,
      message: `Simulate mechanical obstruction / motor jam on ${state.gates[gateId]?.name}. This triggers Rule E (Actuator Fault).`,
      isDanger: true,
      action: async () => {
        await jamGate(gateId);
        setConfirmModal({ isOpen: false });
      }
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDanger={confirmModal.isDanger}
        onConfirm={confirmModal.action}
        onCancel={() => setConfirmModal({ isOpen: false })}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Facility Overview & Access Portals</h2>
          <p className="text-xs text-gray-400 mt-1">Direct gate actuation, physical barrier interlocks, and perimeter checkpoints</p>
        </div>

        <a
          href={SIMULATOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-semibold shadow transition"
        >
          <span>Open Full Interactive 2D Map</span>
          <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
        </a>
      </div>

      {/* Gates Management Table */}
      <div className="bg-[#111827] border border-borderMuted rounded-xl overflow-hidden shadow">
        <div className="p-4 border-b border-borderMuted flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Controlled Access Gates & Barriers</h3>
          </div>
          <span className="text-xs text-gray-400 font-mono">Total Monitored: {gates.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0f19] text-gray-400 font-semibold border-b border-borderMuted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Gate Name & ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Controller Node</th>
                <th className="py-3 px-4">Current State</th>
                <th className="py-3 px-4">Limit Switches</th>
                <th className="py-3 px-4 text-right">Operational Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {gates.map((gate) => {
                const isOpen = gate.state === 'OPEN' || gate.state === 'OPENING';
                const isJammed = gate.state === 'JAMMED';
                return (
                  <tr key={gate.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{gate.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono">{gate.id}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-300">{gate.type.replace(/_/g, ' ')}</td>
                    <td className="py-3 px-4 text-gray-400">{gate.location}</td>
                    <td className="py-3 px-4 font-mono text-cyan-400">{gate.controllerId}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                        isJammed
                          ? 'bg-red-950 text-red-400 border border-red-500/40 animate-pulse'
                          : isOpen
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isJammed ? 'bg-red-500' : isOpen ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                        {gate.state}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] font-mono">
                      <span className={gate.limitSwitchClosed ? 'text-emerald-400' : 'text-gray-500'}>CLS:{gate.limitSwitchClosed ? 'YES' : 'NO'}</span>
                      <span className="mx-1 text-gray-600">|</span>
                      <span className={gate.limitSwitchOpen ? 'text-amber-400' : 'text-gray-500'}>OPN:{gate.limitSwitchOpen ? 'YES' : 'NO'}</span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleGateAction(gate.id, isOpen ? 'CLOSE' : 'OPEN')}
                        disabled={isJammed}
                        className={`px-3 py-1 rounded text-xs font-semibold transition ${
                          isOpen
                            ? 'bg-slate-800 hover:bg-slate-700 text-gray-200'
                            : 'bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-500/30'
                        } disabled:opacity-40`}
                      >
                        {isOpen ? 'Close Gate' : 'Open Gate'}
                      </button>
                      <button
                        onClick={() => handleJamTest(gate.id)}
                        className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 rounded text-xs font-semibold transition"
                        title="Simulate Obstacle / Jam"
                      >
                        Simulate Jam
                      </button>
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
