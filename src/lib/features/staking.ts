/**
 * ShiftStack Dual Round Staking Manager (TypeScript Version)
 * Manages Terminal 1 and Terminal 2 stakes, auto-stake, auto-cashout,
 * quick stake presets, balance tracking, and Real Money vs Demo Mode.
 */

export interface Terminal {
  id: number;
  amount: number;
  staked: boolean;
  stakedInRound: boolean;
  cashedOut: boolean;
  cashedOutMultiplier: number;
  payout: number;
  mode: 'manual' | 'auto';
  autoStakeEnabled: boolean;
  autoCashoutEnabled: boolean;
  autoCashoutMultiplier: number;
  cancelled: boolean;
  activeBetId: string | null;
  queuedForNextRound: boolean;
  queuedAmount: number | null;
  queuedMode: 'REAL' | 'DEMO' | null;
  betMode: 'REAL' | 'DEMO' | null;
  cashoutPopupShown: boolean;
}

export type GameMode = 'DEMO' | 'REAL';
export type GameState = 'WAITING' | 'FLYING' | 'CRASHED';

export class StakingTerminalManager {
  soundEngine: any;
  onBalanceChange: ((balance: number, mode: GameMode) => void) | null;
  onTerminalStateChange: ((terminals: { 1: Terminal; 2: Terminal }) => void) | null;
  onGameModeChange: ((mode: GameMode, balance: number) => void) | null;

  gameMode: GameMode;
  userPhone: string | null;
  hasAccount: boolean;
  userAccount: any;

  demoBalance: number;
  realBalance: number;

  currentRoundNonce: number;
  lastPreparedRoundNonce: number | null;

  terminals: { 1: Terminal; 2: Terminal };

  gameState: GameState;
  currentMultiplier: number;
  betPlacementLocked: boolean;
  betCancellationLocked: boolean;
  betPlacementCutoffAt: number;
  betCancellationCutoffAt: number;

  constructor(
    initialBalance = 50000,
    onBalanceChange?: (balance: number, mode: GameMode) => void,
    onTerminalStateChange?: (terminals: { 1: Terminal; 2: Terminal }) => void,
    soundEngine?: any,
    onGameModeChange?: (mode: GameMode, balance: number) => void
  ) {
    this.soundEngine = soundEngine;
    this.onBalanceChange = onBalanceChange || null;
    this.onTerminalStateChange = onTerminalStateChange || null;
    this.onGameModeChange = onGameModeChange || null;

    this.gameMode = (typeof localStorage !== 'undefined')
      ? (localStorage.getItem('shiftstack_game_mode') as GameMode || 'DEMO')
      : 'DEMO';

    const savedPhone = typeof localStorage !== 'undefined'
      ? localStorage.getItem('shiftstack_user_phone')
      : null;
    this.userPhone = savedPhone || null;
    this.hasAccount = !!this.userPhone;
    this.userAccount = null;

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
        mode: 'manual',
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

    this.gameState = 'WAITING';
    this.currentMultiplier = 1.00;
    this.betPlacementLocked = false;
    this.betCancellationLocked = false;
    this.betPlacementCutoffAt = 0;
    this.betCancellationCutoffAt = 0;

    if (this.userPhone) {
      this.syncWalletWithServer();
    }
  }

  get balance(): number {
    return this.gameMode === 'REAL' ? this.realBalance : this.demoBalance;
  }

