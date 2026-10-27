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
  const [recentMqttPackets, setRecentMqttPackets] = useState([]);

  // Fetch full state snapshot via REST
  const refreshState = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/state`);
      if (res.ok) {
        const data = await res.json();
        setState(data);
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
    });

    s.on('state:tick', (tickData) => {
      setState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          systemHealth: tickData.systemHealth,
          lastUpdated: tickData.lastUpdated,
          controllers: tickData.controllers,
          people: tickData.people,
          gates: tickData.gates
        };
      });
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

  const commandDoor = async (lockId, action) => {
    return authFetch(`/api/doors/${lockId}/command`, {
      method: 'POST',
      body: JSON.stringify({ action })
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

  const broadcastAnnouncement = async (title, message) => {
    return authFetch('/api/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, message })
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

  return (
    <SocketContext.Provider
      value={{
        connected,
        latency,
        state,
        recentMqttPackets,
        refreshState,
        commandGate,
        jamGate,
        commandDoor,
        triggerSensor,
        toggleController,
        scanRfid,
        movePerson,
        ackIncident,
        resolveIncident,
        broadcastAnnouncement,
        startScenario,
        stopScenario,
        resetSimulation
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
