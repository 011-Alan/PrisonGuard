import React from 'react';
import { ExternalLink, Compass } from 'lucide-react';

export default function MiniFacilityMap({ onNavigateToSimulator, onSelectZone }) {
  return (
    <div className="bg-[#111827] border border-borderMuted rounded-xl p-5 relative overflow-hidden flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
          <h3 className="text-sm font-bold text-white tracking-wide">Facility Overview</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Normal</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span>Warning</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>Critical</span>
          </div>
          <button
            onClick={onNavigateToSimulator}
            className="flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
          >
            <span>Full 2D Simulator</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stylized Tactical SVG Floor Plan Schematic */}
      <div className="relative w-full flex-1 min-h-[220px] max-h-[300px] flex items-center justify-center bg-[#0d1322]/80 rounded-lg border border-slate-800/80 p-2">
        {/* Compass N indicator */}
        <div className="absolute top-3 left-4 flex flex-col items-center text-gray-500 text-[10px] font-mono">
          <Compass className="w-4 h-4 text-gray-400" />
          <span className="font-bold">N</span>
        </div>

        <svg viewBox="0 0 800 480" className="w-full h-full max-w-[700px]">
          <defs>
            <linearGradient id="wallGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="roomGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#162032" stopOpacity="0.9" />
            </linearGradient>
            <radialGradient id="alertGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Outer Perimeter Fence line */}
          <rect x="30" y="25" width="740" height="430" rx="8" fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="6,4" />
          {/* Inner Perimeter Wall */}
          <polygon points="70,55 730,55 710,425 90,425" fill="#0f172a" stroke="#475569" strokeWidth="3" />

          {/* Corner Towers */}
          <rect x="58" y="42" width="24" height="24" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
          <rect x="718" y="42" width="24" height="24" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
          <rect x="698" y="412" width="24" height="24" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
          <rect x="78" y="412" width="24" height="24" fill="#334155" stroke="#64748b" strokeWidth="1.5" />

          {/* Top Row: Block A, Block B, Block C */}
          {/* Block A */}
          <g className="cursor-pointer transition hover:opacity-80" onClick={() => onSelectZone && onSelectZone('BLOCK_A')}>
            <rect x="130" y="90" width="150" height="75" rx="4" fill="url(#roomGrad)" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.6" />
            <text x="205" y="132" fill="#cbd5e1" fontSize="12" fontWeight="700" textAnchor="middle" letterSpacing="1">BLOCK A</text>
            <text x="205" y="148" fill="#94a3b8" fontSize="9" textAnchor="middle">42 / 48</text>
          </g>

          {/* Block B */}
          <g className="cursor-pointer transition hover:opacity-80" onClick={() => onSelectZone && onSelectZone('BLOCK_B')}>
            <rect x="325" y="90" width="150" height="75" rx="4" fill="url(#roomGrad)" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.8" />
            <text x="400" y="132" fill="#cbd5e1" fontSize="12" fontWeight="700" textAnchor="middle" letterSpacing="1">BLOCK B</text>
            <text x="400" y="148" fill="#f59e0b" fontSize="9" textAnchor="middle">Warning (B-12)</text>
          </g>

          {/* Block C */}
          <g className="cursor-pointer transition hover:opacity-80" onClick={() => onSelectZone && onSelectZone('BLOCK_C')}>
            <rect x="520" y="90" width="150" height="75" rx="4" fill="url(#roomGrad)" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.6" />
            <text x="595" y="132" fill="#cbd5e1" fontSize="12" fontWeight="700" textAnchor="middle" letterSpacing="1">BLOCK C</text>
            <text x="595" y="148" fill="#94a3b8" fontSize="9" textAnchor="middle">38 / 48</text>
          </g>

          {/* Mid Row: Medical, Yard, Admin */}
          {/* Medical */}
          <g className="cursor-pointer transition hover:opacity-80" onClick={() => onSelectZone && onSelectZone('MEDICAL')}>
            <rect x="130" y="195" width="150" height="90" rx="4" fill="url(#roomGrad)" stroke="#10b981" strokeWidth="1" strokeOpacity="0.5" />
            <text x="205" y="242" fill="#cbd5e1" fontSize="12" fontWeight="700" textAnchor="middle" letterSpacing="1">MEDICAL</text>
            <text x="205" y="258" fill="#10b981" fontSize="9" textAnchor="middle">Ward 6/8</text>
          </g>

          {/* Yard */}
          <g className="cursor-pointer transition hover:opacity-80" onClick={() => onSelectZone && onSelectZone('YARD')}>
            <rect x="325" y="195" width="150" height="90" rx="4" fill="#15202b" stroke="#475569" strokeWidth="1" />
            <text x="400" y="242" fill="#94a3b8" fontSize="12" fontWeight="700" textAnchor="middle" letterSpacing="1">YARD</text>
            <text x="400" y="258" fill="#64748b" fontSize="9" textAnchor="middle">Exercise Rec</text>
          </g>

          {/* Admin */}
          <g className="cursor-pointer transition hover:opacity-80" onClick={() => onSelectZone && onSelectZone('ADMIN')}>
            <rect x="520" y="195" width="150" height="90" rx="4" fill="url(#roomGrad)" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.5" />
            <text x="595" y="242" fill="#cbd5e1" fontSize="12" fontWeight="700" textAnchor="middle" letterSpacing="1">ADMIN</text>
            <text x="595" y="258" fill="#94a3b8" fontSize="9" textAnchor="middle">Staff / Warden</text>
          </g>

          {/* Bottom Row: Isolation/Workshop, Sally Port Intake, Control Room */}
          <rect x="130" y="315" width="150" height="60" rx="4" fill="url(#roomGrad)" stroke="#475569" strokeWidth="1" />
          <text x="205" y="352" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle">ISOLATION</text>

          <rect x="345" y="360" width="110" height="55" rx="4" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
          <text x="400" y="392" fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle">ENTRY PORT</text>

          <rect x="520" y="315" width="150" height="60" rx="4" fill="url(#roomGrad)" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.8" />
          <text x="595" y="352" fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle">CONTROL (SOC)</text>

          {/* Interactive Gate and Sensor Beacon Indicators */}
          {/* North Gate G-01 */}
          <circle cx="400" cy="55" r="5" fill="#10b981" />
          <circle cx="400" cy="55" r="9" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.6" />

          {/* South Gate G-02 (Sally Port Outer) */}
          <circle cx="400" cy="425" r="5" fill="#10b981" />
          <circle cx="400" cy="425" r="9" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.6" />

          {/* East Perimeter Alert Beacon (RED FLASHING) */}
          <circle cx="720" cy="240" r="14" fill="url(#alertGlow)" className="animate-pulse" />
          <circle cx="720" cy="240" r="6" fill="#ef4444" />
          <circle cx="720" cy="240" r="10" fill="none" stroke="#ef4444" strokeWidth="2" className="animate-ping" />

          {/* Block B Door Alert Beacon (AMBER) */}
          <circle cx="400" cy="90" r="5" fill="#f59e0b" />
          <circle cx="400" cy="90" r="9" fill="none" stroke="#f59e0b" strokeWidth="1.5" />

          {/* West Gate */}
          <circle cx="80" cy="240" r="5" fill="#10b981" />

          {/* Medical Beacon */}
          <circle cx="130" cy="240" r="5" fill="#10b981" />
        </svg>
      </div>

      <div className="mt-2 text-right">
        <span className="text-[10px] text-gray-500 font-mono">
          Authoritative Real-Time 2D Telemetry Feed
        </span>
      </div>
    </div>
  );
}
