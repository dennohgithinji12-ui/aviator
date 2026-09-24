/**
 * ShiftStack Aviator - Puter.js Cloud Authentication & Sync Manager
 * Supports Sign In, Sign Up, User Profile, and Cloud Balance Persistence via Puter.js v2
 */

export class PuterAuthManager {
  constructor(stakingManager, soundEngine, onAuthChange) {
    this.stakingManager = stakingManager;
    this.soundEngine = soundEngine;
    this.onAuthChange = onAuthChange;
    this.user = null;
    this.isPuterAvailable = typeof window.puter !== 'undefined';

    this.init();
  }

  async init() {
    this.setupListeners();

    // Check if Puter.js is loaded
    if (typeof window.puter !== 'undefined') {
      this.isPuterAvailable = true;
      await this.checkAuthStatus();
    } else {
      // Wait for puter script to load if asynchronous
      window.addEventListener('load', async () => {
        if (typeof window.puter !== 'undefined') {
          this.isPuterAvailable = true;
          await this.checkAuthStatus();
        } else {
          this.renderLoggedOut();
        }
      });
    }
  }

  async checkAuthStatus() {
    try {
      if (window.puter && window.puter.auth && window.puter.auth.isSignedIn()) {
        const user = await window.puter.auth.getUser();
        if (user) {
          this.user = user;
          await this.syncFromCloud();
          this.renderLoggedIn();
          if (this.onAuthChange) this.onAuthChange(this.user);
          return;
        }
      }
    } catch (e) {
      console.warn('[Puter.js] Auth status check notice:', e);
    }
    this.renderLoggedOut();
  }

  async signIn() {
    this.soundEngine?.playClick();
    if (!window.puter || !window.puter.auth) {
      alert('Puter.js is still loading. Please check your internet connection.');
      return;
    }

    try {
      // Puter signIn handles both existing user login and new user signup in a sleek modal!
      const user = await window.puter.auth.signIn();
      if (user) {
        this.user = user;
        this.soundEngine?.playCashout();
        await this.syncFromCloud();
        this.renderLoggedIn();
        if (this.onAuthChange) this.onAuthChange(this.user);
        this.showToast(`Welcome back, ${user.username || 'Aviator Pilot'}!`);
      }
    } catch (err) {
      console.warn('[Puter.js] Sign-in cancelled or error:', err);
    }
  }

  async signOut() {
    this.soundEngine?.playClick();
    if (!window.puter || !window.puter.auth) return;

    try {
      await window.puter.auth.signOut();
      this.user = null;
      this.renderLoggedOut();
      if (this.onAuthChange) this.onAuthChange(null);
      this.showToast('You have signed out of Puter.js.');
    } catch (err) {
      console.error('[Puter.js] Sign out error:', err);
    }
  }

  // Sync user balance with Puter KV cloud storage
  async syncFromCloud() {
    if (!window.puter || !window.puter.kv || !this.user) return;
    try {
      const cloudBalance = await window.puter.kv.get('aviator_user_balance');
      if (cloudBalance !== null && !isNaN(parseFloat(cloudBalance))) {
        this.stakingManager.balance = parseFloat(cloudBalance);
        this.stakingManager.saveBalance();
      } else {
        // First time cloud user: save initial balance
        await window.puter.kv.set('aviator_user_balance', this.stakingManager.balance.toString());
      }
    } catch (e) {
      console.warn('[Puter.js] Cloud balance sync notice:', e);
    }
  }

  async syncToCloud() {
    if (!window.puter || !window.puter.kv || !this.user) return;
    try {
      await window.puter.kv.set('aviator_user_balance', this.stakingManager.balance.toString());
    } catch (e) {
      console.warn('[Puter.js] Cloud balance save notice:', e);
    }
  }

  setupListeners() {
    // Listen for balance updates from stakingManager to sync to Puter KV
    const origSave = this.stakingManager.saveBalance.bind(this.stakingManager);
    this.stakingManager.saveBalance = () => {
      origSave();
      this.syncToCloud();
    };

    // Close user dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('puter-user-menu');
      const trigger = document.getElementById('puter-user-trigger');
      if (dropdown && trigger && !trigger.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });
  }

  renderLoggedIn() {
    const container = document.getElementById('puter-auth-container');
    if (!container) return;

    const username = this.user.username || 'Pilot';
    const initial = username.charAt(0).toUpperCase();

    container.innerHTML = `
      <div class="puter-user-pill" id="puter-user-trigger" title="Puter.js Account: ${username}">
        <span class="puter-avatar">${initial}</span>
        <span class="puter-name desktop-only">${username}</span>
        <span class="puter-cloud-dot" title="Puter.js Cloud Sync Active"></span>
        <span class="puter-chevron">▼</span>
      </div>
      <div class="puter-dropdown-menu" id="puter-user-menu">
        <div class="puter-dropdown-header">
          <span class="puter-badge">Puter.js Cloud Auth</span>
          <strong class="puter-dropdown-username">@${username}</strong>
        </div>
        <div class="puter-menu-divider"></div>
        <button class="puter-menu-item" id="btn-puter-deposit">
          <span class="puter-menu-icon">💳</span>
          <span>Deposit Funds (Min 500)</span>
        </button>
        <button class="puter-menu-item" id="btn-puter-sync">
          <span class="puter-menu-icon">☁️</span>
          <span>Sync Cloud Wallet</span>
        </button>
        <div class="puter-menu-divider"></div>
        <button class="puter-menu-item text-danger" id="btn-puter-signout">
          <span class="puter-menu-icon">🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    `;

    // Dropdown toggle
    const trigger = document.getElementById('puter-user-trigger');
    const menu = document.getElementById('puter-user-menu');
    if (trigger && menu) {
      trigger.addEventListener('click', () => {
        menu.classList.toggle('show');
        this.soundEngine?.playClick();
      });
    }

    // Sign out button
    const signoutBtn = document.getElementById('btn-puter-signout');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', () => {
        this.signOut();
      });
    }

    // Deposit trigger in dropdown
    const depositBtn = document.getElementById('btn-puter-deposit');
    if (depositBtn) {
      depositBtn.addEventListener('click', () => {
        if (menu) menu.classList.remove('show');
        const modal = document.getElementById('deposit-modal');
        if (modal) modal.classList.add('show');
      });
    }

    // Manual sync trigger
    const syncBtn = document.getElementById('btn-puter-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        await this.syncToCloud();
        this.showToast('Cloud wallet synchronized with Puter.js!');
        if (menu) menu.classList.remove('show');
      });
    }
  }

  renderLoggedOut() {
    const container = document.getElementById('puter-auth-container');
    if (!container) return;

    container.innerHTML = `
      <button class="btn-puter-auth" id="btn-puter-login" title="Login or Register with Puter.js">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>Login / Sign Up</span>
      </button>
    `;

    const loginBtn = document.getElementById('btn-puter-login');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        this.signIn();
      });
    }
  }

  showToast(message) {
    let toast = document.getElementById('aviator-toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'aviator-toast-notification';
      toast.className = 'aviator-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }
}
