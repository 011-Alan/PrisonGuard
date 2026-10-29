/**
 * ==============================================================================
 * PrisonGuard — Simulated ESP32 Hardware Controller Runner
 * ==============================================================================
 *
 * This script runs a complete software emulation of the ESP32 Cell A-101 Door Controller.
 * It connects to the PrisonGuard backend via authenticated HTTP REST endpoints,
 * publishes heartbeats, polls for commands, simulates SG90 servo transit,
 * updates LED states, and simulates contactless RFID badge presentations.
 *
 * Usage:
 *   node server/scripts/simulate-esp32.js
 *   node server/scripts/simulate-esp32.js --url http://localhost:5000 --token pg-hw-secret-token-esp32-demo
 *
 * Interactive Controls (when running):
 *   Press [o] + Enter: Command door OPEN (Servo 90°, Green LED)
 *   Press [c] + Enter: Command door CLOSED (Servo 0°, Red LED)
 *   Press [s] + Enter: Present authorized officer badge (CARD-OFC-514)
 *   Press [r] + Enter: Present revoked badge (CARD-REVOKED-999)
 *   Press [u] + Enter: Present unknown visitor badge (CARD-UNKNOWN-777)
 *   Press [h] + Enter: Force instant heartbeat ping
 *   Press [q] + Enter: Disconnect & exit simulator
 * ==============================================================================
 */

import readline from 'readline';

// Command line argument parser
const args = process.argv.slice(2);
let serverUrl = process.env.PRISONGUARD_SERVER_URL || 'http://localhost:5000';
let deviceToken = process.env.HARDWARE_DEVICE_TOKEN || 'pg-hw-secret-token-esp32-demo';
let controllerId = process.env.HARDWARE_CONTROLLER_ID || 'CELL-01-PHYSICAL';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    serverUrl = args[i + 1];
    i++;
  } else if (args[i] === '--token' && args[i + 1]) {
    deviceToken = args[i + 1];
    i++;
  } else if (args[i] === '--id' && args[i + 1]) {
    controllerId = args[i + 1];
    i++;
  }
}

// Remove trailing slash if present
serverUrl = serverUrl.replace(/\/+$/, '');

// Simulated Hardware State
let simulatedServoAngle = 0;        // 0 deg = Closed, 90 deg = Open
let commandedDoorState = 'CLOSED';   // 'CLOSED' | 'OPEN'
let redLedState = 'ON';
let greenLedState = 'OFF';
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
    doorState: commandedDoorState,
    commandedState: commandedDoorState,
    servoAngle: simulatedServoAngle,
    positionVerified: false,
    positionNote: 'Commanded state only (simulated prototype)',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    wifiRssi: -58,
    freeHeap: 184200,
    isSimulated: true
  };

  const res = await apiRequest('/api/hardware/heartbeat', 'POST', payload);
  if (res.ok) {
    log('HEARTBEAT', `Telemetry synced: State=${commandedDoorState}, Servo=${simulatedServoAngle}°, RedLED=${redLedState}, GreenLED=${greenLedState}`, green);
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

  const res = await apiRequest(`/api/hardware/commands/poll?controllerId=${controllerId}`, 'GET');
  if (res.ok && res.data && res.data.hasCommand) {
    const cmd = res.data.command;
    log('COMMAND', `Received command [${cmd.id}]: ${cmd.type} -> Action=${cmd.payload?.action}`, yellow);

    const action = cmd.payload?.action;
    if (action === 'OPEN' || action === 'CLOSE') {
      isActuating = true;
      log('SERVO', `Starting SG90 physical servo rotation towards ${action}...`, cyan);

      // Simulate transit delay (350ms)
      setTimeout(async () => {
        if (action === 'OPEN') {
          simulatedServoAngle = 90;
          commandedDoorState = 'OPEN';
          redLedState = 'OFF';
          greenLedState = 'ON';
        } else {
          simulatedServoAngle = 0;
          commandedDoorState = 'CLOSED';
          redLedState = 'ON';
          greenLedState = 'OFF';
        }

        isActuating = false;
        log('SERVO', `Rotation complete! Servo=${simulatedServoAngle}°, Commanded=${commandedDoorState}`, green);

        // Acknowledge command execution
        const ackPayload = {
          commandId: cmd.id,
          controllerId,
          status: 'SUCCESS',
          servoAngle: simulatedServoAngle,
          commandedState: commandedDoorState
        };

        const ackRes = await apiRequest(`/api/hardware/commands/${cmd.id}/ack`, 'POST', ackPayload);
        if (ackRes.ok) {
          log('ACK', `Command ${cmd.id} acknowledged successfully`, green);
        } else {
          log('ACK', `Failed to acknowledge command: ${ackRes.status}`, red);
        }
      }, 350);
    }
  }
}

