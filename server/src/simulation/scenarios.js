// Scenario Engine & Deterministic Scenario Registry
// Manages automated and demonstration scenarios driven strictly by authoritative simulation time.

export const SCENARIO_REGISTRY = {
  'OFFICER_ENTRY': {
    id: 'OFFICER_ENTRY',
    title: '1. Authorized Officer Entry & Gate Check',
    category: 'OPERATIONAL',
    description: 'Demonstrates standard RFID contactless credential verification, solenoid unlock, corridor movement, and automatic interlock relocking.',
    initialConditions: 'All cell doors locked. Officer OFC-514 stationed in North Corridor.',
    trigger: 'Officer OFC-514 presents badge at Block A Entrance RFID terminal.',
    actors: ['OFC-514', 'RFID-BLOCK-A', 'LOCK-A101', 'REED-A101', 'GATE-05'],
    expectedSequence: [
      'OFC-514 badge scanned at RFID-BLOCK-A',
      'Cell A-101 solenoid unlocks and magnetic reed indicates open',
      'Officer enters Block A corridor',
      'Door closes and solenoid relocks safely'
    ],
    adminDecisions: ['Monitor access logs', 'Inspect SHA-256 audit ledger'],
    possibleOutcomes: ['SUCCESSFUL_ENTRY'],
    status: 'PASSING'
  },
  'UNAUTHORIZED_ACCESS': {
    id: 'UNAUTHORIZED_ACCESS',
    title: '2. Unauthorized Access Token Scan',
    category: 'ACCESS_CONTROL',
    description: 'Demonstrates access-control policy rejection of unregistered or cloned badges with automated alarm strobe feedback.',
    initialConditions: 'Perimeter and admin access readers in standby mode.',
    trigger: 'Unregistered credential swiped at Admin Building reader.',
    actors: ['RFID-ADMIN', 'ALARM-FACILITY'],
    expectedSequence: [
      'Cloned/unregistered token scanned at RFID-ADMIN',
      'Backend evaluates token -> Access DENIED',
      'Facility alarm warning strobe activates for 3 seconds',
      'Incident logged with cryptographically chained block'
    ],
    adminDecisions: ['Acknowledge warning alert', 'Investigate reader log'],
    possibleOutcomes: ['ACCESS_REJECTED_ALARM_ACTIVATED'],
    status: 'PASSING'
  },
  'DOOR_BREACH': {
    id: 'DOOR_BREACH',
    title: '3. Unexpected Cell Door Opening',
    category: 'SECURITY_BREACH',
    description: 'Demonstrates Rule B (magnetic reed switch opened without prior authorized RFID scan), generating an immediate breach incident.',
    initialConditions: 'Cell A-102 door closed and locked. Inmate Marcus Vance inside.',
    trigger: 'Reed switch REED-A102 spontaneously changes to OPEN.',
    actors: ['P-1044', 'REED-A102', 'PIR-CORR-A', 'OFC-514'],
    expectedSequence: [
      'REED-A102 contact breaks without authorization',
      'Inmate Marcus Vance steps into Block A corridor',
      'PIR-CORR-A motion sensor trips',
      'Rule B breach alert generated on Central Dashboard'
    ],
    adminDecisions: ['Acknowledge breach', 'Dispatch responding officer', 'Lockdown Block A'],
    possibleOutcomes: ['CONTAINED', 'ESCALATED'],
    status: 'PASSING'
  },
  'PERIMETER_ESCAPE': {
    id: 'PERIMETER_ESCAPE',
    title: '4. Perimeter Disturbance & Fence Tamper',
    category: 'SECURITY_BREACH',
    description: 'Demonstrates dual-sensor fusion (Rule D: Piezoelectric fence vibration > 2.4g combined with interrupted IR optical beam).',
    initialConditions: 'Perimeter fence vibration sensors and optical IR beams active.',
    trigger: 'Inmate moves toward East Perimeter fence line.',
    actors: ['P-1044', 'VIB-FENCE-E', 'IR-BEAM-E', 'ALARM-FACILITY', 'OFC-702'],
    expectedSequence: [
      'VIB-FENCE-E reports abnormal acceleration',
      'IR-BEAM-E optical path occluded',
      'Rule D critical perimeter escape alarm triggers',
      'Capt. Reyes dispatched to East Perimeter post'
    ],
    adminDecisions: ['Trigger facility lockdown', 'Dispatch perimeter patrol', 'Activate audio warning'],
    possibleOutcomes: ['PATROL_INTERCEPT', 'PERIMETER_BREACH'],
    status: 'PASSING'
  },
  'GATE_FAILURE': {
    id: 'GATE_FAILURE',
    title: '5. Gate Actuator Failure (Motor Jam)',
    category: 'ACTUATOR_FAULT',
    description: 'Simulates mechanical actuator obstruction during travel, causing drive motor current spike and failure to reach limit switch.',
    initialConditions: 'Gate 2 - South is OPEN.',
    trigger: 'Close command sent to GATE-02.',
    actors: ['GATE-02', 'ESP32-PERIM-02'],
    expectedSequence: [
      'Close command dispatched to Gate 2',
      'Drive motor engages then jams halfway',
      'Motor current reaches 2.1A (stall threshold)',
      'Rule E Actuator Fault incident raised on dashboard'
    ],
    adminDecisions: ['Dispatch maintenance crew', 'Override interlock', 'Emergency lock adjacent sally port gate'],
    possibleOutcomes: ['JAM_LOGGED_MAINTENANCE_REQUIRED'],
    status: 'PASSING'
  },
  'CONTROLLER_DISCONNECT': {
    id: 'CONTROLLER_DISCONNECT',
    title: '6. ESP32 Controller Loss (Cascading Failure)',
    category: 'NETWORK_FAULT',
    description: 'Simulates edge IoT controller hardware power cut, verifying telemetry timeout and cascading subordinate sensor status degradation.',
    initialConditions: 'ESP32-CELL-01 online with 9 subordinate sensors.',
    trigger: 'ESP32-CELL-01 powered down.',
    actors: ['ESP32-CELL-01', 'REED-A101', 'REED-A102', 'PIR-CORR-A'],
    expectedSequence: [
      'ESP32-CELL-01 heartbeats cease',
      'Subordinate reed contacts and PIR sensors marked OFFLINE',
      'Rule F controller loss critical alert generated',
      'Controller restored after inspection'
    ],
    adminDecisions: ['Reboot controller', 'Switch to backup power', 'Verify physical wiring'],
    possibleOutcomes: ['CONTROLLER_OFFLINE_ALERTS_RAISED'],
    status: 'PASSING'
  },
  'MEDICAL_DURESS': {
    id: 'MEDICAL_DURESS',
    title: '7. Medical Assistance Duress Trigger',
    category: 'HEALTHCARE',
    description: 'Simulates hardwired panic button activation in medical triage ward, verifying immediate priority notification and nurse response.',
    initialConditions: 'Medical Clinic operating with Nurse Rostova on duty.',
    trigger: 'DURESS-MED-01 panic button engaged.',
    actors: ['DURESS-MED-01', 'ESP32-MED-01', 'OFC-118', 'DOC-401'],
    expectedSequence: [
      'DURESS-MED-01 interrupt triggered',
      'Medical emergency notification sent to Central Control',
      'Officer Kim dispatches to Medical Ward Checkpoint',
      'Dr. Reed evaluates patient condition'
    ],
    adminDecisions: ['Acknowledge medical alert', 'Dispatch backup officer', 'Open isolation unit'],
    possibleOutcomes: ['MEDICAL_ASSISTANCE_DELIVERED'],
    status: 'PASSING'
  },
  'SECURITY_INCIDENT_RESPONSE': {
    id: 'SECURITY_INCIDENT_RESPONSE',
    title: '8. Central Spine Intrusion & Multi-Officer Intercept',
    category: 'TACTICAL_RESPONSE',
    description: 'Simulates restricted corridor motion detection with automated multi-officer tactical dispatch and interception.',
    initialConditions: 'Central Secure Spine restricted zone active.',
    trigger: 'Inmate David Chen enters Central Spine.',
    actors: ['P-2089', 'PIR-SPINE', 'OFC-514', 'ALARM-FACILITY'],
    expectedSequence: [
      'PIR-SPINE detects unauthorized presence in restricted spine',
      'Strobe alarm engages',
      'Lt. Sterling dispatched from North Corridor',
      'Lt. Sterling intercepts inmate and returns to cell'
    ],
    adminDecisions: ['Direct officer movement', 'Trigger sector lockdown', 'Issue PA announcement'],
    possibleOutcomes: ['INTRUSION_INTERCEPTED'],
    status: 'PASSING'
  },
  'SCENARIO_A_CCTV_ALERT': {
    id: 'SCENARIO_A_CCTV_ALERT',
    title: 'Demonstration A: CCTV Anomaly Detection & Officer Monitoring',
    category: 'DEMONSTRATION',
    description: 'Demonstrates end-to-end cause-and-effect: CCTV anomaly detection -> admin notification -> officer assigned to monitor -> suspicious activity suppressed -> behavior resumes upon departure.',
    initialConditions: 'Inmate David Chen (P-2089) in Common Yard. CAM-01 active with wide-angle FOV.',
    trigger: 'Simulation anomaly detector flags anomalous movement near restricted gate.',
    actors: ['P-2089', 'CAM-01', 'OFC-514', 'GATE-05'],
    expectedSequence: [
      'Inmate P-2089 exhibits suspicious pacing near restricted Yard Gate',
      'CAM-01 feed detects and highlights inmate in simulated viewport',
      'Administrator receives high-priority CCTV Anomaly alert',
      'Administrator assigns Officer Sterling (OFC-514) to monitor prisoner',
      'Officer Sterling radio-acknowledges and moves to observation post',
      'Inmate halts suspicious pacing under direct officer observation',
      'Officer leaves area; suspicious pacing resumes after configured cooldown'
    ],
    adminDecisions: ['Assign monitoring officer', 'Recall officer', 'Issue PA verbal warning'],
    possibleOutcomes: ['MONITORING_SUPPRESSED', 'RESUMED_ON_DEPARTURE'],
    status: 'PASSING'
  },
  'SCENARIO_B_ESCAPE_INTERVENTION': {
    id: 'SCENARIO_B_ESCAPE_INTERVENTION',
    title: 'Demonstration B: Escape Attempt & Administrator Intervention',
    category: 'DEMONSTRATION',
    description: 'Simulates a high-stakes escape attempt with an active 30-second simulation countdown, demonstrating contained vs uncontained escape outcomes based on administrator intervention.',
    initialConditions: 'Inmate Marcus Vance (P-1044) in Cell A-102. Officer Sterling in North Corridor.',
    trigger: 'Cell door A-102 opens; Vance begins rapid transit toward East Perimeter.',
    actors: ['P-1044', 'DOOR-A102', 'CAM-02', 'CAM-04', 'OFC-514', 'GATE-01'],
    expectedSequence: [
      'Marcus Vance breaches Cell A-102 and heads towards East Perimeter',
      'Door reed switch REED-A102 and Camera CAM-02 detect breach',
      'Dashboard displays 30-second intervention countdown',
      'Administrator can: Assign Intercept Officer, Close Door, Lock Perimeter Gate, or Lockdown',
      'If Intercepted in time: Officer Sterling detains Vance and escorts back to cell (CONTAINED)',
      'If Ignored / Timed out: Vance reaches perimeter fence and triggers breach alarm (ESCAPED)'
    ],
    adminDecisions: ['Dispatch Intercept Officer', 'Operate Door Interlock', 'Lock Perimeter Gate', 'Activate Full Lockdown'],
    possibleOutcomes: ['CONTAINED_BY_ADMIN_INTERVENTION', 'ESCAPED_DUE_TO_DELAYED_RESPONSE'],
    status: 'PASSING'
  },
  'SCENARIO_C_POWER_FAILURE': {
    id: 'SCENARIO_C_POWER_FAILURE',
    title: 'Demonstration C: Power Grid Disruption & Emergency Lockdown',
    category: 'DEMONSTRATION',
    description: 'Simulates facility power failure causing configured fail-secure vs fail-safe device states, followed by administrator emergency lockdown requiring admin-only authorization.',
    initialConditions: 'Facility fully powered. Perimeter gates secured.',
    trigger: 'Simulated power failure event injected.',
    actors: ['ALARM-FACILITY', 'DOOR-A101', 'DOOR-B101', 'GATE-01', 'GATE-02', 'OFC-702'],
    expectedSequence: [
      'Facility power grid failure injected',
      'Emergency lights and warning strobe engage',
      'Selected internal access doors transition to configured fail-safe unlatched states',
      'Perimeter gates stay fail-secure (CLOSED)',
      'Administrator initiates Emergency Lockdown',
      'Lockdown commands propagate to all controllers; confirmation telemetry audits all devices',
      'Officer attempted override of perimeter gates is DENIED (Admin Role Required)'
    ],
    adminDecisions: ['Activate Emergency Lockdown', 'Release Lockdown', 'Acknowledge Device Faults'],
    possibleOutcomes: ['LOCKDOWN_CONFIRMED', 'OVERRIDE_REJECTED'],
    status: 'PASSING'
  },
  'SCENARIO_D_COMPROMISED_OFFICER': {
    id: 'SCENARIO_D_COMPROMISED_OFFICER',
    title: 'Demonstration D: Insider Threat & RFID Credential Revocation',
    category: 'DEMONSTRATION',
    description: 'Demonstrates insider threat containment: an officer is flagged as compromised, administrator revokes their RFID credential, and subsequent access attempts are strictly rejected at actuators.',
    initialConditions: 'Officer Sterling (OFC-514) assigned to Block A. Badge CARD-OFC-514 active.',
    trigger: 'Insider threat anomaly detected during unauthorized inmate movement.',
    actors: ['OFC-514', 'RFID-BLOCK-A', 'DOOR-A101', 'OFC-702'],
    expectedSequence: [
      'Officer Sterling flagged as COMPROMISED following unauthorized protocol deviation',
      'Administrator receives high-priority Insider Threat alert',
      'Administrator selects Officer Sterling and chooses Revoke RFID Credential',
      'Backend updates card status to REVOKED and suspends officer from duty',
      'Officer Sterling attempts swipe at RFID-BLOCK-A -> Access strictly DENIED',
      'Door remains secured; denial logged in SHA-256 audit ledger',
      'Capt. Reyes dispatched to escort suspended officer'
    ],
    adminDecisions: ['Revoke RFID Credential', 'Suspend Officer', 'Dispatch Internal Affairs Escort'],
    possibleOutcomes: ['CREDENTIAL_REVOKED_ACCESS_DENIED'],
    status: 'PASSING'
  },
  'SCENARIO_E_CREDENTIAL_MISUSE': {
    id: 'SCENARIO_E_CREDENTIAL_MISUSE',
    title: 'Demonstration E: Credential Misuse & Inmate Containment',
    category: 'DEMONSTRATION',
    description: 'Demonstrates defensive access control when an inmate obtains a lost or stolen credential and attempts unauthorized exit.',
    initialConditions: 'Inmate Marcus Vance (P-1044) obtains dropped token CARD-DROPPED-991.',
    trigger: 'Inmate swipes stolen credential at Block A reader.',
    actors: ['P-1044', 'RFID-BLOCK-A', 'OFC-702', 'ALARM-FACILITY'],
    expectedSequence: [
      'Inmate Vance swipes stolen badge CARD-DROPPED-991 at RFID-BLOCK-A',
      'Backend evaluates token -> Access REJECTED (Unregistered / Revoked)',
      'Solenoid lock remains firmly engaged (LOCKED)',
      'Unauthorized access attempt alarm triggers at Central Control',
      'Capt. Reyes dispatched to Block A to contain and search inmate',
      'Inmate detained and badge confiscated'
    ],
    adminDecisions: ['Dispatch search officer', 'Review CCTV recording', 'Confirm door lock state'],
    possibleOutcomes: ['ATTEMPT_BLOCKED_INMATE_CONTAINED'],
    status: 'PASSING'
  },
  'SCENARIO_F_EXTERNAL_VISITOR': {
    id: 'SCENARIO_F_EXTERNAL_VISITOR',
    title: 'Demonstration F: External Investigator Arrival & Escort Authorization',
    category: 'DEMONSTRATION',
    description: 'Demonstrates the external visitor access management workflow: visitor arrival detection at outer perimeter -> administrator authorization -> sally port gate cycle -> officer escort to conference area.',
    initialConditions: 'Sally Port Outer Gate 2 closed. Officer Kim on guard at Sally Port.',
    trigger: 'Detective Sarah Lin arrives at South Sally Port Outer entrance.',
    actors: ['GATE-02', 'RFID-SALLY-OUT', 'OFC-118'],
    expectedSequence: [
      'Detective Sarah Lin (State Investigative Bureau) arrives at Gate 2',
      'Exterior optical presence detector registers arrival',
      'Administrator receives External Visitor Access Request notification',
      'Administrator verifies credentials and clicks Approve Entry',
      'Outer Sally Port Gate GATE-02 opens; visitor moves into inspection bay',
      'Officer Kim assigned to escort Detective Lin to Administration Conference Room',
      'Gate 2 closes and relocks safely'
    ],
    adminDecisions: ['Approve Visitor Entry', 'Deny Visitor Entry', 'Assign Escort Officer'],
    possibleOutcomes: ['VISITOR_AUTHORIZED_AND_ESCORTED', 'VISITOR_ENTRY_DENIED'],
    status: 'PASSING'
  }
};

