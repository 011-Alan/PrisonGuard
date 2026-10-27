import React, { useState, useEffect } from 'react';
import { FileCheck, ShieldCheck, AlertCircle, RefreshCw, Hash, Lock, Search, Filter, X, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [inspectEntry, setInspectEntry] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/logs/audit?limit=250`);
      const data = await res.json();
      setLogs(data.logs || []);
      setVerification(data.verification || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchQuery ||
      log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user?.username?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === 'ALL' || log.type === selectedType;
    const matchesRole = selectedRole === 'ALL' || log.user?.role === selectedRole;

    return matchesSearch && matchesType && matchesRole;
  });

  const uniqueTypes = ['ALL', ...Array.from(new Set(logs.map(l => l.type).filter(Boolean)))];
  const uniqueRoles = ['ALL', ...Array.from(new Set(logs.map(l => l.user?.role).filter(Boolean)))];

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Tamper-Evident Security Audit Logs</h2>
          <p className="text-xs text-gray-400 mt-1">Append-only administrative journal cryptographically chained via SHA-256 block hashes</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shadow transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Verify & Refresh Chain</span>
          </button>
        </div>
      </div>

      {/* Hash Verification Status Card */}
      {verification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          verification.valid
            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
            : 'bg-red-950/40 border-red-500/40 text-red-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${verification.valid ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
              {verification.valid ? <ShieldCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {verification.valid ? 'Cryptographic Hash Chain Verified (Valid)' : 'Integrity Compromise Detected!'}
              </h4>
              <p className="text-xs text-gray-300">
                {verification.valid
                  ? `All ${verification.verifiedBlocks} sequential audit records mathematically verified against genesis block.`
                  : verification.reason}
              </p>
            </div>
          </div>

          <div className="text-right font-mono text-[11px] text-gray-400 hidden sm:block">
            <span>Current Head Hash:</span>
            <div className="text-cyan-400 font-bold truncate max-w-xs">{verification.currentHeadHash?.substring(0, 24)}...</div>
          </div>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-[#111827] border border-borderMuted rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action summary, event ID, or actor..."
            className="w-full bg-[#0b0f19] border border-borderMuted rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-[11px]">Type:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-[#0b0f19] border border-borderMuted rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
            >
              {uniqueTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-[11px]">Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-[#0b0f19] border border-borderMuted rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
            >
              {uniqueRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <span className="text-gray-400 font-mono text-[11px] pl-2 border-l border-slate-800">
            {filteredLogs.length} matching
          </span>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#111827] border border-borderMuted rounded-xl overflow-hidden shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0f19] text-gray-400 font-semibold border-b border-borderMuted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp & ID</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Operator / Role</th>
                <th className="py-3 px-4">Action Summary</th>
                <th className="py-3 px-4">SHA-256 Entry Hash</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setInspectEntry(log)}
                  className="hover:bg-slate-900/70 transition cursor-pointer group"
                >
                  <td className="py-3 px-4">
                    <div className="font-mono text-gray-400">{new Date(log.timestamp).toLocaleString()}</div>
                    <div className="text-[10px] font-mono text-gray-500">{log.id}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-gray-300 border border-slate-700">
                      {log.type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-white">{log.user?.username || 'SYSTEM'}</span>
                    <span className="text-[10px] text-gray-500 ml-1.5 font-mono">({log.user?.role || 'SYSTEM'})</span>
                  </td>
                  <td className="py-3 px-4 text-gray-200">{log.action}</td>
                  <td className="py-3 px-4 font-mono text-[10px] text-cyan-400">
                    <span title={log.hash}>{log.hash?.substring(0, 16)}...</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-cyan-400 group-hover:text-cyan-300 text-xs font-semibold">
                      Details &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Entry Inspector Modal */}
      {inspectEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-borderSubtle rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-start justify-between pb-3 border-b border-borderMuted">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-950 text-cyan-400 border border-cyan-500/40 uppercase">
                  SHA-256 Audit Block Details
                </span>
                <h3 className="text-base font-bold text-white mt-1">{inspectEntry.action}</h3>
                <span className="text-xs text-gray-400 font-mono">
                  ID: {inspectEntry.id} • {new Date(inspectEntry.timestamp).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setInspectEntry(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-[11px]">
              <div className="p-3 bg-[#0b0f19] border border-borderMuted rounded-xl space-y-1">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Actor / Security Principal</span>
                <div className="text-white font-bold">{inspectEntry.user?.username} ({inspectEntry.user?.role})</div>
              </div>

              <div className="p-3 bg-[#0b0f19] border border-borderMuted rounded-xl space-y-1">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Cryptographic Hash Chaining</span>
                <div className="text-gray-400 text-[10px]">Previous Block Hash:</div>
                <div className="text-gray-300 break-all">{inspectEntry.previousHash || 'GENESIS_BLOCK_00000000000000000000000000000000'}</div>
                <div className="text-cyan-400 text-[10px] pt-1">Current Block Hash (SHA-256):</div>
                <div className="text-cyan-300 font-bold break-all">{inspectEntry.hash}</div>
              </div>

              <div className="p-3 bg-[#0b0f19] border border-borderMuted rounded-xl space-y-1">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Payload Details JSON</span>
                <pre className="p-2.5 rounded bg-black/60 text-emerald-400 overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(inspectEntry.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 border-t border-borderMuted flex justify-end">
              <button
                onClick={() => setInspectEntry(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