// 4. RFID Badge Scan Simulation
async function simulateRfidScan(cardUid) {
  log('RFID', `Presenting card UID: ${cardUid} to RC522 reader...`, magenta);

  const scanPayload = {
    cardUid,
    readerId: 'RFID-RC522-01',
    location: 'Cell Block A (A-101 Physical Prototype)'
  };

  const res = await apiRequest('/api/hardware/rfid/scan', 'POST', scanPayload);
  if (res.ok && res.data) {
    const granted = res.data.granted || res.data.accessGranted;
    const holder = res.data.holder?.name || res.data.personName || 'Unknown';
    if (granted) {
      log('RFID', `Access GRANTED for ${holder}! Rotating servo to 90° (Green LED ON)`, green);
      commandedDoorState = 'OPEN';
      simulatedServoAngle = 90;
      greenLedState = 'ON';
      redLedState = 'OFF';

      // Auto close after 4 seconds
      setTimeout(() => {
        if (running && commandedDoorState === 'OPEN') {
          log('ACTUATOR', 'Auto-close interval elapsed. Restoring door to CLOSED (0°)', yellow);
          commandedDoorState = 'CLOSED';
          simulatedServoAngle = 0;
          greenLedState = 'OFF';
          redLedState = 'ON';
          sendHeartbeat();
        }
      }, 4000);
    } else {
      log('RFID', `Access DENIED (${res.data.reason || 'Unauthorized UID'}). Flashing Red LED.`, red);
    }
  } else {
    log('RFID', `Scan failed: ${res.error || res.status}`, red);
  }
}

// Banner
console.log('\n=================================================================');
console.log('  🛡️  PrisonGuard — ESP32 Physical Door Hardware Simulator');
console.log('=================================================================');
console.log(`  Controller ID:  ${cyan}${controllerId}${reset}`);
console.log(`  Target Backend: ${cyan}${serverUrl}${reset}`);
console.log(`  Hardware BOM:   SG90 Servo (GPIO 13), LEDs (25, 26), RC522 SPI`);
console.log('\n  Interactive keys:');
console.log('    [o] + Enter : Command door OPEN (Servo = 90°, Green LED)');
console.log('    [c] + Enter : Command door CLOSED (Servo = 0°, Red LED)');
console.log('    [s] + Enter : Scan Authorized Officer Badge (CARD-OFC-514)');
console.log('    [r] + Enter : Scan Revoked Badge (CARD-REVOKED-999)');
console.log('    [u] + Enter : Scan Unknown Card (CARD-UNKNOWN-777)');
console.log('    [h] + Enter : Force instant Heartbeat');
console.log('    [q] + Enter : Quit');
console.log('=================================================================\n');

// Start Intervals
sendHeartbeat();
const heartbeatInterval = setInterval(sendHeartbeat, 5000);
const pollInterval = setInterval(pollCommands, 500);

// CLI Interaction
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', async (line) => {
  const cmd = line.trim().toLowerCase();
  switch (cmd) {
    case 'o':
      log('MANUAL', 'Commanding door OPEN (90°)', yellow);
      simulatedServoAngle = 90;
      commandedDoorState = 'OPEN';
      greenLedState = 'ON';
      redLedState = 'OFF';
      await reportEvent('DOOR_STATE_CHANGED', { state: 'OPEN', angle: 90 });
      await sendHeartbeat();
      break;
    case 'c':
      log('MANUAL', 'Commanding door CLOSED (0°)', yellow);
      simulatedServoAngle = 0;
      commandedDoorState = 'CLOSED';
      greenLedState = 'OFF';
      redLedState = 'ON';
      await reportEvent('DOOR_STATE_CHANGED', { state: 'CLOSED', angle: 0 });
      await sendHeartbeat();
      break;
    case 's':
      await simulateRfidScan('CARD-OFC-514');
      break;
    case 'r':
      await simulateRfidScan('CARD-REVOKED-999');
      break;
    case 'u':
      await simulateRfidScan('CARD-UNKNOWN-777');
      break;
    case 'h':
      await sendHeartbeat();
      break;
    case 'q':
      log('SYSTEM', 'Shutting down simulated ESP32 controller...', yellow);
      running = false;
      clearInterval(heartbeatInterval);
      clearInterval(pollInterval);
      rl.close();
      process.exit(0);
      break;
    default:
      console.log('Unrecognized key. Available: [o]pen, [c]lose, [s]can officer, [r]evoked card, [u]nknown card, [h]eartbeat, [q]uit');
  }
});
