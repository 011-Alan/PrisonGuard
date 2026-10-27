import React, { useState, useEffect } from 'react';
import { Radio, ArrowRight, Server, Wifi, Cpu, Layers, Terminal, RefreshCw, Send } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { API_BASE_URL } from '../config';

export default function MqttArchitecture() {
  const { recentMqttPackets } = useSocket();
  const [packets, setPackets] = useState([]);
  const [filterTopic, setFilterTopic] = useState('');

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/logs/mqtt`)
      .then(res => res.json())
      .then(data => {
        if (data.packets) setPackets(data.packets);
      })
      .catch(() => {});
  }, []);

  // Merge live packets from context
  const displayPackets = recentMqttPackets.length > 0 ? recentMqttPackets : packets;
  const filteredPackets = filterTopic
    ? displayPackets.filter(p => p.topic.toLowerCase().includes(filterTopic.toLowerCase()))
    : displayPackets;

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">IoT Architecture & MQTT Telemetry Bus</h2>
          <p className="text-xs text-gray-400 mt-1">End-to-end hardware pipeline tracing, topic publish/subscribe, and packet sniffer</p>
        </div>

        <div className="px-3 py-1 bg-amber-950/60 border border-amber-500/40 rounded-full text-amber-300 text-xs font-mono font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span>SIMULATED MQTT — NO EXTERNAL BROKER CONNECTED</span>
        </div>
      </div>

      {/* Visual Pipeline Flowchart (Section 13) */}
      <div className="bg-[#111827] border border-borderMuted rounded-xl p-6 shadow-xl">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-5 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          Hardware-to-Application Data Pipeline
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
          {/* Stage 1: Sensor */}
          <div className="p-4 bg-[#0b0f19] border border-cyan-500/30 rounded-xl text-center space-y-1 relative group hover:border-cyan-400 transition">
            <div className="w-9 h-9 rounded-full bg-cyan-950 text-cyan-400 mx-auto flex items-center justify-center font-bold text-xs border border-cyan-500/40">
              1
            </div>
            <h4 className="text-xs font-bold text-white pt-1">Virtual Sensors</h4>
            <p className="text-[10px] text-gray-400 leading-tight">Reed switch, PIR, IR beam, RFID, Vibration</p>
          </div>

          <div className="hidden md:flex justify-center text-cyan-400 font-bold">
            <ArrowRight className="w-5 h-5 animate-pulse" />
          </div>

          {/* Stage 2: ESP32 Microcontroller */}
          <div className="p-4 bg-[#0b0f19] border border-blue-500/30 rounded-xl text-center space-y-1 relative group hover:border-blue-400 transition">
            <div className="w-9 h-9 rounded-full bg-blue-950 text-blue-400 mx-auto flex items-center justify-center font-bold text-xs border border-blue-500/40">
              2
            </div>
            <h4 className="text-xs font-bold text-white pt-1">ESP32 Nodes</h4>
            <p className="text-[10px] text-gray-400 leading-tight">GPIO Interrupts, FreeRTOS, Analog/Digital Sampling</p>
          </div>

          <div className="hidden md:flex justify-center text-blue-400 font-bold">
            <ArrowRight className="w-5 h-5 animate-pulse" />
          </div>

          {/* Stage 3: Simulated MQTT Broker */}
          <div className="p-4 bg-[#0b0f19] border border-purple-500/30 rounded-xl text-center space-y-1 relative group hover:border-purple-400 transition">
            <div className="w-9 h-9 rounded-full bg-purple-950 text-purple-400 mx-auto flex items-center justify-center font-bold text-xs border border-purple-500/40">
              3
            </div>
            <h4 className="text-xs font-bold text-white pt-1">MQTT Bus (QoS 1)</h4>
            <p className="text-[10px] text-gray-400 leading-tight">Topic Pub/Sub: prisonGuard/# topics</p>
          </div>

          <div className="hidden md:flex justify-center text-purple-400 font-bold">
            <ArrowRight className="w-5 h-5 animate-pulse" />
          </div>

          {/* Stage 4: Authoritative Engine */}
          <div className="p-4 bg-[#0b0f19] border border-emerald-500/30 rounded-xl text-center space-y-1 relative group hover:border-emerald-400 transition">
            <div className="w-9 h-9 rounded-full bg-emerald-950 text-emerald-400 mx-auto flex items-center justify-center font-bold text-xs border border-emerald-500/40">
              4
            </div>
            <h4 className="text-xs font-bold text-white pt-1">Backend Server</h4>
            <p className="text-[10px] text-gray-400 leading-tight">Rules Engine, Hash Audit Chain, Auth API</p>
          </div>

          <div className="hidden md:flex justify-center text-emerald-400 font-bold">
            <ArrowRight className="w-5 h-5 animate-pulse" />
          </div>

          {/* Stage 5: WebSockets & Apps */}
          <div className="p-4 bg-[#0b0f19] border border-red-500/30 rounded-xl text-center space-y-1 relative group hover:border-red-400 transition">
            <div className="w-9 h-9 rounded-full bg-red-950 text-red-400 mx-auto flex items-center justify-center font-bold text-xs border border-red-500/40">
              5
            </div>
            <h4 className="text-xs font-bold text-white pt-1">WebSockets</h4>
            <p className="text-[10px] text-gray-400 leading-tight">Admin Portal (5173) & 2D Simulator (5174)</p>
          </div>
        </div>
      </div>

      {/* Live Packet Sniffer */}
      <div className="bg-[#111827] border border-borderMuted rounded-xl overflow-hidden shadow">
        <div className="p-4 border-b border-borderMuted flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Live MQTT Packet Stream</h3>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={filterTopic}
              onChange={(e) => setFilterTopic(e.target.value)}
              placeholder="Filter by topic (e.g. gate, cell, rfid)..."
              className="bg-[#0b0f19] border border-borderMuted rounded-lg px-3 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <span className="text-xs text-gray-500 font-mono">Packets: {filteredPackets.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0b0f19] text-gray-400 font-semibold border-b border-borderMuted uppercase tracking-wider text-[10px] sticky top-0">
              <tr>
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Topic</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Dir</th>
                <th className="py-2.5 px-4">QoS</th>
                <th className="py-2.5 px-4">Payload (JSON)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredPackets.map((pkt) => (
                <tr key={pkt.id} className="hover:bg-slate-900/60 transition">
                  <td className="py-2 px-4 text-gray-500">{new Date(pkt.timestamp).toLocaleTimeString()}</td>
                  <td className="py-2 px-4 font-bold text-cyan-300">{pkt.topic}</td>
                  <td className="py-2 px-4">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      pkt.messageType === 'COMMAND' ? 'bg-amber-950 text-amber-300' : pkt.messageType === 'ACK' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-gray-300'
                    }`}>
                      {pkt.messageType}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-gray-400">{pkt.direction === 'INBOUND' ? '← IN' : '→ OUT'}</td>
                  <td className="py-2 px-4 text-gray-500">{pkt.qos}</td>
                  <td className="py-2 px-4 text-gray-300 truncate max-w-md">
                    {JSON.stringify(pkt.payload)}
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
