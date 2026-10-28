import React, { useRef, useState, useEffect } from 'react';
import { ROOMS, WAYPOINTS } from '../data/waypoints';
import { useSocket } from '../context/SocketContext';
import {
  Shield,
  KeyRound,
  Radio,
  Cpu,
  Eye,
  Activity,
  AlertTriangle,
  Lock,
  Unlock,
  Zap
} from 'lucide-react';

function getCameraFovPath(cx, cy, angleDeg, fovDeg, distance) {
  const startAngle = ((angleDeg - fovDeg / 2) * Math.PI) / 180;
  const endAngle = ((angleDeg + fovDeg / 2) * Math.PI) / 180;
  const x1 = cx + distance * Math.cos(startAngle);
  const y1 = cy + distance * Math.sin(startAngle);
  const x2 = cx + distance * Math.cos(endAngle);
  const y2 = cy + distance * Math.sin(endAngle);
  const largeArcFlag = fovDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${distance} ${distance} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
}

export default function PrisonFloorPlan({
  zoom,
  pan,
  onPanChange,
  showIoTOverlay,
  selectedPerson,
  onSelectPerson,
  selectedDevice,
  onSelectDevice,
  isFollowing,
  showRoute,
  displaySettings = {
    showPeopleLabels: true,
    showHealthBars: true,
    showSpeechBubbles: true,
    showCameraFov: true,
    showSensors: true,
    showActuators: true,
    showAccessPoints: true,
    showIoTLinks: true,
    showLegend: true
  },
  onSelectCommLink
}) {
  const { state, commandGate } = useSocket();
  const svgRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const people = state?.people ? Object.values(state.people) : [];
  const devices = state?.devices ? Object.values(state.devices) : [];
  const gates = state?.gates ? Object.values(state.gates) : [];
  const doors = state?.doors ? Object.values(state.doors) : [];
  const speakers = state?.speakers ? Object.values(state.speakers) : [];
  const controllers = state?.controllers ? Object.values(state.controllers) : [];
  const cameras = state?.cameras ? Object.values(state.cameras) : [];
  const isLockdown = state?.lockdown?.isActive;

  // Pan interaction
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // left click only
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    onPanChange({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Smooth 60fps Personnel Position Lerping (Continuous Navigation Gliding)
  const [smoothCoords, setSmoothCoords] = useState({});
  const coordsRef = useRef({});

  useEffect(() => {
    let animId;
    const animate = () => {
      const currentPeople = state?.people ? Object.values(state.people) : [];
      let changed = false;
      const updated = { ...coordsRef.current };

      for (const p of currentPeople) {
        if (!updated[p.id]) {
          updated[p.id] = { x: p.x, y: p.y };
          changed = true;
        } else {
          const dx = p.x - updated[p.id].x;
          const dy = p.y - updated[p.id].y;
          if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
            updated[p.id].x += dx * 0.18;
            updated[p.id].y += dy * 0.18;
            changed = true;
          } else if (updated[p.id].x !== p.x || updated[p.id].y !== p.y) {
            updated[p.id].x = p.x;
            updated[p.id].y = p.y;
            changed = true;
          }
        }
      }

      if (changed) {
        coordsRef.current = updated;
        setSmoothCoords({ ...updated });
      }
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [state?.people]);

  // Follow Person Camera tracking
  useEffect(() => {
    if (isFollowing && selectedPerson && state?.people?.[selectedPerson.id]) {
      const p = state.people[selectedPerson.id];
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      onPanChange({
        x: centerX - p.x * zoom,
        y: centerY - p.y * zoom
      });
    }
  }, [isFollowing, selectedPerson, state?.people, zoom, onPanChange]);

  // Click gate to toggle state
  const handleGateClick = (e, gate) => {
    e.stopPropagation();
    const nextState = gate.state === 'OPEN' ? 'CLOSE' : 'OPEN';
    commandGate(gate.id, nextState);
  };

  return (
    <div
      className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden bg-[#080d1a] relative bg-tactical-grid select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 1600 1000"
        className="w-[1600px] h-[1000px] transition-transform duration-75 origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
        }}
      >
        <defs>
          {/* Wall gradients */}
          <linearGradient id="wallTexture" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          {/* Alert Glow */}
          <radialGradient id="alarmGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>

          {/* IoT Flow Direction Markers */}
          <marker id="comm-arrow-cyan" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#06b6d4" />
          </marker>
          <marker id="comm-arrow-green" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#10b981" />
          </marker>
          <marker id="comm-arrow-purple" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#a855f7" />
          </marker>
        </defs>

        {/* ---------------- 1. OUTER PERIMETER SECURITY ---------------- */}
        {/* Outer Fence Line */}
        <rect
          x="60"
          y="20"
          width="1480"
          height="960"
          rx="12"
          fill="#0a101d"
          stroke="#334155"
          strokeWidth="3"
          strokeDasharray="8,6"
        />

        {/* Inner Solid Reinforced Concrete Wall */}
        <polygon
          points="130,50 1470,50 1440,950 160,950"
          fill="#0c1424"
          stroke="#475569"
          strokeWidth="6"
        />

        {/* Corner Watchtowers */}
        <g>
          {/* NW Tower */}
          <rect x="110" y="35" width="40" height="40" rx="4" fill="#1e293b" stroke="#06b6d4" strokeWidth="2" />
          <text x="130" y="60" fill="#06b6d4" fontSize="10" fontWeight="bold" textAnchor="middle">NW</text>

          {/* NE Tower */}
          <rect x="1450" y="35" width="40" height="40" rx="4" fill="#1e293b" stroke="#06b6d4" strokeWidth="2" />
          <text x="1470" y="60" fill="#06b6d4" fontSize="10" fontWeight="bold" textAnchor="middle">NE</text>

          {/* SE Tower */}
          <rect x="1420" y="930" width="40" height="40" rx="4" fill="#1e293b" stroke="#06b6d4" strokeWidth="2" />
          <text x="1440" y="955" fill="#06b6d4" fontSize="10" fontWeight="bold" textAnchor="middle">SE</text>

          {/* SW Tower */}
          <rect x="140" y="930" width="40" height="40" rx="4" fill="#1e293b" stroke="#06b6d4" strokeWidth="2" />
          <text x="160" y="955" fill="#06b6d4" fontSize="10" fontWeight="bold" textAnchor="middle">SW</text>
        </g>

        {/* ---------------- 2. ROOMS & SECTORS ---------------- */}

        {/* BLOCK A (Cells A-101 to A-104 + Corridor) */}
        <g id="BlockA">
          <rect x="250" y="100" width="240" height="170" rx="6" fill="#111827" stroke="#334155" strokeWidth="2" />
          <rect x="250" y="190" width="240" height="80" fill="#152033" stroke="#1e293b" strokeWidth="1" />
          <text x="370" y="240" fill="#64748b" fontSize="13" fontWeight="bold" textAnchor="middle" letterSpacing="2">BLOCK A CORRIDOR</text>

          {/* Cell A-101 */}
          <rect x="260" y="110" width="50" height="65" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <text x="285" y="130" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">A-101</text>
          <rect x="264" y="145" width="20" height="25" fill="#1e293b" rx="2" /> {/* Bunk */}

          {/* Cell A-102 (Marcus Vance) */}
          <rect x="315" y="110" width="50" height="65" rx="3" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
          <text x="340" y="130" fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="middle">A-102</text>
          <rect x="319" y="145" width="20" height="25" fill="#1e293b" rx="2" />

          {/* Cell A-103 */}
          <rect x="370" y="110" width="50" height="65" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <text x="395" y="130" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">A-103</text>
          <rect x="374" y="145" width="20" height="25" fill="#1e293b" rx="2" />

          {/* Cell A-104 */}
          <rect x="425" y="110" width="50" height="65" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <text x="450" y="130" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">A-104</text>
          <rect x="429" y="145" width="20" height="25" fill="#1e293b" rx="2" />
        </g>

        {/* BLOCK B (Cells B-101 to B-104 + Corridor) */}
        <g id="BlockB">
          <rect x="680" y="100" width="240" height="170" rx="6" fill="#111827" stroke="#334155" strokeWidth="2" />
          <rect x="680" y="190" width="240" height="80" fill="#152033" stroke="#1e293b" strokeWidth="1" />
          <text x="800" y="240" fill="#64748b" fontSize="13" fontWeight="bold" textAnchor="middle" letterSpacing="2">BLOCK B CORRIDOR</text>

          {/* Cell B-101 */}
          <rect x="690" y="110" width="50" height="65" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <text x="715" y="130" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">B-101</text>
          <rect x="694" y="145" width="20" height="25" fill="#1e293b" rx="2" />

          {/* Cell B-102 (David Chen) */}
          <rect x="745" y="110" width="50" height="65" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <text x="770" y="130" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">B-102</text>
          <rect x="749" y="145" width="20" height="25" fill="#1e293b" rx="2" />

          {/* Cell B-103 */}
          <rect x="800" y="110" width="50" height="65" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <text x="825" y="130" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">B-103</text>
          <rect x="804" y="145" width="20" height="25" fill="#1e293b" rx="2" />

          {/* Cell B-104 */}
          <rect x="855" y="110" width="50" height="65" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <text x="880" y="130" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">B-104</text>
          <rect x="859" y="145" width="20" height="25" fill="#1e293b" rx="2" />
        </g>

        {/* BLOCK C (Cells C-101 to C-104 + Corridor) */}
        <g id="BlockC">
          <rect x="1110" y="100" width="240" height="170" rx="6" fill="#111827" stroke="#334155" strokeWidth="2" />
          <rect x="1110" y="190" width="240" height="80" fill="#152033" stroke="#1e293b" strokeWidth="1" />
          <text x="1230" y="240" fill="#64748b" fontSize="13" fontWeight="bold" textAnchor="middle" letterSpacing="2">BLOCK C CORRIDOR</text>

          {/* Cell C-101 */}
          <rect x="1120" y="110" width="50" height="65" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <text x="1145" y="130" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">C-101</text>
          <rect x="1124" y="145" width="20" height="25" fill="#1e293b" rx="2" />

          {/* Cell C-102 */}
          <rect x="1175" y="110" width="50" height="65" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <text x="1200" y="130" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">C-102</text>
          <rect x="1179" y="145" width="20" height="25" fill="#1e293b" rx="2" />

          {/* Cell C-103 */}
          <rect x="1230" y="110" width="50" height="65" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <text x="1255" y="130" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">C-103</text>
          <rect x="1234" y="145" width="20" height="25" fill="#1e293b" rx="2" />

          {/* Cell C-104 */}
          <rect x="1285" y="110" width="50" height="65" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <text x="1310" y="130" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">C-104</text>
          <rect x="1289" y="145" width="20" height="25" fill="#1e293b" rx="2" />
        </g>

        {/* NORTH MAIN CORRIDOR */}
        <rect x="250" y="280" width="1100" height="50" fill="#152033" stroke="#1e293b" strokeWidth="1" />
        <text x="800" y="310" fill="#475569" fontSize="12" fontWeight="bold" textAnchor="middle" letterSpacing="4">NORTH SECURE TRANSIT CONCOURSE</text>

        {/* CENTRAL RESTRICTED SPINE */}
        <rect x="760" y="330" width="80" height="360" fill="#131c2e" stroke="#ef4444" strokeWidth="1" strokeDasharray="6,4" />
        <text x="800" y="520" fill="#ef4444" fontSize="10" fontWeight="bold" textAnchor="middle" transform="rotate(-90 800 520)" letterSpacing="2">RESTRICTED CENTRAL SPINE</text>

        {/* MEDICAL & WELFARE WARD */}
        <g id="MedicalWard">
          <rect x="250" y="370" width="350" height="230" rx="8" fill="#111c2e" stroke="#10b981" strokeWidth="1.5" />
          <text x="425" y="405" fill="#10b981" fontSize="14" fontWeight="bold" textAnchor="middle" letterSpacing="2">MEDICAL & WELFARE WARD</text>

          {/* Triage Desk & Station */}
          <rect x="360" y="430" width="40" height="40" fill="#1e293b" stroke="#334155" rx="3" />
          <text x="380" y="455" fill="#94a3b8" fontSize="9" textAnchor="middle">Triage</text>

          {/* Patient Beds */}
          <rect x="460" y="430" width="40" height="45" fill="#1e293b" stroke="#10b981" rx="3" />
          <text x="480" y="455" fill="#10b981" fontSize="9" textAnchor="middle">Bed 1</text>

          <rect x="460" y="510" width="40" height="45" fill="#1e293b" stroke="#475569" rx="3" />
          <text x="480" y="535" fill="#94a3b8" fontSize="9" textAnchor="middle">Bed 2</text>

          <rect x="360" y="510" width="40" height="45" fill="#1e293b" stroke="#475569" rx="3" />
          <text x="380" y="535" fill="#94a3b8" fontSize="9" textAnchor="middle">Bed 3</text>
        </g>

        {/* COMMON RECREATION YARD */}
        <g id="CommonYard">
          <rect x="660" y="370" width="280" height="280" rx="8" fill="#0d1724" stroke="#475569" strokeWidth="2" strokeDasharray="4,4" />
          <text x="800" y="405" fill="#94a3b8" fontSize="14" fontWeight="bold" textAnchor="middle" letterSpacing="2">COMMON EXERCISE YARD</text>

          {/* Basketball half-court court markings */}
          <rect x="740" y="490" width="120" height="110" fill="none" stroke="#334155" strokeWidth="1.5" />
          <circle cx="800" cy="490" r="30" fill="none" stroke="#334155" strokeWidth="1.5" />
          <circle cx="800" cy="600" r="2" fill="#f59e0b" /> {/* Hoop */}

          {/* Outdoor workout benches */}
          <rect x="680" y="450" width="30" height="15" fill="#1e293b" rx="2" />
          <rect x="680" y="480" width="30" height="15" fill="#1e293b" rx="2" />
        </g>

        {/* ADMINISTRATION BUILDING */}
        <g id="AdminBuilding">
          <rect x="1000" y="370" width="350" height="230" rx="8" fill="#111827" stroke="#3b82f6" strokeWidth="1.5" />
          <text x="1175" y="405" fill="#3b82f6" fontSize="14" fontWeight="bold" textAnchor="middle" letterSpacing="2">ADMINISTRATION & COMMAND</text>

          {/* Warden Office */}
          <rect x="1210" y="430" width="120" height="70" fill="#152033" stroke="#334155" rx="4" />
          <text x="1270" y="470" fill="#cbd5e1" fontSize="11" fontWeight="bold" textAnchor="middle">Warden Office</text>

          {/* Staff Lobby */}
          <rect x="1030" y="430" width="160" height="70" fill="#152033" stroke="#334155" rx="4" />
          <text x="1110" y="470" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">Staff Briefing Room</text>
        </g>

        {/* ISOLATION & SOLITARY UNIT */}
        <g id="Isolation">
          <rect x="250" y="640" width="350" height="190" rx="8" fill="#15131e" stroke="#dc2626" strokeWidth="1.5" />
          <text x="425" y="675" fill="#ef4444" fontSize="14" fontWeight="bold" textAnchor="middle" letterSpacing="2">SOLITARY & MAXIMUM ISOLATION</text>

          {/* Cell ISO-01 (Tyler Durden) */}
          <rect x="280" y="700" width="70" height="80" rx="4" fill="#0b0f19" stroke="#ef4444" strokeWidth="2" />
          <text x="315" y="735" fill="#ef4444" fontSize="11" fontWeight="bold" textAnchor="middle">ISO-01</text>
          <rect x="285" y="750" width="25" height="25" fill="#1e293b" />

          {/* Cell ISO-02 */}
          <rect x="370" y="700" width="70" height="80" rx="4" fill="#0b0f19" stroke="#475569" strokeWidth="1.5" />
          <text x="405" y="735" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">ISO-02</text>
          <rect x="375" y="750" width="25" height="25" fill="#1e293b" />
        </g>

        {/* MAIN SALLY PORT & VEHICLE INTAKE */}
        <g id="SallyPort">
          <rect x="660" y="690" width="280" height="180" rx="8" fill="#151e2e" stroke="#0284c7" strokeWidth="2" />
          <text x="800" y="725" fill="#38bdf8" fontSize="14" fontWeight="bold" textAnchor="middle" letterSpacing="2">MAIN SALLY PORT INTAKE</text>

          {/* Vehicle Inspection Bay */}
          <rect x="720" y="750" width="160" height="80" fill="#0f172a" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="6,4" />
          <text x="800" y="795" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">Vehicle Bay (Interlock)</text>
        </g>

        {/* CENTRAL SECURITY CONTROL ROOM (SOC) */}
        <g id="ControlRoom">
          <rect x="1000" y="640" width="350" height="190" rx="8" fill="#111c2e" stroke="#06b6d4" strokeWidth="2" />
          <text x="1175" y="675" fill="#06b6d4" fontSize="14" fontWeight="bold" textAnchor="middle" letterSpacing="2">CENTRAL SECURITY CONTROL (SOC)</text>

          {/* SOC Operator Consoles */}
          <rect x="1040" y="710" width="130" height="80" rx="4" fill="#162033" stroke="#06b6d4" strokeWidth="1.5" />
          <text x="1105" y="745" fill="#06b6d4" fontSize="11" fontWeight="bold" textAnchor="middle">Command Terminals</text>

          {/* Secure Server Rack Bay */}
          <rect x="1200" y="710" width="120" height="80" rx="4" fill="#0b0f19" stroke="#334155" strokeWidth="1.5" />
          <text x="1260" y="745" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">IoT Server Racks</text>
        </g>

        {/* ---------------- 3. GATES & PHYSICAL BARRIERS ---------------- */}
        {gates.map((gate) => {
          const isOpen = gate.state === 'OPEN';
          const isOpening = gate.state === 'OPENING' || gate.state === 'CLOSING';
          const isJammed = gate.state === 'JAMMED';

          return (
            <g
              key={gate.id}
              onClick={(e) => handleGateClick(e, gate)}
              className="cursor-pointer group"
            >
              {/* Gate barrier bar */}
              <rect
                x={gate.x - 22}
                y={gate.y - 8}
                width={44}
                height={16}
                rx="3"
                fill={isJammed ? '#7f1d1d' : isOpen ? '#14532d' : '#1e293b'}
                stroke={isJammed ? '#ef4444' : isOpen ? '#10b981' : '#f59e0b'}
                strokeWidth="2"
                className="transition-all"
              />
              {/* Gate sliding indicator */}
              <text
                x={gate.x}
                y={gate.y + 4}
                fill={isJammed ? '#ef4444' : isOpen ? '#10b981' : '#f59e0b'}
                fontSize="9"
                fontWeight="extrabold"
                textAnchor="middle"
              >
                {isJammed ? 'JAM' : isOpen ? 'OPEN' : 'GATE'}
              </text>
              {/* Hover tooltip label */}
              <text
                x={gate.x}
                y={gate.y - 12}
                fill="#ffffff"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
                className="opacity-0 group-hover:opacity-100 transition pointer-events-none drop-shadow"
              >
                {gate.name} (Click to toggle)
              </text>
            </g>
          );
        })}

        {/* ---------------- 3B. CELL & INTERNAL DOORS ---------------- */}
        {doors.map((door) => {
          const isOpen = door.position === 'OPEN';
          const isOpening = door.position === 'OPENING' || door.position === 'CLOSING';
          const isLocked = door.lockState === 'LOCKED';

          return (
            <g
              key={door.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDevice && onSelectDevice(door);
              }}
              className="cursor-pointer group"
            >
              {/* Physical Door Leaf */}
              <rect
                x={door.x - 14}
                y={door.y - 4}
                width={28}
                height={8}
                rx="2"
                fill={isOpen ? '#064e3b' : '#1e293b'}
                stroke={isOpen ? '#10b981' : '#64748b'}
                strokeWidth="1.5"
                strokeDasharray={isOpen ? '4,2' : 'none'}
              />
              {/* Lock Status Micro-Badge */}
              <circle
                cx={door.x + 12}
                cy={door.y}
                r="4.5"
                fill={isLocked ? '#991b1b' : '#065f46'}
                stroke="#ffffff"
                strokeWidth="1"
              />
              <text
                x={door.x + 12}
                y={door.y + 2.5}
                fill="#ffffff"
                fontSize="6"
                fontWeight="bold"
                textAnchor="middle"
                pointerEvents="none"
              >
                {isLocked ? 'L' : 'U'}
              </text>

              {/* Tooltip on hover */}
              <text
                x={door.x}
                y={door.y - 8}
                fill="#ffffff"
                fontSize="8"
                fontWeight="bold"
                textAnchor="middle"
                className="opacity-0 group-hover:opacity-100 transition pointer-events-none drop-shadow"
              >
                {door.name} ({door.position} • {door.lockState})
              </text>
            </g>
          );
        })}

        {/* ---------------- 3C. PUBLIC ADDRESS SPEAKERS (ACTUATORS) ---------------- */}
        {displaySettings?.showActuators !== false && speakers.map((spk) => {
          const isBroadcasting = spk.state === 'BROADCASTING';
          const maxRange = spk.range || 200;

          return (
            <g
              key={spk.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDevice && onSelectDevice(spk);
              }}
              className="cursor-pointer group"
            >
              {/* Concentric Expanding Audio-Propagation Waves (Bounded by spk.range, no projectile ball) */}
              {isBroadcasting && (
                <g pointerEvents="none">
                  <circle cx={spk.x} cy={spk.y} r="16" fill="none" stroke="#38bdf8" strokeWidth="2.5" opacity="0.85">
                    <animate attributeName="r" from="16" to={maxRange} dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.85" to="0" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={spk.x} cy={spk.y} r="16" fill="none" stroke="#0284c7" strokeWidth="1.8" opacity="0.85">
                    <animate attributeName="r" from="16" to={maxRange} begin="0.8s" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.85" to="0" begin="0.8s" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={spk.x} cy={spk.y} r="16" fill="none" stroke="#06b6d4" strokeWidth="1.2" opacity="0.85">
                    <animate attributeName="r" from="16" to={maxRange} begin="1.6s" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.85" to="0" begin="1.6s" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  {/* Audible boundary ring */}
                  <circle cx={spk.x} cy={spk.y} r={maxRange} fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4,4" opacity="0.3" />
                </g>
              )}

              {/* Speaker Horn Icon Body */}
              <polygon
                points={`${spk.x - 7},${spk.y - 5} ${spk.x - 7},${spk.y + 5} ${spk.x - 2},${spk.y + 5} ${spk.x + 6},${spk.y + 9} ${spk.x + 6},${spk.y - 9} ${spk.x - 2},${spk.y - 5}`}
                fill={isBroadcasting ? '#0284c7' : '#1e293b'}
                stroke={isBroadcasting ? '#38bdf8' : '#64748b'}
                strokeWidth="1.5"
              />

              {/* Speaker Label */}
              <text
                x={spk.x}
                y={spk.y - 12}
                fill={isBroadcasting ? '#38bdf8' : '#ffffff'}
                fontSize="8"
                fontWeight="bold"
                textAnchor="middle"
                className="opacity-0 group-hover:opacity-100 transition pointer-events-none drop-shadow"
              >
                {spk.name} {isBroadcasting ? '(BROADCASTING)' : ''}
              </text>
            </g>
          );
        })}

        {/* ---------------- 4. IOT HARDWARE OVERLAY (Sensors, Beams, ESP32, APs, Links) ---------------- */}
        {showIoTOverlay && (
          <g id="IoTOverlay">
            {/* 4A. 4-LAYER IOT COMMUNICATION TOPOLOGY LINKS */}
            {displaySettings?.showIoTLinks !== false && (
              <g id="IoTCommLinks">
                {/* Layer 2 -> Layer 3: ESP32 Controllers to Wi-Fi Access Points */}
                {[
                  { from: { x: 240, y: 90 }, to: { x: 500, y: 320 }, ctrl: 'ESP32-CELL-01', ap: 'AP-NORTH-CORR' },
                  { from: { x: 670, y: 90 }, to: { x: 500, y: 320 }, ctrl: 'ESP32-CELL-02', ap: 'AP-NORTH-CORR' },
                  { from: { x: 1100, y: 90 }, to: { x: 500, y: 320 }, ctrl: 'ESP32-CELL-03', ap: 'AP-NORTH-CORR' },
                  { from: { x: 650, y: 700 }, to: { x: 1050, y: 780 }, ctrl: 'ESP32-ACCESS-01', ap: 'AP-YARD-SALLY' },
                  { from: { x: 240, y: 360 }, to: { x: 300, y: 700 }, ctrl: 'ESP32-MED-01', ap: 'AP-WEST-MED' },
                  { from: { x: 1320, y: 640 }, to: { x: 1250, y: 220 }, ctrl: 'ESP32-CAM-HUB', ap: 'AP-ADMIN-SOC' },
                  { from: { x: 1430, y: 90 }, to: { x: 1400, y: 450 }, ctrl: 'ESP32-PERIM-01', ap: 'AP-EAST-PERIM' },
                  { from: { x: 170, y: 910 }, to: { x: 300, y: 700 }, ctrl: 'ESP32-PERIM-02', ap: 'AP-WEST-MED' },
                ].map((l, idx) => (
                  <line
                    key={`l2-l3-${idx}`}
                    x1={l.from.x}
                    y1={l.from.y}
                    x2={l.to.x}
                    y2={l.to.y}
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    strokeDasharray="5,4"
                    opacity="0.5"
                    markerEnd="url(#comm-arrow-cyan)"
                    className="cursor-pointer hover:stroke-cyan-300 hover:stroke-[2.5px] transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCommLink && onSelectCommLink({
                        sourceId: l.ctrl,
                        sourceName: `ESP32 Controller (${l.ctrl})`,
                        sourceType: 'CONTROLLER',
                        destId: l.ap,
                        destName: `Wi-Fi Access Point (${l.ap})`,
                        destType: 'ACCESS_POINT',
                        protocol: '802.11ax WPA3-Enterprise (2.4GHz / 5GHz)',
                        direction: 'BIDIRECTIONAL',
                        isRealImplementation: false,
                        samplePayload: {
                          msg_type: 'TELEMETRY_HEARTBEAT',
                          controller_id: l.ctrl,
                          ap_bssid: 'E4:5F:01:8A:92:C0',
                          rssi_dbm: -54,
                          uptime_sec: 14320,
                          free_heap_bytes: 184320,
                          status: 'ACK_CONFIRMED'
                        },
                        deliveryStatus: 'CONFIRMED_ACK',
                        latencyMs: 3,
                        packetLossRate: '0.00%',
                        eventTrace: [
                          { name: 'Hardware GPIO Edge Detection', layer: 'Sensor / GPIO', status: 'COMPLETED' },
                          { name: 'ESP32 RTOS Interrupt Queue', layer: 'ESP32 Controller', status: 'COMPLETED' },
                          { name: 'WPA3 Wi-Fi Packet Egress', layer: 'Wi-Fi Access Point', status: 'COMPLETED' },
                          { name: 'Backend MQTT Broker Ingestion', layer: 'Shared Backend', status: 'COMPLETED' },
                          { name: 'State Aggregation & Socket Broadcast', layer: 'Socket Server', status: 'COMPLETED' },
                          { name: 'Security Console Reactive Render', layer: 'Central Security SOC', status: 'COMPLETED' }
                        ]
                      });
                    }}
                  />
                ))}

                {/* Layer 3 -> Layer 4: Wi-Fi Access Points to Backend & Central Security Control */}
                {[
                  { from: { x: 500, y: 320 }, to: { x: 1250, y: 220 }, ap: 'AP-NORTH-CORR' },
                  { from: { x: 1050, y: 780 }, to: { x: 1250, y: 220 }, ap: 'AP-YARD-SALLY' },
                  { from: { x: 300, y: 700 }, to: { x: 1250, y: 220 }, ap: 'AP-WEST-MED' },
                  { from: { x: 1400, y: 450 }, to: { x: 1250, y: 220 }, ap: 'AP-EAST-PERIM' },
                ].map((l, idx) => (
                  <line
                    key={`l3-l4-${idx}`}
                    x1={l.from.x}
                    y1={l.from.y}
                    x2={l.to.x}
                    y2={l.to.y}
                    stroke="#a855f7"
                    strokeWidth="1.8"
                    strokeDasharray="6,4"
                    opacity="0.6"
                    markerEnd="url(#comm-arrow-purple)"
                    className="cursor-pointer hover:stroke-purple-300 hover:stroke-[3px] transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCommLink && onSelectCommLink({
                        sourceId: l.ap,
                        sourceName: `Wi-Fi Access Point (${l.ap})`,
                        sourceType: 'ACCESS_POINT',
                        destId: 'CENTRAL-SOC-CORE',
                        destName: 'Backend Core & Security Console',
                        destType: 'BACKEND',
                        protocol: 'Gigabit PoE LAN / Secure Socket.IO (TLS)',
                        direction: 'BIDIRECTIONAL',
                        isRealImplementation: true,
                        samplePayload: {
                          event: 'FACILITY_STATE_SYNC',
                          ap_uplink: l.ap,
                          vlan: 'VLAN-10-SECURITY',
                          transport: 'REAL_WEBSOCKET_SOCKET_IO',
                          connected_clients: 2,
                          state_version: 1842
                        },
                        deliveryStatus: 'CONFIRMED_ACK',
                        latencyMs: 1,
                        packetLossRate: '0.00%',
                        eventTrace: [
                          { name: 'AP VLAN 10 Frame Forwarding', layer: 'PoE Switch Backbone', status: 'COMPLETED' },
                          { name: 'Node.js Express / Socket.IO Ingest', layer: 'Shared Backend', status: 'COMPLETED' },
                          { name: 'Authoritative State Mutation', layer: 'Simulation Engine', status: 'COMPLETED' },
                          { name: 'WebSocket JSON Broadcast', layer: 'Socket.IO Server', status: 'COMPLETED' },
                          { name: 'Admin Dashboard Reactive Dispatch', layer: 'Central Security SOC', status: 'COMPLETED' },
                          { name: 'Cryptographic Audit Block Hash', layer: 'Security Audit', status: 'COMPLETED' }
                        ]
                      });
                    }}
                  />
                ))}
              </g>
            )}

            {/* Infrared Laser Beams across perimeter */}
            {displaySettings?.showSensors !== false && (
              <>
                <line
                  x1="200"
                  y1="50"
                  x2="1400"
                  y2="50"
                  stroke={state?.devices?.['IR-BEAM-N']?.value === 'BROKEN' ? '#ef4444' : '#10b981'}
                  strokeWidth={state?.devices?.['IR-BEAM-N']?.value === 'BROKEN' ? '3' : '1.5'}
                  strokeDasharray={state?.devices?.['IR-BEAM-N']?.value === 'BROKEN' ? '6,4' : 'none'}
                  opacity="0.75"
                />
                <line
                  x1="1485"
                  y1="80"
                  x2="1485"
                  y2="900"
                  stroke={state?.devices?.['IR-BEAM-E']?.value === 'BROKEN' ? '#ef4444' : '#10b981'}
                  strokeWidth={state?.devices?.['IR-BEAM-E']?.value === 'BROKEN' ? '4' : '1.5'}
                  strokeDasharray={state?.devices?.['IR-BEAM-E']?.value === 'BROKEN' ? '6,4' : 'none'}
                  opacity="0.8"
                />
                <line
                  x1="115"
                  y1="80"
                  x2="115"
                  y2="900"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  opacity="0.75"
                />
                <line
                  x1="200"
                  y1="940"
                  x2="1400"
                  y2="940"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  opacity="0.75"
                />
              </>
            )}

            {/* Wi-Fi Access Points (APs) */}
            {displaySettings?.showAccessPoints !== false && (state?.accessPoints ? Object.values(state.accessPoints) : []).map((ap) => {
              const isOnline = ap.status === 'ONLINE';
              return (
                <g
                  key={ap.id}
                  className="cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDevice && onSelectDevice({
                      id: ap.id,
                      name: ap.name,
                      type: 'ACCESS_POINT',
                      location: ap.location,
                      status: ap.status,
                      ip: ap.ip,
                      channel: ap.channel,
                      band: ap.band,
                      connectedControllers: ap.connectedControllers
                    });
                  }}
                >
                  {/* Radio Coverage Radius Circle */}
                  <circle
                    cx={ap.x}
                    cy={ap.y}
                    r={ap.coverageRadius || 180}
                    fill={isOnline ? '#06b6d4' : '#64748b'}
                    fillOpacity="0.04"
                    stroke={isOnline ? '#06b6d4' : '#64748b'}
                    strokeWidth="1"
                    strokeDasharray="4,4"
                    opacity="0.45"
                  />
                  {/* AP Outer Ring */}
                  <circle cx={ap.x} cy={ap.y} r="9" fill="#0f172a" stroke={isOnline ? '#38bdf8' : '#ef4444'} strokeWidth="1.5" />
                  {/* Radio Waves */}
                  <path
                    d={`M ${ap.x - 4.5} ${ap.y - 2} A 5 5 0 0 1 ${ap.x + 4.5} ${ap.y - 2}`}
                    fill="none"
                    stroke={isOnline ? '#38bdf8' : '#ef4444'}
                    strokeWidth="1.3"
                  />
                  <circle cx={ap.x} cy={ap.y + 2} r="2" fill={isOnline ? '#10b981' : '#ef4444'} />
                  {/* Label */}
                  <text
                    x={ap.x}
                    y={ap.y - 13}
                    fill="#38bdf8"
                    fontSize="7.5"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="opacity-0 group-hover:opacity-100 transition pointer-events-none drop-shadow"
                  >
                    {ap.name} ({ap.status})
                  </text>
                </g>
              );
            })}

            {/* ESP32 Controller Nodes */}
            {controllers.map((ctrl) => {
              const isOnline = ctrl.status === 'ONLINE';
              let cx = 240, cy = 90;
              if (ctrl.id.includes('CELL-02')) { cx = 670; cy = 90; }
              if (ctrl.id.includes('CELL-03')) { cx = 1100; cy = 90; }
              if (ctrl.id.includes('PERIM-01')) { cx = 1430; cy = 90; }
              if (ctrl.id.includes('PERIM-02')) { cx = 170; cy = 910; }
              if (ctrl.id.includes('ACCESS')) { cx = 650; cy = 700; }
              if (ctrl.id.includes('MED')) { cx = 240; cy = 360; }
              if (ctrl.id.includes('CAM')) { cx = 1320; cy = 640; }

              return (
                <g key={ctrl.id} className="cursor-pointer" onClick={() => onSelectDevice && onSelectDevice({ id: ctrl.id, name: ctrl.name, type: 'ESP32_CONTROLLER', location: ctrl.location, controllerId: ctrl.id, gpio: 0, status: ctrl.status, value: isOnline ? 'HEARTBEAT_ACTIVE' : 'OFFLINE' })}>
                  <rect x={cx - 14} y={cy - 14} width="28" height="28" rx="4" fill={isOnline ? '#0f172a' : '#7f1d1d'} stroke={isOnline ? '#06b6d4' : '#ef4444'} strokeWidth="2" />
                  <circle cx={cx} cy={cy} r="4" fill={isOnline ? '#10b981' : '#ef4444'} className={isOnline ? 'animate-pulse' : ''} />
                  <text x={cx} y={cy + 22} fill="#06b6d4" fontSize="8" fontWeight="bold" textAnchor="middle">{ctrl.id}</text>
                </g>
              );
            })}

            {/* Individual Sensors */}
            {displaySettings?.showSensors !== false && devices.map((dev) => {
              if (!dev.x || !dev.y) return null;
              const isSelected = selectedDevice?.id === dev.id;
              const isOnline = dev.status === 'ONLINE';

              let fillColor = '#10b981';
              if (!isOnline) fillColor = '#64748b';
              else if (dev.value === 'OPEN' || dev.value === 'DETECTED' || dev.value === 'BROKEN' || dev.value === 'TRIPPED' || dev.value === 'PRESSED') {
                fillColor = '#ef4444';
              }

              return (
                <g
                  key={dev.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDevice && onSelectDevice(dev);
                  }}
                  className="cursor-pointer group"
                >
                  {/* Selection Ring */}
                  {isSelected && (
                    <circle cx={dev.x} cy={dev.y} r="14" fill="none" stroke="#06b6d4" strokeWidth="2.5" className="animate-pulse" />
                  )}

                  {/* Marker Icon / Circle */}
                  <circle cx={dev.x} cy={dev.y} r="6" fill={fillColor} stroke="#ffffff" strokeWidth="1.5" />

                  {/* Device label on hover */}
                  <text
                    x={dev.x}
                    y={dev.y - 10}
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="opacity-0 group-hover:opacity-100 transition pointer-events-none drop-shadow"
                  >
                    {dev.name} ({dev.value})
                  </text>
                </g>
              );
            })}

            {/* CCTV Security Cameras & Viewing Cones (Industrial Surveillance Glyphs, no ping ball) */}
            {cameras.map((cam) => {
              const isOnline = cam.status === 'ONLINE';
              const conePath = getCameraFovPath(cam.x, cam.y, cam.angle, cam.fov, cam.distance);
              const isSelected = selectedDevice?.id === cam.id;
              const entityCount = cam.visibleEntities?.length || 0;

              return (
                <g
                  key={cam.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDevice && onSelectDevice({ ...cam, type: 'CAMERA', value: isOnline ? 'STREAMING' : 'OFFLINE' });
                  }}
                  className="cursor-pointer group"
                >
                  {/* FOV Wedge Cone (Section 17) */}
                  {displaySettings?.showCameraFov !== false && (
                    <path
                      d={conePath}
                      fill={isOnline ? (entityCount > 0 ? '#06b6d4' : '#0284c7') : '#64748b'}
                      fillOpacity={isOnline ? (entityCount > 0 ? '0.16' : '0.07') : '0.02'}
                      stroke={isOnline ? (entityCount > 0 ? '#06b6d4' : '#0284c7') : '#64748b'}
                      strokeWidth="1.2"
                      strokeDasharray="4,3"
                      opacity={isOnline ? '0.85' : '0.25'}
                    />
                  )}

                  {/* Selection Ring */}
                  {isSelected && (
                    <circle cx={cam.x} cy={cam.y} r="16" fill="none" stroke="#38bdf8" strokeWidth="2.5" className="animate-pulse" />
                  )}

                  {/* Industrial Surveillance Camera Glyph (Section 16: Housing & Lens oriented along cam.angle) */}
                  <g transform={`rotate(${cam.angle}, ${cam.x}, ${cam.y})`}>
                    {/* Mounting Bracket Base */}
                    <rect x={cam.x - 7} y={cam.y - 3} width="4" height="6" rx="1" fill="#475569" stroke="#334155" strokeWidth="0.8" />
                    {/* Industrial Surveillance Housing Body */}
                    <path
                      d={`M ${cam.x - 3} ${cam.y - 6} L ${cam.x + 9} ${cam.y - 4} L ${cam.x + 9} ${cam.y + 4} L ${cam.x - 3} ${cam.y + 6} Z`}
                      fill="#0f172a"
                      stroke={isOnline ? (entityCount > 0 ? '#38bdf8' : '#06b6d4') : '#ef4444'}
                      strokeWidth="1.5"
                    />
                    {/* Front Optical Lens Barrel */}
                    <rect x={cam.x + 9} y={cam.y - 3} width="3" height="6" rx="0.8" fill={isOnline ? (entityCount > 0 ? '#38bdf8' : '#10b981') : '#ef4444'} />
                    {/* Operational LED Indicator (solid status, no ping ball) */}
                    <circle cx={cam.x + 3} cy={cam.y} r="1.5" fill={isOnline ? '#10b981' : '#ef4444'} />
                  </g>

                  {/* Camera Label Tag */}
                  <text
                    x={cam.x}
                    y={cam.y - 12}
                    fill={isOnline ? '#38bdf8' : '#94a3b8'}
                    fontSize="7.5"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="drop-shadow select-none pointer-events-none"
                  >
                    {cam.id} {cam.isSweeping ? '⟳' : ''} {entityCount > 0 ? `(${entityCount}👁)` : ''}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* ---------------- 5. ROUTE BREADCRUMBS (If enabled) ---------------- */}
        {showRoute && selectedPerson?.routeHistory && selectedPerson.routeHistory.length > 1 && (
          <g id="RouteHistory">
            {selectedPerson.routeHistory.map((step, idx) => {
              if (idx === selectedPerson.routeHistory.length - 1) return null;
              const nextStep = selectedPerson.routeHistory[idx + 1];
              return (
                <line
                  key={idx}
                  x1={step.x}
                  y1={step.y}
                  x2={nextStep.x}
                  y2={nextStep.y}
                  stroke="#a855f7"
                  strokeWidth="3"
                  strokeDasharray="4,4"
                  opacity="0.8"
                />
              );
            })}
          </g>
        )}

        {/* ---------------- 6. CLICKABLE PERSONNEL BEACONS ---------------- */}
        {people.map((person) => {
          const isOfficer = person.type === 'OFFICER';
          const isSupervisor = person.type === 'SUPERVISOR';
          const isDoctor = person.type === 'MEDICAL_DOCTOR';
          const isNurse = person.type === 'MEDICAL_NURSE';
          const isMedical = isDoctor || isNurse;
          const isSelected = selectedPerson?.id === person.id;
          const isMoving = person.status === 'IN_TRANSIT';
          const isSuspended = person.officerState === 'SUSPENDED' || person.credentialStatus === 'SUSPENDED';

          // Continuous interpolated positions
          const px = smoothCoords[person.id]?.x ?? person.x;
          const py = smoothCoords[person.id]?.y ?? person.y;

          // Color & Beacon initial config
          let beaconStroke = '#f59e0b';
          let beaconFill = '#d97706';
          let beaconInitial = 'P';
          if (isSuspended) {
            beaconStroke = '#ef4444';
            beaconFill = '#991b1b';
            beaconInitial = 'SUSP';
          } else if (isOfficer) {
            beaconStroke = '#3b82f6';
            beaconFill = '#2563eb';
            beaconInitial = 'G';
          } else if (isSupervisor) {
            beaconStroke = '#a855f7';
            beaconFill = '#9333ea';
            beaconInitial = 'SUP';
          } else if (isDoctor) {
            beaconStroke = '#10b981';
            beaconFill = '#059669';
            beaconInitial = 'MD';
          } else if (isNurse) {
            beaconStroke = '#14b8a6';
            beaconFill = '#0d9488';
            beaconInitial = 'RN';
          } else if (person.prisonerState === 'INVOLVED_IN_CONFLICT') {
            beaconStroke = '#dc2626';
            beaconFill = '#b91c1c';
            beaconInitial = 'CFLT';
          } else if (person.prisonerState === 'INJURED' || person.prisonerState === 'AWAITING_MEDICAL_ESCORT') {
            beaconStroke = '#f97316';
            beaconFill = '#ea580c';
            beaconInitial = 'INJ';
          }

          return (
            <g
              key={person.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectPerson(person);
              }}
              className="cursor-pointer group"
            >
              {/* Outer pulsing beacon ring */}
              <circle
                cx={px}
                cy={py}
                r={isSelected ? "20" : "14"}
                fill="none"
                stroke={beaconStroke}
                strokeWidth={isSelected ? "2.5" : "1.2"}
                strokeDasharray={isSuspended ? "4,2" : undefined}
                className={isMoving ? "animate-ping opacity-60" : "animate-pulse"}
              />

              {/* Central Marker */}
              <circle
                cx={px}
                cy={py}
                r="9"
                fill={beaconFill}
                stroke="#ffffff"
                strokeWidth="2"
              />

              {/* Mini Role Initial */}
              <text
                x={px}
                y={py + 3}
                fill="#ffffff"
                fontSize={beaconInitial.length > 2 ? "5.5" : beaconInitial.length > 1 ? "6.5" : "8"}
                fontWeight="extrabold"
                textAnchor="middle"
                pointerEvents="none"
              >
                {beaconInitial}
              </text>

              {/* Health Gauge Bar (Section 12: 0-100 Health Model) */}
              {(displaySettings?.showHealthBars !== false || (person.health !== undefined && person.health < 100)) && (
                <g pointerEvents="none">
                  {/* Health Bar Background Track */}
                  <rect
                    x={px - 14}
                    y={py - 17}
                    width="28"
                    height="3.5"
                    rx="1"
                    fill="#0f172a"
                    stroke="#334155"
                    strokeWidth="0.6"
                  />
                  {/* Health Bar Fill */}
                  <rect
                    x={px - 14}
                    y={py - 17}
                    width={Math.max(2, (28 * Math.max(0, Math.min(100, person.health ?? 100))) / 100)}
                    height="3.5"
                    rx="1"
                    fill={
                      (person.health ?? 100) > 65
                        ? '#10b981'
                        : (person.health ?? 100) > 25
                        ? '#f59e0b'
                        : '#ef4444'
                    }
                  />
                </g>
              )}

              {/* Incapacitated State Alert Badge */}
              {person.healthState === 'INCAPACITATED' && (
                <g className="animate-pulse">
                  <rect
                    x={px - 45}
                    y={py - 32}
                    width="90"
                    height="13"
                    rx="3"
                    fill="#7f1d1d"
                    stroke="#ef4444"
                    strokeWidth="1"
                  />
                  <text
                    x={px}
                    y={py - 23}
                    fill="#fecaca"
                    fontSize="7"
                    fontWeight="extrabold"
                    textAnchor="middle"
                  >
                    ✚ INCAPACITATED
                  </text>
                </g>
              )}

              {/* Floating Name Badge */}
              {displaySettings?.showPeopleLabels !== false && (
                <>
                  <rect
                    x={px - 32}
                    y={py + 12}
                    width="64"
                    height="15"
                    rx="3"
                    fill="#0f172a"
                    stroke={beaconStroke}
                    strokeWidth="1"
                    opacity="0.9"
                  />
                  <text
                    x={px}
                    y={py + 23}
                    fill="#ffffff"
                    fontSize="8"
                    fontWeight="bold"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {person.id}
                  </text>
                </>
              )}

              {/* Floating Message Bubble (Officer Radio / Communication) */}
              {displaySettings?.showSpeechBubbles !== false && person.messageBubble && person.messageBubble.text && (
                <g className="animate-bounce" style={{ animationDuration: '2.5s' }}>
                  <rect
                    x={px - 90}
                    y={py - 42}
                    width="180"
                    height="22"
                    rx="5"
                    fill="#0b0f19"
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    opacity="0.95"
                  />
                  <polygon
                    points={`${px - 5},${py - 20} ${px + 5},${py - 20} ${px},${py - 14}`}
                    fill="#06b6d4"
                  />
                  <text
                    x={px}
                    y={py - 28}
                    fill="#38bdf8"
                    fontSize="7.5"
                    fontWeight="bold"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    📻 {person.messageBubble.text.length > 34 ? person.messageBubble.text.substring(0, 32) + '...' : person.messageBubble.text}
                  </text>
                </g>
              )}

              {/* RFID Card Badge Presentation Indicator (Workflow B) */}
              {person.rfidBadgeAction && (
                <g className="animate-pulse">
                  <rect
                    x={px - 70}
                    y={py - 38}
                    width="140"
                    height="20"
                    rx="4"
                    fill="#064e3b"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    opacity="0.95"
                  />
                  <text
                    x={px}
                    y={py - 25}
                    fill="#6ee7b7"
                    fontSize="7.5"
                    fontWeight="extrabold"
                    textAnchor="middle"
                  >
                    💳 RFID CARD PRESENTED
                  </text>
                </g>
              )}

              {/* Suspended Officer Badge */}
              {isSuspended && (
                <g className="animate-pulse">
                  <rect
                    x={px - 40}
                    y={py + 29}
                    width="80"
                    height="13"
                    rx="3"
                    fill="#7f1d1d"
                    stroke="#ef4444"
                    strokeWidth="1"
                  />
                  <text
                    x={px}
                    y={py + 38}
                    fill="#fecaca"
                    fontSize="6.5"
                    fontWeight="extrabold"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    SUSPENDED
                  </text>
                </g>
              )}

              {/* Officer Dynamic State Badge */}
              {isOfficer && !isSuspended && person.officerState && person.officerState !== 'PATROLLING' && (
                <g>
                  <rect
                    x={px - 42}
                    y={py + 29}
                    width="84"
                    height="13"
                    rx="3"
                    fill={
                      person.officerState === 'INTERCEPTING'
                        ? '#dc2626'
                        : person.officerState === 'ESCORTING' || person.officerState === 'ESCORTING_PRISONER' || person.officerState === 'ESCORTING_INJURED_PERSON'
                        ? '#d97706'
                        : person.officerState === 'REQUESTING_ACCESS'
                        ? '#0284c7'
                        : person.officerState === 'SECURING_CELL'
                        ? '#059669'
                        : person.officerState === 'MEDICAL_RECOVERY'
                        ? '#7c3aed'
                        : '#3b82f6'
                    }
                    opacity="0.95"
                  />
                  <text
                    x={px}
                    y={py + 38}
                    fill="#ffffff"
                    fontSize="6"
                    fontWeight="bold"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {person.officerState}
                  </text>
                </g>
              )}

              {/* Escaping Inmate Alert Badge */}
              {person.status === 'ESCAPING' && (
                <g className="animate-pulse">
                  <rect
                    x={px - 36}
                    y={py + 29}
                    width="72"
                    height="13"
                    rx="3"
                    fill="#dc2626"
                  />
                  <text
                    x={px}
                    y={py + 38}
                    fill="#ffffff"
                    fontSize="7"
                    fontWeight="extrabold"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    ESCAPING
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* ---------------- 7. FACILITY LOCKDOWN RED STROBE BORDER ---------------- */}
        {isLockdown && (
          <rect
            x="40"
            y="10"
            width="1520"
            height="980"
            rx="16"
            fill="none"
            stroke="#ef4444"
            strokeWidth="8"
            strokeDasharray="24,12"
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Floating Tactical Map Legend (Bottom-Left) */}
      {displaySettings?.showLegend !== false && (
        <div className="absolute bottom-5 left-5 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 text-xs text-gray-300 space-y-2 shadow-2xl select-none max-w-xs">
          <span className="font-bold text-white text-[10px] uppercase tracking-wider block border-b border-slate-800 pb-1">
            Tactical Map Legend & Symbols
          </span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>Officer (G)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <span>Supervisor (SUP)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Medical (MD/RN)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Inmate Beacon (P)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1.5 bg-slate-700 border border-slate-500"></span>
              <span>Cell Door (L/U)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1.5 bg-cyan-900 border border-cyan-400"></span>
              <span>Perimeter Gate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-cyan-950 border border-cyan-400"></span>
              <span>ESP32 Gateway</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
              <span>PA Speaker Horn</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-emerald-400"></span>
              <span>IR Optical Beam</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              <span>Alarm / Breach</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
