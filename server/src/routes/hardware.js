import express from 'express';
import { authenticate, authorize } from '../auth/authMiddleware.js';

export function createHardwareRouter(hardwareManager) {
  const router = express.Router();

  // Middleware to authenticate physical ESP32 device via token
  const authenticateDevice = (req, res, next) => {
    const token = req.headers['x-device-token'] || req.headers['authorization'];
    if (!hardwareManager.validateDeviceToken(token)) {
      return res.status(401).json({
        error: 'Unauthorized hardware device. Invalid or missing X-Device-Token credential.'
      });
    }
    next();
  };

  // =========================================================================
  // 1. DASHBOARD & ADMINISTRATIVE ENDPOINTS (User JWT Authenticated)
  // =========================================================================

  // Hardware Status Snapshot
  router.get('/status', (req, res) => {
    res.json(hardwareManager.getState());
  });

  // Enable / Disable Hardware Integration
  router.post('/toggle', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { enabled } = req.body || {};
      const updated = hardwareManager.setEnabled(enabled, req.user);
      res.json({ success: true, hardware: updated, hardwareState: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Toggle Bidirectional Hardware-to-Simulation Sync
  router.post('/sync-toggle', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { enabled } = req.body || {};
      const updated = hardwareManager.setSyncHardwareToSimulation(enabled, req.user);
      res.json({ success: true, hardware: updated, hardwareState: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Physical-Only Door Command (Does not force software simulation if sync disabled)
  router.post('/door/operate', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { action } = req.body || {};
      if (!['OPEN', 'CLOSE'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action. Expected OPEN or CLOSE.' });
      }
      const cmd = hardwareManager.dispatchDoorCommand(action, 'ADMIN_PANEL_PHYSICAL', req.user);
      res.json({ success: true, command: cmd, physicalDoor: hardwareManager.physicalDoor });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Safe Connectivity Test / Ping
  router.post('/test', authenticate, authorize(['OPERATOR', 'SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const result = hardwareManager.testConnection();
      res.json({ success: true, ...result, test: result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Configure Physical Device Properties (Device ID, Display Name, Target Door)
  router.post('/device/configure', authenticate, authorize(['SUPERVISOR', 'ADMIN']), (req, res) => {
    try {
      const { controllerId, displayName, targetDoorId } = req.body || {};
      const updated = hardwareManager.configureDevice({ controllerId, displayName, targetDoorId }, req.user);
      res.json({ success: true, hardware: updated, hardwareState: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Get Recent RFID Scans
  router.get('/rfid/recent', authenticate, (req, res) => {
    try {
      res.json({ success: true, scans: hardwareManager.recentRfidScans });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // =========================================================================
  // 2. ESP32 CONTROLLER PROTOCOL ENDPOINTS (Device Token Authenticated)
  // =========================================================================

  // Controller Heartbeat & Telemetry Check-In
  router.post('/heartbeat', authenticateDevice, (req, res) => {
    try {
      const body = req.body || {};
      const response = hardwareManager.handleHeartbeat({
        controllerId: body.controllerId,
        uptime: body.uptime || body.uptimeSeconds,
        freeHeap: body.freeHeap,
        wifiRssi: body.wifiRssi,
        isSimulated: body.isSimulated,
        reedState: body.reedState || body.doorState || body.reedSwitch
      });
      res.json(response);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Controller Pending Commands Poll
  router.get('/commands/poll', authenticateDevice, (req, res) => {
    try {
      const controllerId = req.query.controllerId || hardwareManager.controllerId;
      const commands = hardwareManager.pollCommands(controllerId);
      res.json({
        commands,
        count: commands.length,
        hasCommand: commands.length > 0,
        command: commands[0] || null,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Controller Command Execution Acknowledgement
  router.post('/commands/:id/ack', authenticateDevice, (req, res) => {
    try {
      const { id } = req.params;
      const { controllerId, status, servoAngle, error } = req.body || {};
      const result = hardwareManager.acknowledgeCommand({
        commandId: id,
        controllerId,
        status,
        servoAngle,
        error
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Physical Sensor Interrupt / Event Report (e.g. Reed switch state change)
  router.post('/events', authenticateDevice, (req, res) => {
    try {
      const body = req.body || {};
      const reed = body.state || body.reedState || body.details?.reedState;
      if (reed && ['OPEN', 'CLOSED'].includes(reed)) {
        hardwareManager.updatePhysicalSensorState(reed, body.type || 'ESP32_GPIO_INTERRUPT');
      }
      hardwareManager.logHardwareEvent(body.type || 'CONTROLLER_SENSOR_EVENT', body.details || body);
      res.json({ success: true, received: true, timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Contactless RFID Badge Scan Evaluation
  router.post('/rfid/scan', authenticateDevice, (req, res) => {
    try {
      const cardUid = req.body?.cardUid || req.body?.uid || req.body?.cardId;
      const readerId = req.body?.readerId || 'RFID-RC522-01';
      const result = hardwareManager.handleRfidScan({ cardUid, readerId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
