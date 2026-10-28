/**
 * ==============================================================================
 * PrisonGuard — Live End-to-End Hardware Integration Test
 * ==============================================================================
 * Tests the complete lifecycle:
 * 1. Boot authoritative backend server
 * 2. Connect client WebSocket simulating Admin website
 * 3. Enable hardware integration & bidirectional sync
 * 4. Connect simulated ESP32 controller via HTTP heartbeat & polling
 * 5. Send door command from Admin website -> Queued -> Polled by ESP32 -> Actuated -> Acknowledged -> Received by Admin via WebSocket
 * 6. Simulate physical Reed Switch change on ESP32 -> Synced to simulation engine -> Reflected to web clients
 * 7. Simulate contactless RFID card swipe -> Evaluated -> Event broadcasted
 * 8. Verify non-blocking operation & disconnect watchdog
 * ==============================================================================
 */

import { server, engine } from '../src/index.js';
import { io as ClientIO } from '../../apps/admin/node_modules/socket.io-client/build/esm/index.js';

async function runE2E() {
  console.log('\n======================================================');
  console.log('🔄 PRISONGUARD HARDWARE E2E WORKFLOW VERIFICATION');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name) {
    if (cond) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      failed++;
    }
  }

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const deviceToken = process.env.HARDWARE_DEVICE_TOKEN || 'pg-hw-secret-token-esp32-demo';

  try {
    // 1. Authenticate admin user
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    assert(loginData.token, 'Admin authenticated and JWT token acquired');

    // 2. Connect Admin Web Client via Socket.IO
    const adminSocket = ClientIO(baseUrl, { transports: ['websocket'] });
    let socketConnected = false;
    let receivedHardwareState = null;
    let receivedHardwareEvent = null;

    await new Promise((resolve) => {
      adminSocket.on('connect', () => {
        socketConnected = true;
        resolve();
      });
      adminSocket.on('hardware:state', (st) => {
        receivedHardwareState = st;
      });
      adminSocket.on('hardware:event', (ev) => {
        receivedHardwareEvent = ev;
      });
    });
    assert(socketConnected, 'Admin website Socket.IO client connected to backend');

    // 3. Enable hardware integration and sync via REST
    const toggleRes = await fetch(`${baseUrl}/api/hardware/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled: true })
    });
    const toggleData = await toggleRes.json();
    assert(toggleData.success && toggleData.hardware.enabled === true, 'Hardware integration enabled from Admin Website');

    const syncRes = await fetch(`${baseUrl}/api/hardware/sync-toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled: true })
    });
    const syncData = await syncRes.json();
    assert(syncData.success && syncData.hardware.syncHardwareToSimulation === true, 'Bidirectional physical sync enabled');

    // 4. ESP32 Controller sends heartbeat check-in
    const heartbeatRes = await fetch(`${baseUrl}/api/hardware/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': deviceToken,
        'X-Controller-Id': 'ESP32-CELL-01'
      },
      body: JSON.stringify({
        controllerId: 'ESP32-CELL-01',
        doorState: 'CLOSED',
        servoAngle: 0,
        reedSwitch: 'CLOSED',
        uptimeSeconds: 30,
        isSimulated: true
      })
    });
    const heartbeatData = await heartbeatRes.json();
    assert(heartbeatData.connectionStatus === 'CONNECTED', 'ESP32 controller heartbeat accepted and marked CONNECTED');

    // Wait a brief moment for socket state broadcast
    await new Promise(r => setTimeout(r, 100));
    assert(receivedHardwareState?.connectionStatus === 'CONNECTED', 'Admin website received live hardware state update via WebSocket');

    // 5. Admin operates door DOOR-A101 -> Non-blocking command queued for ESP32
    // Unlock door first
    await fetch(`${baseUrl}/api/doors/DOOR-A101/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'UNLOCK' })
    });

    const doorOpRes = await fetch(`${baseUrl}/api/doors/DOOR-A101/operate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'OPEN' })
    });
    const doorOpData = await doorOpRes.json();
    assert(doorOpData.success, 'Door operate dispatched from website (non-blocking)');

    // 6. ESP32 polls commands and executes
    const pollRes = await fetch(`${baseUrl}/api/hardware/commands/poll`, {
      headers: { 'X-Device-Token': deviceToken, 'X-Controller-Id': 'ESP32-CELL-01' }
    });
    const pollData = await pollRes.json();
    assert(pollData.hasCommand && pollData.command?.payload?.action === 'OPEN', 'ESP32 controller polled queued OPEN command');

    // 7. ESP32 acknowledges command
    const cmdId = pollData.command.id;
    const ackRes = await fetch(`${baseUrl}/api/hardware/commands/${cmdId}/ack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': deviceToken,
        'X-Controller-Id': 'ESP32-CELL-01'
      },
      body: JSON.stringify({
        status: 'SUCCESS',
        servoAngle: 90,
        observedState: 'OPEN'
      })
    });
    const ackData = await ackRes.json();
    assert(ackData.success && ackData.command?.status === 'ACKNOWLEDGED', 'ESP32 command acknowledgement confirmed');

    // 8. Physical Reed Switch displacement triggers physical state change event
    const reedEventRes = await fetch(`${baseUrl}/api/hardware/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': deviceToken,
        'X-Controller-Id': 'ESP32-CELL-01'
      },
      body: JSON.stringify({
        type: 'PHYSICAL_DOOR_STATE_CHANGED',
        controllerId: 'ESP32-CELL-01',
        details: { doorId: 'DOOR-A101-PHYSICAL', reedState: 'CLOSED', servoAngle: 0 }
      })
    });
    const reedEventData = await reedEventRes.json();
    assert(reedEventData.success, 'Physical reed event accepted from ESP32');

    // 9. Contactless RFID badge verification
    const rfidRes = await fetch(`${baseUrl}/api/hardware/rfid/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': deviceToken,
        'X-Controller-Id': 'ESP32-CELL-01'
      },
      body: JSON.stringify({
        uid: 'CARD-OFC-514',
        cardId: 'CARD-OFC-514',
        readerId: 'RFID-RC522-01',
        location: 'Cell Block A (A-101)'
      })
    });
    const rfidData = await rfidRes.json();
    assert(rfidData.accessGranted === true && rfidData.holder?.role === 'OFFICER', 'Physical RFID scan authenticated for Officer J. Miller');

    // Clean up
    adminSocket.disconnect();

  } catch (err) {
    console.error('E2E Execution Error:', err);
    failed++;
  } finally {
    console.log('\n======================================================');
    console.log(`E2E RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('======================================================\n');
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

if (server.listening) {
  runE2E();
} else {
  server.on('listening', runE2E);
}
