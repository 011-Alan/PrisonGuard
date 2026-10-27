import React from 'react';
import { HeartPulse, Activity, AlertTriangle, User, Bed, ShieldAlert } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function HealthcareWelfare() {
  const { state, triggerSensor } = useSocket();

  const patients = [
    { id: 'P-4412', name: 'Sarah Connor', bed: 'Bed 01', status: 'Inpatient (Observation)', vitals: 'BP 124/82, HR 74 bpm', doctor: 'Dr. Elizabeth Hayes', alert: true },
    { id: 'P-1044', name: 'Marcus Vance', bed: 'Outpatient', status: 'Scheduled Checkup', vitals: 'BP 130/88, HR 80 bpm', doctor: 'Dr. Elizabeth Hayes', alert: false },
    { id: 'P-5590', name: 'Tyler Durden', bed: 'Isolation Ward', status: 'Psychiatric Evaluation', vitals: 'BP 118/76, HR 68 bpm', doctor: 'Dr. Aris Vance', alert: false }
  ];

  const handleSimulateDuress = async () => {
    await triggerSensor('DURESS-MED-01', 'PRESSED');
  };

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Healthcare & Inmate Welfare Ward</h2>
          <p className="text-xs text-gray-400 mt-1">Medical bed allocation, patient vitals monitoring, and emergency nurse call stations</p>
        </div>

        <button
          onClick={handleSimulateDuress}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-lg transition"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Simulate Ward Panic / Duress Call</span>
        </button>
      </div>

      {/* Patient Ward Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {patients.map((pat) => (
          <div key={pat.id} className="bg-[#111827] border border-borderMuted rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-borderMuted">
                <div className="flex items-center gap-2">
                  <Bed className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-white text-xs">{pat.bed}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  pat.alert ? 'bg-amber-950 text-amber-300 border border-amber-500/40' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {pat.status}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Patient Name:</span>
                  <strong className="text-white">{pat.name} ({pat.id})</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Attending Clinician:</span>
                  <span className="text-gray-200">{pat.doctor}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Vitals Telemetry:</span>
                  <span className="font-mono text-cyan-400 font-bold">{pat.vitals}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-borderMuted flex items-center justify-between text-[11px]">
              <span className="text-gray-500 font-mono">Last Check: 14 mins ago</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Stable
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
