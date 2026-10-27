import React, { useState, useEffect } from 'react';
import { FileCheck, ShieldCheck, AlertCircle, RefreshCw, Hash, Lock } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/logs/audit`);
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

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Tamper-Evident Security Audit Logs</h2>
          <p className="text-xs text-gray-400 mt-1">Append-only administrative journal linked via cryptographic SHA-256 hash chaining</p>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/50 transition">
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
                    <span className="text-[10px] text-gray-500 ml-1.5">({log.user?.role || 'SYSTEM'})</span>
                  </td>
                  <td className="py-3 px-4 text-gray-200">{log.action}</td>
                  <td className="py-3 px-4 font-mono text-[10px] text-cyan-400">
                    <span title={log.hash}>{log.hash?.substring(0, 16)}...</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
