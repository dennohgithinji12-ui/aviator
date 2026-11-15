/**
 * ShiftStack Compounding Rollover Staking Vault
 * Executes automated multi-stage rollover stake compounding on Aviator rounds.
 * Takes initial stake, cashes out at target multiplier, and rolls proceeds into subsequent stages.
 */

export class RolloverStakingVault {
  constructor(stakingManager, soundEngine, onRolloverUpdate) {
    this.stakingManager = stakingManager;
    this.soundEngine = soundEngine;
    this.onRolloverUpdate = onRolloverUpdate;

    this.active = false;
    this.baseStake = 500;
    this.targetMultiplier = 1.25;
    this.totalStages = 5;

    this.currentStage = 0; // 0 = idle, 1 = stage 1, etc.
    this.currentStake = 500;
    this.accumulatedProfit = 0;
    this.stageHistory = [];
  }

  calculateProjectedStages() {
    const stages = [];
    let current = this.baseStake;
    for (let i = 1; i <= this.totalStages; i++) {
      const payout = Math.floor(current * this.targetMultiplier * 100) / 100;
      const profit = payout - current;
      stages.push({
        stage: i,
        stake: current,
        targetMultiplier: this.targetMultiplier,
        projectedPayout: payout,
        profit: profit,
        status: i < this.currentStage ? 'COMPLETED' : (i === this.currentStage ? 'IN_PROGRESS' : 'PENDING')
      });
      current = payout;
    }
    return stages;
  }

  configure(baseStake, targetMultiplier, totalStages) {
    if (this.active) return false;
    this.baseStake = Math.max(50, Math.min(25000, parseFloat(baseStake) || 500));
    this.targetMultiplier = Math.max(1.10, Math.min(5.00, parseFloat(targetMultiplier) || 1.25));
    this.totalStages = Math.max(2, Math.min(10, parseInt(totalStages) || 5));
    this.notify();
    return true;
  }

  startRollover() {
    if (this.active) return false;

    if (this.stakingManager.balance < this.baseStake) {
      alert(`Insufficient balance (KES ${this.stakingManager.balance.toFixed(2)}) to start Rollover challenge.`);
      return false;
    }

    this.active = true;
    this.currentStage = 1;
    this.currentStake = this.baseStake;
    this.accumulatedProfit = 0;
    this.stageHistory = [];

    // Deduct initial base stake from wallet
    this.stakingManager.balance -= this.baseStake;
    this.stakingManager.saveBalance();

    this.soundEngine?.playClick();
    this.notify();
    return true;
  }

  stopRollover(reason = 'User stopped') {
    if (!this.active) return;

    // Refund whatever is currently in active stake to wallet
    if (this.currentStake > 0) {
      this.stakingManager.balance += this.currentStake;
      this.stakingManager.saveBalance();
    }

    this.active = false;
    this.currentStage = 0;
    this.soundEngine?.playClick();
    this.notify(reason);
  }

  // Called during flight when currentMultiplier updates
  checkFlightProgress(currentMultiplier) {
    if (!this.active || this.currentStage === 0) return;

    if (currentMultiplier >= this.targetMultiplier) {
      this.stageWon(this.targetMultiplier);
    }
  }

  // Called if plane crashes before target multiplier reached
  checkFlightCrash(finalMultiplier) {
    if (!this.active || this.currentStage === 0) return;

    if (finalMultiplier < this.targetMultiplier) {
      this.stageLost(finalMultiplier);
    }
  }

  stageWon(multiplier) {
    const payout = Math.floor(this.currentStake * multiplier * 100) / 100;
    const profit = payout - this.currentStake;
    this.accumulatedProfit += profit;

    this.stageHistory.push({
      stage: this.currentStage,
      stake: this.currentStake,
      multiplier: multiplier,
      payout: payout,
      result: 'WON'
    });

    this.soundEngine?.playCashout();

    if (this.currentStage >= this.totalStages) {
      // Completed full challenge!
      this.stakingManager.balance += payout;
      this.stakingManager.saveBalance();

      this.active = false;
      this.currentStage = 0;
      this.notify(`ROLLOVER COMPLETED! Total Payout: KES ${payout.toFixed(2)}`);
    } else {
      // Advance to next stage: compound full payout into next round's stake
      this.currentStage += 1;
      this.currentStake = payout;
      this.notify(`Stage ${this.currentStage - 1} Cleared! Rolling over KES ${this.currentStake.toFixed(2)} into Stage ${this.currentStage}`);
    }
  }

  stageLost(finalMultiplier) {
    this.stageHistory.push({
      stage: this.currentStage,
      stake: this.currentStake,
      multiplier: finalMultiplier,
      payout: 0,
      result: 'BUSTED'
    });

    this.active = false;
    this.currentStage = 0;
    this.currentStake = 0;
    this.notify(`Rollover Busted at ${finalMultiplier.toFixed(2)}x. Stage reset.`);
  }

  notify(message = '') {
    if (this.onRolloverUpdate) {
      this.onRolloverUpdate({
        active: this.active,
        baseStake: this.baseStake,
        targetMultiplier: this.targetMultiplier,
        totalStages: this.totalStages,
        currentStage: this.currentStage,
        currentStake: this.currentStake,
        accumulatedProfit: this.accumulatedProfit,
        stages: this.calculateProjectedStages(),
        history: this.stageHistory,
        message: message
      });
    }
  }
}
