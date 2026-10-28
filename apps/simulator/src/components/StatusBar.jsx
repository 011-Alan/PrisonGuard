import React from 'react';
import { Shield, ExternalLink, Activity, Radio, Cpu, Volume2, VolumeX, Clock, AlertOctagon, Play, Pause, FastForward, PlayCircle, Users } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { ADMIN_URL } from '../config';

export default function StatusBar({ onOpenCommInspector }) {
  const { connected, latency, state, isAudioEnabled, setIsAudioEnabled, controlClock, startControlledEscape, startMassEscape } = useSocket();

  const activeScenario = state?.activeScenario;
  const systemHealth = state?.systemHealth || 98;
  const isLockdown = state?.lockdown?.isActive;
  const simClock = state?.simulationClock;
  const currentSpeed = simClock?.speed || 1;
  const isPaused = simClock?.isPaused || false;
  const controllers = state?.controllers ? Object.values(state.controllers) : [];
  const onlineControllers = controllers.filter(c => c.status === 'ONLINE').length;

  const handleSpeedChange = (speed) => {
    controlClock(speed, false);
  };

  const handlePauseToggle = () => {
    controlClock(currentSpeed, !isPaused);
  };

  return (
    <footer className="absolute bottom-4 left-4 right-4 md:left-auto bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl px-4 py-2 z-40 flex flex-wrap items-center justify-between md:justify-end gap-3 text-xs select-none">
      {/* Lockdown Alert Pill */}
      {isLockdown && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600/30 border border-red-500 text-red-400 font-mono text-[11px] font-bold animate-pulse">
          <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
          <span>LOCKDOWN ACTIVE</span>
        </div>
      )}

      {/* Active Scenario Elapsed Pill */}
      {activeScenario && (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-cyan-950/70 border border-cyan-500/50 text-cyan-300 font-mono text-[11px]">
          <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="font-bold">{activeScenario.name || activeScenario.id}</span>
          <span className="text-[10px] text-cyan-200">({Math.round(activeScenario.elapsedSimSeconds || 0)}s sim)</span>
        </div>
      )}

      {/* Simulation Clock & Accelerated Speed Controls (Section 15: Monotonic Accelerated Time) */}
      {simClock && (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700 text-gray-300 font-mono text-[11px]">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-white">{simClock.displayTime || '09:30:00'}</span>
          <span className="text-[10px] text-gray-400 hidden sm:inline">({simClock.currentPhase?.name || 'Routine'})</span>

          <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-slate-700">
            <button
              onClick={handlePauseToggle}
              title={isPaused ? "Resume Simulation Clock" : "Pause Simulation Clock"}
              className={`p-1 rounded hover:bg-slate-700 transition ${isPaused ? 'text-amber-400 bg-amber-950/40' : 'text-gray-400'}`}
            >
              {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </button>

            {[0.5, 1, 2, 5, 10, 30, 60, 120].map((spd) => (
              <button
                key={spd}
                onClick={() => handleSpeedChange(spd)}
                title={`Simulate at ${spd}x speed (${spd === 60 ? '1 sim hr/real min' : spd === 120 ? '2 sim hr/real min' : `${spd}x`})`}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                  currentSpeed === spd && !isPaused
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-slate-700/60'
                } ${spd > 10 ? 'hidden xl:inline' : spd > 2 ? 'hidden md:inline' : 'inline'}`}
              >
                {spd}×
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Scenario Triggers */}
      <div className="flex items-center gap-1.5 hidden xl:flex">
        <button
          onClick={() => startControlledEscape('WORKFLOW_A')}
          className="flex items-center gap-1 px-2 py-1 rounded bg-amber-950/50 hover:bg-amber-900/60 border border-amber-600/40 text-amber-300 font-mono text-[10px] font-semibold transition"
          title="Demo Controlled Single Prisoner Escape with Officer Interception"
        >
          <PlayCircle className="w-3 h-3 text-amber-400" />
          <span>Demo Escape</span>
        </button>
        <button
          onClick={() => startMassEscape()}
          className="flex items-center gap-1 px-2 py-1 rounded bg-red-950/50 hover:bg-red-900/60 border border-red-600/40 text-red-300 font-mono text-[10px] font-semibold transition"
          title="Demo Multi-Prisoner Coordinated Mass Escape"
        >
          <Users className="w-3 h-3 text-red-400" />
          <span>Mass Escape</span>
        </button>
      </div>

      {/* Controllers Gateway Status */}
      <div className="flex items-center gap-1.5 text-gray-300 font-mono text-[11px] pr-2 border-r border-slate-700 hidden lg:flex">
        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
        <span>ESP32: <strong className="text-white">{onlineControllers}/{controllers.length}</strong></span>
      </div>

      {/* Web Speech API Audio Toggle */}
      <button
        onClick={() => setIsAudioEnabled(!isAudioEnabled)}
        title={isAudioEnabled ? 'Click to Mute Simulator Audio' : 'Click to Enable Speech Synthesis Audio'}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold border transition ${
          isAudioEnabled
            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
            : 'bg-slate-800 border-slate-700 text-gray-400 hover:text-gray-200'
        }`}
      >
        {isAudioEnabled ? (
          <>
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>P.A. AUDIO ON</span>
          </>
        ) : (
          <>
            <VolumeX className="w-3.5 h-3.5 text-gray-400" />
            <span>P.A. MUTED</span>
          </>
        )}
      </button>

      {/* Backend Link Status */}
      <div className="flex items-center gap-2 font-mono text-[11px] pr-2 border-r border-slate-700">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></span>
        <span className={connected ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
          {connected ? `LIVE (${latency}ms)` : 'OFFLINE'}
        </span>
      </div>

      {/* Cross link to Website A (Admin Portal) */}
      <a
        href={ADMIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-semibold transition"
      >
        <Shield className="w-3.5 h-3.5" />
        <span>Admin Portal</span>
        <ExternalLink className="w-3 h-3 ml-0.5" />
      </a>
    </footer>
  );
}
