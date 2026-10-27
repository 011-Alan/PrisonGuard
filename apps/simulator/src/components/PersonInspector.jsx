import React, { useState } from 'react';
import { X, MapPin, Radio, Compass, History, UserCheck, ShieldAlert, Navigation, FileText, HeartPulse, Phone, AlertCircle } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function PersonInspector({ person, onClose, isFollowing, onToggleFollow, showRoute, onToggleRoute }) {
  const { movePerson, triggerSensor } = useSocket();
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'profile' | 'interviews'

  if (!person) return null;

  const isOfficer = person.type === 'OFFICER';
  const isSupervisor = person.type === 'SUPERVISOR';
  const isDoctor = person.type === 'MEDICAL_DOCTOR';
  const isNurse = person.type === 'MEDICAL_NURSE';
  const isMedical = isDoctor || isNurse;
  const isPrisoner = person.type === 'PRISONER';

  // Badge Styling based on fictional role
  let badgeColor = 'bg-amber-950 text-amber-400 border-amber-500/50 shadow-amber-950/50';
  let roleTitle = 'PRISONER';
  if (isOfficer) {
    badgeColor = 'bg-blue-950 text-blue-400 border-blue-500/50 shadow-blue-950/50';
    roleTitle = 'CORRECTIONAL OFFICER';
  } else if (isSupervisor) {
    badgeColor = 'bg-purple-950 text-purple-400 border-purple-500/50 shadow-purple-950/50';
    roleTitle = 'SECURITY SUPERVISOR';
  } else if (isDoctor) {
    badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-500/50 shadow-emerald-950/50';
    roleTitle = 'CHIEF MEDICAL OFFICER';
  } else if (isNurse) {
    badgeColor = 'bg-teal-950 text-teal-300 border-teal-500/50 shadow-teal-950/50';
    roleTitle = 'TRIAGE NURSE';
  }

  const handleReturnToCell = () => {
    if (person.assignedCell?.includes('A-102')) {
      movePerson(person.id, 'W_A102');
    } else if (person.assignedCell?.includes('B-102')) {
      movePerson(person.id, 'W_B102');
    } else if (person.assignedCell?.includes('C-101')) {
      movePerson(person.id, 'W_C101');
    } else if (person.assignedCell?.includes('ISO-01')) {
      movePerson(person.id, 'W_ISO_CELL1');
    } else if (person.assignedZone?.includes('Perimeter')) {
      movePerson(person.id, 'W_PERIM_EAST_N');
    } else if (isMedical) {
      movePerson(person.id, 'W_MED_1');
    } else {
      movePerson(person.id, 'W_NORTH_A');
    }
  };

  return (
    <div className="absolute top-20 right-6 w-96 bg-[#0f172a]/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl shadow-2xl z-40 p-5 space-y-4 animate-in fade-in slide-in-from-right-4 select-none max-h-[85vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-base border shadow-lg ${badgeColor}`}>
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
              <span className="font-bold text-cyan-400">{roleTitle}</span>
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

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`pb-2 px-3 border-b-2 transition ${
            activeTab === 'telemetry' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Live Telemetry
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-2 px-3 border-b-2 transition ${
            activeTab === 'profile' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Fictional Profile
        </button>
        {person.interviewHistory && (
          <button
            onClick={() => setActiveTab('interviews')}
            className={`pb-2 px-3 border-b-2 transition ${
              activeTab === 'interviews' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Interviews ({person.interviewHistory.length})
          </button>
        )}
      </div>

      {activeTab === 'telemetry' && (
        <div className="space-y-3 text-xs">
          {/* Primary Telemetry Grid */}
          <div className="p-3 bg-[#080d1a] border border-slate-800 rounded-xl space-y-1">
            <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Current Room / Location</span>
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
              <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{person.currentRoom}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
              <span className="text-gray-400 text-[10px] block">Assigned Quarters / Post</span>
              <strong className="text-gray-200">{person.assignedCell || person.assignedZone}</strong>
            </div>
            <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
              <span className="text-gray-400 text-[10px] block">Current Status / Role State</span>
              <strong className={person.status === 'NORMAL' ? 'text-emerald-400' : 'text-amber-400'}>
                {isOfficer ? (person.officerState || person.status) : person.status}
              </strong>
            </div>
            <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
              <span className="text-gray-400 text-[10px] block">{isPrisoner ? 'Behavior Profile' : 'Current Task'}</span>
              <span className="text-cyan-300 font-semibold">{isPrisoner ? (person.profile || 'ROUTINE') : (person.currentAssignment?.type || 'ROUTINE_PATROL')}</span>
            </div>
            <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg">
              <span className="text-gray-400 text-[10px] block">Simulated Beacon</span>
              <span className="text-emerald-400 font-mono font-bold">{person.batteryLevel}% • {person.beaconFrequencyHz || 433} MHz</span>
            </div>
          </div>

          {/* Tracking Coordinates */}
          <div className="px-3 py-2 bg-[#080d1a] border border-slate-800 rounded-lg flex items-center justify-between text-[11px] font-mono text-gray-400">
            <span>Map Grid: X: {person.x}, Y: {person.y}</span>
            <span className="text-cyan-400 font-semibold">{person.trackingStatus}</span>
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

          {/* Simulator Navigation Actions */}
          <div className="pt-2 border-t border-slate-700/80 space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Simulator Route Actions</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleReturnToCell}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded text-xs font-semibold transition"
              >
                Send to Quarters/Post
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
      )}

      {activeTab === 'profile' && (
        <div className="space-y-3 text-xs">
          {/* Fictional Disclaimer */}
          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-300 text-[11px] flex gap-2 items-start">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <span><strong>Fictional Demonstration Profile:</strong> This data is part of an academic IoT simulation scenario and does not represent real persons or legal records.</span>
          </div>

          {/* Case Background */}
          {person.caseBackground && (
            <div className="p-3 bg-[#080d1a] border border-slate-800 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Case History & Narrative</span>
              <p className="text-gray-300 text-xs leading-relaxed">{person.caseBackground}</p>
            </div>
          )}

          {/* Medical & Welfare Notes */}
          {person.medicalHistory && (
            <div className="p-3 bg-[#080d1a] border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[10px] uppercase tracking-wider">
                <HeartPulse className="w-3.5 h-3.5" />
                <span>Medical Observation Notes</span>
              </div>
              <p className="text-gray-300 text-xs">{person.medicalHistory}</p>
            </div>
          )}

          {/* Emergency Contact */}
          {person.emergencyContact && (
            <div className="p-2.5 bg-[#080d1a] border border-slate-800 rounded-lg flex items-center justify-between text-xs">
              <span className="text-gray-400 text-[10px]">Emergency Contact:</span>
              <span className="text-gray-200 font-medium">{person.emergencyContact}</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'interviews' && person.interviewHistory && (
        <div className="space-y-2.5 text-xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Recorded Statement Sessions</span>
          {person.interviewHistory.map((item, idx) => (
            <div key={idx} className="p-3 bg-[#080d1a] border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400 border-b border-slate-800/80 pb-1">
                <span>{item.date}</span>
                <span>Interviewer: {item.interviewer}</span>
              </div>
              <p className="text-gray-300 text-xs mt-1 leading-normal">"{item.summary}"</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