// Aliases for short scenario keys
SCENARIO_REGISTRY['SCENARIO_A'] = SCENARIO_REGISTRY['SCENARIO_A_CCTV_ALERT'];
SCENARIO_REGISTRY['SCENARIO_B'] = SCENARIO_REGISTRY['SCENARIO_B_ESCAPE_INTERVENTION'];
SCENARIO_REGISTRY['SCENARIO_C'] = SCENARIO_REGISTRY['SCENARIO_C_POWER_FAILURE'];
SCENARIO_REGISTRY['SCENARIO_D'] = SCENARIO_REGISTRY['SCENARIO_D_COMPROMISED_OFFICER'];
SCENARIO_REGISTRY['SCENARIO_E'] = SCENARIO_REGISTRY['SCENARIO_E_CREDENTIAL_MISUSE'];
SCENARIO_REGISTRY['SCENARIO_F'] = SCENARIO_REGISTRY['SCENARIO_F_EXTERNAL_VISITOR'];

export class ScenarioRunner {
  constructor(engine) {
    this.engine = engine;
    this.activeScenarioId = null;
    this.isPaused = false;
    this.scenarioElapsedSec = 0;
    this.seed = 42;
    this.timeline = []; // [{ simOffsetSec, fn, label, executed }]
    this.scenarioState = {}; // arbitrary scenario scratchpad
  }

