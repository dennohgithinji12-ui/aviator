/**
 * Aviator Native Player Authentication & Session Manager
 * Completely standalone - no external third-party dependencies (no Puter.js)
 * Features:
 * - Registration with Phone Number & Pilot Username
 * - Login with Phone or Username + Password/PIN
 * - Instant 1-Click VIP Demo Account Login
 * - Isolated Wallet Balance persistence per registered account
 * - Live Player Profile Pill & Dropdown in App Header
 * - Seamless integration with StakingManager, Deposit Modal, and History
 */

const STORAGE_USERS_KEY = 'aviator_registered_users';
const STORAGE_SESSION_KEY = 'aviator_active_session';

const DEFAULT_DEMO_USER = {
  id: '849201',
  username: 'pilot_vip',
  phone: '+254712345678',
  password: '1234',
  balance: 50000.00,
  createdAt: 1727180000000,
  lastLogin: Date.now(),
  vipLevel: 'VIP Pilot'
};

export class AuthManager {
  constructor(stakingManager, soundEngine, onAuthChange) {
    this.stakingManager = stakingManager;
    this.soundEngine = soundEngine;
    this.onAuthChange = onAuthChange;
    this.user = null;

    this.init();
  }

  init() {
    this.ensureSeedUsers();
    this.restoreSession();
    this.setupModalListeners();
    this.setupDropdownListeners();
    this.hookBalancePersistence();
  }

