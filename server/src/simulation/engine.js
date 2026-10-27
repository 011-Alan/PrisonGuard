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
    this.tickCounter = 0;
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

  // --- Command Lifecycle & Trace Logging ---
  createCommandRecord({ targetId, targetType, action, user, params = {} }) {
    const id = `CMD-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();
    const cmd = {
      id,
      targetId,
      targetType, // 'GATE' | 'DOOR' | 'LOCK' | 'ANNOUNCEMENT' | 'LOCKDOWN' | 'SENSOR'
      action,
      initiator: user?.username || 'SYSTEM',
      initiatorRole: user?.role || 'OPERATOR',
      status: 'DISPATCHED', // 'PENDING' | 'AUTHORIZED' | 'DISPATCHED' | 'APPLIED' | 'CONFIRMED' | 'FAILED' | 'JAMMED'
      timestamp: now,
      params,
      trace: [
        { stage: 'ADMIN_COMMAND', label: 'Command Issued', status: 'COMPLETED', timestamp: now, detail: `User ${user?.username || 'OPERATOR'} (${user?.role || 'OPERATOR'}) initiated ${action} on ${targetId}` },
        { stage: 'BACKEND_AUTHORIZE', label: 'Security & RBAC Authorization', status: 'COMPLETED', timestamp: now, detail: `Authorized for role: ${user?.role || 'OPERATOR'}` },
        { stage: 'DEVICE_HANDLER', label: 'Device State & Interlock Validation', status: 'COMPLETED', timestamp: now, detail: `Device ${targetId} validated, safety interlocks verified` },
        { stage: 'ESP32_GATEWAY', label: 'Simulated ESP32 Gateway Dispatch', status: 'IN_PROGRESS', timestamp: now, detail: `Dispatched packet to simulated MQTT topic / GPIO buffer` },
        { stage: 'ACTUATOR_TRANSITION', label: 'Physical Actuator State Transition', status: 'PENDING', timestamp: null, detail: `Waiting for mechanical cycle execution` },
        { stage: 'HARDWARE_ACK', label: 'Limit Switch / Telemetry Confirmation', status: 'PENDING', timestamp: null, detail: `Waiting for sensor feedback packet` },
        { stage: 'BROADCAST', label: 'Real-Time WebSocket Sync', status: 'PENDING', timestamp: null, detail: `Pending broadcast to connected frontends` },
        { stage: 'AUDIT_LEDGER', label: 'Cryptographic SHA-256 Chained Record', status: 'PENDING', timestamp: null, detail: `Cryptographic block pending ledger inclusion` }
      ]
    };
    this.commandHistory.unshift(cmd);
    if (this.commandHistory.length > 100) this.commandHistory.pop();
    this.broadcastEvent('command:new', cmd);
    return cmd;
  }

  updateCommandStage(cmdId, stageName, status, detail, finalStatus = null) {
    const cmd = this.commandHistory.find(c => c.id === cmdId);
    if (!cmd) return;
    const stage = cmd.trace.find(s => s.stage === stageName);
    if (stage) {
      stage.status = status;
      stage.timestamp = new Date().toISOString();
      if (detail) stage.detail = detail;
    }
    if (finalStatus) {
      cmd.status = finalStatus;
    }
    this.broadcastEvent('command:update', cmd);
  }

  // Periodic simulation tick (1Hz)
  tick() {
    this.tickCounter = (this.tickCounter || 0) + 1;
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

    // Advance Facility Simulation Clock
    this.stepSimulationClock();

    // Autonomous routine checks for officers
    if (this.tickCounter % 12 === 0) {
      this.stepAutonomousPatrols();
    }

    // Update overall system health %
    this.state.systemHealth = Math.round((healthCount / (totalControllers || 1)) * 98);

    // Step person movements if any person is in transit
    this.processPersonMovements();

    // Broadcast tick updates to frontends
    this.broadcastEvent('state:tick', {
      systemHealth: this.state.systemHealth,
      lastUpdated: now,
      simulationClock: this.state.simulationClock,
      controllers: this.state.controllers,
      people: this.state.people,
      gates: this.state.gates,
      doors: this.state.doors,
      speakers: this.state.speakers,
      lockdown: this.state.lockdown
    });
  }

  stepSimulationClock() {
    if (!this.state.simulationClock || this.state.simulationClock.isPaused) return;

    const currentMs = new Date(this.state.simulationClock.time).getTime();
    const speed = this.state.simulationClock.speed || 1;
    const newDate = new Date(currentMs + speed * 1000);
    this.state.simulationClock.time = newDate.toISOString();

    const hours = String(newDate.getUTCHours()).padStart(2, '0');
    const mins = String(newDate.getUTCMinutes()).padStart(2, '0');
    const secs = String(newDate.getUTCSeconds()).padStart(2, '0');
    this.state.simulationClock.displayTime = `${hours}:${mins}:${secs}`;

    const hourVal = newDate.getUTCHours() + newDate.getUTCMinutes() / 60;
    const phases = this.state.simulationClock.phases;
    let matchingPhase = phases[0];

    if (hourVal >= 6.5 && hourVal < 8.0) {
      matchingPhase = phases.find(p => p.id === 'MORNING_COUNT') || matchingPhase;
    } else if (hourVal >= 8.0 && hourVal < 10.5) {
      matchingPhase = phases.find(p => p.id === 'MORNING_ROUTINE') || matchingPhase;
    } else if (hourVal >= 10.5 && hourVal < 12.5) {
      matchingPhase = phases.find(p => p.id === 'YARD_RECREATION') || matchingPhase;
    } else if (hourVal >= 12.5 && hourVal < 14.0) {
      matchingPhase = phases.find(p => p.id === 'LUNCH_PERIOD') || matchingPhase;
    } else if (hourVal >= 14.0 && hourVal < 17.5) {
      matchingPhase = phases.find(p => p.id === 'FACILITY_WORK') || matchingPhase;
    } else if (hourVal >= 17.5 && hourVal < 20.0) {
      matchingPhase = phases.find(p => p.id === 'EVENING_RECALL') || matchingPhase;
    } else {
      matchingPhase = phases.find(p => p.id === 'NIGHT_LOCKDOWN') || matchingPhase;
    }

    if (this.state.simulationClock.currentPhase.id !== matchingPhase.id) {
      this.state.simulationClock.currentPhase = matchingPhase;
      this.addRecentActivity({
        event: `Schedule Transition: ${matchingPhase.name}`,
        location: matchingPhase.timeRange,
        status: 'NORMAL',
        color: 'blue'
      });
      this.broadcastEvent('clock:phase_change', matchingPhase);
    }
  }

  setSimulationClock({ speed, isPaused, time }) {
    if (speed !== undefined) this.state.simulationClock.speed = speed;
    if (isPaused !== undefined) this.state.simulationClock.isPaused = isPaused;
    if (time !== undefined) {
      this.state.simulationClock.time = new Date(time).toISOString();
    }
    this.broadcastEvent('clock:update', this.state.simulationClock);
    return this.state.simulationClock;
  }

  stepAutonomousPatrols() {
    // Capt. Reyes perimeter patrol
    const reyes = this.state.people['OFC-702'];
    if (reyes && (!reyes.path || reyes.path.length === 0)) {
      const perimeterWps = ['W_PERIM_EAST_N', 'W_PERIM_EAST_S', 'W_PERIM_SOUTH_E', 'W_PERIM_SOUTH_MID', 'W_PERIM_EAST_N'];
      const nextIdx = (perimeterWps.indexOf(reyes.currentWaypoint) + 1) % perimeterWps.length;
      this.movePersonTo('OFC-702', perimeterWps[nextIdx]);
    }

    // Lt. Sterling cell corridor checks
    const sterling = this.state.people['OFC-514'];
    if (sterling && (!sterling.path || sterling.path.length === 0)) {
      const blockWps = ['W_NORTH_A', 'W_A_CORR_2', 'W_NORTH_MID_1', 'W_NORTH_B', 'W_B_CORR_2'];
      const nextIdx = (blockWps.indexOf(sterling.currentWaypoint) + 1) % blockWps.length;
      this.movePersonTo('OFC-514', blockWps[nextIdx]);
    }
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
      const errCmd = this.createCommandRecord({ targetId: gateId, targetType: 'GATE', action: targetState, user });
      this.updateCommandStage(errCmd.id, 'ESP32_GATEWAY', 'FAILED', `Controller ${gate.controllerId} is OFFLINE`, 'FAILED');
      throw new Error(`Cannot operate gate ${gateId}: Controller ${gate.controllerId} is OFFLINE`);
    }

    const cmd = this.createCommandRecord({ targetId: gateId, targetType: 'GATE', action: targetState, user });
    gate.lastCommandId = cmd.id;
    gate.targetState = targetState;
    gate.state = targetState === 'OPEN' ? 'OPENING' : 'CLOSING';
    gate.isJammed = false;
    gate.motorCurrentAmps = 2.1;

    this.updateCommandStage(cmd.id, 'ESP32_GATEWAY', 'COMPLETED', `Dispatched to node ${gate.controllerId}`);
    this.updateCommandStage(cmd.id, 'ACTUATOR_TRANSITION', 'IN_PROGRESS', `Drive motor engaged (2.1A)`);

    // Publish to simulated MQTT
    mqttSimulator.publish(`prisonGuard/gate/${gateId}/command`, {
      commandId: cmd.id,
      targetState,
      issuer: user.username
    }, { direction: 'OUTBOUND', commandId: cmd.id, messageType: 'COMMAND' });

    auditLogger.log({
      type: 'GATE_COMMAND',
      user,
      action: `Gate ${gate.name} command: ${targetState}`,
      details: { gateId, commandId: cmd.id, targetState }
    });

    this.broadcastState();

    // Simulate physical travel duration (2500ms)
    setTimeout(() => {
      if (gate.state === 'JAMMED') {
        this.updateCommandStage(cmd.id, 'HARDWARE_ACK', 'FAILED', `Motor stall or obstruction detected`, 'JAMMED');
        return;
      }

      gate.state = targetState;
      gate.limitSwitchClosed = (targetState === 'CLOSED');
      gate.limitSwitchOpen = (targetState === 'OPEN');
      gate.motorCurrentAmps = 0.05;
      gate.lastUpdated = new Date().toISOString();

      this.updateCommandStage(cmd.id, 'ACTUATOR_TRANSITION', 'COMPLETED', `Gate reached target position: ${targetState}`);
      this.updateCommandStage(cmd.id, 'HARDWARE_ACK', 'COMPLETED', `Limit switch confirmed (${targetState === 'OPEN' ? 'LS_OPEN' : 'LS_CLOSED'})`);
      this.updateCommandStage(cmd.id, 'BROADCAST', 'COMPLETED', `Synchronized to admin and simulator`);
      this.updateCommandStage(cmd.id, 'AUDIT_LEDGER', 'COMPLETED', `Chained into audit block`, 'CONFIRMED');

      mqttSimulator.publish(`prisonGuard/gate/${gateId}/ack`, {
        commandId: cmd.id,
        confirmedState: targetState,
        limitSwitchConfirmed: true
      }, { direction: 'INBOUND', commandId: cmd.id, messageType: 'ACK' });

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

    if (gate.lastCommandId) {
      this.updateCommandStage(gate.lastCommandId, 'HARDWARE_ACK', 'FAILED', `Mechanical jam or motor stall`, 'JAMMED');
    }

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

  // --- Door Operations (Position vs Lock State) ---
  handleDoorOperate(doorId, action, user = { username: 'OPERATOR', role: 'OPERATOR' }) {
    const door = this.state.doors[doorId];
    if (!door) throw new Error(`Door ${doorId} not found`);

    if (action === 'OPEN' && door.lockState === 'LOCKED') {
      throw new Error(`Cannot open ${door.name}: Solenoid lock is engaged (LOCKED). Unlock the door first.`);
    }

    const cmd = this.createCommandRecord({ targetId: doorId, targetType: 'DOOR', action, user });
    door.position = (action === 'OPEN' ? 'OPENING' : 'CLOSING');
    door.lastUpdated = new Date().toISOString();

    this.updateCommandStage(cmd.id, 'ESP32_GATEWAY', 'COMPLETED', `Command dispatched to controller ${door.controllerId}`);
    this.updateCommandStage(cmd.id, 'ACTUATOR_TRANSITION', 'IN_PROGRESS', `Moving door towards ${action}`);
    this.broadcastState();

    setTimeout(() => {
      door.position = (action === 'OPEN' ? 'OPEN' : 'CLOSED');
      door.lastUpdated = new Date().toISOString();

      if (door.reedId && this.state.devices[door.reedId]) {
        this.state.devices[door.reedId].value = (action === 'OPEN' ? 'OPEN' : 'CLOSED');
        this.state.devices[door.reedId].lastUpdated = new Date().toISOString();
      }

      this.updateCommandStage(cmd.id, 'ACTUATOR_TRANSITION', 'COMPLETED', `Door reached ${door.position}`);
      this.updateCommandStage(cmd.id, 'HARDWARE_ACK', 'COMPLETED', `Magnetic reed switch confirmed ${door.position}`);
      this.updateCommandStage(cmd.id, 'BROADCAST', 'COMPLETED', `Broadcasted to admin and simulator`);
      this.updateCommandStage(cmd.id, 'AUDIT_LEDGER', 'COMPLETED', `Recorded in audit ledger`, 'CONFIRMED');

      auditLogger.log({
        type: 'DOOR_OPERATION',
        user,
        action: `Door ${door.name} operated: ${door.position}`,
        details: { doorId, position: door.position, commandId: cmd.id }
      });

      this.addRecentActivity({
        event: `${door.name} ${action === 'OPEN' ? 'Opened' : 'Closed'}`,
        location: door.location,
        status: 'NORMAL',
        color: action === 'OPEN' ? 'blue' : 'green'
      });

      this.broadcastState();
    }, 1200);

    return { command: cmd, door };
  }

  handleDoorLock(doorId, lockAction, user = { username: 'OPERATOR', role: 'OPERATOR' }) {
    const door = this.state.doors[doorId];
    if (!door) throw new Error(`Door ${doorId} not found`);

    const newLockState = (lockAction === 'LOCK' ? 'LOCKED' : 'UNLOCKED');
    const cmd = this.createCommandRecord({ targetId: doorId, targetType: 'LOCK', action: lockAction, user });

    door.lockState = newLockState;
    door.lastUpdated = new Date().toISOString();

    if (door.lockId && this.state.devices[door.lockId]) {
      this.state.devices[door.lockId].value = newLockState;
      this.state.devices[door.lockId].lastUpdated = new Date().toISOString();
    }

    this.updateCommandStage(cmd.id, 'ESP32_GATEWAY', 'COMPLETED', `Solenoid coil energized`);
    this.updateCommandStage(cmd.id, 'ACTUATOR_TRANSITION', 'COMPLETED', `Deadbolt thrown to ${newLockState}`);
    this.updateCommandStage(cmd.id, 'HARDWARE_ACK', 'COMPLETED', `Lock microswitch confirmed ${newLockState}`);
    this.updateCommandStage(cmd.id, 'BROADCAST', 'COMPLETED', `Synchronized across services`);
    this.updateCommandStage(cmd.id, 'AUDIT_LEDGER', 'COMPLETED', `Chained into audit ledger`, 'CONFIRMED');

    auditLogger.log({
      type: 'DOOR_LOCK_COMMAND',
      user,
      action: `Door ${door.name} set to ${newLockState}`,
      details: { doorId, lockState: newLockState, commandId: cmd.id }
    });

    this.addRecentActivity({
      event: `${door.name} Solenoid ${newLockState}`,
      location: door.location,
      status: 'NORMAL',
      color: newLockState === 'LOCKED' ? 'red' : 'green'
    });

    this.broadcastState();
    return { command: cmd, door };
  }

  // --- Facility Lockdown Activation & Release ---
  activateLockdown(user = { username: 'ADMIN', role: 'ADMIN' }, policy = {}) {
    this.state.lockdown.isActive = true;
    this.state.lockdown.initiatedBy = user.username;
    this.state.lockdown.initiatedRole = user.role;
    this.state.lockdown.timestamp = new Date().toISOString();

    let affectedCount = 0;
    let successfulCount = 0;

    // 1. Close all gates
    for (const [id, gate] of Object.entries(this.state.gates)) {
      affectedCount++;
      gate.targetState = 'CLOSED';
      gate.state = 'CLOSED';
      gate.limitSwitchClosed = true;
      gate.limitSwitchOpen = false;
      gate.isJammed = false;
      gate.motorCurrentAmps = 0.0;
      gate.lastUpdated = new Date().toISOString();
      successfulCount++;
    }

    // 2. Close and lock all cell doors
    for (const [id, door] of Object.entries(this.state.doors)) {
      affectedCount++;
      door.position = 'CLOSED';
      door.lockState = 'LOCKED';
      door.lastUpdated = new Date().toISOString();
      if (door.reedId && this.state.devices[door.reedId]) {
        this.state.devices[door.reedId].value = 'CLOSED';
      }
      if (door.lockId && this.state.devices[door.lockId]) {
        this.state.devices[door.lockId].value = 'LOCKED';
      }
      successfulCount++;
    }

    // 3. Activate alarm strobe
    if (this.state.devices['ALARM-FACILITY']) {
      this.state.devices['ALARM-FACILITY'].value = 'ACTIVE';
    }

    this.state.lockdown.affectedCount = affectedCount;
    this.state.lockdown.successfulCount = successfulCount;
    this.state.lockdown.failedCount = 0;
    this.state.lockdown.summary = `Emergency lockdown active. ${successfulCount}/${affectedCount} barriers secured.`;

    // 4. Facility-wide PA broadcast
    this.broadcastAnnouncement({
      title: 'EMERGENCY FACILITY LOCKDOWN ENGAGED',
      message: 'Attention all sectors: Facility lockdown is active. All personnel report to secure stations. All cell units locked.',
      zones: ['ALL'],
      chime: true
    }, user);

    auditLogger.log({
      type: 'FACILITY_LOCKDOWN_ACTIVATED',
      user,
      action: `Emergency facility lockdown activated by ${user.username}`,
      details: { affectedCount, successfulCount, policy }
    });

    this.addRecentActivity({
      event: 'FACILITY LOCKDOWN ACTIVE – All Barriers Secured',
      location: 'Facility Wide',
      status: 'CRITICAL',
      color: 'red'
    });

    this.broadcastEvent('facility:lockdown_activated', this.state.lockdown);
    this.broadcastState();
    return this.state.lockdown;
  }

  releaseLockdown(user = { username: 'ADMIN', role: 'ADMIN' }) {
    this.state.lockdown.isActive = false;
    this.state.lockdown.summary = `Lockdown released by ${user.username}. Standard security posture restored.`;
    this.state.lockdown.timestamp = new Date().toISOString();

    if (this.state.devices['ALARM-FACILITY']) {
      this.state.devices['ALARM-FACILITY'].value = 'STANDBY';
    }

    this.broadcastAnnouncement({
      title: 'FACILITY LOCKDOWN RELEASED',
      message: 'Attention all sectors: Emergency lockdown released. Normal operational schedule resumed.',
      zones: ['ALL'],
      chime: true
    }, user);

    auditLogger.log({
      type: 'FACILITY_LOCKDOWN_RELEASED',
      user,
      action: `Lockdown released by ${user.username}`,
      details: {}
    });

    this.addRecentActivity({
      event: 'Lockdown Released – Security Posture Restored',
      location: 'Facility Wide',
      status: 'NORMAL',
      color: 'green'
    });

    this.broadcastEvent('facility:lockdown_released', this.state.lockdown);
    this.broadcastState();
    return this.state.lockdown;
  }

  // --- Public Address Announcements & Audio Speech Reporting ---
  broadcastAnnouncement(payloadOrTitle, messageOrUser, maybeUser) {
    let title, message, zones, chime, user;
    if (typeof payloadOrTitle === 'object' && payloadOrTitle !== null) {
      title = payloadOrTitle.title;
      message = payloadOrTitle.message;
      zones = payloadOrTitle.zones || ['ALL'];
      chime = payloadOrTitle.chime !== false;
      user = messageOrUser || { username: 'ADMIN', role: 'ADMIN' };
    } else {
      title = payloadOrTitle;
      message = messageOrUser;
      zones = ['ALL'];
      chime = true;
      user = maybeUser || { username: 'ADMIN', role: 'ADMIN' };
    }

    const announcementId = `ANN-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();

    const targetedSpeakerIds = [];
    for (const [id, spk] of Object.entries(this.state.speakers)) {
      if (zones.includes('ALL') || zones.includes(spk.zone)) {
        targetedSpeakerIds.push(id);
        spk.state = 'BROADCASTING';
        spk.lastAnnouncement = { id: announcementId, title, timestamp: now };
      }
    }

    const announcement = {
      id: announcementId,
      title,
      message,
      issuer: user?.username || 'ADMIN',
      issuerRole: user?.role || 'ADMIN',
      zones,
      targetedSpeakers: targetedSpeakerIds,
      timestamp: now,
      playbackReports: []
    };

    auditLogger.log({
      type: 'FACILITY_ANNOUNCEMENT',
      user,
      action: `Broadcast Announcement: ${title} (Zones: ${zones.join(', ')})`,
      details: announcement
    });

    this.addRecentActivity({
      event: `P.A. Broadcast: ${title}`,
      location: `Zones: ${zones.join(', ')}`,
      status: 'NORMAL',
      color: 'blue'
    });

    this.broadcastEvent('announcement:new', announcement);
    this.broadcastState();

    // Auto-return speakers to IDLE after 6 seconds
    setTimeout(() => {
      for (const id of targetedSpeakerIds) {
        if (this.state.speakers[id]) {
          this.state.speakers[id].state = 'IDLE';
        }
      }
      this.broadcastState();
    }, 6000);

    return announcement;
  }

  recordPlaybackStatus({ announcementId, client = 'SIMULATOR', success, method = 'WEB_SPEECH_API', error = null }) {
    const report = {
      announcementId,
      client,
      success,
      method,
      error,
      timestamp: new Date().toISOString()
    };

    for (const spk of Object.values(this.state.speakers)) {
      if (spk.lastAnnouncement && spk.lastAnnouncement.id === announcementId) {
        spk.lastPlaybackReport = report;
      }
    }

    this.addRecentActivity({
      event: `P.A. Audio Speech ${success ? 'Confirmed' : 'Failed'} (${client})`,
      location: 'Web Speech API',
      status: success ? 'NORMAL' : 'WARNING',
      color: success ? 'green' : 'amber'
    });

    this.broadcastEvent('announcement:playback_report', report);
    return report;
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
  createEscortTask({ personId, escortId, destinationWaypointId, user = { username: 'OPERATOR', role: 'OPERATOR' } }) {
    const person = this.state.people[personId];
    const escort = this.state.people[escortId];
    if (!person) throw new Error(`Person ${personId} not found`);
    if (!escort) throw new Error(`Escort officer ${escortId} not found`);
    if (!WAYPOINTS[destinationWaypointId]) throw new Error(`Invalid destination waypoint: ${destinationWaypointId}`);

    person.status = 'IN_TRANSIT';
    person.activity = `Escorted by ${escort.name}`;
    escort.activity = `Escorting ${person.name}`;

    this.movePersonTo(personId, destinationWaypointId);
    this.movePersonTo(escortId, destinationWaypointId);

    auditLogger.log({
      type: 'ESCORT_TASK_CREATED',
      user,
      action: `Escort movement: ${person.name} with ${escort.name} to ${destinationWaypointId}`,
      details: { personId, escortId, destinationWaypointId }
    });

    this.addRecentActivity({
      event: `Escort Transit: ${person.name} with ${escort.name}`,
      location: WAYPOINTS[destinationWaypointId].room,
      status: 'NORMAL',
      color: 'blue'
    });

    this.broadcastState();
    return { person, escort, destination: WAYPOINTS[destinationWaypointId].room };
  }

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
