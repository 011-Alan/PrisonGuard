import React, { useState } from 'react';
import { Megaphone, Send, Volume2, ShieldAlert, Radio, CheckCircle2, Play, Info } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function Announcements() {
  const { broadcastAnnouncement, state } = useSocket();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [zones, setZones] = useState(['ALL']);
  const [previewSpeaking, setPreviewSpeaking] = useState(false);
  const [history, setHistory] = useState([
    { id: '1', title: 'Yard Recreation Period Concluded', message: 'All inmates in Common Yard report back to cell blocks for roll call.', time: '14:00:00', issuer: 'ADMIN', zones: ['ALL'] },
    { id: '2', title: 'Medical Ward Cleaning Protocol', message: 'Sanitary officers dispatched to Block C and Clinic.', time: '12:30:00', issuer: 'SUPERVISOR', zones: ['MEDICAL', 'BLOCK_C'] }
  ]);

  const speakersList = state?.speakers ? Object.values(state.speakers) : [];

  const handlePreviewSpeech = () => {
    if (!message.trim() && !title.trim()) return;
    if (!('speechSynthesis' in window)) {
      alert('SpeechSynthesis is not supported by your browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const text = `Attention: ${title}. ${message}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setPreviewSpeaking(false);
    utterance.onerror = () => setPreviewSpeaking(false);
    setPreviewSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const ann = await broadcastAnnouncement(title.trim(), message.trim(), zones, true);
      setHistory(prev => [
        {
          id: ann?.id || Date.now().toString(),
          title: title.trim(),
          message: message.trim(),
          time: new Date().toLocaleTimeString(),
          issuer: 'ADMIN',
          zones
        },
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
          <h2 className="text-xl font-bold text-white tracking-wide">Public Address & Zone-Targeted Audio Broadcast</h2>
          <p className="text-xs text-gray-400 mt-1">Multi-zone acoustic broadcasting with Web Speech API synthesizer playback on simulator devices</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Broadcast Composer Form (5 cols) */}
        <div className="lg:col-span-5 bg-[#111827] border border-borderMuted rounded-xl p-5 shadow space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-cyan-400" />
            Compose Facility Broadcast
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-gray-300 font-semibold block mb-1">Broadcast Title / Subject</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mandatory Cell Count / Yard Recall"
                className="w-full bg-[#0b0f19] border border-borderMuted rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-gray-300 font-semibold block mb-1">Target P.A. Zones</label>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                {[
                  { id: 'ALL', label: 'All Facility Horns' },
                  { id: 'BLOCK_A', label: 'Block A Corridor' },
                  { id: 'BLOCK_B', label: 'Block B Corridor' },
                  { id: 'BLOCK_C', label: 'Block C Corridor' },
                  { id: 'YARD', label: 'Common Exercise Yard' },
                  { id: 'MEDICAL', label: 'Medical Ward' },
                  { id: 'ADMIN', label: 'Administration' },
                  { id: 'SPINE', label: 'Central Secure Spine' }
                ].map(z => (
                  <label key={z.id} className="flex items-center gap-1.5 p-1.5 rounded bg-[#0b0f19] border border-borderMuted cursor-pointer text-gray-300">
                    <input
                      type="checkbox"
                      checked={zones.includes(z.id)}
                      onChange={(e) => {
                        if (z.id === 'ALL') {
                          setZones(['ALL']);
                        } else {
                          const withoutAll = zones.filter(x => x !== 'ALL');
                          if (e.target.checked) {
                            setZones([...withoutAll, z.id]);
                          } else {
                            const remaining = withoutAll.filter(x => x !== z.id);
                            setZones(remaining.length === 0 ? ['ALL'] : remaining);
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

            <div>
              <label className="text-gray-300 font-semibold block mb-1">Spoken Message Body</label>
              <textarea
                rows="4"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter complete spoken instruction text for voice synthesis..."
                className="w-full bg-[#0b0f19] border border-borderMuted rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
              ></textarea>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePreviewSpeech}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Play className={`w-3.5 h-3.5 ${previewSpeaking ? 'text-emerald-400 animate-spin' : ''}`} />
                <span>{previewSpeaking ? 'Playing...' : 'Audio Preview'}</span>
              </button>

              <button
                type="submit"
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Transmit Broadcast</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Active Speakers Grid & History (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Facility Speakers Status Grid */}
          <div className="bg-[#111827] border border-borderMuted rounded-xl p-5 shadow space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              Facility Speaker Actuators & Nodes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              {speakersList.map((spk) => {
                const isBroadcasting = spk.state === 'BROADCASTING';
                return (
                  <div
                    key={spk.id}
                    className={`p-3 rounded-lg border transition ${
                      isBroadcasting
                        ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300 animate-pulse'
                        : 'bg-[#0b0f19] border-borderMuted text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{spk.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        isBroadcasting ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-gray-400'
                      }`}>
                        {spk.state}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1 flex justify-between font-mono">
                      <span>Zone: {spk.zone}</span>
                      <span>{spk.controllerId}</span>
                    </div>
                    {spk.lastPlaybackReport && (
                      <span className="text-[10px] text-emerald-400 block mt-1 font-mono">
                        Playback: {spk.lastPlaybackReport.success ? 'Confirmed' : 'Failed'} ({spk.lastPlaybackReport.method})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Broadcast History */}
          <div className="bg-[#111827] border border-borderMuted rounded-xl p-5 shadow space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              Recent Broadcast Records
            </h3>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {history.map((ann) => (
                <div key={ann.id} className="p-3.5 bg-[#0b0f19] border border-slate-800 rounded-lg space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-sm">{ann.title}</h4>
                    <span className="font-mono text-gray-500 text-[11px]">{ann.time}</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{ann.message}</p>
                  <div className="pt-2 text-[10px] text-gray-500 font-mono flex items-center justify-between">
                    <span>Authorized by: <strong className="text-cyan-400">{ann.issuer}</strong></span>
                    <span>Zones: {Array.isArray(ann.zones) ? ann.zones.join(', ') : 'ALL'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
