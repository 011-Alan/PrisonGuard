import React, { useState } from 'react';
import { Video, VideoOff, Eye, ShieldAlert, Cpu, Radio, AlertTriangle, Maximize2, X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { SIMULATOR_URL } from '../config';

export default function CctvMonitoring() {
  const { state, toggleCamera } = useSocket();
  const [selectedCam, setSelectedCam] = useState(null);
  const [filterZone, setFilterZone] = useState('ALL');

  const cameras = state?.cameras ? Object.values(state.cameras) : [];
  const simClock = state?.simulationClock;
  const currentTime = simClock?.displayTime || '09:30:00';

  const filteredCameras = cameras.filter(cam => {
    if (filterZone === 'ALL') return true;
    return cam.zone === filterZone;
  });

  const zones = ['ALL', 'COMMON_YARD', 'NORTH_CORRIDOR', 'SALLY_PORT', 'PERIMETER_EAST', 'PERIMETER_WEST', 'ADMIN_BUILDING', 'MEDICAL_WARD', 'CONTROL_ROOM'];

  const handleToggleStatus = async (e, cam) => {
    e.stopPropagation();
    const nextStatus = cam.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    await toggleCamera(cam.id, nextStatus);
    if (selectedCam?.id === cam.id) {
      setSelectedCam(prev => ({ ...prev, status: nextStatus }));
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1750px] mx-auto select-none">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-borderMuted">
        <div>
          <div className="flex items-center gap-2">
            <Video className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl font-bold text-white tracking-wide">CCTV Surveillance Grid & Perception Layer</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Simulated 2D top-down perspective camera feeds derived from authoritative facility world state and geometric line-of-sight.
          </p>
        </div>

        {/* Zone Filters */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#111827] p-1.5 rounded-xl border border-borderMuted text-xs">
          {zones.map(z => (
            <button
              key={z}
              onClick={() => setFilterZone(z)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                filterZone === z
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800'
              }`}
            >
              {z === 'ALL' ? 'All Cameras' : z.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Camera Grid (8 Camera Tiles) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {filteredCameras.map((cam) => {
          const isOnline = cam.status === 'ONLINE';
          const visibleEntities = cam.visibleEntities || [];
          const entityCount = visibleEntities.length;

          return (
            <div
              key={cam.id}
              onClick={() => setSelectedCam(cam)}
              className={`bg-[#0f172a] border rounded-2xl overflow-hidden shadow-xl hover:shadow-cyan-950/40 transition-all cursor-pointer group flex flex-col justify-between ${
                isOnline ? 'border-borderMuted hover:border-cyan-500/60' : 'border-red-900/60 bg-red-950/10'
              }`}
            >
              {/* Tile Top Bar */}
              <div className="px-3.5 py-2.5 bg-[#111827] border-b border-borderMuted flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></span>
                  <span className="font-bold text-xs text-white tracking-wider">{cam.id}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-gray-300 font-mono">
                    {cam.zone.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleToggleStatus(e, cam)}
                    title={isOnline ? "Simulate Camera Signal Loss (Set Offline)" : "Restore Camera Power (Set Online)"}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${
                      isOnline
                        ? 'bg-slate-800 hover:bg-red-950 hover:text-red-300 text-gray-400'
                        : 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900'
                    }`}
                  >
                    {isOnline ? 'Power Cut' : 'Restore'}
                  </button>
                  <Maximize2 className="w-3.5 h-3.5 text-gray-400 group-hover:text-cyan-400 transition" />
                </div>
              </div>

              {/* Slanted 2D Camera Viewport */}
              <div className="relative h-56 bg-[#070b14] overflow-hidden flex items-center justify-center">
                {isOnline ? (
                  <svg viewBox="-150 0 300 240" className="w-full h-full">
                    <defs>
                      <linearGradient id={`cctvFloorGrad-${cam.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#081020" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#0f1f38" stopOpacity="0.9" />
                      </linearGradient>
                      <radialGradient id={`cctvLens-${cam.id}`} cx="50%" cy="10%" r="90%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.12" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                      </radialGradient>
                    </defs>

                    {/* Slanted Trapezoidal Viewing Floor (Angled Security Cam Perspective) */}
                    <polygon
                      points="-40,15 40,15 140,225 -140,225"
                      fill={`url(#cctvFloorGrad-${cam.id})`}
                      stroke="#1e293b"
                      strokeWidth="1.5"
                    />

                    {/* Perspective Depth Grid Lines */}
                    <line x1="-60" y1="70" x2="60" y2="70" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3,3" />
                    <line x1="-90" y1="130" x2="90" y2="130" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3,3" />
                    <line x1="-120" y1="180" x2="120" y2="180" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3,3" />

                    {/* Ambient Lens Vignette Cone */}
                    <polygon
                      points="0,10 135,220 -135,220"
                      fill={`url(#cctvLens-${cam.id})`}
                    />

                    {/* Camera Mount Node at Top */}
                    <circle cx="0" cy="15" r="7" fill="#0b0f19" stroke="#38bdf8" strokeWidth="1.5" />
                    <circle cx="0" cy="15" r="2.5" fill="#38bdf8" />

                    {/* Visible Entities in Frame */}
                    {visibleEntities.map((ent, idx) => {
                      // Project entity relative coordinates onto perspective grid
                      const px = Math.max(-110, Math.min(110, ent.relativeX * 0.7));
                      const py = Math.max(35, Math.min(210, 30 + ent.distance * 0.7));
                      const isOfficer = ent.category === 'OFFICER' || ent.type === 'OFFICER';
                      const isDoctor = ent.category === 'MEDICAL' || ent.type?.includes('MEDICAL');
                      const color = isOfficer ? '#3b82f6' : isDoctor ? '#10b981' : '#f59e0b';
                      const label = isOfficer ? 'G' : isDoctor ? 'MD' : 'P';

                      return (
                        <g key={ent.id || idx} className="animate-in fade-in">
                          {/* Ground Target Ring */}
                          <ellipse cx={px} cy={py + 6} rx="12" ry="5" fill="none" stroke={color} strokeWidth="1" opacity="0.6" />
                          {/* Person Avatar */}
                          <circle cx={px} cy={py} r="7" fill={color} stroke="#ffffff" strokeWidth="1.5" />
                          <text x={px} y={py + 2.5} fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                            {label}
                          </text>
                          {/* Floating OSD Tag */}
                          <rect x={px - 26} y={py - 16} width="52" height="11" rx="2" fill="#090d16" stroke={color} strokeWidth="0.8" opacity="0.85" />
                          <text x={px} y={py - 8} fill="#ffffff" fontSize="5.5" fontWeight="bold" textAnchor="middle">
                            {ent.name.length > 10 ? ent.name.substring(0, 9) + '..' : ent.name}
                          </text>
                        </g>
                      );
                    })}

                    {/* Empty Frame Crosshair */}
                    {entityCount === 0 && (
                      <g opacity="0.25">
                        <line x1="-15" y1="120" x2="15" y2="120" stroke="#38bdf8" strokeWidth="1" />
                        <line x1="0" y1="105" x2="0" y2="135" stroke="#38bdf8" strokeWidth="1" />
                        <text x="0" y="148" fill="#38bdf8" fontSize="7" fontStyle="italic" textAnchor="middle">
                          NO MOTION IN FOV
                        </text>
                      </g>
                    )}
                  </svg>
                ) : (
                  /* Offline / Power Cut Static View */
                  <div className="flex flex-col items-center justify-center text-center p-4 space-y-2">
                    <VideoOff className="w-8 h-8 text-red-500 animate-pulse" />
                    <span className="font-mono text-xs font-bold text-red-400">FEED UNAVAILABLE</span>
                    <span className="text-[10px] text-gray-500 font-mono">ESP32-CAM-HUB: GPIO SIGNAL LOSS</span>
                  </div>
                )}

                {/* CCTV On-Screen Display (OSD) Overlays */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 font-mono text-[9px] text-red-400 font-bold bg-black/60 px-1.5 py-0.5 rounded">
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></span>
                  <span>{isOnline ? '● REC' : 'NO SIGNAL'}</span>
                </div>

                <div className="absolute top-2 right-2 font-mono text-[9px] text-gray-300 bg-black/60 px-1.5 py-0.5 rounded">
                  {currentTime}
                </div>

                <div className="absolute bottom-2 left-2 text-[8px] font-mono text-cyan-400 bg-black/70 px-1.5 py-0.5 rounded">
                  SIMULATED CCTV
                </div>

                <div className="absolute bottom-2 right-2 text-[8px] font-mono text-gray-300 bg-black/70 px-1.5 py-0.5 rounded">
                  TARGETS: {entityCount}
                </div>
              </div>

              {/* Tile Footer */}
              <div className="p-3 bg-[#0d1322] border-t border-borderMuted space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-gray-300">
                  <span className="font-semibold text-white truncate max-w-[170px]">{cam.name}</span>
                  <span className={`text-[10px] font-mono font-bold ${entityCount > 0 ? 'text-cyan-400' : 'text-gray-500'}`}>
                    {entityCount} in frame
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 flex items-center justify-between font-mono">
                  <span>Range: {cam.distance}px • FOV: {cam.fov}°</span>
                  <span className="text-gray-400 truncate max-w-[120px]">{cam.location}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Modal View for Selected Camera */}
      {selectedCam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-cyan-500/50 rounded-2xl w-full max-w-4xl p-6 shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-borderMuted">
              <div className="flex items-center gap-3">
                <Video className="w-6 h-6 text-cyan-400" />
                <div>
                  <h3 className="font-bold text-white text-base">{selectedCam.name}</h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                    <span>ID: {selectedCam.id}</span>
                    <span>•</span>
                    <span>Zone: {selectedCam.zone}</span>
                    <span>•</span>
                    <span className={selectedCam.status === 'ONLINE' ? 'text-emerald-400' : 'text-red-400'}>
                      {selectedCam.status}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedCam(null)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Expanded Screen Feed */}
            <div className="relative h-96 bg-[#060a12] rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
              {selectedCam.status === 'ONLINE' ? (
                <svg viewBox="-200 0 400 320" className="w-full h-full">
                  <polygon points="-60,20 60,20 180,300 -180,300" fill="#0a1528" stroke="#334155" strokeWidth="1.5" />
                  <line x1="-90" y1="100" x2="90" y2="100" stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />
                  <line x1="-130" y1="180" x2="130" y2="180" stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />
                  <line x1="-170" y1="250" x2="170" y2="250" stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />
                  <circle cx="0" cy="20" r="10" fill="#090d16" stroke="#38bdf8" strokeWidth="2" />
                  <circle cx="0" cy="20" r="3.5" fill="#38bdf8" />

                  {selectedCam.visibleEntities?.map((ent, idx) => {
                    const px = Math.max(-150, Math.min(150, ent.relativeX * 0.8));
                    const py = Math.max(50, Math.min(280, 40 + ent.distance * 0.8));
                    const isOfficer = ent.category === 'OFFICER';
                    const color = isOfficer ? '#3b82f6' : '#f59e0b';
                    return (
                      <g key={idx}>
                        <ellipse cx={px} cy={py + 8} rx="16" ry="6" fill="none" stroke={color} strokeWidth="1.2" opacity="0.6" />
                        <circle cx={px} cy={py} r="9" fill={color} stroke="#ffffff" strokeWidth="2" />
                        <text x={px} y={py + 3} fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">
                          {isOfficer ? 'G' : 'P'}
                        </text>
                        <rect x={px - 36} y={py - 20} width="72" height="14" rx="3" fill="#090d16" stroke={color} strokeWidth="1" />
                        <text x={px} y={py - 10} fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle">
                          {ent.name} ({ent.distance}px)
                        </text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="text-center space-y-2">
                  <VideoOff className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
                  <p className="font-mono text-sm font-bold text-red-400">CAMERA OFFLINE</p>
                </div>
              )}

              {/* OSD Bar */}
              <div className="absolute top-3 left-3 bg-black/70 px-2 py-1 rounded font-mono text-xs text-red-400 font-bold">
                ● LIVE REC • {selectedCam.id}
              </div>
              <div className="absolute top-3 right-3 bg-black/70 px-2 py-1 rounded font-mono text-xs text-gray-300">
                {currentTime}
              </div>
              <div className="absolute bottom-3 left-3 bg-black/80 px-2 py-1 rounded text-xs text-cyan-300 font-mono">
                SIMULATED CCTV PERCEPTION — LINE-OF-SIGHT VERIFIED
              </div>
            </div>

            {/* Telemetry & Detected Personnel Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#090d16] rounded-xl border border-borderMuted space-y-2">
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Camera Hardware Specifications</span>
                <div className="grid grid-cols-2 gap-2 text-gray-300 font-mono">
                  <div>Controller: <strong className="text-white">{selectedCam.controllerId}</strong></div>
                  <div>Map Origin: <strong className="text-white">X:{selectedCam.x}, Y:{selectedCam.y}</strong></div>
                  <div>Mount Bearing: <strong className="text-white">{selectedCam.angle}°</strong></div>
                  <div>Viewing Arc: <strong className="text-white">{selectedCam.fov}° Horizontal</strong></div>
                  <div>Max Optical Depth: <strong className="text-white">{selectedCam.distance}px</strong></div>
                  <div>Perception Engine: <strong className="text-cyan-400">2D Raycast Occlusion</strong></div>
                </div>
              </div>

              <div className="p-4 bg-[#090d16] rounded-xl border border-borderMuted space-y-2">
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                  Observed Ground-Truth Entities ({selectedCam.visibleEntities?.length || 0})
                </span>
                {selectedCam.visibleEntities?.length > 0 ? (
                  <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                    {selectedCam.visibleEntities.map((ent, idx) => (
                      <li key={idx} className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800 text-gray-200">
                        <span className="font-bold">{ent.name}</span>
                        <span className="font-mono text-gray-400 text-[10px]">
                          Distance: {ent.distance}px • Bearing: {ent.bearing}°
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 italic text-xs">No personnel currently inside camera field of view.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
