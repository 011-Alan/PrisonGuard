/**
 * ==============================================================================
 * PrisonGuard — Simulated ESP32 Hardware Controller Runner
 * ==============================================================================
 *
 * This script runs a complete software emulation of the ESP32 Cell A-101 Door Controller.
 * It connects to the PrisonGuard backend via authenticated HTTP REST endpoints,
 * publishes heartbeats, polls for commands, simulates servo physical transit time,
 * triggers reed contact switch events, and simulates RFID badge presentation.
 *
 * Usage:
 *   node server/scripts/simulate-esp32.js
 *   node server/scripts/simulate-esp32.js --url http://localhost:5000 --token pg-hw-secret-token-esp32-demo
 *
 * Interactive Controls (when running):
 *   Press [o] + Enter: Manually pull physical door open (Reed switch OPEN)
 *   Press [c] + Enter: Manually close physical door (Reed switch CLOSED)
 *   Press [s] + Enter: Present authorized officer badge (CARD-OFC-514)
 *   Press [r] + Enter: Present revoked badge (CARD-REVOKED-999)
 *   Press [h] + Enter: Force instant heartbeat ping
 *   Press [q] + Enter: Disconnect & exit simulator
 * ==============================================================================
 */

const readline = require('readline');

// Command line argument parser
const args = process.argv.slice(2);
let serverUrl = process.env.PRISONGUARD_SERVER_URL || 'http://localhost:5000';
let deviceToken = process.env.HARDWARE_DEVICE_TOKEN || 'pg-hw-secret-token-esp32-demo';
const controllerId = 'ESP32-CELL-01';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    serverUrl = args[i + 1];
    i++;
  } else if (args[i] === '--token' && args[i + 1]) {
    deviceToken = args[i + 1];
    i++;
  }
}

// Remove trailing slash if present
serverUrl = serverUrl.replace(/\/+$/, '');

// Simulated Hardware State
let simulatedServoAngle = 0;        // 0 deg = Closed, 90 deg = Open
let simulatedDoorState = 'CLOSED';   // 'CLOSED' | 'OPEN'
let simulatedReedSwitch = 'CLOSED';  // 'CLOSED' | 'OPEN'
let isActuating = false;
let running = true;

const startTime = Date.now();

// Terminal colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const magenta = '\x1b[35m';
const reset = '\x1b[0m';
const bold = '\x1b[1m';

