/**
 * Spribe Aviator Live Community Bets Feed
 * 4-column authentic layout (User | Bet | X | Cash out), masked player handles,
 * live cashout animations, and leaderboard rankings.
 * Generates high-volume live player traffic with min stake of 200 KES.
 */

export class LiveStakersComponent {
  constructor(containerElement, userTerminalManager) {
    this.container = containerElement;
    this.stakingManager = userTerminalManager;
    this.currentTab = 'all'; // 'all' | 'my' | 'top'
    this.activeStakers = [];
    this.myHistory = [];
    this.totalRoundPlayers = 80;

    this.topWins = [
      { user: 's***8', stake: 10000, multiplier: 84.50, payout: 845000, time: '3m ago' },
      { user: 'k***2', stake: 5000, multiplier: 42.10, payout: 210500, time: '7m ago' },
      { user: 'w***7', stake: 8000, multiplier: 24.80, payout: 198400, time: '11m ago' },
      { user: 'o***9', stake: 2500, multiplier: 33.40, payout: 83500, time: '18m ago' },
      { user: 'a***5', stake: 3000, multiplier: 21.05, payout: 63150, time: '26m ago' },
      { user: 'm***4', stake: 15000, multiplier: 18.20, payout: 273000, time: '34m ago' },
      { user: 'j***1', stake: 2000, multiplier: 67.80, payout: 135600, time: '41m ago' },
      { user: 'b***6', stake: 6000, multiplier: 16.40, payout: 98400, time: '52m ago' }
    ];

    // Diverse pool of realistic player handles
    this.simulatedNames = [
      'b***3', 'w***1', 'k***8', 'a***9', 'o***4',
      'd***2', 'f***7', 'm***0', 'j***5', 'v***1',
      'n***6', 'h***2', 'g***8', 'c***4', 'p***9',
      'e***1', 'r***5', 't***8', 'l***2', 's***6',
      'z***3', 'y***7', 'x***4', 'u***9', 'i***2',
      'q***5', 'k***4', 'm***9', 'j***7', 'b***8',
      'o***2', 'w***5', 'd***9', 'f***3', 's***1',
      'a***4', 'c***7', 'p***2', 'v***6', 't***1',
      'r***8', 'e***4', 'l***9', 'g***3', 'n***5',
      'h***8', 'z***7', 'y***2', 'x***8', 'u***3'
    ];

    this.avatarColors = [
      '#e74c3c', '#3498db', '#9b59b6', '#1abc9c',
      '#f39c12', '#2ecc71', '#e67e22', '#16a085',
      '#2980b9', '#8e44ad', '#d35400', '#27ae60'
    ];
  }

  getBadgeClass(multiplier) {
    if (multiplier >= 10.0) return 'badge-legendary';
    if (multiplier >= 2.0) return 'badge-high';
    return 'badge-low';
  }

