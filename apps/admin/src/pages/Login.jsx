import React, { useState } from 'react';
import { Shield, Lock, User, AlertCircle, ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background aesthetic grid / glow */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25"></div>
      <div className="absolute w-[500px] h-[500px] bg-red-950/20 rounded-full blur-3xl pointer-events-none -top-20 -left-20"></div>
      <div className="absolute w-[500px] h-[500px] bg-blue-950/20 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20"></div>

      <div className="w-full max-w-md bg-[#111827] border border-borderSubtle rounded-2xl p-8 shadow-2xl relative z-10 space-y-6">
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 via-red-700 to-red-950 border border-red-500/40 shadow-xl shadow-red-950/50">
            <Shield className="w-8 h-8 text-white stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-wider">Prison<span className="text-red-500">Guard</span></h1>
          <p className="text-xs text-gray-400 font-medium tracking-widest uppercase">Smart Prison Security & Operations Management</p>
        </div>

        {error && (
          <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-gray-300 font-semibold block mb-1.5">Authorized Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-[#0b0f19] border border-borderMuted rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500/70 focus:ring-1 focus:ring-red-500/40"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-300 font-semibold block mb-1.5">Security Passcode</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0b0f19] border border-borderMuted rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500/70 focus:ring-1 focus:ring-red-500/40 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Authenticate & Access SOC'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 1-Click Academic Demo Credentials */}
        <div className="pt-4 border-t border-borderMuted space-y-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block text-center">
            Academic Demonstration Accounts
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin', 'admin123')}
              className="p-2 bg-[#0b0f19] hover:bg-slate-800 border border-slate-700 rounded-lg text-center transition group"
            >
              <div className="font-bold text-white text-[11px] group-hover:text-red-400">ADMIN</div>
              <div className="text-[9px] text-gray-400">admin / admin123</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('supervisor', 'super123')}
              className="p-2 bg-[#0b0f19] hover:bg-slate-800 border border-slate-700 rounded-lg text-center transition group"
            >
              <div className="font-bold text-white text-[11px] group-hover:text-amber-400">SUPERVISOR</div>
              <div className="text-[9px] text-gray-400">supervisor / super123</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('operator', 'op123')}
              className="p-2 bg-[#0b0f19] hover:bg-slate-800 border border-slate-700 rounded-lg text-center transition group"
            >
              <div className="font-bold text-white text-[11px] group-hover:text-cyan-400">OPERATOR</div>
              <div className="text-[9px] text-gray-400">operator / op123</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