function log(tag, msg, color = cyan) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] ${color}${bold}[${tag}]${reset} ${msg}`);
}

// Helper: Make authenticated HTTP requests
async function apiRequest(endpoint, method = 'GET', body = null) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Device-Token': deviceToken,
      'X-Controller-Id': controllerId
    };

    const res = await fetch(`${serverUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

// 1. Send Heartbeat Telemetry
async function sendHeartbeat() {
  const payload = {
    controllerId,
    doorState: simulatedDoorState,
    servoAngle: simulatedServoAngle,
    reedSwitch: simulatedReedSwitch,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    wifiRssi: -58,
    freeHeap: 184200,
    isSimulated: true
  };

  const res = await apiRequest('/api/hardware/heartbeat', 'POST', payload);
  if (res.ok) {
    log('HEARTBEAT', `Telemetry synced: Door=${simulatedDoorState}, Servo=${simulatedServoAngle}°, Reed=${simulatedReedSwitch}`, green);
  } else {
    log('HEARTBEAT', `Heartbeat failed: ${res.error || res.status}`, red);
  }
}

// 2. Report Hardware Event
async function reportEvent(type, details) {
  const payload = {
    type,
    controllerId,
    details
  };

  const res = await apiRequest('/api/hardware/events', 'POST', payload);
  if (res.ok) {
    log('EVENT', `Dispatched ${type}: ${JSON.stringify(details)}`, magenta);
  } else {
    log('EVENT', `Event report failed: ${res.error || res.status}`, red);
  }
}

// 3. Command Polling & Actuation
async function pollCommands() {
  if (isActuating) return;

  const res = await apiRequest('/api/hardware/commands/poll', 'GET');
  if (res.ok && res.data && res.data.hasCommand) {
    const cmd = res.data.command;
    log('COMMAND', `Received command [${cmd.id}]: ${cmd.type} -> Action=${cmd.payload?.action}`, yellow);

    const action = cmd.payload?.action;
    if (action === 'OPEN' || action === 'CLOSE') {
      isActuating = true;
      log('SERVO', `Starting physical servo rotation towards ${action}...`, cyan);

      // Simulate transit delay (350ms)
      setTimeout(async () => {
        if (action === 'OPEN') {
          simulatedServoAngle = 90;
          simulatedDoorState = 'OPEN';
          simulatedReedSwitch = 'OPEN';
        } else {
          simulatedServoAngle = 0;
          simulatedDoorState = 'CLOSED';
          simulatedReedSwitch = 'CLOSED';
        }

        isActuating = false;
        log('SERVO', `Actuation complete: Angle=${simulatedServoAngle}°, State=${simulatedDoorState}`, green);

        // Acknowledge command completion
        const ackRes = await apiRequest(`/api/hardware/commands/${cmd.id}/ack`, 'POST', {
          status: 'SUCCESS',
          servoAngle: simulatedServoAngle,
          observedState: simulatedDoorState
        });

        if (ackRes.ok) {
          log('ACK', `Command ${cmd.id} acknowledged`, green);
        }

        // Report state change event
        await reportEvent('PHYSICAL_DOOR_STATE_CHANGED', {
          doorId: 'DOOR-A101-PHYSICAL',
          reedState: simulatedReedSwitch,
          servoAngle: simulatedServoAngle,
          triggeredBy: 'SERVO_ACTUATION'
        });
      }, 350);
    }
  }
}

// 4. Present Simulated RFID Card
async function scanRfidCard(cardId, description) {
  log('RFID', `Presenting badge [${cardId}] (${description}) to RC522 reader...`, magenta);

  const res = await apiRequest('/api/hardware/rfid/scan', 'POST', {
    cardId,
    uid: cardId,
    readerId: 'RFID-RC522-01',
    location: 'Cell Block A (A-101)'
  });

  if (res.ok && res.data) {
    const { accessGranted, decision, reason, holder } = res.data;
    if (accessGranted) {
      log('ACCESS', `ACCESS GRANTED! Authorized for ${holder?.name || 'Staff'}. Opening door.`, green);
      // Auto open door
      simulatedServoAngle = 90;
      simulatedDoorState = 'OPEN';
      simulatedReedSwitch = 'OPEN';
      await reportEvent('PHYSICAL_DOOR_STATE_CHANGED', {
        doorId: 'DOOR-A101-PHYSICAL',
        reedState: 'OPEN',
        servoAngle: 90,
        triggeredBy: 'RFID_ACCESS_GRANTED'
      });
    } else {
      log('ACCESS', `ACCESS DENIED! Decision: ${decision} (${reason})`, red);
    }
  } else {
    log('RFID', `Scan failed: ${res.error || res.status}`, red);
  }
}

// Banner & CLI Initialization
console.log(`
${cyan}${bold}=================================================================
  PrisonGuard — ESP32 Cell Door Hardware Simulator
=================================================================${reset}
  Controller ID:  ${bold}${controllerId}${reset}
  Target Backend: ${bold}${serverUrl}${reset}
  Simulated Door: ${bold}DOOR-A101-PHYSICAL${reset} (Bound to software DOOR-A101)

  Interactive keys:
    [o] + Enter : Manually open physical door (Reed = OPEN)
    [c] + Enter : Manually close physical door (Reed = CLOSED)
    [s] + Enter : Scan Authorized Officer Badge (CARD-OFC-514)
    [r] + Enter : Scan Revoked Badge (CARD-REVOKED-999)
    [h] + Enter : Force instant Heartbeat
    [q] + Enter : Quit
=================================================================
`);

// Interactive Readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  const input = line.trim().toLowerCase();
  switch (input) {
    case 'o':
      simulatedDoorState = 'OPEN';
      simulatedReedSwitch = 'OPEN';
      log('MANUAL', 'Physical door opened manually. Reed switch triggered: OPEN', yellow);
      await reportEvent('PHYSICAL_DOOR_STATE_CHANGED', {
        doorId: 'DOOR-A101-PHYSICAL',
        reedState: 'OPEN',
        servoAngle: simulatedServoAngle,
        triggeredBy: 'MANUAL_PHYSICAL_DISPLACEMENT'
      });
      break;

    case 'c':
      simulatedDoorState = 'CLOSED';
      simulatedReedSwitch = 'CLOSED';
      log('MANUAL', 'Physical door closed manually. Reed switch triggered: CLOSED', yellow);
      await reportEvent('PHYSICAL_DOOR_STATE_CHANGED', {
        doorId: 'DOOR-A101-PHYSICAL',
        reedState: 'CLOSED',
        servoAngle: simulatedServoAngle,
        triggeredBy: 'MANUAL_PHYSICAL_DISPLACEMENT'
      });
      break;

    case 's':
      await scanRfidCard('CARD-OFC-514', 'Officer J. Miller');
      break;

    case 'r':
      await scanRfidCard('CARD-REVOKED-999', 'Revoked Security Badge');
      break;

    case 'h':
      await sendHeartbeat();
      break;

    case 'q':
      log('SHUTDOWN', 'Stopping simulated ESP32 controller...', yellow);
      running = false;
      rl.close();
      process.exit(0);
      break;

    default:
      console.log('Commands: [o]pen, [c]lose, [s]can valid badge, [r]evoked badge, [h]eartbeat, [q]uit');
  }
});

// Periodic Timers
sendHeartbeat();
const heartbeatTimer = setInterval(() => {
  if (running) sendHeartbeat();
}, 4000);

const pollTimer = setInterval(() => {
  if (running) pollCommands();
}, 1000);

process.on('SIGINT', () => {
  log('SHUTDOWN', 'Exiting simulator.', yellow);
  clearInterval(heartbeatTimer);
  clearInterval(pollTimer);
  process.exit(0);
});
