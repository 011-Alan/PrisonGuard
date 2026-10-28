import React from 'react';
import { X, Sliders, CheckSquare, Square, Eye, Sparkles } from 'lucide-react';

export default function DisplaySettingsPanel({ settings, onToggle, onClose, onApplyDemoPreset }) {
  const toggles = [
    { key: 'showPeopleLabels', label: 'Person Names & IDs' },
    { key: 'showHealthBars', label: 'Person Health Bars' },
    { key: 'showSpeechBubbles', label: 'Radio Speech Bubbles' },
    { key: 'showCameraFov', label: 'CCTV Camera FOV Cones' },
    { key: 'showSensors', label: 'Sensor Icons (Reed, PIR, Beam)' },
    { key: 'showActuators', label: 'Actuator Icons (Locks, Horns)' },
    { key: 'showAccessPoints', label: 'Wi-Fi Access Points (APs)' },
    { key: 'showIoTLinks', label: 'IoT Communication Topology Links' },
    { key: 'showLegend', label: 'Tactical Map Legend' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
      <div className="bg-[#0f172a] border border-cyan-500/40 rounded-2xl w-full max-w-md p-5 shadow-2xl animate-in fade-in zoom-in-95 text-xs text-gray-300">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-white text-sm">Simulation Display Options</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-3 space-y-2">
          {toggles.map((item) => {
            const isChecked = !!settings[item.key];
            return (
              <div
                key={item.key}
                onClick={() => onToggle(item.key)}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800 cursor-pointer transition"
              >
                <span className="text-gray-200 font-medium">{item.label}</span>
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Square className="w-4 h-4 text-gray-500" />
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onApplyDemoPreset}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-950 to-blue-950 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/40 text-cyan-300 rounded-lg font-semibold transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Apply Presentation Clean Mode</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
