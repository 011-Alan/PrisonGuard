import React, { useState, useEffect } from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import PrisonFloorPlan from './components/PrisonFloorPlan';
import PersonInspector from './components/PersonInspector';
import DeviceInspector from './components/DeviceInspector';
import ScenarioToolbar from './components/ScenarioToolbar';
import StatusBar from './components/StatusBar';
import { Megaphone, X, AlertOctagon } from 'lucide-react';

function SimulatorMain() {
  const { state, activeAnnouncement, setActiveAnnouncement } = useSocket();
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 50, y: 30 });
  const [showIoTOverlay, setShowIoTOverlay] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showRoute, setShowRoute] = useState(false);

  // Parse URL search params (e.g. ?focusPerson=P-1044 or ?focusIncident=...)
  useEffect(() => {
    if (!state?.people) return;
    const params = new URLSearchParams(window.location.search);
    const focusPersonId = params.get('focusPerson');
    const focusIncidentId = params.get('focusIncident');

    if (focusPersonId && state.people[focusPersonId]) {
      const p = state.people[focusPersonId];
      setSelectedPerson(p);
      setPan({
        x: window.innerWidth / 2 - p.x * zoom,
        y: window.innerHeight / 2 - p.y * zoom
      });
    } else if (focusIncidentId && state.incidents) {
      const inc = state.incidents.find(i => i.id === focusIncidentId);
      if (inc && inc.coordinates) {
        setPan({
          x: window.innerWidth / 2 - inc.coordinates.x * zoom,
          y: window.innerHeight / 2 - inc.coordinates.y * zoom
        });
        if (inc.associatedDevice && state.devices[inc.associatedDevice]) {
          setSelectedDevice(state.devices[inc.associatedDevice]);
        }
      }
    }
  }, [state, zoom]);

  // Keep selected person updated with live movement ticks
  useEffect(() => {
    if (selectedPerson && state?.people?.[selectedPerson.id]) {
      setSelectedPerson(state.people[selectedPerson.id]);
    }
  }, [state?.people]);

  // Keep selected device updated
  useEffect(() => {
    if (selectedDevice && state?.devices?.[selectedDevice.id]) {
      setSelectedDevice(state.devices[selectedDevice.id]);
    } else if (selectedDevice && state?.doors?.[selectedDevice.id]) {
      setSelectedDevice(state.doors[selectedDevice.id]);
    } else if (selectedDevice && state?.speakers?.[selectedDevice.id]) {
      setSelectedDevice(state.speakers[selectedDevice.id]);
    } else if (selectedDevice && state?.gates?.[selectedDevice.id]) {
      setSelectedDevice(state.gates[selectedDevice.id]);
    }
  }, [state?.devices, state?.doors, state?.speakers, state?.gates]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.4));
  const handleResetView = () => {
    setZoom(0.85);
    setPan({ x: 50, y: 30 });
    setIsFollowing(false);
  };

  const isLockdown = state?.lockdown?.isActive;

  return (
    <div className="w-screen h-screen relative bg-[#080d1a] overflow-hidden select-none">
      {/* Top Scenario & Control Toolbar */}
      <ScenarioToolbar
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        showIoTOverlay={showIoTOverlay}
        onToggleIoTOverlay={() => setShowIoTOverlay(!showIoTOverlay)}
      />

      {/* Emergency Facility Lockdown Banner */}
      {isLockdown && (
        <div className="absolute top-16 left-0 right-0 z-40 bg-red-600/90 text-white font-extrabold text-xs tracking-widest uppercase py-1.5 px-4 flex items-center justify-center gap-3 shadow-xl backdrop-blur-md animate-pulse">
          <AlertOctagon className="w-4 h-4 fill-white text-red-600" />
          <span>FACILITY EMERGENCY LOCKDOWN ACTIVE • ALL BARRIERS AND GATES SECURED</span>
          <AlertOctagon className="w-4 h-4 fill-white text-red-600" />
        </div>
      )}

      {/* Public Address Announcement Live Toast */}
      {activeAnnouncement && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#111827]/95 border-2 border-cyan-400 rounded-2xl p-4 shadow-2xl flex items-center gap-4 max-w-lg animate-in slide-in-from-top-6">
          <div className="p-3 bg-cyan-950 rounded-xl text-cyan-400 animate-pulse">
            <Megaphone className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-mono uppercase font-bold text-cyan-400 tracking-wider">Facility Public Address Broadcast</span>
            <h4 className="text-white font-bold text-sm">{activeAnnouncement.title}</h4>
            <p className="text-gray-300 text-xs mt-0.5">{activeAnnouncement.message}</p>
          </div>
          <button onClick={() => setActiveAnnouncement(null)} className="text-gray-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Interactive 2D Floor Plan */}
      <PrisonFloorPlan
        zoom={zoom}
        pan={pan}
        onPanChange={setPan}
        showIoTOverlay={showIoTOverlay}
        selectedPerson={selectedPerson}
        onSelectPerson={(p) => {
          setSelectedPerson(p);
          setSelectedDevice(null);
        }}
        selectedDevice={selectedDevice}
        onSelectDevice={(d) => {
          setSelectedDevice(d);
          setSelectedPerson(null);
        }}
        isFollowing={isFollowing}
        showRoute={showRoute}
      />

      {/* Person Inspector Drawer */}
      {selectedPerson && (
        <PersonInspector
          person={selectedPerson}
          onClose={() => {
            setSelectedPerson(null);
            setIsFollowing(false);
          }}
          isFollowing={isFollowing}
          onToggleFollow={() => setIsFollowing(!isFollowing)}
          showRoute={showRoute}
          onToggleRoute={() => setShowRoute(!showRoute)}
        />
      )}

      {/* Device Inspector Drawer */}
      {selectedDevice && (
        <DeviceInspector
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
        />
      )}

      {/* Bottom Status Bar */}
      <StatusBar />
    </div>
  );
}

export default function App() {
  return (
    <SocketProvider>
      <SimulatorMain />
    </SocketProvider>
  );
}