  getRegistry() {
    return SCENARIO_REGISTRY;
  }

  scheduleStep(simOffsetSec, fn, label = '') {
    this.timeline.push({
      simOffsetSec,
      fn,
      label,
      executed: false
    });
    // Keep timeline sorted chronologically
    this.timeline.sort((a, b) => a.simOffsetSec - b.simOffsetSec);
  }

  clear() {
    this.timeline = [];
    this.scenarioElapsedSec = 0;
    this.scenarioState = {};
    this.activeScenarioId = null;
    this.isPaused = false;
    this.engine.state.activeScenario = null;
    this.engine.state.scenarioElapsedSec = 0;
  }

  stop() {
    this.clear();
    this.engine.broadcastState();
  }

  reset() {
    this.stop();
    this.engine.resetToInitial();
  }

  pause() {
    this.isPaused = true;
    this.engine.broadcastState();
  }

  resume() {
    this.isPaused = false;
    this.engine.broadcastState();
  }

  // Called during engine.tick() when a scenario is active
  tick(simTimeStepSec = 1) {
    if (!this.activeScenarioId || this.isPaused) return;

    this.scenarioElapsedSec += simTimeStepSec;
    this.engine.state.scenarioElapsedSec = Math.round(this.scenarioElapsedSec);

    // Execute any steps whose scheduled offset has arrived
    for (const step of this.timeline) {
      if (!step.executed && this.scenarioElapsedSec >= step.simOffsetSec) {
        step.executed = true;
        try {
          step.fn();
        } catch (err) {
          console.error(`[ScenarioRunner] Error in step "${step.label}":`, err);
        }
      }
    }

    // Check if all steps have executed
    const allExecuted = this.timeline.every(s => s.executed);
    if (allExecuted && this.timeline.length > 0 && !this.scenarioState.hasConcluded) {
      this.scenarioState.hasConcluded = true;
      this.engine.addRecentActivity({
        event: `Scenario Completed: ${SCENARIO_REGISTRY[this.activeScenarioId]?.title || this.activeScenarioId}`,
        location: 'Facility Wide',
        status: 'NORMAL',
        color: 'green'
      });
    }
  }

