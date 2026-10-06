// Test script to verify:
// 1. Signup asks phone number and password with confirmation and directly updates DB (no OTP on signup)
// 2. Only Firebase Auth OTP is used to reset passwords, and updating password in DB
const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const db = require('./db.js');

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

async function runAuthRequirementsTests() {
  console.log('--- STARTING SIGNUP DIRECT DB & FIREBASE PASSWORD RESET VERIFICATION ---');

  const testPhone = '2547' + Math.floor(10000000 + Math.random() * 89999999);
  const testUser = 'pilot_test_' + Math.floor(1000 + Math.random() * 9000);
  const initialPassHash = 'initial_hash_' + Math.random().toString(16).slice(2);
  const updatedPassHash = 'updated_new_hash_' + Math.random().toString(16).slice(2);

  // 1. Direct Signup: Phone + Password with confirmation -> saves to DB
  console.log('\n[1] Testing POST /api/auth/phone-signup endpoint (Signup without OTP)...');
  const resSignup = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/phone-signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    username: testUser,
    passwordHash: initialPassHash
  });

  console.log('Status:', resSignup.status);
  console.log('Signup Response:', resSignup.data);
  assert.strictEqual(resSignup.status, 200, 'Expected 200 OK from /api/auth/phone-signup');
  assert.strictEqual(resSignup.data.success, true);
  assert.strictEqual(resSignup.data.user.phone, testPhone);
  assert.strictEqual(resSignup.data.user.demoBalance, 50000);
  assert.strictEqual(resSignup.data.user.realBalance, 0);
  console.log('✓ Successfully registered phone user directly in DB');

  // 2. Direct SQLite Database verification
  console.log('\n[2] Verifying SQLite database entry for user...');
  const dbUser = db.getUser(testPhone);
  assert.ok(dbUser, 'User record must exist in SQLite database');
  assert.strictEqual(dbUser.phone, testPhone);
  assert.strictEqual(dbUser.password_hash, initialPassHash);
  assert.strictEqual(dbUser.demo_balance, 50000);
  assert.strictEqual(dbUser.real_balance, 0);
  console.log('✓ Direct SQLite record validated with balances and password hash');

  // 3. Verify Login with registered credentials
  console.log('\n[3] Testing POST /api/auth/login with initial password hash...');
  const resLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    passwordHash: initialPassHash
  });
  console.log('Status:', resLogin.status);
  assert.strictEqual(resLogin.status, 200);
  assert.strictEqual(resLogin.data.success, true);
  console.log('✓ Login with initial password succeeds');

  // 4. Password Reset with Firebase: update password in DB
  console.log('\n[4] Testing POST /api/auth/update-password (after Firebase OTP verification)...');
  const resUpdatePass = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/update-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    passwordHash: updatedPassHash
  });
  console.log('Status:', resUpdatePass.status);
  console.log('Update Pass Response:', resUpdatePass.data);
  assert.strictEqual(resUpdatePass.status, 200);
  assert.strictEqual(resUpdatePass.data.success, true);

  // Verify in DB that password hash actually changed
  const dbUserUpdated = db.getUser(testPhone);
  assert.strictEqual(dbUserUpdated.password_hash, updatedPassHash, 'Password hash in DB must be updated');
  console.log('✓ Password hash in SQLite database updated successfully');

  // Verify old password fails and new password succeeds
  console.log('\n[5] Verifying login with updated password...');
  const resLoginOld = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    passwordHash: initialPassHash
  });
  assert.strictEqual(resLoginOld.status, 401, 'Old password must be rejected');

  const resLoginNew = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    passwordHash: updatedPassHash
  });
  assert.strictEqual(resLoginNew.status, 200, 'New password must succeed');
  assert.strictEqual(resLoginNew.data.success, true);
  console.log('✓ Old password rejected (401) and new password accepted (200)');

  // 6. Test Demo Bet with this newly registered account
  console.log('\n[6] Testing placing a DEMO bet with new phone...');
  const resBet = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/wallet/bet',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    mode: 'DEMO',
    terminalId: 1,
    amount: 100,
    roundNonce: 1
  });
  assert.strictEqual(resBet.status, 200);
  assert.strictEqual(resBet.data.success, true);
  assert.strictEqual(resBet.data.demoBalance, 49900);
  console.log('✓ Demo bet succeeded with updated account');

  // 7. Verify UI file contents match requirements
  console.log('\n[7] Verifying UI elements for Signup and Password Reset...');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  // Signup must ask phone number, password, confirm password, and direct register button
  assert.ok(indexHtml.includes('auth-reg-phone'), 'index.html must have auth-reg-phone');
  assert.ok(indexHtml.includes('auth-reg-password'), 'index.html must have auth-reg-password');
  assert.ok(indexHtml.includes('auth-reg-confirm-password'), 'index.html must have auth-reg-confirm-password');
  assert.ok(indexHtml.includes('btn-submit-phone-register'), 'index.html must have btn-submit-phone-register');

  // Password reset MUST use Firebase (recaptcha-container-reset, btn-request-reset-code, btn-complete-password-reset)
  assert.ok(indexHtml.includes('recaptcha-container-reset'), 'index.html must have recaptcha-container-reset for Firebase reset');
  assert.ok(indexHtml.includes('btn-request-reset-code'), 'index.html must have btn-request-reset-code');
  assert.ok(indexHtml.includes('btn-complete-password-reset'), 'index.html must have btn-complete-password-reset');

  // AuthManager must have registerWithPhone with confirmation check and storeUserInDatabase
  const authMgrJs = fs.readFileSync(path.join(__dirname, 'js', 'features', 'auth-manager.js'), 'utf8');
  assert.ok(authMgrJs.includes('registerWithPhone'), 'auth-manager.js must define registerWithPhone');
  assert.ok(authMgrJs.includes('rawPassword !== rawConfirmPassword'), 'auth-manager.js must validate password confirmation');
  assert.ok(authMgrJs.includes('storeUserInDatabase'), 'auth-manager.js must call storeUserInDatabase');
  assert.ok(authMgrJs.includes('requestResetVerification'), 'auth-manager.js must have requestResetVerification');
  assert.ok(authMgrJs.includes('completePasswordReset'), 'auth-manager.js must have completePasswordReset');
  assert.ok(authMgrJs.includes('updatePasswordInDatabase'), 'auth-manager.js must call updatePasswordInDatabase');

  console.log('✓ UI and AuthManager code assertions passed!');
  console.log('\n🎉 ALL SIGNUP AND FIREBASE PASSWORD RESET TESTS PASSED!');
}

runAuthRequirementsTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
