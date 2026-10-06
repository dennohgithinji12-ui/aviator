/**
 * Spribe Aviator Official Simulator - Master Application Controller
 * Coordinates 60fps canvas engine, dual betting terminals, live stakers,
 * How to Play guide, Provably Fair cryptography, and protocol vaults.
 */

import { FlightCanvasEngine } from './engine/flight-canvas.js';
import { CrashMathEngine } from './engine/crash-math.js';
import { SoundEngine } from './engine/audio.js';
import { StakingTerminalManager } from './features/staking.js';
import { LiquidityVaultPool } from './features/vault-pool.js';
import { RolloverStakingVault } from './features/rollover-vault.js';
import { ProvablyFairUI } from './features/provably-fair.js';
import { HistoryBarComponent } from './components/history-bar.js';
import { LiveStakersComponent } from './components/live-stakers.js';
import { AuthManager } from './features/auth-manager.js';
import { GlobalRoundSyncEngine } from './engine/global-sync.js';

class AviatorApp {
  constructor() {
    this.soundEngine = new SoundEngine();
    this.crashMath = new CrashMathEngine();
    this.globalSync = new GlobalRoundSyncEngine();
    this.currentRoundData = null;
    this.roundEndTimeout = null;

    // Initialize UI Components & Subsystems
    this.initStakingManager();
    this.initCanvasEngine();
    this.initFeatures();
    this.initUIListeners();

    // Start first game round sequence
    this.startNewRoundSequence();
  }

  initStakingManager() {
    this.stakingManager = new StakingTerminalManager(
      50000,
      (newBalance, mode) => this.updateBalanceUI(newBalance, mode),
      (terminalId, terminalState, gameState, multiplier) =>
        this.updateTerminalUI(terminalId, terminalState, gameState, multiplier),
      this.soundEngine,
      (mode, balance) => this.onGameModeChanged(mode, balance)
    );
  }

  initCanvasEngine() {
    const canvas = document.getElementById('flight-canvas');
    this.canvasEngine = new FlightCanvasEngine(
      canvas,
      (multiplier, remainingSeconds) => this.onFlightTick(multiplier, remainingSeconds),
      (state, data) => this.onFlightStateChange(state, data)
    );
  }

  initFeatures() {
    // 1. Provably Fair UI
    this.provablyFairUI = new ProvablyFairUI(this.crashMath);
    this.provablyFairUI.setupEventListeners();

    // 2. Multiplier History Bar & Modal Table
    const historyContainer = document.getElementById('history-ribbon');
    this.historyBar = new HistoryBarComponent(historyContainer, (roundData) => {
      // Close history modal if open and open provably fair
      const historyModal = document.getElementById('round-history-modal');
      if (historyModal) historyModal.classList.remove('show');
      this.provablyFairUI.inspectHistoricalRound(roundData);
    });

    // 3. Live Community Stakers Feed
    const stakersContainer = document.getElementById('live-stakers-container');
    this.liveStakers = new LiveStakersComponent(stakersContainer, this.stakingManager);

    // 4. Liquidity Vault Pool
    this.liquidityVault = new LiquidityVaultPool(
      this.stakingManager,
      this.soundEngine,
      (vaultState) => this.updateLiquidityVaultUI(vaultState)
    );

    // 5. Rollover Staking Vault
    this.rolloverVault = new RolloverStakingVault(
      this.stakingManager,
      this.soundEngine,
      (rolloverState) => this.updateRolloverUI(rolloverState)
    );

    // 6. Aviator Native Player Authentication & Session Manager
    this.authManager = new AuthManager(
      this.stakingManager,
      this.soundEngine,
      (user) => {
        if (user) {
          console.log('[Aviator] Player authenticated:', user.username);
        }
      }
    );
    this.puterAuth = this.authManager;
  }

  // Orchestrate globally synchronized game round cycle across all users
  startNewRoundSequence() {
    if (this.roundEndTimeout) {
      clearTimeout(this.roundEndTimeout);
      this.roundEndTimeout = null;
    }

    // 1. Fetch current global authoritative round state (identical for all users worldwide)
    const globalState = this.globalSync.getGlobalRoundState();
    this.currentRoundData = {
      nonce: globalState.nonce,
      crashMultiplier: globalState.crashMultiplier,
      serverHash: globalState.serverHash,
      serverSeed: globalState.serverSeed,
      clientSeed: globalState.clientSeed,
      flightDuration: globalState.flightDuration,
      roundStartTime: globalState.roundStartTime,
      roundEndTime: globalState.roundEndTime
    };

    // 2. Update Provably Fair UI indicators
    const currentHashEl = document.getElementById('pf-current-server-hash');
    if (currentHashEl) currentHashEl.textContent = this.currentRoundData.serverHash;
    const currentClientSeedEl = document.getElementById('pf-current-client-seed');
    if (currentClientSeedEl) currentClientSeedEl.textContent = this.currentRoundData.clientSeed;
    const currentNonceEl = document.getElementById('pf-current-nonce');
    if (currentNonceEl) currentNonceEl.textContent = this.currentRoundData.nonce;

    // 3. Broadcast upcoming crash stop to VIP Predictor Mobile App (100% accuracy sync)
    try {
      const syncData = {
        type: 'ROUND_PREPARED',
        nonce: this.currentRoundData.nonce,
        crashMultiplier: this.currentRoundData.crashMultiplier,
        serverHash: this.currentRoundData.serverHash,
        countdown: globalState.remainingSeconds,
        timestamp: Date.now()
      };
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel('aviator_vip_predictor_channel').postMessage(syncData);
      }
      localStorage.setItem('aviator_vip_live_prediction', JSON.stringify(syncData));
    } catch (e) {
      console.warn('VIP Predictor broadcast sync notice:', e);
    }

