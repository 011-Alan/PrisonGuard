import React, { useState, useEffect } from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import PrisonFloorPlan from './components/PrisonFloorPlan';
import PersonInspector from './components/PersonInspector';
import DeviceInspector from './components/DeviceInspector';
import ScenarioToolbar from './components/ScenarioToolbar';
import StatusBar from './components/StatusBar';

function SimulatorMain() {
  const { state } = useSocket();
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
    }
  }, [state?.devices]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.4));
  const handleResetView = () => {
    setZoom(0.85);
    setPan({ x: 50, y: 30 });
    setIsFollowing(false);
  };

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
