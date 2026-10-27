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

  // Door Lock Command (Protected: OPERATOR, SUPERVISOR, ADMIN)
  router.post('/doors/:id/command', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body || {};

      if (!['LOCK', 'UNLOCK'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action. Allowed values: LOCK, UNLOCK' });
      }

      const lock = engine.handleDoorCommand(id, action, req.user);
      res.json({ success: true, lock });
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

  // Incident Management
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

  // Announcements (Admin or Supervisor only)
  router.post('/announcements', authenticate, authorize(['ADMIN', 'SUPERVISOR']), (req, res) => {
    try {
      const { title, message } = req.body || {};
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'Announcement title string is required' });
      }
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Announcement message string is required' });
      }

      const ann = engine.broadcastAnnouncement(title.trim(), message.trim(), req.user);
      res.json({ success: true, announcement: ann });
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
