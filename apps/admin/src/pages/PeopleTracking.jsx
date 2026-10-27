import React, { useState } from 'react';
import { Users, UserCheck, Search, Radio, Compass, ExternalLink, ShieldAlert, History, MapPin } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { SIMULATOR_URL } from '../config';

export default function PeopleTracking() {
  const { state } = useSocket();
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'PRISONER' | 'OFFICER'
  const [search, setSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);

  const peopleList = state?.people ? Object.values(state.people) : [];

  const filtered = peopleList.filter(p => {
    if (filterType !== 'ALL' && p.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.currentRoom.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      {/* Detail Inspector Modal/Drawer */}
      {selectedPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-borderSubtle rounded-2xl w-full max-w-xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-4 border-b border-borderMuted">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-extrabold ${
                  selectedPerson.type === 'OFFICER'
                    ? 'bg-blue-950/80 text-blue-400 border border-blue-500/40'
                    : 'bg-amber-950/80 text-amber-400 border border-amber-500/40'
                }`}>
                  {selectedPerson.name.split(' ').map(n=>n[0]).join('')}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {selectedPerson.name}
                    {selectedPerson.alias && <span className="text-xs text-gray-400 font-normal">"{selectedPerson.alias}"</span>}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                    <span>ID: {selectedPerson.id}</span>
                    <span>•</span>
                    <span className="text-emerald-400">{selectedPerson.trackingStatus}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedPerson(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#0b0f19] rounded-lg border border-slate-800">
                  <span className="text-gray-400 block mb-1">Current Sector / Room</span>
                  <span className="text-sm font-bold text-white flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    {selectedPerson.currentRoom}
                  </span>
                </div>
                <div className="p-3 bg-[#0b0f19] rounded-lg border border-slate-800">
                  <span className="text-gray-400 block mb-1">Assigned Quarters / Post</span>
                  <span className="text-sm font-bold text-gray-200">
                    {selectedPerson.assignedCell || selectedPerson.assignedZone}
                  </span>
                </div>
                <div className="p-3 bg-[#0b0f19] rounded-lg border border-slate-800">
                  <span className="text-gray-400 block mb-1">Current Activity</span>
                  <span className="text-gray-200 font-medium">{selectedPerson.activity}</span>
                </div>
                <div className="p-3 bg-[#0b0f19] rounded-lg border border-slate-800">
                  <span className="text-gray-400 block mb-1">Beacon Battery & Telemetry</span>
                  <span className="text-emerald-400 font-mono font-bold">{selectedPerson.batteryLevel}% • {selectedPerson.beaconFrequencyHz} MHz</span>
                </div>
              </div>

              {/* Location History Route Breadcrumbs */}
              <div>
                <h4 className="font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-cyan-400" />
                  Recent Simulated Route History
                </h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedPerson.routeHistory && selectedPerson.routeHistory.length > 0 ? (
                    selectedPerson.routeHistory.map((step, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-[#0b0f19] rounded text-[11px] text-gray-400">
                        <span className="text-gray-300 font-medium">{step.room}</span>
                        <span className="font-mono text-gray-500">{new Date(step.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-gray-500 bg-[#0b0f19] rounded">
                      Stationary - No route transitions recorded
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-borderMuted flex items-center justify-between">
              <span className="text-[10px] text-gray-500 font-mono">
                Last Ping: {new Date(selectedPerson.lastLocationUpdate).toLocaleTimeString()}
              </span>
              <a
                href={`${SIMULATOR_URL}?focusPerson=${selectedPerson.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow"
              >
                <span>Focus in 2D Simulator</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Personnel & Tracking Directory</h2>
          <p className="text-xs text-gray-400 mt-1">Simulated location beacons, active patrol zones, and inmate tracking status</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Category Filter Pills */}
          <div className="flex bg-[#111827] border border-borderMuted p-1 rounded-lg">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${filterType === 'ALL' ? 'bg-slate-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              All ({peopleList.length})
            </button>
            <button
              onClick={() => setFilterType('PRISONER')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${filterType === 'PRISONER' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' : 'text-gray-400 hover:text-white'}`}
            >
              Inmates ({peopleList.filter(p=>p.type==='PRISONER').length})
            </button>
            <button
              onClick={() => setFilterType('OFFICER')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${filterType === 'OFFICER' ? 'bg-blue-950 text-blue-300 border border-blue-500/40' : 'text-gray-400 hover:text-white'}`}
            >
              Officers ({peopleList.filter(p=>p.type==='OFFICER').length})
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, ID, sector..."
              className="bg-[#111827] border border-borderMuted rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-[#111827] border border-borderMuted rounded-xl overflow-hidden shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0f19] text-gray-400 font-semibold border-b border-borderMuted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Individual</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Assigned Location</th>
                <th className="py-3 px-4">Current Sector</th>
                <th className="py-3 px-4">Activity Status</th>
                <th className="py-3 px-4">Beacon Telemetry</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((person) => {
                const isOfficer = person.type === 'OFFICER';
                return (
                  <tr
                    key={person.id}
                    onClick={() => setSelectedPerson(person)}
                    className="hover:bg-slate-900/60 cursor-pointer transition group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          isOfficer ? 'bg-blue-950 text-blue-400 border border-blue-500/30' : 'bg-amber-950 text-amber-400 border border-amber-500/30'
                        }`}>
                          {person.name.split(' ').map(n=>n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-bold text-white group-hover:text-cyan-400 transition">{person.name}</div>
                          <div className="text-[10px] text-gray-500 font-mono">{person.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isOfficer ? 'bg-blue-950/60 text-blue-300 border border-blue-500/40' : 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                      }`}>
                        {person.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300">{person.assignedCell || person.assignedZone}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-cyan-300 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        {person.currentRoom}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{person.activity}</td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      <span className="text-emerald-400 font-bold">{person.batteryLevel}%</span>
                      <span className="text-gray-500 text-[10px] ml-1.5">{person.trackingStatus}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPerson(person);
                        }}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded text-xs font-semibold transition"
                      >
                        Inspect Beacon
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
