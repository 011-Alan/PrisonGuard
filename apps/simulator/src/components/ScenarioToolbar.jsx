import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  EyeOff,
  Cpu,
  Layers,
  ChevronDown,
  Sliders
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function ScenarioToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  showIoTOverlay,
  onToggleIoTOverlay,
  onOpenDisplaySettings
}) {
  const { state, startScenario, stopScenario, resetSimulation } = useSocket();
  const [selectedScenario, setSelectedScenario] = useState('SCENARIO_B');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeScenario = state?.activeScenario;

  const scenarios = [
    { id: 'SCENARIO_A', category: 'Live Demonstration Scenarios', label: 'Scenario A: CCTV Alert & Officer Monitoring' },
    { id: 'SCENARIO_B', category: 'Live Demonstration Scenarios', label: 'Scenario B: Inmate Escape Attempt (Contained vs Uncontained)' },
    { id: 'SCENARIO_C', category: 'Live Demonstration Scenarios', label: 'Scenario C: Power Failure & Emergency Lockdown' },
    { id: 'SCENARIO_D', category: 'Live Demonstration Scenarios', label: 'Scenario D: Compromised Officer & RFID Revocation' },
    { id: 'SCENARIO_E', category: 'Live Demonstration Scenarios', label: 'Scenario E: Credential Misuse & Inmate Containment' },
    { id: 'SCENARIO_F', category: 'Live Demonstration Scenarios', label: 'Scenario F: External Visitor Arrival & Escort' },
    { id: 'OFFICER_ENTRY', category: 'Facility Operations', label: 'Authorized Officer Entry & Sally Port Check' },
    { id: 'UNAUTHORIZED_ACCESS', category: 'Facility Operations', label: 'Unauthorized Token Scan at Sally Port' },
    { id: 'DOOR_BREACH', category: 'Facility Operations', label: 'Cell Door Forced Breach Alert' },
    { id: 'PERIMETER_ESCAPE', category: 'Facility Operations', label: 'Perimeter Sensor Breach Attempt' },
    { id: 'GATE_FAILURE', category: 'Facility Operations', label: 'Gate Actuator Jam / Motor Stalling' },
    { id: 'CONTROLLER_DISCONNECT', category: 'Facility Operations', label: 'ESP32 Controller Heartbeat Dropout' },
    { id: 'MEDICAL_DURESS', category: 'Facility Operations', label: 'Medical Ward Duress Alarm' },
    { id: 'SECURITY_INCIDENT_RESPONSE', category: 'Facility Operations', label: 'Coordinated Tactical Breach Intercept' }
  ];

  const handleStartScenario = () => {
    startScenario(selectedScenario);
  };

  const handleStopScenario = () => {
    stopScenario();
  };

  const handleReset = () => {
    resetSimulation();
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#0f172a]/90 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl px-4 py-2.5 z-40 flex items-center gap-4 text-xs select-none">
      {/* Brand Badge */}
      <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
        <span className="font-extrabold text-white tracking-wider text-sm">FACILITY<span className="text-cyan-400">2D</span></span>
      </div>

      {/* Scenario Selector Dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#080d1a] hover:bg-slate-800 border border-slate-700 rounded-lg text-white font-medium transition"
        >
          <span className="truncate max-w-[220px]">
            {scenarios.find(s => s.id === selectedScenario)?.label || 'Select Scenario'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 mt-2 w-80 bg-[#111827] border border-cyan-500/30 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 max-h-96 overflow-y-auto">
            <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-cyan-400 tracking-wider border-b border-slate-800 bg-cyan-950/30">
              Live Demonstration Scenarios (A - F)
            </div>
            {scenarios.filter(s => s.category === 'Live Demonstration Scenarios').map(sc => (
              <button
                key={sc.id}
                onClick={() => {
                  setSelectedScenario(sc.id);
                  setDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs transition ${
                  selectedScenario === sc.id
                    ? 'bg-cyan-950/60 text-cyan-300 font-bold border-l-2 border-cyan-400'
                    : 'text-gray-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {sc.label}
              </button>
            ))}

            <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-gray-400 tracking-wider border-b border-t border-slate-800 bg-slate-900/60 mt-1">
              Deterministic Automated Scenarios
            </div>
            {scenarios.filter(s => s.category !== 'Live Demonstration Scenarios').map(sc => (
              <button
                key={sc.id}
                onClick={() => {
                  setSelectedScenario(sc.id);
                  setDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs transition ${
                  selectedScenario === sc.id
                    ? 'bg-cyan-950/60 text-cyan-300 font-bold border-l-2 border-cyan-400'
                    : 'text-gray-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Start / Stop Scenario Buttons */}
      <div className="flex items-center gap-1.5 pr-3 border-r border-slate-700">
        {activeScenario ? (
          <button
            onClick={handleStopScenario}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold shadow transition"
          >
            <Pause className="w-3.5 h-3.5 fill-white" />
            <span>Pause / Stop</span>
          </button>
        ) : (
          <button
            onClick={handleStartScenario}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow transition"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Run Scenario</span>
          </button>
        )}

        <button
          onClick={handleReset}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white rounded-lg transition"
          title="Reset Simulation State"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Display Options Settings (Section 23) */}
      <div className="pr-3 border-r border-slate-700">
        <button
          onClick={onOpenDisplaySettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white border border-slate-700 transition"
          title="Toggle Simulation Display Options"
        >
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span>Display Options</span>
        </button>
      </div>

      {/* IoT Overlay Toggle */}
      <div className="pr-3 border-r border-slate-700">
        <button
          onClick={onToggleIoTOverlay}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition border ${
            showIoTOverlay
              ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 shadow'
              : 'bg-slate-800 text-gray-400 border-slate-700 hover:text-white'
          }`}
        >
          {showIoTOverlay ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>IoT Overlay</span>
        </button>
      </div>

      {/* Zoom and Map View Controls */}
      <div className="flex items-center gap-1 text-gray-300">
        <button
          onClick={onZoomIn}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomOut}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onResetView}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          title="Fit Facility to View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <span className="font-mono text-[11px] text-gray-400 pl-1">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}
