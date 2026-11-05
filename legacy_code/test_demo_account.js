// Test script to verify Demo Account Enforcement
const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runDemoAccountTests() {
  console.log('--- STARTING DEMO ACCOUNT ENFORCEMENT VERIFICATION ---');

  // 1. Verify Server Rejection for Bet without Account (Empty phone or 'guest')
  console.log('\n[1] Testing bet rejection without account (empty phone)...');
  const resNoPhone = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/wallet/bet',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: '',
    mode: 'DEMO',
    terminalId: 1,
    amount: 100
  });
  console.log('Status:', resNoPhone.status);
  console.log('Response:', resNoPhone.data);
  assert.strictEqual(resNoPhone.status, 401, 'Expected 401 Unauthorized for bet without account');
  assert.strictEqual(resNoPhone.data.code, 'ACCOUNT_REQUIRED', 'Expected code ACCOUNT_REQUIRED');
  console.log('✓ Anonymous/No-account bet blocked by server with ACCOUNT_REQUIRED');

  console.log('\n[2] Testing bet rejection with "guest" phone...');
  const resGuest = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/wallet/bet',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: 'guest',
    mode: 'DEMO',
    terminalId: 1,
    amount: 100
  });
  console.log('Status:', resGuest.status);
  assert.strictEqual(resGuest.status, 401);
  assert.strictEqual(resGuest.data.code, 'ACCOUNT_REQUIRED');
  console.log('✓ Guest bet blocked by server with ACCOUNT_REQUIRED');

  // 3. Verify Bet with valid Demo Account succeeds
  console.log('\n[3] Testing bet with valid Demo Account phone (254712345678)...');
  const resValidDemo = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/wallet/bet',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: '254712345678',
    mode: 'DEMO',
    terminalId: 1,
    amount: 100,
    roundNonce: 1
  });
  console.log('Status:', resValidDemo.status);
  assert.strictEqual(resValidDemo.status, 200);
  assert.strictEqual(resValidDemo.data.success, true);
  console.log('✓ Valid demo account bet accepted and recorded in SQLite database');

  // 4. Verify Codebase contains no "Guest Pilot" or "No Registration Required" in UI strings
  console.log('\n[4] Scanning files for legacy guest copy...');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const authJs = fs.readFileSync(path.join(__dirname, 'js', 'features', 'auth-manager.js'), 'utf8');
  const stakingJs = fs.readFileSync(path.join(__dirname, 'js', 'features', 'staking.js'), 'utf8');

  assert.ok(!html.includes('Guest Pilot'), 'index.html must not contain "Guest Pilot"');
  assert.ok(!html.includes('No Registration Required'), 'index.html must not contain "No Registration Required"');
  assert.ok(!authJs.includes('Guest Pilot'), 'auth-manager.js must not contain "Guest Pilot"');
  assert.ok(!authJs.includes('No Registration Required'), 'auth-manager.js must not contain "No Registration Required"');
  assert.ok(stakingJs.includes('ACCOUNT_REQUIRED'), 'staking.js must check ACCOUNT_REQUIRED');
  assert.ok(stakingJs.includes('setAccount'), 'staking.js must define setAccount');
  assert.ok(stakingJs.includes('clearAccount'), 'staking.js must define clearAccount');
  console.log('✓ All legacy guest references cleanly eliminated from UI and codebase');

  console.log('\n--- ALL DEMO ACCOUNT ENFORCEMENT TESTS PASSED! ---');
}

runDemoAccountTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
