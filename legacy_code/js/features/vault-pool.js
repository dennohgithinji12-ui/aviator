/**
 * ShiftStack Protocol Liquidity & Bankroll Staking Pool
 * Allows users to stake capital into the ShiftStack House Liquidity Vault,
 * earning passive yield (APY) derived from Aviator crash turnover and house edge.
 */

export class LiquidityVaultPool {
  constructor(stakingManager, soundEngine, onVaultUpdate) {
    this.stakingManager = stakingManager;
    this.soundEngine = soundEngine;
    this.onVaultUpdate = onVaultUpdate;

    // Load persisted vault data or defaults
    const savedStaked = localStorage.getItem('shiftstack_vault_staked');
    const savedYield = localStorage.getItem('shiftstack_vault_yield');

    this.userStaked = savedStaked ? parseFloat(savedStaked) : 15000;
    this.accruedYield = savedYield ? parseFloat(savedYield) : 248.60;

    this.poolTVL = 148720000; // 148.7M KES Total Value Locked
    this.baseAPY = 28.4; // 28.4% APY
    this.totalStakers = 1482;
    this.volume24h = 42890500;
  }

  save() {
    localStorage.setItem('shiftstack_vault_staked', this.userStaked.toString());
    localStorage.setItem('shiftstack_vault_yield', this.accruedYield.toString());
    if (this.onVaultUpdate) {
      this.onVaultUpdate(this.getState());
    }
  }

  getState() {
    return {
      userStaked: this.userStaked,
      accruedYield: this.accruedYield,
      poolTVL: this.poolTVL,
      baseAPY: this.baseAPY,
      totalStakers: this.totalStakers,
      volume24h: this.volume24h
    };
  }

  // Stake KES from user's active wallet balance into the liquidity pool
  stake(amount) {
    amount = parseFloat(amount);
    if (!amount || isNaN(amount) || amount <= 0) return false;

    if (this.stakingManager.balance < amount) {
      alert(`Insufficient wallet balance (KES ${this.stakingManager.balance.toFixed(2)}). Please top up.`);
      return false;
    }

    this.stakingManager.balance -= amount;
    this.stakingManager.saveBalance();

    this.userStaked += amount;
    this.poolTVL += amount;
    this.save();

    this.soundEngine?.playClick();
    return true;
  }

  // Unstake KES from the liquidity pool back to active wallet balance
  unstake(amount) {
    amount = parseFloat(amount);
    if (!amount || isNaN(amount) || amount <= 0) return false;

    if (this.userStaked < amount) {
      alert(`Requested unstake amount exceeds your staked balance (KES ${this.userStaked.toFixed(2)}).`);
      return false;
    }

    this.userStaked -= amount;
    this.poolTVL -= amount;

    this.stakingManager.balance += amount;
    this.stakingManager.saveBalance();
    this.save();

    this.soundEngine?.playClick();
    return true;
  }

  // Claim accrued yield into wallet balance
  claimYield() {
    if (this.accruedYield <= 0.01) {
      alert('No yield currently available to claim.');
      return false;
    }

    const claimAmount = this.accruedYield;
    this.accruedYield = 0;

    this.stakingManager.balance += claimAmount;
    this.stakingManager.saveBalance();
    this.save();

    this.soundEngine?.playCashout();
    return claimAmount;
  }

  // Called at the end of each Aviator round: simulates protocol fee yield accumulation
  distributeRoundYield(roundVolume = 18500) {
    if (this.userStaked <= 0) return;

    // ShiftStack protocol fee: 1.5% of total round stake volume goes directly to liquidity stakers
    const protocolFee = roundVolume * 0.015;
    const userPoolShare = Math.min(1.0, this.userStaked / this.poolTVL);
    const roundYield = Math.max(0.01, protocolFee * userPoolShare * 8.5); // boosted simulation scale for rewarding UX

    this.accruedYield += roundYield;
    this.volume24h += roundVolume;
    this.save();
  }
}
