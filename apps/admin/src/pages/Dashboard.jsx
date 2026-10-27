import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  DoorClosed,
  Shield,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Lock,
  Unlock,
  Megaphone,
  HeartPulse,
  FileText,
  Clock,
  ArrowRight,
  AlertOctagon,
  Volume2,
  Play,
  Pause,
  FastForward
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import MiniFacilityMap from '../components/MiniFacilityMap';
import ConfirmationModal from '../components/ConfirmationModal';
import CommunicationMonitor from '../components/CommunicationMonitor';
import { SIMULATOR_URL } from '../config';

export default function Dashboard({ onNavigateTab }) {
  const { state, commandGate, ackIncident, broadcastAnnouncement, activateLockdown, releaseLockdown, controlClock } = useSocket();
  const [selectedGate, setSelectedGate] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null, isDanger: true });
  const [announcementModal, setAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [announcementZones, setAnnouncementZones] = useState(['ALL']);

  const gatesList = state?.gates ? Object.values(state.gates) : [];
  const incidents = state?.incidents || [];
  const recentActivities = state?.recentActivity || [];
  const controllers = state?.controllers ? Object.values(state.controllers) : [];
  const isLockdown = state?.lockdown?.isActive;
  const simClock = state?.simulationClock;

  const openGatesCount = gatesList.filter(g => g.state === 'OPEN' || g.state === 'OPENING').length;
  const criticalIncidentsCount = incidents.filter(i => i.severity === 'CRITICAL' && i.status === 'ACTIVE').length;

  // Handlers for Quick Actions
  const handleLockdownTrigger = () => {
    setConfirmModal({
      isOpen: true,
      title: 'EMERGENCY FACILITY LOCKDOWN',
      message: 'This will immediately command all perimeter gates, corridor blast barriers, and cell blocks to lock. Security alarms will activate across all sectors. Real-time telemetry will stream to all connected nodes.',
      isDanger: true,
      action: async () => {
        await activateLockdown({ scope: 'FULL_FACILITY' });
        setConfirmModal({ isOpen: false });
      }
    });
  };

  const handleLockdownRelease = () => {
    setConfirmModal({
      isOpen: true,
      title: 'RELEASE EMERGENCY LOCKDOWN',
      message: 'Are you sure you want to release emergency facility lockdown? Normal security postures, door permissions, and daily routines will resume.',
      isDanger: false,
      action: async () => {
        await releaseLockdown();
        setConfirmModal({ isOpen: false });
      }
    });
  };

  const handleGateToggle = (gate) => {
    const nextState = gate.state === 'OPEN' ? 'CLOSE' : 'OPEN';
    setConfirmModal({
      isOpen: true,
      title: `${nextState === 'OPEN' ? 'Open' : 'Close'} ${gate.name}`,
      message: `Are you sure you want to command ${gate.name} to ${nextState}? Ensure clearance is visually verified.`,
      isDanger: nextState === 'OPEN',
      action: async () => {
        await commandGate(gate.id, nextState);
        setConfirmModal({ isOpen: false });
      }
    });
  };

  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    if (!announcementTitle.trim()) return;
    await broadcastAnnouncement(announcementTitle, announcementMsg, announcementZones, true);
    setAnnouncementModal(false);
    setAnnouncementTitle('');
    setAnnouncementMsg('');
  };

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDanger={confirmModal.isDanger}
        onConfirm={confirmModal.action}
        onCancel={() => setConfirmModal({ isOpen: false })}
      />

      {/* Make Announcement Modal */}
      {announcementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-borderSubtle rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-cyan-400" />
              Facility Public Announcement
            </h3>
            <form onSubmit={handleAnnouncementSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-300 font-semibold block mb-1">Announcement Subject</label>
                <input
                  type="text"
                  required
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="e.g. Mandatory Cell Count / Yard Recall"
                  className="w-full bg-[#0b0f19] border border-borderMuted rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-gray-300 font-semibold block mb-1">Detailed Message</label>
                <textarea
                  rows="3"
                  value={announcementMsg}
                  onChange={(e) => setAnnouncementMsg(e.target.value)}
                  placeholder="Enter broadcast instructions for officers and inmates..."
                  className="w-full bg-[#0b0f19] border border-borderMuted rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                ></textarea>
              </div>
              <div>
                <label className="text-gray-300 font-semibold block mb-1">Target P.A. Speakers / Zones</label>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {[
                    { id: 'ALL', label: 'All Facility Speakers' },
                    { id: 'BLOCK_A', label: 'Cell Block A' },
                    { id: 'BLOCK_B', label: 'Cell Block B' },
                    { id: 'BLOCK_C', label: 'Cell Block C' },
                    { id: 'YARD', label: 'Common Exercise Yard' },
                    { id: 'MEDICAL', label: 'Medical Ward' },
                    { id: 'ADMIN', label: 'Administration' },
                    { id: 'SPINE', label: 'Central Secure Spine' }
                  ].map(z => (
                    <label key={z.id} className="flex items-center gap-1.5 p-1.5 rounded bg-[#0b0f19] border border-borderMuted cursor-pointer text-gray-300">
                      <input
                        type="checkbox"
                        checked={announcementZones.includes(z.id)}
                        onChange={(e) => {
                          if (z.id === 'ALL') {
                            setAnnouncementZones(['ALL']);
                          } else {
                            const withoutAll = announcementZones.filter(x => x !== 'ALL');
                            if (e.target.checked) {
                              setAnnouncementZones([...withoutAll, z.id]);
                            } else {
                              const remaining = withoutAll.filter(x => x !== z.id);
                              setAnnouncementZones(remaining.length === 0 ? ['ALL'] : remaining);
                            }
                          }
                        }}
                        className="rounded accent-cyan-500"
                      />
                      <span>{z.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="p-2 rounded bg-cyan-950/30 border border-cyan-800/40 text-cyan-300 text-[11px]">
                <span>Broadcast will be synthesized via Web Speech API on the Simulator and logged to audit.</span>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAnnouncementModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg"
                >
                  Broadcast Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Emergency Facility Lockdown Banner */}
      {isLockdown && (
        <div className="bg-red-600/90 text-white font-extrabold text-xs tracking-wider uppercase py-2.5 px-4 rounded-xl flex items-center justify-between gap-3 shadow-xl backdrop-blur-md animate-pulse">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 fill-white text-red-600" />
            <span>FACILITY EMERGENCY LOCKDOWN ACTIVE • ALL PERIMETER GATES & CELL DOORS SECURED</span>
          </div>
          <button
            onClick={handleLockdownRelease}
            className="px-3 py-1 bg-white hover:bg-gray-100 text-red-600 font-bold rounded-lg text-xs transition"
          >
            Release Lockdown
          </button>
        </div>
      )}

      {/* Synchronized Facility Simulation Clock Bar */}
      {simClock && (
        <div className="bg-[#111827] border border-borderMuted rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white text-base">{simClock.displayTime || '09:30:00'}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-cyan-300 border border-slate-700">
                  {simClock.currentPhase?.name || 'Standard Routine'}
                </span>
              </div>
              <span className="text-[11px] text-gray-400 font-mono">
                {simClock.currentPhase?.timeRange} • {simClock.currentPhase?.description}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-gray-400 text-[10px] pr-1">Sim Speed:</span>
            {[
              { val: 1, label: '1x' },
              { val: 2, label: '2x' },
              { val: 5, label: '5x' }
            ].map(s => (
              <button
                key={s.val}
                onClick={() => controlClock({ speed: s.val, isPaused: false })}
                className={`px-2 py-1 rounded text-xs font-bold transition ${
                  simClock.speed === s.val && !simClock.isPaused
                    ? 'bg-cyan-600 text-white'
                    : 'bg-[#0b0f19] hover:bg-slate-800 text-gray-300'
                }`}
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={() => controlClock({ isPaused: !simClock.isPaused })}
              className={`p-1.5 rounded transition ${
                simClock.isPaused
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-[#0b0f19] hover:bg-slate-800 text-gray-300'
              }`}
              title={simClock.isPaused ? 'Resume Clock' : 'Pause Clock'}
            >
              {simClock.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* TOP METRIC CARDS ROW (Matching Screenshot) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Prisoners */}
        <div className="bg-[#111827] border border-borderMuted rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Prisoners</span>
            <div className="p-2 rounded-lg bg-blue-950/40 text-blue-400 border border-blue-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">248</div>
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <span>↑ +2 today</span>
            </div>
          </div>
        </div>

        {/* Total Guards */}
        <div className="bg-[#111827] border border-borderMuted rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Guards</span>
            <div className="p-2 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-500/20">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">42</div>
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Online: 38</span>
            </div>
          </div>
        </div>

        {/* Cells Occupied */}
        <div className="bg-[#111827] border border-borderMuted rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Cells Occupied</span>
            <div className="p-2 rounded-lg bg-purple-950/40 text-purple-400 border border-purple-500/20">
              <DoorClosed className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-white">118 <span className="text-xs text-gray-400 font-normal">/ 152</span></span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30">78%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: '78%' }}></div>
            </div>
          </div>
        </div>

        {/* Gates Open */}
        <div className="bg-[#111827] border border-borderMuted rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Gates Open</span>
            <div className="p-2 rounded-lg bg-amber-950/40 text-amber-400 border border-amber-500/20">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{openGatesCount} <span className="text-xs text-gray-400 font-normal">/ {gatesList.length}</span></div>
            <div className="text-[11px] text-amber-400 font-medium flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>1 pending / open</span>
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-[#111827] border border-borderMuted rounded-xl p-4 flex flex-col justify-between hover:border-red-500/30 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Active Alerts</span>
            <div className="p-2 rounded-lg bg-red-950/40 text-red-400 border border-red-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{incidents.filter(i => i.status === 'ACTIVE').length}</div>
            <div className="text-[11px] text-red-400 font-medium flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              <span>{criticalIncidentsCount} Critical</span>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-[#111827] border border-borderMuted rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">System Health</span>
            <div className="p-2 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{state?.systemHealth || 98}%</div>
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <span>All systems operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Map & Controls (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Facility Map Schematic Card */}
          <div className="h-[360px]">
            <MiniFacilityMap
              onNavigateToSimulator={() => window.open(SIMULATOR_URL, '_blank')}
              onSelectZone={(zone) => onNavigateTab && onNavigateTab('facility')}
            />
          </div>

          {/* Bottom Triple Row: Occupancy Overview, Gate Status, Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Occupancy Overview */}
            <div className="bg-[#111827] border border-borderMuted rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2 border-b border-borderMuted">
                <span className="text-xs font-bold text-white tracking-wide">Occupancy Overview</span>
                <button
                  onClick={() => onNavigateTab && onNavigateTab('tracking')}
                  className="text-[11px] text-cyan-400 hover:underline"
                >
                  View Details &rarr;
                </button>
              </div>

              <div className="space-y-2.5 my-3 text-xs">
                <div>
                  <div className="flex justify-between text-gray-300 text-[11px] mb-1">
                    <span>Block A</span>
                    <span className="font-mono text-gray-400">42 / 48 (88%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '88%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-gray-300 text-[11px] mb-1">
                    <span>Block B</span>
                    <span className="font-mono text-gray-400">38 / 48 (79%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '79%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-gray-300 text-[11px] mb-1">
                    <span>Block C</span>
                    <span className="font-mono text-gray-400">38 / 48 (79%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '79%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-gray-300 text-[11px] mb-1">
                    <span>Medical</span>
                    <span className="font-mono text-gray-400">6 / 8 (75%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: '75%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-gray-300 text-[11px] mb-1">
                    <span>Isolation</span>
                    <span className="font-mono text-gray-400">4 / 8 (50%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: '50%' }}></div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-borderMuted flex items-center justify-between text-[11px] text-gray-400">
                <span>Occupied: <strong className="text-white">216</strong></span>
                <span>Total Capacity: <strong className="text-white">248</strong></span>
              </div>
            </div>

            {/* Gate Status Panel */}
            <div className="bg-[#111827] border border-borderMuted rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2 border-b border-borderMuted">
                <span className="text-xs font-bold text-white tracking-wide">Gate Status</span>
                <button
                  onClick={() => onNavigateTab && onNavigateTab('facility')}
                  className="text-[11px] text-cyan-400 hover:underline"
                >
                  View All &rarr;
                </button>
              </div>

              <div className="space-y-2 my-2 text-xs divide-y divide-slate-800/60 max-h-[170px] overflow-y-auto pr-1">
                {gatesList.slice(0, 5).map((gate) => {
                  const isOpen = gate.state === 'OPEN' || gate.state === 'OPENING';
                  const isJammed = gate.state === 'JAMMED';
                  return (
                    <div key={gate.id} className="pt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isJammed ? 'bg-red-500 animate-ping' : isOpen ? 'bg-amber-400' : 'bg-emerald-500'}`}></span>
                        <span className="text-gray-300 font-medium text-[11px] truncate max-w-[110px]">{gate.name}</span>
                      </div>
                      <button
                        onClick={() => handleGateToggle(gate)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                          isJammed
                            ? 'bg-red-950 text-red-400 border border-red-500/40'
                            : isOpen
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40 hover:bg-amber-900/60'
                            : 'bg-slate-800 text-gray-300 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        {gate.state}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-borderMuted text-right">
                <span className="text-[10px] text-gray-500 font-mono">Live Actuator Interlock Status</span>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-[#111827] border border-borderMuted rounded-xl p-4 flex flex-col justify-between">
              <div className="pb-2 border-b border-borderMuted">
                <span className="text-xs font-bold text-white tracking-wide">Quick Actions</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 my-3">
                <button
                  onClick={() => onNavigateTab && onNavigateTab('facility')}
                  className="p-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg flex flex-col items-center justify-center text-center gap-1.5 transition group"
                >
                  <Unlock className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-semibold text-gray-200">Open Gate</span>
                </button>

                {isLockdown ? (
                  <button
                    onClick={handleLockdownRelease}
                    className="p-3 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/50 rounded-lg flex flex-col items-center justify-center text-center gap-1.5 transition group"
                  >
                    <Unlock className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
                    <span className="text-[11px] font-bold text-emerald-300">Release Lock</span>
                  </button>
                ) : (
                  <button
                    onClick={handleLockdownTrigger}
                    className="p-3 bg-red-950/40 hover:bg-red-900/50 border border-red-500/40 rounded-lg flex flex-col items-center justify-center text-center gap-1.5 transition group"
                  >
                    <Lock className="w-4 h-4 text-red-400 group-hover:scale-110 transition" />
                    <span className="text-[11px] font-bold text-red-300">Lock Down</span>
                  </button>
                )}

                <button
                  onClick={() => setAnnouncementModal(true)}
                  className="p-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg flex flex-col items-center justify-center text-center gap-1.5 transition group"
                >
                  <Megaphone className="w-4 h-4 text-blue-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-semibold text-gray-200">Broadcast</span>
                </button>

                <button
                  onClick={() => onNavigateTab && onNavigateTab('healthcare')}
                  className="p-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg flex flex-col items-center justify-center text-center gap-1.5 transition group"
                >
                  <HeartPulse className="w-4 h-4 text-rose-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-semibold text-gray-200">Medical Req</span>
                </button>
              </div>

              <button
                onClick={() => onNavigateTab && onNavigateTab('reports')}
                className="w-full py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded text-center text-[11px] text-gray-400 hover:text-white transition flex items-center justify-center gap-1"
              >
                <FileText className="w-3 h-3" />
                <span>Generate Shift Audit Report</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Active Alerts, Recent Activity & IoT System Status (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Alerts Panel (Matching Screenshot) */}
          <div className="bg-[#111827] border border-borderMuted rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 border-b border-borderMuted">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-bold text-white tracking-wide">Live Alerts</span>
              </div>
              <button
                onClick={() => onNavigateTab && onNavigateTab('security')}
                className="text-[11px] text-cyan-400 hover:underline"
              >
                View All &rarr;
              </button>
            </div>

            <div className="space-y-2.5 mt-3">
              {incidents.filter(i => i.status === 'ACTIVE').slice(0, 3).map((incident) => {
                const isCrit = incident.severity === 'CRITICAL';
                const isWarn = incident.severity === 'WARNING';
                return (
                  <div
                    key={incident.id}
                    className={`p-3 rounded-lg border flex items-start justify-between gap-2.5 transition ${
                      isCrit
                        ? 'bg-red-950/25 border-red-500/40 text-red-200'
                        : isWarn
                        ? 'bg-amber-950/25 border-amber-500/40 text-amber-200'
                        : 'bg-blue-950/25 border-blue-500/40 text-blue-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isCrit ? 'bg-red-500 animate-ping' : isWarn ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                        <h4 className="text-xs font-bold text-white">{incident.title}</h4>
                      </div>
                      <p className="text-[11px] text-gray-400 pl-4">{incident.location}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isCrit ? 'bg-red-600 text-white' : isWarn ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {incident.severity}
                      </span>
                      <button
                        onClick={() => ackIncident(incident.id)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-mono"
                      >
                        Acknowledge
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity Feed (Matching Screenshot) */}
          <div className="bg-[#111827] border border-borderMuted rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 border-b border-borderMuted">
              <span className="text-xs font-bold text-white tracking-wide">Recent Activity</span>
              <button
                onClick={() => onNavigateTab && onNavigateTab('audit')}
                className="text-[11px] text-cyan-400 hover:underline"
              >
                View All &rarr;
              </button>
            </div>

            <div className="space-y-3 mt-3 max-h-[220px] overflow-y-auto pr-1">
              {recentActivities.slice(0, 6).map((act) => {
                const dotColor = act.color === 'red' ? 'bg-red-500' : act.color === 'amber' ? 'bg-amber-500' : act.color === 'green' ? 'bg-emerald-500' : 'bg-blue-500';
                return (
                  <div key={act.id} className="flex items-start justify-between text-xs gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${dotColor}`}></span>
                      <div>
                        <p className="text-gray-200 font-medium text-[11px]">{act.event}</p>
                        <p className="text-[10px] text-gray-500">{act.location}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-gray-500 shrink-0">{act.timeFormatted}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System Metrics / IoT Status (Matching Screenshot) */}
          <div className="bg-[#111827] border border-borderMuted rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 border-b border-borderMuted">
              <span className="text-xs font-bold text-white tracking-wide">System Status</span>
              <button
                onClick={() => onNavigateTab && onNavigateTab('iot')}
                className="text-[11px] text-cyan-400 hover:underline"
              >
                View Details &rarr;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
              <div className="p-2.5 bg-[#0b0f19] border border-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-gray-400 text-[11px]">ESP32 Nodes</span>
                <span className="font-mono text-emerald-400 font-bold">24 / 24</span>
              </div>
              <div className="p-2.5 bg-[#0b0f19] border border-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-gray-400 text-[11px]">Guard Gate</span>
                <span className="font-mono text-emerald-400 font-bold">Online</span>
              </div>
              <div className="p-2.5 bg-[#0b0f19] border border-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-gray-400 text-[11px]">Cameras</span>
                <span className="font-mono text-emerald-400 font-bold">16 / 16</span>
              </div>
              <div className="p-2.5 bg-[#0b0f19] border border-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-gray-400 text-[11px]">Network</span>
                <span className="font-mono text-emerald-400 font-bold">Online</span>
              </div>
              <div className="p-2.5 bg-[#0b0f19] border border-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-gray-400 text-[11px]">Door Sensors</span>
                <span className="font-mono text-amber-400 font-bold">28 / 30 ●</span>
              </div>
              <div className="p-2.5 bg-[#0b0f19] border border-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-gray-400 text-[11px]">Database</span>
                <span className="font-mono text-emerald-400 font-bold">Online</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-borderMuted">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-gray-400">Power & Mesh Connectivity</span>
                <span className="font-mono text-emerald-400 font-bold">100%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Communication Monitor & Telemetry Trace */}
      <CommunicationMonitor />
    </div>
  );
}
