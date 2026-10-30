/**
 * ShiftStack Dual Round Staking Manager
 * Manages Terminal 1 and Terminal 2 stakes, auto-stake, auto-cashout,
 * quick stake presets, balance tracking, and Real Money vs Demo Mode.
 * Backed by SQLite database via REST API.
 */

export class StakingTerminalManager {
  constructor(initialBalance = 50000, onBalanceChange, onTerminalStateChange, soundEngine, onGameModeChange) {
    this.soundEngine = soundEngine;
    this.onBalanceChange = onBalanceChange;
    this.onTerminalStateChange = onTerminalStateChange;
    this.onGameModeChange = onGameModeChange;

    // Active Game Mode: 'DEMO' (50k Fun Simulator) vs 'REAL' (Real M-PESA Money)
    this.gameMode = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('shiftstack_game_mode') || 'DEMO')
      : 'DEMO';

    // Active user phone and account tracking for database sync
    const savedPhone = typeof localStorage !== 'undefined'
      ? localStorage.getItem('shiftstack_user_phone')
      : null;
    this.userPhone = savedPhone || null;
    this.hasAccount = !!this.userPhone;
    this.userAccount = null;

    // Strategic Caching: User-scoped balance keys to prevent cross-account/guest balance conflicts
    let savedReal = null;
    let savedDemo = null;
    if (typeof localStorage !== 'undefined') {
      if (this.userPhone) {
        savedReal = localStorage.getItem(`shiftstack_real_balance_${this.userPhone}`) || localStorage.getItem('shiftstack_real_balance');
        savedDemo = localStorage.getItem(`shiftstack_demo_balance_${this.userPhone}`) || localStorage.getItem('shiftstack_demo_balance');
      } else {
        savedDemo = localStorage.getItem('shiftstack_demo_balance_guest');
      }
    }

    this.demoBalance = savedDemo !== null ? parseFloat(savedDemo) : initialBalance;
    this.realBalance = (this.userPhone && savedReal !== null) ? parseFloat(savedReal) : 0.0;

    this.currentRoundNonce = 0;
    this.lastPreparedRoundNonce = null;

    this.terminals = {
      1: {
        id: 1,
        amount: 10,
        staked: false,
        stakedInRound: false,
        cashedOut: false,
        cashedOutMultiplier: 0,
        payout: 0,
        mode: 'manual', // 'manual' | 'auto'
        autoStakeEnabled: false,
        autoCashoutEnabled: false,
        autoCashoutMultiplier: 2.00,
        cancelled: false,
        activeBetId: null,
        queuedForNextRound: false,
        queuedAmount: null,
        queuedMode: null,
        betMode: null,
        cashoutPopupShown: false
      },
      2: {
        id: 2,
        amount: 10,
        staked: false,
        stakedInRound: false,
        cashedOut: false,
        cashedOutMultiplier: 0,
        payout: 0,
        mode: 'manual',
        autoStakeEnabled: false,
        autoCashoutEnabled: false,
        autoCashoutMultiplier: 1.50,
        cancelled: false,
        activeBetId: null,
        queuedForNextRound: false,
        queuedAmount: null,
        queuedMode: null,
        betMode: null,
        cashoutPopupShown: false
      }
    };

    this.gameState = 'WAITING'; // 'WAITING', 'FLYING', 'CRASHED'
    this.currentMultiplier = 1.00;
    this.betPlacementLocked = false;
    this.betCancellationLocked = false;
    this.betPlacementCutoffAt = 0;
    this.betCancellationCutoffAt = 0;

