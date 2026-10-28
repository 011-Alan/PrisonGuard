import http from 'http';
import { app, server, engine } from '../src/index.js';
import { auditLogger } from '../src/utils/audit.js';
import { db } from '../src/storage/db.js';
import { findShortestPath } from '../src/simulation/waypoints.js';

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
    assert(engine.state.people['OFC-514'].officerState === 'MOVING_TO_ASSIGNMENT' || engine.state.people['OFC-514'].officerState === 'RESPONDING_TO_ADMIN_COMMAND', 'Officer transitions to MOVING_TO_ASSIGNMENT');
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

    // 31. Test A: Cell Door & Prisoner Exit Logic
    console.log('\n[SUITE 31: Test A – Cell Door & Prisoner Exit Logic]');
    engine.resetToInitial();
    // Inmate in cell
    assert(engine.state.people['P-1044'].prisonerState === 'INSIDE_CELL', 'Marcus Vance initially INSIDE_CELL');
    // Open cell door with officer inspecting: inmate should hold
    engine.state.people['OFC-514'].officerState = 'INSPECTING_CELL';
    engine.evaluateDoorOpeningReactions('DOOR-A102');
    assert(engine.state.people['P-1044'].prisonerState === 'INSIDE_CELL', 'Inmate remains INSIDE_CELL during officer inspection');
    engine.state.people['OFC-514'].officerState = 'PATROLLING';

    // Open cell door with routine schedule: inmate steps out for recreation
    engine.state.simulationClock.currentPhase = { id: 'YARD_RECREATION', name: 'Yard Recreation' };
    engine.evaluateDoorOpeningReactions('DOOR-A102');
    assert(engine.state.people['P-1044'].prisonerState === 'MOVING_TO_DESTINATION', 'Inmate transitions to MOVING_TO_DESTINATION on routine release');
    assert(engine.state.eventTimeline.some(e => e.type === 'PRISONER_EXITED_CELL' && e.details?.reason === 'ROUTINE_SCHEDULE'), 'PRISONER_EXITED_CELL event logged for routine schedule');

    // Unauthorized cell door open: inmate attempts escape
    engine.state.simulationClock.currentPhase = { id: 'MORNING_ROUTINE', name: 'Morning Routine' };
    engine.state.people['P-1044'].prisonerState = 'INSIDE_CELL';
    engine.state.people['P-1044'].status = 'NORMAL';
    engine.evaluateDoorOpeningReactions('DOOR-A102');
    assert(engine.state.people['P-1044'].prisonerState === 'ATTEMPTING_ESCAPE', 'Inmate transitions to ATTEMPTING_ESCAPE on unauthorized open');
    assert(engine.state.people['P-1044'].status === 'ESCAPING', 'Inmate status is ESCAPING');

    // Door closed before inmate crosses doorway: exit blocked, inmate reverts to INSIDE_CELL
    engine.state.people['P-1044'].currentWaypoint = 'W_A102';
    engine.evaluateDoorClosingReactions('DOOR-A102');
    assert(engine.state.people['P-1044'].prisonerState === 'INSIDE_CELL', 'Inmate reverts to INSIDE_CELL when door closes before crossing');
    assert(engine.state.people['P-1044'].status === 'NORMAL', 'Inmate status restored to NORMAL');
    assert(engine.state.eventTimeline.some(e => e.type === 'EXIT_BLOCKED_DOOR_CLOSED'), 'EXIT_BLOCKED_DOOR_CLOSED event logged');

    // 32. Test B: Officer Command Integrity & Destination Stability
    console.log('\n[SUITE 32: Test B – Officer Command Integrity & Destination Stability]');
    engine.resetToInitial();
    const sterling = engine.state.people['OFC-514'];
    const task = engine.dispatchOfficerTask('OFC-514', {
      commandType: 'MONITOR_PRISONER',
      targetWaypointId: 'W_YARD_1',
      note: 'Monitor common yard activity'
    });
    assert(sterling.officerState === 'MOVING_TO_ASSIGNMENT', 'Officer state is MOVING_TO_ASSIGNMENT');
    assert(sterling.currentAssignment !== null, 'Officer has active currentAssignment');
    assert(sterling.path.length > 0, 'Officer assigned valid navigation path');

    // Verify autonomous patrol does NOT overwrite active assignment
    const assignedPathLength = sterling.path.length;
    engine.stepAutonomousPatrols();
    assert(sterling.currentAssignment !== null, 'Autonomous patrol does NOT clear current assignment');
    assert(sterling.path.length === assignedPathLength, 'Autonomous patrol does NOT overwrite path');

    // Complete task: move officer to destination waypoint and tick
    sterling.currentWaypoint = 'W_YARD_1';
    sterling.path = [];
    engine.processAutonomousStaffAndPrisoners(new Date().toISOString());
    assert(sterling.officerState === 'MONITORING_PRISONER', 'Officer transitions to MONITORING_PRISONER upon arrival');
    assert(task.status === 'COMPLETED', 'Admin task marked COMPLETED');
    assert(engine.state.eventTimeline.some(e => e.type === 'OFFICER_ARRIVED'), 'OFFICER_ARRIVED event logged');

    // 33. Test C: Non-Graphic Conflicts & Single-Time Health Drop
    console.log('\n[SUITE 33: Test C – Scripted Non-Graphic Conflicts & Health Model]');
    engine.resetToInitial();
    const conflictRes = await request('/api/conflicts/prisoner-officer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ prisonerId: 'P-1044', officerId: 'OFC-514', severity: 'HIGH' })
    });
    assert(conflictRes.status === 200, 'Prisoner-Officer conflict endpoint succeeds');
    assert(engine.state.people['OFC-514'].health === 70, 'Officer health dropped by exactly 30 HP once (from 100 to 70)');
    assert(engine.state.people['OFC-514'].officerState === 'INCAPACITATED', 'Officer state transitions to INCAPACITATED');
    assert(engine.state.people['P-1044'].prisonerState === 'INVOLVED_IN_CONFLICT', 'Prisoner state transitions to INVOLVED_IN_CONFLICT');
    assert(engine.state.incidents.some(i => i.rule?.includes('RULE H')), 'Staff assault incident created');

    // Multiple tick passes must NOT reduce health further (damage applied ONCE)
    engine.processAutonomousStaffAndPrisoners(new Date().toISOString());
    engine.processAutonomousStaffAndPrisoners(new Date().toISOString());
    assert(engine.state.people['OFC-514'].health === 70, 'Health remains stable at 70 across subsequent ticks (no continuous drain)');

    // Inmate-Inmate Conflict
    const inmateConflictRes = await request('/api/conflicts/prisoner-prisoner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ prisoner1Id: 'P-1044', prisoner2Id: 'P-2089', severity: 'MEDIUM' })
    });
    assert(inmateConflictRes.status === 200, 'Prisoner-Prisoner conflict endpoint succeeds');
    assert(engine.state.people['P-1044'].health === 75, 'Injured prisoner takes exactly -25 damage once (100 to 75)');
    assert(engine.state.people['P-1044'].prisonerState === 'INJURED', 'Injured prisoner transitions to INJURED');

    // 34. Test D: Medical Escort & Gradual Simulation-Time Recovery
    console.log('\n[SUITE 34: Test D – Medical Escort & Gradual Simulation-Time Recovery]');
    const medEscortRes = await request('/api/medical/escort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ patientId: 'P-1044', escortStaffId: 'NRS-402' })
    });
    assert(medEscortRes.status === 200, 'Medical escort dispatch succeeds');
    assert(engine.state.people['P-1044'].prisonerState === 'AWAITING_MEDICAL_ESCORT', 'Patient enters AWAITING_MEDICAL_ESCORT');
    assert(engine.state.people['NRS-402'].officerState === 'ESCORTING_INJURED_PERSON', 'Staff enters ESCORTING_INJURED_PERSON');

    // Meet and escort to Medical Bay
    engine.state.people['NRS-402'].currentWaypoint = engine.state.people['P-1044'].currentWaypoint;
    engine.processAutonomousStaffAndPrisoners(new Date().toISOString());
    assert(engine.state.people['P-1044'].prisonerState === 'BEING_ESCORTED_TO_MEDICAL', 'Patient transitions to BEING_ESCORTED_TO_MEDICAL');

    // Arrive at Clinic
    engine.state.people['NRS-402'].currentWaypoint = 'W_MED_1';
    engine.state.people['NRS-402'].path = [];
    engine.processAutonomousStaffAndPrisoners(new Date().toISOString());
    assert(engine.state.people['P-1044'].prisonerState === 'RECEIVING_MEDICAL_CARE' || engine.state.people['P-1044'].prisonerState === 'RECOVERING', 'Patient admitted to clinic (RECEIVING_MEDICAL_CARE / RECOVERING)');

    // Recovery test: paused simulation freezes recovery
    engine.state.simulationClock.isPaused = true;
    const prePauseHp = engine.state.people['P-1044'].health;
    engine.processAutonomousStaffAndPrisoners(new Date().toISOString());
    assert(engine.state.people['P-1044'].health === prePauseHp, 'Paused simulation clock freezes medical recovery');

    // Unpause: +5 HP per tick at 1x speed
    engine.state.simulationClock.isPaused = false;
    engine.state.simulationClock.speed = 1;
    engine.processAutonomousStaffAndPrisoners(new Date().toISOString());
    assert(engine.state.people['P-1044'].health === prePauseHp + 5, 'Health recovers gradually by +5 HP per simulation second');

    // Reach 100 HP: full recovery and discharge
    engine.state.people['P-1044'].health = 96;
    engine.processAutonomousStaffAndPrisoners(new Date().toISOString());
    assert(engine.state.people['P-1044'].health === 100, 'Patient health restored to 100 HP');
    assert(engine.state.people['P-1044'].healthState === 'HEALTHY', 'Patient healthState is HEALTHY');
    assert(engine.state.people['P-1044'].prisonerState === 'INSIDE_CELL', 'Patient discharged to cell');
    assert(engine.state.eventTimeline.some(e => e.type === 'RECOVERY_COMPLETE'), 'RECOVERY_COMPLETE event logged');

    // 35. Test E: Compromised Officer 8-Stage Flow & Revocation
    console.log('\n[SUITE 35: Test E – Compromised Officer 8-Stage Flow & Revocation]');
    engine.resetToInitial();
    const suspendRes = await request('/api/officers/OFC-514/suspend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    });
    assert(suspendRes.status === 200, 'Officer suspend endpoint succeeds');
    assert(engine.state.people['OFC-514'].officerState === 'SUSPENDED', 'Officer state is SUSPENDED');
    assert(engine.state.revokedCards.includes('CARD-OFC-514'), 'Officer RFID card in revoked list');

    // Attempted badge swipe must be strictly DENIED
    const deniedScan = engine.handleRfidScan({
      readerId: 'RFID-BLOCK-A',
      cardId: 'CARD-OFC-514'
    });
    assert(deniedScan.result === 'DENIED', 'Suspended officer RFID swipe strictly DENIED');

    // Dispatching new task to suspended officer must be rejected
    let dispatchFailed = false;
    try {
      engine.dispatchOfficerTask('OFC-514', { commandType: 'PATROL_ZONE', targetWaypointId: 'W_NORTH_A' });
    } catch (e) {
      dispatchFailed = true;
    }
    assert(dispatchFailed === true, 'Task dispatch to suspended officer is rejected');

    // 36. Test F: Movement Continuity & Waypoint Routing
    console.log('\n[SUITE 36: Test F – Movement Continuity & Waypoint Routing]');
    const testPath = findShortestPath('W_NORTH_A', 'W_PERIM_EAST_N');
    assert(testPath.length >= 4, 'Valid non-empty shortest path found across facility graph');
    assert(testPath[0] === 'W_NORTH_A', 'Path originates at start waypoint');
    assert(testPath[testPath.length - 1] === 'W_PERIM_EAST_N', 'Path terminates at destination waypoint');

    // 37. Test G: Scenario Isolation & Clean Baseline Reset
    console.log('\n[SUITE 37: Test G – Scenario Isolation & Clean Baseline Reset]');
    engine.resetToInitial();
    assert(engine.state.eventTimeline.length === 0, 'Event timeline cleared on reset');
    assert(engine.state.revokedCards.length === 0, 'Revoked cards list cleared on reset');
    assert(engine.state.people['OFC-514'].officerState === 'PATROLLING', 'Officer states reset to PATROLLING');
    assert(engine.state.people['P-1044'].prisonerState === 'INSIDE_CELL', 'Prisoner states reset to INSIDE_CELL');
    assert(engine.state.people['OFC-514'].health === 100, 'All personnel health restored to 100 HP');

    // 38. Test H: Authoritative Event Timeline & API Endpoints
    console.log('\n[SUITE 38: Test H – Authoritative Event Timeline & API Endpoints]');
    engine.logSimulationEvent({
      type: 'SECURITY_AUDIT_PROBE',
      sourceEntity: { id: 'TEST', type: 'SYSTEM' },
      location: 'Central Control',
      outcome: 'SUCCESS',
      details: { probe: true }
    });
    const eventsRes = await request('/api/events');
    assert(eventsRes.status === 200, 'Event timeline endpoint returns HTTP 200');
    assert(eventsRes.data?.events?.length > 0, 'Event timeline contains logged events');
    assert(eventsRes.data?.events[0]?.type === 'SECURITY_AUDIT_PROBE', 'Event data structure conforms to specification');
    assert(eventsRes.data?.events[0]?.timestamp !== undefined, 'Event contains authoritative timestamp');

    // 39. Test I: Scenario Execution with Short and Full Keys
    console.log('\n[SUITE 39: Test I – Scenario Execution with Aliases]');
    const startShortB = await request('/api/scenarios/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ scenarioId: 'SCENARIO_B' })
    });
    assert(startShortB.status === 200, 'Starting scenario with short alias SCENARIO_B succeeds');
    assert(engine.state.activeScenario === 'SCENARIO_B_ESCAPE_INTERVENTION', 'Alias SCENARIO_B resolves to SCENARIO_B_ESCAPE_INTERVENTION');

    const startShortD = await request('/api/scenarios/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ scenarioId: 'SCENARIO_D' })
    });
    assert(startShortD.status === 200, 'Starting scenario with short alias SCENARIO_D succeeds');
    assert(engine.state.activeScenario === 'SCENARIO_D_COMPROMISED_OFFICER', 'Alias SCENARIO_D resolves to SCENARIO_D_COMPROMISED_OFFICER');

    // 40. Optional Hardware Integration Snapshot & Toggles
    console.log('\n[SUITE 40: Optional Hardware Integration Snapshot & Toggles]');
    const hwStatusInitial = await request('/api/hardware/status');
    assert(hwStatusInitial.status === 200, 'Hardware status endpoint returns HTTP 200');
    assert(hwStatusInitial.data?.enabled === false, 'Hardware integration defaults to disabled (software-only default)');
    assert(hwStatusInitial.data?.targetDoorId === 'DOOR-A101', 'Hardware target bound to Cell A-101 (DOOR-A101)');
    assert(hwStatusInitial.data?.devices['SERVO-DOOR-01'] !== undefined, 'Physical servo registered in component manifest');
    assert(hwStatusInitial.data?.devices['REED-A101-PHYSICAL'] !== undefined, 'Physical reed switch registered in component manifest');

    // Toggle hardware enabled
    const hwToggleOn = await request('/api/hardware/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ enabled: true })
    });
    assert(hwToggleOn.status === 200, 'Toggling hardware enabled succeeds');
    assert(hwToggleOn.data?.hardwareState?.enabled === true, 'Hardware state confirmed enabled');

    // Toggle bidirectional sync
    const hwSyncToggle = await request('/api/hardware/sync-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ enabled: true })
    });
    assert(hwSyncToggle.status === 200, 'Toggling physical-to-software sync succeeds');
    assert(hwSyncToggle.data?.hardwareState?.syncHardwareToSimulation === true, 'Sync flag enabled');

    // 41. Decoupled Non-Blocking Operation (Software Door Commands With Hardware Enabled)
    console.log('\n[SUITE 41: Decoupled Non-Blocking Operation]');
    // Unlock DOOR-A101 first (cell doors require unlock before physical transit)
    const unlockA101 = await request('/api/doors/DOOR-A101/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'UNLOCK' })
    });
    assert(unlockA101.status === 200, 'Door unlocked before physical opening');

    const swDoorOperate = await request('/api/doors/DOOR-A101/operate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'OPEN' })
    });
    assert(swDoorOperate.status === 200, 'Software door operation completes non-blocking without hardware delay');
    assert(
      engine.state.doors['DOOR-A101'].position === 'OPEN' ||
      engine.state.doors['DOOR-A101'].position === 'OPENING' ||
      engine.state.doors['DOOR-A101'].state === 'OPEN',
      'Simulation engine door state immediately updated to OPEN / OPENING'
    );

    const hwStatusAfterCmd = await request('/api/hardware/status');
    assert(hwStatusAfterCmd.data?.pendingCommandsCount > 0, 'Hardware command queued for target door');

    // 42. ESP32 Controller Communication, Authentication & Heartbeat
    console.log('\n[SUITE 42: ESP32 Controller Heartbeat, Authentication & Polling]');
    const hwToken = process.env.HARDWARE_DEVICE_TOKEN || 'pg-hw-secret-token-esp32-demo';

    // Unauthorized heartbeat rejected
    const badHeartbeat = await request('/api/hardware/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Token': 'wrong-token' },
      body: JSON.stringify({ controllerId: 'ESP32-CELL-01' })
    });
    assert(badHeartbeat.status === 401, 'Controller heartbeat without valid X-Device-Token is rejected with HTTP 401');

    // Valid heartbeat
    const goodHeartbeat = await request('/api/hardware/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Token': hwToken },
      body: JSON.stringify({
        controllerId: 'ESP32-CELL-01',
        doorState: 'CLOSED',
        servoAngle: 0,
        reedSwitch: 'CLOSED',
        uptimeSeconds: 120,
        isSimulated: true
      })
    });
    assert(goodHeartbeat.status === 200, 'Valid controller heartbeat accepted with HTTP 200');
    assert(goodHeartbeat.data?.connectionStatus === 'CONNECTED', 'Controller status transitions to CONNECTED');

    // Poll command
    const pollCmd = await request('/api/hardware/commands/poll', {
      headers: { 'X-Device-Token': hwToken }
    });
    assert(pollCmd.status === 200, 'Controller polls commands successfully');
    assert(pollCmd.data?.hasCommand === true, 'Poll returns queued door command');
    const queuedCmdId = pollCmd.data?.command?.id;

    // Acknowledge command
    const ackCmd = await request(`/api/hardware/commands/${queuedCmdId}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Token': hwToken },
      body: JSON.stringify({
        status: 'SUCCESS',
        servoAngle: 90,
        observedState: 'OPEN'
      })
    });
    assert(ackCmd.status === 200, 'Controller acknowledges command execution');
    assert(ackCmd.data?.command?.status === 'ACKNOWLEDGED', 'Command marked ACKNOWLEDGED in backend');

    // 43. Discrepancy Detection & Alignment Command
    console.log('\n[SUITE 43: Discrepancy Detection & Physical Actuation]');
    // Now simulate reed switch reporting CLOSED while software is OPEN
    const reedMismatch = await request('/api/hardware/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Token': hwToken },
      body: JSON.stringify({
        type: 'PHYSICAL_DOOR_STATE_CHANGED',
        controllerId: 'ESP32-CELL-01',
        details: { doorId: 'DOOR-A101-PHYSICAL', reedState: 'CLOSED', servoAngle: 0 }
      })
    });
    assert(reedMismatch.status === 200, 'Physical event accepted');

    // Direct physical door operate command
    const directPhysOperate = await request('/api/hardware/door/operate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'OPEN' })
    });
    assert(directPhysOperate.status === 200, 'Direct physical door actuation command queued');
    assert(directPhysOperate.data?.command?.payload?.action === 'OPEN', 'Actuation payload specifies OPEN (90°)');

    // Safe connectivity test
    const pingTest = await request('/api/hardware/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    });
    assert(pingTest.status === 200, 'Diagnostic connectivity test executes safely');
    assert(pingTest.data?.success === true, 'Active controller passes connectivity test');

    // 44. Bidirectional Physical Sensor Sync with Anti-Loop Guard
    console.log('\n[SUITE 44: Bidirectional Physical Sync & Anti-Loop Guard]');
    // Reset software door to CLOSED
    engine.state.doors['DOOR-A101'].lockState = 'UNLOCKED';
    engine.state.doors['DOOR-A101'].position = 'CLOSED';
    engine.state.doors['DOOR-A101'].state = 'CLOSED';
    assert(engine.state.doors['DOOR-A101'].position === 'CLOSED', 'Door reset to CLOSED in engine');

    // Send reed switch OPEN event with syncHardwareToSimulation active
    const syncEvent = await request('/api/hardware/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Token': hwToken },
      body: JSON.stringify({
        type: 'PHYSICAL_DOOR_STATE_CHANGED',
        controllerId: 'ESP32-CELL-01',
        details: { doorId: 'DOOR-A101-PHYSICAL', reedState: 'OPEN', servoAngle: 90 }
      })
    });
    assert(syncEvent.status === 200, 'Physical reed event processed');
    assert(
      engine.state.doors['DOOR-A101'].position === 'OPEN' ||
      engine.state.doors['DOOR-A101'].position === 'OPENING' ||
      engine.state.doors['DOOR-A101'].state === 'OPEN',
      'Software door synchronized automatically to OPEN from physical reed switch'
    );

    // 45. Hardware RFID Access Verification & Threat Rejection
    console.log('\n[SUITE 45: Hardware RFID Badge Evaluation & Security Control]');
    // Valid officer badge
    const hwValidRfid = await request('/api/hardware/rfid/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Token': hwToken },
      body: JSON.stringify({
        uid: 'CARD-OFC-514',
        cardId: 'CARD-OFC-514',
        readerId: 'RFID-RC522-01',
        location: 'Cell Block A (A-101)'
      })
    });
    assert(hwValidRfid.status === 200, 'RFID scan evaluation responds with HTTP 200');
    assert(hwValidRfid.data?.accessGranted === true, 'Authorized officer badge grants access');
    assert(hwValidRfid.data?.holder?.role === 'OFFICER', 'Badge holder identified as officer');

    // Revoked badge
    const hwRevokedRfid = await request('/api/hardware/rfid/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Token': hwToken },
      body: JSON.stringify({
        uid: 'CARD-REVOKED-999',
        cardId: 'CARD-REVOKED-999',
        readerId: 'RFID-RC522-01',
        location: 'Cell Block A (A-101)'
      })
    });
    assert(hwRevokedRfid.status === 200, 'Revoked RFID scan responds with HTTP 200');
    assert(hwRevokedRfid.data?.accessGranted === false, 'Revoked badge denies access');
    assert(hwRevokedRfid.data?.decision === 'DENIED_REVOKED_BADGE', 'Security system detects REVOKED badge');

    // Unknown/unregistered badge
    const hwUnknownRfid = await request('/api/hardware/rfid/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Token': hwToken },
      body: JSON.stringify({
        uid: 'CARD-UNKNOWN-000',
        cardId: 'CARD-UNKNOWN-000',
        readerId: 'RFID-RC522-01',
        location: 'Cell Block A (A-101)'
      })
    });
    assert(hwUnknownRfid.status === 200, 'Unknown RFID scan responds with HTTP 200');
    assert(hwUnknownRfid.data?.accessGranted === false, 'Unregistered badge denies access');
    assert(hwUnknownRfid.data?.decision === 'DENIED_UNKNOWN_CARD', 'Decision correctly flagged as DENIED_UNKNOWN_CARD');


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
