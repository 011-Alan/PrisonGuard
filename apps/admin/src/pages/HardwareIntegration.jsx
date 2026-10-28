import React, { useState } from 'react';
import {
  Cpu,
  Wifi,
  WifiOff,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sliders,
  Shield,
  Layers,
  ArrowRightLeft,
  Terminal,
  Radio,
  ExternalLink,
  Info,
  Clock,
  Sparkles
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function HardwareIntegration() {
  const {
    state,
    hardwareState,
    refreshState,
    toggleHardware,
    toggleHardwareSync,
    operatePhysicalDoor,
    testHardwareConnection
  } = useSocket();

  const [operatingDoor, setOperatingDoor] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('events'); // 'events' | 'commands' | 'setup'

  const hw = hardwareState || {
    enabled: false,
    connectionStatus: 'NOT_CONFIGURED',
    controllerId: 'ESP32-CELL-01',
    targetDoorId: 'DOOR-A101',
    syncHardwareToSimulation: false,
    isSimulated: false,
    lastCommunicationTime: null,
    lastPingRoundtripMs: null,
    lastError: null,
    physicalDoor: {
      id: 'DOOR-A101-PHYSICAL',
      name: 'Cell A-101 Physical Door',
      targetSoftwareDoorId: 'DOOR-A101',
      commandedState: 'UNKNOWN',
      servoAngle: 0,
      observedPhysicalState: 'UNKNOWN',
      sensorFeedback: { reedSwitch: 'UNKNOWN', lastTriggerTime: null },
      discrepancy: false,
      lastDiscrepancyReason: null,
      lastCommandTime: null
    },
    devices: {},
    pendingCommandsCount: 0,
    recentCommands: [],
    recentEvents: []
  };

  const softwareDoor = state?.doors?.[hw.targetDoorId] || {
    id: hw.targetDoorId,
    name: 'Cell A-101 Door',
    state: 'CLOSED',
    isLocked: true
  };

  const handleToggleEnable = async () => {
    try {
      await toggleHardware(!hw.enabled);
    } catch (err) {
      console.error('Failed to toggle hardware enabled:', err);
    }
  };

  const handleToggleSync = async () => {
    try {
      await toggleHardwareSync(!hw.syncHardwareToSimulation);
    } catch (err) {
      console.error('Failed to toggle hardware sync:', err);
    }
  };

  const handleOperateDoor = async (action) => {
    setOperatingDoor(true);
    try {
      await operatePhysicalDoor(action);
    } catch (err) {
      console.error('Failed to operate physical door:', err);
    } finally {
      setTimeout(() => setOperatingDoor(false), 500);
    }
  };

  const handleRunPingTest = async () => {
    setTestingPing(true);
    setTestResult(null);
    try {
      const res = await testHardwareConnection();
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, message: err.message || 'Connection test failed' });
    } finally {
      setTestingPing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            CONNECTED
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
            CONNECTING
          </span>
        );
      case 'DISCONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <WifiOff className="w-3 h-3 text-amber-400" />
            DISCONNECTED
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
            <XCircle className="w-3 h-3 text-red-400" />
            CONTROLLER ERROR
          </span>
        );
      case 'DISABLED':
      case 'NOT_CONFIGURED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-gray-400 border border-slate-700">
            <Cpu className="w-3 h-3 text-gray-400" />
            {status || 'DISABLED'}
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto text-white">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-borderMuted">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-wide text-white flex items-center gap-2">
                ESP32 Hardware Door Controller Integration
                {hw.isSimulated && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/40 text-purple-300 font-mono">
                    SIMULATED CONTROLLER ACTIVE
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Physical servo motor, magnetic reed switch, indicator LEDs and RC522 RFID access integration for Cell A-101
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunPingTest}
            disabled={testingPing || !hw.enabled}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
              testingPing
                ? 'bg-slate-800 text-gray-400 border-slate-700 cursor-not-allowed'
                : !hw.enabled
                ? 'bg-slate-900/60 text-gray-500 border-slate-800 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border-cyan-500/30 hover:border-cyan-400/50 shadow'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${testingPing ? 'animate-spin' : ''}`} />
            {testingPing ? 'Testing Link...' : 'Test Connection'}
          </button>

          <button
            onClick={() => refreshState()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-300 border border-slate-700 text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Connectivity Test Banner */}
      {testResult && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition ${
            testResult.success
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>
              <strong>Diagnostic Result:</strong> {testResult.message}
              {testResult.latencyMs !== null && testResult.latencyMs !== undefined && (
                <span className="ml-2 font-mono text-[11px] opacity-80">
                  (Roundtrip latency: {testResult.latencyMs} ms)
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-gray-400 hover:text-white px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Discrepancy Alert Banner */}
      {hw.physicalDoor?.discrepancy && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/60 shadow-lg shadow-red-950/50 flex items-start justify-between gap-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-900/50 border border-red-500/50 text-red-300 shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-300">
                PHYSICAL VS SOFTWARE DOOR DISCREPANCY DETECTED
              </h4>
              <p className="text-xs text-red-200/90 mt-1">
                {hw.physicalDoor.lastDiscrepancyReason ||
                  `Software door ${hw.targetDoorId} (${softwareDoor.state}) does not match physical sensor (${hw.physicalDoor.observedPhysicalState}).`}
              </p>
              <p className="text-[11px] text-red-300/70 mt-1 font-mono">
                Commanded: {hw.physicalDoor.commandedState} | Servo: {hw.physicalDoor.servoAngle}° | Reed Switch: {hw.physicalDoor.sensorFeedback?.reedSwitch}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleOperateDoor(softwareDoor.state === 'OPEN' ? 'OPEN' : 'CLOSE')}
              disabled={operatingDoor}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow transition"
            >
              Align Physical Door
            </button>
          </div>
        </div>
      )}

      {/* Top 4 KPI Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Connection Status & Master Toggle */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-borderMuted flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Integration Mode
            </span>
            {getStatusBadge(hw.connectionStatus)}
          </div>
          <div className="my-3">
            <div className="text-lg font-bold text-white flex items-center gap-2">
              {hw.enabled ? 'Hardware Active' : 'Software-Only Mode'}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              {hw.enabled
                ? 'Target door commands are routed to ESP32'
                : 'Software simulation operates independently'}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-gray-300 font-medium">Enable Integration</span>
            <button
              onClick={handleToggleEnable}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                hw.enabled ? 'bg-cyan-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  hw.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Card 2: Controller Heartbeat & Latency */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-borderMuted flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              ESP32 Controller
            </span>
            <span className="font-mono text-xs text-cyan-400 font-bold">
              {hw.controllerId}
            </span>
          </div>
          <div className="my-3">
            <div className="text-lg font-bold text-white flex items-center gap-2">
              {hw.lastPingRoundtripMs !== null ? `${hw.lastPingRoundtripMs} ms` : '—'}
              <span className="text-xs text-gray-400 font-normal">telemetry latency</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-gray-500" />
              <span>
                Last heartbeat:{' '}
                {hw.lastCommunicationTime
                  ? new Date(hw.lastCommunicationTime).toLocaleTimeString()
                  : 'Never'}
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-gray-400">Firmware Protocol:</span>
            <span className="text-gray-200 font-mono">REST / HTTP Polling</span>
          </div>
        </div>

        {/* Card 3: Bidirectional Sensor Sync */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-borderMuted flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Bidirectional Sync
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                hw.syncHardwareToSimulation
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-gray-400'
              }`}
            >
              {hw.syncHardwareToSimulation ? 'ACTIVE' : 'DISABLED'}
            </span>
          </div>
          <div className="my-3">
            <div className="text-base font-bold text-white flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
              <span>Hardware → Simulation</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Physical reed contact updates simulated cell door automatically
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-gray-300 font-medium">Sync Physical Changes</span>
            <button
              onClick={handleToggleSync}
              disabled={!hw.enabled}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                hw.syncHardwareToSimulation ? 'bg-cyan-600' : 'bg-slate-700'
              } ${!hw.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  hw.syncHardwareToSimulation ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Card 4: Target Door & Discrepancy Status */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-borderMuted flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Bound Target Door
            </span>
            <span className="font-mono text-xs text-amber-400 font-bold">
              {hw.targetDoorId}
            </span>
          </div>
          <div className="my-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Discrepancy Check:</span>
              {hw.physicalDoor?.discrepancy ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/80 text-red-400 border border-red-500/40">
                  DESYNC DETECTED
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                  STATES MATCH
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Queued commands waiting for polling: <span className="font-mono text-cyan-300 font-semibold">{hw.pendingCommandsCount}</span>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-gray-400">Fail-safe:</span>
            <span className="text-emerald-400 font-medium">Non-blocking decoupled</span>
          </div>
        </div>
      </div>

      {/* Main Dual-Panel: State Comparison & Actuation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Door Synchronization & Manual Actuation */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-5 rounded-2xl bg-[#111827] border border-borderSubtle space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-borderMuted">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  Cell A-101 Physical vs Software Door Synchronization
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Real-time cross-plane verification between 2D simulation and physical prototype
                </p>
              </div>
            </div>

            {/* Comparison Cards: Software Door vs Physical Door */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Software Door Box */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/60 relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    SIMULATION ENGINE
                  </span>
                  <span className="font-mono text-xs text-gray-400">{hw.targetDoorId}</span>
                </div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-400">Current Door State:</span>
                    <span
                      className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                        softwareDoor.state === 'OPEN'
                          ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                          : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                      }`}
                    >
                      {softwareDoor.state || 'CLOSED'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-400">Lock Mechanism:</span>
                    <span className="text-xs font-mono text-gray-300">
                      {softwareDoor.isLocked ? 'SECURED / LOCKED' : 'UNLOCKED'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-400">Location:</span>
                    <span className="text-xs font-mono text-gray-300">Cell Block A (A-101)</span>
                  </div>
                </div>
              </div>

              {/* Physical Door Box */}
              <div
                className={`p-4 rounded-xl border relative overflow-hidden ${
                  hw.physicalDoor?.discrepancy
                    ? 'bg-red-950/20 border-red-500/40'
                    : 'bg-slate-900/90 border-slate-700/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    PHYSICAL PROTOTYPE
                  </span>
                  <span className="font-mono text-xs text-gray-400">
                    {hw.physicalDoor?.id || 'DOOR-A101-PHYSICAL'}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-400">Commanded State:</span>
                    <span className="text-xs font-mono font-bold text-gray-200">
                      {hw.physicalDoor?.commandedState || 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-400">Servo Motor Angle:</span>
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      {hw.physicalDoor?.servoAngle !== undefined ? `${hw.physicalDoor.servoAngle}°` : '0°'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-400">Reed Switch Contact:</span>
                    <span
                      className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                        hw.physicalDoor?.sensorFeedback?.reedSwitch === 'OPEN'
                          ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                          : hw.physicalDoor?.sensorFeedback?.reedSwitch === 'CLOSED'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                          : 'text-gray-400'
                      }`}
                    >
                      {hw.physicalDoor?.sensorFeedback?.reedSwitch || 'UNKNOWN'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Hardware Door Operation Controls */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                    Direct Hardware Door Actuation
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    Command the physical servo motor independently (requires Hardware Integration enabled)
                  </p>
                </div>
                <div className="text-[11px] font-mono text-gray-500">
                  Target: <span className="text-cyan-400">{hw.controllerId}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => handleOperateDoor('OPEN')}
                  disabled={operatingDoor || !hw.enabled}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition ${
                    operatingDoor || !hw.enabled
                      ? 'bg-slate-800 text-gray-500 border border-slate-700/50 cursor-not-allowed'
                      : 'bg-amber-600/90 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/40'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  {operatingDoor ? 'Dispatching...' : 'Open Physical Door (90°)'}
                </button>

                <button
                  onClick={() => handleOperateDoor('CLOSE')}
                  disabled={operatingDoor || !hw.enabled}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition ${
                    operatingDoor || !hw.enabled
                      ? 'bg-slate-800 text-gray-500 border border-slate-700/50 cursor-not-allowed'
                      : 'bg-cyan-700/90 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-950/40'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  {operatingDoor ? 'Dispatching...' : 'Close Physical Door (0°)'}
                </button>
              </div>
            </div>

            {/* Safe Architectural Guarantees Note */}
            <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/20 text-[11px] text-blue-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong>Architectural Safety Guarantee:</strong> Software simulation operates completely non-blocking. If the ESP32 hardware loses power, drops Wi-Fi, or is completely powered down, the software door controls, scenario scripts, and inmate animations continue normal operations without latency or interruption.
              </div>
            </div>
          </div>

          {/* Physical Peripheral & GPIO Pin Registry */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-borderSubtle space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-borderMuted">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                ESP32 Hardware Peripherals & GPIO Assignments
              </h3>
              <span className="text-[11px] text-gray-400 font-mono">Model: ESP32-WROOM-32</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-gray-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-3">Device / Component</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Pin / Bus</th>
                    <th className="py-2 px-3">Current State</th>
                    <th className="py-2 px-3 text-right">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {/* Servo */}
                  <tr className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 text-white font-semibold">SERVO-DOOR-01</td>
                    <td className="py-2.5 px-3 text-cyan-400">PWM Servo Motor</td>
                    <td className="py-2.5 px-3 text-gray-300">GPIO 18</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                        {hw.physicalDoor?.servoAngle || 0}° ({hw.physicalDoor?.servoAngle === 90 ? 'OPEN' : 'CLOSED'})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-400 font-sans">Cell Door Actuator</td>
                  </tr>

                  {/* Reed Switch */}
                  <tr className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 text-white font-semibold">REED-A101-PHYSICAL</td>
                    <td className="py-2.5 px-3 text-cyan-400">Magnetic Contact</td>
                    <td className="py-2.5 px-3 text-gray-300">GPIO 4 (Pull-up)</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          hw.physicalDoor?.sensorFeedback?.reedSwitch === 'OPEN'
                            ? 'bg-amber-950/60 text-amber-400'
                            : 'bg-emerald-950/60 text-emerald-400'
                        }`}
                      >
                        {hw.physicalDoor?.sensorFeedback?.reedSwitch || 'CLOSED'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-400 font-sans">Door Position Sensor</td>
                  </tr>

                  {/* Green LED */}
                  <tr className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 text-white font-semibold">LED-GREEN-01</td>
                    <td className="py-2.5 px-3 text-cyan-400">Indicator LED</td>
                    <td className="py-2.5 px-3 text-gray-300">GPIO 2</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          hw.physicalDoor?.commandedState === 'OPEN'
                            ? 'bg-emerald-950/60 text-emerald-400'
                            : 'bg-slate-800 text-gray-500'
                        }`}
                      >
                        {hw.physicalDoor?.commandedState === 'OPEN' ? 'ON' : 'OFF'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-400 font-sans">Access Granted / Open</td>
                  </tr>

                  {/* Red LED */}
                  <tr className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 text-white font-semibold">LED-RED-01</td>
                    <td className="py-2.5 px-3 text-cyan-400">Indicator LED</td>
                    <td className="py-2.5 px-3 text-gray-300">GPIO 15</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          hw.physicalDoor?.discrepancy
                            ? 'bg-red-950/60 text-red-400'
                            : 'bg-slate-800 text-gray-500'
                        }`}
                      >
                        {hw.physicalDoor?.discrepancy ? 'ON (ALARM)' : 'OFF'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-400 font-sans">Locked / Discrepancy</td>
                  </tr>

                  {/* RFID RC522 */}
                  <tr className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 text-white font-semibold">RFID-RC522-01</td>
                    <td className="py-2.5 px-3 text-cyan-400">13.56 MHz Reader</td>
                    <td className="py-2.5 px-3 text-gray-300">SPI (SS:5, RST:22)</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">READY</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-400 font-sans">Physical Badge Access</td>
                  </tr>

                  {/* Buzzer */}
                  <tr className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 text-white font-semibold">BUZZER-01</td>
                    <td className="py-2.5 px-3 text-cyan-400">Piezo Sounder</td>
                    <td className="py-2.5 px-3 text-gray-300">GPIO 13</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400">STANDBY</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-400 font-sans">Audio Confirmation</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Events, Commands & Simulator Assistant */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 rounded-2xl bg-[#111827] border border-borderSubtle flex flex-col h-[700px]">
            {/* Sub-tab navigation */}
            <div className="flex items-center justify-between pb-3 border-b border-borderMuted">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveSubTab('events')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeSubTab === 'events'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Live Events ({hw.recentEvents?.length || 0})
                </button>
                <button
                  onClick={() => setActiveSubTab('commands')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeSubTab === 'commands'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Command History ({hw.recentCommands?.length || 0})
                </button>
                <button
                  onClick={() => setActiveSubTab('setup')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeSubTab === 'setup'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Setup Guide
                </button>
              </div>
            </div>

            {/* Tab 1: Live Hardware Events */}
            {activeSubTab === 'events' && (
              <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1 font-mono text-xs">
                {(!hw.recentEvents || hw.recentEvents.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs">
                    <Activity className="w-8 h-8 mb-2 opacity-40" />
                    <span>No hardware events recorded yet</span>
                    <span className="text-[11px] text-gray-600 mt-1">
                      Operate the door or run the simulated ESP32 script
                    </span>
                  </div>
                ) : (
                  hw.recentEvents.map((evt) => {
                    const isError = evt.type?.includes('ERROR') || evt.type?.includes('DISCREPANCY') || evt.type?.includes('DENIED');
                    const isDoor = evt.type?.includes('DOOR') || evt.type?.includes('REED');
                    const isRfid = evt.type?.includes('RFID');
                    return (
                      <div
                        key={evt.id}
                        className={`p-2.5 rounded-lg border text-[11px] leading-relaxed transition ${
                          isError
                            ? 'bg-red-950/20 border-red-500/30 text-red-200'
                            : isDoor
                            ? 'bg-slate-900/80 border-slate-800 text-cyan-200'
                            : isRfid
                            ? 'bg-purple-950/20 border-purple-500/30 text-purple-200'
                            : 'bg-slate-900/50 border-slate-800/80 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                          <span className="font-bold text-gray-300">{evt.type}</span>
                          <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-gray-300 font-sans">
                          {evt.details?.message || JSON.stringify(evt.details)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab 2: Command History */}
            {activeSubTab === 'commands' && (
              <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1 font-mono text-xs">
                {(!hw.recentCommands || hw.recentCommands.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs">
                    <Terminal className="w-8 h-8 mb-2 opacity-40" />
                    <span>No commands dispatched yet</span>
                  </div>
                ) : (
                  hw.recentCommands.map((cmd) => (
                    <div
                      key={cmd.id}
                      className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{cmd.type}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            cmd.status === 'ACKNOWLEDGED'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                              : cmd.status === 'DISPATCHED'
                              ? 'bg-blue-950/60 text-blue-400 border border-blue-500/30'
                              : cmd.status === 'TIMED_OUT'
                              ? 'bg-red-950/60 text-red-400 border border-red-500/30'
                              : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {cmd.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center justify-between">
                        <span>Action: {cmd.payload?.action} ({cmd.payload?.angle}°)</span>
                        <span>{new Date(cmd.createdAt).toLocaleTimeString()}</span>
                      </div>
                      {cmd.acknowledgedAt && (
                        <div className="text-[10px] text-emerald-400/80">
                          Acked at: {new Date(cmd.acknowledgedAt).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Setup & Hardware Simulator Instructions */}
            {activeSubTab === 'setup' && (
              <div className="flex-1 overflow-y-auto mt-4 space-y-4 text-xs pr-1 leading-relaxed text-gray-300">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Option 1: Test with Software Hardware Simulator
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    You can test the entire hardware pipeline on your computer without physical ESP32 boards using our mock controller script:
                  </p>
                  <pre className="p-2.5 rounded bg-black/60 border border-slate-800 text-[11px] text-cyan-300 font-mono select-all">
                    node server/scripts/simulate-esp32.js
                  </pre>
                  <p className="text-[10px] text-gray-500">
                    The simulator polls commands, simulates servo transit times, reports reed switch closure, and periodically sends RFID card presentations.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    Option 2: Flash Physical ESP32 Board
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    Complete ESP32 Arduino C++ firmware is provided in the repository:
                  </p>
                  <pre className="p-2.5 rounded bg-black/60 border border-slate-800 text-[11px] text-gray-300 font-mono">
                    firmware/esp32-door-controller/esp32-door-controller.ino
                  </pre>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-400 mt-2">
                    <li>Copy <code className="text-cyan-300">config.h.example</code> to <code className="text-cyan-300">config.h</code></li>
                    <li>Enter your Wi-Fi SSID and Password</li>
                    <li>Set backend server URL and Device Token</li>
                    <li>Flash to ESP32 using Arduino IDE or PlatformIO</li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 text-[11px] text-blue-300">
                  <strong>Electrical Recommendation:</strong> Power the SG90 or MG996R servo motor from an external 5V 1A+ DC power supply rather than the ESP32 3.3V pin to prevent voltage dips or controller reboots during motor transit.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