  start(scenarioId, seed = 42) {
    this.stop();
    this.seed = seed;

    let normId = scenarioId;
    if (scenarioId === 'SCENARIO_A' || scenarioId === 'SCENARIO_A_CCTV_ALERT') normId = 'SCENARIO_A_CCTV_ALERT';
    else if (scenarioId === 'SCENARIO_B' || scenarioId === 'SCENARIO_B_ESCAPE_INTERVENTION') normId = 'SCENARIO_B_ESCAPE_INTERVENTION';
    else if (scenarioId === 'SCENARIO_C' || scenarioId === 'SCENARIO_C_POWER_FAILURE') normId = 'SCENARIO_C_POWER_FAILURE';
    else if (scenarioId === 'SCENARIO_D' || scenarioId === 'SCENARIO_D_COMPROMISED_OFFICER') normId = 'SCENARIO_D_COMPROMISED_OFFICER';
    else if (scenarioId === 'SCENARIO_E' || scenarioId === 'SCENARIO_E_CREDENTIAL_MISUSE') normId = 'SCENARIO_E_CREDENTIAL_MISUSE';
    else if (scenarioId === 'SCENARIO_F' || scenarioId === 'SCENARIO_F_EXTERNAL_VISITOR') normId = 'SCENARIO_F_EXTERNAL_VISITOR';

    this.activeScenarioId = normId;
    this.engine.state.activeScenario = normId;
    this.engine.state.scenarioSeed = seed;
    this.engine.state.scenarioElapsedSec = 0;
    this.scenarioElapsedSec = 0;
    this.scenarioState = { seed, startedAt: new Date().toISOString() };

    this.engine.addRecentActivity({
      event: `Scenario Started: ${SCENARIO_REGISTRY[normId]?.title || normId}`,
      location: 'Facility Wide',
      status: 'NORMAL',
      color: 'blue'
    });

    switch (normId) {
      case 'OFFICER_ENTRY':
        this.buildAuthorizedOfficerEntry();
        break;
      case 'UNAUTHORIZED_ACCESS':
        this.buildUnauthorizedAccess();
        break;
      case 'DOOR_BREACH':
        this.buildUnexpectedDoorBreach();
        break;
      case 'PERIMETER_ESCAPE':
        this.buildPerimeterEscape();
        break;
      case 'GATE_FAILURE':
        this.buildGateActuatorFailure();
        break;
      case 'CONTROLLER_DISCONNECT':
        this.buildControllerDisconnect();
        break;
      case 'MEDICAL_DURESS':
        this.buildMedicalDuress();
        break;
      case 'SECURITY_INCIDENT_RESPONSE':
        this.buildSecurityIncidentResponse();
        break;
      case 'SCENARIO_A_CCTV_ALERT':
        this.buildScenarioACctvAlert();
        break;
      case 'SCENARIO_B_ESCAPE_INTERVENTION':
        this.buildScenarioBEscapeIntervention();
        break;
      case 'SCENARIO_C_POWER_FAILURE':
        this.buildScenarioCPowerFailure();
        break;
      case 'SCENARIO_D_COMPROMISED_OFFICER':
        this.buildScenarioDCompromisedOfficer();
        break;
      case 'SCENARIO_E_CREDENTIAL_MISUSE':
        this.buildScenarioECredentialMisuse();
        break;
      case 'SCENARIO_F_EXTERNAL_VISITOR':
        this.buildScenarioFExternalVisitor();
        break;
      default:
        console.warn('[ScenarioRunner] Unknown scenario ID:', scenarioId, 'normalized as:', normId);
        break;
    }

    this.engine.broadcastState();
  }

