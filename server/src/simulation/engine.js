import { INITIAL_STATE } from './state.js';
import { WAYPOINTS, findShortestPath } from './waypoints.js';
import { computeCameraVisibility } from './cctv.js';
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
    const simSpeed = this.state.simulationClock?.isPaused ? 0 : (this.state.simulationClock?.speed || 1);

    // Advance automated scenarios driven strictly by simulation time
    if (this.scenarios && simSpeed > 0) {
      this.scenarios.tick(simSpeed);
    }

    // In-cell subtle movement for prisoners inside cells so they don't look frozen
    if (this.tickCounter % 3 === 0 && simSpeed > 0) {
      for (const [id, prisoner] of Object.entries(this.state.people)) {
        if (prisoner.type === 'PRISONER' && prisoner.status === 'NORMAL' && (!prisoner.path || prisoner.path.length === 0)) {
          if (prisoner.cellWaypoint && WAYPOINTS[prisoner.cellWaypoint]) {
            const baseWp = WAYPOINTS[prisoner.cellWaypoint];
            const numId = parseInt(id.replace(/\D/g, '') || '0', 10);
            const jx = Math.sin((this.tickCounter + numId) * 0.7) * 4;
            const jy = Math.cos((this.tickCounter + numId) * 0.7) * 4;
            prisoner.x = Math.round(baseWp.x + jx);
            prisoner.y = Math.round(baseWp.y + jy);
          }
        }
      }
    }

    // Autonomous staff & prisoner state machine checks
    this.processAutonomousStaffAndPrisoners(now);

    // Update CCTV camera perception & line-of-sight visibility
    this.updateCameraVisibility(now);

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
      accessPoints: this.state.accessPoints,
      people: this.state.people,
      gates: this.state.gates,
      doors: this.state.doors,
      speakers: this.state.speakers,
      lockdown: this.state.lockdown,
      cameras: this.state.cameras,
      officerRadioRequests: this.state.officerRadioRequests,
      officerTasks: this.state.officerTasks,
      suspiciousActivities: this.state.suspiciousActivities,
      externalVisitors: this.state.externalVisitors,
      securityControlBreach: this.state.securityControlBreach
    });
  }

  updateCameraVisibility(now) {
    if (!this.state.cameras) return;
    const speed = this.state.simulationClock?.isPaused ? 0 : (this.state.simulationClock?.speed || 1);
    const allEntities = Object.values(this.state.people || {});

    for (const cam of Object.values(this.state.cameras)) {
      // If camera is in sweep mode, smoothly advance angle within min/max limits
      if (cam.isSweeping && cam.status === 'ONLINE' && speed > 0) {
        const step = (cam.sweepSpeed || 3) * (cam.sweepDirection || 1);
        cam.angle += step;

        const minA = cam.minAngle !== undefined ? cam.minAngle : 0;
        const maxA = cam.maxAngle !== undefined ? cam.maxAngle : 360;

        if (cam.angle >= maxA) {
          cam.angle = maxA;
          cam.sweepDirection = -1;
        } else if (cam.angle <= minA) {
          cam.angle = minA;
          cam.sweepDirection = 1;
        }
        cam.angle = Math.round(cam.angle * 10) / 10;
      }

      cam.visibleEntities = computeCameraVisibility(cam, allEntities, this.state.doors);
      cam.lastUpdated = now;
    }
  }

  processAutonomousStaffAndPrisoners(now) {
    const speed = this.state.simulationClock?.speed || 1;

    // 1. Process officer states & timers
    for (const [id, person] of Object.entries(this.state.people)) {
      if (person.type === 'OFFICER') {
        // Message bubble expiry
        if (person.messageBubble && person.messageBubble.expiresAt < Date.now()) {
          person.messageBubble = null;
        }

        // Medical recovery timer
        if (person.officerState === 'MEDICAL_RECOVERY') {
          person.recoveryTimerSec = Math.max(0, (person.recoveryTimerSec || 15) - speed);
          if (person.recoveryTimerSec <= 0) {
            person.officerState = 'PATROLLING';
            person.status = 'NORMAL';
            person.activity = 'Resumed Duty following Medical Clearance';
            person.messageBubble = null;

            if (person.associatedIncident) {
              const inc = this.state.incidents.find(i => i.id === person.associatedIncident);
              if (inc) {
                inc.status = 'RESOLVED';
                inc.resolvedBy = 'Dr. E. Reed (Medical Clearance)';
                db.setIncidents(this.state.incidents);
              }
              person.associatedIncident = null;
            }

            this.addRecentActivity({
              event: `${person.name} Cleared by Medical – Returned to Duty`,
              location: person.currentRoom,
              status: 'NORMAL',
              color: 'green'
            });
          }
        }

        // Intercepting officer tracking prisoner
        if (person.officerState === 'INTERCEPTING' && person.currentAssignment) {
          const targetId = person.currentAssignment.targetPersonId;
          const prisoner = this.state.people[targetId];

          if (prisoner && prisoner.status === 'ESCAPING') {
            const dist = Math.hypot(person.x - prisoner.x, person.y - prisoner.y);
            // If adjacent or within interception range (<= 55 units)
            if (dist <= 55 || person.currentWaypoint === prisoner.currentWaypoint) {
              // Interception!
              person.officerState = 'ESCORTING';
              person.activity = `Escorting ${prisoner.name} back to ${prisoner.assignedCell}`;
              prisoner.status = 'DETAINED';
              prisoner.activity = `Detained – Under escort to ${prisoner.assignedCell}`;

              // Recalculate escort path to cell
              const returnWp = prisoner.cellWaypoint || 'W_A102';
              const returnPath = findShortestPath(person.currentWaypoint, returnWp).slice(1);
              person.path = [...returnPath];
              prisoner.path = [...returnPath];
              person.targetWaypoint = returnWp;
              prisoner.targetWaypoint = returnWp;

              person.messageBubble = {
                text: `Inmate ${prisoner.name} detained. Escorting to cell.`,
                expiresAt: Date.now() + 6000,
                type: 'RADIO'
              };

              this.addRecentActivity({
                event: `${person.name} Intercepted ${prisoner.name}`,
                location: person.currentRoom,
                status: 'NORMAL',
                color: 'green'
              });
            } else if ((!person.path || person.path.length === 0) && prisoner.currentWaypoint) {
              // Re-route toward moving prisoner
              person.path = findShortestPath(person.currentWaypoint, prisoner.currentWaypoint).slice(1);
            }
          }
        }

        // Escorting officer arriving at assigned cell
        if (person.officerState === 'ESCORTING' && person.currentAssignment) {
          const targetId = person.currentAssignment.targetPersonId;
          const prisoner = this.state.people[targetId];
          const returnWp = prisoner?.cellWaypoint || 'W_A102';

          if (person.currentWaypoint === returnWp && (!person.path || person.path.length === 0)) {
            // Reached cell: trigger securing workflow (Workflow A vs B)
            this.triggerReturnToCellSecuring(person.id, targetId);
          }
        }

        // Admin-assigned task progression
        if (person.officerState === 'RESPONDING_TO_ADMIN_COMMAND' && person.currentAssignment) {
          const targetWp = person.currentAssignment.targetWaypointId;
          if (person.currentWaypoint === targetWp && (!person.path || person.path.length === 0)) {
            // Task completed!
            const taskId = person.currentAssignment.taskId;
            const task = this.state.officerTasks.find(t => t.id === taskId);
            if (task) {
              task.status = 'COMPLETED';
              task.completedAt = now;
            }

            person.officerState = 'OBSERVING';
            person.activity = `Stationed at ${person.currentRoom}`;
            person.currentAssignment = null;
            person.messageBubble = {
              text: `Arrived at ${person.currentRoom}. Station secured.`,
              expiresAt: Date.now() + 5000,
              type: 'RADIO'
            };

            this.addRecentActivity({
              event: `Task Complete: ${person.name} stationed at ${person.currentRoom}`,
              location: person.currentRoom,
              status: 'NORMAL',
              color: 'green'
            });
            this.broadcastEvent('officer:task_completed', { taskId, officerId: person.id });
          }
        }
      }
    }
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
    if (speed !== undefined) this.state.simulationClock.speed = Number(speed);
    if (isPaused !== undefined) this.state.simulationClock.isPaused = Boolean(isPaused);
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

    // Perimeter Gate Access Policy: Only an administrator can open external perimeter gates
    if ((gateId === 'GATE-01' || gateId === 'GATE-02') && targetState === 'OPEN' && user?.role !== 'ADMIN') {
      auditLogger.log({
        type: 'ACCESS_DENIED',
        user,
        action: `Denied attempt to open perimeter gate ${gateId} without Administrator role`,
        details: { gateId, targetState, requiredRole: 'ADMIN', userRole: user?.role }
      });
      throw new Error(`Cannot operate perimeter gate ${gateId}: Administrator role authorization required. Role '${user?.role || 'OPERATOR'}' denied.`);
    }

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
    cmd.status = 'EXECUTING';

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

      // Check if prisoner escapes upon cell door opening
      if (action === 'OPEN') {
        const occupant = Object.values(this.state.people).find(
          p => p.assignedDoorId === doorId && p.status === 'NORMAL' && p.currentRoom && p.currentRoom.includes('Cell')
        );
        if (occupant) {
          this.triggerPrisonerEscape(occupant.id);
        }
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

  // --- CCTV Surveillance & Camera Status ---
  toggleCameraStatus(cameraId, status, user = { username: 'ADMIN', role: 'ADMIN' }) {
    const cam = this.state.cameras[cameraId];
    if (!cam) throw new Error(`Camera ${cameraId} not found`);

    cam.status = status;
    cam.lastUpdated = new Date().toISOString();
    if (status === 'OFFLINE') {
      cam.visibleEntities = [];
    }

    auditLogger.log({
      type: 'CAMERA_STATUS_CHANGE',
      user,
      action: `Camera ${cam.name} status set to ${status}`,
      details: { cameraId, status }
    });

    this.addRecentActivity({
      event: `CCTV ${cam.name}: ${status}`,
      location: cam.location,
      status: status === 'ONLINE' ? 'NORMAL' : 'WARNING',
      color: status === 'ONLINE' ? 'green' : 'amber'
    });

    this.broadcastEvent('camera:status_change', { cameraId, status });
    this.broadcastState();
    return cam;
  }

  // --- Autonomous Prisoner Escape & Officer Interception State Machine ---
  triggerPrisonerEscape(prisonerId, targetEscapeWaypoint = null, preferredWorkflow = null) {
    const prisoner = this.state.people[prisonerId];
    if (!prisoner) return;

    prisoner.status = 'ESCAPING';
    prisoner.activity = 'Escaping Cell – Breaching Perimeter Corridor';

    // Route choices by profile / destination
    let escapeTarget = targetEscapeWaypoint;
    if (!escapeTarget) {
      if (prisoner.profile === 'ESCAPE_PRONE') escapeTarget = 'W_PERIM_EAST_N';
      else if (prisoner.profile === 'RESTLESS') escapeTarget = 'W_SALLY_GATE_OUT';
      else if (prisoner.profile === 'SOCIAL') escapeTarget = 'W_YARD_1';
      else escapeTarget = 'W_NORTH_MID_1';
    }

    const currentWp = prisoner.currentWaypoint || prisoner.cellWaypoint || 'W_A102';
    const path = findShortestPath(currentWp, escapeTarget);
    prisoner.path = path.slice(1);
    prisoner.targetWaypoint = escapeTarget;
    prisoner.preferredWorkflow = preferredWorkflow; // 'WORKFLOW_A' | 'WORKFLOW_B' | null (randomized)

    // Trigger critical incident
    const incId = `INC-ESC-${Date.now().toString(36).toUpperCase()}`;
    const incident = {
      id: incId,
      title: `Escape Alert: ${prisoner.name} (${prisoner.id}) exited ${prisoner.assignedCell}`,
      rule: 'RULE C: Unauthorized Cell Exit & Corridor Movement',
      severity: 'CRITICAL',
      location: prisoner.assignedCell,
      coordinates: { x: prisoner.x, y: prisoner.y },
      associatedDevice: prisoner.assignedDoorId || 'REED-A102',
      associatedPerson: prisoner.id,
      status: 'ACTIVE',
      acknowledgedBy: null,
      resolvedBy: null,
      timestamp: new Date().toISOString(),
      evidence: [
        `Assigned barrier ${prisoner.assignedDoorId} detected unlatched position`,
        `Autonomous beacon movement initiated towards ${escapeTarget}`,
        `Security sensor perimeter trip anticipated`
      ]
    };
    prisoner.associatedIncident = incId;
    this.state.incidents.unshift(incident);
    db.setIncidents(this.state.incidents);

    this.addRecentActivity({
      event: `BREACH: ${prisoner.name} Escaping Cell`,
      location: prisoner.assignedCell,
      status: 'CRITICAL',
      color: 'red'
    });

    this.broadcastEvent('incident:created', incident);
    this.broadcastState();

    // Dispatch nearest available officer
    this.dispatchRespondingOfficer(prisoner.id, preferredWorkflow);
  }

  dispatchRespondingOfficer(prisonerId, preferredWorkflow = null) {
    const prisoner = this.state.people[prisonerId];
    if (!prisoner) return;

    // Filter available officers
    const candidates = Object.values(this.state.people).filter(
      p => p.type === 'OFFICER' &&
      p.officerState !== 'MEDICAL_RECOVERY' &&
      p.officerState !== 'INTERCEPTING' &&
      p.officerState !== 'ESCORTING'
    );

    let chosenOfficer = null;
    let shortestDist = Infinity;

    for (const officer of candidates) {
      const dist = Math.hypot(officer.x - prisoner.x, officer.y - prisoner.y);
      if (dist < shortestDist) {
        shortestDist = dist;
        chosenOfficer = officer;
      }
    }

    // Fallback if all busy: pick first officer not in medical recovery
    if (!chosenOfficer) {
      chosenOfficer = Object.values(this.state.people).find(
        p => p.type === 'OFFICER' && p.officerState !== 'MEDICAL_RECOVERY'
      );
    }

    if (chosenOfficer) {
      chosenOfficer.officerState = 'INTERCEPTING';
      chosenOfficer.currentAssignment = {
        type: 'INTERCEPT_PRISONER',
        targetPersonId: prisoner.id,
        targetCell: prisoner.assignedCell,
        doorId: prisoner.assignedDoorId,
        preferredWorkflow
      };
      chosenOfficer.activity = `INTERCEPTING: Pursuing ${prisoner.name}`;
      chosenOfficer.messageBubble = {
        text: `Command: Intercepting ${prisoner.name}!`,
        expiresAt: Date.now() + 6000,
        type: 'RADIO'
      };

      // Path straight towards prisoner's current or target waypoint
      const officerWp = chosenOfficer.currentWaypoint || 'W_NORTH_A';
      const targetWp = prisoner.currentWaypoint || prisoner.targetWaypoint || 'W_A_CORR_2';
      chosenOfficer.path = findShortestPath(officerWp, targetWp).slice(1);
      chosenOfficer.targetWaypoint = targetWp;

      this.addRecentActivity({
        event: `${chosenOfficer.name} Dispatched – Intercepting ${prisoner.name}`,
        location: chosenOfficer.currentRoom,
        status: 'WARNING',
        color: 'amber'
      });

      this.broadcastState();
    }
  }

  // --- Two Methods of Officer Cell Access (Workflow A vs Workflow B) ---
  triggerReturnToCellSecuring(officerId, prisonerId) {
    const officer = this.state.people[officerId];
    const prisoner = this.state.people[prisonerId];
    if (!officer || !prisoner) return;

    const cellDoorId = prisoner.assignedDoorId || 'DOOR-A102';
    const cellDoor = this.state.doors[cellDoorId];

    // Determine workflow: if explicitly requested, use that; otherwise 50/50 seed
    let workflow = prisoner.preferredWorkflow;
    if (!workflow) {
      workflow = Math.random() < 0.5 ? 'WORKFLOW_A' : 'WORKFLOW_B';
    }

    if (workflow === 'WORKFLOW_A') {
      // Workflow A: Officer requests administrator assistance via radio
      officer.officerState = 'REQUESTING_ACCESS';
      officer.activity = `Requesting Central Security to secure ${prisoner.assignedCell}`;
      const radioText = `Central, ${officer.name} at ${prisoner.assignedCell}. Prisoner returned. Requesting cell closure.`;
      officer.messageBubble = {
        text: radioText,
        expiresAt: Date.now() + 16000,
        type: 'RADIO'
      };

      const reqId = `REQ-${Date.now().toString(36).toUpperCase()}`;
      const radioRequest = {
        id: reqId,
        officerId: officer.id,
        officerName: officer.name,
        cell: prisoner.assignedCell,
        doorId: cellDoorId,
        prisonerId: prisoner.id,
        prisonerName: prisoner.name,
        message: radioText,
        actionRequired: 'CLOSE_CELL',
        status: 'PENDING',
        expiresAt: Date.now() + 15000,
        timestamp: new Date().toISOString()
      };

      this.state.officerRadioRequests.unshift(radioRequest);

      this.addRecentActivity({
        event: `Radio Request: ${officer.name} requests closure of ${prisoner.assignedCell}`,
        location: prisoner.assignedCell,
        status: 'NORMAL',
        color: 'blue'
      });

      this.broadcastEvent('officer:radio_request', radioRequest);
      this.broadcastState();

      // Configurable timeout fallback: if Central does not respond within 15s, officer uses RFID independently
      setTimeout(() => {
        const pending = this.state.officerRadioRequests.find(r => r.id === reqId && r.status === 'PENDING');
        if (pending) {
          pending.status = 'TIMED_OUT';
          this.addRecentActivity({
            event: `Admin Request Timeout: ${officer.name} securing with RFID badge`,
            location: prisoner.assignedCell,
            status: 'NORMAL',
            color: 'amber'
          });
          this.executeRfidCellSecure(officer.id, prisoner.id, cellDoorId);
        }
      }, 15000);

    } else {
      // Workflow B: Officer secures cell independently with RFID credential
      this.executeRfidCellSecure(officer.id, prisoner.id, cellDoorId);
    }
  }

  executeRfidCellSecure(officerId, prisonerId, cellDoorId) {
    const officer = this.state.people[officerId];
    const prisoner = this.state.people[prisonerId];
    const door = this.state.doors[cellDoorId];
    if (!officer || !prisoner || !door) return;

    officer.officerState = 'SECURING_CELL';
    officer.activity = `Securing ${door.name} via RFID Badge`;
    officer.rfidBadgeAction = {
      cardId: officer.rfidCardId || `CARD-${officer.id}`,
      doorId: cellDoorId,
      timestamp: new Date().toISOString(),
      text: `RFID BADGE VERIFIED: ${officer.rfidCardId || officer.id}`
    };

    // Close and lock the door barrier
    door.position = 'CLOSED';
    door.lockState = 'LOCKED';
    door.lastUpdated = new Date().toISOString();
    if (door.reedId && this.state.devices[door.reedId]) {
      this.state.devices[door.reedId].value = 'CLOSED';
    }
    if (door.lockId && this.state.devices[door.lockId]) {
      this.state.devices[door.lockId].value = 'LOCKED';
    }

    // Record RFID access log
    const accessEntry = {
      id: `ACC-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      readerId: door.reedId || `RFID-${door.block || 'CELL'}`,
      cardId: officer.rfidCardId,
      personName: officer.name,
      role: 'OFFICER',
      location: door.location,
      result: 'GRANTED',
      reason: 'Authorized Prisoner Return & Cell Custody Lockup'
    };
    this.state.accessLogs.unshift(accessEntry);
    db.setAccessLogs(this.state.accessLogs);

    // Cryptographic audit log
    auditLogger.log({
      type: 'OFFICER_RFID_CELL_SECURED',
      user: { username: officer.name, role: 'OFFICER' },
      action: `Officer ${officer.name} secured ${door.name} with RFID credential`,
      details: { officerId, prisonerId, cellDoorId, cardId: officer.rfidCardId }
    });

    // Reset prisoner to normal resting state
    prisoner.status = 'NORMAL';
    prisoner.activity = 'Resting in Cell';
    prisoner.currentRoom = prisoner.assignedCell;
    prisoner.currentWaypoint = prisoner.cellWaypoint;
    prisoner.path = [];
    prisoner.targetWaypoint = null;

    // Resolve associated escape incident
    if (prisoner.associatedIncident) {
      const inc = this.state.incidents.find(i => i.id === prisoner.associatedIncident);
      if (inc) {
        inc.status = 'RESOLVED';
        inc.resolvedBy = `${officer.name} (Officer RFID)`;
        db.setIncidents(this.state.incidents);
      }
      prisoner.associatedIncident = null;
    }

    this.addRecentActivity({
      event: `${door.name} Locked – Officer RFID Access Granted`,
      location: door.location,
      status: 'NORMAL',
      color: 'green'
    });

    this.broadcastState();

    // After 3 seconds, clear RFID animation and return officer to patrol
    setTimeout(() => {
      officer.rfidBadgeAction = null;
      officer.messageBubble = null;
      officer.officerState = 'PATROLLING';
      officer.activity = 'Routine Cell Block Check';
      officer.currentAssignment = null;
      this.broadcastState();
    }, 3000);
  }

  // --- Administrator Responds to Officer Radio Request ---
  respondToRadioRequest(requestId, action = 'CLOSE_CELL', user = { username: 'ADMIN', role: 'ADMIN' }) {
    const req = this.state.officerRadioRequests.find(r => r.id === requestId);
    if (!req) throw new Error(`Radio request ${requestId} not found`);

    if (action === 'CLOSE_CELL') {
      const door = this.state.doors[req.doorId];
      if (door) {
        door.position = 'CLOSED';
        door.lockState = 'LOCKED';
        door.lastUpdated = new Date().toISOString();
        if (door.reedId && this.state.devices[door.reedId]) {
          this.state.devices[door.reedId].value = 'CLOSED';
        }
        if (door.lockId && this.state.devices[door.lockId]) {
          this.state.devices[door.lockId].value = 'LOCKED';
        }
      }

      req.status = 'COMPLETED';
      req.resolvedBy = user.username;
      req.resolvedAt = new Date().toISOString();

      const officer = this.state.people[req.officerId];
      if (officer) {
        officer.messageBubble = {
          text: 'Central confirmed cell closure. Returning to patrol.',
          expiresAt: Date.now() + 4000,
          type: 'RADIO'
        };
        officer.officerState = 'PATROLLING';
        officer.activity = 'Routine Patrol';
        officer.currentAssignment = null;
      }

      const prisoner = this.state.people[req.prisonerId];
      if (prisoner) {
        prisoner.status = 'NORMAL';
        prisoner.activity = 'Resting in Cell';
        prisoner.currentRoom = prisoner.assignedCell;
        prisoner.currentWaypoint = prisoner.cellWaypoint;
        prisoner.path = [];
        prisoner.targetWaypoint = null;

        if (prisoner.associatedIncident) {
          const inc = this.state.incidents.find(i => i.id === prisoner.associatedIncident);
          if (inc) {
            inc.status = 'RESOLVED';
            inc.resolvedBy = `${user.username} (Admin Close)`;
            db.setIncidents(this.state.incidents);
          }
          prisoner.associatedIncident = null;
        }
      }

      auditLogger.log({
        type: 'ADMIN_CELL_CLOSURE_COMMAND',
        user,
        action: `Administrator closed ${req.cell} in response to ${req.officerName}`,
        details: { requestId, cell: req.cell, doorId: req.doorId }
      });

      this.addRecentActivity({
        event: `Admin Closed ${req.cell} – Officer ${req.officerName} Resumed Duty`,
        location: req.cell,
        status: 'NORMAL',
        color: 'green'
      });

      this.broadcastEvent('officer:radio_response', req);
      this.broadcastState();
      return req;
    }
  }

  // --- Administrator-to-Officer Task Dispatch ---
  dispatchOfficerTask(arg1, arg2) {
    let officerId, commandType, targetWaypointId, note = '', priority = 'NORMAL', user = { username: 'ADMIN', role: 'ADMIN' }, targetPersonId = null, targetDeviceId = null;

    if (typeof arg1 === 'string') {
      officerId = arg1;
      const opts = arg2 || {};
      commandType = opts.commandType || 'MOVE_TO';
      targetWaypointId = opts.targetWaypointId;
      note = opts.note || '';
      priority = opts.priority || 'NORMAL';
      if (opts.user) user = opts.user;
      targetPersonId = opts.targetPersonId || null;
      targetDeviceId = opts.targetDeviceId || null;
    } else {
      const opts = arg1 || {};
      officerId = opts.officerId;
      commandType = opts.commandType || 'MOVE_TO';
      targetWaypointId = opts.targetWaypointId;
      note = opts.note || '';
      priority = opts.priority || 'NORMAL';
      if (opts.user) user = opts.user;
      targetPersonId = opts.targetPersonId || null;
      targetDeviceId = opts.targetDeviceId || null;
    }

    const officer = this.state.people[officerId];
    if (!officer) throw new Error(`Officer ${officerId} not found`);

    // If targetWaypointId not explicitly set, try resolving from targetPersonId or targetDeviceId
    if (!targetWaypointId && targetPersonId && this.state.people[targetPersonId]) {
      const targetP = this.state.people[targetPersonId];
      targetWaypointId = targetP.currentWaypoint || targetP.cellWaypoint || 'W_YARD_1';
    }
    if (!targetWaypointId && targetDeviceId && this.state.devices[targetDeviceId]) {
      targetWaypointId = 'W_NORTH_A';
    }
    if (!targetWaypointId) {
      targetWaypointId = officer.currentWaypoint || 'W_NORTH_A';
    }

    if (!WAYPOINTS[targetWaypointId]) throw new Error(`Invalid destination waypoint: ${targetWaypointId}`);

    if (officer.officerState === 'MEDICAL_RECOVERY') {
      throw new Error(`Officer ${officer.name} is currently incapacitated / undergoing medical recovery.`);
    }

    if (officer.officerState === 'INTERCEPTING' && priority !== 'EMERGENCY_OVERRIDE') {
      throw new Error(`Officer ${officer.name} is actively pursuing an escaping inmate. Cannot interrupt higher-priority response.`);
    }

    const taskId = `TASK-${Date.now().toString(36).toUpperCase()}`;
    const destinationRoom = WAYPOINTS[targetWaypointId].room;

    // Contextual radio acknowledgements based on commandType
    let radioSpeech = `Received Central. Proceeding to ${destinationRoom}.`;
    if (commandType === 'MONITOR_PRISONER') {
      const targetName = targetPersonId && this.state.people[targetPersonId]?.name ? this.state.people[targetPersonId].name : 'assigned inmate';
      radioSpeech = `Acknowledged Central. Monitoring ${targetName} at ${destinationRoom}.`;
    } else if (commandType === 'INVESTIGATE_CAMERA') {
      radioSpeech = `Camera alert received. Investigating sector at ${destinationRoom}.`;
    } else if (commandType === 'INSPECT_CELL') {
      radioSpeech = `Proceeding to inspect cell at ${destinationRoom}.`;
    } else if (commandType === 'INSPECT_CORRIDOR') {
      radioSpeech = `Received. Initiating corridor inspection at ${destinationRoom}.`;
    } else if (commandType === 'PATROL_ZONE') {
      radioSpeech = `Understood Central. Commencing patrol of ${destinationRoom}.`;
    } else if (commandType === 'ESCORT_PRISONER') {
      radioSpeech = `Received Central. Executing authorized escort detail.`;
    } else if (commandType === 'VERIFY_VISITOR') {
      radioSpeech = `En route to verify external visitor at checkpoint.`;
    } else if (commandType === 'RESPOND_DOOR_ALARM') {
      radioSpeech = `Responding immediately to door alarm at ${destinationRoom}!`;
    } else if (commandType === 'INSPECT_SENSOR') {
      radioSpeech = `Acknowledged. Inspecting sensor anomaly at ${destinationRoom}.`;
    } else if (commandType === 'REPORT_MEDICAL') {
      radioSpeech = `Received Central. Reporting directly to Medical Bay clinic.`;
    } else if (commandType === 'RETURN_POST') {
      radioSpeech = `Copy that Central. Returning to assigned duty post.`;
    } else if (commandType === 'STATUS_REPORT') {
      radioSpeech = `Station secure. Telemetry and beacon nominal.`;
    }

    const task = {
      id: taskId,
      officerId: officer.id,
      officerName: officer.name,
      commandType,
      destinationRoom,
      targetWaypointId,
      targetPersonId,
      targetDeviceId,
      priority,
      note,
      dispatchedBy: user.username,
      status: 'IN_PROGRESS',
      timestamp: new Date().toISOString()
    };

    this.state.officerTasks.unshift(task);

    officer.officerState = 'RESPONDING_TO_ADMIN_COMMAND';
    officer.availability = 'BUSY';
    officer.activity = `${commandType}: Heading to ${destinationRoom}`;
    officer.currentAssignment = { type: 'ADMIN_TASK', taskId, targetWaypointId, destinationRoom, commandType, targetPersonId };

    // Radio exchange acknowledgement
    officer.messageBubble = {
      text: radioSpeech,
      expiresAt: Date.now() + 8000,
      type: 'DISPATCH'
    };

    // Calculate valid walking path
    const currentWp = officer.currentWaypoint || 'W_NORTH_A';
    officer.path = findShortestPath(currentWp, targetWaypointId).slice(1);
    officer.targetWaypoint = targetWaypointId;

    auditLogger.log({
      type: 'ADMIN_OFFICER_DISPATCH',
      user,
      action: `Assigned task to ${officer.name}: ${commandType} at ${destinationRoom}`,
      details: task
    });

    this.addRecentActivity({
      event: `Dispatch: ${officer.name} – ${commandType} at ${destinationRoom}`,
      location: destinationRoom,
      status: 'NORMAL',
      color: 'blue'
    });

    this.broadcastEvent('officer:task_created', task);
    this.broadcastState();
    return task;
  }

  // --- Camera Sweep & Manual Pan Operations ---
  setCameraSweep(camId, action = 'TOGGLE', user = { username: 'ADMIN', role: 'ADMIN' }) {
    const cam = this.state.cameras[camId];
    if (!cam) throw new Error(`Camera ${camId} not found`);

    if (action === 'START') {
      cam.isSweeping = true;
      cam.controlMode = 'SWEEP';
    } else if (action === 'STOP') {
      cam.isSweeping = false;
      cam.controlMode = 'STATIONARY';
    } else if (action === 'RESET') {
      cam.isSweeping = false;
      cam.angle = cam.defaultAngle || 45;
      cam.controlMode = 'STATIONARY';
    } else {
      cam.isSweeping = !cam.isSweeping;
      cam.controlMode = cam.isSweeping ? 'SWEEP' : 'STATIONARY';
    }

    this.updateCameraVisibility(new Date().toISOString());
    this.broadcastEvent('camera:sweep', { camId, isSweeping: cam.isSweeping, angle: cam.angle, controlMode: cam.controlMode });
    this.broadcastState();
    return cam;
  }

  setCameraPan(camId, targetAngle, user = { username: 'ADMIN', role: 'ADMIN' }) {
    const cam = this.state.cameras[camId];
    if (!cam) throw new Error(`Camera ${camId} not found`);

    const minA = cam.minAngle !== undefined ? cam.minAngle : 0;
    const maxA = cam.maxAngle !== undefined ? cam.maxAngle : 360;
    const clampedAngle = Math.max(minA, Math.min(maxA, Number(targetAngle)));

    cam.angle = Math.round(clampedAngle * 10) / 10;
    cam.isSweeping = false;
    cam.controlMode = 'MANUAL';

    this.updateCameraVisibility(new Date().toISOString());
    this.broadcastEvent('camera:pan', { camId, angle: cam.angle, controlMode: cam.controlMode });
    this.broadcastState();
    return cam;
  }

  // --- Credential Revocation & Insider Threat Handling ---
  revokeOfficerCredential(officerId, user = { username: 'ADMIN', role: 'ADMIN' }) {
    const officer = this.state.people[officerId];
    if (!officer) throw new Error(`Officer ${officerId} not found`);

    officer.credentialStatus = 'REVOKED';
    officer.availability = 'COMPROMISED';
    officer.activity = 'Suspended from Duty – RFID Credential Revoked';
    if (!this.revokedCards) this.revokedCards = new Set();
    if (officer.rfidCardId) this.revokedCards.add(officer.rfidCardId);

    auditLogger.log({
      type: 'CREDENTIAL_REVOCATION',
      user,
      action: `Revoked RFID credential for ${officer.name} (${officer.id})`,
      details: { officerId, cardId: officer.rfidCardId, previousStatus: 'ACTIVE', newStatus: 'REVOKED' }
    });

    this.addRecentActivity({
      event: `RFID Revoked: ${officer.name} (${officer.badge}) – Access Disabled`,
      location: officer.currentRoom,
      status: 'CRITICAL',
      color: 'red'
    });

    this.broadcastState();
    return officer;
  }

  // --- External Visitor Workflow ---
  triggerVisitorArrival({ visitorId = 'VIS-881', name = 'Detective Sarah Lin', category = 'INVESTIGATOR', organization = 'State Investigative Bureau', purpose = 'Formal Inspection & Inquiry', arrivalLocation = 'South Sally Port Outer Gate (Gate 2)' } = {}) {
    const visitor = {
      id: visitorId,
      name,
      category,
      organization,
      purpose,
      location: arrivalLocation,
      status: 'AWAITING_APPROVAL', // 'AWAITING_APPROVAL' | 'APPROVED' | 'DENIED' | 'IN_CONFERENCE' | 'DEPARTED'
      arrivalTime: new Date().toISOString(),
      escortOfficerId: null
    };

    const existingIdx = this.state.externalVisitors.findIndex(v => v.id === visitorId);
    if (existingIdx >= 0) this.state.externalVisitors[existingIdx] = visitor;
    else this.state.externalVisitors.unshift(visitor);

    this.addRecentActivity({
      event: `External Visitor Arrival: ${name} (${category}) at Gate 2`,
      location: 'South Sally Port',
      status: 'WARNING',
      color: 'blue'
    });

    this.broadcastEvent('visitor:arrival', visitor);
    this.broadcastState();
    return visitor;
  }

  handleVisitorDecision(visitorId, decision, user = { username: 'ADMIN', role: 'ADMIN' }) {
    const visitor = this.state.externalVisitors.find(v => v.id === visitorId);
    if (!visitor) throw new Error(`Visitor ${visitorId} not found`);

    if (user.role !== 'ADMIN') {
      throw new Error('Only an administrator can authorize external visitor perimeter access');
    }

    if (decision === 'APPROVE') {
      visitor.status = 'APPROVED';
      visitor.authorizedBy = `${user.username} (${user.role})`;
      visitor.escortOfficerId = 'OFC-118';

      // Cycle Outer Sally Port Gate 2 to allow entry into inspection bay
      this.handleGateCommand('GATE-02', 'OPEN', user);

      // Dispatch Officer Kim to escort visitor
      this.dispatchOfficerTask('OFC-118', {
        commandType: 'ESCORT_PRISONER',
        targetWaypointId: 'W_SALLY_BAY',
        note: `Escort approved external investigator ${visitor.name} to Administration Conference Room.`
      });

      auditLogger.log({
        type: 'VISITOR_AUTHORIZATION',
        user,
        action: `Approved external access for ${visitor.name} (${visitor.organization})`,
        details: { visitorId, decision }
      });

      this.addRecentActivity({
        event: `Visitor Access APPROVED: ${visitor.name} – Escort OFC-118 Assigned`,
        location: 'South Sally Port',
        status: 'NORMAL',
        color: 'green'
      });
    } else {
      visitor.status = 'DENIED';
      visitor.authorizedBy = `${user.username} (${user.role})`;

      auditLogger.log({
        type: 'VISITOR_AUTHORIZATION',
        user,
        action: `DENIED external access for ${visitor.name}`,
        details: { visitorId, decision }
      });

      this.addRecentActivity({
        event: `Visitor Access DENIED: ${visitor.name}`,
        location: 'South Sally Port',
        status: 'CRITICAL',
        color: 'red'
      });
    }

    this.broadcastEvent('visitor:decision', visitor);
    this.broadcastState();
    return visitor;
  }

  // --- Suspicious Activity Engine ---
  triggerSuspiciousActivity({ type = 'LOITERING_RESTRICTED_GATE', prisonerId = 'P-2089', location = 'Common Exercise Yard', detectionSource = 'CCTV_CAM_01', severity = 'HIGH' } = {}) {
    const prisoner = this.state.people[prisonerId];
    const activity = {
      id: `SUSP-${Date.now().toString(36).toUpperCase()}`,
      targetPrisonerId: prisonerId,
      targetPrisonerName: prisoner?.name || 'Inmate',
      location,
      type,
      severity,
      detectionSource,
      cameraCoverage: 'COVERED',
      status: 'DETECTED', // 'DETECTED' | 'AWAITING_REVIEW' | 'OFFICER_ASSIGNED' | 'UNDER_OBSERVATION' | 'RESOLVED' | 'ESCALATED'
      assignedOfficerId: null,
      startTime: new Date().toISOString(),
      resolvedAt: null,
      cooldownRemainingSec: 0
    };

    this.state.suspiciousActivities.unshift(activity);
    if (this.state.suspiciousActivities.length > 20) this.state.suspiciousActivities.pop();

    if (prisoner) {
      prisoner.activity = `Suspicious Activity: ${type.replace(/_/g, ' ')}`;
    }

    this.broadcastEvent('suspicious:new', activity);
    this.broadcastState();
    return activity;
  }

  // --- Health Model & Simulated Security Control Breach ---
  applyHealthChange(personId, delta, reason = 'Scripted Simulation Event') {
    const person = this.state.people[personId];
    if (!person) throw new Error(`Person ${personId} not found`);

    person.health = Math.max(0, Math.min(100, (person.health || 100) + delta));
    if (person.health <= 0) {
      person.healthState = 'INCAPACITATED';
      person.activity = 'Incapacitated – Requires Medical Evacuation';
      person.path = [];
      if (person.type === 'OFFICER' || person.type === 'SUPERVISOR') {
        person.availability = 'INCAPACITATED';
      }
    } else if (person.health < 40) {
      person.healthState = 'INJURED';
      person.activity = 'Injured – Seeking Medical Assistance';
    } else if (person.health < 100) {
      person.healthState = 'RECOVERING';
    } else {
      person.healthState = 'HEALTHY';
    }

    // If supervisor character SUP-309 became incapacitated -> trigger Security Control Breach
    if (personId === 'SUP-309' && person.health <= 0) {
      this.triggerSecurityControlBreach();
    }

    this.addRecentActivity({
      event: `Health Update: ${person.name} (${person.health} HP) – ${reason}`,
      location: person.currentRoom,
      status: person.health < 40 ? 'CRITICAL' : 'NORMAL',
      color: person.health < 40 ? 'red' : 'blue'
    });

    this.broadcastEvent('person:health', { personId, health: person.health, healthState: person.healthState, reason });
    this.broadcastState();
    return person;
  }

  triggerSecurityControlBreach() {
    this.state.securityControlBreach = {
      isBreached: true,
      incapacitatedOfficerId: 'SUP-309',
      title: 'SIMULATED SECURITY CONTROL BREACH',
      message: 'In-world SOC Supervisor Sgt. Cole incapacitated! Local console offline. Authenticated web user operational.',
      affectedControls: ['LOCAL_CONSOLE_LOCK', 'INTERNAL_STROBE_OVERRIDE'],
      severity: 'CRITICAL',
      activatedAt: new Date().toISOString()
    };

    this.addRecentActivity({
      event: 'ALERT: SIMULATED SECURITY CONTROL BREACH ACTIVATED',
      location: 'Central Security Control',
      status: 'CRITICAL',
      color: 'red'
    });

    this.broadcastEvent('security:breach', this.state.securityControlBreach);
    this.broadcastState();
  }

  resetSecurityControlBreach() {
    const supervisor = this.state.people['SUP-309'];
    if (supervisor) {
      supervisor.health = 100;
      supervisor.healthState = 'HEALTHY';
      supervisor.activity = 'SOC Monitoring & Command';
      supervisor.status = 'NORMAL';
      supervisor.availability = 'AVAILABLE';
    }

    this.state.securityControlBreach = {
      isBreached: false,
      incapacitatedOfficerId: null,
      title: '',
      message: '',
      affectedControls: [],
      severity: 'NORMAL',
      activatedAt: null
    };

    this.addRecentActivity({
      event: 'Security Control Restored: SOC Console Operational',
      location: 'Central Security Control',
      status: 'NORMAL',
      color: 'green'
    });

    this.broadcastEvent('security:breach_reset', this.state.securityControlBreach);
    this.broadcastState();
  }

  // --- Officer Incapacitation & Medical Recovery Workflow ---
  triggerOfficerMedicalEvent(officerId, reason = 'CONFRONTATION_EXHAUSTION', user = { username: 'SIMULATOR', role: 'OPERATOR' }) {
    const officer = this.state.people[officerId];
    if (!officer) throw new Error(`Officer ${officerId} not found`);

    officer.officerState = 'MEDICAL_RECOVERY';
    officer.status = 'RESTRICTED';
    officer.activity = `Incapacitated / Awaiting Medical Assistance (${reason})`;
    officer.recoveryTimerSec = 15; // 15 seconds simulation timer
    officer.path = [];
    officer.targetWaypoint = null;

    officer.messageBubble = {
      text: `Medical Assistance Requested – Officer Down (${reason})`,
      expiresAt: Date.now() + 10000,
      type: 'MEDICAL'
    };

    const incId = `INC-MED-${Date.now().toString(36).toUpperCase()}`;
    const incident = {
      id: incId,
      title: `Officer Welfare Alert: ${officer.name} Incapacitated`,
      rule: 'RULE G: Officer Welfare / Medical Response Required',
      severity: 'WARNING',
      location: officer.currentRoom,
      coordinates: { x: officer.x, y: officer.y },
      associatedDevice: 'DURESS-MED-01',
      associatedPerson: officer.id,
      status: 'ACTIVE',
      acknowledgedBy: null,
      resolvedBy: null,
      timestamp: new Date().toISOString(),
      evidence: [
        `Officer telemetry beacon signaled sudden cessation of movement`,
        `Vital distress flags confirmed via body-worn monitor`,
        `Assigned sector: ${officer.assignedZone}`
      ]
    };
    officer.associatedIncident = incId;
    this.state.incidents.unshift(incident);
    db.setIncidents(this.state.incidents);

    auditLogger.log({
      type: 'OFFICER_INCAPACITATED',
      user,
      action: `Officer ${officer.name} entered medical recovery (${reason})`,
      details: { officerId, reason, incidentId: incId }
    });

    this.addRecentActivity({
      event: `Medical Alert: ${officer.name} Incapacitated`,
      location: officer.currentRoom,
      status: 'WARNING',
      color: 'red'
    });

    this.broadcastEvent('officer:medical_event', { officerId, incident });
    this.broadcastState();
    return { officer, incident };
  }

  // --- Controlled Demonstration Scenarios ---
  startControlledEscapeScenario(preferredWorkflow = 'WORKFLOW_A') {
    // Unlock first then open Marcus Vance's Cell A-102 door
    this.handleDoorLock('DOOR-A102', 'UNLOCK');
    this.handleDoorOperate('DOOR-A102', 'OPEN');
    const vance = this.state.people['P-1044'];
    if (vance) {
      vance.preferredWorkflow = preferredWorkflow;
      this.triggerPrisonerEscape('P-1044', 'W_PERIM_EAST_N', preferredWorkflow);
    }
  }

  startMassEscapeScenario() {
    // Unlock and open 3 separate doors across different cell blocks
    this.handleDoorLock('DOOR-A102', 'UNLOCK');
    this.handleDoorLock('DOOR-B102', 'UNLOCK');
    this.handleDoorLock('DOOR-C101', 'UNLOCK');

    this.handleDoorOperate('DOOR-A102', 'OPEN');
    this.handleDoorOperate('DOOR-B102', 'OPEN');
    this.handleDoorOperate('DOOR-C101', 'OPEN');

    // 3 prisoners choose distinct routes
    setTimeout(() => {
      this.triggerPrisonerEscape('P-1044', 'W_PERIM_EAST_N'); // Vance to East Perimeter
      this.triggerPrisonerEscape('P-2089', 'W_SALLY_GATE_OUT'); // Chen to Sally Port
      this.triggerPrisonerEscape('P-3105', 'W_YARD_1'); // Miller to Yard
    }, 500);
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

    // Check if card has been explicitly revoked
    if (this.revokedCards && this.revokedCards.has(cardId)) {
      result = 'DENIED';
      reason = 'RFID Credential REVOKED by Security Administrator';
      if (person) {
        personName = person.name;
        role = person.type;
      }
    } else if (person) {
      personName = person.name;
      role = person.type;

      if (person.credentialStatus === 'REVOKED' || person.credentialStatus === 'SUSPENDED') {
        result = 'DENIED';
        reason = `RFID Credential ${person.credentialStatus} by Security Administrator`;
      } else if (person.type === 'OFFICER' || person.type === 'SUPERVISOR') {
        result = 'GRANTED';
        reason = 'Valid Officer Security Credential';
        this.rules.recordAuthScan(readerId, cardId, person.id);
      } else if (person.type === 'PRISONER') {
        result = 'DENIED';
        reason = 'Illicit Inmate Token Presentation – Access Prohibited';
      }
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
            if (person.status !== 'ESCAPING' && person.status !== 'DETAINED' && person.status !== 'ESCAPED' && person.officerState !== 'INTERCEPTING' && person.officerState !== 'ESCORTING') {
              person.status = 'NORMAL';
            }
            person.targetWaypoint = null;
          }
          movedAny = true;
        }
      }
    }

    // Crowd separation repulsion: offset people occupying the same waypoint to prevent full visual overlap
    const waypointOccupants = {};
    for (const person of Object.values(this.state.people)) {
      if (person.currentWaypoint) {
        if (!waypointOccupants[person.currentWaypoint]) waypointOccupants[person.currentWaypoint] = [];
        waypointOccupants[person.currentWaypoint].push(person);
      }
    }
    for (const [wpId, list] of Object.entries(waypointOccupants)) {
      if (list.length > 1) {
        const base = WAYPOINTS[wpId];
        list.forEach((p, index) => {
          if (base && (!p.path || p.path.length === 0)) {
            const angle = (index * (2 * Math.PI / list.length));
            p.x = Math.round(base.x + Math.cos(angle) * 12);
            p.y = Math.round(base.y + Math.sin(angle) * 12);
          }
        });
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