    // Initial sync with SQLite backend if phone available
    if (this.userPhone) {
      this.syncWalletWithServer();
    }
  }

  // Active balance dynamically reflects active game mode
  get balance() {
    return this.gameMode === 'REAL' ? this.realBalance : this.demoBalance;
  }

  set balance(val) {
    const num = Math.max(0, parseFloat(val) || 0);
    if (this.gameMode === 'REAL') {
      this.realBalance = num;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('shiftstack_real_balance', this.realBalance.toString());
      }
    } else {
      this.demoBalance = num;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('shiftstack_demo_balance', this.demoBalance.toString());
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('shiftstack_user_balance', num.toString());
    }
    if (this.onBalanceChange) {
      this.onBalanceChange(this.balance, this.gameMode);
    }
  }

  setGameMode(newMode) {
    this.gameMode = (newMode === 'REAL') ? 'REAL' : 'DEMO';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('shiftstack_game_mode', this.gameMode);
      localStorage.setItem('shiftstack_user_balance', this.balance.toString());
    }
    if (this.onBalanceChange) {
      this.onBalanceChange(this.balance, this.gameMode);
    }
    if (this.onGameModeChange) {
      this.onGameModeChange(this.gameMode, this.balance);
    }
    return {
      gameMode: this.gameMode,
      balance: this.balance,
      realBalance: this.realBalance,
      demoBalance: this.demoBalance
    };
  }

  setUserPhone(phone) {
    this.userPhone = phone;
    this.hasAccount = !!phone;
    if (typeof localStorage !== 'undefined' && phone) {
      localStorage.setItem('shiftstack_user_phone', phone);
    }
    this.syncWalletWithServer();
  }

  setAccount(user) {
    if (user) {
      this.hasAccount = true;
      this.userAccount = user;
      if (user.phone) {
        this.setUserPhone(user.phone);
      }
      if (typeof user.balance === 'number' && !isNaN(user.balance)) {
        this.demoBalance = user.balance;
      }
      this.saveBalance();
    } else {
      this.clearAccount();
    }
  }

  clearAccount() {
    const prevPhone = this.userPhone;
    this.hasAccount = false;
    this.userAccount = null;
    this.userPhone = null;
    this.realBalance = 0.0;
    this.demoBalance = 50000.0;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('shiftstack_user_phone');
      localStorage.removeItem('shiftstack_real_balance');
      localStorage.removeItem('shiftstack_user_balance');
      if (prevPhone) {
        localStorage.removeItem(`shiftstack_real_balance_${prevPhone}`);
        localStorage.removeItem(`shiftstack_demo_balance_${prevPhone}`);
      }
    }
    if (this.onBalanceChange) {
      this.onBalanceChange(this.balance, this.gameMode);
    }
  }

  async syncWalletWithServer() {
    if (!this.userPhone || typeof fetch === 'undefined') return;
    try {
      const res = await fetch(`/api/wallet?phone=${encodeURIComponent(this.userPhone)}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (typeof data.realBalance === 'number') {
            this.realBalance = data.realBalance;
          }
          if (typeof data.demoBalance === 'number') {
            this.demoBalance = data.demoBalance;
          }
          this.saveBalance();
          if (this.onBalanceChange) {
            this.onBalanceChange(this.balance, this.gameMode);
          }
        }
      }
    } catch (e) {
      console.warn('[StakingManager] Wallet sync notice:', e.message);
    }
  }

  saveBalance() {
    if (typeof localStorage !== 'undefined') {
      if (this.userPhone) {
        localStorage.setItem(`shiftstack_real_balance_${this.userPhone}`, this.realBalance.toString());
        localStorage.setItem(`shiftstack_demo_balance_${this.userPhone}`, this.demoBalance.toString());
        localStorage.setItem('shiftstack_real_balance', this.realBalance.toString());
        localStorage.setItem('shiftstack_demo_balance', this.demoBalance.toString());
      } else {
        localStorage.setItem('shiftstack_demo_balance_guest', this.demoBalance.toString());
        localStorage.removeItem('shiftstack_real_balance');
      }
      localStorage.setItem('shiftstack_user_balance', this.balance.toString());
    }
    if (this.onBalanceChange) {
      this.onBalanceChange(this.balance, this.gameMode);
    }
  }

  resetBalance(newAmount = 50000) {
    if (this.gameMode === 'REAL') {
      // In real mode, reset is not allowed; top-up via M-PESA
      return;
    }
    this.demoBalance = newAmount;
    this.saveBalance();
    this.soundEngine?.playClick();
  }

  setRealBalance(amount) {
    this.realBalance = Math.max(0, parseFloat(amount) || 0);
    this.saveBalance();
  }

  setDemoBalance(amount) {
    this.demoBalance = Math.max(0, parseFloat(amount) || 0);
    this.saveBalance();
  }

  topUp(amount = 49, isReal = true) {
    const depositAmt = Math.round(Number(amount));
    if (depositAmt < 49) {
      return false;
    }

    if (isReal || this.gameMode === 'REAL') {
      this.realBalance += depositAmt;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('shiftstack_real_balance', this.realBalance.toString());
      }
    } else {
      this.demoBalance += depositAmt;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('shiftstack_demo_balance', this.demoBalance.toString());
      }
    }

    this.saveBalance();
    if (this.soundEngine?.playDeposit) {
      this.soundEngine.playDeposit();
    } else {
      this.soundEngine?.playCashout();
    }
    return true;
  }

  getTerminal(id) {
    return this.terminals[id];
  }

  isBetPlacementLocked() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return this.betPlacementLocked || (this.betPlacementCutoffAt > 0 && now >= this.betPlacementCutoffAt);
  }

  isBetCancellationLocked() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return this.betCancellationLocked || (this.betCancellationCutoffAt > 0 && now >= this.betCancellationCutoffAt);
  }

  onCountdownTick(remainingSeconds) {
    if (this.gameState !== 'WAITING' || !Number.isFinite(Number(remainingSeconds))) return;
    const remaining = Math.max(0, Number(remainingSeconds));
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.betPlacementCutoffAt = now + Math.max(0, remaining - 0.8) * 1000;
    this.betCancellationCutoffAt = now + Math.max(0, remaining - 0.5) * 1000;
    const placementLocked = remaining <= 0.8;
    const cancellationLocked = remaining <= 0.5;
    if (placementLocked !== this.betPlacementLocked || cancellationLocked !== this.betCancellationLocked) {
      this.betPlacementLocked = placementLocked;
      this.betCancellationLocked = cancellationLocked;
      [1, 2].forEach(id => this.notifyUpdate(id));
    }
  }

  changeBalanceForMode(mode, amount) {
    if (mode === 'REAL') this.realBalance = Math.max(0, this.realBalance + amount);
    else this.demoBalance = Math.max(0, this.demoBalance + amount);
    this.saveBalance();
  }

  setAmount(id, amount) {
    const t = this.terminals[id];
    const hasUnsettledBet = t && t.staked && !t.cashedOut &&
      (this.gameState === 'WAITING' || this.gameState === 'FLYING');
    if (!t || hasUnsettledBet || t.queuedForNextRound || !Number.isFinite(Number(amount))) return;
    t.amount = Math.max(10, Math.min(100000, Math.round(amount)));
    this.notifyUpdate(id);
  }

  adjustAmount(id, delta) {
    const t = this.terminals[id];
    if (!t) return;
    this.setAmount(id, t.amount + delta);
    this.soundEngine?.playClick();
  }

  multiplyAmount(id, factor) {
    const t = this.terminals[id];
    if (!t) return;
    this.setAmount(id, t.amount * factor);
    this.soundEngine?.playClick();
  }

  setMaxAmount(id) {
    const t = this.terminals[id];
    if (!t) return;
    this.setAmount(id, Math.min(50000, this.balance));
    this.soundEngine?.playClick();
  }

  setMode(id, mode) {
    const t = this.terminals[id];
    if (!t) return;
    t.mode = mode;
    this.notifyUpdate(id);
    this.soundEngine?.playClick();
  }

  setAutoCashout(id, enabled, multiplier) {
    const t = this.terminals[id];
    if (!t) return;
    t.autoCashoutEnabled = !!enabled;
    if (multiplier !== undefined) {
      const parsedMultiplier = parseFloat(multiplier);
      if (Number.isFinite(parsedMultiplier)) {
        t.autoCashoutMultiplier = Math.max(1.05, Math.min(1000.0, parsedMultiplier));
      }
    }
    this.notifyUpdate(id);
  }

  // Keep UI control names explicit and compatible with the terminal event handlers.
  toggleAutoCashout(id, enabled) {
    this.setAutoCashout(id, enabled);
  }

  setAutoCashoutMultiplier(id, multiplier) {
    const t = this.terminals[id];
    if (!t) return;
    this.setAutoCashout(id, t.autoCashoutEnabled, multiplier);
  }

  setAutoStake(id, enabled) {
    const t = this.terminals[id];
    if (!t) return;
    t.autoStakeEnabled = !!enabled;
    this.notifyUpdate(id);
  }

  toggleAutoStake(id, enabled) {
    this.setAutoStake(id, enabled);
  }

  placeStake(id) {
    const t = this.terminals[id];
    if (!t || t.staked || this.gameState !== 'WAITING' || this.isBetPlacementLocked()) return { success: false, reason: 'NOT_WAITING' };

    // Real Money mode strictly requires an active account; demo mode is open to all
    if (this.gameMode === 'REAL' && (!this.hasAccount || !this.userPhone)) {
      return {
        success: false,
        reason: 'ACCOUNT_REQUIRED',
        message: 'Please login or register to use Real Money mode.'
      };
    }

    // Minimum bet rule 10 KES (Matching Screenshot 2)
    if (t.amount < 10) {
      return { success: false, reason: 'MIN_STAKE', minStake: 10 };
    }

    // Check balance for the active mode
    if (this.balance < t.amount) {
      if (this.gameMode === 'REAL') {
        return {
          success: false,
          reason: 'INSUFFICIENT_REAL_FUNDS',
          balance: this.realBalance,
          needed: t.amount,
          minDeposit: 49
        };
      } else {
        return {
          success: false,
          reason: 'INSUFFICIENT_DEMO_FUNDS',
          balance: this.demoBalance,
          needed: t.amount
        };
      }
    }

    // Deduct stake from active mode balance
    t.betMode = this.gameMode;
    this.changeBalanceForMode(t.betMode, -t.amount);
    t.staked = true;
    t.stakedInRound = true;
    t.cashedOut = false;
    t.payout = 0;
    t.cashedOutMultiplier = 0;
    t.cashoutPopupShown = false;

    this.recordBet(id, t);

    if (this.soundEngine?.playBetPlaced) {
      this.soundEngine.playBetPlaced();
    } else {
      this.soundEngine?.playClick();
    }
    this.notifyUpdate(id);
    return { success: true };
  }

  handleActionClick(id) {
    const t = this.terminals[id];
    if (!t) return { success: false };

    if (t.queuedForNextRound) {
      return { success: this.cancelQueuedStake(id), action: 'CANCEL_QUEUED' };
    }

    if (this.gameState === 'WAITING') {
      if (t.staked) {
        return { success: this.cancelStake(id), action: 'CANCEL' };
      } else {
        const res = this.placeStake(id);
        return { ...res, action: 'BET' };
      }
    } else if (this.gameState === 'FLYING') {
      if (t.staked && !t.cashedOut) {
        const res = this.cashout(id, this.currentMultiplier);
        return { success: !!res, action: 'CASHOUT', data: res };
      }
      return { ...this.queueNextRoundStake(id), action: 'QUEUE_NEXT' };
    } else if (this.gameState === 'CRASHED') {
      return { ...this.queueNextRoundStake(id), action: 'QUEUE_NEXT' };
    }
    return { success: false, reason: 'INVALID_STATE' };
  }

  cancelStake(id) {
    const t = this.terminals[id];
    if (!t || !t.staked || this.gameState !== 'WAITING' || this.isBetCancellationLocked()) return false;

    this.changeBalanceForMode(t.betMode || this.gameMode, t.amount);
    t.staked = false;
    t.stakedInRound = false;
    t.betMode = null;

    this.soundEngine?.playClick();
    this.notifyUpdate(id);
    return true;
  }

  queueNextRoundStake(id) {
    const t = this.terminals[id];
    if (!t || t.queuedForNextRound || (t.staked && !t.cashedOut && this.gameState !== 'CRASHED')) {
      return { success: false, reason: 'INVALID_STATE' };
    }
    if (this.gameMode === 'REAL' && (!this.hasAccount || !this.userPhone)) {
      return { success: false, reason: 'ACCOUNT_REQUIRED' };
    }
    if (t.amount < 10) return { success: false, reason: 'MIN_STAKE', minStake: 10 };
    if (this.balance < t.amount) {
      return this.gameMode === 'REAL'
        ? { success: false, reason: 'INSUFFICIENT_REAL_FUNDS', balance: this.realBalance, needed: t.amount, minDeposit: 49 }
        : { success: false, reason: 'INSUFFICIENT_DEMO_FUNDS', balance: this.demoBalance, needed: t.amount };
    }

    t.queuedForNextRound = true;
    t.queuedAmount = t.amount;
    t.queuedMode = this.gameMode;
    this.changeBalanceForMode(t.queuedMode, -t.queuedAmount);
    this.soundEngine?.playBetPlaced?.();
    this.notifyUpdate(id);
    return { success: true };
  }

  cancelQueuedStake(id) {
    const t = this.terminals[id];
    if (!t || !t.queuedForNextRound) return false;
    this.changeBalanceForMode(t.queuedMode, t.queuedAmount);
    t.queuedForNextRound = false;
    t.queuedAmount = null;
    t.queuedMode = null;
    this.notifyUpdate(id);
    return true;
  }

  recordBet(id, t) {
    if (!this.userPhone || typeof fetch === 'undefined') return;
    fetch('/api/wallet/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: this.userPhone,
        mode: t.betMode || this.gameMode,
        terminalId: id,
        amount: t.amount,
        roundNonce: this.currentRoundNonce || 0
      })
    }).then(r => r.json()).then(res => {
      if (res.success && res.betId) t.activeBetId = res.betId;
    }).catch(() => {});
  }

  cashout(id, multiplier) {
    const t = this.terminals[id];
    if (!t || !t.staked || t.cashedOut || this.gameState !== 'FLYING') return;

    const payout = Math.floor(t.amount * multiplier * 100) / 100;
    const profit = Math.floor((payout - t.amount) * 100) / 100;
    t.cashedOut = true;
    t.cashedOutMultiplier = multiplier;
    t.payout = payout;

    // Credit winnings to active balance
    this.changeBalanceForMode(t.betMode || this.gameMode, payout);

    // Async sync winnings with SQLite database
    if (this.userPhone && typeof fetch !== 'undefined') {
      fetch('/api/wallet/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: this.userPhone,
          mode: t.betMode || this.gameMode,
          betId: t.activeBetId || 0,
          multiplier: multiplier,
          payout: payout,
          profit: profit
        })
      }).catch(() => {});
    }

    this.soundEngine?.playCashout();
    this.notifyUpdate(id);

    return {
      terminalId: id,
      stake: t.amount,
      multiplier: multiplier,
      payout: payout,
      profit: profit
    };
  }

  onFlightTick(multiplier) {
    this.currentMultiplier = multiplier;
    [1, 2].forEach(id => {
      const t = this.terminals[id];
      if (t && t.staked && !t.cashedOut && t.autoCashoutEnabled) {
        if (multiplier >= t.autoCashoutMultiplier) {
          this.cashout(id, t.autoCashoutMultiplier);
        }
      }
      if (t?.staked && !t.cashedOut) this.notifyUpdate(id);
    });
  }

  onFlightStart() {
    this.gameState = 'FLYING';
    this.betPlacementLocked = true;
    this.betCancellationLocked = true;
    [1, 2].forEach(id => {
      this.notifyUpdate(id);
    });
  }

  onFlightCrash(finalMultiplier) {
    this.gameState = 'CRASHED';
    this.currentMultiplier = finalMultiplier;
    [1, 2].forEach(id => {
      const t = this.terminals[id];
      if (t.staked && !t.cashedOut) {
        t.stakedInRound = false;
      }
      this.notifyUpdate(id);
    });
  }

  onRoundWaiting(roundNonce = this.currentRoundNonce + 1, remainingSeconds = 5.0) {
    this.gameState = 'WAITING';
    this.betPlacementLocked = false;
    this.betCancellationLocked = false;
    this.betPlacementCutoffAt = 0;
    this.betCancellationCutoffAt = 0;
    this.onCountdownTick(remainingSeconds);
    // Round preparation can run again after tab focus or a clock resync. Process
    // a round only once so queued bets are not silently cleared or charged twice.
    if (this.lastPreparedRoundNonce === roundNonce) return;
    this.lastPreparedRoundNonce = roundNonce;
    this.currentRoundNonce = roundNonce;
    this.currentMultiplier = 1.00;

    [1, 2].forEach(id => {
      const t = this.terminals[id];
      const queuedForNextRound = t.queuedForNextRound;
      const queuedAmount = t.queuedAmount;
      const queuedMode = t.queuedMode;
      t.staked = false;
      t.stakedInRound = false;
      t.cashedOut = false;
      t.cashedOutMultiplier = 0;
      t.payout = 0;
      t.cashoutPopupShown = false;
      t.activeBetId = null;
      t.betMode = null;

      if (queuedForNextRound) {
        t.amount = queuedAmount;
        t.staked = true;
        t.stakedInRound = true;
        t.betMode = queuedMode;
        t.queuedForNextRound = false;
        t.queuedAmount = null;
        t.queuedMode = null;
        this.recordBet(id, t);
      }

      if (!t.staked && t.autoStakeEnabled && !this.isBetPlacementLocked() && this.balance >= t.amount && t.amount >= 100) {
        this.placeStake(id);
      }
      this.notifyUpdate(id);
    });
  }

  notifyUpdate(id) {
    if (this.onTerminalStateChange) {
      this.onTerminalStateChange(id, this.terminals[id], this.gameState, this.currentMultiplier);
    }
  }
}