  set balance(val: number) {
    const num: number = Math.max(0, parseFloat(String(val)) || 0);
    if (this.gameMode === 'REAL') {
      this.realBalance = num;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('shiftstack_real_balance', String(this.realBalance));
      }
    } else {
      this.demoBalance = num;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('shiftstack_demo_balance', String(this.demoBalance));
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('shiftstack_user_balance', String(num));
    }
    if (this.onBalanceChange) {
      this.onBalanceChange(this.balance, this.gameMode);
    }
  }

  setGameMode(newMode: GameMode): { gameMode: GameMode; balance: number; realBalance: number; demoBalance: number } {
    this.gameMode = (newMode === 'REAL') ? 'REAL' : 'DEMO';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('shiftstack_game_mode', this.gameMode);
      localStorage.setItem('shiftstack_user_balance', String(this.balance));
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

  setUserPhone(phone: string): void {
    this.userPhone = phone;
    this.hasAccount = !!phone;
    if (typeof localStorage !== 'undefined' && phone) {
      localStorage.setItem('shiftstack_user_phone', phone);
    }
    this.syncWalletWithServer();
  }

  setAccount(user: any): void {
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

  clearAccount(): void {
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

  async syncWalletWithServer(): Promise<void> {
    if (!this.userPhone || typeof fetch === 'undefined') return;
    try {
      const timestamp = String(Date.now());
      const res = await fetch(`/api/wallet?phone=${encodeURIComponent(this.userPhone)}&_t=${timestamp}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.balances) {
          this.realBalance = data.balances.realBalance || 0;
          this.demoBalance = data.balances.demoBalance || 50000;
          this.saveBalance();
        }
      }
    } catch (e) {
      console.warn('[StakingManager] Wallet sync failed:', e);
    }
  }

  saveBalance(): void {
    const num = this.balance;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('shiftstack_user_balance', String(num));
      if (this.userPhone) {
        localStorage.setItem(`shiftstack_real_balance_${this.userPhone}`, String(this.realBalance));
        localStorage.setItem(`shiftstack_demo_balance_${this.userPhone}`, String(this.demoBalance));
      } else {
        localStorage.setItem('shiftstack_demo_balance_guest', String(this.demoBalance));
      }
    }
  }

  async placeBet(terminalId: 1 | 2, amount: number, mode: GameMode = 'DEMO'): Promise<{ success: boolean; error?: string }> {
    if (this.betPlacementLocked) {
      return { success: false, error: 'Bet placement is locked' };
    }

    if (amount < 10) {
      return { success: false, error: 'Minimum stake is 10 KES' };
    }

    const terminal = this.terminals[terminalId];
    if (terminal.staked || terminal.queuedForNextRound) {
      return { success: false, error: 'Terminal already has a bet' };
    }

    const balance = mode === 'REAL' ? this.realBalance : this.demoBalance;
    if (amount > balance) {
      return { success: false, error: 'Insufficient balance' };
    }

    try {
      const res = await fetch('/api/wallet/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: this.userPhone || 'guest',
          amount,
          mode,
          terminalId,
          roundNonce: this.currentRoundNonce
        })
      });

      const data = await res.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Bet placement failed' };
      }

      if (mode === 'REAL') {
        this.realBalance -= amount;
      } else {
        this.demoBalance -= amount;
      }
      this.saveBalance();

      terminal.staked = true;
      terminal.stakedInRound = true;
      terminal.amount = amount;
      terminal.betMode = mode;
      terminal.activeBetId = data.betId || null;

      if (this.onTerminalStateChange) {
        this.onTerminalStateChange(this.terminals);
      }

      this.soundEngine?.playBetPlaced();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  async cashout(terminalId: 1 | 2, multiplier: number): Promise<{ success: boolean; error?: string; payout?: number }> {
    const terminal = this.terminals[terminalId];
    if (!terminal.staked || terminal.cashedOut) {
      return { success: false, error: 'No active bet to cashout' };
    }

    try {
      const res = await fetch('/api/wallet/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: this.userPhone || 'guest',
          betId: terminal.activeBetId,
          multiplier,
          amount: terminal.amount,
          mode: terminal.betMode
        })
      });

      const data = await res.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Cashout failed' };
      }

      const payout = data.payout || (terminal.amount * multiplier);
      if (terminal.betMode === 'REAL') {
        this.realBalance += payout;
      } else {
        this.demoBalance += payout;
      }
      this.saveBalance();

      terminal.cashedOut = true;
      terminal.cashedOutMultiplier = multiplier;
      terminal.payout = payout;

      if (this.onTerminalStateChange) {
        this.onTerminalStateChange(this.terminals);
      }

      this.soundEngine?.playCashout();
      return { success: true, payout };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  cancelBet(terminalId: 1 | 2): void {
    const terminal = this.terminals[terminalId];
    if (terminal.staked && !terminal.cashedOut && this.gameState === 'WAITING') {
      terminal.staked = false;
      terminal.stakedInRound = false;
      terminal.cashedOut = false;
      terminal.payout = 0;
      terminal.activeBetId = null;

      if (terminal.betMode === 'REAL') {
        this.realBalance += terminal.amount;
      } else {
        this.demoBalance += terminal.amount;
      }
      this.saveBalance();

      if (this.onTerminalStateChange) {
        this.onTerminalStateChange(this.terminals);
      }

      this.soundEngine?.playClick();
    }
  }

  prepareNewRound(nonce: number): void {
    this.currentRoundNonce = nonce;
    this.lastPreparedRoundNonce = nonce;
    this.gameState = 'WAITING';
    this.currentMultiplier = 1.00;
    this.betPlacementLocked = false;
    this.betCancellationLocked = false;

    Object.values(this.terminals).forEach(terminal => {
      if (terminal.queuedForNextRound && terminal.queuedAmount) {
        terminal.staked = true;
        terminal.stakedInRound = true;
        terminal.amount = terminal.queuedAmount;
        terminal.betMode = terminal.queuedMode;
        terminal.queuedForNextRound = false;
        terminal.queuedAmount = null;
        terminal.queuedMode = null;
      } else {
        terminal.staked = false;
        terminal.stakedInRound = false;
        terminal.cashedOut = false;
        terminal.cashedOutMultiplier = 0;
        terminal.payout = 0;
        terminal.activeBetId = null;
      }
    });

    if (this.onTerminalStateChange) {
      this.onTerminalStateChange(this.terminals);
    }
  }

  setGameState(state: GameState, multiplier: number = 1.00): void {
    this.gameState = state;
    this.currentMultiplier = multiplier;

    if (state === 'FLYING') {
      this.betPlacementLocked = true;
      this.betCancellationLocked = true;

      Object.values(this.terminals).forEach(terminal => {
        if (terminal.autoCashoutEnabled && terminal.staked && !terminal.cashedOut) {
          if (multiplier >= terminal.autoCashoutMultiplier) {
            this.cashout(terminal.id as 1 | 2, multiplier);
          }
        }
      });
    } else if (state === 'CRASHED') {
      this.betPlacementLocked = false;
      this.betCancellationLocked = false;
    } else if (state === 'WAITING') {
      this.betPlacementLocked = false;
      this.betCancellationLocked = false;
    }

    if (this.onTerminalStateChange) {
      this.onTerminalStateChange(this.terminals);
    }
  }

  queueBetForNextRound(terminalId: 1 | 2, amount: number, mode: GameMode): void {
    const terminal = this.terminals[terminalId];
    terminal.queuedForNextRound = true;
    terminal.queuedAmount = amount;
    terminal.queuedMode = mode;

    if (this.onTerminalStateChange) {
      this.onTerminalStateChange(this.terminals);
    }

    this.soundEngine?.playClick();
  }
}
