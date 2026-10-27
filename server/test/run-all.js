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

    // 8. Door Operations & Physical Position vs Solenoid Lock
    console.log('\n[SUITE 8: Door Operations & Physical vs Lock State]');
    // Attempting to open locked door should fail with 400
    const lockedDoorOpen = await request('/api/doors/DOOR-A101/operate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ action: 'OPEN' })
    });
    assert(lockedDoorOpen.status === 400, 'Opening locked door rejected (requires unlock first)');

    // Unlock door
    const unlockRes = await request('/api/doors/DOOR-A101/lock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ action: 'UNLOCK' })
    });
    assert(unlockRes.status === 200, 'Door unlocked successfully');
    assert(engine.state.doors['DOOR-A101'].lockState === 'UNLOCKED', 'Door lockState updated to UNLOCKED');

    // Open unlocked door
    const openRes = await request('/api/doors/DOOR-A101/operate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ action: 'OPEN' })
    });
    assert(openRes.status === 200, 'Unlocked door operates towards OPEN');

    // 9. Command Lifecycle & Communication Traces
    console.log('\n[SUITE 9: Command Lifecycle & Communication Trace]');
    const cmdsRes = await request('/api/commands');
    assert(cmdsRes.status === 200, 'Commands history endpoint returns HTTP 200');
    assert(cmdsRes.data.commands.length > 0, 'Command history records dispatched commands');

    const firstCmd = cmdsRes.data.commands[0];
    const traceRes = await request(`/api/commands/${firstCmd.id}/trace`);
    assert(traceRes.status === 200, 'Command trace endpoint returns HTTP 200');
    assert(traceRes.data.command.trace.length === 8, 'Communication trace contains 8 sequential verification stages');

    // 10. Emergency Facility Lockdown & Safe Release
    console.log('\n[SUITE 10: Facility Emergency Lockdown & Release]');
    const lockdownActRes = await request('/api/lockdown/activate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ scope: 'FULL_FACILITY' })
    });
    assert(lockdownActRes.status === 200, 'Lockdown activation returns HTTP 200');
    assert(engine.state.lockdown.isActive === true, 'Lockdown state is ACTIVE');
    assert(engine.state.doors['DOOR-A101'].lockState === 'LOCKED', 'Cell doors locked under lockdown');
    assert(engine.state.devices['ALARM-FACILITY'].value === 'ACTIVE', 'Alarm strobe activated under lockdown');

    const lockdownRelRes = await request('/api/lockdown/release', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    });
    assert(lockdownRelRes.status === 200, 'Lockdown release returns HTTP 200');
    assert(engine.state.lockdown.isActive === false, 'Lockdown state restored to inactive');
    assert(engine.state.devices['ALARM-FACILITY'].value === 'STANDBY', 'Alarm strobe deactivated');

    // 11. Public Address Broadcast & Simulator Audio Playback Reporting
    console.log('\n[SUITE 11: P.A. Broadcast & Audio Playback Reporting]');
    // Reset speakers to IDLE prior to targeted test
    for (const spk of Object.values(engine.state.speakers)) {
      spk.state = 'IDLE';
    }

    const annRes = await request('/api/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'Morning Roll Call',
        message: 'All cell blocks prepare for count.',
        zones: ['BLOCK_A', 'BLOCK_B']
      })
    });
    assert(annRes.status === 200, 'Broadcast announcement dispatched');
    assert(engine.state.speakers['SPEAKER-BLOCK-A'].state === 'BROADCASTING', 'Targeted Block A speaker actively broadcasting');
    assert(engine.state.speakers['SPEAKER-BLOCK-C'].state === 'IDLE', 'Untargeted Block C speaker remains idle');

    // Simulator reporting audio playback
    const reportRes = await request('/api/announcements/playback-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        announcementId: annRes.data.announcement.id,
        client: 'SIMULATOR_TEST',
        success: true,
        method: 'WEB_SPEECH_API'
      })
    });
    assert(reportRes.status === 200, 'Simulator audio playback report accepted');
    assert(engine.state.speakers['SPEAKER-BLOCK-A'].lastPlaybackReport?.success === true, 'Speaker recorded confirmed playback report');

    // 12. Simulation Clock Control & Daily Schedule
    console.log('\n[SUITE 12: Simulation Clock & Daily Routine Schedules]');
    const clockRes = await request('/api/clock/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ speed: 2, isPaused: false })
    });
    assert(clockRes.status === 200, 'Clock speed set to 2x');
    assert(engine.state.simulationClock.speed === 2, 'Simulation clock reflects 2x speed');
    assert(Boolean(engine.state.simulationClock.currentPhase?.name), 'Facility daily schedule phase active');

    // 13. Escort-Controlled Personnel Movement
    console.log('\n[SUITE 13: Escort-Controlled Personnel Movement]');
    const escortRes = await request('/api/people/P-1044/escort', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        escortId: 'OFC-514',
        destinationWaypointId: 'W_MED_1'
      })
    });
    assert(escortRes.status === 200, 'Escort task successfully created');
    assert(engine.state.people['P-1044'].status === 'IN_TRANSIT', 'Escorted inmate status set to IN_TRANSIT');

    // 14. Communication Diagnostics
    console.log('\n[SUITE 14: System Diagnostics & Health Status]');
    const commRes = await request('/api/system/communication-status');
    assert(commRes.status === 200, 'System communication status returns HTTP 200');
    assert(commRes.data.gateways.online === commRes.data.gateways.total, 'All ESP32 gateways reported ONLINE');

    // 15. Clean Reset Behavior
    console.log('\n[SUITE 15: Simulation Reset to Baseline]');
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
