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
  Settings,
  CreditCard,
  KeyRound,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { API_BASE_URL } from '../config';

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

  // Dialog & Modal States
  const [confirmModal, setConfirmModal] = useState({ open: false, action: null });
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configForm, setConfigForm] = useState({
    controllerId: '',
    displayName: '',
    targetDoorId: ''
  });
  const [configSaving, setConfigSaving] = useState(false);

  // Operation States
  const [operatingDoor, setOperatingDoor] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('rfid'); // 'rfid' | 'commands' | 'events' | 'setup'

  const hw = hardwareState || {
    enabled: false,
    connectionStatus: 'NOT_CONFIGURED',
    controllerId: 'CELL-01-PHYSICAL',
    displayName: 'Cell A-101 Physical Door Controller',
    registrationState: 'REGISTERED',
    authenticationState: 'NOT_AUTHENTICATED',
    targetDoorId: 'DOOR-A101',
    syncHardwareToSimulation: false,
    isSimulated: false,
    lastCommunicationTime: null,
    lastPingRoundtripMs: null,
    lastError: null,
    physicalDoor: {
      id: 'DOOR-A101-PHYSICAL',
      name: 'Physical Prototype Cell Door (Cell A-101)',
      associatedLogicalDoorId: 'DOOR-A101',
      commandedState: 'CLOSED',
      servoAngle: 0,
      observedPhysicalState: 'CLOSED',
      physicalPositionVerified: false,
      positionNote: 'Physical position unverified; servo represents commanded state',
      discrepancy: false,
      lastUpdated: null
    },
    devices: {},
    pendingCommandsCount: 0,
    recentCommands: [],
    recentEvents: [],
    recentRfidScans: []
  };

  const softwareDoor = state?.doors?.[hw.targetDoorId] || {
    id: hw.targetDoorId,
    name: 'Cell A-101 Door',
    state: 'CLOSED',
    isLocked: true
  };

  const mostRecentCommand = hw.recentCommands && hw.recentCommands.length > 0 ? hw.recentCommands[0] : null;

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

  const requestDoorOperate = (action) => {
    setConfirmModal({ open: true, action });
  };

  const confirmDoorOperate = async () => {
    const action = confirmModal.action;
    setConfirmModal({ open: false, action: null });
    if (!action) return;

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

  const openConfigModal = () => {
    setConfigForm({
      controllerId: hw.controllerId || 'CELL-01-PHYSICAL',
      displayName: hw.displayName || 'Cell A-101 Physical Door Controller',
      targetDoorId: hw.targetDoorId || 'DOOR-A101'
    });
    setConfigModalOpen(true);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigSaving(true);
    try {
      const token = localStorage.getItem('pg_auth_token');
      const res = await fetch(`${API_BASE_URL}/api/hardware/device/configure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(configForm)
      });
      if (res.ok) {
        await refreshState();
        setConfigModalOpen(false);
      } else {
        const err = await res.json();
        alert(`Failed to configure device: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    } finally {
      setConfigSaving(false);
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

  const getLifecycleStageBadge = (cmd) => {
    if (!cmd) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-gray-400">
          No Recent Commands
        </span>
      );
    }

    if (cmd.status === 'TIMED_OUT' || cmd.lifecycleStage === 'COMMAND_FAILED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-red-950/80 text-red-400 border border-red-500/40">
          <XCircle className="w-3 h-3 text-red-400" />
          Command failed
        </span>
      );
    }
    if (cmd.status === 'DISPATCHED_OFFLINE' || cmd.lifecycleStage === 'DEVICE_DISCONNECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950/80 text-amber-400 border border-amber-500/40">
          <WifiOff className="w-3 h-3 text-amber-400" />
          Device disconnected
        </span>
      );
    }
    if (cmd.status === 'ACKNOWLEDGED' || cmd.lifecycleStage === 'COMMAND_EXECUTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Command executed
        </span>
      );
    }
    if (cmd.status === 'DELIVERED' || cmd.lifecycleStage === 'COMMAND_DELIVERED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-950/80 text-blue-400 border border-blue-500/40">
          <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
          Command delivered
        </span>
      );
    }
    // Default PENDING / REQUEST_ACCEPTED
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
        <Clock className="w-3 h-3 text-cyan-400" />
        Request accepted
      </span>
    );
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
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-wide text-white">
                  Physical Hardware Integration
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-900/40 border border-cyan-500/30 text-cyan-300">
                  {hw.controllerId}
                </span>
                {hw.isSimulated && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/40 text-purple-300 font-mono">
                    SIMULATED ESP32 ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                ESP32 DevKit V1 physical servo door actuator, RC522 contactless RFID reader, and status indicator LEDs
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openConfigModal}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-300 border border-slate-700 text-xs font-semibold transition"
          >
            <Settings className="w-3.5 h-3.5" />
            Configure Device
          </button>

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
              <strong>Diagnostic Result:</strong> {testResult.details || testResult.message}
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

      {/* Position Unverified Architectural Notice Banner */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex items-start justify-between gap-3 text-xs text-cyan-200">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong>Physical Position Unverified Notice:</strong> The breadboard prototype uses an open-loop Tower Pro SG90 micro servo.
            Because there is no physical limit switch, encoder, or door frame installed, reported servo angles represent <strong>commanded states</strong> rather than sensor-verified physical positions.
          </div>
        </div>
        <span className="shrink-0 font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
          PROTOTYPE DEMONSTRATION
        </span>
      </div>

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
                ? 'Target door commands route to physical ESP32'
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

        {/* Card 2: Controller Identity & Heartbeat */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-borderMuted flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Device Registration
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              {hw.registrationState || 'REGISTERED'}
            </span>
          </div>
          <div className="my-3">
            <div className="text-sm font-bold text-white truncate">
              {hw.displayName || 'Cell A-101 Physical Door Controller'}
            </div>
            <div className="text-[11px] font-mono text-cyan-400 mt-0.5">
              ID: {hw.controllerId}
            </div>
            <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-gray-500" />
              <span>
                Last contact:{' '}
                {hw.lastCommunicationTime
                  ? new Date(hw.lastCommunicationTime).toLocaleTimeString()
                  : 'Never'}
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-gray-400">Auth State:</span>
            <span className={`font-semibold ${
              hw.authenticationState === 'AUTHENTICATED' ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {hw.authenticationState || 'NOT_AUTHENTICATED'}
            </span>
          </div>
        </div>

        {/* Card 3: Commanded Servo & LED Indicators */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-borderMuted flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Commanded Servo State
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                hw.physicalDoor?.commandedState === 'OPEN'
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-gray-300 border border-slate-700'
              }`}
            >
              {hw.physicalDoor?.commandedState || 'CLOSED'} ({hw.physicalDoor?.servoAngle || 0}°)
            </span>
          </div>
          <div className="my-3">
            <div className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <span>LED Indicators:</span>
              <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                hw.physicalDoor?.commandedState === 'OPEN'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-950 text-red-400 border border-red-500/30'
              }`}>
                {hw.physicalDoor?.commandedState === 'OPEN' ? 'GREEN ON / RED OFF' : 'RED ON (LOCKED)'}
              </span>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Position feedback: <span className="text-amber-400 font-mono">Unverified</span>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-gray-400">Bound Door:</span>
            <span className="text-cyan-300 font-mono font-bold">{hw.targetDoorId}</span>
          </div>
        </div>

        {/* Card 4: Most Recent Command Lifecycle */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-borderMuted flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Command Lifecycle
            </span>
            {getLifecycleStageBadge(mostRecentCommand)}
          </div>
          <div className="my-3">
            {mostRecentCommand ? (
              <div>
                <div className="text-xs font-mono font-bold text-gray-200">
                  {mostRecentCommand.id} ({mostRecentCommand.action})
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  {mostRecentCommand.result || `Dispatched at ${new Date(mostRecentCommand.timestamp).toLocaleTimeString()}`}
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500">No hardware command dispatched</div>
            )}
          </div>
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-gray-400">Pending Polls:</span>
            <span className="font-mono text-cyan-300 font-semibold">{hw.pendingCommandsCount}</span>
          </div>
        </div>
      </div>

      {/* Main Dual-Panel: State Separation & Door Actuation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Separate Planes & Hardware Controls */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-5 rounded-2xl bg-[#111827] border border-borderSubtle space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-borderMuted">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  Dual-Plane Operational Status: Software Simulation vs Physical Breadboard
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Complete architectural separation between software-simulated prison cells and physical hardware prototype
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
                    SOFTWARE SIMULATION ENGINE
                  </span>
                  <span className="font-mono text-xs text-gray-400">{hw.targetDoorId}</span>
                </div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-400">Door Position:</span>
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
                    <span className="text-xs text-gray-400">Solenoid Lock:</span>
                    <span className="text-xs font-mono text-gray-300">
                      {softwareDoor.isLocked ? 'SECURED / LOCKED' : 'UNLOCKED'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-400">Logical Location:</span>
                    <span className="text-xs font-mono text-gray-300">Cell Block A (A-101)</span>
                  </div>
                </div>
              </div>

              {/* Physical Door Box */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/60 relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    PHYSICAL BREADBOARD PROTOTYPE
                  </span>
                  <span className="font-mono text-xs text-gray-400">{hw.controllerId}</span>
                </div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-400">Commanded State:</span>
                    <span className="text-sm font-bold font-mono text-cyan-300">
                      {hw.physicalDoor?.commandedState || 'CLOSED'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-400">SG90 Servo Angle:</span>
                    <span className="text-xs font-mono font-bold text-gray-200">
                      {hw.physicalDoor?.servoAngle !== undefined ? `${hw.physicalDoor.servoAngle}°` : '0°'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-400">Physical Verification:</span>
                    <span className="text-[11px] font-mono text-amber-400 font-semibold">
                      UNVERIFIED (No limit switch)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Hardware Door Actuation Controls */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                    Authoritative Hardware Door Actuation
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    Dispatches explicit hardware commands to the physical ESP32 controller (requires confirmation)
                  </p>
                </div>
                <div className="text-[11px] font-mono text-gray-400">
                  Target: <span className="text-cyan-400 font-bold">{hw.controllerId}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => requestDoorOperate('OPEN')}
                  disabled={operatingDoor || !hw.enabled}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition ${
                    operatingDoor || !hw.enabled
                      ? 'bg-slate-800 text-gray-500 border border-slate-700/50 cursor-not-allowed'
                      : 'bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                  }`}
                >
                  <Unlock className="w-3.5 h-3.5" />
                  {operatingDoor ? 'Dispatching...' : 'Open Physical Door (90°)'}
                </button>

                <button
                  onClick={() => requestDoorOperate('CLOSE')}
                  disabled={operatingDoor || !hw.enabled}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition ${
                    operatingDoor || !hw.enabled
                      ? 'bg-slate-800 text-gray-500 border border-slate-700/50 cursor-not-allowed'
                      : 'bg-cyan-700/90 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-950/40'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  {operatingDoor ? 'Dispatching...' : 'Close Physical Door (0°)'}
                </button>
              </div>
            </div>

            {/* Sync Toggle Option */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-gray-200">Reflect Physical Commands to Software Simulation</div>
                <div className="text-[11px] text-gray-400">
                  When enabled, physical door commands will synchronize Cell A-101 in the 2D canvas simulation.
                </div>
              </div>
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

          {/* Physical Peripheral & GPIO Pin Registry */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-borderSubtle space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-borderMuted">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Physical Hardware Manifest & Pin Assignments
              </h3>
              <span className="text-[11px] text-gray-400 font-mono">Microcontroller: ESP32 DevKit V1</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-gray-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-3">Component</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">ESP32 Pin</th>
                    <th className="py-2 px-3">Current State</th>
                    <th className="py-2 px-3 text-right">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {/* SG90 Servo */}
                  <tr className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 text-white font-semibold">Tower Pro SG90</td>
                    <td className="py-2.5 px-3 text-cyan-400">9g Micro Servo</td>
                    <td className="py-2.5 px-3 text-gray-300">GPIO 13 (PWM)</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                        {hw.physicalDoor?.servoAngle || 0}° ({hw.physicalDoor?.commandedState || 'CLOSED'})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-400 font-sans">Breadboard Door Actuator</td>
                  </tr>

                  {/* Red LED */}
                  <tr className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 text-white font-semibold">Red Indicator LED</td>
                    <td className="py-2.5 px-3 text-cyan-400">5mm LED (220Ω)</td>
                    <td className="py-2.5 px-3 text-gray-300">GPIO 25</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          hw.physicalDoor?.commandedState !== 'OPEN'
                            ? 'bg-red-950/60 text-red-400 border border-red-500/30'
                            : 'bg-slate-800 text-gray-500'
                        }`}
                      >
                        {hw.physicalDoor?.commandedState !== 'OPEN' ? 'ON (LOCKED)' : 'OFF'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-400 font-sans">Locked / Denied Indicator</td>
                  </tr>

                  {/* Green LED */}
                  <tr className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 text-white font-semibold">Green Indicator LED</td>
                    <td className="py-2.5 px-3 text-cyan-400">5mm LED (220Ω)</td>
                    <td className="py-2.5 px-3 text-gray-300">GPIO 26</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          hw.physicalDoor?.commandedState === 'OPEN'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-gray-500'
                        }`}
                      >
                        {hw.physicalDoor?.commandedState === 'OPEN' ? 'ON (OPEN)' : 'OFF'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-400 font-sans">Access Granted Indicator</td>
                  </tr>

                  {/* RFID RC522 */}
                  <tr className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 text-white font-semibold">RC522 13.56MHz</td>
                    <td className="py-2.5 px-3 text-cyan-400">RFID SPI Module</td>
                    <td className="py-2.5 px-3 text-gray-300">SPI (5, 18, 19, 22, 23)</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">READY</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-400 font-sans">Contactless Badge Reader</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): RFID Scans, Command History & Events */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 rounded-2xl bg-[#111827] border border-borderSubtle flex flex-col h-[700px]">
            {/* Sub-tab navigation */}
            <div className="flex items-center justify-between pb-3 border-b border-borderMuted">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveSubTab('rfid')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeSubTab === 'rfid'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  RFID Access ({hw.recentRfidScans?.length || 0})
                </button>
                <button
                  onClick={() => setActiveSubTab('commands')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeSubTab === 'commands'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Commands ({hw.recentCommands?.length || 0})
                </button>
                <button
                  onClick={() => setActiveSubTab('events')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeSubTab === 'events'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Events ({hw.recentEvents?.length || 0})
                </button>
                <button
                  onClick={() => setActiveSubTab('setup')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeSubTab === 'setup'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Instructions
                </button>
              </div>
            </div>

            {/* Tab 1: Recent RFID Badge Access Results */}
            {activeSubTab === 'rfid' && (
              <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1 font-mono text-xs">
                {(!hw.recentRfidScans || hw.recentRfidScans.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs text-center p-4">
                    <CreditCard className="w-8 h-8 mb-2 opacity-40 text-cyan-400" />
                    <span>No physical RFID scans recorded yet</span>
                    <span className="text-[11px] text-gray-600 mt-1">
                      Present an RFID card to the RC522 reader or run the test runner
                    </span>
                  </div>
                ) : (
                  hw.recentRfidScans.map((scan) => (
                    <div
                      key={scan.id}
                      className={`p-3 rounded-lg border text-[11px] space-y-1.5 transition ${
                        scan.granted
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                          : 'bg-red-950/20 border-red-500/40 text-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5">
                          {scan.granted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                          )}
                          {scan.decision || (scan.granted ? 'GRANTED' : 'DENIED')}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(scan.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-gray-300 font-sans flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">{scan.personName || 'Unregistered Card'}</span>
                        <span className="font-mono text-[10px] text-gray-400">{scan.cardUid}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-sans">
                        Reason: {scan.reason}
                      </div>
                    </div>
                  ))
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
                        {getLifecycleStageBadge(cmd)}
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center justify-between">
                        <span>Action: {cmd.payload?.action} ({cmd.payload?.angle}°)</span>
                        <span>{new Date(cmd.timestamp).toLocaleTimeString()}</span>
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

            {/* Tab 3: Hardware Events */}
            {activeSubTab === 'events' && (
              <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1 font-mono text-xs">
                {(!hw.recentEvents || hw.recentEvents.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs">
                    <Activity className="w-8 h-8 mb-2 opacity-40" />
                    <span>No hardware events recorded</span>
                  </div>
                ) : (
                  hw.recentEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px]"
                    >
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                        <span className="font-bold text-gray-300">{evt.type}</span>
                        <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-gray-400 text-[10px] truncate font-sans">
                        {evt.details?.message || JSON.stringify(evt.details)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 4: Instructions */}
            {activeSubTab === 'setup' && (
              <div className="flex-1 overflow-y-auto mt-4 space-y-4 text-xs pr-1 leading-relaxed text-gray-300">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    Step-by-Step Hardware Setup
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-gray-400">
                    <li>Connect the <strong>Tower Pro SG90</strong> servo PWM to <strong>GPIO 13</strong>.</li>
                    <li>Connect the <strong>RC522 RFID</strong> module to SPI pins: SS $\rightarrow$ <strong>GPIO 5</strong>, SCK $\rightarrow$ <strong>18</strong>, MOSI $\rightarrow$ <strong>23</strong>, MISO $\rightarrow$ <strong>19</strong>, RST $\rightarrow$ <strong>22</strong>.</li>
                    <li>Wire the <strong>Red LED</strong> to <strong>GPIO 25</strong> and <strong>Green LED</strong> to <strong>GPIO 26</strong> through 220Ω resistors.</li>
                    <li>Flash firmware from <code className="text-cyan-300">firmware/esp32-door-controller/</code>.</li>
                  </ol>
                </div>

                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-300">
                  <strong>Power Notice:</strong> Do not power the SG90 servo from the ESP32 3.3V pin. Power from an external 5V DC supply or verified USB power rail with grounds tied together.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Explicit Door Actuation Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-cyan-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Confirm Physical Actuation
                </h3>
                <p className="text-xs text-gray-400">
                  Target Device: <span className="font-mono text-cyan-300">{hw.controllerId}</span>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2 text-gray-300">
              <p>
                Are you sure you want to command the physical servo door to{' '}
                <strong className={confirmModal.action === 'OPEN' ? 'text-emerald-400 font-bold' : 'text-cyan-400 font-bold'}>
                  {confirmModal.action} ({confirmModal.action === 'OPEN' ? '90°' : '0°'})
                </strong>?
              </p>
              <p className="text-[11px] text-gray-400">
                This will rotate the physical Tower Pro SG90 micro servo and update the indicator LEDs on the breadboard.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModal({ open: false, action: null })}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDoorOperate}
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-lg transition ${
                  confirmModal.action === 'OPEN'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                    : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-950/50'
                }`}
              >
                Confirm & Dispatch Command
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Configuration Modal */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-borderMuted">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Configure Hardware Device</h3>
              </div>
              <button
                onClick={() => setConfigModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Device Identifier (Controller ID)
                </label>
                <input
                  type="text"
                  value={configForm.controllerId}
                  onChange={(e) => setConfigForm({ ...configForm, controllerId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                  required
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Unique hardware device identifier (e.g. CELL-01-PHYSICAL). Must match CONTROLLER_ID in firmware.
                </p>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Registered Display Name
                </label>
                <input
                  type="text"
                  value={configForm.displayName}
                  onChange={(e) => setConfigForm({ ...configForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Associated Software Cell Door
                </label>
                <input
                  type="text"
                  value={configForm.targetDoorId}
                  onChange={(e) => setConfigForm({ ...configForm, targetDoorId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-amber-300 focus:outline-none focus:border-cyan-500"
                  required
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Logical door ID in the prison simulation engine (default: DOOR-A101).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-500/30 text-[11px] text-blue-300 space-y-1">
                <div><strong>Authentication Credential:</strong> Provisioned via <code className="text-cyan-300">HARDWARE_DEVICE_TOKEN</code>.</div>
                <div>To update secrets, configure the backend environment variables.</div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setConfigModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={configSaving}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-950/50 transition"
                >
                  {configSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
