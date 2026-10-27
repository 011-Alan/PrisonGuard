import React, { useState } from 'react';
import { Cpu, Wifi, WifiOff, Activity, AlertOctagon, CheckCircle2, RefreshCw } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import ConfirmationModal from '../components/ConfirmationModal';

export default function IoTDeviceStatus() {
  const { state, toggleController, triggerSensor } = useSocket();
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null, isDanger: true });
  const [selectedController, setSelectedController] = useState('ESP32-CELL-01');

  const controllers = state?.controllers ? Object.values(state.controllers) : [];
  const devices = state?.devices ? Object.values(state.devices) : [];

  const handleToggleController = (ctrl) => {
    const nextStatus = ctrl.status === 'ONLINE' ? false : true;
    setConfirmModal({
      isOpen: true,
      title: `${nextStatus ? 'Reconnect' : 'Disconnect'} ${ctrl.name}`,
      message: nextStatus
        ? `Restore network heartbeat and telemetry connection to ${ctrl.id}? Attached sensors will return to ONLINE status.`
        : `Simulate power/network outage on ${ctrl.id}. All ${ctrl.ownedDevices.length} attached subordinate sensors will transition to OFFLINE / UNKNOWN, and Rule F (Controller Loss) will trigger.`,
      isDanger: !nextStatus,
      action: async () => {
        await toggleController(ctrl.id, nextStatus);
        setConfirmModal({ isOpen: false });
      }
    });
  };

  const currentCtrl = state?.controllers?.[selectedController] || controllers[0];
  const attachedDevices = devices.filter(d => d.controllerId === currentCtrl?.id);

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
          <h2 className="text-xl font-bold text-white tracking-wide">IoT Hardware & ESP32 Controller Fleet</h2>
          <p className="text-xs text-gray-400 mt-1">Microcontroller telemetry, GPIO pin mapping, sensor status, and fault injection</p>
        </div>
      </div>

      {/* Controllers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {controllers.map((ctrl) => {
          const isOnline = ctrl.status === 'ONLINE';
          const isSelected = selectedController === ctrl.id;
          return (
            <div
              key={ctrl.id}
              onClick={() => setSelectedController(ctrl.id)}
              className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-[#152033] border-cyan-500/60 shadow-lg shadow-cyan-950/40'
                  : 'bg-[#111827] border-borderMuted hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-borderMuted">
                  <div className="flex items-center gap-2">
                    <Cpu className={`w-4 h-4 ${isOnline ? 'text-cyan-400' : 'text-gray-500'}`} />
                    <span className="font-bold text-white text-xs">{ctrl.id}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isOnline
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-950/60 text-red-300 border border-red-500/30'
                  }`}>
                    {ctrl.status}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-[11px] text-gray-300">
                  <p className="font-semibold text-gray-200">{ctrl.name}</p>
                  <p className="text-gray-400">{ctrl.location}</p>
                  <p className="font-mono text-gray-500">IP: {ctrl.ip}</p>
                  <p className="font-mono text-gray-500">Firmware: {ctrl.firmware}</p>
                  <p className="text-cyan-400 font-mono text-[10px]">Devices: {ctrl.ownedDevices.length} assigned</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-borderMuted flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-mono">
                  Uptime: {Math.floor(ctrl.uptimeSec / 60)}m
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleController(ctrl);
                  }}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${
                    isOnline
                      ? 'bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-500/30'
                      : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isOnline ? 'Disconnect' : 'Reconnect'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subordinate Devices Table for Selected Controller */}
      {currentCtrl && (
        <div className="bg-[#111827] border border-borderMuted rounded-xl overflow-hidden shadow">
          <div className="p-4 border-b border-borderMuted flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Subordinate Sensors & Actuators: {currentCtrl.name} ({currentCtrl.id})</h3>
            </div>
            <span className="text-xs text-gray-400 font-mono">Controller State: <strong className={currentCtrl.status === 'ONLINE' ? 'text-emerald-400' : 'text-red-400'}>{currentCtrl.status}</strong></span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b0f19] text-gray-400 font-semibold border-b border-borderMuted uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Device ID & Name</th>
                  <th className="py-3 px-4">Hardware Type</th>
                  <th className="py-3 px-4">Physical Location</th>
                  <th className="py-3 px-4">ESP32 GPIO Pin</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4">Current Telemetry</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {attachedDevices.map((dev) => {
                  const isOnline = dev.status === 'ONLINE';
                  return (
                    <tr key={dev.id} className="hover:bg-slate-900/50 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{dev.name}</div>
                        <div className="text-[10px] font-mono text-gray-500">{dev.id}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-300">{dev.type}</td>
                      <td className="py-3 px-4 text-gray-400">{dev.location}</td>
                      <td className="py-3 px-4 font-mono text-cyan-400 font-bold">GPIO {dev.gpio}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isOnline
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-950/60 text-red-300 border border-red-500/30'
                        }`}>
                          {dev.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white">{dev.value}</td>
                      <td className="py-3 px-4 text-right">
                        {dev.type === 'REED_SWITCH' && (
                          <button
                            onClick={() => triggerSensor(dev.id, dev.value === 'OPEN' ? 'CLOSED' : 'OPEN')}
                            disabled={!isOnline}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded text-xs font-semibold disabled:opacity-40"
                          >
                            Toggle Contact
                          </button>
                        )}
                        {dev.type === 'PIR_MOTION' && (
                          <button
                            onClick={() => triggerSensor(dev.id, dev.value === 'DETECTED' ? 'CLEAR' : 'DETECTED')}
                            disabled={!isOnline}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded text-xs font-semibold disabled:opacity-40"
                          >
                            Trip Motion
                          </button>
                        )}
                        {dev.type === 'IR_BREAK_BEAM' && (
                          <button
                            onClick={() => triggerSensor(dev.id, dev.value === 'BROKEN' ? 'INTACT' : 'BROKEN')}
                            disabled={!isOnline}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded text-xs font-semibold disabled:opacity-40"
                          >
                            Break Beam
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
      )}
    </div>
  );
}
