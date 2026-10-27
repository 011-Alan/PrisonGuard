import React, { useState } from 'react';
import { X, Cpu, Activity, Play, Zap, Info, ShieldAlert, Lock, Unlock, Volume2, DoorClosed, CheckCircle, AlertTriangle } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function DeviceInspector({ device, onClose }) {
  const { triggerSensor, commandGate, jamGate, operateDoor, lockDoor, state } = useSocket();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'trace'

  if (!device) return null;

  const isOnline = device.status === 'ONLINE' || device.status === undefined;
  const isDoor = device.position !== undefined || device.type === 'DOOR';
  const isGate = device.motorCurrentAmps !== undefined || device.type?.includes('GATE');
  const isSpeaker = device.type === 'PA_SPEAKER';

  // Purpose and workflow explanation lookup
  const getExplanation = (type) => {
    switch (type) {
      case 'PA_SPEAKER':
        return {
          purpose: 'Facility-wide and zone-targeted public address acoustic actuator.',
          workflow: 'Admin issues announcement → backend routes to zone speakers → simulator synthesizes speech via Web Speech API → playback confirmed.',
          note: 'Speakers are actuators that receive and play audio broadcasts. They do not report physical sensor telemetry.'
        };
      case 'REED_SWITCH':
        return {
          purpose: 'Magnetic reed switch detecting physical door open/close boundary contact.',
          workflow: 'Door moves → magnetic field aligns/breaks contact → ESP32 detects GPIO interrupt → event published to backend → synced in real time.',
          note: 'Detects physical door position only; does not confirm whether electrical deadbolt solenoid is engaged.'
        };
      case 'DOOR_LOCK':
        return {
          purpose: 'Electromechanical solenoid deadbolt actuator for high-security cell access.',
          workflow: 'Lock command issued → ESP32 drives relay/MOSFET → solenoid coil energized → bolt thrown → microswitch confirms locked state.',
          note: 'Must remain locked during facility lockdown. Controlled independently from door swing.'
        };
      case 'PIR_MOTION':
        return {
          purpose: 'Passive infrared human thermal movement sensor in corridors and restricted spines.',
          workflow: 'Thermal motion detected → pyroelectric sensor trips → ESP32 samples pulse → backend correlates with RFID badge scan window.',
          note: 'Triggers Rule B / Rule C if tripped during unauthorized hours without badge authorization.'
        };
      case 'IR_BREAK_BEAM':
        return {
          purpose: 'Optical infrared break-beam perimeter barrier across exterior fence lines.',
          workflow: 'Intruder crosses line → phototransistor light beam broken → ESP32 detects LOW logic level → perimeter breach alert.',
          note: 'Dual-sensor fusion with fence vibration sensors raises priority to CRITICAL.'
        };
      case 'VIBRATION':
        return {
          purpose: 'Piezoelectric disturbance detection on perimeter chain-link fence lines.',
          workflow: 'Mechanical climb/cut impact → piezoelectric crystal generates voltage spike → ESP32 ADC interrupt fires → MQTT alert.',
          note: 'Hardware threshold filtering prevents false alarms from ambient wind.'
        };
      case 'RFID_READER':
        return {
          purpose: 'Contactless 13.56 MHz RFID/NFC checkpoint badge access control reader.',
          workflow: 'Badge presented → reader reads card UID → backend evaluates RBAC permissions → access decision logged in audit ledger.',
          note: 'Grants temporary 30-second door opening window upon verified officer credential scan.'
        };
      default:
        return {
          purpose: 'Authoritative IoT telemetry and control node in PrisonGuard security matrix.',
          workflow: 'Hardware state synchronized through simulated ESP32 controller layer to backend.',
          note: 'All transitions logged to SHA-256 tamper-evident cryptographic audit ledger.'
        };
    }
  };

  const exp = getExplanation(device.type);

  // Sensor Toggle handler
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

  // Door control handlers
  const handleDoorTogglePosition = () => {
    if (!isDoor) return;
    const nextPos = device.position === 'OPEN' ? 'CLOSE' : 'OPEN';
    operateDoor(device.id, nextPos);
  };

  const handleDoorToggleLock = () => {
    if (!isDoor) return;
    const nextLock = device.lockState === 'LOCKED' ? 'UNLOCK' : 'LOCK';
    lockDoor(device.id, nextLock);
  };

  // Gate control handlers
  const handleGateToggle = () => {
    if (!isGate) return;
    const nextState = device.state === 'OPEN' ? 'CLOSE' : 'OPEN';
    commandGate(device.id, nextState);
  };

  const handleGateJam = () => {
    if (!isGate) return;
    jamGate(device.id);
  };

  return (
    <div className="absolute top-20 right-6 w-96 bg-[#0f172a]/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl shadow-2xl z-40 p-5 space-y-4 animate-in fade-in slide-in-from-right-4 select-none max-h-[85vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-700">
        <div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
            isOnline ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-red-950 text-red-300 border border-red-500/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-500'}`}></span>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
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

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2 px-3 border-b-2 transition ${
            activeTab === 'overview' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Device Overview
        </button>
        <button
          onClick={() => setActiveTab('trace')}
          className={`pb-2 px-3 border-b-2 transition ${
            activeTab === 'trace' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Communication Trace
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Hardware Specifications */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
              <span className="text-gray-400 text-[10px] block">Owning Gateway</span>
              <strong className="text-cyan-400 font-mono">{device.controllerId || 'ESP32-ACCESS-01'}</strong>
            </div>
            <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
              <span className="text-gray-400 text-[10px] block">GPIO Assignment</span>
              <strong className="text-emerald-400 font-mono">GPIO {device.gpio || (device.position ? 14 : 21)}</strong>
            </div>
            <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
              <span className="text-gray-400 text-[10px] block">Device Category</span>
              <span className="text-gray-200 font-medium">
                {isSpeaker ? 'ACTUATOR (AUDIO)' : isDoor ? 'BARRIER / DOOR' : isGate ? 'HEAVY ACTUATOR' : 'IOT SENSOR'}
              </span>
            </div>
            <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
              <span className="text-gray-400 text-[10px] block">Current State</span>
              <strong className="font-mono text-cyan-300">
                {device.position ? `${device.position} / ${device.lockState}` : device.state || device.value || 'STANDBY'}
              </strong>
            </div>
          </div>

          {/* Operational Workflow Explanations */}
          <div className="p-3 bg-[#080d1a] border border-slate-800 rounded-xl space-y-2 text-xs">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Operational Purpose</span>
              <p className="text-gray-300 text-xs mt-0.5">{exp.purpose}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">IoT Communication Path</span>
              <p className="text-gray-400 text-[11px] font-mono mt-0.5">{exp.workflow}</p>
            </div>
            {exp.note && (
              <div className="p-2 rounded bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-[11px] flex gap-2 items-start">
                <Info className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
                <span>{exp.note}</span>
              </div>
            )}
          </div>

          {/* Direct Simulator Test Controls */}
          <div className="pt-2 border-t border-slate-700/80 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Interactive Device Controls</span>

            {/* Door Controls */}
            {isDoor && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleDoorTogglePosition}
                    className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <DoorClosed className="w-3.5 h-3.5" />
                    <span>{device.position === 'OPEN' ? 'Close Door' : 'Open Door'}</span>
                  </button>
                  <button
                    onClick={handleDoorToggleLock}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      device.lockState === 'LOCKED'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                  >
                    {device.lockState === 'LOCKED' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>{device.lockState === 'LOCKED' ? 'Unlock Solenoid' : 'Lock Solenoid'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Gate Controls */}
            {isGate && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleGateToggle}
                  className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <DoorClosed className="w-3.5 h-3.5" />
                  <span>{device.state === 'OPEN' ? 'Close Gate' : 'Open Gate'}</span>
                </button>
                <button
                  onClick={handleGateJam}
                  className="py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Simulate Jam</span>
                </button>
              </div>
            )}

            {/* Speaker Info */}
            {isSpeaker && (
              <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg text-xs space-y-1">
                <span className="text-gray-400 block text-[10px]">Zone Coverage: <strong className="text-white">{device.zone}</strong></span>
                <span className="text-gray-400 block text-[10px]">Playback State: <strong className="text-cyan-300 font-mono">{device.state}</strong></span>
                {device.lastAnnouncement && (
                  <p className="text-gray-300 text-[11px] mt-1 border-t border-slate-800 pt-1">
                    Last Announcement: <em>"{device.lastAnnouncement.title}"</em>
                  </p>
                )}
              </div>
            )}

            {/* Sensor Direct Toggle */}
            {!isDoor && !isGate && !isSpeaker && (
              <button
                onClick={handleToggleState}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Simulate Sensor Event ({device.value})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'trace' && (
        <div className="space-y-3 text-xs">
          <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg text-[11px] text-gray-300 space-y-2">
            <span className="text-cyan-400 font-bold block uppercase text-[10px]">Hardware Communication Pipeline</span>
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>1. User Action / Sensor Trip</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>2. ESP32 GPIO Interrupt Triggered</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>3. Simulated MQTT Packet Published</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>4. Sensor Fusion Rule Engine Evaluated</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>5. WebSocket Broadcast to Connected Apps</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>6. Chained into SHA-256 Audit Ledger</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
