/**
 * Aviator Phone Authentication & Session Manager (100% Free)
 * Login & Sign Up with Phone Number only - no passwords required!
 * Features:
 * - Single-step Instant Phone Login & Registration
 * - Free Simulated SMS OTP option for verification
 * - Kenyan (+254) & International phone normalization
 * - Isolated Wallet Balance persistence per phone number
 * - Masked Phone privacy display in App Header
 * - Seamless integration with StakingManager, Deposit Modal, and History
 */

const STORAGE_USERS_KEY = 'aviator_registered_users';
const STORAGE_SESSION_KEY = 'aviator_active_session';

const DEFAULT_DEMO_USERS = [
  {
    id: '849201',
    phone: '+254712345678',
    balance: 50000.00,
    createdAt: 1727180000000,
    lastLogin: Date.now(),
    vipLevel: 'VIP Pilot'
  },
  {
    id: '592104',
    phone: '+254798765432',
    balance: 50000.00,
    createdAt: 1727180000000,
    lastLogin: Date.now(),
    vipLevel: 'Cadet Pilot'
  }
];

export class AuthManager {
  constructor(stakingManager, soundEngine, onAuthChange) {
    this.stakingManager = stakingManager;
    this.soundEngine = soundEngine;
    this.onAuthChange = onAuthChange;
    this.user = null;
    this.currentOtp = null;
    this.isOtpMode = false;

    this.init();
  }

  init() {
    this.ensureSeedUsers();
    this.restoreSession();
    this.setupModalListeners();
    this.setupDropdownListeners();
    this.hookBalancePersistence();
  }

