import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL, WS_URL } from '../config';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState(12);
  const [state, setState] = useState(null);
  const [waypointsData, setWaypointsData] = useState(null);

  const refreshState = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/state`);
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
      const wpRes = await fetch(`${API_BASE_URL}/api/waypoints`);
      if (wpRes.ok) {
        const wpData = await wpRes.json();
        setWaypointsData(wpData);
      }
    } catch (e) {
      console.error('Snapshot fetch error:', e);
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

  // Actions
  const commandGate = async (gateId, targetState) => {
    return fetch(`${API_BASE_URL}/api/gates/${gateId}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer SIMULATOR_BYPASS'
      },
      body: JSON.stringify({ targetState })
    }).then(r => r.json());
  };

  const jamGate = async (gateId) => {
    return fetch(`${API_BASE_URL}/api/gates/${gateId}/jam`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer SIMULATOR_BYPASS'
      }
    }).then(r => r.json());
  };

  const triggerSensor = async (deviceId, value) => {
    return fetch(`${API_BASE_URL}/api/sensors/${deviceId}/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    }).then(r => r.json());
  };

  const scanRfid = async (readerId, cardId) => {
    return fetch(`${API_BASE_URL}/api/rfid/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readerId, cardId })
    }).then(r => r.json());
  };

  const movePerson = async (personId, destinationWaypointId) => {
    return fetch(`${API_BASE_URL}/api/people/${personId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationWaypointId })
    }).then(r => r.json());
  };

  const startScenario = async (scenarioId) => {
    return fetch(`${API_BASE_URL}/api/scenarios/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId })
    }).then(r => r.json());
  };

  const stopScenario = async () => {
    return fetch(`${API_BASE_URL}/api/scenarios/stop`, {
      method: 'POST'
    }).then(r => r.json());
  };

  const resetSimulation = async () => {
    return fetch(`${API_BASE_URL}/api/scenarios/reset`, {
      method: 'POST'
    }).then(r => r.json());
  };

  return (
    <SocketContext.Provider
      value={{
        connected,
        latency,
        state,
        waypointsData,
        refreshState,
        commandGate,
        jamGate,
        triggerSensor,
        scanRfid,
        movePerson,
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
