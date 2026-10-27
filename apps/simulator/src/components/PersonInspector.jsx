import React from 'react';
import { X, MapPin, Radio, Compass, History, UserCheck, ShieldAlert, Navigation } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function PersonInspector({ person, onClose, isFollowing, onToggleFollow, showRoute, onToggleRoute }) {
  const { movePerson, triggerSensor } = useSocket();

  if (!person) return null;

  const isOfficer = person.type === 'OFFICER';

  const handleReturnToCell = () => {
    if (person.assignedCell?.includes('A-102')) {
      movePerson(person.id, 'W_A102');
    } else if (person.assignedCell?.includes('B-102')) {
      movePerson(person.id, 'W_B102');
    } else if (person.assignedCell?.includes('C-101')) {
      movePerson(person.id, 'W_C101');
    } else if (person.assignedZone?.includes('Perimeter')) {
      movePerson(person.id, 'W_PERIM_EAST_N');
    } else {
      movePerson(person.id, 'W_NORTH_A');
    }
  };

  return (
    <div className="absolute top-20 right-6 w-96 bg-[#0f172a]/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl shadow-2xl z-40 p-5 space-y-4 animate-in fade-in slide-in-from-right-4 select-none">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-base border shadow-lg ${
            isOfficer
              ? 'bg-blue-950 text-blue-400 border-blue-500/50 shadow-blue-950/50'
              : 'bg-amber-950 text-amber-400 border-amber-500/50 shadow-amber-950/50'
          }`}>
            {person.name.split(' ').map(n=>n[0]).join('')}
          </div>
          <div>
            <h3 className="font-bold text-white text-base leading-tight flex items-center gap-1.5">
              {person.name}
              {person.alias && <span className="text-xs text-gray-400 font-normal">"{person.alias}"</span>}
            </h3>
            <div className="flex items-center gap-2 text-xs font-mono text-gray-400 mt-0.5">
              <span>{person.id}</span>
              <span>•</span>
              <span className={isOfficer ? 'text-blue-400 font-bold' : 'text-amber-400 font-bold'}>{person.type}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Telemetry Grid */}
      <div className="space-y-2.5 text-xs">
        <div className="p-3 bg-[#080d1a] border border-slate-800 rounded-xl space-y-1">
          <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Current Room / Sector</span>
          <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
            <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{person.currentRoom}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
            <span className="text-gray-400 text-[10px] block">Assigned Quarters</span>
            <strong className="text-gray-200">{person.assignedCell || person.assignedZone}</strong>
          </div>
          <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
            <span className="text-gray-400 text-[10px] block">Current Status</span>
            <strong className={person.status === 'NORMAL' ? 'text-emerald-400' : 'text-amber-400'}>{person.status}</strong>
          </div>
          <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
            <span className="text-gray-400 text-[10px] block">Current Activity</span>
            <span className="text-gray-300">{person.activity}</span>
          </div>
          <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
            <span className="text-gray-400 text-[10px] block">Beacon Battery</span>
            <span className="text-emerald-400 font-mono font-bold">{person.batteryLevel}% • 433 MHz</span>
          </div>
        </div>

        {/* Tracking Coordinates */}
        <div className="px-3 py-2 bg-[#080d1a] border border-slate-800 rounded-lg flex items-center justify-between text-[11px] font-mono text-gray-400">
          <span>Map Grid: X: {person.x}, Y: {person.y}</span>
          <span className="text-cyan-400 font-semibold">{person.trackingStatus}</span>
        </div>
      </div>

      {/* Camera & Route Controls */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={onToggleFollow}
          className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
            isFollowing
              ? 'bg-cyan-500 text-black border-cyan-400 shadow-lg shadow-cyan-500/30'
              : 'bg-slate-800 text-gray-300 border-slate-700 hover:text-white'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>{isFollowing ? 'Following Person' : 'Follow Person'}</span>
        </button>

        <button
          onClick={onToggleRoute}
          className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
            showRoute
              ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/30'
              : 'bg-slate-800 text-gray-300 border-slate-700 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>{showRoute ? 'Hide Route' : 'Show Route'}</span>
        </button>
      </div>

      {/* Action Commands */}
      <div className="pt-2 border-t border-slate-700/80 space-y-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Simulator Actions</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleReturnToCell}
            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded text-xs font-semibold transition"
          >
            Order to Quarters
          </button>
          <button
            onClick={() => movePerson(person.id, 'W_YARD_1')}
            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded text-xs font-semibold transition"
          >
            Move to Yard
          </button>
        </div>
      </div>
    </div>
  );
}