  normalizePhoneNumber(raw) {
    if (!raw) return '';
    let cleaned = raw.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('07') && cleaned.length === 10) {
      return '+254' + cleaned.slice(1);
    }
    if (cleaned.startsWith('01') && cleaned.length === 10) {
      return '+254' + cleaned.slice(1);
    }
    if (cleaned.startsWith('7') && cleaned.length === 9) {
      return '+254' + cleaned;
    }
    if (cleaned.startsWith('1') && cleaned.length === 9) {
      return '+254' + cleaned;
    }
    if (cleaned.startsWith('254') && cleaned.length === 12) {
      return '+' + cleaned;
    }
    if (!cleaned.startsWith('+') && cleaned.length >= 9) {
      return '+' + cleaned;
    }
    return cleaned;
  }

  maskPhone(phone) {
    if (!phone) return 'Pilot';
    const norm = this.normalizePhoneNumber(phone);
    if (norm.length >= 10) {
      const prefix = norm.slice(0, 7); // e.g. +254 712
      const suffix = norm.slice(-3);   // e.g. 678
      return `${prefix}•••${suffix}`;
    }
    return norm;
  }

  ensureSeedUsers() {
    try {
      const raw = localStorage.getItem(STORAGE_USERS_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(DEFAULT_DEMO_USERS));
      } else {
        const users = JSON.parse(raw);
        if (!Array.isArray(users) || users.length === 0) {
          localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(DEFAULT_DEMO_USERS));
        }
      }
    } catch (e) {
      console.warn('[AuthManager] Local storage init notice:', e);
    }
  }

  getAllUsers() {
    try {
      const raw = localStorage.getItem(STORAGE_USERS_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_DEMO_USERS;
    } catch (e) {
      return DEFAULT_DEMO_USERS;
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
        const found = users.find(u => String(u.id) === String(sessionId) || u.phone === sessionId);
        if (found) {
          this.user = found;
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

  openAuthModal() {
    this.soundEngine?.playClick();
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    this.clearStatus();
    this.resetOtpMode();

    modal.classList.add('show');
    const inp = document.getElementById('auth-phone-input');
    if (inp) {
      inp.focus();
    }
  }

  closeAuthModal() {
    this.soundEngine?.playClick();
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('show');
    this.resetOtpMode();
  }

  resetOtpMode() {
    this.isOtpMode = false;
    this.currentOtp = null;
    const otpSec = document.getElementById('auth-otp-section');
    if (otpSec) otpSec.style.display = 'none';

    const submitBtn = document.getElementById('btn-submit-phone-auth');
    if (submitBtn) {
      submitBtn.innerHTML = `<span>⚡ Continue with Phone (Instant & Free)</span>`;
    }
    const toggleBtn = document.getElementById('btn-toggle-free-otp');
    if (toggleBtn) {
      toggleBtn.style.display = 'block';
    }
  }

  startFreeOtpMode() {
    const rawPhone = document.getElementById('auth-phone-input')?.value;
    const normPhone = this.normalizePhoneNumber(rawPhone);

    if (!normPhone || normPhone.length < 10) {
      this.setStatus('Please enter a valid mobile phone number first (e.g. 07XX XXX XXX).');
      return;
    }

    this.soundEngine?.playClick();
    this.isOtpMode = true;
    this.currentOtp = String(Math.floor(1000 + Math.random() * 9000));

    const otpSec = document.getElementById('auth-otp-section');
    if (otpSec) otpSec.style.display = 'block';

    const simCode = document.getElementById('simulated-otp-code');
    if (simCode) simCode.textContent = this.currentOtp;

    const otpInp = document.getElementById('auth-otp-input');
    if (otpInp) {
      otpInp.value = '';
      otpInp.focus();
    }

    const submitBtn = document.getElementById('btn-submit-phone-auth');
    if (submitBtn) {
      submitBtn.innerHTML = `<span>Confirm OTP & Enter Aviator</span>`;
    }

    const toggleBtn = document.getElementById('btn-toggle-free-otp');
    if (toggleBtn) {
      toggleBtn.style.display = 'none';
    }

    this.setStatus(`Free SMS sent to ${normPhone}! Verification code: ${this.currentOtp}`, false);
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

  // 1-step Phone Login & Signup
  authenticateWithPhone(rawPhone, otpCode = null) {
    const normPhone = this.normalizePhoneNumber(rawPhone);

    if (!normPhone || normPhone.length < 10) {
      this.setStatus('Please enter a valid mobile phone number (min 9 digits, e.g. 0712 345 678).');
      return false;
    }

    // If OTP mode is active, verify the code
    if (this.isOtpMode) {
      const enteredOtp = (otpCode || document.getElementById('auth-otp-input')?.value || '').trim();
      if (!enteredOtp || enteredOtp !== this.currentOtp) {
        this.setStatus(`Incorrect OTP code. Enter the 4-digit code shown above (${this.currentOtp}).`);
        this.soundEngine?.playClick();
        return false;
      }
    }

    const users = this.getAllUsers();
    let user = users.find(u => u.phone.replace(/[\s+-]/g, '') === normPhone.replace(/[\s+-]/g, ''));

    if (user) {
      // Existing User -> Log in!
      user.lastLogin = Date.now();
      this.user = user;
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, String(user.id));
      } catch (e) {}

      if (typeof user.balance === 'number' && !isNaN(user.balance)) {
        this.stakingManager.balance = user.balance;
        this.stakingManager.saveBalance();
      }

      this.renderLoggedIn();
      this.closeAuthModal();
      this.soundEngine?.playCashout();
      this.showToast(`Welcome back, ${this.maskPhone(user.phone)}!`);
      if (this.onAuthChange) this.onAuthChange(this.user);
      return true;
    } else {
      // New User -> Free Instant Registration with 50,000 KES Demo Bankroll!
      const newUser = {
        id: String(Math.floor(100000 + Math.random() * 900000)),
        phone: normPhone,
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
      this.showToast(`Account created for ${this.maskPhone(newUser.phone)}! +KES 50,000 Free Bankroll Credited.`);
      if (this.onAuthChange) this.onAuthChange(this.user);
      return true;
    }
  }

  logout() {
    this.soundEngine?.playClick();
    if (this.user) {
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

    const phone = this.user?.phone || '+254712345678';
    const masked = this.maskPhone(phone);
    const userId = this.user?.id || '849201';
    const vipLevel = this.user?.vipLevel || 'Verified Pilot';

    const html = `
      <div class="aviator-user-pill puter-user-pill" id="aviator-user-trigger" title="Aviator Account: ${phone}">
        <span class="aviator-avatar puter-avatar">📱</span>
        <span class="aviator-name puter-name desktop-only">${masked}</span>
        <span class="aviator-online-dot puter-cloud-dot" title="Account Active"></span>
        <span class="aviator-chevron puter-chevron">▼</span>
      </div>
      <div class="aviator-dropdown-menu puter-dropdown-menu" id="aviator-user-menu">
        <div class="aviator-dropdown-header puter-dropdown-header">
          <div class="aviator-badge-row">
            <span class="aviator-badge puter-badge">🟢 ${vipLevel}</span>
            <span class="aviator-id-tag">ID: #${userId}</span>
          </div>
          <strong class="aviator-dropdown-username puter-dropdown-username">${phone}</strong>
          <span class="aviator-dropdown-phone">Free Active Mobile Account</span>
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
      <button class="btn-aviator-auth btn-puter-auth" id="btn-open-auth-portal" title="Login with Phone Number (Free)">
        <span class="auth-icon-phone">📱</span>
        <span>Phone Login</span>
      </button>
    `;

    containers.forEach(c => {
      c.innerHTML = html;
    });

    const btn = document.getElementById('btn-open-auth-portal');
    if (btn) {
      btn.onclick = () => {
        this.openAuthModal();
      };
    }
  }

  setupDropdownListeners() {
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
    // Close modal
    const closeBtn = document.getElementById('btn-close-auth');
    if (closeBtn) {
      closeBtn.onclick = () => this.closeAuthModal();
    }

    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) this.closeAuthModal();
      };
    }

    // Quick demo phone chips
    document.querySelectorAll('.btn-quick-phone-chip').forEach(btn => {
      btn.onclick = () => {
        const phone = btn.getAttribute('data-phone');
        const inp = document.getElementById('auth-phone-input');
        if (inp) inp.value = phone;
        this.authenticateWithPhone(phone);
      };
    });

    // Toggle Free SMS OTP mode
    const toggleOtpBtn = document.getElementById('btn-toggle-free-otp');
    if (toggleOtpBtn) {
      toggleOtpBtn.onclick = () => {
        this.startFreeOtpMode();
      };
    }

    // Auto-fill OTP button
    const autofillBtn = document.getElementById('btn-autofill-otp');
    if (autofillBtn) {
      autofillBtn.onclick = () => {
        const otpInp = document.getElementById('auth-otp-input');
        if (otpInp && this.currentOtp) {
          otpInp.value = this.currentOtp;
          const phoneInp = document.getElementById('auth-phone-input');
          this.authenticateWithPhone(phoneInp?.value, this.currentOtp);
        }
      };
    }

    // Submit Phone Auth
    const submitBtn = document.getElementById('btn-submit-phone-auth');
    if (submitBtn) {
      submitBtn.onclick = () => {
        const phoneInp = document.getElementById('auth-phone-input');
        const otpInp = document.getElementById('auth-otp-input');
        this.authenticateWithPhone(phoneInp?.value, otpInp?.value);
      };
    }

    // Enter key submits
    const phoneInp = document.getElementById('auth-phone-input');
    if (phoneInp) {
      phoneInp.onkeydown = (e) => {
        if (e.key === 'Enter') {
          if (!this.isOtpMode) {
            this.authenticateWithPhone(phoneInp.value);
          } else {
            const otpInp = document.getElementById('auth-otp-input');
            this.authenticateWithPhone(phoneInp.value, otpInp?.value);
          }
        }
      };
    }

    const otpInp = document.getElementById('auth-otp-input');
    if (otpInp) {
      otpInp.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const p = document.getElementById('auth-phone-input')?.value;
          this.authenticateWithPhone(p, otpInp.value);
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
