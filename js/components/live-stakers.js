/**
 * Spribe Aviator Live Community Bets Feed
 * 4-column authentic layout (User | Bet | X | Cash out), masked player handles,
 * live cashout animations, and leaderboard rankings.
 */

export class LiveStakersComponent {
  constructor(containerElement, userTerminalManager) {
    this.container = containerElement;
    this.stakingManager = userTerminalManager;
    this.currentTab = 'all'; // 'all' | 'my' | 'top'
    this.activeStakers = [];
    this.myHistory = [];
    this.topWins = [
      { user: 's***8', stake: 10000, multiplier: 84.50, payout: 845000, time: '8m ago' },
      { user: 'k***2', stake: 5000, multiplier: 42.10, payout: 210500, time: '14m ago' },
      { user: 'w***7', stake: 8000, multiplier: 24.80, payout: 198400, time: '22m ago' },
      { user: 'o***9', stake: 2500, multiplier: 33.40, payout: 83500, time: '35m ago' },
      { user: 'a***5', stake: 3000, multiplier: 21.05, payout: 63150, time: '48m ago' }
    ];

    this.simulatedNames = [
      'b***3', 'w***1', 'k***8', 'a***9', 'o***4',
      'd***2', 'f***7', 'm***0', 'j***5', 'v***1',
      'n***6', 'h***2', 'g***8', 'c***4', 'p***9'
    ];
  }

  getBadgeClass(multiplier) {
    if (multiplier >= 10.0) return 'badge-legendary';
    if (multiplier >= 2.0) return 'badge-high';
    return 'badge-low';
  }

  generateRoundStakers() {
    this.activeStakers = [];
    const count = 16 + Math.floor(Math.random() * 10);

    for (let i = 0; i < count; i++) {
      const name = this.simulatedNames[Math.floor(Math.random() * this.simulatedNames.length)];
      const stakes = [50, 100, 200, 500, 1000, 2000, 5000];
      const stake = stakes[Math.floor(Math.random() * stakes.length)];

      const target = Math.random() > 0.35
        ? 1.15 + Math.random() * 2.5
        : 3.5 + Math.random() * 14.0;

      this.activeStakers.push({
        user: name,
        stake: stake,
        targetMultiplier: Math.round(target * 100) / 100,
        cashedOut: false,
        cashedMultiplier: 0,
        payout: 0
      });
    }

    this.render();
  }

  onFlightTick(currentMultiplier) {
    let updated = false;

    this.activeStakers.forEach(staker => {
      if (!staker.cashedOut && currentMultiplier >= staker.targetMultiplier) {
        staker.cashedOut = true;
        staker.cashedMultiplier = staker.targetMultiplier;
        staker.payout = Math.floor(staker.stake * staker.cashedMultiplier * 100) / 100;
        updated = true;

        if (staker.cashedMultiplier >= 15.0) {
          this.topWins.unshift({
            user: staker.user,
            stake: staker.stake,
            multiplier: staker.cashedMultiplier,
            payout: staker.payout,
            time: 'Just now'
          });
          if (this.topWins.length > 15) this.topWins.pop();
        }
      }
    });

    if (updated) {
      this.render();
    }
  }

