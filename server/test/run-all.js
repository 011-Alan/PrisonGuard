import http from 'http';
import { app, server, engine } from '../src/index.js';
import { auditLogger } from '../src/utils/audit.js';
import { db } from '../src/storage/db.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

async function request(path, options = {}) {
  const url = `http://127.0.0.1:${server.address().port}${path}`;
  const res = await fetch(url, options);
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    // text
  }
  return { status: res.status, headers: res.headers, data: json };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 PRISONGUARD AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  try {
    // 1. Health Probe
    console.log('[SUITE 1: System Health & Readiness]');
    const health = await request('/health');
    assert(health.status === 200, 'Health endpoint responds with HTTP 200');
    assert(health.data?.status === 'ONLINE', 'Service status reports ONLINE');
    assert(health.data?.systemHealth > 80, 'Initial system health telemetry reported');

    // 2. Authentication & RBAC
    console.log('\n[SUITE 2: Authentication, JWT & RBAC]');
    const invalidLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    assert(invalidLogin.status === 401, 'Invalid password rejected with HTTP 401');

    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert(adminLogin.status === 200, 'Admin login succeeds with HTTP 200');
    assert(!!adminLogin.data?.token, 'JWT access token issued to Admin');
    assert(adminLogin.data?.user?.role === 'ADMIN', 'Admin user assigned ADMIN role');
    const adminToken = adminLogin.data?.token;

    const opLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'operator', password: 'op123' })
    });
    assert(opLogin.status === 200, 'Operator login succeeds with HTTP 200');
    assert(opLogin.data?.user?.role === 'OPERATOR', 'Operator assigned OPERATOR role');
    const opToken = opLogin.data?.token;

    // Role-based privilege check: Announcements require ADMIN or SUPERVISOR, Operator rejected
    const opAnnouncement = await request('/api/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opToken}`
      },
      body: JSON.stringify({ title: 'Unauthorized Test', message: 'Test message' })
    });
    assert(opAnnouncement.status === 403, 'Operator forbidden from broadcasting announcements (HTTP 403)');

    const adminAnnouncement = await request('/api/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ title: 'Authorized Test', message: 'Admin announcement message' })
    });
    assert(adminAnnouncement.status === 200, 'Admin successfully broadcasts announcement');

    // 3. Gate Control & Actuator Lifecycle
    console.log('\n[SUITE 3: Gate Actuators & Interlock Commands]');
    const gateCmd = await request('/api/gates/GATE-01/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ targetState: 'OPEN' })
    });
    assert(gateCmd.status === 200, 'Gate OPEN command accepted with HTTP 200');
    assert(gateCmd.data?.command?.status === 'EXECUTING', 'Command transitions to EXECUTING lifecycle');

    // Duplicate command in-flight protection
    const dupGateCmd = await request('/api/gates/GATE-01/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ targetState: 'OPEN' })
    });
    assert(dupGateCmd.data?.command?.note?.includes('already executing'), 'Duplicate in-flight command safely handled');

    // Gate Jam simulation (Rule E)
    const jamRes = await request('/api/gates/GATE-01/jam', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    });
    assert(jamRes.status === 200, 'Gate Jam injected successfully');
    assert(engine.state.gates['GATE-01']?.state === 'JAMMED', 'Gate state correctly reflects JAMMED');
    const actuatorIncident = engine.state.incidents.find(i => i.rule.includes('RULE E'));
    assert(!!actuatorIncident, 'Rule E (Gate Actuator Fault) incident automatically triggered');

    // 4. RFID Access Control & Badge Validation
    console.log('\n[SUITE 4: Contactless RFID Badge Verification]');
    const validRfid = await request('/api/rfid/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readerId: 'RFID-BLOCK-A', cardId: 'CARD-OFC-514' })
    });
    assert(validRfid.status === 200, 'RFID scan processed');
    assert(validRfid.data?.accessLog?.result === 'GRANTED', 'Authorized officer badge GRANTED access');

    const invalidRfid = await request('/api/rfid/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readerId: 'RFID-ADMIN', cardId: 'UNREGISTERED_TOKEN_000' })
    });
    assert(invalidRfid.data?.accessLog?.result === 'DENIED', 'Unregistered badge token DENIED access');

    // 5. Sensor Fusion Rules Engine
    console.log('\n[SUITE 5: Sensor Fusion Rules Engine]');
    // Rule A: Authorized Door Opening (Block A was authorized above)
    const ruleARes = engine.rules.evaluateDoorOpening('LOCK-A101', 'REED-A101');
    assert(ruleARes?.rule === 'RULE A' && ruleARes?.createIncident === false, 'Rule A (Authorized Door Access) evaluated as expected');

    // Rule B: Door opens without RFID auth (Block C has no authorized RFID scan)
    const doorBreach = await request('/api/sensors/REED-C102/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'OPEN' })
    });
    assert(doorBreach.status === 200, 'Reed switch trigger applied');
    const ruleBIncident = engine.state.incidents.find(i => i.associatedDevice === 'REED-C102');
    assert(!!ruleBIncident, 'Rule B (Unexpected Door Opening) alert generated');

    // Rule C: Motion in restricted corridor following breach
    const motionBreach = await request('/api/sensors/PIR-SPINE/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'DETECTED' })
    });
    assert(motionBreach.status === 200, 'Restricted spine PIR motion triggered');
    const ruleCIncident = engine.state.incidents.find(i => i.rule.includes('RULE C'));
    assert(!!ruleCIncident, 'Rule C (Possible Escape Detected) critical incident raised');

    // Rule D: Perimeter dual sensor validation
    await request('/api/sensors/VIB-FENCE-N/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'TRIPPED' })
    });
    await request('/api/sensors/IR-BEAM-N/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'BROKEN' })
    });
    const ruleDIncident = engine.state.incidents.find(i => i.rule.includes('RULE D'));
    assert(!!ruleDIncident, 'Rule D (Perimeter Dual Shock & Beam Occlusion) critical alert triggered');

    // Rule F: Controller offline cascading failure
    const disconnectCtrl = await request('/api/controllers/ESP32-CELL-02/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ isOnline: false })
    });
    assert(disconnectCtrl.status === 200, 'ESP32 controller disconnected');
    assert(engine.state.devices['REED-B101']?.status === 'OFFLINE', 'Subordinate sensors marked OFFLINE');
    const ruleFIncident = engine.state.incidents.find(i => i.rule.includes('RULE F'));
    assert(!!ruleFIncident, 'Rule F (Controller Loss) critical alert raised');

    // Restore controller
    await request('/api/controllers/ESP32-CELL-02/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ isOnline: true })
    });
    assert(engine.state.devices['REED-B101']?.status === 'ONLINE', 'Subordinate sensors restored to ONLINE');

    // 6. Cryptographic Tamper-Evident Audit Chain
    console.log('\n[SUITE 6: SHA-256 Audit Log Hash Chaining]');
    const auditRes = await request('/api/logs/audit');
    assert(auditRes.status === 200, 'Audit log endpoint returns entries');
    assert(auditRes.data?.verification?.valid === true, 'Sequential SHA-256 hash chain verified against genesis block');
    assert(auditRes.data?.verification?.verifiedBlocks > 5, 'Multiple sequential audit blocks cryptographically validated');

    // 7. Input Validation & Error Boundaries
    console.log('\n[SUITE 7: Input Validation & Boundaries]');
    const badGate = await request('/api/gates/INVALID_GATE_ID/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ targetState: 'OPEN' })
    });
    assert(badGate.status === 400, 'Non-existent gate command rejected with HTTP 400');

    const badState = await request('/api/gates/GATE-02/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ targetState: 'EXPLODE' })
    });
    assert(badState.status === 400, 'Illegal target state rejected with HTTP 400');

    // 8. Clean Reset Behavior
    console.log('\n[SUITE 8: Simulation Reset to Baseline]');
    const resetRes = await request('/api/scenarios/reset', { method: 'POST' });
    assert(resetRes.status === 200, 'Reset simulation endpoint succeeds');
    assert(engine.state.gates['GATE-01']?.state === 'CLOSED', 'Gate reset to default baseline');
    assert(auditLogger.verifyChain().valid === true, 'Audit log chain valid after reset');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    console.log('\n======================================================');
    console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('======================================================\n');
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Wait for server to bind
if (server.listening) {
  runTests();
} else {
  server.on('listening', runTests);
}
