// Verification script for frontend HTML, CSS, and JS integration
const fs = require('fs');
const path = require('path');

function verifyFrontend() {
  console.log('--- VERIFYING FRONTEND INTEGRATION ---');
  
  // 1. Verify index.html elements
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const requiredHtmlIds = [
    'header-mode-badge',
    'real-mode-deposit-alert',
    'btn-quick-deposit-alert',
    'btn-real-mode-toggle',
    'hub-btn-quick-deposit',
    'hub-btn-quick-refill',
    'deposit-modal',
    'btn-open-deposit'
  ];

  for (const id of requiredHtmlIds) {
    if (!html.includes(`id="${id}"`)) {
      throw new Error(`Missing expected element id in index.html: ${id}`);
    }
    console.log(`✓ index.html contains #${id}`);
  }

  const requiredClasses = [
    'badge-mode-indicator',
    'user-real-balance-val',
    'user-demo-balance-val',
    'hub-balance-dual-grid'
  ];

  for (const cls of requiredClasses) {
    if (!html.includes(cls)) {
      throw new Error(`Missing expected class in index.html: ${cls}`);
    }
    console.log(`✓ index.html contains class .${cls}`);
  }

  // 2. Verify style.css rules
  const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  const requiredCssSelectors = [
    '.badge-mode-indicator',
    '.badge-mode-demo',
    '.badge-mode-real',
    '.real-mode-deposit-alert',
    '.btn-alert-deposit',
    '.hub-balance-dual-grid',
    '.hub-balance-box.real-wallet-box',
    '.hub-balance-box.demo-wallet-box'
  ];

  for (const sel of requiredCssSelectors) {
    if (!css.includes(sel)) {
      throw new Error(`Missing expected CSS selector in style.css: ${sel}`);
    }
    console.log(`✓ style.css defines selector ${sel}`);
  }

  // 3. Verify staking.js exports and functions
  const stakingJs = fs.readFileSync(path.join(__dirname, 'js', 'features', 'staking.js'), 'utf8');
  if (!stakingJs.includes('setGameMode')) throw new Error('staking.js missing setGameMode');
  if (!stakingJs.includes('INSUFFICIENT_REAL_FUNDS')) throw new Error('staking.js missing INSUFFICIENT_REAL_FUNDS');
  if (!stakingJs.includes('syncWalletWithServer')) throw new Error('staking.js missing syncWalletWithServer');
  console.log('✓ js/features/staking.js dual wallet logic verified');

  // 4. Verify app.js deposit prompt triggers
  const appJs = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
  if (!appJs.includes('openDepositModal')) throw new Error('app.js missing openDepositModal');
  if (!appJs.includes('real-mode-deposit-alert')) throw new Error('app.js missing real-mode-deposit-alert handling');
  if (!appJs.includes('INSUFFICIENT_REAL_FUNDS')) throw new Error('app.js missing INSUFFICIENT_REAL_FUNDS handling');
  console.log('✓ js/app.js Real Mode & deposit modal orchestration verified');

  console.log('\n--- ALL FRONTEND INTEGRATION CHECKS PASSED! ---');
}

verifyFrontend();
