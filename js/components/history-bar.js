/**
 * Spribe Aviator Multiplier History Ribbon & Modal Table
 * Renders recent round multipliers with official Spribe color tiers:
 * - < 2.00x: Blue (#34b4ff)
 * - 2.00x - 9.99x: Purple (#913ef8)
 * - 10.00x+: Hot Pink / Magenta (#c017b4)
 * Also populates the full Round History modal table.
 */

export class HistoryBarComponent {
  constructor(containerElement, onInspectRound) {
    this.container = containerElement;
    this.onInspectRound = onInspectRound;
    this.history = [];

    // Pre-seed with realistic recent rounds
    this.seedInitialHistory();
  }

  seedInitialHistory() {
    const sampleMultipliers = [
      1.24, 2.85, 1.05, 4.12, 1.95, 12.45, 1.42, 3.10, 1.00, 2.04, 6.78, 1.65,
      28.90, 1.18, 1.88, 5.40, 2.15, 1.34, 1.12, 8.55, 1.70, 3.42, 1.55, 14.20
    ];

    sampleMultipliers.forEach((mult, idx) => {
      this.history.unshift({
        nonce: 100 - idx,
        crashMultiplier: mult,
        serverSeed: 'demo_seed_' + Math.random().toString(36).substring(2, 12),
        clientSeed: 'aviator_client_seed',
        serverHash: 'hash_' + Math.random().toString(36).substring(2, 14),
        timestamp: new Date(Date.now() - idx * 25000)
      });
    });

    this.render();
    this.renderHistoryTable();
  }

  addRound(roundData) {
    this.history.unshift(roundData);
    if (this.history.length > 60) {
      this.history.pop();
    }
    this.render();
    this.renderHistoryTable();
  }

  getBadgeClass(multiplier) {
    if (multiplier >= 10.0) {
      return 'badge-legendary'; // Hot Pink / Magenta
    } else if (multiplier >= 2.0) {
      return 'badge-high'; // Purple
    } else {
      return 'badge-low'; // Blue
    }
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'history-scroll-container';

    this.history.slice(0, 35).forEach((item) => {
      const pill = document.createElement('button');
      pill.className = `history-pill ${this.getBadgeClass(item.crashMultiplier)}`;
      pill.innerHTML = `<span>${item.crashMultiplier.toFixed(2)}x</span>`;
      pill.title = `Round #${item.nonce} • Click to verify Provably Fair seed`;

      pill.addEventListener('click', () => {
        if (this.onInspectRound) {
          this.onInspectRound(item);
        }
      });

      scrollContainer.appendChild(pill);
    });

    this.container.appendChild(scrollContainer);
  }

  renderHistoryTable() {
    const tbody = document.getElementById('round-history-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    this.history.slice(0, 50).forEach((item) => {
      const tr = document.createElement('tr');
      const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '--:--';
      const hashShort = item.serverHash ? (item.serverHash.substring(0, 10) + '...') : '4f8b91...';

      tr.innerHTML = `
        <td><strong>#${item.nonce}</strong></td>
        <td><span class="history-pill ${this.getBadgeClass(item.crashMultiplier)}">${item.crashMultiplier.toFixed(2)}x</span></td>
        <td style="color: var(--text-muted); font-size: 10px;">${timeStr}</td>
        <td style="font-family: monospace; font-size: 10px; color: var(--text-muted);">${hashShort}</td>
        <td>
          <button class="btn-table-inspect" data-nonce="${item.nonce}">Verify</button>
        </td>
      `;

      const verifyBtn = tr.querySelector('.btn-table-inspect');
      if (verifyBtn) {
        verifyBtn.addEventListener('click', () => {
          if (this.onInspectRound) {
            this.onInspectRound(item);
          }
        });
      }

      tbody.appendChild(tr);
    });
  }
}
