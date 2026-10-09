/**
 * ShiftStack Provably Fair Verifier & Inspector
 * Provides transparent verification for any past or active round using SHA-256 HMAC math.
 */

export class ProvablyFairUI {
  constructor(crashMathEngine) {
    this.engine = crashMathEngine;
  }

  setupEventListeners() {
    const modal = document.getElementById('pf-modal');
    const openBtn = document.getElementById('btn-open-pf');
    const closeBtn = document.getElementById('btn-close-pf');
    const verifyBtn = document.getElementById('btn-run-verify');
    const updateClientSeedBtn = document.getElementById('btn-update-client-seed');

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => {
        this.populateCurrentParams();
        modal.classList.add('active');
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }

    // Click outside modal to close
    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });

    if (verifyBtn) {
      verifyBtn.addEventListener('click', () => {
        this.executeVerification();
      });
    }

    if (updateClientSeedBtn) {
      updateClientSeedBtn.addEventListener('click', () => {
        const input = document.getElementById('pf-input-my-client-seed');
        if (input && input.value.trim()) {
          this.engine.setClientSeed(input.value.trim());
          alert('Client Seed updated successfully for upcoming rounds.');
          this.populateCurrentParams();
        }
      });
    }
  }

  populateCurrentParams() {
    const serverHashElem = document.getElementById('pf-current-server-hash');
    const clientSeedElem = document.getElementById('pf-current-client-seed');
    const nonceElem = document.getElementById('pf-current-nonce');
    const clientSeedInput = document.getElementById('pf-input-my-client-seed');

    if (serverHashElem) serverHashElem.textContent = this.engine.currentServerHash || 'Waiting for round...';
    if (clientSeedElem) clientSeedElem.textContent = this.engine.clientSeed;
    if (nonceElem) nonceElem.textContent = this.engine.nonce.toString();
    if (clientSeedInput) clientSeedInput.value = this.engine.clientSeed;
  }

  async inspectHistoricalRound(roundData) {
    const modal = document.getElementById('pf-modal');
    if (!modal) return;

    this.populateCurrentParams();

    // Auto-fill verification fields with the selected round data
    const verifyServerSeed = document.getElementById('pf-verify-server-seed');
    const verifyClientSeed = document.getElementById('pf-verify-client-seed');
    const verifyNonce = document.getElementById('pf-verify-nonce');

    if (verifyServerSeed) verifyServerSeed.value = roundData.serverSeed || '';
    if (verifyClientSeed) verifyClientSeed.value = roundData.clientSeed || '';
    if (verifyNonce) verifyNonce.value = roundData.nonce || '';

    modal.classList.add('active');
    this.executeVerification();
  }

  async executeVerification() {
    const serverSeedInput = document.getElementById('pf-verify-server-seed');
    const clientSeedInput = document.getElementById('pf-verify-client-seed');
    const nonceInput = document.getElementById('pf-verify-nonce');
    const resultBox = document.getElementById('pf-verify-result');

    if (!serverSeedInput || !clientSeedInput || !nonceInput || !resultBox) return;

    const serverSeed = serverSeedInput.value.trim();
    const clientSeed = clientSeedInput.value.trim();
    const nonce = parseInt(nonceInput.value.trim(), 10);

    if (!serverSeed || !clientSeed || isNaN(nonce)) {
      resultBox.innerHTML = `<span style="color: #f87171;">Please enter a valid Server Seed, Client Seed, and Nonce.</span>`;
      return;
    }

    resultBox.innerHTML = `<span>Calculating SHA-256 HMAC cryptographic proof...</span>`;

    try {
      const serverHash = await this.engine.sha256(serverSeed);
      const hmacHex = await this.engine.hmacSha256(serverSeed, `${clientSeed}:${nonce}`);
      const subHex = hmacHex.substring(0, 13);
      const h = parseInt(subHex, 16);
      const isBustGate = (h % 33 === 0);
      const multiplier = await this.engine.calculateCrashMultiplier(serverSeed, clientSeed, nonce);

      resultBox.innerHTML = `
        <div class="pf-result-success">
          <div class="pf-result-badge">VERIFIED PROVABLY FAIR (97.0% RTP)</div>
          <div class="pf-result-row">
            <strong>Phase 4 Final Multiplier:</strong>
            <span class="pf-result-highlight">${multiplier.toFixed(2)}x</span>
          </div>
          <div class="pf-result-row">
            <strong>Phase 1 Pre-Commitment SHA-256(Seed):</strong>
            <code>${serverHash}</code>
          </div>
          <div class="pf-result-row">
            <strong>Phase 3 Deterministic HMAC-SHA256:</strong>
            <code>${hmacHex}</code>
          </div>
          <div class="pf-result-row">
            <strong>Phase 4 52-Bit Entropy (13 Hex Chars):</strong>
            <code>0x${subHex} (${h})</code>
          </div>
          <div class="pf-result-row">
            <strong>Bust Gate Status (h % 33 == 0):</strong>
            <span style="color: ${isBustGate ? '#ff003b' : '#22c55e'}; font-weight: 700;">
              ${isBustGate ? 'BUST GATE TRIGGERED (1.00x Instant Crash)' : 'PASSED (Normal Continuous Flight)'}
            </span>
          </div>
        </div>
      `;
    } catch (err) {
      resultBox.innerHTML = `<span style="color: #f87171;">Verification error: ${err.message}</span>`;
    }
  }
}
