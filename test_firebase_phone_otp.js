// Test script to verify Firebase Phone Auth OTP sign-up and Database persistence
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

async function runFirebasePhoneOtpTests() {
  console.log('--- STARTING FIREBASE PHONE AUTH OTP & DB STORAGE VERIFICATION ---');

  const testPhone = '2547' + Math.floor(10000000 + Math.random() * 89999999);
  const testUid = 'firebase_uid_test_' + Date.now();
  const testUser = 'pilot_test_' + Math.floor(1000 + Math.random() * 9000);
  const testHash = 'hash_' + Math.random().toString(16).slice(2);

  // 1. Test POST /api/auth/phone-signup
  console.log('\n[1] Testing POST /api/auth/phone-signup endpoint...');
  const resSignup = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/phone-signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    firebaseUid: testUid,
    username: testUser,
    passwordHash: testHash
  });

  console.log('Status:', resSignup.status);
  console.log('Response:', resSignup.data);
  assert.strictEqual(resSignup.status, 200, 'Expected 200 OK from /api/auth/phone-signup');
  assert.strictEqual(resSignup.data.success, true, 'Expected success: true');
  assert.strictEqual(resSignup.data.user.phone, testPhone, 'Phone number must match');
  assert.strictEqual(resSignup.data.user.firebaseUid, testUid, 'Firebase UID must match');
  assert.strictEqual(resSignup.data.user.demoBalance, 50000, 'Starting demo balance must be 50,000 KES');
  assert.strictEqual(resSignup.data.user.realBalance, 0, 'Starting real balance must be 0 KES');
  console.log('✓ Successfully registered phone user via /api/auth/phone-signup');

  // 2. Direct SQLite Database verification
  console.log('\n[2] Verifying direct SQLite database entry for user...');
  const dbUser = db.getUser(testPhone);
  assert.ok(dbUser, 'User record must exist in SQLite database');
  assert.strictEqual(dbUser.phone, testPhone);
  assert.strictEqual(dbUser.firebase_uid, testUid, 'firebase_uid in DB must match');
  assert.strictEqual(dbUser.password_hash, testHash, 'password_hash in DB must match');
  assert.strictEqual(dbUser.demo_balance, 50000, 'demo_balance in DB must be 50000');
  assert.strictEqual(dbUser.real_balance, 0, 'real_balance in DB must be 0');
  console.log('✓ Direct SQLite record validated with firebase_uid and balances');

  // 3. Verify Wallet Endpoint reads the newly created account
  console.log('\n[3] Testing GET /api/wallet with new phone...');
  const resWallet = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/wallet?phone=${testPhone}`,
    method: 'GET'
  });
  console.log('Status:', resWallet.status);
  console.log('Wallet:', resWallet.data);
  assert.strictEqual(resWallet.status, 200);
  assert.strictEqual(resWallet.data.demoBalance, 50000);
  console.log('✓ Wallet endpoint correctly returns demoBalance = 50000');

  // 4. Test Demo Bet with this newly registered account
  console.log('\n[4] Testing placing a DEMO bet with new phone...');
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
  console.log('Status:', resBet.status);
  console.log('Bet Response:', resBet.data);
  assert.strictEqual(resBet.status, 200);
  assert.strictEqual(resBet.data.success, true);
  assert.strictEqual(resBet.data.demoBalance, 49900);
  console.log('✓ Successfully placed demo bet with newly registered Firebase account');

  // 5. Test phone normalization (e.g. 0799000222 -> 254799000222)
  console.log('\n[5] Testing phone normalization on registration...');
  const randomSuffix = String(Math.floor(1000000 + Math.random() * 8999999));
  const normPhoneInput = '07' + randomSuffix;
  const expectedNorm = '2547' + randomSuffix;
  const resNorm = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/phone-signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: normPhoneInput,
    firebaseUid: 'fb_norm_test',
    username: 'pilot_norm',
    passwordHash: 'pass_norm'
  });
  assert.strictEqual(resNorm.status, 200);
  assert.strictEqual(resNorm.data.user.phone, expectedNorm);
  console.log('✓ Phone normalization handles 07XX format correctly');

  // 6. Verify client UI & module files
  console.log('\n[6] Verifying client files for Firebase Phone OTP wiring...');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('recaptcha-container'), 'index.html must have recaptcha-container');
  assert.ok(indexHtml.includes('reg-step-1'), 'index.html must have reg-step-1');
  assert.ok(indexHtml.includes('reg-step-2'), 'index.html must have reg-step-2');
  assert.ok(indexHtml.includes('btn-send-reg-otp'), 'index.html must have btn-send-reg-otp');
  assert.ok(indexHtml.includes('btn-verify-reg-otp'), 'index.html must have btn-verify-reg-otp');
  assert.ok(indexHtml.includes('auth-reg-otp'), 'index.html must have auth-reg-otp');

  const fbConfigJs = fs.readFileSync(path.join(__dirname, 'js', 'features', 'firebase-config.js'), 'utf8');
  assert.ok(fbConfigJs.includes('initFirebaseAuth'), 'firebase-config.js must export initFirebaseAuth');
  assert.ok(fbConfigJs.includes('sendFirebasePhoneOtp'), 'firebase-config.js must export sendFirebasePhoneOtp');
  assert.ok(fbConfigJs.includes('storeUserInDatabase'), 'firebase-config.js must export storeUserInDatabase');

  const authMgrJs = fs.readFileSync(path.join(__dirname, 'js', 'features', 'auth-manager.js'), 'utf8');
  assert.ok(authMgrJs.includes('requestRegistrationOtp'), 'auth-manager.js must define requestRegistrationOtp');
  assert.ok(authMgrJs.includes('verifyRegistrationOtp'), 'auth-manager.js must define verifyRegistrationOtp');
  assert.ok(authMgrJs.includes('storeUserInDatabase'), 'auth-manager.js must call storeUserInDatabase');

  console.log('✓ All client HTML, Firebase config, and AuthManager checks passed!');
  console.log('\n🎉 ALL FIREBASE PHONE AUTH OTP & DB STORAGE TESTS PASSED!');
}

runFirebasePhoneOtpTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
