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

    // 15. Autonomous Escape & Responding Officer Interception (Section 18 Test 1)
    console.log('\n[SUITE 15: Controlled Escape & Officer Interception]');
    const escapeRes = await request('/api/scenarios/controlled-escape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ workflow: 'WORKFLOW_A' })
    });
    assert(escapeRes.status === 200, 'Controlled escape scenario endpoint succeeds');
    assert(engine.state.people['P-1044'].status === 'ESCAPING', 'Prisoner Marcus Vance transitions to ESCAPING');
    assert(engine.state.people['OFC-514'].officerState === 'INTERCEPTING', 'Officer Lt. Sterling dispatched to INTERCEPT');

    // Simulate interception
    engine.state.people['OFC-514'].x = engine.state.people['P-1044'].x;
    engine.state.people['OFC-514'].y = engine.state.people['P-1044'].y;
    engine.tick();
    assert(engine.state.people['OFC-514'].officerState === 'ESCORTING', 'Officer transitions to ESCORTING upon interception');
    assert(engine.state.people['P-1044'].status === 'DETAINED', 'Prisoner transitions to DETAINED under escort');

    // 16. Cell Return Workflow A: Officer Requests Admin Closure (Section 18 Test 2)
    console.log('\n[SUITE 16: Cell Securing Workflow A – Admin Assistance & Radio Request]');
    // Move to cell waypoint to trigger arrival
    engine.state.people['OFC-514'].currentWaypoint = 'W_A102';
    engine.state.people['OFC-514'].path = [];
    engine.triggerReturnToCellSecuring('OFC-514', 'P-1044');
    assert(engine.state.people['OFC-514'].officerState === 'REQUESTING_ACCESS', 'Officer enters REQUESTING_ACCESS state');
    assert(Boolean(engine.state.people['OFC-514'].messageBubble?.text), 'Radio message bubble visible above officer');

    const radioReqs = await request('/api/radio-requests');
    assert(radioReqs.data.requests?.length > 0, 'Central Security receives pending radio request');
    const targetReq = radioReqs.data.requests[0];

    // Admin responds to close the cell
    const closeRes = await request(`/api/radio-requests/${targetReq.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'CLOSE_CELL' })
    });
    assert(closeRes.status === 200, 'Admin close-cell command executed');
    assert(engine.state.doors['DOOR-A102'].position === 'CLOSED', 'Cell door position confirmed CLOSED');
    assert(engine.state.doors['DOOR-A102'].lockState === 'LOCKED', 'Cell door solenoid confirmed LOCKED');
    assert(engine.state.people['P-1044'].status === 'NORMAL', 'Prisoner returned to NORMAL status');

    // 17. Cell Return Workflow B: Officer Independent RFID Badge Securing (Section 18 Test 3)
    console.log('\n[SUITE 17: Cell Securing Workflow B – Officer RFID Badge]');
    engine.handleDoorLock('DOOR-A102', 'UNLOCK');
    engine.handleDoorOperate('DOOR-A102', 'OPEN');
    engine.state.people['P-1044'].status = 'DETAINED';
    engine.state.people['P-1044'].cellWaypoint = 'W_A102';
    engine.state.people['P-1044'].assignedDoorId = 'DOOR-A102';

    engine.executeRfidCellSecure('OFC-514', 'P-1044', 'DOOR-A102');
    assert(engine.state.doors['DOOR-A102'].position === 'CLOSED', 'Door secured via RFID presentation');
    assert(engine.state.doors['DOOR-A102'].lockState === 'LOCKED', 'Door locked via RFID access control');
    assert(engine.state.accessLogs[0].result === 'GRANTED', 'RFID access log records GRANTED access for officer return');
    assert(auditLogger.verifyChain().valid === true, 'Audit log chain cryptographically valid after RFID event');

    // 18. Administrator-to-Officer Task Dispatch (Section 18 Test 4)
    console.log('\n[SUITE 18: Administrator-to-Officer Task Commands]');
    const taskRes = await request('/api/officers/OFC-514/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        commandType: 'PATROL_ZONE',
        targetWaypointId: 'W_NORTH_A',
        note: 'Inspect north wing corridors'
      })
    });
    assert(taskRes.status === 200, 'Admin-to-officer command accepted with HTTP 200');
    assert(engine.state.people['OFC-514'].officerState === 'RESPONDING_TO_ADMIN_COMMAND', 'Officer transitions to RESPONDING_TO_ADMIN_COMMAND');
    assert(Boolean(engine.state.people['OFC-514'].messageBubble?.text.includes('North Main Corridor')), 'Officer simulated radio response dispatched');

    // 19. Officer Incapacitation & Medical Recovery (Section 4.2 & Section 10)
    console.log('\n[SUITE 19: Officer Incapacitation & Medical Recovery]');
    const medRes = await request('/api/officers/OFC-702/medical-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ scenario: 'CONFRONTATION_EXHAUSTION' })
    });
    assert(medRes.status === 200, 'Officer medical event accepted with HTTP 200');
    assert(engine.state.people['OFC-702'].officerState === 'MEDICAL_RECOVERY', 'Officer status set to MEDICAL_RECOVERY');
    assert(engine.state.people['OFC-702'].path.length === 0, 'Incapacitated officer stops movement');

    // Simulate recovery progression
    engine.state.people['OFC-702'].recoveryTimerSec = 1;
    engine.processAutonomousStaffAndPrisoners(new Date().toISOString());
    assert(engine.state.people['OFC-702'].officerState === 'PATROLLING', 'Officer recovers and returns to duty');

    // 20. CCTV Surveillance, FOV Geometry & Line-of-Sight Occlusion (Section 11 & 12)
    console.log('\n[SUITE 20: CCTV Surveillance, FOV Geometry & Occlusion]');
    const cctvRes = await request('/api/cameras');
    assert(cctvRes.status === 200, 'Cameras API returns HTTP 200');
    assert(Object.keys(cctvRes.data.cameras).length === 8, 'All 8 facility security cameras initialized');

    // Yard camera CAM-01 visibility test
    engine.updateCameraVisibility(new Date().toISOString());
    const cam01 = engine.state.cameras['CAM-01'];
    assert(cam01.status === 'ONLINE', 'Camera CAM-01 is ONLINE');
    const yardInmateVisible = cam01.visibleEntities.some(e => e.id === 'P-6120');
    assert(yardInmateVisible === true, 'CAM-01 sees Robert Paulson in the Common Exercise Yard');

    // Behind camera or out-of-range exclusion
    const northInmateVisibleInYard = cam01.visibleEntities.some(e => e.id === 'P-3105');
    assert(northInmateVisibleInYard === false, 'CAM-01 excludes Block C inmate out of field of view / behind camera');

    // Toggle camera to OFFLINE
    const toggleRes = await request('/api/cameras/CAM-01/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'OFFLINE' })
    });
    assert(toggleRes.status === 200, 'Camera toggle endpoint returns HTTP 200');
    assert(engine.state.cameras['CAM-01'].status === 'OFFLINE', 'Camera CAM-01 status toggled to OFFLINE');
    assert(engine.state.cameras['CAM-01'].visibleEntities.length === 0, 'Offline camera reports 0 visible entities');

    // Restore camera
    await request('/api/cameras/CAM-01/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'ONLINE' })
    });

    // 21. Mass Escape Scenario Coordination (Section 18 Test 5)
    console.log('\n[SUITE 21: Multi-Prisoner Escape Coordination]');
    const massRes = await request('/api/scenarios/mass-escape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    });
    assert(massRes.status === 200, 'Mass escape scenario returns HTTP 200');

    // 22. Clean Reset Behavior
    console.log('\n[SUITE 22: Simulation Reset to Baseline]');
    const resetRes = await request('/api/scenarios/reset', { method: 'POST' });
    assert(resetRes.status === 200, 'Reset simulation endpoint succeeds');
    assert(engine.state.gates['GATE-01']?.state === 'CLOSED', 'Gate reset to default baseline');
    assert(auditLogger.verifyChain().valid === true, 'Audit log chain valid after reset');

    // 23. Camera Sweep, Manual Pan & Angular Limits
    console.log('\n[SUITE 23: Camera Sweep, Manual Pan & Limits]');
    const sweepRes = await request('/api/cameras/CAM-01/sweep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'START' })
    });
    assert(sweepRes.status === 200, 'Start camera sweep endpoint returns HTTP 200');
    assert(sweepRes.data?.camera?.isSweeping === true, 'Camera CAM-01 enters SWEEP mode');

    const panRes = await request('/api/cameras/CAM-01/pan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ angle: 60 })
    });
    assert(panRes.status === 200, 'Manual camera pan endpoint returns HTTP 200');
    assert(panRes.data?.camera?.angle === 60, 'Camera CAM-01 angle updated to 60 degrees');
    assert(panRes.data?.camera?.isSweeping === false, 'Manual pan safely disengages auto-sweep');

    // 24. Insider Threat & RFID Credential Revocation
    console.log('\n[SUITE 24: Insider Threat & RFID Credential Revocation]');
    const revokeRes = await request('/api/officers/OFC-514/revoke-credential', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(revokeRes.status === 200, 'Revoke credential endpoint returns HTTP 200');
    assert(revokeRes.data?.officer?.credentialStatus === 'REVOKED', 'Officer OFC-514 credential set to REVOKED');
    assert(revokeRes.data?.officer?.availability === 'COMPROMISED', 'Officer marked as COMPROMISED');

    // Attempt scan with revoked card
    const scanRevokedRes = await request('/api/rfid/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readerId: 'RFID-BLOCK-A', cardId: 'CARD-OFC-514' })
    });
    assert(scanRevokedRes.status === 200, 'Scan endpoint processed');
    assert(scanRevokedRes.data?.accessLog?.result === 'DENIED', 'Revoked RFID credential access strictly DENIED');
    assert(auditLogger.verifyChain().valid === true, 'Cryptographic audit ledger valid after revocation');

    // 25. External Visitor Management & Role-Based Entry
    console.log('\n[SUITE 25: External Visitor Management & Role-Based Entry]');
    const visitorArrivalRes = await request('/api/visitors/arrive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        visitorId: 'VIS-TEST-01',
        name: 'Detective Sarah Lin',
        category: 'INVESTIGATOR',
        organization: 'State Investigative Bureau',
        purpose: 'Inspection'
      })
    });
    assert(visitorArrivalRes.status === 200, 'Visitor arrival returns HTTP 200');
    assert(visitorArrivalRes.data?.visitor?.status === 'AWAITING_APPROVAL', 'Visitor registered as AWAITING_APPROVAL');

    // Operator cannot approve (Admin only)
    const opApprovalRes = await request('/api/visitors/VIS-TEST-01/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opToken}` },
      body: JSON.stringify({ decision: 'APPROVE' })
    });
    assert(opApprovalRes.status === 403, 'Operator denied approval permission (HTTP 403)');

    // Admin approves visitor
    const adminApprovalRes = await request('/api/visitors/VIS-TEST-01/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ decision: 'APPROVE' })
    });
    assert(adminApprovalRes.status === 200, 'Admin approves visitor entry (HTTP 200)');
    assert(adminApprovalRes.data?.visitor?.status === 'APPROVED', 'Visitor status updated to APPROVED');

    // 26. Suspicious Activity Engine & Monitoring Suppression
    console.log('\n[SUITE 26: Suspicious Activity Engine & Monitoring Suppression]');
    const suspRes = await request('/api/suspicious/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        type: 'LOITERING_RESTRICTED_GATE',
        prisonerId: 'P-2089',
        location: 'Common Exercise Yard',
        severity: 'HIGH'
      })
    });
    assert(suspRes.status === 200, 'Suspicious activity trigger returns HTTP 200');
    assert(suspRes.data?.activity?.status === 'DETECTED', 'Suspicious activity status is DETECTED');
    assert(engine.state.people['P-2089']?.activity.includes('Suspicious Activity'), 'Target prisoner activity reflects alert');

    // 27. Health Model, Incapacitation & Security Control Breach
    console.log('\n[SUITE 27: Health Model, Incapacitation & Security Control Breach]');
    const healthRes = await request('/api/health/change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ personId: 'SUP-309', delta: -100, reason: 'Simulated Confrontation' })
    });
    assert(healthRes.status === 200, 'Health reduction returns HTTP 200');
    assert(healthRes.data?.person?.health === 0, 'Supervisor SUP-309 health drops to 0');
    assert(healthRes.data?.person?.healthState === 'INCAPACITATED', 'Supervisor marked INCAPACITATED');
    assert(engine.state.securityControlBreach?.isBreached === true, 'SIMULATED SECURITY CONTROL BREACH activated');

    // Reset Security Breach
    const resetBreachRes = await request('/api/security/breach/reset', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(resetBreachRes.status === 200, 'Security breach reset returns HTTP 200');
    assert(engine.state.securityControlBreach?.isBreached === false, 'Security Control Breach restored to baseline');
    assert(engine.state.people['SUP-309']?.health === 100, 'Supervisor health restored to 100 HP');

    // 28. Extreme Simulation Time Acceleration (60x & 120x)
    console.log('\n[SUITE 28: Extreme Simulation Time Acceleration (60x & 120x)]');
    engine.setSimulationClock({ speed: 60 });
    assert(engine.state.simulationClock.speed === 60, 'Simulation clock set to 60x speed');
    const t0 = new Date(engine.state.simulationClock.time).getTime();
    engine.stepSimulationClock();
    const t1 = new Date(engine.state.simulationClock.time).getTime();
    assert(t1 - t0 === 60000, '60x speed advances 60 simulation seconds per 1-second tick');

    engine.setSimulationClock({ speed: 120 });
    assert(engine.state.simulationClock.speed === 120, 'Simulation clock set to 120x speed');
    engine.stepSimulationClock();
    const t2 = new Date(engine.state.simulationClock.time).getTime();
    assert(t2 - t1 === 120000, '120x speed advances 120 simulation seconds per 1-second tick');

    engine.setSimulationClock({ speed: 1 }); // restore normal speed

    // 29. Deterministic Scenario Engine & Demonstration Scenarios
    console.log('\n[SUITE 29: Deterministic Scenario Engine & Registry]');
    const scenariosRes = await request('/api/scenarios');
    assert(scenariosRes.status === 200, 'Scenarios registry endpoint returns HTTP 200');
    assert(Object.keys(scenariosRes.data?.scenarios || {}).length >= 14, 'All 14 simulation scenarios registered');
    assert(scenariosRes.data?.scenarios['SCENARIO_A_CCTV_ALERT'] !== undefined, 'Demonstration Scenario A registered');
    assert(scenariosRes.data?.scenarios['SCENARIO_B_ESCAPE_INTERVENTION'] !== undefined, 'Demonstration Scenario B registered');
    assert(scenariosRes.data?.scenarios['SCENARIO_C_POWER_FAILURE'] !== undefined, 'Demonstration Scenario C registered');
    assert(scenariosRes.data?.scenarios['SCENARIO_D_COMPROMISED_OFFICER'] !== undefined, 'Demonstration Scenario D registered');
    assert(scenariosRes.data?.scenarios['SCENARIO_E_CREDENTIAL_MISUSE'] !== undefined, 'Demonstration Scenario E registered');
    assert(scenariosRes.data?.scenarios['SCENARIO_F_EXTERNAL_VISITOR'] !== undefined, 'Demonstration Scenario F registered');

    // Start Demonstration Scenario A
    const startScenRes = await request('/api/scenarios/SCENARIO_A_CCTV_ALERT/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ seed: 101 })
    });
    assert(startScenRes.status === 200, 'Scenario A start returns HTTP 200');
    assert(engine.state.activeScenario === 'SCENARIO_A_CCTV_ALERT', 'Active scenario is SCENARIO_A_CCTV_ALERT');

    // 30. IoT Communication Topology & Access Point Associations
    console.log('\n[SUITE 30: IoT Communication Topology & Access Points]');
    const topoRes = await request('/api/topology');
    assert(topoRes.status === 200, 'Topology endpoint returns HTTP 200');
    assert(Object.keys(topoRes.data?.accessPoints || {}).length >= 5, '5 facility Wi-Fi Access Points configured');
    assert(topoRes.data?.metadata?.backend?.port === 5000, 'Backend metadata reports Port 5000');
    assert(topoRes.data?.accessPoints['AP-NORTH-CORR']?.associatedControllers?.includes('ESP32-CELL-01'), 'AP associations accurate');


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
