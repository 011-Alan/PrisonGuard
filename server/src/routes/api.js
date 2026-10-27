import express from 'express';
import { auditLogger } from '../utils/audit.js';
import { mqttSimulator } from '../communication/mqttSimulator.js';
import { ROOMS, WAYPOINTS } from '../simulation/waypoints.js';
import { authenticate, authorize } from '../auth/authMiddleware.js';

export function createApiRouter(engine) {
  const router = express.Router();

  // Public/Authenticated State Snapshot
  router.get('/state', (req, res) => {
    res.json(engine.state);
  });

  router.get('/waypoints', (req, res) => {
    res.json({ rooms: ROOMS, waypoints: WAYPOINTS });
  });

  // Gate Command (Protected: OPERATOR, SUPERVISOR, ADMIN)
  router.post('/gates/:id/command', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { targetState } = req.body || {};

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Valid gate identifier parameter is required' });
      }

      if (!['OPEN', 'CLOSE'].includes(targetState)) {
        return res.status(400).json({ error: 'Invalid targetState. Allowed values: OPEN, CLOSE' });
      }

      const cmd = engine.handleGateCommand(id, targetState, req.user);
      res.json({ success: true, command: cmd });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Gate Jam Simulation (Protected: OPERATOR, SUPERVISOR, ADMIN)
  router.post('/gates/:id/jam', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      if (!engine.state.gates[id]) {
        return res.status(404).json({ error: `Gate ${id} not found` });
      }
      engine.handleGateJam(id);
      res.json({ success: true, message: `Gate ${id} jammed` });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Door Physical Operation (OPEN / CLOSE)
  router.post('/doors/:id/operate', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body || {};

      if (!['OPEN', 'CLOSE'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action. Allowed values: OPEN, CLOSE' });
      }

      const result = engine.handleDoorOperate(id, action, req.user);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Door Lock/Unlock Command (LOCK / UNLOCK)
  router.post('/doors/:id/lock', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body || {};

      if (!['LOCK', 'UNLOCK'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action. Allowed values: LOCK, UNLOCK' });
      }

      const result = engine.handleDoorLock(id, action, req.user);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Door Lock Legacy Compatibility Command (Protected: OPERATOR, SUPERVISOR, ADMIN)
  router.post('/doors/:id/command', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body || {};

      if (!['LOCK', 'UNLOCK'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action. Allowed values: LOCK, UNLOCK' });
      }

      const result = engine.handleDoorLock(id, action, req.user);
      res.json({ success: true, lock: result.door });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Sensor Trigger (Simulator or Admin test)
  router.post('/sensors/:id/trigger', (req, res) => {
    try {
      const { id } = req.params;
      const { value } = req.body || {};

      if (!id || !engine.state.devices[id]) {
        return res.status(404).json({ error: `Sensor device ${id} not found` });
      }

      if (value === undefined || value === null) {
        return res.status(400).json({ error: 'Sensor value payload is required' });
      }

      const user = req.user || { username: 'SIMULATOR', role: 'OPERATOR' };
      const dev = engine.handleSensorTrigger(id, value, user);
      res.json({ success: true, device: dev });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Controller Toggle (Disconnect/Reconnect) (Protected: SUPERVISOR, ADMIN)
  router.post('/controllers/:id/toggle', authenticate, authorize(['SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { isOnline } = req.body || {};

      if (typeof isOnline !== 'boolean') {
        return res.status(400).json({ error: 'isOnline boolean is required' });
      }

      const ctrl = engine.toggleControllerOnline(id, isOnline, req.user);
      res.json({ success: true, controller: ctrl });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // RFID Scan Simulation
  router.post('/rfid/scan', (req, res) => {
    try {
      const { readerId, cardId } = req.body || {};

      if (!readerId || !engine.state.devices[readerId]) {
        return res.status(404).json({ error: `RFID Reader ${readerId} not found` });
      }

      const user = req.user || { username: 'SCANNER', role: 'SYSTEM' };
      const result = engine.handleRfidScan({ readerId, cardId, user });
      res.json({ success: true, accessLog: result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Move Person (Deterministic Waypoint Navigation)
  router.post('/people/:id/move', (req, res) => {
    try {
      const { id } = req.params;
      const { destinationWaypointId } = req.body || {};

      if (!engine.state.people[id]) {
        return res.status(404).json({ error: `Person ${id} not found` });
      }

      if (!WAYPOINTS[destinationWaypointId]) {
        return res.status(400).json({ error: `Invalid destination waypoint: ${destinationWaypointId}` });
      }

      engine.movePersonTo(id, destinationWaypointId);
      res.json({ success: true, person: engine.state.people[id] });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Escort Movement Task (Officer + Prisoner)
  router.post('/people/:id/escort', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { escortId, destinationWaypointId } = req.body || {};

      if (!escortId) return res.status(400).json({ error: 'escortId is required' });
      if (!destinationWaypointId) return res.status(400).json({ error: 'destinationWaypointId is required' });

      const result = engine.createEscortTask({
        personId: id,
        escortId,
        destinationWaypointId,
        user: req.user
      });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Emergency Lockdown Controls (SUPERVISOR, ADMIN)
  router.post('/lockdown/activate', authenticate, authorize(['SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const result = engine.activateLockdown(req.user, req.body || {});
      res.json({ success: true, lockdown: result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/lockdown/release', authenticate, authorize(['SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const result = engine.releaseLockdown(req.user);
      res.json({ success: true, lockdown: result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Announcements (Admin or Supervisor only)
  router.post('/announcements', authenticate, authorize(['ADMIN', 'SUPERVISOR']), (req, res) => {
    try {
      const { title, message, zones, chime } = req.body || {};
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'Announcement title string is required' });
      }
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Announcement message string is required' });
      }

      const ann = engine.broadcastAnnouncement({
        title: title.trim(),
        message: message.trim(),
        zones: Array.isArray(zones) && zones.length > 0 ? zones : ['ALL'],
        chime: chime !== false
      }, req.user);

      res.json({ success: true, announcement: ann });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Announcement Playback Status Report (Simulator Client)
  router.post('/announcements/playback-status', (req, res) => {
    try {
      const { announcementId, client, success, method, error } = req.body || {};
      if (!announcementId) {
        return res.status(400).json({ error: 'announcementId is required' });
      }

      const report = engine.recordPlaybackStatus({
        announcementId,
        client: client || 'SIMULATOR',
        success: success !== false,
        method: method || 'WEB_SPEECH_API',
        error
      });

      res.json({ success: true, report });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Simulation Clock Control
  router.post('/clock/control', authenticate, authorize(['SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { speed, isPaused, time } = req.body || {};
      const clock = engine.setSimulationClock({ speed, isPaused, time });
      res.json({ success: true, clock });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Command History & Communication Trace Inspection
  router.get('/commands', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    res.json({
      commands: engine.commandHistory.slice(0, limit),
      total: engine.commandHistory.length
    });
  });

  router.get('/commands/:id/trace', (req, res) => {
    const cmd = engine.commandHistory.find(c => c.id === req.params.id);
    if (!cmd) {
      return res.status(404).json({ error: `Command ${req.params.id} not found` });
    }
    res.json({ success: true, command: cmd });
  });

  // Communication & Gateway Diagnostic Status
  router.get('/system/communication-status', (req, res) => {
    const controllers = Object.values(engine.state.controllers);
    const onlineControllers = controllers.filter(c => c.status === 'ONLINE').length;
    res.json({
      backend: {
        status: 'ONLINE',
        uptimeSec: process.uptime(),
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        version: 'v2.4-academic-iot'
      },
      gateways: {
        total: controllers.length,
        online: onlineControllers,
        offline: controllers.length - onlineControllers,
        details: controllers.map(c => ({ id: c.id, name: c.name, status: c.status, ip: c.ip }))
      },
      telemetry: {
        totalDevices: Object.keys(engine.state.devices).length,
        totalGates: Object.keys(engine.state.gates).length,
        totalDoors: Object.keys(engine.state.doors).length,
        totalSpeakers: Object.keys(engine.state.speakers).length,
        lockdownActive: engine.state.lockdown.isActive,
        activeScenario: engine.state.activeScenario,
        simulationTime: engine.state.simulationClock?.displayTime
      },
      lastSyncTimestamp: new Date().toISOString()
    });
  });
  router.post('/incidents/:id/ack', authenticate, (req, res) => {
    try {
      const { id } = req.params;
      const inc = engine.acknowledgeIncident(id, req.user);
      res.json({ success: true, incident: inc });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/incidents/:id/resolve', authenticate, (req, res) => {
    try {
      const { id } = req.params;
      const inc = engine.resolveIncident(id, req.user);
      res.json({ success: true, incident: inc });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Scenarios Control
  const ALLOWED_SCENARIOS = [
    'OFFICER_ENTRY',
    'UNAUTHORIZED_ACCESS',
    'DOOR_BREACH',
    'PERIMETER_ESCAPE',
    'GATE_FAILURE',
    'CONTROLLER_DISCONNECT',
    'MEDICAL_DURESS',
    'SECURITY_INCIDENT_RESPONSE'
  ];

  router.post('/scenarios/start', (req, res) => {
    const { scenarioId } = req.body || {};
    if (!scenarioId || !ALLOWED_SCENARIOS.includes(scenarioId)) {
      return res.status(400).json({
        error: `Invalid scenarioId. Allowed: ${ALLOWED_SCENARIOS.join(', ')}`
      });
    }
    engine.scenarios.start(scenarioId);
    res.json({ success: true, activeScenario: scenarioId });
  });

  router.post('/scenarios/stop', (req, res) => {
    engine.scenarios.stop();
    res.json({ success: true, message: 'Scenario stopped' });
  });

  router.post('/scenarios/reset', (req, res) => {
    engine.scenarios.reset();
    res.json({ success: true, message: 'Simulation reset to baseline' });
  });

  // --- CCTV Surveillance Endpoints ---
  router.get('/cameras', (req, res) => {
    res.json({ cameras: engine.state.cameras });
  });

  router.post('/cameras/:id/toggle', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body || {};
      if (!['ONLINE', 'OFFLINE', 'DEGRADED'].includes(status)) {
        return res.status(400).json({ error: 'Allowed status: ONLINE, OFFLINE, DEGRADED' });
      }
      const cam = engine.toggleCameraStatus(id, status, req.user);
      res.json({ success: true, camera: cam });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Officer Dispatch Commands (Admin to Officer) ---
  router.post('/officers/:id/command', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { commandType, targetWaypointId, note, priority } = req.body || {};

      if (!commandType || !targetWaypointId) {
        return res.status(400).json({ error: 'commandType and targetWaypointId are required' });
      }

      const task = engine.dispatchOfficerTask({
        officerId: id,
        commandType,
        targetWaypointId,
        note,
        priority: priority || 'NORMAL',
        user: req.user
      });

      res.json({ success: true, task });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Officer Medical Event Trigger ---
  router.post('/officers/:id/medical-event', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { scenario } = req.body || {};
      const result = engine.triggerOfficerMedicalEvent(id, scenario, req.user);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Officer Radio Communication Requests & Admin Response ---
  router.get('/radio-requests', (req, res) => {
    res.json({ requests: engine.state.officerRadioRequests });
  });

  router.post('/radio-requests/:id/respond', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body || {};
      const result = engine.respondToRadioRequest(id, action || 'CLOSE_CELL', req.user);
      res.json({ success: true, request: result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Controlled Escape & Demonstration Scenarios ---
  router.post('/scenarios/controlled-escape', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { workflow } = req.body || {};
      engine.startControlledEscapeScenario(workflow || 'WORKFLOW_A');
      res.json({ success: true, message: `Controlled escape started with ${workflow || 'WORKFLOW_A'}` });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/scenarios/mass-escape', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      engine.startMassEscapeScenario();
      res.json({ success: true, message: 'Mass escape scenario initiated across multiple sectors' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Audit Logs & Cryptographic Tamper Verification
  router.get('/logs/audit', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const logs = auditLogger.getLogs(limit);
    const verification = auditLogger.verifyChain();
    res.json({ logs, verification });
  });

  // MQTT Packets Sniffer Stream
  router.get('/logs/mqtt', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '60', 10), 150);
    res.json({
      brokerStatus: mqttSimulator.status,
      brokerUrl: mqttSimulator.brokerUrl,
      packets: mqttSimulator.getRecentPackets(limit)
    });
  });

  return router;
}