  // --- Scenario 1: Authorized Officer Entry ---
  buildAuthorizedOfficerEntry() {
    this.scheduleStep(1, () => {
      this.engine.handleRfidScan({
        readerId: 'RFID-BLOCK-A',
        cardId: 'CARD-OFC-514',
        user: { username: 'OFC-514', role: 'OFFICER' }
      });
    }, 'Officer Scans RFID');

    this.scheduleStep(3, () => {
      this.engine.handleDoorCommand('LOCK-A101', 'UNLOCK');
      this.engine.handleSensorTrigger('REED-A101', 'OPEN');
    }, 'Door Unlocks & Opens');

    this.scheduleStep(5, () => {
      this.engine.movePersonTo('OFC-514', 'W_A_CORR_1');
    }, 'Officer Enters Corridor');

    this.scheduleStep(8, () => {
      this.engine.handleSensorTrigger('REED-A101', 'CLOSED');
      this.engine.handleDoorCommand('LOCK-A101', 'LOCK');
    }, 'Door Relocks Safely');
  }

  // --- Scenario 2: Unauthorized Access ---
  buildUnauthorizedAccess() {
    this.scheduleStep(1, () => {
      this.engine.handleRfidScan({
        readerId: 'RFID-ADMIN',
        cardId: 'CLONED-UNKNOWN-994',
        user: { username: 'UNKNOWN', role: 'NONE' }
      });
    }, 'Invalid Card Scanned');

    this.scheduleStep(3, () => {
      this.engine.handleSensorTrigger('ALARM-FACILITY', 'STROBE_ACTIVE');
    }, 'Warning Strobe Activates');
  }

  // --- Scenario 3: Unexpected Door Breach ---
  buildUnexpectedDoorBreach() {
    this.scheduleStep(1, () => {
      this.engine.handleSensorTrigger('REED-A102', 'OPEN');
    }, 'Reed Switch Opens');

    this.scheduleStep(3, () => {
      this.engine.movePersonTo('P-1044', 'W_A_CORR_2');
    }, 'Inmate Steps into Corridor');

    this.scheduleStep(5, () => {
      this.engine.handleSensorTrigger('PIR-CORR-A', 'DETECTED');
    }, 'Corridor PIR Trips');
  }

  // --- Scenario 4: Perimeter Escape ---
  buildPerimeterEscape() {
    this.scheduleStep(1, () => {
      this.engine.movePersonTo('P-1044', 'W_PERIM_EAST_N');
    }, 'Inmate Heads to Perimeter');

    this.scheduleStep(3, () => {
      this.engine.handleSensorTrigger('VIB-FENCE-E', 'TRIPPED');
    }, 'Fence Vibration Trips');

    this.scheduleStep(5, () => {
      this.engine.handleSensorTrigger('IR-BEAM-E', 'BROKEN');
    }, 'IR Beam Breaks');

    this.scheduleStep(7, () => {
      this.engine.handleSensorTrigger('ALARM-FACILITY', 'ALARM_CRITICAL');
      this.engine.movePersonTo('OFC-702', 'W_PERIM_EAST_S');
    }, 'Alarm Sirens & Officer Dispatch');
  }

  // --- Scenario 5: Gate Actuator Failure ---
  buildGateActuatorFailure() {
    this.scheduleStep(1, () => {
      this.engine.handleGateCommand('GATE-02', 'CLOSE');
    }, 'Gate Close Issued');

    this.scheduleStep(3, () => {
      this.engine.handleGateJam('GATE-02');
    }, 'Gate Jams Halfway');
  }

  // --- Scenario 6: Controller Disconnect ---
  buildControllerDisconnect() {
    this.scheduleStep(1, () => {
      this.engine.toggleControllerOnline('ESP32-CELL-01', false);
    }, 'Power Cut to ESP32-CELL-01');
  }

  // --- Scenario 7: Medical Duress ---
  buildMedicalDuress() {
    this.scheduleStep(1, () => {
      this.engine.handleSensorTrigger('DURESS-MED-01', 'PRESSED');
    }, 'Panic Button Pressed');

    this.scheduleStep(3, () => {
      this.engine.movePersonTo('OFC-118', 'W_MED_1');
    }, 'Officer Kim Dispatches to Clinic');
  }

