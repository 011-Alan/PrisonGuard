import React, { useState } from 'react';
import { Megaphone, Send, Volume2, ShieldAlert } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function Announcements() {
  const { broadcastAnnouncement } = useSocket();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([
    { id: '1', title: 'Yard Recreation Period Concluded', message: 'All inmates in Common Yard report back to cell blocks for roll call.', time: '14:00:00', issuer: 'ADMIN' },
    { id: '2', title: 'Medical Ward Cleaning Protocol', message: 'Sanitary officers dispatched to Block C and Clinic.', time: '12:30:00', issuer: 'SUPERVISOR' }
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await broadcastAnnouncement(title, message);
      setHistory(prev => [
        { id: Date.now().toString(), title, message, time: new Date().toLocaleTimeString(), issuer: 'ADMIN' },
        ...prev
      ]);
      setTitle('');
      setMessage('');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Public Address & Facility Announcements</h2>
          <p className="text-xs text-gray-400 mt-1">Direct audio broadcast and digital signage messaging to cell blocks and staff stations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form (5 cols) */}
        <div className="lg:col-span-5 bg-[#111827] border border-borderMuted rounded-xl p-5 shadow">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-cyan-400" />
            Dispatch New Broadcast
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-gray-300 font-semibold block mb-1">Broadcast Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Inmate Headcount Sequence"
                className="w-full bg-[#0b0f19] border border-borderMuted rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-gray-300 font-semibold block mb-1">Announcement Message</label>
              <textarea
                rows="4"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter complete spoken instruction text..."
                className="w-full bg-[#0b0f19] border border-borderMuted rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Transmit Facility Broadcast</span>
            </button>
          </form>
        </div>

        {/* History (7 cols) */}
        <div className="lg:col-span-7 bg-[#111827] border border-borderMuted rounded-xl p-5 shadow">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            Recent Broadcast Records
          </h3>

          <div className="space-y-3">
            {history.map((ann) => (
              <div key={ann.id} className="p-3.5 bg-[#0b0f19] border border-slate-800 rounded-lg space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm">{ann.title}</h4>
                  <span className="font-mono text-gray-500 text-[11px]">{ann.time}</span>
                </div>
                <p className="text-gray-300 leading-relaxed">{ann.message}</p>
                <div className="pt-2 text-[10px] text-gray-500 font-mono">
                  Authorized by: <strong className="text-cyan-400">{ann.issuer}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
