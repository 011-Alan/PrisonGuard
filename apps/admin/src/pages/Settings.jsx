import React, { useState } from 'react';
import { Settings as SettingsIcon, RotateCcw, Shield, Server, BellRing } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import ConfirmationModal from '../components/ConfirmationModal';
import { API_BASE_URL, SIMULATOR_URL } from '../config';

export default function Settings() {
  const { resetSimulation } = useSocket();
  const [resetModal, setResetModal] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleReset = async () => {
    await resetSimulation();
    setResetModal(false);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 4000);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      <ConfirmationModal
        isOpen={resetModal}
        title="Reset Entire Simulation State?"
        message="This will reset all gate actuators, door locks, sensor readings, and personnel coordinates back to default baseline values. All active scenario timers will be cancelled without breaking the shared WebSocket connection."
        isDanger={true}
        confirmText="Reset All Data"
        onConfirm={handleReset}
        onCancel={() => setResetModal(false)}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">System Settings & Operational Tuning</h2>
          <p className="text-xs text-gray-400 mt-1">Configure authoritative engine parameters, sensor thresholds, and academic simulation baseline</p>
        </div>
      </div>

      {resetSuccess && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold animate-in fade-in">
          Simulation and IoT state successfully reset to initial baseline values!
        </div>
      )}

      {/* Reset Simulation Control */}
      <div className="bg-[#111827] border border-borderMuted rounded-xl p-6 shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              Reset Facility Simulation Baseline
            </h3>
            <p className="text-xs text-gray-400 max-w-xl">
              Restore the facility map, personnel locations, gate positions, and active alarms to their baseline state. Use this before starting a new grading demonstration run.
            </p>
          </div>
          <button
            onClick={() => setResetModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs shadow transition"
          >
            Reset Simulation
          </button>
        </div>
      </div>

      {/* Network & Backend Configuration */}
      <div className="bg-[#111827] border border-borderMuted rounded-xl p-6 shadow space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          Network Topology & Microservice Ports
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 bg-[#0b0f19] rounded-lg border border-slate-800">
            <span className="text-gray-500 block mb-1">Authoritative Engine (Backend):</span>
            <span className="text-emerald-400 font-bold truncate block">{API_BASE_URL}</span>
          </div>
          <div className="p-3 bg-[#0b0f19] rounded-lg border border-slate-800">
            <span className="text-gray-500 block mb-1">Admin Portal (Website A):</span>
            <span className="text-cyan-400 font-bold truncate block">{typeof window !== 'undefined' ? window.location.origin : 'Current Domain'}</span>
          </div>
          <div className="p-3 bg-[#0b0f19] rounded-lg border border-slate-800">
            <span className="text-gray-500 block mb-1">2D Facility Simulator (Website B):</span>
            <span className="text-purple-400 font-bold truncate block">{SIMULATOR_URL}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