  // --- Scenario 8: Security Incident Response ---
  buildSecurityIncidentResponse() {
    this.scheduleStep(1, () => {
      this.engine.movePersonTo('P-2089', 'W_CENTRAL_MID');
      this.engine.handleSensorTrigger('PIR-SPINE', 'DETECTED');
    }, 'Inmate Enters Central Spine');

    this.scheduleStep(3, () => {
      this.engine.handleSensorTrigger('ALARM-FACILITY', 'STROBE_ACTIVE');
      this.engine.movePersonTo('OFC-514', 'W_CENTRAL_TOP');
    }, 'Alarm Strobe & Officer Dispatches Down Spine');

    this.scheduleStep(6, () => {
      this.engine.movePersonTo('OFC-514', 'W_CENTRAL_MID');
    }, 'Officer Intercepts Inmate');
  }

  // --- Demonstration Scenario A: CCTV Alert and Officer Monitoring ---
  buildScenarioACctvAlert() {
    this.scheduleStep(1, () => {
      // Inmate David Chen exhibits suspicious loitering near restricted Yard Gate
      this.engine.triggerSuspiciousActivity({
        type: 'LOITERING_RESTRICTED_GATE',
        prisonerId: 'P-2089',
        location: 'Common Exercise Yard',
        detectionSource: 'CCTV_CAM_01 (Simulation-based Anomaly Detection)',
        severity: 'HIGH'
      });
      this.engine.movePersonTo('P-2089', 'W_YARD_GATE');
    }, 'Inmate Approaches Restricted Gate');

    this.scheduleStep(4, () => {
      // Prompt admin alert
      this.engine.addRecentActivity({
        event: 'CCTV Alert: CAM-01 Anomaly Detected near Yard Gate',
        location: 'Common Exercise Yard',
        status: 'WARNING',
        color: 'amber'
      });
    }, 'CCTV Anomaly Alert Raised');

    this.scheduleStep(8, () => {
      // Admin automatically or manually dispatches Officer Sterling
      this.engine.dispatchOfficerTask('OFC-514', {
        commandType: 'MONITOR_PRISONER',
        targetPersonId: 'P-2089',
        targetWaypointId: 'W_YARD_GATE',
        note: 'Investigate CAM-01 anomaly at Yard Gate and monitor inmate David Chen'
      });
    }, 'Officer Sterling Dispatched to Monitor');

    this.scheduleStep(15, () => {
      // Officer arrives; suspicious pacing suppressed
      const susp = this.engine.state.suspiciousActivities.find(s => s.targetPrisonerId === 'P-2089');
      if (susp) {
        susp.status = 'UNDER_OBSERVATION';
        susp.assignedOfficerId = 'OFC-514';
      }
      const chen = this.engine.state.people['P-2089'];
      if (chen) {
        chen.activity = 'Under Direct Officer Observation';
      }
    }, 'Suspicious Behavior Suppressed Under Observation');

    this.scheduleStep(22, () => {
      // Officer returns to post
      this.engine.dispatchOfficerTask('OFC-514', {
        commandType: 'RETURN_POST',
        targetWaypointId: 'W_NORTH_A',
        note: 'Observation concluded. Returning to North Corridor.'
      });
    }, 'Officer Concludes Monitoring & Returns to Post');
  }

  // --- Demonstration Scenario B: Escape Attempt & Admin Intervention ---
  buildScenarioBEscapeIntervention() {
    this.scheduleStep(1, () => {
      // Marcus Vance breaches Cell A-102
      this.engine.handleDoorLock('DOOR-A102', 'UNLOCK');
      this.engine.handleDoorOperate('DOOR-A102', 'OPEN');
      this.engine.triggerPrisonerEscape('P-1044', 'W_PERIM_EAST_N');
      this.scenarioState.escapeEscalationTimerSec = 30;
      this.scenarioState.isContained = false;

      this.engine.addRecentActivity({
        event: 'Critical: Marcus Vance Escape Attempt In Progress (30s Intervention Window)',
        location: 'Block A to East Perimeter',
        status: 'CRITICAL',
        color: 'red'
      });
    }, 'Vance Escapes Cell A-102');

    // Intervention Window: if admin dispatched officer, interception happens in tick.
    // If by 25s officer not dispatched, admin intervention fails and inmate completes escape at 30s.
    this.scheduleStep(25, () => {
      const vance = this.engine.state.people['P-1044'];
      const sterling = this.engine.state.people['OFC-514'];
      // Check if officer is actively intercepting or escorting
      if (sterling && (sterling.officerState === 'INTERCEPTING' || sterling.officerState === 'ESCORTING')) {
        this.scenarioState.isContained = true;
      } else {
        // Vance reaches East Perimeter
        if (vance && vance.status === 'ESCAPING') {
          vance.status = 'ESCAPED';
          vance.activity = 'ESCAPED – Outer Perimeter Fence Breached';
          this.engine.handleSensorTrigger('ALARM-FACILITY', 'ALARM_CRITICAL');
          this.engine.addRecentActivity({
            event: 'UNCONTAINED ESCAPE: Marcus Vance crossed East Perimeter!',
            location: 'East Perimeter Line',
            status: 'CRITICAL',
            color: 'red'
          });
        }
      }
    }, 'Intervention Window Closes');
  }

  // --- Demonstration Scenario C: Power Failure and Lockdown ---
  buildScenarioCPowerFailure() {
    this.scheduleStep(1, () => {
      // Power Grid Failure
      this.engine.handleSensorTrigger('ALARM-FACILITY', 'STROBE_ACTIVE');
      // Selected internal cell doors unlatch (fail-safe test scenario)
      this.engine.handleDoorLock('DOOR-A101', 'UNLOCK');
      this.engine.handleDoorLock('DOOR-B101', 'UNLOCK');

      this.engine.addRecentActivity({
        event: 'EMERGENCY: Facility Primary Power Grid Failure – Internal Doors Unlatched',
        location: 'Facility Wide',
        status: 'CRITICAL',
        color: 'red'
      });
    }, 'Power Failure Injected');

    this.scheduleStep(5, () => {
      // Inmates respond to disruption
      this.engine.movePersonTo('P-2089', 'W_B_CORR_2');
    }, 'Inmates Respond to Grid Disruption');

    this.scheduleStep(10, () => {
      // Admin activates facility emergency lockdown
      this.engine.activateLockdown({ username: 'ADMIN', role: 'ADMIN' });
    }, 'Admin Initiates Facility Emergency Lockdown');
  }

