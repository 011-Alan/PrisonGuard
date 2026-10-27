export class ScenarioRunner {
  constructor(engine) {
    this.engine = engine;
    this.activeScenarioId = null;
    this.stepIndex = 0;
    this.timers = [];
    this.isPaused = false;
  }

  clearAllTimers() {
    for (const t of this.timers) {
      clearTimeout(t);
    }
    this.timers = [];
  }

  stop() {
    this.clearAllTimers();
    this.activeScenarioId = null;
    this.stepIndex = 0;
    this.isPaused = false;
    this.engine.state.activeScenario = null;
    this.engine.broadcastState();
  }

  reset() {
    this.stop();
    this.engine.resetToInitial();
  }

  schedule(fn, delayMs) {
    const timer = setTimeout(() => {
      if (!this.isPaused) {
        fn();
      }
    }, delayMs);
    this.timers.push(timer);
    return timer;
  }

  start(scenarioId) {
    this.stop();
    this.activeScenarioId = scenarioId;
    this.engine.state.activeScenario = scenarioId;
    this.engine.broadcastState();

    switch (scenarioId) {
      case 'OFFICER_ENTRY':
        this.runAuthorizedOfficerEntry();
        break;
      case 'UNAUTHORIZED_ACCESS':
        this.runUnauthorizedAccess();
        break;
      case 'DOOR_BREACH':
        this.runUnexpectedDoorBreach();
        break;
      case 'PERIMETER_ESCAPE':
        this.runPerimeterEscape();
        break;
      case 'GATE_FAILURE':
        this.runGateActuatorFailure();
        break;
      case 'CONTROLLER_DISCONNECT':
        this.runControllerDisconnect();
        break;
      case 'MEDICAL_DURESS':
        this.runMedicalDuress();
        break;
      case 'SECURITY_INCIDENT_RESPONSE':
        this.runSecurityIncidentResponse();
        break;
      default:
        console.warn('Unknown scenario:', scenarioId);
        break;
    }
  }

  // 1. Authorized Officer Entry
  runAuthorizedOfficerEntry() {
    this.schedule(() => {
      // Step 1: Officer OFC-514 presents badge at Block A Entrance
      this.engine.handleRfidScan({
        readerId: 'RFID-BLOCK-A',
        cardId: 'CARD-OFC-514',
        user: { username: 'OFC-514', role: 'OFFICER' }
      });
    }, 1000);

    this.schedule(() => {
      // Step 2: Unlock and open Cell A-101
      this.engine.handleDoorCommand('LOCK-A101', 'UNLOCK');
      this.engine.handleSensorTrigger('REED-A101', 'OPEN');
    }, 3000);

    this.schedule(() => {
      // Step 3: Officer walks into Block A corridor
      this.engine.movePersonTo('OFC-514', 'W_A_CORR_1');
    }, 4500);

    this.schedule(() => {
      // Step 4: Door closes and locks safely
      this.engine.handleSensorTrigger('REED-A101', 'CLOSED');
      this.engine.handleDoorCommand('LOCK-A101', 'LOCK');
      this.stop();
    }, 7500);
  }

  // 2. Unauthorized Access Attempt
  runUnauthorizedAccess() {
    this.schedule(() => {
      // Step 1: Invalid card swiped at Admin Building
      this.engine.handleRfidScan({
        readerId: 'RFID-ADMIN',
        cardId: 'CLONED-UNKNOWN-994',
        user: { username: 'UNKNOWN', role: 'NONE' }
      });
    }, 1000);

    this.schedule(() => {
      // Step 2: Security strobe warning
      this.engine.handleSensorTrigger('ALARM-FACILITY', 'STROBE_ACTIVE');
    }, 2500);

    this.schedule(() => {
      this.stop();
    }, 5000);
  }

  // 3. Unexpected Door Opening
  runUnexpectedDoorBreach() {
    this.schedule(() => {
      // Step 1: Reed switch on Cell A-102 opens spontaneously without RFID authorization
      this.engine.handleSensorTrigger('REED-A102', 'OPEN');
    }, 1000);

    this.schedule(() => {
      // Step 2: Prisoner Marcus Vance (P-1044) steps into Block A corridor
      this.engine.movePersonTo('P-1044', 'W_A_CORR_2');
    }, 2500);

    this.schedule(() => {
      // Step 3: Block A PIR trips
      this.engine.handleSensorTrigger('PIR-CORR-A', 'DETECTED');
    }, 4000);

    this.schedule(() => {
      this.stop();
    }, 7000);
  }

  // 4. Perimeter Disturbance / Escape
  runPerimeterEscape() {
    this.schedule(() => {
      // Step 1: Prisoner P-1044 moves toward perimeter
      this.engine.movePersonTo('P-1044', 'W_PERIM_EAST_N');
    }, 1000);

    this.schedule(() => {
      // Step 2: Vibration sensor on East Fence trips
      this.engine.handleSensorTrigger('VIB-FENCE-E', 'TRIPPED');
    }, 3000);

    this.schedule(() => {
      // Step 3: Infrared optical beam breaks concurrently
      this.engine.handleSensorTrigger('IR-BEAM-E', 'BROKEN');
    }, 4500);

    this.schedule(() => {
      // Step 4: Facility Alarm sirens engage
      this.engine.handleSensorTrigger('ALARM-FACILITY', 'ALARM_CRITICAL');
      // Officer OFC-702 responds
      this.engine.movePersonTo('OFC-702', 'W_PERIM_EAST_S');
      this.stop();
    }, 6500);
  }

  // 5. Gate Actuator Failure (Gate Jam)
  runGateActuatorFailure() {
    this.schedule(() => {
      // Step 1: Issue close command to Gate 2 - South
      this.engine.handleGateCommand('GATE-02', 'CLOSE');
    }, 1000);

    this.schedule(() => {
      // Step 2: Gate begins closing then jams halfway!
      this.engine.handleGateJam('GATE-02');
    }, 3000);

    this.schedule(() => {
      this.stop();
    }, 6000);
  }

  // 6. Controller Disconnection
  runControllerDisconnect() {
    this.schedule(() => {
      // Disconnect ESP32-CELL-01
      this.engine.toggleControllerOnline('ESP32-CELL-01', false);
    }, 1500);

    this.schedule(() => {
      this.stop();
    }, 5000);
  }

  // 7. Medical Duress Request
  runMedicalDuress() {
    this.schedule(() => {
      this.engine.handleSensorTrigger('DURESS-MED-01', 'PRESSED');
    }, 1000);

    this.schedule(() => {
      // Officer OFC-118 dispatches to medical ward
      this.engine.movePersonTo('OFC-118', 'W_MED_1');
      this.stop();
    }, 3500);
  }

  // 8. Security Incident and Officer Response
  runSecurityIncidentResponse() {
    this.schedule(() => {
      // Prisoner P-2089 leaves cell towards yard
      this.engine.movePersonTo('P-2089', 'W_CENTRAL_MID');
      this.engine.handleSensorTrigger('PIR-SPINE', 'DETECTED');
    }, 1000);

    this.schedule(() => {
      // Central alarm alerts
      this.engine.handleSensorTrigger('ALARM-FACILITY', 'STROBE_ACTIVE');
      // Officer OFC-514 dispatches down spine
      this.engine.movePersonTo('OFC-514', 'W_CENTRAL_TOP');
    }, 3000);

    this.schedule(() => {
      // Officer intercepts in Central Spine
      this.engine.movePersonTo('OFC-514', 'W_CENTRAL_MID');
      this.stop();
    }, 6000);
  }
}
