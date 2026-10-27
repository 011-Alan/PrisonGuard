import React from 'react';
import { X, Cpu, Activity, Play, Zap, Info, ShieldAlert } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function DeviceInspector({ device, onClose }) {
  const { triggerSensor, state } = useSocket();

  if (!device) return null;

  const isOnline = device.status === 'ONLINE';

  // Purpose and workflow explanation lookup
  const getExplanation = (type) => {
    switch (type) {
      case 'REED_SWITCH':
        return {
          purpose: 'Detects physical open or closed status of the cell door or barrier via magnetic reed contact.',
          workflow: 'Door moves → reed-switch state changes → ESP32 processes reading on GPIO interrupt → backend receives event → both websites update in real time.',
          note: 'The reed switch detects the door\'s physical open/closed state. It does not independently prove that the solenoid lock mechanism is engaged.'
        };
      case 'PIR_MOTION':
        return {
          purpose: 'Detects infrared human thermal motion in restricted corridors and transit sectors.',
          workflow: 'Personnel movement → pyroelectric sensor trips → ESP32 samples digital pulse → backend correlates with RFID authorization.',
          note: 'Correlated with unexpected door openings to identify potential escape attempts (Rule C).'
        };
      case 'IR_BREAK_BEAM':
        return {
          purpose: 'Provides optical invisible infrared barrier across perimeter fence corridors.',
          workflow: 'Obstacle occludes transmitter beam → receiver loses phototransistor signal → ESP32 detects LOW logic level → perimeter breach alert.',
          note: 'Combined with fence vibration sensors to elevate alert priority to CRITICAL (Rule D).'
        };
      case 'VIBRATION':
        return {
          purpose: 'Acoustic / piezoelectric kinetic disturbance detection on perimeter chain-link fencing.',
          workflow: 'Fence climbing / cutting impact → piezo element generates voltage spike → ESP32 ADC triggers threshold interrupt → alert published to MQTT bus.',
          note: 'Filters ambient wind gusts using software low-pass threshold filtering.'
        };
      case 'RFID_READER':
        return {
          purpose: 'Contactless 13.56MHz Mifare / NFC badge reader for officer checkpoint access control.',
          workflow: 'Card presented → reader scans UID → ESP32 transmits token to backend → backend checks role permissions → unlocks actuator if authorized.',
          note: 'Authorized scans must not override manual administrative lockdowns.'
        };
      default:
        return {
          purpose: 'IoT monitoring and telemetry node.',
          workflow: 'Device state sampled → ESP32 transmission → backend synchronization.',
          note: 'Authoritative state managed by PrisonGuard Core Engine.'
        };
    }
  };

  const exp = getExplanation(device.type);

  const handleToggleState = () => {
    if (device.type === 'REED_SWITCH') {
      triggerSensor(device.id, device.value === 'OPEN' ? 'CLOSED' : 'OPEN');
    } else if (device.type === 'PIR_MOTION') {
      triggerSensor(device.id, device.value === 'DETECTED' ? 'CLEAR' : 'DETECTED');
    } else if (device.type === 'IR_BREAK_BEAM') {
      triggerSensor(device.id, device.value === 'BROKEN' ? 'INTACT' : 'BROKEN');
    } else if (device.type === 'VIBRATION') {
      triggerSensor(device.id, device.value === 'TRIPPED' ? 'NORMAL' : 'TRIPPED');
    } else if (device.type === 'DURESS_BUTTON') {
      triggerSensor(device.id, 'PRESSED');
    }
  };

  return (
    <div className="absolute top-20 right-6 w-96 bg-[#0f172a]/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl shadow-2xl z-40 p-5 space-y-4 animate-in fade-in slide-in-from-right-4 select-none">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-700">
        <div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
            isOnline ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-red-950 text-red-300 border border-red-500/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-500'}`}></span>
            {device.status}
          </span>
          <h3 className="font-bold text-white text-base mt-1">{device.name}</h3>
          <span className="text-xs font-mono text-gray-400">ID: {device.id}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Hardware Specifications */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
          <span className="text-gray-400 text-[10px] block">Owning Controller</span>
          <strong className="text-cyan-400 font-mono">{device.controllerId}</strong>
        </div>
        <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
          <span className="text-gray-400 text-[10px] block">Simulated GPIO Pin</span>
          <strong className="text-emerald-400 font-mono">GPIO {device.gpio}</strong>
        </div>
        <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
          <span className="text-gray-400 text-[10px] block">Physical Location</span>
          <span className="text-gray-200">{device.location}</span>
        </div>
        <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
          <span className="text-gray-400 text-[10px] block">Current Telemetry</span>
          <strong className="text-white font-mono">{device.value}</strong>
        </div>
      </div>

      {/* IoT Architecture & Workflow Explanation Box */}
      <div className="p-3 bg-[#080d1a] border border-slate-800 rounded-xl space-y-2 text-xs">
        <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-[11px]">
          <Info className="w-3.5 h-3.5" />
          <span>Device Purpose & IoT Workflow</span>
        </div>
        <p className="text-gray-300 text-[11px] leading-relaxed">
          <strong>Purpose:</strong> {exp.purpose}
        </p>
        <p className="text-gray-400 text-[11px] leading-relaxed">
          <strong>Workflow:</strong> {exp.workflow}
        </p>
        <p className="text-amber-400/90 text-[10px] italic border-t border-slate-800/80 pt-1.5">
          {exp.note}
        </p>
      </div>

      {/* Interactive Trigger Button */}
      <div className="pt-2">
        <button
          onClick={handleToggleState}
          disabled={!isOnline}
          className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition disabled:opacity-40"
        >
          <Zap className="w-4 h-4" />
          <span>Simulate Sensor Trigger / Toggle</span>
        </button>
      </div>
    </div>
  );
}