  // --- Demonstration Scenario D: Compromised Officer & RFID Revocation ---
  buildScenarioDCompromisedOfficer() {
    // Stage 1: Compromised officer designated
    this.scheduleStep(1, () => {
      const sterling = this.engine.state.people['OFC-514'];
      if (sterling) {
        sterling.availability = 'COMPROMISED';
        sterling.activity = 'Flagged: Unauthorized Movement Deviation';
      }
      this.engine.addRecentActivity({
        event: 'INSIDER THREAT DETECTED: Officer OFC-514 Flagged for Protocol Deviation',
        location: 'Block A Corridor',
        status: 'CRITICAL',
        color: 'red'
      });
      this.engine.logSimulationEvent({
        type: 'INSIDER_THREAT_DESIGNATED',
        sourceEntity: { id: 'OFC-514', name: 'Lt. Michael Sterling', type: 'OFFICER' },
        location: 'Block A Corridor',
        outcome: 'SUCCESS',
        details: { note: 'Stage 1: Officer OFC-514 flagged as compromised insider threat' }
      });
    }, '1. Officer Flagged Compromised');

    // Stage 2: Approaches Cell A-102 without authorized dispatch
    this.scheduleStep(4, () => {
      const sterling = this.engine.state.people['OFC-514'];
      if (sterling) {
        sterling.activity = 'Approaching Cell A-102 without Authorized Dispatch';
        this.engine.movePersonTo('OFC-514', 'W_A102');
      }
      this.engine.logSimulationEvent({
        type: 'UNAUTHORIZED_MOVEMENT_DETECTED',
        sourceEntity: { id: 'OFC-514', name: 'Lt. Michael Sterling', type: 'OFFICER' },
        location: 'Cell A-102 Doorway',
        outcome: 'SUCCESS',
        details: { note: 'Stage 2: Compromised officer moving toward Cell A-102' }
      });
    }, '2. Officer Approaches Cell A-102');

    // Stage 3: Tamper alert raised at administrator dashboard
    this.scheduleStep(8, () => {
      const incId = `INC-TAMPER-${Date.now().toString(36).toUpperCase()}`;
      const incident = {
        id: incId,
        title: 'Tamper Alert: Unauthorized Officer Proximity at Cell A-102',
        rule: 'RULE D: Insider Threat Protocol Deviation',
        severity: 'CRITICAL',
        location: 'Cell A-102',
        coordinates: { x: 340, y: 140 },
        associatedDevice: 'REED-A102',
        associatedPerson: 'OFC-514',
        status: 'ACTIVE',
        acknowledgedBy: null,
        resolvedBy: null,
        timestamp: new Date().toISOString(),
        evidence: [
          'Officer OFC-514 in direct proximity to Cell A-102 with zero active dispatch orders',
          'Access control proximity warning tripped at RFID-BLOCK-A'
        ]
      };
      this.engine.state.incidents.unshift(incident);
      this.engine.addRecentActivity({
        event: 'CRITICAL TAMPER ALERT: Unauthorized Cell Proximity by OFC-514',
        location: 'Cell A-102',
        status: 'CRITICAL',
        color: 'red'
      });
      this.engine.broadcastEvent('incident:created', incident);
      this.engine.logSimulationEvent({
        type: 'TAMPER_ALERT_RAISED',
        sourceEntity: { id: 'OFC-514', name: 'Lt. Michael Sterling', type: 'OFFICER' },
        location: 'Cell A-102',
        incidentId: incId,
        outcome: 'SUCCESS',
        details: { note: 'Stage 3: Tamper alert active on administrator dashboard' }
      });
      this.engine.broadcastState();
    }, '3. Tamper Alert Raised');

    // Stage 4: Administrator revokes credential
    this.scheduleStep(12, () => {
      this.engine.revokeOfficerCredential('OFC-514', { username: 'ADMIN', role: 'ADMIN' });
      this.engine.logSimulationEvent({
        type: 'CREDENTIAL_REVOKED',
        sourceEntity: { id: 'ADMIN', type: 'USER' },
        targetEntity: { id: 'OFC-514', name: 'Lt. Michael Sterling', type: 'OFFICER' },
        location: 'Central Control SOC',
        outcome: 'SUCCESS',
        details: { note: 'Stage 4: Administrator revoked RFID badge CARD-OFC-514' }
      });
    }, '4. Admin Revokes Credential');

    // Stage 5: Administrator marks officer suspended
    this.scheduleStep(15, () => {
      this.engine.suspendOfficer('OFC-514', { username: 'ADMIN', role: 'ADMIN' });
      this.engine.logSimulationEvent({
        type: 'OFFICER_SUSPENDED',
        sourceEntity: { id: 'ADMIN', type: 'USER' },
        targetEntity: { id: 'OFC-514', name: 'Lt. Michael Sterling', type: 'OFFICER' },
        location: 'Central Control SOC',
        outcome: 'SUCCESS',
        details: { note: 'Stage 5: Officer marked SUSPENDED in authoritative registry' }
      });
    }, '5. Officer Suspended');

    // Stage 6: Officer attempts door open; rejected with visible failure indicator
    this.scheduleStep(18, () => {
      const scanRes = this.engine.handleRfidScan({
        readerId: 'RFID-BLOCK-A',
        cardId: 'CARD-OFC-514',
        user: { username: 'OFC-514', role: 'OFFICER' }
      });
      this.engine.logSimulationEvent({
        type: 'UNAUTHORIZED_ACCESS_REJECTED',
        sourceEntity: { id: 'OFC-514', name: 'Lt. Michael Sterling', type: 'OFFICER' },
        location: 'Block A Entrance Reader',
        outcome: 'BLOCKED',
        details: { scanResult: scanRes?.result || 'DENIED', note: 'Stage 6: Solenoid remains firmly locked; swipe denied' }
      });
    }, '6. Access Attempt Rejected');

    // Stage 7: Captain Reyes dispatched to contain officer
    this.scheduleStep(22, () => {
      this.engine.dispatchOfficerTask('OFC-702', {
        commandType: 'RESPOND_DOOR_ALARM',
        targetWaypointId: 'W_A102',
        note: 'Contain and detain suspended officer OFC-514 at Cell A-102'
      });
      this.engine.logSimulationEvent({
        type: 'CONTAINMENT_DISPATCHED',
        sourceEntity: { id: 'OFC-702', name: 'Capt. John Reyes', type: 'OFFICER' },
        targetEntity: { id: 'OFC-514', name: 'Lt. Michael Sterling', type: 'OFFICER' },
        location: 'East Perimeter to Block A',
        outcome: 'SUCCESS',
        details: { note: 'Stage 7: Capt. Reyes responding to detain suspended officer' }
      });
    }, '7. Reyes Dispatched to Contain');

    // Stage 8: Reyes detains compromised officer; state transitions to SUSPENDED, escorted out
    this.scheduleStep(28, () => {
      const sterling = this.engine.state.people['OFC-514'];
      const reyes = this.engine.state.people['OFC-702'];
      if (sterling) {
        sterling.officerState = 'SUSPENDED';
        sterling.activity = 'Detained & Escorted by Capt. Reyes to SOC Holding';
        this.engine.movePersonTo('OFC-514', 'W_CONTROL_1');
      }
      if (reyes) {
        reyes.officerState = 'ESCORTING_PRISONER';
        reyes.activity = 'Escorting Suspended Officer OFC-514 to SOC Holding';
        reyes.messageBubble = {
          text: 'Central, OFC-514 detained and disarmed. Escorting to SOC holding bay.',
          expiresAt: Date.now() + 8000,
          type: 'RADIO'
        };
        this.engine.movePersonTo('OFC-702', 'W_CONTROL_1');
      }

      this.engine.addRecentActivity({
        event: 'RESOLVED: Compromised Officer OFC-514 Detained by Capt. Reyes',
        location: 'Control Room SOC',
        status: 'NORMAL',
        color: 'green'
      });

      this.engine.logSimulationEvent({
        type: 'INSIDER_THREAT_CONTAINED',
        sourceEntity: { id: 'OFC-702', name: 'Capt. John Reyes', type: 'OFFICER' },
        targetEntity: { id: 'OFC-514', name: 'Lt. Michael Sterling', type: 'OFFICER' },
        location: 'Control Room SOC',
        previousState: 'COMPROMISED',
        newState: 'SUSPENDED',
        outcome: 'SUCCESS',
        details: { note: 'Stage 8: Compromised officer fully contained and disarmed; scenario resolved.' }
      });
      this.engine.broadcastState();
    }, '8. Reyes Detains Compromised Officer');
  }

