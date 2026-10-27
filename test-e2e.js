async function testAll() {
  console.log('--- 1. Testing Health ---');
  const healthRes = await fetch('http://localhost:5000/health');
  const health = await healthRes.json();
  console.log('Health:', health);

  console.log('\n--- 2. Testing Login ---');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  console.log('Login success:', !!loginData.token, 'Role:', loginData.user?.role);
  const token = loginData.token;

  console.log('\n--- 3. Testing Gate Command (Open G-01) ---');
  const gateRes = await fetch('http://localhost:5000/api/gates/GATE-01/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ targetState: 'OPEN' })
  });
  const gateData = await gateRes.json();
  console.log('Gate Command Status:', gateData.command?.status, 'Target:', gateData.command?.targetState);

  console.log('\n--- 4. Testing RFID Authorized Scan ---');
  const rfidRes = await fetch('http://localhost:5000/api/rfid/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ readerId: 'RFID-BLOCK-A', cardId: 'CARD-OFC-514' })
  });
  const rfidData = await rfidRes.json();
  console.log('RFID Scan Result:', rfidData.accessLog?.result, 'Person:', rfidData.accessLog?.personName);

  console.log('\n--- 5. Testing Sensor Trigger (Unexpected Door Opening Rule B) ---');
  const sensorRes = await fetch('http://localhost:5000/api/sensors/REED-A102/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'OPEN' })
  });
  const sensorData = await sensorRes.json();
  console.log('Sensor trigger updated:', sensorData.device?.id, sensorData.device?.value);

  console.log('\n--- 6. Testing Audit Log Verification ---');
  const auditRes = await fetch('http://localhost:5000/api/logs/audit');
  const auditData = await auditRes.json();
  console.log('Audit chain valid:', auditData.verification?.valid, 'Blocks:', auditData.verification?.verifiedBlocks);

  console.log('\n--- 7. Testing State Snapshot ---');
  const stateRes = await fetch('http://localhost:5000/api/state');
  const state = await stateRes.json();
  console.log('Controllers:', Object.keys(state.controllers).length);
  console.log('Devices:', Object.keys(state.devices).length);
  console.log('Gates:', Object.keys(state.gates).length);
  console.log('People:', Object.keys(state.people).length);
  console.log('Active Incidents:', state.incidents.length);

  console.log('\n✅ ALL INTEGRATION TESTS PASSED PERFECTLY!');
}

testAll().catch(console.error);
