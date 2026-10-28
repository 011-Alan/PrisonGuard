import express from 'express';
import { auditLogger } from '../utils/audit.js';
import { mqttSimulator } from '../communication/mqttSimulator.js';
import { ROOMS, WAYPOINTS } from '../simulation/waypoints.js';
import { SCENARIO_REGISTRY } from '../simulation/scenarios.js';
import { IOT_TOPOLOGY_METADATA } from '../simulation/state.js';
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
  const ALLOWED_SCENARIOS = Object.keys(SCENARIO_REGISTRY);

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

  // Camera Sweep & Manual Pan
  router.post('/cameras/:id/sweep', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body || {};
      const cam = engine.setCameraSweep(id, action || 'TOGGLE', req.user);
      res.json({ success: true, camera: cam });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/cameras/:id/pan', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { angle } = req.body || {};
      if (angle === undefined) return res.status(400).json({ error: 'Angle is required' });
      const cam = engine.setCameraPan(id, angle, req.user);
      res.json({ success: true, camera: cam });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Officer RFID Credential Revocation (Admin Only)
  router.post('/officers/:id/revoke-credential', authenticate, authorize(['ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const officer = engine.revokeOfficerCredential(id, req.user);
      res.json({ success: true, officer });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // External Visitors
  router.post('/visitors/arrive', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const visitor = engine.triggerVisitorArrival(req.body || {});
      res.json({ success: true, visitor });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/visitors/:id/decision', authenticate, authorize(['ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { decision } = req.body || {};
      if (!['APPROVE', 'DENY'].includes(decision)) {
        return res.status(400).json({ error: 'Decision must be APPROVE or DENY' });
      }
      const visitor = engine.handleVisitorDecision(id, decision, req.user);
      res.json({ success: true, visitor });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Suspicious Activity Trigger
  router.post('/suspicious/trigger', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const activity = engine.triggerSuspiciousActivity(req.body || {});
      res.json({ success: true, activity });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Health Change Simulation
  router.post('/health/change', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { personId, delta, reason } = req.body || {};
      if (!personId || delta === undefined) {
        return res.status(400).json({ error: 'personId and delta are required' });
      }
      const person = engine.applyHealthChange(personId, delta, reason);
      res.json({ success: true, person });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Security Control Breach
  router.post('/security/breach', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      engine.triggerSecurityControlBreach();
      res.json({ success: true, breach: engine.state.securityControlBreach });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/security/breach/reset', authenticate, authorize(['ADMIN']), (req, res) => {
    try {
      engine.resetSecurityControlBreach();
      res.json({ success: true, breach: engine.state.securityControlBreach });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Deterministic Scenario Engine Endpoints
  router.get('/scenarios', (req, res) => {
    res.json({
      scenarios: SCENARIO_REGISTRY,
      activeScenario: engine.state.activeScenario,
      elapsedSec: engine.state.scenarioElapsedSec || 0,
      isPaused: engine.scenarios?.isPaused || false
    });
  });

  router.post('/scenarios/:id/start', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const { seed } = req.body || {};
      engine.scenarios.start(id, seed || 42);
      res.json({ success: true, activeScenario: id, seed: seed || 42 });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/scenarios/pause', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      engine.scenarios.pause();
      res.json({ success: true, isPaused: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/scenarios/resume', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      engine.scenarios.resume();
      res.json({ success: true, isPaused: false });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/scenarios/stop', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      engine.scenarios.stop();
      res.json({ success: true, activeScenario: null });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/scenarios/reset', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      engine.scenarios.reset();
      res.json({ success: true, message: 'Simulation reset to baseline' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // IoT Topology & Communication Flow Data
  router.get('/topology', (req, res) => {
    res.json({
      accessPoints: engine.state.accessPoints,
      controllers: engine.state.controllers,
      devices: engine.state.devices,
      gates: engine.state.gates,
      doors: engine.state.doors,
      speakers: engine.state.speakers,
      cameras: engine.state.cameras,
      metadata: IOT_TOPOLOGY_METADATA
    });
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

  // Simulation Event Timeline
  router.get(['/events', '/simulation/events'], (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 200);
    const events = (engine.state.eventTimeline || []).slice(0, limit);
    res.json({ total: events.length, events });
  });

  // Conflicts Simulation Endpoints
  router.post('/conflicts/prisoner-officer', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const result = engine.triggerPrisonerOfficerConflict(req.body);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/conflicts/prisoner-prisoner', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const result = engine.triggerPrisonerConflict(req.body);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Medical Escort Dispatch Endpoint
  router.post('/medical/escort', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { patientId, escortStaffId } = req.body || {};
      if (!patientId) {
        return res.status(400).json({ error: 'patientId is required' });
      }
      const result = engine.assignMedicalEscort({ patientId, escortStaffId, user: req.user });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Officer Suspension Endpoint
  router.post('/officers/:id/suspend', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { id } = req.params;
      const officer = engine.suspendOfficer(id, req.user);
      res.json({ success: true, officer });
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