  generateRoundStakers() {
    this.activeStakers = [];
    // High-volume live players per round: 75 to 95 players
    const count = 75 + Math.floor(Math.random() * 21);

    // Stakes strictly min 200 KES as requested
    const stakes = [200, 300, 400, 500, 750, 1000, 1500, 2000, 3500, 5000, 10000, 25000, 50000];

    // Insert user's own bets if active
    [1, 2].forEach(id => {
      const t = this.stakingManager.getTerminal(id);
      if (t && t.staked) {
        this.activeStakers.push({
          user: `YOU (#${id})`,
          stake: t.amount,
          targetMultiplier: t.autoCashoutEnabled ? t.autoCashoutMultiplier : 999.0,
          cashedOut: false,
          cashedMultiplier: 0,
          payout: 0,
          isUser: true,
          color: '#ff003b'
        });
      }
    });

    for (let i = 0; i < count; i++) {
      const name = this.simulatedNames[Math.floor(Math.random() * this.simulatedNames.length)];
      // Weighted stake: mostly 200-1000 KES, some high-rollers
      let stake;
      const r = Math.random();
      if (r < 0.45) stake = stakes[Math.floor(Math.random() * 3)]; // 200-400
      else if (r < 0.80) stake = stakes[3 + Math.floor(Math.random() * 4)]; // 500-2000
      else if (r < 0.95) stake = stakes[7 + Math.floor(Math.random() * 3)]; // 3500-10000
      else stake = stakes[10 + Math.floor(Math.random() * 3)]; // 25000-50000

      // Target cashout multiplier with authentic distribution
      let target;
      const targetRoll = Math.random();
      if (targetRoll < 0.50) {
        target = 1.15 + Math.random() * 1.05; // 1.15x - 2.20x
      } else if (targetRoll < 0.80) {
        target = 2.21 + Math.random() * 2.80; // 2.21x - 5.01x
      } else if (targetRoll < 0.94) {
        target = 5.02 + Math.random() * 9.50; // 5.02x - 14.50x
      } else {
        target = 15.0 + Math.random() * 55.0; // 15x - 70x
      }

      const color = this.avatarColors[i % this.avatarColors.length];

      this.activeStakers.push({
        user: name,
        stake: stake,
        targetMultiplier: Math.round(target * 100) / 100,
        cashedOut: false,
        cashedMultiplier: 0,
        payout: 0,
        isUser: false,
        color: color
      });
    }

    this.totalRoundPlayers = this.activeStakers.length;
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
          if (this.topWins.length > 20) this.topWins.pop();
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
      if (t && t.stakedInRound) {
        this.myHistory.unshift({
          id: id,
          stake: t.amount,
          cashedOut: t.cashedOut,
          multiplier: t.cashedOut ? t.cashedOutMultiplier : finalMultiplier,
          payout: t.payout,
          profit: t.cashedOut ? t.payout - t.amount : -t.amount,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        if (this.myHistory.length > 50) this.myHistory.pop();
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

    const totalBets = this.activeStakers.length;
    this.totalRoundPlayers = totalBets;
    const totalStaked = this.activeStakers.reduce((sum, s) => sum + s.stake, 0);
    const totalCashedOut = this.activeStakers.filter(s => s.cashedOut).length;

    // Synchronize tab header count with total bets
    const allTabBtn = document.querySelector('.stakers-tab-btn[data-tab="all"]');
    if (allTabBtn) {
      allTabBtn.textContent = `All Bets ${totalBets}`;
    }

    let contentHtml = '';

    if (this.currentTab === 'all') {
      contentHtml = `
        <div class="stakers-summary-bar">
          <div class="summary-metric">
            <span class="metric-label">TOTAL BETS</span>
            <span class="metric-value font-bold">${totalBets}</span>
          </div>
          <div class="summary-metric">
            <span class="metric-label">ROUND POOL</span>
            <span class="metric-value font-gold">KES ${totalStaked.toLocaleString()}</span>
          </div>
          <div class="summary-metric">
            <span class="metric-label">CASHED</span>
            <span class="metric-value font-emerald">${totalCashedOut} / ${totalBets}</span>
          </div>
        </div>
        <div class="stakers-table-header" style="grid-template-columns: 1.1fr 1fr 0.8fr 1.1fr;">
          <span>USER</span>
          <span style="text-align: right;">BET (KES)</span>
          <span style="text-align: center;">X</span>
          <span style="text-align: right;">CASHOUT</span>
        </div>
        <div class="stakers-list-body custom-scroll">
          ${this.activeStakers.map(s => `
            <div class="staker-row ${s.cashedOut ? 'row-cashed' : ''} ${s.isUser ? 'row-user-highlight' : ''}" style="grid-template-columns: 1.1fr 1fr 0.8fr 1.1fr;">
              <div class="staker-user-cell">
                <span class="avatar-dot" style="background: ${s.cashedOut ? '#2ecc71' : s.color};"></span>
                <span class="staker-name ${s.isUser ? 'font-bold font-crimson' : ''}">${s.user}</span>
              </div>
              <div class="staker-stake-cell">${s.stake.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div style="text-align: center;">
                ${s.cashedOut 
                  ? `<span class="history-pill ${this.getBadgeClass(s.cashedMultiplier)}" style="padding: 1px 6px; font-size: 10px; font-weight: 800;">${s.cashedMultiplier.toFixed(2)}x</span>`
                  : `<span style="color: var(--text-muted); font-size: 10px;">-</span>`
                }
              </div>
              <div class="staker-payout-cell">
                ${s.cashedOut
                  ? `<span class="cashout-amount font-emerald" style="font-size: 11px; font-weight: 800;">${s.payout.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>`
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
        <div class="stakers-list-body custom-scroll">
          ${this.myHistory.length === 0 ? `
            <div class="empty-state">No bets placed yet in this session. Place a bet on Panel 1 or 2 (Min KES 200)!</div>
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
        <div class="stakers-table-header" style="grid-template-columns: 1.1fr 0.9fr 0.9fr 1.1fr;">
          <span>USER</span>
          <span>TIME</span>
          <span style="text-align: center;">X</span>
          <span style="text-align: right;">WIN (KES)</span>
        </div>
        <div class="stakers-list-body custom-scroll">
          ${this.topWins.map((w, idx) => `
            <div class="staker-row row-cashed" style="grid-template-columns: 1.1fr 0.9fr 0.9fr 1.1fr;">
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
