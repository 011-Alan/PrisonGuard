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
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);

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

  // Web Speech API Announcement Playback
  const playAnnouncementSpeech = useCallback(async (announcement) => {
    setActiveAnnouncement(announcement);
    setTimeout(() => {
      setActiveAnnouncement(prev => prev?.id === announcement.id ? null : prev);
    }, 8000);

    let success = false;
    let method = 'ON_SCREEN_DISPLAY';
    let errorMsg = null;

    if (isAudioEnabled && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const speechText = `Attention: ${announcement.title}. ${announcement.message}`;
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        window.speechSynthesis.speak(utterance);
        success = true;
        method = 'WEB_SPEECH_API';
      } catch (err) {
        errorMsg = err.message;
      }
    } else if (!isAudioEnabled) {
      errorMsg = 'Audio muted by user preference';
    } else {
      errorMsg = 'SpeechSynthesis not supported by browser';
    }

    // Report playback status back to backend
    try {
      await fetch(`${API_BASE_URL}/api/announcements/playback-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          announcementId: announcement.id,
          client: 'SIMULATOR_BROWSER',
          success,
          method,
          error: errorMsg
        })
      });
    } catch (err) {
      console.warn('Failed to report announcement playback status:', err);
    }
  }, [isAudioEnabled]);

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
          simulationClock: tickData.simulationClock || prev.simulationClock,
          controllers: tickData.controllers || prev.controllers,
          people: tickData.people || prev.people,
          gates: tickData.gates || prev.gates,
          doors: tickData.doors || prev.doors,
          speakers: tickData.speakers || prev.speakers,
          lockdown: tickData.lockdown || prev.lockdown
        };
      });
    });

    s.on('announcement:new', (ann) => {
      playAnnouncementSpeech(ann);
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
  }, [refreshState, playAnnouncementSpeech]);

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

  const operateDoor = async (doorId, action) => {
    return fetch(`${API_BASE_URL}/api/doors/${doorId}/operate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer SIMULATOR_BYPASS'
      },
      body: JSON.stringify({ action })
    }).then(r => r.json());
  };

  const lockDoor = async (doorId, action) => {
    return fetch(`${API_BASE_URL}/api/doors/${doorId}/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer SIMULATOR_BYPASS'
      },
      body: JSON.stringify({ action })
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
        isAudioEnabled,
        setIsAudioEnabled,
        activeAnnouncement,
        setActiveAnnouncement,
        refreshState,
        commandGate,
        jamGate,
        operateDoor,
        lockDoor,
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