  onFlightCrash(finalMultiplier) {
    [1, 2].forEach(id => {
      const t = this.stakingManager.getTerminal(id);
      if (t.stakedInRound) {
        this.myHistory.unshift({
          id: id,
          stake: t.amount,
          cashedOut: t.cashedOut,
          multiplier: t.cashedOut ? t.cashedOutMultiplier : finalMultiplier,
          payout: t.payout,
          profit: t.cashedOut ? t.payout - t.amount : -t.amount,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        if (this.myHistory.length > 30) this.myHistory.pop();
      }
    });

    this.render();
  }

  setTab(tabName) {
    this.currentTab = tabName;
    this.render();
  }

  render() {
    if (!this.container) return;

    const totalStaked = this.activeStakers.reduce((sum, s) => sum + s.stake, 0);
    const totalCashedOut = this.activeStakers.filter(s => s.cashedOut).length;

    let contentHtml = '';

    if (this.currentTab === 'all') {
      contentHtml = `
        <div class="stakers-summary-bar">
          <div class="summary-metric">
            <span class="metric-label">TOTAL BETS</span>
            <span class="metric-value">${this.activeStakers.length}</span>
          </div>
          <div class="summary-metric">
            <span class="metric-label">ROUND POOL</span>
            <span class="metric-value">KES ${totalStaked.toLocaleString()}</span>
          </div>
          <div class="summary-metric">
            <span class="metric-label">CASHED</span>
            <span class="metric-value font-emerald">${totalCashedOut} / ${this.activeStakers.length}</span>
          </div>
        </div>
        <div class="stakers-table-header" style="grid-template-columns: 1fr 1fr 0.8fr 1fr;">
          <span>USER</span>
          <span style="text-align: right;">BET (KES)</span>
          <span style="text-align: center;">X</span>
          <span style="text-align: right;">CASHOUT</span>
        </div>
        <div class="stakers-list-body">
          ${this.activeStakers.map(s => `
            <div class="staker-row ${s.cashedOut ? 'row-cashed' : ''}" style="grid-template-columns: 1fr 1fr 0.8fr 1fr;">
              <div class="staker-user-cell">
                <span class="avatar-dot" style="${s.cashedOut ? 'background: #2ecc71;' : ''}"></span>
                <span class="staker-name">${s.user}</span>
              </div>
              <div class="staker-stake-cell">${s.stake.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div style="text-align: center;">
                ${s.cashedOut 
                  ? `<span class="history-pill ${this.getBadgeClass(s.cashedMultiplier)}" style="padding: 1px 5px; font-size: 10px;">${s.cashedMultiplier.toFixed(2)}x</span>`
                  : `<span style="color: var(--text-muted); font-size: 10px;">-</span>`
                }
              </div>
              <div class="staker-payout-cell">
                ${s.cashedOut
                  ? `<span class="cashout-amount" style="font-size: 11px; font-weight: 800;">${s.payout.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>`
                  : `<span class="waiting-badge">-</span>`
                }
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (this.currentTab === 'my') {
      contentHtml = `
        <div class="stakers-table-header" style="grid-template-columns: 1fr 0.8fr 1fr 1fr;">
          <span>TIME</span>
          <span>PANEL</span>
          <span style="text-align: right;">BET</span>
          <span style="text-align: right;">WIN / LOSS</span>
        </div>
        <div class="stakers-list-body">
          ${this.myHistory.length === 0 ? `
            <div class="empty-state">No bets placed yet in this session. Place a bet on Panel 1 or 2!</div>
          ` : this.myHistory.map(h => `
            <div class="staker-row ${h.cashedOut ? 'row-cashed' : 'row-lost'}" style="grid-template-columns: 1fr 0.8fr 1fr 1fr;">
              <div class="staker-user-cell"><span class="staker-name" style="font-size: 10px; color: var(--text-muted);">${h.time}</span></div>
              <div style="font-size: 11px; font-weight: 700;">#${h.id}</div>
              <div class="staker-stake-cell">${h.stake.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div class="staker-payout-cell">
                ${h.cashedOut
                  ? `<span class="font-emerald font-bold">+${h.payout.toLocaleString('en-US', { minimumFractionDigits: 2 })} KES (${h.multiplier.toFixed(2)}x)</span>`
                  : `<span class="font-crimson font-bold">-${h.stake.toLocaleString('en-US', { minimumFractionDigits: 2 })} KES</span>`
                }
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (this.currentTab === 'top') {
      contentHtml = `
        <div class="stakers-table-header" style="grid-template-columns: 1fr 1fr 0.9fr 1.1fr;">
          <span>USER</span>
          <span>TIME</span>
          <span style="text-align: center;">X</span>
          <span style="text-align: right;">WIN (KES)</span>
        </div>
        <div class="stakers-list-body">
          ${this.topWins.map((w, idx) => `
            <div class="staker-row row-cashed" style="grid-template-columns: 1fr 1fr 0.9fr 1.1fr;">
              <div class="staker-user-cell">
                <span class="rank-badge rank-${idx + 1}" style="font-size: 9px; font-weight: 900;">${idx + 1}</span>
                <span class="staker-name">${w.user}</span>
              </div>
              <div style="font-size: 10px; color: var(--text-muted);">${w.time}</div>
              <div style="text-align: center;"><span class="badge-legendary" style="padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 800;">${w.multiplier.toFixed(2)}x</span></div>
              <div class="staker-payout-cell"><span class="font-emerald font-bold" style="font-size: 11px;">${w.payout.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
            </div>
          `).join('')}
        </div>
      `;
    }

    this.container.innerHTML = contentHtml;
  }
}
