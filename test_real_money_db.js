// Comprehensive test script for Real Money Mode, SQLite database, and PayHero deposit workflow
const http = require('http');

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

async function runTests() {
  console.log('--- STARTING REAL MONEY MODE & DATABASE VERIFICATION ---');
  const testPhone = '2547' + Math.floor(10000000 + Math.random() * 89999999);

  // 1. Check wallet for fresh phone
  console.log('\n[1] Checking initial wallet for test phone...');
  const walletRes1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/wallet?phone=${testPhone}`,
    method: 'GET'
  });
  console.log('Status:', walletRes1.status);
  console.log('Wallet Data:', walletRes1.data);
  if (walletRes1.data.realBalance !== 0) {
    throw new Error('Expected initial real balance to be 0');
  }

  // 2. Attempt real money bet with 0 real balance -> should fail with INSUFFICIENT_REAL_FUNDS
  console.log('\n[2] Attempting real money bet with 0 balance (expecting INSUFFICIENT_REAL_FUNDS)...');
  const betFailRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/wallet/bet',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    mode: 'REAL',
    terminalId: 1,
    amount: 100
  });
  console.log('Status:', betFailRes.status);
  console.log('Response:', betFailRes.data);
  if (betFailRes.status !== 400 || betFailRes.data.code !== 'INSUFFICIENT_REAL_FUNDS') {
    throw new Error('Failed to block real bet with zero funds');
  }
  console.log('=> Correctly blocked bet and returned INSUFFICIENT_REAL_FUNDS!');

  // 3. Initiate PayHero STK Push deposit for 500 KES
  console.log('\n[3] Initiating PayHero deposit for 500 KES...');
  const depositRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/payhero/stk-push',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    amount: 500,
    customerName: 'Test Pilot'
  });
  console.log('Deposit Response:', depositRes.data);
  const ref = depositRes.data.reference;
  if (!ref) throw new Error('Missing deposit reference');

  // 4. Confirm deposit callback to simulate M-PESA payment confirmation
  console.log('\n[4] Simulating PayHero callback confirmation...');
  const callbackRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/payhero/callback',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    external_reference: ref,
    status: 'SUCCESS',
    MpesaReceiptNumber: 'QA' + Date.now().toString().slice(-8),
    amount: 500,
    phone: testPhone
  });
  console.log('Callback Response:', callbackRes.data);

  // 5. Verify real balance was updated in SQLite
  console.log('\n[5] Verifying real balance in SQLite after deposit...');
  const walletRes2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/wallet?phone=${testPhone}`,
    method: 'GET'
  });
  console.log('Wallet Data after deposit:', walletRes2.data);
  if (walletRes2.data.realBalance !== 500) {
    throw new Error(`Expected realBalance to be 500, got ${walletRes2.data.realBalance}`);
  }
  console.log('=> Real balance verified as 500.00 KES!');

  // 6. Place a real bet of 100 KES
  console.log('\n[6] Placing a 100 KES bet in REAL mode...');
  const betSuccessRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/wallet/bet',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    mode: 'REAL',
    terminalId: 1,
    amount: 100
  });
  console.log('Bet Response:', betSuccessRes.data);
  const betId = betSuccessRes.data.betId;
  if (!betId || betSuccessRes.data.realBalance !== 400) {
    throw new Error('Bet failed or balance was not deducted to 400');
  }

  // 7. Cashout at 2.50x
  console.log('\n[7] Cashing out at 2.50x (payout = 250 KES)...');
  const cashoutRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/wallet/cashout',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    betId: betId,
    mode: 'REAL',
    multiplier: 2.50,
    payout: 250
  });
  console.log('Cashout Response:', cashoutRes.data);
  if (cashoutRes.data.realBalance !== 650) {
    throw new Error(`Expected balance 650 (400 + 250), got ${cashoutRes.data.realBalance}`);
  }
  console.log('=> Real balance accurately credited to 650.00 KES!');

  // 8. Test Database Stats
  console.log('\n[8] Checking Database Stats...');
  const statsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/database/stats',
    method: 'GET'
  });
  console.log('Database Stats:', statsRes.data);
  if (!statsRes.data || statsRes.data.totalUsers < 1) {
    throw new Error('Database stats failed');
  }

  // 9. Test Password Reset Rate Limiting (2x per week)
  console.log('\n[9] Testing 2x/week Password Reset Rate Limiting in SQLite...');
  const reset1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/reset-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    newPassword: 'SecurePassword1!'
  });
  console.log('Reset 1:', reset1.data);

  const reset2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/reset-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    newPassword: 'SecurePassword2!'
  });
  console.log('Reset 2:', reset2.data);

  const reset3 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/reset-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    phone: testPhone,
    newPassword: 'SecurePassword3!'
  });
  console.log('Reset 3 (should be blocked by rate limit):', reset3.data);
  if (reset3.status !== 429 || reset3.data.error !== 'RATE_LIMIT_EXCEEDED') {
    throw new Error('Password reset 3 was not blocked by rate limit');
  }
  console.log('=> Successfully enforced 2x/week password reset limit!');

  console.log('\n--- ALL REAL MONEY MODE & DATABASE TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
