import { INITIAL_STATE } from './state.js';
import { WAYPOINTS, findShortestPath } from './waypoints.js';
import { SensorFusionEngine } from './rules.js';
import { ScenarioRunner } from './scenarios.js';
import { mqttSimulator } from '../communication/mqttSimulator.js';
import { auditLogger } from '../utils/audit.js';
import { db } from '../storage/db.js';

export class SimulationEngine {
  constructor(io) {
    this.io = io;
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));

    // Restore persisted incidents or seed baseline
    const persistedIncidents = db.getIncidents();
    if (persistedIncidents && persistedIncidents.length > 0) {
      this.state.incidents = persistedIncidents;
    } else {
      db.setIncidents(this.state.incidents);
    }

    // Restore persisted access logs
    const persistedAccessLogs = db.getAccessLogs();
    if (persistedAccessLogs && persistedAccessLogs.length > 0) {
      this.state.accessLogs = persistedAccessLogs;
    } else {
      db.setAccessLogs(this.state.accessLogs);
    }

    // Restore persisted device logs
    const persistedDeviceLogs = db.getDeviceLogs();
    if (persistedDeviceLogs && persistedDeviceLogs.length > 0) {
      this.state.deviceLogs = persistedDeviceLogs;
    } else {
      db.setDeviceLogs(this.state.deviceLogs);
    }

    this.rules = new SensorFusionEngine(this.state, (ev) => this.broadcastEvent(ev));
    this.scenarios = new ScenarioRunner(this);
    this.commandHistory = [];
    this.activeMovementTimers = new Map();

    // Start simulation heartbeat & movement loop
    this.loopInterval = setInterval(() => this.tick(), 1000);
  }

  resetToInitial() {
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.rules = new SensorFusionEngine(this.state, (ev) => this.broadcastEvent(ev));
    this.commandHistory = [];
    db.reset();
    auditLogger.reset();
    auditLogger.log({
      type: 'SIMULATION_RESET',
      user: { username: 'ADMIN', role: 'ADMIN' },
      action: 'Facility simulation reset to baseline state',
      details: {}
    });
    this.broadcastState();
  }

  broadcastState() {
    this.state.lastUpdated = new Date().toISOString();
    if (this.io) {
      this.io.emit('state:full', this.state);
    }
  }

  broadcastEvent(eventName, payload) {
    if (this.io) {
      this.io.emit(eventName, payload);
    }
  }

  // Periodic simulation tick (1Hz)
  tick() {
    const now = new Date().toISOString();
    let healthCount = 0;
    let totalControllers = 0;

    for (const [id, ctrl] of Object.entries(this.state.controllers)) {
      totalControllers++;
      if (ctrl.status === 'ONLINE') {
        ctrl.lastHeartbeat = now;
        ctrl.uptimeSec += 1;
        healthCount++;

        // Periodically emit simulated MQTT heartbeat
        if (Math.random() < 0.15) {
          mqttSimulator.publish(`prisonGuard/node/${id.toLowerCase()}/heartbeat`, {
            controllerId: id,
            status: 'ONLINE',
            uptime: ctrl.uptimeSec,
            rssi: -58 + Math.floor(Math.random() * 10)
          }, { messageType: 'HEARTBEAT' });
        }
      }
    }

    // Update overall system health %
    this.state.systemHealth = Math.round((healthCount / (totalControllers || 1)) * 98);

    // Step person movements if any person is in transit
    this.processPersonMovements();

    // Broadcast tick updates to frontends
    this.broadcastEvent('state:tick', {
      systemHealth: this.state.systemHealth,
      lastUpdated: now,
      controllers: this.state.controllers,
      people: this.state.people,
      gates: this.state.gates
    });
  }

  // --- Gate Operations ---
  handleGateCommand(gateId, targetState, user = { username: 'OPERATOR', role: 'OPERATOR' }) {
    const gate = this.state.gates[gateId];
    if (!gate) throw new Error(`Gate ${gateId} not found`);

    // Duplicate command protection
    if ((gate.state === 'OPENING' && targetState === 'OPEN') || (gate.state === 'CLOSING' && targetState === 'CLOSE')) {
      return {
        id: gate.lastCommandId,
        gateId,
        targetState,
        status: 'EXECUTING',
        note: `Command to ${targetState} already executing on ${gateId}`
      };
    }

    const ctrl = this.state.controllers[gate.controllerId];
    if (!ctrl || ctrl.status !== 'ONLINE') {
      const errCmd = {
        id: `CMD-${Date.now().toString(36).toUpperCase()}`,
        gateId,
        targetState,
        status: 'DEVICE_OFFLINE',
        timestamp: new Date().toISOString()
      };
      this.commandHistory.unshift(errCmd);
      throw new Error(`Cannot operate gate ${gateId}: Controller ${gate.controllerId} is OFFLINE`);
    }

    const commandId = `CMD-${Date.now().toString(36).toUpperCase()}`;
    const cmd = {
      id: commandId,
      gateId,
      targetState,
      status: 'EXECUTING',
      timestamp: new Date().toISOString()
    };
    this.commandHistory.unshift(cmd);
    gate.lastCommandId = commandId;
    gate.targetState = targetState;
    gate.state = targetState === 'OPEN' ? 'OPENING' : 'CLOSING';
    gate.isJammed = false;
    gate.motorCurrentAmps = 2.1;

    // Publish to simulated MQTT
    mqttSimulator.publish(`prisonGuard/gate/${gateId}/command`, {
      commandId,
      targetState,
      issuer: user.username
    }, { direction: 'OUTBOUND', commandId, messageType: 'COMMAND' });

    auditLogger.log({
      type: 'GATE_COMMAND',
      user,
      action: `Gate ${gate.name} command: ${targetState}`,
      details: { gateId, commandId, targetState }
    });

    this.broadcastState();

    // Simulate physical travel duration (2500ms)
    setTimeout(() => {
      if (gate.state === 'JAMMED') return;

      gate.state = targetState;
      gate.limitSwitchClosed = (targetState === 'CLOSED');
      gate.limitSwitchOpen = (targetState === 'OPEN');
      gate.motorCurrentAmps = 0.05;
      gate.lastUpdated = new Date().toISOString();
      cmd.status = 'CONFIRMED';

      mqttSimulator.publish(`prisonGuard/gate/${gateId}/ack`, {
        commandId,
        confirmedState: targetState,
        limitSwitchConfirmed: true
      }, { direction: 'INBOUND', commandId, messageType: 'ACK' });

      this.addRecentActivity({
        event: `${gate.name} ${targetState === 'OPEN' ? 'Opened' : 'Closed'} – Confirmed`,
        location: gate.location,
        status: 'NORMAL',
        color: 'green'
      });

      this.broadcastState();
    }, 2500);

    return cmd;
  }

  handleGateJam(gateId) {
    const gate = this.state.gates[gateId];
    if (!gate) return;

    gate.state = 'JAMMED';
    gate.isJammed = true;
    gate.motorCurrentAmps = 4.8;
    gate.limitSwitchClosed = false;
    gate.limitSwitchOpen = false;
    gate.lastUpdated = new Date().toISOString();

    mqttSimulator.publish(`prisonGuard/gate/${gateId}/ack`, {
      commandId: gate.lastCommandId,
      confirmedState: 'JAMMED',
      limitSwitchConfirmed: false,
      fault: 'OBSTACLE_OR_MOTOR_STALL'
    }, { direction: 'INBOUND', commandId: gate.lastCommandId, messageType: 'ACK' });

    // Sensor fusion rule evaluation
    const evalResult = this.rules.evaluateGateJam(gateId);
    if (evalResult?.createIncident) {
      this.state.incidents.unshift(evalResult.incident);
      db.setIncidents(this.state.incidents);
      this.addRecentActivity({
        event: `Gate Jammed – ${gate.name}`,
        location: gate.location,
        status: 'WARNING',
        color: 'amber'
      });
    }

    this.broadcastState();
  }

  // --- Door Lock / Solenoid Operations ---
  handleDoorCommand(lockId, action, user = { username: 'OPERATOR', role: 'OPERATOR' }) {
    const lock = this.state.devices[lockId];
    if (!lock) throw new Error(`Lock ${lockId} not found`);

    lock.value = (action === 'UNLOCK' ? 'UNLOCKED' : 'LOCKED');
    lock.lastUpdated = new Date().toISOString();

    auditLogger.log({
      type: 'DOOR_COMMAND',
      user,
      action: `Door Lock ${lock.name} set to ${lock.value}`,
      details: { lockId, action }
    });

    mqttSimulator.publish(`prisonGuard/cell/${lock.location}/lock/command`, {
      lockId,
      action,
      state: lock.value
    }, { messageType: 'COMMAND' });

    this.broadcastState();
    return lock;
  }

  // --- Sensor Triggers (Manual & Scenarios) ---
  handleSensorTrigger(deviceId, value, user = { username: 'SIMULATOR', role: 'OPERATOR' }) {
    const device = this.state.devices[deviceId];
    if (!device) throw new Error(`Device ${deviceId} not found`);

    const prevValue = device.value;
    device.value = value;
    device.lastUpdated = new Date().toISOString();

    // Log telemetry
    this.state.deviceLogs.unshift({
      id: `DEV-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      deviceId,
      controllerId: device.controllerId,
      event: 'STATE_CHANGE',
      reading: value,
      notes: `Transition from ${prevValue} to ${value}`
    });

    if (this.state.deviceLogs.length > 200) this.state.deviceLogs.pop();
    db.setDeviceLogs(this.state.deviceLogs);

    mqttSimulator.publish(`prisonGuard/sensor/${deviceId}/state`, {
      deviceId,
      type: device.type,
      location: device.location,
      value
    }, { messageType: 'TELEMETRY' });

    // Sensor Fusion Rules Checking
    if (device.type === 'REED_SWITCH' && value === 'OPEN') {
      const result = this.rules.evaluateDoorOpening(deviceId, deviceId);
      if (result?.createIncident) {
        this.state.incidents.unshift(result.incident);
        db.setIncidents(this.state.incidents);
        this.addRecentActivity({
          event: `Door Opened Unexpectedly – ${device.location}`,
          location: device.location,
          status: 'WARNING',
          color: 'amber'
        });
      }
    } else if (device.type === 'PIR_MOTION' && value === 'DETECTED') {
      const result = this.rules.evaluateCorridorMotion(deviceId);
      if (result?.createIncident) {
        this.state.incidents.unshift(result.incident);
        db.setIncidents(this.state.incidents);
        this.addRecentActivity({
          event: `Escape Alert Triggered – ${device.location}`,
          location: device.location,
          status: 'CRITICAL',
          color: 'red'
        });
      }
    } else if ((device.type === 'IR_BREAK_BEAM' || device.type === 'VIBRATION') && (value === 'BROKEN' || value === 'TRIPPED' || value === 'VIBRATION')) {
      const result = this.rules.evaluatePerimeterSensors(deviceId);
      if (result?.createIncident) {
        this.state.incidents.unshift(result.incident);
        db.setIncidents(this.state.incidents);
        this.addRecentActivity({
          event: `Perimeter Intrusion Detected – ${device.location}`,
          location: device.location,
          status: 'CRITICAL',
          color: 'red'
        });
      }
    } else if (device.type === 'DURESS_BUTTON' && (value === 'PRESSED' || value === 'ACTIVE')) {
      const result = this.rules.evaluateMedicalRequest(deviceId);
      if (result?.createIncident) {
        this.state.incidents.unshift(result.incident);
        db.setIncidents(this.state.incidents);
        this.addRecentActivity({
          event: 'Medical Assistance Requested',
          location: device.location,
          status: 'MEDIUM',
          color: 'blue'
        });
      }
    }

    this.broadcastState();
    return device;
  }

  // --- RFID Access Control ---
  handleRfidScan({ readerId, cardId, user = { username: 'SYSTEM', role: 'SYSTEM' } }) {
    const reader = this.state.devices[readerId];
    if (!reader) throw new Error(`RFID Reader ${readerId} not found`);

    // Find person with this card
    const person = Object.values(this.state.people).find(p => p.rfidCardId === cardId);
    let result = 'DENIED';
    let reason = 'Unauthorized or unknown identity token';
    let personName = 'Unknown Person';
    let role = 'UNKNOWN';

    if (person && person.type === 'OFFICER') {
      result = 'GRANTED';
      reason = 'Valid Officer Security Credential';
      personName = person.name;
      role = 'OFFICER';
      this.rules.recordAuthScan(readerId, cardId, person.id);
    } else if (cardId && cardId.startsWith('CARD-OFC')) {
      result = 'GRANTED';
      reason = 'Verified Officer Badge';
      personName = 'Officer Duty Staff';
      role = 'OFFICER';
      this.rules.recordAuthScan(readerId, cardId, 'OFC-GENERIC');
    }

    const logEntry = {
      id: `ACC-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      readerId,
      cardId: cardId || 'EMPTY',
      personName,
      role,
      location: reader.location,
      result,
      reason
    };

    this.state.accessLogs.unshift(logEntry);
    if (this.state.accessLogs.length > 200) this.state.accessLogs.pop();
    db.setAccessLogs(this.state.accessLogs);

    mqttSimulator.publish('prisonGuard/access/rfid/event', logEntry, { messageType: 'EVENT' });

    auditLogger.log({
      type: 'ACCESS_RFID_SCAN',
      user: { username: personName, role },
      action: `RFID scan at ${reader.name}: ${result}`,
      details: logEntry
    });

    this.addRecentActivity({
      event: `RFID Access ${result === 'GRANTED' ? 'Granted' : 'Denied'} – ${personName}`,
      location: reader.location,
      status: result === 'GRANTED' ? 'NORMAL' : 'WARNING',
      color: result === 'GRANTED' ? 'green' : 'amber'
    });

    this.broadcastState();
    return logEntry;
  }

  // --- Controller Disconnect & Reconnect ---
  toggleControllerOnline(controllerId, isOnline, user = { username: 'OPERATOR', role: 'OPERATOR' }) {
    const ctrl = this.state.controllers[controllerId];
    if (!ctrl) throw new Error(`Controller ${controllerId} not found`);

    ctrl.status = isOnline ? 'ONLINE' : 'OFFLINE';
    ctrl.lastHeartbeat = new Date().toISOString();

    // Cascading effect: dependent devices become OFFLINE or UNKNOWN
    for (const devId of ctrl.ownedDevices) {
      if (this.state.devices[devId]) {
        this.state.devices[devId].status = isOnline ? 'ONLINE' : 'OFFLINE';
      }
      if (this.state.gates[devId]) {
        if (!isOnline) {
          this.state.gates[devId].motorCurrentAmps = 0;
        }
      }
    }

    if (!isOnline) {
      const evalResult = this.rules.evaluateControllerDisconnect(controllerId);
      if (evalResult?.createIncident) {
        this.state.incidents.unshift(evalResult.incident);
        db.setIncidents(this.state.incidents);
      }
      this.addRecentActivity({
        event: `ESP32 Controller Disconnected – ${ctrl.name}`,
        location: ctrl.location,
        status: 'CRITICAL',
        color: 'red'
      });
    } else {
      this.addRecentActivity({
        event: `ESP32 Controller Reconnected – ${ctrl.name}`,
        location: ctrl.location,
        status: 'NORMAL',
        color: 'green'
      });
    }

    auditLogger.log({
      type: 'CONTROLLER_STATUS_CHANGE',
      user,
      action: `Controller ${ctrl.name} set to ${ctrl.status}`,
      details: { controllerId, status: ctrl.status, affectedDevices: ctrl.ownedDevices }
    });

    this.broadcastState();
    return ctrl;
  }

  // --- Person Waypoint Movement ---
  movePersonTo(personId, destinationWaypointId) {
    const person = this.state.people[personId];
    if (!person) return;
    if (!WAYPOINTS[destinationWaypointId]) return;

    const currentWp = person.currentWaypoint || 'W_A102';
    const path = findShortestPath(currentWp, destinationWaypointId);

    person.path = path.slice(1);
    person.targetWaypoint = destinationWaypointId;
    person.status = 'IN_TRANSIT';
    person.lastLocationUpdate = new Date().toISOString();

    this.broadcastState();
  }

  processPersonMovements() {
    let movedAny = false;
    for (const [id, person] of Object.entries(this.state.people)) {
      if (person.path && person.path.length > 0) {
        const nextWpId = person.path.shift();
        const nextWp = WAYPOINTS[nextWpId];
        if (nextWp) {
          person.x = nextWp.x;
          person.y = nextWp.y;
          person.currentRoom = nextWp.room;
          person.currentWaypoint = nextWpId;
          person.lastLocationUpdate = new Date().toISOString();

          if (!person.routeHistory) person.routeHistory = [];
          person.routeHistory.unshift({
            room: nextWp.room,
            x: nextWp.x,
            y: nextWp.y,
            timestamp: new Date().toISOString()
          });
          if (person.routeHistory.length > 30) person.routeHistory.pop();

          if (person.path.length === 0) {
            person.status = 'NORMAL';
            person.targetWaypoint = null;
          }
          movedAny = true;
        }
      }
    }

    if (movedAny) {
      this.broadcastEvent('people:update', this.state.people);
    }
  }

  // --- Incident Management ---
  acknowledgeIncident(incidentId, user = { username: 'ADMIN', role: 'ADMIN' }) {
    const inc = this.state.incidents.find(i => i.id === incidentId);
    if (!inc) throw new Error(`Incident ${incidentId} not found`);

    inc.status = 'ACKNOWLEDGED';
    inc.acknowledgedBy = `${user.username} (${user.role})`;
    db.setIncidents(this.state.incidents);

    auditLogger.log({
      type: 'INCIDENT_ACK',
      user,
      action: `Incident ${inc.title} acknowledged`,
      details: { incidentId }
    });

    this.broadcastState();
    return inc;
  }

  resolveIncident(incidentId, user = { username: 'ADMIN', role: 'ADMIN' }) {
    const inc = this.state.incidents.find(i => i.id === incidentId);
    if (!inc) throw new Error(`Incident ${incidentId} not found`);

    inc.status = 'RESOLVED';
    inc.resolvedBy = `${user.username} (${user.role})`;
    db.setIncidents(this.state.incidents);

    auditLogger.log({
      type: 'INCIDENT_RESOLVE',
      user,
      action: `Incident ${inc.title} resolved`,
      details: { incidentId }
    });

    this.broadcastState();
    return inc;
  }

  // --- Announcements ---
  broadcastAnnouncement(title, message, user = { username: 'ADMIN', role: 'ADMIN' }) {
    const announcement = {
      id: `ANN-${Date.now().toString(36).toUpperCase()}`,
      title,
      message,
      issuer: user.username,
      timestamp: new Date().toISOString()
    };

    auditLogger.log({
      type: 'FACILITY_ANNOUNCEMENT',
      user,
      action: `Broadcast Announcement: ${title}`,
      details: announcement
    });

    this.addRecentActivity({
      event: `Public Announcement: ${title}`,
      location: 'Facility P.A. Speakers',
      status: 'NORMAL',
      color: 'blue'
    });

    this.broadcastEvent('announcement:new', announcement);
    return announcement;
  }

  addRecentActivity({ event, location, status, color = 'blue' }) {
    const now = new Date();
    const timeFormatted = now.toTimeString().split(' ')[0];
    this.state.recentActivity.unshift({
      id: `ACT-${Date.now().toString(36)}`,
      timestamp: now.toISOString(),
      timeFormatted,
      event,
      location,
      status,
      color
    });
    if (this.state.recentActivity.length > 50) this.state.recentActivity.pop();
  }
}