  // --- Demonstration Scenario E: Credential Misuse & Inmate Containment ---
  buildScenarioECredentialMisuse() {
    this.scheduleStep(1, () => {
      // Inmate Marcus Vance obtains lost credential CARD-DROPPED-991
      const vance = this.engine.state.people['P-1044'];
      if (vance) {
        vance.activity = 'Possession of Illicit Access Token';
      }
      this.engine.addRecentActivity({
        event: 'Security Anomaly: Unregistered RFID Token Reported in Block A',
        location: 'Block A Entrance',
        status: 'WARNING',
        color: 'amber'
      });
    }, 'Inmate Obtains Token');

    this.scheduleStep(4, () => {
      // Inmate attempts swipe at RFID-BLOCK-A
      this.engine.handleRfidScan({
        readerId: 'RFID-BLOCK-A',
        cardId: 'CARD-DROPPED-991',
        user: { username: 'P-1044', role: 'NONE' }
      });
    }, 'Inmate Swipe Denied');

    this.scheduleStep(8, () => {
      // Officer Reyes dispatched to contain and search inmate
      this.engine.dispatchOfficerTask('OFC-702', {
        commandType: 'MONITOR_PRISONER',
        targetPersonId: 'P-1044',
        targetWaypointId: 'W_A_CORR_2',
        note: 'Search and contain inmate P-1044 following unauthorized credential presentation.'
      });
    }, 'Officer Reyes Dispatched to Search Inmate');
  }

  // --- Demonstration Scenario F: External Visitor Arrival & Escort ---
  buildScenarioFExternalVisitor() {
    this.scheduleStep(1, () => {
      // Detective Sarah Lin arrives at Gate 2 Outer Sally Port
      this.engine.triggerVisitorArrival({
        visitorId: 'VIS-881',
        name: 'Detective Sarah Lin',
        category: 'INVESTIGATOR',
        organization: 'State Investigative Bureau',
        purpose: 'Formal Custodial Inspection & Case File Review',
        arrivalLocation: 'South Sally Port Outer Gate (Gate 2)'
      });
    }, 'Detective Sarah Lin Arrives');

    this.scheduleStep(6, () => {
      // Admin approves entry
      this.engine.handleVisitorDecision('VIS-881', 'APPROVE', { username: 'ADMIN', role: 'ADMIN' });
    }, 'Admin Approves Visitor Entry');

    this.scheduleStep(12, () => {
      // Visitor escorted to Admin Conference Room
      const visitor = this.engine.state.externalVisitors.find(v => v.id === 'VIS-881');
      if (visitor) {
        visitor.status = 'IN_CONFERENCE';
        visitor.location = 'Administration Conference Room';
      }
      this.engine.addRecentActivity({
        event: 'Visitor Escort Complete: Detective Lin arrived at Admin Conference Room',
        location: 'Administration Building',
        status: 'NORMAL',
        color: 'green'
      });
    }, 'Visitor Escorted to Conference Room');
  }
}
