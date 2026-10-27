import React, { useState } from 'react';
import { KeyRound, ShieldCheck, ShieldAlert, CreditCard, Play, CheckCircle2, XCircle } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function AccessControl() {
  const { state, scanRfid } = useSocket();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReader, setSelectedReader] = useState('RFID-BLOCK-A');
  const [cardId, setCardId] = useState('CARD-OFC-514');
  const [lastScanResult, setLastScanResult] = useState(null);

  const accessLogs = state?.accessLogs || [];
  const readers = state?.devices
    ? Object.values(state.devices).filter(d => d.type === 'RFID_READER')
    : [];

  const handleSimulateSwipe = async (e) => {
    e.preventDefault();
    try {
      const res = await scanRfid(selectedReader, cardId);
      setLastScanResult(res.accessLog);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      {/* Simulate RFID Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-borderSubtle rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-borderMuted">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Simulate RFID Card Presentation</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSimulateSwipe} className="space-y-4 py-4 text-xs">
              <div>
                <label className="text-gray-300 font-semibold block mb-1">Target RFID Reader</label>
                <select
                  value={selectedReader}
                  onChange={(e) => setSelectedReader(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-borderMuted rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  {readers.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.location})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-300 font-semibold block mb-1">RFID Token / Card ID</label>
                <input
                  type="text"
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-borderMuted rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {/* Preset Quick Badges */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-gray-400">Quick Test Credentials:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCardId('CARD-OFC-514')}
                    className="px-2.5 py-1 bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-mono hover:bg-emerald-900/60"
                  >
                    Lt. Sterling (Authorized)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardId('CARD-OFC-702')}
                    className="px-2.5 py-1 bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-mono hover:bg-emerald-900/60"
                  >
                    Capt. Reyes (Authorized)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardId('UNAUTHORIZED-CLONE-99')}
                    className="px-2.5 py-1 bg-red-950/60 text-red-300 border border-red-500/40 rounded text-[11px] font-mono hover:bg-red-900/60"
                  >
                    Unknown / Invalid Token
                  </button>
                </div>
              </div>

              {/* Feedback Display */}
              {lastScanResult && (
                <div className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                  lastScanResult.result === 'GRANTED'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/40 border-red-500/40 text-red-200'
                }`}>
                  <div>
                    <strong className="block">{lastScanResult.result === 'GRANTED' ? 'ACCESS GRANTED' : 'ACCESS DENIED'}</strong>
                    <span className="text-[11px] text-gray-300">{lastScanResult.reason} ({lastScanResult.personName})</span>
                  </div>
                  {lastScanResult.result === 'GRANTED' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  Transmit Card Swipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">RFID Access Control & Badge Validation</h2>
          <p className="text-xs text-gray-400 mt-1">Real-time contactless badge scans, electronic strikes, and security audit log</p>
        </div>

        <button
          onClick={() => {
            setLastScanResult(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold shadow-lg transition"
        >
          <CreditCard className="w-4 h-4" />
          <span>Simulate Card Swipe</span>
        </button>
      </div>

      {/* Access Log Table */}
      <div className="bg-[#111827] border border-borderMuted rounded-xl overflow-hidden shadow">
        <div className="p-4 border-b border-borderMuted flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Live RFID Transaction Log</h3>
          </div>
          <span className="text-xs text-gray-400 font-mono">Recorded Events: {accessLogs.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0f19] text-gray-400 font-semibold border-b border-borderMuted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Reader Terminal</th>
                <th className="py-3 px-4">Credential ID</th>
                <th className="py-3 px-4">Individual</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Authorization Result</th>
                <th className="py-3 px-4">Validation Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {accessLogs.map((log) => {
                const isGranted = log.result === 'GRANTED';
                return (
                  <tr key={log.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-3 px-4 font-mono text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="py-3 px-4 font-mono text-cyan-400">{log.readerId}</td>
                    <td className="py-3 px-4 font-mono text-gray-300">{log.cardId}</td>
                    <td className="py-3 px-4 font-bold text-white">{log.personName}</td>
                    <td className="py-3 px-4 text-gray-400">{log.role}</td>
                    <td className="py-3 px-4 text-gray-300">{log.location}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                        isGranted
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                          : 'bg-red-950/60 text-red-400 border border-red-500/40'
                      }`}>
                        {isGranted ? <ShieldCheck className="w-3 h-3 text-emerald-400" /> : <ShieldAlert className="w-3 h-3 text-red-400" />}
                        {log.result}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{log.reason}</td>
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
