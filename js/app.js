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
import { PuterAuthManager } from './features/puter-auth.js';

class AviatorApp {
  constructor() {
    this.soundEngine = new SoundEngine();
    this.crashMath = new CrashMathEngine();
    this.currentRoundData = null;

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
      (newBalance) => this.updateBalanceUI(newBalance),
      (terminalId, terminalState, gameState, multiplier) =>
        this.updateTerminalUI(terminalId, terminalState, gameState, multiplier),
      this.soundEngine
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

    // 6. Puter.js Cloud Authentication & Persistence Manager
    this.puterAuth = new PuterAuthManager(
      this.stakingManager,
      this.soundEngine,
      (user) => {
        if (user) {
          console.log('[Aviator] Puter.js user authenticated:', user.username);
        }
      }
    );
  }

  // Orchestrate game round cycle
  async startNewRoundSequence() {
    // 1. Prepare next round cryptographically
    this.currentRoundData = await this.crashMath.prepareNextRound();

    // 2. Update Provably Fair UI indicators
    const currentHashEl = document.getElementById('pf-current-server-hash');
    if (currentHashEl) {
      currentHashEl.textContent = this.currentRoundData.serverHash;
    }
    const currentClientSeedEl = document.getElementById('pf-current-client-seed');
    if (currentClientSeedEl) {
      currentClientSeedEl.textContent = this.currentRoundData.clientSeed;
    }
    const currentNonceEl = document.getElementById('pf-current-nonce');
    if (currentNonceEl) {
      currentNonceEl.textContent = this.currentRoundData.nonce;
    }

    // 3. Inform Staking Terminals
    this.stakingManager.onRoundWaiting();
    this.liveStakers.generateRoundStakers();

    // Broadcast upcoming crash stop to VIP Predictor Mobile App (100% accuracy sync)
    try {
      const syncData = {
        type: 'ROUND_PREPARED',
        nonce: this.currentRoundData.nonce,
        crashMultiplier: this.currentRoundData.crashMultiplier,
        serverHash: this.currentRoundData.serverHash,
        countdown: 5.0,
        timestamp: Date.now()
      };
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel('aviator_vip_predictor_channel').postMessage(syncData);
      }
      localStorage.setItem('aviator_vip_live_prediction', JSON.stringify(syncData));
    } catch (e) {
      console.warn('VIP Predictor broadcast sync notice:', e);
    }

    // 4. Start Canvas Countdown (5.0 seconds) with target crash multiplier
    this.lastCountdownSecond = -1;
    this.canvasEngine.startCountdown(5.0, this.currentRoundData.crashMultiplier);
  }

  onFlightTick(multiplier, remainingSeconds) {
    if (this.canvasEngine.state === 'WAITING') {
      const ceilSec = Math.ceil(remainingSeconds);
      if (ceilSec > 0 && ceilSec !== this.lastCountdownSecond) {
        this.lastCountdownSecond = ceilSec;
        this.soundEngine.playCountdownTick(ceilSec);
      }
    } else if (this.canvasEngine.state === 'FLYING') {
      this.soundEngine.updateEnginePitch(multiplier);
      this.stakingManager.onFlightTick(multiplier);
      this.liveStakers.onFlightTick(multiplier);
      this.rolloverVault.checkFlightProgress(multiplier);
    }
  }

  onFlightStateChange(newState, data) {
    const skipBtn = document.getElementById('btn-skip-countdown');
    if (skipBtn) {
      skipBtn.style.display = (newState === 'WAITING') ? 'flex' : 'none';
    }

    if (newState === 'FLYING') {
      this.soundEngine.playTakeoff();
      this.soundEngine.startEngine();
      this.stakingManager.onFlightStart();
      try {
        const syncData = { type: 'ROUND_FLYING', nonce: this.currentRoundData?.nonce, timestamp: Date.now() };
        if (typeof BroadcastChannel !== 'undefined') {
          new BroadcastChannel('aviator_vip_predictor_channel').postMessage(syncData);
        }
      } catch (e) {}
    } else if (newState === 'CRASHED') {
      const finalMultiplier = data.finalMultiplier;
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

      // Wait 3.2 seconds, then launch next round
      setTimeout(() => {
        this.startNewRoundSequence();
      }, 3200);
    }
  }

  // Update UI Elements
  updateBalanceUI(balance) {
    const balElems = document.querySelectorAll('.user-balance-value');
    balElems.forEach(el => {
      el.textContent = `${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KES`;
    });
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

      if (amt < 500) {
        if (depositStatusMsg) {
          depositStatusMsg.className = 'deposit-status-msg error';
          depositStatusMsg.textContent = 'Minimum deposit is KES 500.00. Please enter at least 500.';
        }
        if (btnConfirmDeposit) btnConfirmDeposit.style.opacity = '0.6';
      } else {
        if (depositStatusMsg) {
          depositStatusMsg.className = 'deposit-status-msg';
          depositStatusMsg.textContent = `Ready to deposit KES ${amt.toLocaleString()} via selected payment provider.`;
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
          updateDepositAmount(depositAmtInput?.value || 1000);
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
        const val = parseFloat(chip.getAttribute('data-amount'));
        if (depositAmtInput) depositAmtInput.value = val;
        updateDepositAmount(val);
        this.soundEngine.playClick();
      });
    });

    if (depositAmtInput) {
      depositAmtInput.addEventListener('input', (e) => {
        updateDepositAmount(e.target.value);
      });
    }

    if (btnConfirmDeposit) {
      btnConfirmDeposit.addEventListener('click', () => {
        const amt = parseFloat(depositAmtInput?.value || 0);
        if (amt < 500) {
          if (depositStatusMsg) {
            depositStatusMsg.className = 'deposit-status-msg error';
            depositStatusMsg.textContent = 'Minimum deposit is KES 500.00. Please increase your deposit.';
          }
          return;
        }

        const success = this.stakingManager.topUp(amt);
        if (success) {
          depositModal?.classList.remove('show');
          let toast = document.getElementById('aviator-toast-notification');
          if (!toast) {
            toast = document.createElement('div');
            toast.id = 'aviator-toast-notification';
            toast.className = 'aviator-toast';
            document.body.appendChild(toast);
          }
          toast.textContent = `Deposit Successful! +KES ${amt.toLocaleString()} credited to your Aviator wallet.`;
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), 3500);
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

      // Stepper Buttons (- and +)
      const btnMinus = termEl.querySelector('.btn-step-minus');
      const btnPlus = termEl.querySelector('.btn-step-plus');
      if (btnMinus) btnMinus.addEventListener('click', () => this.stakingManager.adjustAmount(id, -50));
      if (btnPlus) btnPlus.addEventListener('click', () => this.stakingManager.adjustAmount(id, 50));

      // Quick Chips (100, 200, 500, 1000)
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
          this.stakingManager.handleActionClick(id);
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
    this.soundEngine.playClick();
  }
}

// Instantiate once DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.aviatorApp = new AviatorApp();
});
