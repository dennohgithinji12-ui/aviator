/**
 * ShiftStack Dual Round Staking Manager
 * Manages Terminal 1 and Terminal 2 stakes, auto-stake, auto-cashout,
 * quick stake presets, and balance tracking.
 */

export class StakingTerminalManager {
  constructor(initialBalance = 50000, onBalanceChange, onTerminalStateChange, soundEngine) {
    this.soundEngine = soundEngine;
    this.onBalanceChange = onBalanceChange;
    this.onTerminalStateChange = onTerminalStateChange;

    // Load persisted balance if available
    const saved = localStorage.getItem('shiftstack_user_balance');
    this.balance = saved ? parseFloat(saved) : initialBalance;

    this.terminals = {
      1: {
        id: 1,
        amount: 200,
        staked: false,
        stakedInRound: false,
        cashedOut: false,
        cashedOutMultiplier: 0,
        payout: 0,
        mode: 'manual', // 'manual' | 'auto'
        autoStakeEnabled: false,
        autoCashoutEnabled: false,
        autoCashoutMultiplier: 2.00,
        cancelled: false
      },
      2: {
        id: 2,
        amount: 200,
        staked: false,
        stakedInRound: false,
        cashedOut: false,
        cashedOutMultiplier: 0,
        payout: 0,
        mode: 'manual',
        autoStakeEnabled: false,
        autoCashoutEnabled: false,
        autoCashoutMultiplier: 1.50,
        cancelled: false
      }
    };

    this.gameState = 'WAITING'; // 'WAITING', 'FLYING', 'CRASHED'
    this.currentMultiplier = 1.00;
  }

  saveBalance() {
    localStorage.setItem('shiftstack_user_balance', this.balance.toString());
    if (this.onBalanceChange) {
      this.onBalanceChange(this.balance);
    }
  }

  resetBalance(newAmount = 50000) {
    this.balance = newAmount;
    this.saveBalance();
    this.soundEngine?.playClick();
  }

  topUp(amount = 1000) {
    const depositAmt = Math.round(Number(amount));
    if (depositAmt < 500) {
      alert('Minimum deposit amount is KES 500.00');
      return false;
    }
    this.balance += depositAmt;
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
    t.amount = Math.max(200, Math.min(100000, Math.round(amount)));
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

  toggleAutoStake(id, enabled) {
    const t = this.terminals[id];
    if (!t) return;
    t.autoStakeEnabled = enabled;
    if (enabled && this.gameState === 'WAITING' && !t.staked) {
      this.placeStake(id);
    }
    this.notifyUpdate(id);
    this.soundEngine?.playClick();
  }

  toggleAutoCashout(id, enabled) {
    const t = this.terminals[id];
    if (!t) return;
    t.autoCashoutEnabled = enabled;
    this.notifyUpdate(id);
    this.soundEngine?.playClick();
  }

  setAutoCashoutMultiplier(id, mult) {
    const t = this.terminals[id];
    if (!t) return;
    t.autoCashoutMultiplier = Math.max(1.01, parseFloat(mult) || 1.50);
    this.notifyUpdate(id);
  }

  // Toggle Stake / Cancel / Cashout on button click
  handleActionClick(id) {
    const t = this.terminals[id];
    if (!t) return;

    if (this.gameState === 'WAITING') {
      if (t.staked) {
        // Cancel stake before flight
        this.cancelStake(id);
      } else {
        // Place stake
        this.placeStake(id);
      }
    } else if (this.gameState === 'FLYING') {
      if (t.staked && !t.cashedOut) {
        // Manual Cashout!
        this.cashout(id, this.currentMultiplier);
      }
    }
  }

  placeStake(id) {
    const t = this.terminals[id];
    if (!t || t.staked) return false;

    if (t.amount < 200) {
      t.amount = 200;
      this.notifyUpdate(id);
    }

    if (this.balance < t.amount) {
      alert(`Insufficient balance (KES ${this.balance.toFixed(2)}). Minimum bet is KES 200.00. Please deposit funds.`);
      return false;
    }

    // Deduct stake from balance
    this.balance -= t.amount;
    t.staked = true;
    t.stakedInRound = true;
    t.cashedOut = false;
    t.payout = 0;
    t.cashedOutMultiplier = 0;

    this.saveBalance();
    if (this.soundEngine?.playBetPlaced) {
      this.soundEngine.playBetPlaced();
    } else {
      this.soundEngine?.playClick();
    }
    this.notifyUpdate(id);
    return true;
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
    t.cashedOut = true;
    t.cashedOutMultiplier = multiplier;
    t.payout = payout;

    // Credit winnings
    this.balance += payout;
    this.saveBalance();

    this.soundEngine?.playCashout();
    this.notifyUpdate(id);

    return {
      terminalId: id,
      stake: t.amount,
      multiplier: multiplier,
      payout: payout,
      profit: payout - t.amount
    };
  }

  // Called each animation frame / tick while flying
  onFlightTick(multiplier) {
    this.currentMultiplier = multiplier;

    // Evaluate Auto-Cashout
    [1, 2].forEach(id => {
      const t = this.terminals[id];
      if (t.staked && !t.cashedOut && t.autoCashoutEnabled) {
        if (multiplier >= t.autoCashoutMultiplier) {
          this.cashout(id, t.autoCashoutMultiplier);
        }
      }
      if (t.staked && !t.cashedOut) {
        this.notifyUpdate(id);
      }
    });
  }

  // Called when round enters WAITING state
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

      // Check Auto-Stake
      if (t.autoStakeEnabled && this.balance >= t.amount) {
        this.placeStake(id);
      } else {
        this.notifyUpdate(id);
      }
    });
  }

  // Called when plane takes off
  onFlightStart() {
    this.gameState = 'FLYING';
    [1, 2].forEach(id => {
      this.notifyUpdate(id);
    });
  }

  // Called when plane crashes
  onFlightCrash(crashMultiplier) {
    this.gameState = 'CRASHED';
    this.currentMultiplier = crashMultiplier;

    [1, 2].forEach(id => {
      const t = this.terminals[id];
      // If staked and didn't cash out, stake is lost
      this.notifyUpdate(id);
    });
  }

  notifyUpdate(id) {
    if (this.onTerminalStateChange) {
      this.onTerminalStateChange(id, this.terminals[id], this.gameState, this.currentMultiplier);
    }
  }
}
