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

    // Persisted Balances
    const savedDemo = typeof localStorage !== 'undefined' ? localStorage.getItem('shiftstack_demo_balance') : null;
    const savedReal = typeof localStorage !== 'undefined' ? localStorage.getItem('shiftstack_real_balance') : null;

    this.demoBalance = savedDemo !== null ? parseFloat(savedDemo) : initialBalance;
    this.realBalance = savedReal !== null ? parseFloat(savedReal) : 0.0;

    // Active user phone and account tracking for database sync
    this.userPhone = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('shiftstack_user_phone') || '254712345678')
      : '254712345678';
    this.hasAccount = !!this.userPhone;
    this.userAccount = null;

    this.currentRoundNonce = 0;

    this.terminals = {
      1: {
        id: 1,
        amount: 100,
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
        activeBetId: null
      },
      2: {
        id: 2,
        amount: 100,
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
        activeBetId: null
      }
    };

    this.gameState = 'WAITING'; // 'WAITING', 'FLYING', 'CRASHED'
    this.currentMultiplier = 1.00;

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
    this.hasAccount = false;
    this.userAccount = null;
    this.userPhone = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('shiftstack_user_phone');
    }
    if (this.onBalanceChange) {
      this.onBalanceChange(this.balance, this.gameMode);
    }
  }

  async syncWalletWithServer() {
    if (!this.userPhone || typeof fetch === 'undefined') return;
    try {
      const res = await fetch(`/api/wallet?phone=${encodeURIComponent(this.userPhone)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (typeof data.realBalance === 'number') {
            this.realBalance = data.realBalance;
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('shiftstack_real_balance', this.realBalance.toString());
            }
          }
          if (typeof data.demoBalance === 'number' && !localStorage.getItem('shiftstack_demo_balance')) {
            this.demoBalance = data.demoBalance;
          }
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
      localStorage.setItem('shiftstack_demo_balance', this.demoBalance.toString());
      localStorage.setItem('shiftstack_real_balance', this.realBalance.toString());
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

  setAmount(id, amount) {
    const t = this.terminals[id];
    if (!t) return;
    t.amount = Math.max(100, Math.min(100000, Math.round(amount)));
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
      t.autoCashoutMultiplier = Math.max(1.01, Math.min(1000.0, parseFloat(multiplier)));
    }
    this.notifyUpdate(id);
  }

  setAutoStake(id, enabled) {
    const t = this.terminals[id];
    if (!t) return;
    t.autoStakeEnabled = !!enabled;
    this.notifyUpdate(id);
  }

  placeStake(id) {
    const t = this.terminals[id];
    if (!t || t.staked || this.gameState !== 'WAITING') return { success: false, reason: 'NOT_WAITING' };

    // Both Demo and Real Money modes strictly require an active account
    if (!this.hasAccount || !this.userPhone) {
      return {
        success: false,
        reason: 'ACCOUNT_REQUIRED',
        message: 'An account is required to play Demo mode. Please login or register with your phone number.'
      };
    }

    // Minimum bet rule strictly 100 KES
    if (t.amount < 100) {
      return { success: false, reason: 'MIN_STAKE', minStake: 100 };
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
    this.balance -= t.amount;
    t.staked = true;
    t.stakedInRound = true;
    t.cashedOut = false;
    t.payout = 0;
    t.cashedOutMultiplier = 0;

    this.saveBalance();

    // Async sync with SQLite database
    if (this.userPhone && typeof fetch !== 'undefined') {
      fetch('/api/wallet/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: this.userPhone,
          mode: this.gameMode,
          terminalId: id,
          amount: t.amount,
          roundNonce: this.currentRoundNonce || 0
        })
      }).then(r => r.json()).then(res => {
        if (res.success && res.betId) {
          t.activeBetId = res.betId;
        }
      }).catch(() => {});
    }

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
    }
    return { success: false, reason: 'INVALID_STATE' };
  }

  cancelStake(id) {
    const t = this.terminals[id];
    if (!t || !t.staked || this.gameState !== 'WAITING') return false;

    this.balance += t.amount;
    t.staked = false;
    t.stakedInRound = false;

    this.saveBalance();
    this.soundEngine?.playClick();
    this.notifyUpdate(id);
    return true;
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
    this.balance += payout;
    this.saveBalance();

    // Async sync winnings with SQLite database
    if (this.userPhone && typeof fetch !== 'undefined') {
      fetch('/api/wallet/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: this.userPhone,
          mode: this.gameMode,
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
    });
  }

  onFlightStart() {
    this.gameState = 'FLYING';
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

  onRoundWaiting() {
    this.gameState = 'WAITING';
    this.currentMultiplier = 1.00;

    [1, 2].forEach(id => {
      const t = this.terminals[id];
      t.staked = false;
      t.stakedInRound = false;
      t.cashedOut = false;
      t.cashedOutMultiplier = 0;
      t.payout = 0;
      t.activeBetId = null;

      if (t.autoStakeEnabled && this.balance >= t.amount && t.amount >= 100) {
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
