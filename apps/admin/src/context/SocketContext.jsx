import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_BASE_URL, WS_URL } from '../config';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState(12);
  const [state, setState] = useState(null);
  const [commands, setCommands] = useState([]);
  const [recentMqttPackets, setRecentMqttPackets] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toISOString());

  // Fetch full state snapshot via REST
  const refreshState = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/state`);
      if (res.ok) {
        const data = await res.json();
        setState(data);
        setLastSyncTime(new Date().toISOString());
      }
      const cmdRes = await fetch(`${API_BASE_URL}/api/commands`);
      if (cmdRes.ok) {
        const cmdData = await cmdRes.json();
        setCommands(cmdData.commands || []);
      }
    } catch (e) {
      console.error('Failed to fetch snapshot:', e);
    }
  }, []);

  useEffect(() => {
    const s = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 50,
      reconnectionDelay: 1000
    });

    s.on('connect', () => {
      setConnected(true);
      refreshState();
    });

    s.on('disconnect', () => {
      setConnected(false);
    });

    s.on('state:full', (newState) => {
      setState(newState);
      setLastSyncTime(new Date().toISOString());
    });

    s.on('state:tick', (tickData) => {
      setState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          systemHealth: tickData.systemHealth,
          lastUpdated: tickData.lastUpdated,
          simulationClock: tickData.simulationClock || prev.simulationClock,
          controllers: tickData.controllers || prev.controllers,
          people: tickData.people || prev.people,
          gates: tickData.gates || prev.gates,
          doors: tickData.doors || prev.doors,
          speakers: tickData.speakers || prev.speakers,
          lockdown: tickData.lockdown || prev.lockdown,
          cameras: tickData.cameras || prev.cameras,
          accessPoints: tickData.accessPoints || prev.accessPoints,
          officerRadioRequests: tickData.officerRadioRequests || prev.officerRadioRequests,
          officerTasks: tickData.officerTasks || prev.officerTasks,
          suspiciousActivities: tickData.suspiciousActivities || prev.suspiciousActivities,
          externalVisitors: tickData.externalVisitors || prev.externalVisitors,
          securityControlBreach: tickData.securityControlBreach || prev.securityControlBreach
        };
      });
    });

    s.on('command:new', (cmd) => {
      setCommands(prev => [cmd, ...prev.slice(0, 99)]);
    });

    s.on('command:update', (updatedCmd) => {
      setCommands(prev => prev.map(c => c.id === updatedCmd.id ? updatedCmd : c));
    });

    s.on('facility:lockdown_activated', (lockdownData) => {
      setState(prev => prev ? { ...prev, lockdown: lockdownData } : prev);
    });

    s.on('facility:lockdown_released', (lockdownData) => {
      setState(prev => prev ? { ...prev, lockdown: lockdownData } : prev);
    });

    s.on('people:update', (updatedPeople) => {
      setState(prev => prev ? { ...prev, people: updatedPeople } : prev);
    });

    s.on('mqtt:packet', (packet) => {
      setRecentMqttPackets(prev => [packet, ...prev.slice(0, 49)]);
    });

    s.on('mqtt:packets', (packets) => {
      setRecentMqttPackets(packets);
    });

    // Latency heartbeat check
    const pingInterval = setInterval(() => {
      const start = Date.now();
      fetch(`${API_BASE_URL}/health`)
        .then(res => res.json())
        .then(() => setLatency(Date.now() - start))
        .catch(() => {});
    }, 5000);

    setSocket(s);

    return () => {
      clearInterval(pingInterval);
      s.disconnect();
    };
  }, [refreshState]);

  // Auth fetch helper
  const authFetch = useCallback(async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  }, [token]);

  // Action methods
  const commandGate = async (gateId, targetState) => {
    return authFetch(`/api/gates/${gateId}/command`, {
      method: 'POST',
      body: JSON.stringify({ targetState })
    });
  };

  const jamGate = async (gateId) => {
    return authFetch(`/api/gates/${gateId}/jam`, {
      method: 'POST'
    });
  };

  const operateDoor = async (doorId, action) => {
    return authFetch(`/api/doors/${doorId}/operate`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  };

  const lockDoor = async (doorId, action) => {
    return authFetch(`/api/doors/${doorId}/lock`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  };

  const commandDoor = async (lockId, action) => {
    return authFetch(`/api/doors/${lockId}/command`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  };

  const activateLockdown = async (policy = {}) => {
    return authFetch('/api/lockdown/activate', {
      method: 'POST',
      body: JSON.stringify(policy)
    });
  };

  const releaseLockdown = async () => {
    return authFetch('/api/lockdown/release', {
      method: 'POST'
    });
  };

  const triggerSensor = async (deviceId, value) => {
    return authFetch(`/api/sensors/${deviceId}/trigger`, {
      method: 'POST',
      body: JSON.stringify({ value })
    });
  };

  const toggleController = async (controllerId, isOnline) => {
    return authFetch(`/api/controllers/${controllerId}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ isOnline })
    });
  };

  const scanRfid = async (readerId, cardId) => {
    return authFetch('/api/rfid/scan', {
      method: 'POST',
      body: JSON.stringify({ readerId, cardId })
    });
  };

  const movePerson = async (personId, destinationWaypointId) => {
    return authFetch(`/api/people/${personId}/move`, {
      method: 'POST',
      body: JSON.stringify({ destinationWaypointId })
    });
  };

  const createEscort = async (personId, escortId, destinationWaypointId) => {
    return authFetch(`/api/people/${personId}/escort`, {
      method: 'POST',
      body: JSON.stringify({ escortId, destinationWaypointId })
    });
  };

  const ackIncident = async (incidentId) => {
    return authFetch(`/api/incidents/${incidentId}/ack`, {
      method: 'POST'
    });
  };

  const resolveIncident = async (incidentId) => {
    return authFetch(`/api/incidents/${incidentId}/resolve`, {
      method: 'POST'
    });
  };

  const broadcastAnnouncement = async (title, message, zones = ['ALL'], chime = true) => {
    return authFetch('/api/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, message, zones, chime })
    });
  };

  const controlClock = async ({ speed, isPaused, time }) => {
    return authFetch('/api/clock/control', {
      method: 'POST',
      body: JSON.stringify({ speed, isPaused, time })
    });
  };

  const startScenario = async (scenarioId) => {
    return authFetch('/api/scenarios/start', {
      method: 'POST',
      body: JSON.stringify({ scenarioId })
    });
  };

  const stopScenario = async () => {
    return authFetch('/api/scenarios/stop', {
      method: 'POST'
    });
  };

  const resetSimulation = async () => {
    return authFetch('/api/scenarios/reset', {
      method: 'POST'
    });
  };

  const toggleCamera = async (cameraId, status) => {
    return authFetch(`/api/cameras/${cameraId}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  };

  const respondToRadioRequest = async (requestId, action = 'CLOSE_CELL') => {
    return authFetch(`/api/radio-requests/${requestId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  };

  const dispatchOfficerTask = async ({ officerId, commandType, targetWaypointId, note, priority }) => {
    return authFetch(`/api/officers/${officerId}/command`, {
      method: 'POST',
      body: JSON.stringify({ commandType, targetWaypointId, note, priority })
    });
  };

  const triggerOfficerMedical = async (officerId, scenario = 'CONFRONTATION_EXHAUSTION') => {
    return authFetch(`/api/officers/${officerId}/medical-event`, {
      method: 'POST',
      body: JSON.stringify({ scenario })
    });
  };

  const startControlledEscape = async (workflow = 'WORKFLOW_A') => {
    return authFetch('/api/scenarios/controlled-escape', {
      method: 'POST',
      body: JSON.stringify({ workflow })
    });
  };

  const startMassEscape = async () => {
    return authFetch('/api/scenarios/mass-escape', {
      method: 'POST'
    });
  };

  const sweepCamera = async (cameraId, action = 'TOGGLE') => {
    return authFetch(`/api/cameras/${cameraId}/sweep`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  };

  const panCamera = async (cameraId, angle) => {
    return authFetch(`/api/cameras/${cameraId}/pan`, {
      method: 'POST',
      body: JSON.stringify({ angle })
    });
  };

  const revokeOfficerCredential = async (officerId) => {
    return authFetch(`/api/officers/${officerId}/revoke-credential`, {
      method: 'POST'
    });
  };

  const handleVisitorDecision = async (visitorId, decision) => {
    return authFetch(`/api/visitors/${visitorId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision })
    });
  };

  const triggerSuspiciousActivity = async (data) => {
    return authFetch('/api/suspicious/trigger', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  };

  const applyHealthChange = async (personId, delta, reason) => {
    return authFetch('/api/health/change', {
      method: 'POST',
      body: JSON.stringify({ personId, delta, reason })
    });
  };

  const triggerSecurityBreach = async () => {
    return authFetch('/api/security/breach', {
      method: 'POST'
    });
  };

  const resetSecurityControlBreach = async () => {
    return authFetch('/api/security/breach/reset', {
      method: 'POST'
    });
  };

  const pauseScenario = async () => {
    return authFetch('/api/scenarios/pause', {
      method: 'POST'
    });
  };

  const resumeScenario = async () => {
    return authFetch('/api/scenarios/resume', {
      method: 'POST'
    });
  };

  return (
    <SocketContext.Provider
      value={{
        connected,
        latency,
        state,
        commands,
        recentMqttPackets,
        lastSyncTime,
        refreshState,
        commandGate,
        jamGate,
        operateDoor,
        lockDoor,
        commandDoor,
        activateLockdown,
        releaseLockdown,
        triggerSensor,
        toggleController,
        scanRfid,
        movePerson,
        createEscort,
        ackIncident,
        resolveIncident,
        broadcastAnnouncement,
        controlClock,
        startScenario,
        stopScenario,
        pauseScenario,
        resumeScenario,
        resetSimulation,
        toggleCamera,
        sweepCamera,
        panCamera,
        respondToRadioRequest,
        dispatchOfficerTask,
        triggerOfficerMedical,
        revokeOfficerCredential,
        handleVisitorDecision,
        triggerSuspiciousActivity,
        applyHealthChange,
        triggerSecurityBreach,
        resetSecurityControlBreach,
        startControlledEscape,
        startMassEscape
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