    // 4. Synchronize Flight Phase with Global Timeline
    if (globalState.phase === 'WAITING') {
      this.stakingManager.onRoundWaiting();
      this.liveStakers.generateRoundStakers();
      this.lastCountdownSecond = -1;
      this.canvasEngine.startCountdown(5.0, this.currentRoundData.crashMultiplier, globalState.remainingSeconds);
    } else if (globalState.phase === 'FLYING') {
      this.liveStakers.generateRoundStakers();
      this.soundEngine.startEngine();
      this.soundEngine.updateEnginePitch(globalState.currentMultiplier);
      this.stakingManager.onFlightStart();
      this.canvasEngine.startFlight(this.currentRoundData.crashMultiplier, globalState.elapsedFlightSeconds);
    } else {
      // In 3.2s crashed pause - wait until scheduled end and launch next round
      const delay = Math.max(500, globalState.roundEndTime - this.globalSync.getNow());
      this.roundEndTimeout = setTimeout(() => this.startNewRoundSequence(), delay);
    }
  }

  onFlightTick(multiplier, remainingSeconds) {
    const bnavMult = document.getElementById('bnav-live-multiplier');
    if (this.canvasEngine.state === 'WAITING') {
      const ceilSec = Math.ceil(remainingSeconds);
      if (ceilSec > 0 && ceilSec !== this.lastCountdownSecond) {
        this.lastCountdownSecond = ceilSec;
        this.soundEngine.playCountdownTick(ceilSec);
      }
      if (bnavMult) bnavMult.textContent = `● ${ceilSec}s`;
    } else if (this.canvasEngine.state === 'FLYING') {
      this.soundEngine.updateEnginePitch(multiplier);
      this.stakingManager.onFlightTick(multiplier);
      this.liveStakers.onFlightTick(multiplier);
      this.rolloverVault.checkFlightProgress(multiplier);
      if (bnavMult) bnavMult.textContent = `● ${multiplier.toFixed(2)}x`;
    }
  }

  onFlightStateChange(newState, data) {
    const skipBtn = document.getElementById('btn-skip-countdown');
    if (skipBtn) {
      skipBtn.style.display = (newState === 'WAITING') ? 'flex' : 'none';
    }

    const bnavMult = document.getElementById('bnav-live-multiplier');

    if (newState === 'WAITING') {
      if (bnavMult) bnavMult.textContent = '● Wait';
    } else if (newState === 'FLYING') {
      this.soundEngine.playTakeoff();
      this.soundEngine.startEngine();
      this.stakingManager.onFlightStart();
      if (bnavMult) bnavMult.textContent = '● 1.00x';
      try {
        const syncData = { type: 'ROUND_FLYING', nonce: this.currentRoundData?.nonce, timestamp: Date.now() };
        if (typeof BroadcastChannel !== 'undefined') {
          new BroadcastChannel('aviator_vip_predictor_channel').postMessage(syncData);
        }
      } catch (e) {}
    } else if (newState === 'CRASHED') {
      const finalMultiplier = data.finalMultiplier;
      if (bnavMult) bnavMult.textContent = `● ${finalMultiplier.toFixed(2)}x`;
      this.soundEngine.playCrash();
      this.stakingManager.onFlightCrash(finalMultiplier);
      this.liveStakers.onFlightCrash(finalMultiplier);
      this.rolloverVault.checkFlightCrash(finalMultiplier);

      // Inform VIP Predictor of confirmed crash stop
      try {
        const crashData = {
          type: 'ROUND_CRASHED',
          finalMultiplier: finalMultiplier,
          nonce: this.currentRoundData.nonce,
          timestamp: Date.now()
        };
        if (typeof BroadcastChannel !== 'undefined') {
          new BroadcastChannel('aviator_vip_predictor_channel').postMessage(crashData);
        }
        localStorage.setItem('aviator_vip_confirmed_stop', JSON.stringify(crashData));
      } catch (e) {}

      // Record in history ribbon & modal
      this.historyBar.addRound({
        nonce: this.currentRoundData.nonce,
        crashMultiplier: finalMultiplier,
        serverSeed: this.currentRoundData.serverSeed,
        clientSeed: this.currentRoundData.clientSeed,
        serverHash: this.currentRoundData.serverHash,
        timestamp: new Date()
      });

      // Distribute simulated house volume fees to liquidity stakers
      const simulatedVolume = 12000 + Math.floor(Math.random() * 25000);
      this.liquidityVault.distributeRoundYield(simulatedVolume);

      // Seamlessly transition to next global round at exact scheduled round end
      const stateNow = this.globalSync.getGlobalRoundState();
      const delay = Math.max(1000, stateNow.roundEndTime - this.globalSync.getNow());
      this.roundEndTimeout = setTimeout(() => {
        this.startNewRoundSequence();
      }, delay);
    }
  }

  // Update UI Elements
  updateBalanceUI(balance, mode = this.stakingManager?.gameMode || 'DEMO') {
    const balElems = document.querySelectorAll('.user-balance-value');
    const isReal = (mode === 'REAL');
    balElems.forEach(el => {
      el.textContent = `${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KES`;
    });

    const realBalEls = document.querySelectorAll('.user-real-balance-val');
    realBalEls.forEach(el => {
      el.textContent = `${(this.stakingManager?.realBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KES`;
    });

    const demoBalEls = document.querySelectorAll('.user-demo-balance-val');
    demoBalEls.forEach(el => {
      el.textContent = `${(this.stakingManager?.demoBalance || 50000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KES`;
    });

    const modeBadges = document.querySelectorAll('.badge-mode-indicator');
    modeBadges.forEach(b => {
      b.className = `badge-mode-indicator ${isReal ? 'badge-mode-real' : 'badge-mode-demo'}`;
      b.textContent = isReal ? 'REAL' : 'DEMO';
    });

    const realAlertBanner = document.getElementById('real-mode-deposit-alert');
    if (realAlertBanner) {
      realAlertBanner.style.display = (isReal && (this.stakingManager?.realBalance || 0) < 100) ? 'flex' : 'none';
    }
  }

  onGameModeChanged(mode, balance) {
    const isReal = (mode === 'REAL');
    const realModeBtn = document.getElementById('btn-real-mode-toggle');
    const funBanner = document.querySelector('.shiftstack-fun-banner') || document.querySelector('.kessbet-fun-banner');
    if (funBanner) {
      funBanner.textContent = isReal ? 'REAL MONEY MODE' : 'FUN MODE';
      funBanner.style.background = isReal ? '#22c55e' : '#f59e0b';
    }
    if (realModeBtn) {
      realModeBtn.textContent = isReal ? 'Fun >' : 'Real >';
      realModeBtn.classList.toggle('active-real', isReal);
    }
    this.updateBalanceUI(balance, mode);
  }

  openDepositModal(initialAmount = 49) {
    const depositModal = document.getElementById('deposit-modal');
    if (!depositModal) return;
    depositModal.classList.add('show');
    const depositAmtInput = document.getElementById('deposit-amount-input');
    const btnConfirmDeposit = document.getElementById('btn-confirm-deposit');
    const btnConfirmDepositText = document.getElementById('btn-confirm-deposit-text');
    const depositChips = document.querySelectorAll('.btn-deposit-chip');
    const depositStatusMsg = document.getElementById('deposit-status-msg');

    const amt = Math.max(49, parseFloat(initialAmount) || 49);
    if (depositAmtInput) {
      depositAmtInput.value = amt;
    }
    if (btnConfirmDepositText) {
      btnConfirmDepositText.textContent = `Deposit KES ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
    if (btnConfirmDeposit) {
      btnConfirmDeposit.style.opacity = '1';
    }
    depositChips.forEach(c => {
      const chipVal = parseFloat(c.getAttribute('data-amount'));
      c.classList.toggle('active', chipVal === amt);
    });
    if (depositStatusMsg) {
      depositStatusMsg.className = 'deposit-status-msg';
      depositStatusMsg.textContent = `Ready to deposit KES ${amt.toLocaleString()} via PayHero M-PESA.`;
      depositStatusMsg.style.display = 'block';
    }
    this.soundEngine?.playClick();
  }

  updateTerminalUI(id, t, gameState, multiplier) {
    const termEl = document.getElementById(`terminal-${id}`);
    if (!termEl) return;

    // Amount input
    const inputEl = termEl.querySelector('.terminal-stake-input');
    if (inputEl && document.activeElement !== inputEl) {
      inputEl.value = t.amount;
    }

    // Action button
    const actionBtn = termEl.querySelector('.btn-terminal-action');
    if (!actionBtn) return;

    let targetClass = 'state-stake';
    let mainText = 'BET';
    let subText = `${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} KES`;

    if (gameState === 'WAITING') {
      if (t.staked) {
        targetClass = 'state-cancel';
        mainText = 'CANCEL';
        subText = `${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} KES`;
      } else {
        targetClass = 'state-stake';
        mainText = 'BET';
        subText = `${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} KES`;
      }
    } else if (gameState === 'FLYING') {
      if (t.staked && !t.cashedOut) {
        const livePayout = Math.floor(t.amount * multiplier * 100) / 100;
        targetClass = 'state-cashout';
        mainText = 'CASH OUT';
        subText = `${livePayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KES`;
      } else if (t.cashedOut) {
        targetClass = 'state-cashed';
        mainText = 'CASHED OUT';
        subText = `+${t.payout.toLocaleString('en-US', { minimumFractionDigits: 2 })} KES`;
      } else {
        targetClass = 'state-waiting-next';
        mainText = 'WAITING';
        subText = 'Next Round';
      }
    } else if (gameState === 'CRASHED') {
      if (t.staked && !t.cashedOut) {
        targetClass = 'state-lost';
        mainText = 'FLEW AWAY';
        subText = `-${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} KES`;
      } else if (t.cashedOut) {
        targetClass = 'state-cashed';
        mainText = 'WON';
        subText = `+${t.payout.toLocaleString('en-US', { minimumFractionDigits: 2 })} KES`;
      } else {
        targetClass = 'state-waiting-next';
        mainText = 'ROUND ENDED';
        subText = 'Next Round...';
      }
    }

    const expectedClassName = `btn-terminal-action ${targetClass}`;
    if (actionBtn.className !== expectedClassName) {
      actionBtn.className = expectedClassName;
    }

    let mainEl = actionBtn.querySelector('.action-btn-main');
    let subEl = actionBtn.querySelector('.action-btn-sub');

    if (!mainEl || !subEl) {
      actionBtn.innerHTML = `
        <div class="action-btn-main">${mainText}</div>
        <div class="action-btn-sub">${subText}</div>
      `;
    } else {
      if (mainEl.textContent !== mainText) mainEl.textContent = mainText;
      if (subEl.textContent !== subText) subEl.textContent = subText;
    }
  }

  updateLiquidityVaultUI(state) {
    const stakedEl = document.getElementById('vault-user-staked');
    const yieldEl = document.getElementById('vault-accrued-yield');
    const tvlEl = document.getElementById('vault-pool-tvl');
    const apyEl = document.getElementById('vault-pool-apy');
    const volumeEl = document.getElementById('vault-24h-volume');

    if (stakedEl) stakedEl.textContent = `KES ${state.userStaked.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (yieldEl) yieldEl.textContent = `+KES ${state.accruedYield.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (tvlEl) tvlEl.textContent = `KES ${(state.poolTVL / 1000000).toFixed(1)}M`;
    if (apyEl) apyEl.textContent = `${state.baseAPY.toFixed(1)}% APY`;
    if (volumeEl) volumeEl.textContent = `KES ${(state.volume24h / 1000000).toFixed(2)}M`;
  }

  updateRolloverUI(state) {
    const statusBanner = document.getElementById('rollover-status-message');
    const startBtn = document.getElementById('btn-start-rollover');
    const stopBtn = document.getElementById('btn-stop-rollover');
    const ladderContainer = document.getElementById('rollover-ladder-container');

    if (statusBanner) {
      statusBanner.textContent = state.message || (state.active ? `Stage ${state.currentStage} Active • Target ${state.targetMultiplier}x` : 'Configure parameters and launch Compounding Rollover Challenge');
    }

    if (startBtn && stopBtn) {
      if (state.active) {
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-flex';
      } else {
        startBtn.style.display = 'inline-flex';
        stopBtn.style.display = 'none';
      }
    }

    if (ladderContainer) {
      ladderContainer.innerHTML = state.stages.map(s => `
        <div class="ladder-stage-card ${s.status.toLowerCase()}">
          <div class="stage-badge">STAGE ${s.stage}</div>
          <div class="stage-info">
            <span class="stage-stake">Stake: KES ${s.stake.toLocaleString()}</span>
            <span class="stage-target">Target: ${s.targetMultiplier.toFixed(2)}x</span>
          </div>
          <div class="stage-payout">
            <span class="stage-payout-label">Payout:</span>
            <span class="stage-payout-val">KES ${s.projectedPayout.toLocaleString()}</span>
          </div>
          <div class="stage-status-tag">${s.status}</div>
        </div>
      `).join('');
    }
  }

  initUIListeners() {
    // 1. Brand Home Link
    const brandHome = document.getElementById('brand-home-link');
    if (brandHome) {
      brandHome.addEventListener('click', () => {
        this.switchView('terminal');
      });
    }

    // 2. Deposit Funds Modal & Top-Up (Min KES 500.00)
    const depositModal = document.getElementById('deposit-modal');
    const openDepositBtns = [
      document.getElementById('btn-open-deposit'),
      document.getElementById('menu-btn-deposit'),
      document.getElementById('btn-top-up')
    ];
    const closeDepositBtn = document.getElementById('btn-close-deposit');
    const depositAmtInput = document.getElementById('deposit-amount-input');
    const depositChips = document.querySelectorAll('.btn-deposit-chip');
    const depositMethodBtns = document.querySelectorAll('.deposit-method-btn');
    const btnConfirmDeposit = document.getElementById('btn-confirm-deposit');
    const btnConfirmDepositText = document.getElementById('btn-confirm-deposit-text');
    const depositStatusMsg = document.getElementById('deposit-status-msg');
    const depositPhoneContainer = document.getElementById('deposit-phone-container');

    const updateDepositAmount = (val) => {
      const amt = Math.max(0, parseFloat(val) || 0);
      if (depositAmtInput && document.activeElement !== depositAmtInput) {
        depositAmtInput.value = amt;
      }
      if (btnConfirmDepositText) {
        btnConfirmDepositText.textContent = `Deposit KES ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      }

      depositChips.forEach(c => {
        const chipVal = parseFloat(c.getAttribute('data-amount'));
        c.classList.toggle('active', chipVal === amt);
      });

      if (amt < 49) {
        if (depositStatusMsg) {
          depositStatusMsg.className = 'deposit-status-msg error';
          depositStatusMsg.textContent = 'Minimum deposit is KES 49.00 (49 Bob). Please enter at least 49.';
          depositStatusMsg.style.display = 'block';
        }
        if (btnConfirmDeposit) btnConfirmDeposit.style.opacity = '0.6';
      } else {
        if (depositStatusMsg) {
          depositStatusMsg.className = 'deposit-status-msg';
          depositStatusMsg.textContent = `Ready to deposit KES ${amt.toLocaleString()} via PayHero M-PESA.`;
          depositStatusMsg.style.display = 'block';
        }
        if (btnConfirmDeposit) btnConfirmDeposit.style.opacity = '1';
      }
    };

    openDepositBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          const menu = document.getElementById('spribe-dropdown-menu');
          if (menu) menu.classList.remove('show');
          depositModal?.classList.add('show');
          updateDepositAmount(depositAmtInput?.value || 49);
          this.soundEngine.playClick();
        });
      }
    });

    if (closeDepositBtn && depositModal) {
      closeDepositBtn.addEventListener('click', () => {
        depositModal.classList.remove('show');
      });
      depositModal.addEventListener('click', (e) => {
        if (e.target === depositModal) depositModal.classList.remove('show');
      });
    }

    depositMethodBtns.forEach(mBtn => {
      mBtn.addEventListener('click', () => {
        depositMethodBtns.forEach(b => b.classList.remove('active'));
        mBtn.classList.add('active');
        const method = mBtn.getAttribute('data-method');
        if (depositPhoneContainer) {
          depositPhoneContainer.style.display = (method === 'mpesa' || method === 'airtel') ? 'block' : 'none';
        }
        this.soundEngine.playClick();
      });
    });

    depositChips.forEach(chip => {
      chip.addEventListener('click', () => {
        depositChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const val = parseFloat(chip.getAttribute('data-amount'));
        if (depositAmtInput) depositAmtInput.value = val;
        updateDepositAmount(val);
        this.soundEngine.playClick();
      });
    });

    if (depositAmtInput) {
      depositAmtInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        updateDepositAmount(val);
        depositChips.forEach(c => {
          c.classList.toggle('active', parseFloat(c.getAttribute('data-amount')) === val);
        });
      });
    }

    // PayHero STK Push Deposit Handler (Minimum 49 Bob)
    if (btnConfirmDeposit) {
      btnConfirmDeposit.addEventListener('click', async () => {
        const amt = parseFloat(depositAmtInput?.value || 0);
        const phoneInp = document.getElementById('deposit-phone-input');
        const rawPhone = phoneInp?.value || '';

        // Strict 49 Bob (KES 49) minimum check
        if (isNaN(amt) || amt < 49) {
          if (depositStatusMsg) {
            depositStatusMsg.className = 'deposit-status-msg error';
            depositStatusMsg.textContent = 'Minimum deposit is KES 49.00 (49 Bob). Please enter 49 KES or more.';
            depositStatusMsg.style.display = 'block';
          }
          this.soundEngine?.playClick();
          return;
        }

        if (!rawPhone || rawPhone.trim().length < 9) {
          if (depositStatusMsg) {
            depositStatusMsg.className = 'deposit-status-msg error';
            depositStatusMsg.textContent = 'Please enter a valid Kenyan phone number (e.g. 0712 345 678).';
            depositStatusMsg.style.display = 'block';
          }
          return;
        }

        if (depositStatusMsg) {
          depositStatusMsg.style.display = 'none';
        }

        // Show STK Push progress UI
        btnConfirmDeposit.disabled = true;
        btnConfirmDeposit.innerHTML = `<span class="btn-dep-icon">⏳</span><span>Requesting STK Push...</span>`;

        const waitingCard = document.getElementById('payhero-stk-waiting');
        const promptAmountEl = document.getElementById('stk-prompt-amount');
        const promptRefEl = document.getElementById('stk-prompt-ref');

        if (promptAmountEl) promptAmountEl.textContent = `KES ${amt.toFixed(2)}`;

        try {
          // Send STK Push request to backend PayHero endpoint
          const res = await fetch('/api/payhero/stk-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: rawPhone,
              amount: amt,
              customerName: this.authManager?.user?.username || 'Aviator Pilot'
            })
          });

          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || 'Failed to initiate PayHero deposit');
          }

          if (waitingCard) waitingCard.style.display = 'block';
          if (promptRefEl) promptRefEl.textContent = data.reference;

          btnConfirmDeposit.innerHTML = `<span class="btn-dep-icon">📲</span><span>Awaiting M-PESA PIN...</span>`;

          // Poll for transaction confirmation
          const ref = data.reference;
          let pollAttempts = 0;
          const maxPolls = 25; // ~37 seconds

          const pollInterval = setInterval(async () => {
            pollAttempts++;
            try {
              const statusRes = await fetch(`/api/payhero/status?ref=${encodeURIComponent(ref)}`);
              const statusData = await statusRes.json();

              if (statusData.status === 'SUCCESS') {
                clearInterval(pollInterval);

                // Deposit confirmed into SQLite database & local wallet!
                this.stakingManager.topUp(amt, true);
                this.stakingManager.setGameMode('REAL');
                if (typeof updateRealModeUI === 'function') {
                  updateRealModeUI('REAL');
                }

                if (this.authManager?.user) {
                  this.authManager.user.balance = this.stakingManager.realBalance;
                  this.authManager.user.realBalance = this.stakingManager.realBalance;
                }

                if (waitingCard) waitingCard.style.display = 'none';
                depositModal?.classList.remove('show');
                btnConfirmDeposit.disabled = false;
                btnConfirmDeposit.innerHTML = `<span class="btn-dep-icon">⚡</span><span>Deposit KES ${amt.toFixed(2)} via PayHero</span>`;

                const receipt = statusData.receiptNumber || 'M-PESA';
                this.authManager?.showToast(`🎉 Deposit Confirmed! +KES ${amt.toLocaleString()} credited to your REAL MONEY wallet via PayHero (Ref: ${receipt}).`);
                return;
              }

              if (statusData.status === 'FAILED') {
                clearInterval(pollInterval);
                if (waitingCard) waitingCard.style.display = 'none';
                btnConfirmDeposit.disabled = false;
                btnConfirmDeposit.innerHTML = `<span class="btn-dep-icon">⚡</span><span>Try Again</span>`;
                if (depositStatusMsg) {
                  depositStatusMsg.className = 'deposit-status-msg error';
                  depositStatusMsg.textContent = 'M-PESA STK Push was cancelled or timed out. Please try again.';
                  depositStatusMsg.style.display = 'block';
                }
                return;
              }

              if (pollAttempts >= maxPolls) {
                clearInterval(pollInterval);
                if (waitingCard) waitingCard.style.display = 'none';
                btnConfirmDeposit.disabled = false;
                btnConfirmDeposit.innerHTML = `<span class="btn-dep-icon">⚡</span><span>Check Again</span>`;
                if (depositStatusMsg) {
                  depositStatusMsg.className = 'deposit-status-msg error';
                  depositStatusMsg.textContent = 'Payment confirmation is taking longer than usual. Please check your M-PESA SMS.';
                  depositStatusMsg.style.display = 'block';
                }
              }
            } catch (pollErr) {
              console.warn('[PayHero Poll Error]:', pollErr);
            }
          }, 1500);

        } catch (err) {
          btnConfirmDeposit.disabled = false;
          btnConfirmDeposit.innerHTML = `<span class="btn-dep-icon">⚡</span><span>Deposit KES ${amt.toFixed(2)} via PayHero</span>`;
          if (waitingCard) waitingCard.style.display = 'none';
          if (depositStatusMsg) {
            depositStatusMsg.className = 'deposit-status-msg error';
            depositStatusMsg.textContent = err.message || 'Deposit error. Please check your connection.';
            depositStatusMsg.style.display = 'block';
          }
        }
      });
    }

    // 3. Audio & Music Toggles
    const soundBtn = document.getElementById('btn-toggle-sound');
    const menuSwitchSound = document.getElementById('menu-switch-sound');
    const updateSoundUI = (isMuted) => {
      if (soundBtn) {
        soundBtn.classList.toggle('muted', isMuted);
        soundBtn.innerHTML = isMuted
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
      }
      if (menuSwitchSound) {
        menuSwitchSound.checked = !isMuted;
      }
    };

    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const isMuted = this.soundEngine.toggleSound();
        updateSoundUI(isMuted);
      });
    }
    if (menuSwitchSound) {
      menuSwitchSound.addEventListener('change', () => {
        const isMuted = this.soundEngine.toggleSound();
        updateSoundUI(isMuted);
      });
    }

    const musicBtn = document.getElementById('btn-toggle-music');
    const menuSwitchMusic = document.getElementById('menu-switch-music');
    const updateMusicUI = (isMuted) => {
      if (musicBtn) {
        musicBtn.classList.toggle('muted', isMuted);
        musicBtn.innerHTML = isMuted
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle><line x1="2" y1="2" x2="22" y2="22"></line></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
      }
      if (menuSwitchMusic) {
        menuSwitchMusic.checked = !isMuted;
      }
    };

    if (musicBtn) {
      musicBtn.addEventListener('click', () => {
        const isMuted = this.soundEngine.toggleMusic();
        updateMusicUI(isMuted);
      });
    }
    if (menuSwitchMusic) {
      menuSwitchMusic.addEventListener('change', () => {
        const isMuted = this.soundEngine.toggleMusic();
        updateMusicUI(isMuted);
      });
    }

    // 4. Hamburger Settings Menu
    const hamburgerBtn = document.getElementById('btn-hamburger');
    const dropdownMenu = document.getElementById('spribe-dropdown-menu');
    if (hamburgerBtn && dropdownMenu) {
      hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
      });
      document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && e.target !== hamburgerBtn) {
          dropdownMenu.classList.remove('show');
        }
      });
    }

    // Reset Balance from Menu
    const menuBtnReset = document.getElementById('menu-btn-reset');
    if (menuBtnReset) {
      menuBtnReset.addEventListener('click', () => {
        dropdownMenu?.classList.remove('show');
        if (confirm('Reset demo balance to KES 50,000.00?')) {
          this.stakingManager.resetBalance(50000);
        }
      });
    }

    // 5. "How to Play?" Modal
    const howToPlayModal = document.getElementById('how-to-play-modal');
    const openHowBtns = [document.getElementById('btn-how-to-play'), document.getElementById('menu-btn-how')];
    const closeHowBtn = document.getElementById('btn-close-how');

    openHowBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          dropdownMenu?.classList.remove('show');
          howToPlayModal?.classList.add('show');
          this.soundEngine.playClick();
        });
      }
    });

    if (closeHowBtn && howToPlayModal) {
      closeHowBtn.addEventListener('click', () => {
        howToPlayModal.classList.remove('show');
      });
      howToPlayModal.addEventListener('click', (e) => {
        if (e.target === howToPlayModal) howToPlayModal.classList.remove('show');
      });
    }

    // 6. Round History Modal
    const roundHistoryModal = document.getElementById('round-history-modal');
    const openHistoryBtns = [document.getElementById('btn-open-round-history'), document.getElementById('menu-btn-history')];
    const closeHistoryBtn = document.getElementById('btn-close-round-history');

    openHistoryBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          dropdownMenu?.classList.remove('show');
          roundHistoryModal?.classList.add('show');
          this.historyBar.renderHistoryTable();
          this.soundEngine.playClick();
        });
      }
    });

    if (closeHistoryBtn && roundHistoryModal) {
      closeHistoryBtn.addEventListener('click', () => {
        roundHistoryModal.classList.remove('show');
      });
      roundHistoryModal.addEventListener('click', (e) => {
        if (e.target === roundHistoryModal) roundHistoryModal.classList.remove('show');
      });
    }

    // 7. Provably Fair Modal trigger from menu
    const menuBtnPf = document.getElementById('menu-btn-pf');
    if (menuBtnPf) {
      menuBtnPf.addEventListener('click', () => {
        dropdownMenu?.classList.remove('show');
        const pfModal = document.getElementById('pf-modal');
        if (pfModal) pfModal.classList.add('show');
        this.soundEngine.playClick();
      });
    }

    // 8. Terminal 2 Toggle (Spribe Exact Feature: Add/Hide 2nd Bet Panel)
    const terminal2 = document.getElementById('terminal-2');
    const btnHideTerm2 = document.getElementById('btn-hide-terminal-2');
    const btnShowTerm2 = document.getElementById('btn-show-terminal-2');

    const updateTerm2Visibility = (show) => {
      if (!terminal2) return;
      if (show) {
        terminal2.style.display = 'flex';
        if (btnShowTerm2) btnShowTerm2.style.display = 'none';
      } else {
        terminal2.style.display = 'none';
        if (btnShowTerm2) btnShowTerm2.style.display = 'inline-flex';
      }
    };

    if (btnHideTerm2) {
      btnHideTerm2.addEventListener('click', () => {
        updateTerm2Visibility(false);
        this.soundEngine.playClick();
      });
    }
    if (btnShowTerm2) {
      btnShowTerm2.addEventListener('click', () => {
        updateTerm2Visibility(true);
        this.soundEngine.playClick();
      });
    }

    // 9. Instant Launch / Skip Countdown
    const skipBtn = document.getElementById('btn-skip-countdown');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        if (this.canvasEngine.state === 'WAITING') {
          this.canvasEngine.startFlight(this.currentRoundData?.crashMultiplier || 2.00);
        }
      });
    }

    // 10. Navigation View Switcher (Game vs Liquidity vs Rollover)
    const navTabs = document.querySelectorAll('.nav-tab-btn');
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetView = tab.getAttribute('data-view');
        this.switchView(targetView);
        const menu = document.getElementById('spribe-dropdown-menu');
        if (menu) menu.classList.remove('show');
      });
    });

    // 11. Stakers Feed Tabs (All Bets, My Bets, Top Wins)
    const stakerTabs = document.querySelectorAll('.stakers-tab-btn');
    stakerTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        stakerTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.liveStakers.setTab(tab.getAttribute('data-tab'));
        this.soundEngine.playClick();
      });
    });

    // 12. Betting Terminals 1 & 2 Controls Setup
    [1, 2].forEach(id => {
      const termEl = document.getElementById(`terminal-${id}`);
      if (!termEl) return;

      // Mode tabs: Bet vs Auto
      const manualTab = termEl.querySelector('.tab-manual');
      const autoTab = termEl.querySelector('.tab-auto');
      const autoControls = termEl.querySelector('.auto-controls-panel');
      const quickChips = termEl.querySelector('.quick-chips-grid');

      if (manualTab && autoTab && autoControls) {
        manualTab.addEventListener('click', () => {
          manualTab.classList.add('active');
          autoTab.classList.remove('active');
          autoControls.style.display = 'none';
          if (quickChips) quickChips.style.display = 'grid';
          this.stakingManager.setMode(id, 'manual');
        });

        autoTab.addEventListener('click', () => {
          autoTab.classList.add('active');
          manualTab.classList.remove('active');
          if (quickChips) quickChips.style.display = 'none';
          autoControls.style.display = 'flex';
          this.stakingManager.setMode(id, 'auto');
        });
      }

      // Stepper Buttons (- and + by 50 KES, clamped at min 100)
      const btnMinus = termEl.querySelector('.btn-step-minus');
      const btnPlus = termEl.querySelector('.btn-step-plus');
      if (btnMinus) btnMinus.addEventListener('click', () => this.stakingManager.adjustAmount(id, -50));
      if (btnPlus) btnPlus.addEventListener('click', () => this.stakingManager.adjustAmount(id, 50));

      // Quick Chips (100, 200, 500, 10000)
      termEl.querySelectorAll('.chip-btn').forEach(chip => {
        chip.addEventListener('click', () => {
          const val = chip.getAttribute('data-val');
          this.stakingManager.setAmount(id, parseFloat(val));
        });
      });

      // Direct Input
      const stakeInput = termEl.querySelector('.terminal-stake-input');
      if (stakeInput) {
        stakeInput.addEventListener('change', (e) => {
          this.stakingManager.setAmount(id, parseFloat(e.target.value));
        });
      }

      // Auto Toggles
      const autoStakeCheck = termEl.querySelector('.check-auto-stake');
      if (autoStakeCheck) {
        autoStakeCheck.addEventListener('change', (e) => {
          this.stakingManager.toggleAutoStake(id, e.target.checked);
        });
      }

      const autoCashCheck = termEl.querySelector('.check-auto-cashout');
      const autoCashInput = termEl.querySelector('.input-auto-cashout');
      if (autoCashCheck) {
        autoCashCheck.addEventListener('change', (e) => {
          this.stakingManager.toggleAutoCashout(id, e.target.checked);
        });
      }
      if (autoCashInput) {
        autoCashInput.addEventListener('change', (e) => {
          this.stakingManager.setAutoCashoutMultiplier(id, parseFloat(e.target.value));
        });
      }

      // Giant Action Button
      const actionBtn = termEl.querySelector('.btn-terminal-action');
      if (actionBtn) {
        actionBtn.addEventListener('click', () => {
          const res = this.stakingManager.handleActionClick(id);
          if (res && res.success === false) {
            if (res.reason === 'INSUFFICIENT_REAL_FUNDS') {
              this.authManager?.showToast(`⚠️ Insufficient Real Money Balance (KES ${res.balance.toFixed(2)}). Please deposit at least KES 49.00 via PayHero M-PESA to place this KES ${this.stakingManager.getTerminal(id).amount} bet.`);
              // Automatically request and open PayHero deposit modal!
              this.openDepositModal(Math.max(49, this.stakingManager.getTerminal(id).amount));
            } else if (res.reason === 'INSUFFICIENT_DEMO_FUNDS') {
              this.authManager?.showToast(`⚠️ Insufficient demo balance (KES ${res.balance.toFixed(2)}). Refill your 50,000 demo funds in the Account Hub.`);
            } else if (res.reason === 'MIN_STAKE') {
              this.authManager?.showToast('⚠️ Minimum stake is KES 100.00.');
            }
          }
        });
      }
    });

    // 13. Liquidity Pool Actions
    const btnStakeVault = document.getElementById('btn-vault-stake');
    const inputVaultStake = document.getElementById('input-vault-stake');
    if (btnStakeVault && inputVaultStake) {
      btnStakeVault.addEventListener('click', () => {
        const amt = parseFloat(inputVaultStake.value);
        if (this.liquidityVault.stake(amt)) {
          alert(`Successfully staked KES ${amt.toLocaleString()} into Liquidity Vault!`);
          inputVaultStake.value = '';
        }
      });
    }

    const btnUnstakeVault = document.getElementById('btn-vault-unstake');
    const inputVaultUnstake = document.getElementById('input-vault-unstake');
    if (btnUnstakeVault && inputVaultUnstake) {
      btnUnstakeVault.addEventListener('click', () => {
        const amt = parseFloat(inputVaultUnstake.value);
        if (this.liquidityVault.unstake(amt)) {
          alert(`Successfully unstaked KES ${amt.toLocaleString()} back to your wallet!`);
          inputVaultUnstake.value = '';
        }
      });
    }

    const btnClaimYield = document.getElementById('btn-vault-claim-yield');
    if (btnClaimYield) {
      btnClaimYield.addEventListener('click', () => {
        const claimed = this.liquidityVault.claimYield();
        if (claimed) {
          alert(`Claimed +KES ${claimed.toFixed(2)} in passive yield!`);
        }
      });
    }

    // 14. Rollover Vault Actions
    const btnStartRollover = document.getElementById('btn-start-rollover');
    const btnStopRollover = document.getElementById('btn-stop-rollover');
    const inputBaseStake = document.getElementById('rollover-base-stake');
    const inputTargetMult = document.getElementById('rollover-target-mult');
    const inputStages = document.getElementById('rollover-stages');

    if (inputBaseStake && inputTargetMult && inputStages) {
      const updateConfig = () => {
        this.rolloverVault.configure(
          inputBaseStake.value,
          inputTargetMult.value,
          inputStages.value
        );
      };
      inputBaseStake.addEventListener('input', updateConfig);
      inputTargetMult.addEventListener('input', updateConfig);
      inputStages.addEventListener('input', updateConfig);
    }

    if (btnStartRollover) {
      btnStartRollover.addEventListener('click', () => {
        this.rolloverVault.startRollover();
      });
    }

    if (btnStopRollover) {
      btnStopRollover.addEventListener('click', () => {
        this.rolloverVault.stopRollover();
      });
    }

    // 15. Game Limits Modal (From Hamburger Menu)
    const limitsModal = document.getElementById('game-limits-modal');
    const menuBtnLimits = document.getElementById('menu-btn-limits');
    const btnCloseLimits = document.getElementById('btn-close-limits');
    if (menuBtnLimits && limitsModal) {
      menuBtnLimits.addEventListener('click', () => {
        document.getElementById('spribe-dropdown-menu')?.classList.remove('show');
        limitsModal.classList.add('show');
        this.soundEngine.playClick();
      });
    }
    if (btnCloseLimits && limitsModal) {
      btnCloseLimits.addEventListener('click', () => limitsModal.classList.remove('show'));
      limitsModal.addEventListener('click', (e) => {
        if (e.target === limitsModal) limitsModal.classList.remove('show');
      });
    }

    // 16. Game Rules Modal (From Hamburger Menu)
    const rulesModal = document.getElementById('game-rules-modal');
    const menuBtnRules = document.getElementById('menu-btn-rules');
    const btnCloseRules = document.getElementById('btn-close-rules');
    if (menuBtnRules && rulesModal) {
      menuBtnRules.addEventListener('click', () => {
        document.getElementById('spribe-dropdown-menu')?.classList.remove('show');
        rulesModal.classList.add('show');
        this.soundEngine.playClick();
      });
    }
    if (btnCloseRules && rulesModal) {
      btnCloseRules.addEventListener('click', () => rulesModal.classList.remove('show'));
      rulesModal.addEventListener('click', (e) => {
        if (e.target === rulesModal) rulesModal.classList.remove('show');
      });
    }

    // 17. Free Bets Modal & Claim (From Hamburger Menu)
    const freeBetsModal = document.getElementById('free-bets-modal');
    const menuBtnFreeBets = document.getElementById('menu-btn-free-bets');
    const btnCloseFreeBets = document.getElementById('btn-close-free-bets');
    const btnClaimFreeBet = document.getElementById('btn-claim-free-bet');

    if (menuBtnFreeBets && freeBetsModal) {
      menuBtnFreeBets.addEventListener('click', () => {
        document.getElementById('spribe-dropdown-menu')?.classList.remove('show');
        freeBetsModal.classList.add('show');
        this.soundEngine.playClick();
      });
    }
    if (btnCloseFreeBets && freeBetsModal) {
      btnCloseFreeBets.addEventListener('click', () => freeBetsModal.classList.remove('show'));
      freeBetsModal.addEventListener('click', (e) => {
        if (e.target === freeBetsModal) freeBetsModal.classList.remove('show');
      });
    }
    if (btnClaimFreeBet) {
      btnClaimFreeBet.addEventListener('click', () => {
        this.stakingManager.topUp(50);
        freeBetsModal?.classList.remove('show');
        this.soundEngine.playCashout();
        this.authManager?.showToast('🎉 Free Bet Claimed! +KES 50.00 added to your balance.');
      });
    }

    // 18. Change Avatar Modal (From Hamburger Menu)
    const avatarModal = document.getElementById('change-avatar-modal');
    const btnOpenAvatar = document.getElementById('btn-change-avatar');
    const btnCloseAvatar = document.getElementById('btn-close-avatar');

    if (btnOpenAvatar && avatarModal) {
      btnOpenAvatar.addEventListener('click', () => {
        document.getElementById('spribe-dropdown-menu')?.classList.remove('show');
        avatarModal.classList.add('show');
        this.soundEngine.playClick();
      });
    }
    if (btnCloseAvatar && avatarModal) {
      btnCloseAvatar.addEventListener('click', () => avatarModal.classList.remove('show'));
      avatarModal.addEventListener('click', (e) => {
        if (e.target === avatarModal) avatarModal.classList.remove('show');
      });
    }

    document.querySelectorAll('.btn-avatar-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-avatar');
        const menuAvatar = document.getElementById('menu-avatar-circle');
        if (menuAvatar) menuAvatar.textContent = chosen;
        document.querySelectorAll('.btn-avatar-choice').forEach(b => {
          b.style.borderColor = (b.getAttribute('data-avatar') === chosen) ? '#22c55e' : 'transparent';
        });
        if (this.authManager?.user) {
          this.authManager.user.avatarEmoji = chosen;
          const users = this.authManager.getAllUsers();
          const idx = users.findIndex(u => String(u.id) === String(this.authManager.user.id));
          if (idx !== -1) {
            users[idx].avatarEmoji = chosen;
            this.authManager.saveAllUsers(users);
          }
        }
        avatarModal?.classList.remove('show');
        this.authManager?.showToast(`Avatar updated to ${chosen}!`);
      });
    });

    // 19. Menu Home Button
    const menuBtnHome = document.getElementById('menu-btn-home');
    if (menuBtnHome) {
      menuBtnHome.addEventListener('click', () => {
        document.getElementById('spribe-dropdown-menu')?.classList.remove('show');
        this.switchView('terminal');
      });
    }

    // 20. Real Mode Toggle Button & Deposit Prompt When No Money
    const realModeBtn = document.getElementById('btn-real-mode-toggle');
    const funBanner = document.querySelector('.shiftstack-fun-banner') || document.querySelector('.kessbet-fun-banner');
    const realAlertBanner = document.getElementById('real-mode-deposit-alert');
    const btnQuickDepositAlert = document.getElementById('btn-quick-deposit-alert');

    const updateRealModeUI = (mode) => {
      const isReal = (mode === 'REAL');
      if (funBanner) {
        funBanner.textContent = isReal ? 'REAL MONEY MODE' : 'FUN MODE';
        funBanner.style.background = isReal ? '#22c55e' : '#f59e0b';
      }
      if (realModeBtn) {
        realModeBtn.textContent = isReal ? 'Fun >' : 'Real >';
        realModeBtn.classList.toggle('active-real', isReal);
      }
      if (realAlertBanner) {
        realAlertBanner.style.display = (isReal && (this.stakingManager?.realBalance || 0) < 100) ? 'flex' : 'none';
      }
      this.updateBalanceUI(this.stakingManager.balance, mode);
    };

    if (realModeBtn) {
      realModeBtn.addEventListener('click', () => {
        this.soundEngine.playClick();
        if (this.stakingManager.gameMode === 'DEMO') {
          // Switch to REAL MONEY MODE
          const res = this.stakingManager.setGameMode('REAL');
          updateRealModeUI('REAL');

          // If user has NO money (or < 100) in Real Money Mode, request deposit immediately!
          if (res.realBalance === 0 || res.realBalance < 100) {
            this.authManager?.showToast(`⚡ REAL MONEY MODE ACTIVE: Your real balance is KES ${res.realBalance.toFixed(2)}. Please deposit at least 49 Bob via PayHero to place real bets!`);
            this.openDepositModal(100);
          } else {
            this.authManager?.showToast(`⚡ Switched to REAL MONEY MODE. Real Cash Balance: KES ${res.realBalance.toFixed(2)}.`);
          }
        } else {
          // Switch back to FUN MODE
          const res = this.stakingManager.setGameMode('DEMO');
          updateRealModeUI('DEMO');
          this.authManager?.showToast(`🎮 Switched to FUN MODE demo simulator. Bankroll: KES ${res.demoBalance.toLocaleString()}.`);
        }
      });
    }

    if (btnQuickDepositAlert) {
      btnQuickDepositAlert.addEventListener('click', () => {
        this.openDepositModal(49);
      });
    }

    // 21. ShiftStack 4-Tab Bottom Navigation Bar (Aviator | Home | Sports | Casino)
    const bnavAviator = document.getElementById('bnav-aviator');
    const bnavHome = document.getElementById('bnav-home');
    const bnavSports = document.getElementById('bnav-sports');
    const bnavCasino = document.getElementById('bnav-casino');

    if (bnavAviator) {
      bnavAviator.addEventListener('click', () => {
        this.switchView('terminal');
      });
    }

    if (bnavHome) {
      bnavHome.addEventListener('click', () => {
        this.switchView('home');
      });
    }

    if (bnavSports) {
      bnavSports.addEventListener('click', () => {
        this.switchView('sports');
      });
    }

    if (bnavCasino) {
      bnavCasino.addEventListener('click', () => {
        this.switchView('casino');
      });
    }

    // 22. ShiftStack Account Hub Actions (view-home)
    const homeBtnDeposit = document.getElementById('home-btn-deposit');
    if (homeBtnDeposit) {
      homeBtnDeposit.addEventListener('click', () => {
        this.openDepositModal(49);
      });
    }

    const hubBtnQuickDeposit = document.getElementById('hub-btn-quick-deposit');
    if (hubBtnQuickDeposit) {
      hubBtnQuickDeposit.addEventListener('click', () => {
        this.openDepositModal(49);
      });
    }

    const hubBtnQuickRefill = document.getElementById('hub-btn-quick-refill');
    if (hubBtnQuickRefill) {
      hubBtnQuickRefill.addEventListener('click', () => {
        this.stakingManager.resetBalance(50000);
        this.soundEngine.playCashout();
        this.authManager?.showToast('🎉 Demo Balance Refilled to KES 50,000.00!');
      });
    }

    const headerBalCard = document.getElementById('header-balance-card');
    if (headerBalCard) {
      headerBalCard.style.cursor = 'pointer';
      headerBalCard.addEventListener('click', () => {
        this.switchView('home');
      });
    }

    const homeBtnGotoAviator = document.getElementById('home-btn-goto-aviator');
    if (homeBtnGotoAviator) {
      homeBtnGotoAviator.addEventListener('click', () => {
        this.switchView('terminal');
      });
    }

    const homeBtnAuth = document.getElementById('home-btn-auth-action');
    if (homeBtnAuth) {
      homeBtnAuth.addEventListener('click', () => {
        if (this.authManager?.user) {
          this.authManager.logout();
        } else {
          this.authManager?.openAuthModal('login');
        }
      });
    }

    const homeBtnResetPw = document.getElementById('home-btn-reset-pw');
    if (homeBtnResetPw) {
      homeBtnResetPw.addEventListener('click', () => {
        this.authManager?.openAuthModal('reset');
      });
    }

    const homeBtnRefillDemo = document.getElementById('home-btn-refill-demo');
    if (homeBtnRefillDemo) {
      homeBtnRefillDemo.addEventListener('click', () => {
        this.stakingManager.resetBalance(50000);
        this.soundEngine.playCashout();
        this.authManager?.showToast('🎉 Demo Balance Refilled to KES 50,000.00!');
      });
    }

    const homeBtnFreeBets = document.getElementById('home-btn-free-bets');
    if (homeBtnFreeBets && freeBetsModal) {
      homeBtnFreeBets.addEventListener('click', () => {
        freeBetsModal.classList.add('show');
        this.soundEngine.playClick();
      });
    }

    const homeBtnHistory = document.getElementById('home-btn-history');
    if (homeBtnHistory && roundHistoryModal) {
      homeBtnHistory.addEventListener('click', () => {
        roundHistoryModal.classList.add('show');
        this.historyBar.renderHistoryTable();
        this.soundEngine.playClick();
      });
    }

    const homeBtnPf = document.getElementById('home-btn-pf');
    if (homeBtnPf) {
      homeBtnPf.addEventListener('click', () => {
        const pfModal = document.getElementById('pf-modal');
        pfModal?.classList.add('show');
        this.soundEngine.playClick();
      });
    }

    const homeBtnChangeAvatar = document.getElementById('home-btn-change-avatar');
    if (homeBtnChangeAvatar && avatarModal) {
      homeBtnChangeAvatar.addEventListener('click', () => {
        avatarModal.classList.add('show');
        this.soundEngine.playClick();
      });
    }

    // 23. ShiftStack Sportsbook Actions (view-sports)
    const sportsBtnGotoAviator = document.getElementById('sports-btn-goto-aviator');
    if (sportsBtnGotoAviator) {
      sportsBtnGotoAviator.addEventListener('click', () => {
        this.switchView('terminal');
      });
    }

    const sportsBtnNotify = document.getElementById('sports-btn-notify');
    if (sportsBtnNotify) {
      sportsBtnNotify.addEventListener('click', () => {
        this.soundEngine.playClick();
        this.authManager?.showToast('🔔 You\'re on the VIP list! We will alert you the moment ShiftStack Sportsbook goes live.');
      });
    }

    // 24. ShiftStack Casino Lobby Actions (view-casino)
    const casinoBtnGotoAviator = document.getElementById('casino-btn-goto-aviator');
    if (casinoBtnGotoAviator) {
      casinoBtnGotoAviator.addEventListener('click', () => {
        this.switchView('terminal');
      });
    }

    document.querySelectorAll('.btn-game-preview').forEach(btn => {
      btn.addEventListener('click', () => {
        const gameName = btn.getAttribute('data-game') || 'Casino Game';
        this.soundEngine.playClick();
        this.authManager?.showToast(`🎲 ${gameName} is launching soon on ShiftStack with 98%+ Provably Fair RTP!`);
      });
    });

    // Initial renders
    this.updateBalanceUI(this.stakingManager.balance);
    this.updateLiquidityVaultUI(this.liquidityVault.getState());
    this.rolloverVault.notify();
  }

  switchView(targetView) {
    const navTabs = document.querySelectorAll('.nav-tab-btn');
    const viewSections = document.querySelectorAll('.view-section');

    navTabs.forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-view') === targetView);
    });
    viewSections.forEach(s => {
      s.classList.toggle('active', s.id === `view-${targetView}`);
    });

    // Synchronize Bottom Navigation Bar (Aviator | Home | Sports | Casino)
    const bnavMap = {
      'terminal': document.getElementById('bnav-aviator'),
      'home': document.getElementById('bnav-home'),
      'sports': document.getElementById('bnav-sports'),
      'casino': document.getElementById('bnav-casino')
    };

    const allBnavItems = document.querySelectorAll('.bottom-nav-item');
    allBnavItems.forEach(item => item.classList.remove('active'));

    const targetBnav = bnavMap[targetView];
    if (targetBnav) {
      targetBnav.classList.add('active');
    }

    // Update Sound Engine viewing state: Only 'terminal' plays Aviator flight audio
    const isAviatorActive = (targetView === 'terminal');
    this.soundEngine.setAviatorViewActive(isAviatorActive);

    // Scroll to top of window smoothly when switching views
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.soundEngine.playClick();
  }
}

// Instantiate once DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.aviatorApp = new AviatorApp();
});
