import React, { useState } from 'react';
import {
  Shield,
  Radio,
  UserCheck,
  AlertTriangle,
  HeartPulse,
  Send,
  CheckCircle2,
  Clock,
  KeyRound,
  Ban,
  Activity,
  MapPin,
  ChevronRight,
  RefreshCw,
  Search,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { SIMULATOR_URL } from '../config';

const COMMAND_TYPES = [
  { id: 'PATROL_ZONE', label: '1. Patrol Designated Zone', defaultTarget: 'W_CORRIDOR_MAIN' },
  { id: 'ESCORT_PRISONER', label: '2. Escort Inmate', defaultTarget: 'W_MED_TREATMENT' },
  { id: 'INTERCEPT_INMATE', label: '3. Intercept Fleeing Inmate', defaultTarget: 'W_PERIM_NE' },
  { id: 'RESPOND_TO_BREACH', label: '4. Respond to Security Breach', defaultTarget: 'W_YARD_GATE' },
  { id: 'CONDUCT_CELL_INSPECTION', label: '5. Conduct Cell Inspection', defaultTarget: 'W_CELL_01' },
  { id: 'MONITOR_RECREATION_YARD', label: '6. Monitor Recreation Yard', defaultTarget: 'W_YARD_CENTER' },
  { id: 'SECURE_GATE', label: '7. Secure Perimeter Gate', defaultTarget: 'W_SALLY_BAY' },
  { id: 'LOCKDOWN_BLOCK', label: '8. Enforce Cell Block Lockdown', defaultTarget: 'W_CORRIDOR_NORTH' },
  { id: 'ASSIST_MEDICAL', label: '9. Assist Medical Emergency', defaultTarget: 'W_MED_WARD' },
  { id: 'RELIEVE_POST', label: '10. Relieve Security Post', defaultTarget: 'W_ADMIN_SOC' },
  { id: 'STAND_BY', label: '11. Tactical Stand By', defaultTarget: 'W_CORRIDOR_MAIN' },
  { id: 'REPORT_STATUS', label: '12. Report Operational Status', defaultTarget: 'W_ADMIN_SOC' }
];

const TARGET_WAYPOINTS = [
  { id: 'W_CORRIDOR_MAIN', label: 'Main Central Corridor' },
  { id: 'W_CORRIDOR_NORTH', label: 'North Cell Corridor' },
  { id: 'W_CELL_01', label: 'Cell Block 01' },
  { id: 'W_CELL_02', label: 'Cell Block 02' },
  { id: 'W_CELL_03', label: 'Cell Block 03' },
  { id: 'W_YARD_CENTER', label: 'Recreation Yard (Center)' },
  { id: 'W_YARD_GATE', label: 'Recreation Yard Security Gate' },
  { id: 'W_SALLY_BAY', label: 'Sally Port Vehicle Bay' },
  { id: 'W_MED_WARD', label: 'Medical Ward' },
  { id: 'W_MED_TREATMENT', label: 'Medical Treatment Examination' },
  { id: 'W_ADMIN_SOC', label: 'Central Security SOC' },
  { id: 'W_PERIM_NE', label: 'Perimeter Northeast Sector' },
  { id: 'W_PERIM_GATE_OUT', label: 'Perimeter Outer Gate' }
];

export default function OfficerOperations() {
  const { state, dispatchOfficerTask, revokeOfficerCredential, applyHealthChange } = useSocket();
  const [selectedOfficerId, setSelectedOfficerId] = useState('OFF-201');
  const [commandType, setCommandType] = useState('PATROL_ZONE');
  const [targetWaypointId, setTargetWaypointId] = useState('W_CORRIDOR_MAIN');
  const [priority, setPriority] = useState('ROUTINE');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [search, setSearch] = useState('');

  const people = state?.people ? Object.values(state.people) : [];
  const officers = people.filter(p => p.type === 'OFFICER' || p.type === 'SUPERVISOR' || p.type === 'MEDICAL_DOCTOR' || p.type === 'MEDICAL_NURSE');

  const selectedOfficer = officers.find(o => o.id === selectedOfficerId) || officers[0];

  const filteredOfficers = officers.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) || (o.role || '').toLowerCase().includes(q);
  });

  const availableCount = officers.filter(o => o.availability === 'AVAILABLE' || (!o.availability && o.status !== 'INCAPACITATED')).length;
  const revokedCount = officers.filter(o => o.credentialStatus === 'REVOKED').length;
  const injuredCount = officers.filter(o => (o.health || 100) < 100).length;

  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!selectedOfficer) return;
    setIsSubmitting(true);
    setActionFeedback(null);
    try {
      await dispatchOfficerTask({
        officerId: selectedOfficer.id,
        commandType,
        targetWaypointId,
        priority,
        note: note || undefined
      });
      setActionFeedback({ type: 'success', message: `Operational command ${commandType} transmitted to ${selectedOfficer.name} via VHF radio.` });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message || 'Dispatch failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeCredential = async (officerId) => {
    if (!confirm(`Confirm revocation of security RFID credentials for ${officerId}? Access to all secure doors and gates will be immediately disabled.`)) return;
    try {
      await revokeOfficerCredential(officerId);
      setActionFeedback({ type: 'success', message: `RFID Credential for ${officerId} REVOKED. Facility doors will reject all future badge taps.` });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleHealthTweak = async (officerId, delta, reason) => {
    try {
      await applyHealthChange(officerId, delta, reason);
      setActionFeedback({ type: 'success', message: `Health update applied to ${officerId} (${delta > 0 ? '+' : ''}${delta} HP: ${reason})` });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto select-none">
      {/* Top Header & Telemetry Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-borderMuted">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-black text-white uppercase tracking-wider">Tactical Officer Operations Center</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Real-time officer telemetry, 12 operational commands, radio acknowledgement protocol, and RFID credential management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`${SIMULATOR_URL}?focusPerson=${selectedOfficer?.id || 'OFF-201'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950/60 hover:bg-blue-900 border border-blue-500/40 text-blue-300 rounded-lg text-xs font-semibold transition"
          >
            <span>Live Simulator Camera</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-borderSubtle rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400">Total Field Personnel</span>
            <div className="text-2xl font-extrabold text-white mt-0.5">{officers.length}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-950/70 border border-blue-500/30 text-blue-400">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111827] border border-borderSubtle rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400">Available / On Standby</span>
            <div className="text-2xl font-extrabold text-emerald-400 mt-0.5">{availableCount}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-950/70 border border-emerald-500/30 text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111827] border border-borderSubtle rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400">Injured / Under Care</span>
            <div className="text-2xl font-extrabold text-amber-400 mt-0.5">{injuredCount}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-950/70 border border-amber-500/30 text-amber-400">
            <HeartPulse className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111827] border border-borderSubtle rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400">Credentials Revoked</span>
            <div className="text-2xl font-extrabold text-red-400 mt-0.5">{revokedCount}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-red-950/70 border border-red-500/30 text-red-400">
            <Ban className="w-5 h-5" />
          </div>
        </div>
      </div>

      {actionFeedback && (
        <div className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between animate-in fade-in ${
          actionFeedback.type === 'success'
            ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
            : 'bg-red-950/70 border-red-500/40 text-red-300'
        }`}>
          <span>{actionFeedback.message}</span>
          <button onClick={() => setActionFeedback(null)} className="text-gray-400 hover:text-white text-sm ml-3">✕</button>
        </div>
      )}

      {/* Main 2-Column Layout: Officer Roster vs Dispatch Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Officer Roster (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Field Personnel Telemetry</h2>
            </div>
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter officers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#111827] border border-borderMuted rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredOfficers.map((off) => {
              const isSelected = selectedOfficer?.id === off.id;
              const isRevoked = off.credentialStatus === 'REVOKED';
              const isOnline = off.communicationStatus !== 'OFFLINE';
              const hp = off.health ?? 100;

              return (
                <div
                  key={off.id}
                  onClick={() => setSelectedOfficerId(off.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-950/50 border-blue-500 shadow-md shadow-blue-950/50'
                      : 'bg-[#111827] border-borderSubtle hover:bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs border ${
                      off.type === 'SUPERVISOR'
                        ? 'bg-purple-950 text-purple-400 border-purple-500/40'
                        : off.type.includes('MEDICAL')
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                        : 'bg-blue-950 text-blue-400 border-blue-500/40'
                    }`}>
                      {off.id.replace('OFF-', 'G').replace('SUP-', 'S').replace('MED-', 'M')}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-white text-sm font-semibold">{off.name}</strong>
                        <span className="font-mono text-[10px] text-gray-400">({off.id})</span>
                        {isRevoked && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-red-950 text-red-400 border border-red-500/40">
                            REVOKED
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1">
                        <span className="flex items-center gap-1 text-gray-300">
                          <MapPin className="w-3 h-3 text-cyan-400" />
                          {off.currentRoom || 'Corridor'}
                        </span>
                        <span>•</span>
                        <span className={`font-semibold ${
                          off.availability === 'AVAILABLE' ? 'text-emerald-400' : 'text-blue-400'
                        }`}>
                          {off.officerState || off.status || 'AVAILABLE'}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-gray-400">VHF Ch 1</span>
                      </div>

                      {/* Radio message bubble snippet if present */}
                      {off.messageBubble?.text && (
                        <div className="mt-1.5 text-[10px] text-cyan-300 font-mono flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="truncate max-w-md">"{off.messageBubble.text}"</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side: Health & Telemetry Status */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0 pl-3">
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="text-[10px] text-gray-400">HP:</span>
                      <span className={`font-bold ${hp > 65 ? 'text-emerald-400' : hp > 25 ? 'text-amber-400' : 'text-red-400'}`}>
                        {hp}/100
                      </span>
                    </div>

                    <div className="w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          hp > 65 ? 'bg-emerald-500' : hp > 25 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${hp}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-mono text-gray-400 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-500'}`} />
                      <span>{isOnline ? 'LINK OK' : 'NO CARRIER'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Dispatch Panel & Credential Control (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Operational Dispatch Console</h2>
          </div>

          {selectedOfficer ? (
            <div className="bg-[#111827] border border-borderSubtle rounded-2xl p-5 space-y-5 shadow-xl">
              {/* Selected Officer Header Summary */}
              <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-gray-400">Target Officer</span>
                  <h3 className="text-base font-bold text-white">{selectedOfficer.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 font-mono">
                    <span>ID: {selectedOfficer.id}</span>
                    <span>•</span>
                    <span className="text-cyan-400">{selectedOfficer.assignedZone || 'All Zones'}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                    selectedOfficer.credentialStatus === 'REVOKED'
                      ? 'bg-red-950 text-red-400 border-red-500/40'
                      : 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                  }`}>
                    RFID: {selectedOfficer.credentialStatus || 'ACTIVE'}
                  </span>
                </div>
              </div>

              {/* Dispatch Form (12 Predefined Operational Commands) */}
              <form onSubmit={handleDispatch} className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-300 font-bold mb-1.5">
                    Predefined Operational Command (Section 3)
                  </label>
                  <select
                    value={commandType}
                    onChange={(e) => {
                      const ct = e.target.value;
                      setCommandType(ct);
                      const def = COMMAND_TYPES.find(c => c.id === ct);
                      if (def && def.defaultTarget) setTargetWaypointId(def.defaultTarget);
                    }}
                    className="w-full bg-[#080d1a] border border-borderMuted rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-blue-500"
                  >
                    {COMMAND_TYPES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 font-bold mb-1.5">
                    Target Sector / Waypoint
                  </label>
                  <select
                    value={targetWaypointId}
                    onChange={(e) => setTargetWaypointId(e.target.value)}
                    className="w-full bg-[#080d1a] border border-borderMuted rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-blue-500"
                  >
                    {TARGET_WAYPOINTS.map(w => (
                      <option key={w.id} value={w.id}>{w.label} ({w.id})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-300 font-bold mb-1.5">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full bg-[#080d1a] border border-borderMuted rounded-xl p-2 text-white font-medium focus:outline-none focus:border-blue-500"
                    >
                      <option value="ROUTINE">Routine (Normal)</option>
                      <option value="URGENT">Urgent (Expedited)</option>
                      <option value="EMERGENCY">Emergency (Code Red)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-300 font-bold mb-1.5">Radio Protocol</label>
                    <input
                      type="text"
                      disabled
                      value="Encrypted P25 VHF (CH-1)"
                      className="w-full bg-[#080d1a]/50 border border-slate-800 rounded-xl p-2 text-gray-400 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 font-bold mb-1.5">Tactical Instructions / Dispatch Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Verify cell door magnetic lock and inspect perimeter fence"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full bg-[#080d1a] border border-borderMuted rounded-xl p-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Transmitting Dispatch...' : `Dispatch Command to ${selectedOfficer.id}`}</span>
                </button>
              </form>

              {/* Credential Revocation & Health Override Tools */}
              <div className="pt-4 border-t border-borderMuted space-y-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">
                  Security Credential & Health Controls
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRevokeCredential(selectedOfficer.id)}
                    className="flex-1 py-2 px-3 bg-red-950/70 hover:bg-red-900 border border-red-500/50 text-red-300 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5 text-red-400" />
                    <span>Revoke RFID Access</span>
                  </button>

                  <button
                    onClick={() => handleHealthTweak(selectedOfficer.id, -30, 'Simulated Officer Injury')}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl font-medium text-xs transition"
                    title="Inflict -30 HP injury to simulate containment struggle"
                  >
                    -30 HP
                  </button>

                  <button
                    onClick={() => handleHealthTweak(selectedOfficer.id, 40, 'Medical Treatment Administered')}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-xl font-medium text-xs transition"
                    title="Restore +40 HP via medical triage"
                  >
                    +40 HP
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 border border-dashed border-slate-800 rounded-2xl">
              Select an officer from the roster to dispatch operational tasks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
