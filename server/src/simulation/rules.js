export class SensorFusionEngine {
  constructor(state, emitEvent) {
    this.state = state;
    this.emitEvent = emitEvent;
    // Map of readerId -> { timestamp, cardId, personId }
    this.recentAuthScans = new Map();
  }

  recordAuthScan(readerId, cardId, personId) {
    this.recentAuthScans.set(readerId, {
      timestamp: Date.now(),
      cardId,
      personId
    });
  }

  isRecentlyAuthorized(readerId, windowMs = 30000) {
    const scan = this.recentAuthScans.get(readerId);
    if (!scan) return false;
    return (Date.now() - scan.timestamp) <= windowMs;
  }

  // Evaluate Door / Reed Opening
  evaluateDoorOpening(doorDeviceId, reedDeviceId) {
    const reed = this.state.devices[reedDeviceId];
    if (!reed) return null;

    // Check if an associated reader was swiped recently
    // Map reed to likely reader
    let readerId = 'RFID-BLOCK-A';
    if (reedDeviceId.includes('B10')) readerId = 'RFID-BLOCK-B';
    if (reedDeviceId.includes('C10')) readerId = 'RFID-BLOCK-C';
    if (reedDeviceId.includes('ISO')) readerId = 'RFID-BLOCK-A';

    const authorized = this.isRecentlyAuthorized(readerId, 30000);

    if (authorized) {
      // RULE A: Authorized RFID scan followed by expected door opening
      return {
        rule: 'RULE A',
        outcome: 'NORMAL',
        title: `Authorized Door Access – ${reed.location}`,
        severity: 'INFO',
        createIncident: false,
        explanation: 'Authorized RFID badge presented prior to door opening.'
      };
    } else {
      // RULE B: Door opens without recent authorized scan
      const incidentId = `INC-BREACH-${Date.now().toString(36).toUpperCase()}`;
      const incident = {
        id: incidentId,
        title: `Unauthorized Door Opened – ${reed.location}`,
        rule: 'RULE B: Door opens without a recent authorized RFID scan',
        severity: 'WARNING',
        location: reed.location,
        coordinates: { x: reed.x || 340, y: reed.y || 170 },
        associatedDevice: reedDeviceId,
        associatedPerson: null,
        status: 'ACTIVE',
        acknowledgedBy: null,
        resolvedBy: null,
        timestamp: new Date().toISOString(),
        evidence: [
          `${reed.name} reed switch reported physical OPEN state`,
          `No valid RFID scan registered on ${readerId} in the last 30 seconds`,
          'Controller interrupt detected unexpected contact break'
        ]
      };

      return {
        rule: 'RULE B',
        outcome: 'WARNING',
        title: `Unexpected Door Opening – ${reed.location}`,
        severity: 'WARNING',
        createIncident: true,
        incident,
        explanation: 'Magnetic reed switch state transitioned to OPEN with no valid RFID badge verification.'
      };
    }
  }

  // Evaluate Restricted Corridor Motion (RULE C)
  evaluateCorridorMotion(pirDeviceId) {
    const pir = this.state.devices[pirDeviceId];
    if (!pir) return null;

    // Check if any unexpected door opened recently in this block
    const activeBreaches = this.state.incidents.filter(
      inc => inc.status === 'ACTIVE' && (inc.rule.includes('RULE B') || inc.severity === 'WARNING')
    );

    if (activeBreaches.length > 0 && (pirDeviceId === 'PIR-SPINE' || pirDeviceId.includes('PIR-CORR'))) {
      // RULE C: Unexpected door opening followed by motion in a restricted corridor
      const incidentId = `INC-ESCAPE-${Date.now().toString(36).toUpperCase()}`;
      const incident = {
        id: incidentId,
        title: `Possible Escape Detected – ${pir.location}`,
        rule: 'RULE C: Unexpected door opening followed by motion in restricted corridor',
        severity: 'CRITICAL',
        location: pir.location,
        coordinates: { x: pir.x || 800, y: pir.y || 550 },
        associatedDevice: pirDeviceId,
        associatedPerson: 'P-1044', // Likely suspect
        status: 'ACTIVE',
        acknowledgedBy: null,
        resolvedBy: null,
        timestamp: new Date().toISOString(),
        evidence: [
          `Corridor motion sensor ${pir.name} tripped in restricted zone`,
          `Correlated with recent unverified door opening (${activeBreaches[0].location})`,
          'Tracking beacons indicate unauthorized personnel movement'
        ]
      };

      return {
        rule: 'RULE C',
        outcome: 'CRITICAL',
        title: `Possible Escape In Progress – ${pir.location}`,
        severity: 'CRITICAL',
        createIncident: true,
        incident,
        explanation: 'Correlated multi-sensor trigger: unexpected cell door breach followed by motion in restricted corridor.'
      };
    }

    return null;
  }

  // Evaluate Perimeter Sensors (RULE D)
  evaluatePerimeterSensors(triggeredDeviceId) {
    const irBeams = ['IR-BEAM-N', 'IR-BEAM-E', 'IR-BEAM-S', 'IR-BEAM-W'];
    const vibSensors = ['VIB-FENCE-N', 'VIB-FENCE-E', 'VIB-FENCE-S', 'VIB-FENCE-W'];

    const anyIrBroken = irBeams.some(id => this.state.devices[id]?.value === 'BROKEN');
    const anyVibActive = vibSensors.some(id => this.state.devices[id]?.value === 'VIBRATION' || this.state.devices[id]?.value === 'TRIPPED');

    if (anyIrBroken && anyVibActive) {
      // RULE D: Perimeter vibration combined with interrupted IR beam
      const dev = this.state.devices[triggeredDeviceId] || this.state.devices['IR-BEAM-E'];
      const incidentId = `INC-PERIM-${Date.now().toString(36).toUpperCase()}`;
      const incident = {
        id: incidentId,
        title: `Perimeter Breach Alert – ${dev.location}`,
        rule: 'RULE D: Perimeter vibration combined with interrupted IR optical beam',
        severity: 'CRITICAL',
        location: dev.location,
        coordinates: { x: dev.x || 1495, y: dev.y || 480 },
        associatedDevice: triggeredDeviceId,
        associatedPerson: null,
        status: 'ACTIVE',
        acknowledgedBy: null,
        resolvedBy: null,
        timestamp: new Date().toISOString(),
        evidence: [
          'Vibration sensor detected severe kinetic shock on perimeter fencing',
          'Infrared barrier optical beam interrupted concurrently',
          'Perimeter security zone compromised'
        ]
      };

      return {
        rule: 'RULE D',
        outcome: 'CRITICAL',
        title: `Perimeter Breach Alert – ${dev.location}`,
        severity: 'CRITICAL',
        createIncident: true,
        incident,
        explanation: 'Dual-sensor validation: simultaneous perimeter acoustic/vibration spike and infrared beam interruption.'
      };
    }

    return null;
  }

  // Evaluate Gate Actuator Jam (RULE E)
  evaluateGateJam(gateId) {
    const gate = this.state.gates[gateId];
    if (!gate) return null;

    const incidentId = `INC-ACTUATOR-${Date.now().toString(36).toUpperCase()}`;
    const incident = {
      id: incidentId,
      title: `Gate Actuator Fault – ${gate.name}`,
      rule: 'RULE E: Gate command issued but limit switch position unconfirmed / motor jam',
      severity: 'WARNING',
      location: gate.location,
      coordinates: { x: gate.x, y: gate.y },
      associatedDevice: gateId,
      associatedPerson: null,
      status: 'ACTIVE',
      acknowledgedBy: null,
      resolvedBy: null,
      timestamp: new Date().toISOString(),
      evidence: [
        `Command to set state ${gate.targetState} timed out after 4000ms`,
        'End-travel optical limit switch did not report closure',
        'Motor driver current exceeded threshold (current: 4.8A - Jammed)'
      ]
    };

    return {
      rule: 'RULE E',
      outcome: 'WARNING',
      title: `Gate Actuator Fault – ${gate.name}`,
      severity: 'WARNING',
      createIncident: true,
      incident,
      explanation: 'Gate physical actuator stalled or mechanical interlock blocked closure.'
    };
  }

  // Evaluate Controller Heartbeat Loss (RULE F)
  evaluateControllerDisconnect(controllerId) {
    const ctrl = this.state.controllers[controllerId];
    if (!ctrl) return null;

    const incidentId = `INC-NODE-${Date.now().toString(36).toUpperCase()}`;
    const incident = {
      id: incidentId,
      title: `IoT Controller Offline – ${ctrl.name}`,
      rule: 'RULE F: ESP32 heartbeat missing beyond configured timeout threshold (5000ms)',
      severity: 'CRITICAL',
      location: ctrl.location,
      coordinates: { x: 800, y: 500 },
      associatedDevice: controllerId,
      associatedPerson: null,
      status: 'ACTIVE',
      acknowledgedBy: null,
      resolvedBy: null,
      timestamp: new Date().toISOString(),
      evidence: [
        `ESP32 controller ${ctrl.id} missed 3 consecutive keep-alive heartbeats`,
        `Subordinate sensors (${ctrl.ownedDevices.length} devices) shifted to OFFLINE / UNKNOWN status`,
        `Network socket connection to node IP ${ctrl.ip} dropped`
      ]
    };

    return {
      rule: 'RULE F',
      outcome: 'CRITICAL',
      title: `IoT Controller Offline – ${ctrl.name}`,
      severity: 'CRITICAL',
      createIncident: true,
      incident,
      explanation: 'ESP32 micro-controller dropped offline. Subordinate sensors cannot be trusted and are marked OFFLINE.'
    };
  }

  // Evaluate Medical Assistance (RULE G)
  evaluateMedicalRequest(deviceId = 'DURESS-MED-01') {
    const dev = this.state.devices[deviceId] || { location: 'Medical Ward', x: 470, y: 410 };
    const incidentId = `INC-MED-${Date.now().toString(36).toUpperCase()}`;
    const incident = {
      id: incidentId,
      title: 'Medical Assistance Requested',
      rule: 'RULE G: Medical assistance duress call button triggered',
      severity: 'MEDIUM',
      location: dev.location,
      coordinates: { x: dev.x || 470, y: dev.y || 410 },
      associatedDevice: deviceId,
      associatedPerson: 'P-4412',
      status: 'ACTIVE',
      acknowledgedBy: null,
      resolvedBy: null,
      timestamp: new Date().toISOString(),
      evidence: [
        'Hardwired panic/duress button triggered at Medical Ward triage station',
        'ESP32-MED-01 GPIO interrupt recorded emergency priority',
        'Immediate medical staff dispatch required'
      ]
    };

    return {
      rule: 'RULE G',
      outcome: 'MEDIUM',
      title: 'Medical Assistance Requested',
      severity: 'MEDIUM',
      createIncident: true,
      incident,
      explanation: 'Patient welfare assistance triggered manually from ward station.'
    };
  }
}