  // Ensure default demo user exists in local registry
  ensureSeedUsers() {
    try {
      const raw = localStorage.getItem(STORAGE_USERS_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify([DEFAULT_DEMO_USER]));
      } else {
        const users = JSON.parse(raw);
        if (!Array.isArray(users) || users.length === 0) {
          localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify([DEFAULT_DEMO_USER]));
        }
      }
    } catch (e) {
      console.warn('[AuthManager] Local storage init notice:', e);
    }
  }

  getAllUsers() {
    try {
      const raw = localStorage.getItem(STORAGE_USERS_KEY);
      return raw ? JSON.parse(raw) : [DEFAULT_DEMO_USER];
    } catch (e) {
      return [DEFAULT_DEMO_USER];
    }
  }

  saveAllUsers(users) {
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('[AuthManager] Failed to save users:', e);
    }
  }

  restoreSession() {
    try {
      const sessionId = localStorage.getItem(STORAGE_SESSION_KEY);
      if (sessionId) {
        const users = this.getAllUsers();
        const found = users.find(u => String(u.id) === String(sessionId) || u.username.toLowerCase() === sessionId.toLowerCase());
        if (found) {
          this.user = found;
          // Synchronize wallet balance with user account balance
          if (typeof found.balance === 'number' && !isNaN(found.balance)) {
            this.stakingManager.balance = found.balance;
            this.stakingManager.saveBalance();
          }
          this.renderLoggedIn();
          if (this.onAuthChange) this.onAuthChange(this.user);
          return;
        }
      }
    } catch (e) {
      console.warn('[AuthManager] Session restore notice:', e);
    }

    this.user = null;
    this.renderLoggedOut();
    if (this.onAuthChange) this.onAuthChange(null);
  }

  hookBalancePersistence() {
    // Whenever stakingManager.saveBalance is called, update the active user's saved account balance
    const origSave = this.stakingManager.saveBalance.bind(this.stakingManager);
    this.stakingManager.saveBalance = () => {
      origSave();
      if (this.user) {
        this.user.balance = this.stakingManager.balance;
        const users = this.getAllUsers();
        const idx = users.findIndex(u => String(u.id) === String(this.user.id));
        if (idx !== -1) {
          users[idx].balance = this.stakingManager.balance;
          this.saveAllUsers(users);
        }
      }
    };
  }

  openAuthModal(defaultTab = 'login') {
    this.soundEngine?.playClick();
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    this.switchTab(defaultTab);
    this.clearStatus();

    // Clear password inputs
    const loginPwd = document.getElementById('login-password');
    if (loginPwd) loginPwd.value = '';
    const regPwd = document.getElementById('reg-password');
    if (regPwd) regPwd.value = '';
    const regConf = document.getElementById('reg-confirm-password');
    if (regConf) regConf.value = '';

    modal.classList.add('show');
  }

  closeAuthModal() {
    this.soundEngine?.playClick();
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('show');
  }

  switchTab(tab) {
    const tabLogin = document.getElementById('tab-auth-login');
    const tabReg = document.getElementById('tab-auth-register');
    const paneLogin = document.getElementById('pane-auth-login');
    const paneReg = document.getElementById('pane-auth-register');

    if (tab === 'register') {
      tabLogin?.classList.remove('active');
      tabReg?.classList.add('active');
      paneLogin?.classList.remove('active');
      paneReg?.classList.add('active');
    } else {
      tabLogin?.classList.add('active');
      tabReg?.classList.remove('active');
      paneLogin?.classList.add('active');
      paneReg?.classList.remove('active');
    }
    this.clearStatus();
  }

  setStatus(msg, isError = true) {
    const statusBox = document.getElementById('auth-status-msg');
    if (statusBox) {
      statusBox.textContent = msg;
      statusBox.className = isError ? 'auth-status-msg error' : 'auth-status-msg success';
      statusBox.style.display = 'block';
    }
  }

  clearStatus() {
    const statusBox = document.getElementById('auth-status-msg');
    if (statusBox) {
      statusBox.textContent = '';
      statusBox.style.display = 'none';
    }
  }

  login(identifier, password) {
    const cleanId = (identifier || '').trim();
    const cleanPwd = (password || '').trim();

    if (!cleanId) {
      this.setStatus('Please enter your phone number or pilot username.');
      return false;
    }
    if (!cleanPwd) {
      this.setStatus('Please enter your account password.');
      return false;
    }

    const users = this.getAllUsers();
    const matched = users.find(u => 
      u.username.toLowerCase() === cleanId.toLowerCase() || 
      u.phone.replace(/[\s+-]/g, '') === cleanId.replace(/[\s+-]/g, '')
    );

    if (!matched) {
      this.setStatus('Account not found. Please check your credentials or register.');
      this.soundEngine?.playClick();
      return false;
    }

    if (matched.password !== cleanPwd) {
      this.setStatus('Incorrect password. Please try again.');
      this.soundEngine?.playClick();
      return false;
    }

    // Success!
    this.user = matched;
    this.user.lastLogin = Date.now();
    try {
      localStorage.setItem(STORAGE_SESSION_KEY, String(this.user.id));
    } catch (e) {}

    // Load account balance
    if (typeof this.user.balance === 'number' && !isNaN(this.user.balance)) {
      this.stakingManager.balance = this.user.balance;
      this.stakingManager.saveBalance();
    }

    this.renderLoggedIn();
    this.closeAuthModal();
    this.soundEngine?.playCashout();
    this.showToast(`Welcome back, @${this.user.username}!`);
    if (this.onAuthChange) this.onAuthChange(this.user);
    return true;
  }

  register(phone, username, password, confirmPassword) {
    const cleanPhone = (phone || '').trim();
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPwd = (password || '').trim();
    const cleanConf = (confirmPassword || '').trim();

    if (!cleanPhone || cleanPhone.length < 9) {
      this.setStatus('Please enter a valid mobile phone number.');
      return false;
    }

    if (!cleanUser || cleanUser.length < 3) {
      this.setStatus('Username must be at least 3 characters long.');
      return false;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUser)) {
      this.setStatus('Username may only contain letters, numbers, and underscores.');
      return false;
    }

    if (!cleanPwd || cleanPwd.length < 4) {
      this.setStatus('Password must be at least 4 characters long.');
      return false;
    }

    if (cleanPwd !== cleanConf) {
      this.setStatus('Passwords do not match. Please re-enter.');
      return false;
    }

    const users = this.getAllUsers();
    const existing = users.find(u => 
      u.username.toLowerCase() === cleanUser || 
      u.phone.replace(/[\s+-]/g, '') === cleanPhone.replace(/[\s+-]/g, '')
    );

    if (existing) {
      this.setStatus('An account with this username or phone already exists. Please log in.');
      return false;
    }

    // Create new Aviator Pilot Account with Welcome 50,000 KES Balance
    const newUser = {
      id: String(Math.floor(100000 + Math.random() * 900000)),
      username: cleanUser,
      phone: cleanPhone,
      password: cleanPwd,
      balance: 50000.00,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      vipLevel: 'Verified Pilot'
    };

    users.push(newUser);
    this.saveAllUsers(users);

    this.user = newUser;
    try {
      localStorage.setItem(STORAGE_SESSION_KEY, String(newUser.id));
    } catch (e) {}

    this.stakingManager.balance = newUser.balance;
    this.stakingManager.saveBalance();

    this.renderLoggedIn();
    this.closeAuthModal();
    this.soundEngine?.playCashout();
    this.showToast(`Account created! Welcome aboard, @${newUser.username}!`);
    if (this.onAuthChange) this.onAuthChange(this.user);
    return true;
  }

  logout() {
    this.soundEngine?.playClick();
    if (this.user) {
      // Save final balance
      const users = this.getAllUsers();
      const idx = users.findIndex(u => String(u.id) === String(this.user.id));
      if (idx !== -1) {
        users[idx].balance = this.stakingManager.balance;
        this.saveAllUsers(users);
      }
    }

    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch (e) {}

    this.user = null;
    this.renderLoggedOut();
    this.showToast('You have signed out.');
    if (this.onAuthChange) this.onAuthChange(null);
  }

  renderLoggedIn() {
    const containers = [
      document.getElementById('aviator-auth-container'),
      document.getElementById('puter-auth-container')
    ].filter(Boolean);

    if (containers.length === 0) return;

    const username = this.user?.username || 'Pilot';
    const initial = username.charAt(0).toUpperCase();
    const phone = this.user?.phone || '';
    const userId = this.user?.id || '849201';
    const vipLevel = this.user?.vipLevel || 'Verified Pilot';

    const html = `
      <div class="aviator-user-pill puter-user-pill" id="aviator-user-trigger" title="Aviator Pilot Account: @${username}">
        <span class="aviator-avatar puter-avatar">${initial}</span>
        <span class="aviator-name puter-name desktop-only">${username}</span>
        <span class="aviator-online-dot puter-cloud-dot" title="Account Active"></span>
        <span class="aviator-chevron puter-chevron">▼</span>
      </div>
      <div class="aviator-dropdown-menu puter-dropdown-menu" id="aviator-user-menu">
        <div class="aviator-dropdown-header puter-dropdown-header">
          <div class="aviator-badge-row">
            <span class="aviator-badge puter-badge">🟢 ${vipLevel}</span>
            <span class="aviator-id-tag">ID: #${userId}</span>
          </div>
          <strong class="aviator-dropdown-username puter-dropdown-username">@${username}</strong>
          ${phone ? `<span class="aviator-dropdown-phone">${phone}</span>` : ''}
        </div>
        <div class="aviator-menu-divider puter-menu-divider"></div>
        <button class="aviator-menu-item puter-menu-item" id="btn-user-deposit">
          <span class="aviator-menu-icon puter-menu-icon">⚡</span>
          <span>Deposit Funds (Min 500)</span>
        </button>
        <button class="aviator-menu-item puter-menu-item" id="btn-user-history">
          <span class="aviator-menu-icon puter-menu-icon">📜</span>
          <span>Round History</span>
        </button>
        <button class="aviator-menu-item puter-menu-item" id="btn-user-provably-fair">
          <span class="aviator-menu-icon puter-menu-icon">🛡️</span>
          <span>Provably Fair Keys</span>
        </button>
        <div class="aviator-menu-divider puter-menu-divider"></div>
        <button class="aviator-menu-item puter-menu-item text-danger" id="btn-user-signout">
          <span class="aviator-menu-icon puter-menu-icon">🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    `;

    containers.forEach(c => {
      c.innerHTML = html;
    });

    // Wire dropdown toggle & actions
    const trigger = document.getElementById('aviator-user-trigger');
    const menu = document.getElementById('aviator-user-menu');

    if (trigger && menu) {
      trigger.onclick = (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
        this.soundEngine?.playClick();
      };
    }

    const depBtn = document.getElementById('btn-user-deposit');
    if (depBtn) {
      depBtn.onclick = () => {
        menu?.classList.remove('show');
        const modal = document.getElementById('deposit-modal');
        if (modal) modal.classList.add('show');
      };
    }

    const histBtn = document.getElementById('btn-user-history');
    if (histBtn) {
      histBtn.onclick = () => {
        menu?.classList.remove('show');
        const modal = document.getElementById('round-history-modal');
        if (modal) modal.classList.add('show');
      };
    }

    const pfBtn = document.getElementById('btn-user-provably-fair');
    if (pfBtn) {
      pfBtn.onclick = () => {
        menu?.classList.remove('show');
        const modal = document.getElementById('pf-modal');
        if (modal) modal.classList.add('show');
      };
    }

    const signoutBtn = document.getElementById('btn-user-signout');
    if (signoutBtn) {
      signoutBtn.onclick = () => {
        menu?.classList.remove('show');
        this.logout();
      };
    }
  }

  renderLoggedOut() {
    const containers = [
      document.getElementById('aviator-auth-container'),
      document.getElementById('puter-auth-container')
    ].filter(Boolean);

    if (containers.length === 0) return;

    const html = `
      <button class="btn-aviator-auth btn-puter-auth" id="btn-open-auth-portal" title="Login or Register Aviator Account">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>Login / Sign Up</span>
      </button>
    `;

    containers.forEach(c => {
      c.innerHTML = html;
    });

    const btn = document.getElementById('btn-open-auth-portal');
    if (btn) {
      btn.onclick = () => {
        this.openAuthModal('login');
      };
    }
  }

  setupDropdownListeners() {
    // Close user dropdown menu when clicking anywhere else
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('aviator-user-menu');
      const trigger = document.getElementById('aviator-user-trigger');
      if (menu && menu.classList.contains('show')) {
        if (!menu.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
          menu.classList.remove('show');
        }
      }
    });
  }

  setupModalListeners() {
    // Close modal button
    const closeBtn = document.getElementById('btn-close-auth');
    if (closeBtn) {
      closeBtn.onclick = () => this.closeAuthModal();
    }

    // Backdrop click to close
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) this.closeAuthModal();
      };
    }

    // Tabs toggle
    const tabLogin = document.getElementById('tab-auth-login');
    if (tabLogin) {
      tabLogin.onclick = () => this.switchTab('login');
    }
    const tabReg = document.getElementById('tab-auth-register');
    if (tabReg) {
      tabReg.onclick = () => this.switchTab('register');
    }

    // Toggle password reveals
    const toggleLoginPwd = document.getElementById('btn-toggle-login-pwd');
    if (toggleLoginPwd) {
      toggleLoginPwd.onclick = () => {
        const inp = document.getElementById('login-password');
        if (inp) {
          inp.type = inp.type === 'password' ? 'text' : 'password';
        }
      };
    }
    const toggleRegPwd = document.getElementById('btn-toggle-reg-pwd');
    if (toggleRegPwd) {
      toggleRegPwd.onclick = () => {
        const inp = document.getElementById('reg-password');
        if (inp) {
          inp.type = inp.type === 'password' ? 'text' : 'password';
        }
      };
    }

    // Instant One-Click Demo Login
    const demoBtn = document.getElementById('btn-quick-demo-login');
    if (demoBtn) {
      demoBtn.onclick = () => {
        const idInp = document.getElementById('login-identifier');
        const pwdInp = document.getElementById('login-password');
        if (idInp) idInp.value = 'pilot_vip';
        if (pwdInp) pwdInp.value = '1234';
        this.login('pilot_vip', '1234');
      };
    }

    // Submit Login
    const submitLogin = document.getElementById('btn-submit-login');
    if (submitLogin) {
      submitLogin.onclick = () => {
        const idInp = document.getElementById('login-identifier');
        const pwdInp = document.getElementById('login-password');
        this.login(idInp?.value, pwdInp?.value);
      };
    }

    // Enter key submits login
    const loginPwd = document.getElementById('login-password');
    if (loginPwd) {
      loginPwd.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const idInp = document.getElementById('login-identifier');
          this.login(idInp?.value, loginPwd.value);
        }
      };
    }

    // Submit Register
    const submitReg = document.getElementById('btn-submit-register');
    if (submitReg) {
      submitReg.onclick = () => {
        const phone = document.getElementById('reg-phone')?.value;
        const user = document.getElementById('reg-username')?.value;
        const pwd = document.getElementById('reg-password')?.value;
        const conf = document.getElementById('reg-confirm-password')?.value;
        this.register(phone, user, pwd, conf);
      };
    }

    // Enter key submits registration
    const regConf = document.getElementById('reg-confirm-password');
    if (regConf) {
      regConf.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const phone = document.getElementById('reg-phone')?.value;
          const user = document.getElementById('reg-username')?.value;
          const pwd = document.getElementById('reg-password')?.value;
          this.register(phone, user, pwd, regConf.value);
        }
      };
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
