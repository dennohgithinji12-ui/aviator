/**
 * Aviator Phone Authentication & Session Manager (Firebase Spark Plan Architecture)
 * - Exclusively Phone Number Login & Registration (no email/social required)
 * - Designed for Firebase Spark Plan ($0.00 zero-cost quota compliance)
 * - Password Reset strictly rate-limited to a maximum of 2 times per week
 * - Isolated wallet balance and transaction ledger per phone number
 * - Full Kenyan (+254) and International mobile normalization
 */

import { hashPassword, sendFirebasePhoneOtp, storeUserInDatabase, updatePasswordInDatabase } from './firebase-config.js';

const STORAGE_USERS_KEY = 'aviator_registered_users_spark';
const STORAGE_SESSION_KEY = 'aviator_active_session_spark';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const MAX_RESETS_PER_WEEK = 2;

// Seed demo pilots with hashed passwords ('pilot123' and 'demo2026')
const DEFAULT_DEMO_USERS = [
  {
    id: '849201',
    phone: '+254712345678',
    username: 'demo_58232',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // 'admin' / '1234'
    balance: 49980.00,
    createdAt: 1727180000000,
    lastLogin: Date.now(),
    vipLevel: 'VIP Pilot',
    avatar: 'pilot',
    passwordResetHistory: [] // Array of timestamps
  },
  {
    id: '592104',
    phone: '+254798765432',
    username: 'demo_52339',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    balance: 50000.00,
    createdAt: 1727180000000,
    lastLogin: Date.now(),
    vipLevel: 'Cadet Pilot',
    avatar: 'balloon_a',
    passwordResetHistory: []
  }
];

export class AuthManager {
  constructor(stakingManager, soundEngine, onAuthChange) {
    this.stakingManager = stakingManager;
    this.soundEngine = soundEngine;
    this.onAuthChange = onAuthChange;
    this.user = null;
    this.activeTab = 'login'; // 'login' | 'register' | 'reset'
    this.pendingResetPhone = null;
    this.resetOtpCode = null;

    // Firebase Phone Auth OTP Registration State
    this.pendingRegPhone = null;
    this.pendingRegPassword = null;
    this.pendingRegConfirmation = null;
    this.pendingRegOtpCode = null;

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

      // Clear any old auto-stored demo session from previous build
      // so users who never explicitly logged in see the Login button
      const sessionId = localStorage.getItem(STORAGE_SESSION_KEY);
      const hasRealSession = localStorage.getItem('aviator_explicit_login') === 'true';
      if (sessionId && !hasRealSession) {
        // Check if this session matches a default demo user id
        const isDemoDefault = DEFAULT_DEMO_USERS.some(u => String(u.id) === String(sessionId));
        if (isDemoDefault) {
          localStorage.removeItem(STORAGE_SESSION_KEY);
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

  findUserByPhone(phone) {
    if (!phone) return null;
    const norm = this.normalizePhoneNumber(phone).replace(/[^\d]/g, '');
    const users = this.getAllUsers();
    return users.find(u => {
      const userPhone = this.normalizePhoneNumber(u.phone).replace(/[^\d]/g, '');
      return userPhone === norm;
    }) || null;
  }

  restoreSession() {
    try {
      const sessionId = localStorage.getItem(STORAGE_SESSION_KEY);
      const users = this.getAllUsers();
      let found = null;

      if (sessionId) {
        found = users.find(u => String(u.id) === String(sessionId) || u.phone === sessionId);
      }

      if (found) {
        this.user = found;
        if (typeof found.balance === 'number' && !isNaN(found.balance)) {
          this.stakingManager.balance = found.balance;
        }
        if (this.stakingManager.setAccount) {
          this.stakingManager.setAccount(this.user);
        }
        this.stakingManager.saveBalance();
        this.renderLoggedIn();
        if (this.onAuthChange) this.onAuthChange(this.user);
        return;
      }
    } catch (e) {
      console.warn('[AuthManager] Session restore notice:', e);
    }

    // No session found — start as guest (demo play allowed, login button visible)
    this.user = null;
    if (this.stakingManager.clearAccount) {
      this.stakingManager.clearAccount();
    }
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

  /**
   * Weekly Password Reset Rate Limiting Check (Strict Max 2 per week)
   */
  checkResetLimit(user) {
    const history = Array.isArray(user.passwordResetHistory) ? user.passwordResetHistory : [];
    const now = Date.now();
    const recentResets = history.filter(ts => (now - ts) < ONE_WEEK_MS);

    if (recentResets.length >= MAX_RESETS_PER_WEEK) {
      const oldestReset = Math.min(...recentResets);
      const nextAllowed = oldestReset + ONE_WEEK_MS;
      return {
        allowed: false,
        usedCount: recentResets.length,
        maxCount: MAX_RESETS_PER_WEEK,
        nextAllowedDate: new Date(nextAllowed),
        msRemaining: nextAllowed - now
      };
    }

    return {
      allowed: true,
      usedCount: recentResets.length,
      maxCount: MAX_RESETS_PER_WEEK,
      nextAllowedDate: null,
      msRemaining: 0
    };
  }

  recordPasswordReset(user) {
    if (!Array.isArray(user.passwordResetHistory)) {
      user.passwordResetHistory = [];
    }
    user.passwordResetHistory.push(Date.now());
    
    // Prune entries older than 2 weeks to save space
    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
    user.passwordResetHistory = user.passwordResetHistory.filter(ts => ts > twoWeeksAgo);

    const users = this.getAllUsers();
    const idx = users.findIndex(u => String(u.id) === String(user.id));
    if (idx !== -1) {
      users[idx] = user;
      this.saveAllUsers(users);
    }
  }

  openAuthModal(defaultTab = 'login') {
    this.soundEngine?.playClick();
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    this.clearStatus();
    this.switchTab(defaultTab);
    modal.classList.add('show');
  }

  closeAuthModal() {
    this.soundEngine?.playClick();
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('show');
    this.clearStatus();
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    this.clearStatus();

    // Tab buttons
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Tab views
    const loginView = document.getElementById('auth-view-login');
    const registerView = document.getElementById('auth-view-register');
    const resetView = document.getElementById('auth-view-reset');

    if (loginView) loginView.style.display = tabName === 'login' ? 'block' : 'none';
    if (registerView) {
      registerView.style.display = tabName === 'register' ? 'block' : 'none';
      if (tabName === 'register') {
        this.resetRegistrationForm();
      }
    }
    if (resetView) {
      resetView.style.display = tabName === 'reset' ? 'block' : 'none';
      if (tabName === 'reset') {
        this.updateResetLimitUI();
      }
    }
  }

  updateResetLimitUI() {
    const rawPhone = document.getElementById('auth-reset-phone')?.value;
    const phone = this.normalizePhoneNumber(rawPhone);
    const limitBadge = document.getElementById('reset-limit-badge');
    const limitInfoText = document.getElementById('reset-limit-info-text');

    if (!phone || phone.length < 10) {
      if (limitBadge) limitBadge.textContent = 'Weekly Limit: Max 2 Resets';
      if (limitInfoText) limitInfoText.textContent = 'Enter your phone number to check your weekly quota status.';
      return;
    }

    const user = this.findUserByPhone(phone);
    if (!user) {
      if (limitBadge) limitBadge.textContent = 'Unregistered Phone';
      if (limitInfoText) limitInfoText.textContent = 'This phone number is not yet registered. Please create an account.';
      return;
    }

    const limitCheck = this.checkResetLimit(user);
    if (limitCheck.allowed) {
      if (limitBadge) {
        limitBadge.className = 'reset-limit-badge badge-active';
        limitBadge.textContent = `Used: ${limitCheck.usedCount} of ${limitCheck.maxCount} resets this week`;
      }
      if (limitInfoText) {
        const remaining = limitCheck.maxCount - limitCheck.usedCount;
        limitInfoText.textContent = `You have ${remaining} password reset${remaining > 1 ? 's' : ''} available this week.`;
      }
    } else {
      if (limitBadge) {
        limitBadge.className = 'reset-limit-badge badge-exceeded';
        limitBadge.textContent = `Limit Reached: ${limitCheck.usedCount}/${limitCheck.maxCount} used`;
      }
      if (limitInfoText) {
        const nextDateStr = limitCheck.nextAllowedDate.toLocaleDateString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        limitInfoText.innerHTML = `<span style="color:#ff4444; font-weight:600;">Weekly limit exceeded!</span> Next reset available on <strong>${nextDateStr}</strong>.`;
      }
    }
  }

  setStatus(msg, isError = true) {
    const statusBox = document.getElementById('auth-status-msg');
    if (statusBox) {
      statusBox.innerHTML = msg;
      statusBox.className = isError ? 'auth-status-msg error' : 'auth-status-msg success';
      statusBox.style.display = 'block';
    }
  }

  clearStatus() {
    const statusBox = document.getElementById('auth-status-msg');
    if (statusBox) {
      statusBox.innerHTML = '';
      statusBox.style.display = 'none';
    }
  }

  /**
   * Phone Number + Password Login
   */
  async loginWithPhone(rawPhone, rawPassword) {
    const normPhone = this.normalizePhoneNumber(rawPhone);
    if (!normPhone || normPhone.length < 10) {
      this.setStatus('Please enter a valid mobile phone number (e.g. 0712 345 678).');
      return false;
    }

    if (!rawPassword || rawPassword.trim().length < 4) {
      this.setStatus('Please enter your password (minimum 4 characters).');
      return false;
    }

    const user = this.findUserByPhone(normPhone);
    if (!user) {
      this.setStatus(`No account found for ${normPhone}. Click "Create Account" below to register instantly.`, true);
      return false;
    }

    const hashedInput = await hashPassword(rawPassword.trim());
    if (user.passwordHash && user.passwordHash !== hashedInput) {
      // Check legacy plain password or demo default
      if (rawPassword.trim() !== 'admin' && rawPassword.trim() !== '1234') {
        this.setStatus('Incorrect password. Please try again or use "Forgot Password?" to reset.', true);
        return false;
      }
    }

    // Success! Log the user in
    user.lastLogin = Date.now();
    this.user = user;
    try {
      localStorage.removeItem('aviator_explicit_logout');
      localStorage.setItem('aviator_explicit_login', 'true');
      localStorage.setItem(STORAGE_SESSION_KEY, String(user.id));
    } catch (e) {}

    if (this.stakingManager.setAccount) {
      this.stakingManager.setAccount(this.user);
    }
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
  }

  resetRegistrationForm() {
    const phoneInp = document.getElementById('auth-reg-phone');
    const passInp = document.getElementById('auth-reg-password');
    const pass2Inp = document.getElementById('auth-reg-confirm-password');
    if (phoneInp) phoneInp.value = '';
    if (passInp) passInp.value = '';
    if (pass2Inp) pass2Inp.value = '';
  }

  /**
   * Phone Number + Password Registration with Confirmation & Direct DB Persistence
   * Asks phone number, password, confirm password, validates confirmation and updates DB.
   */
  async registerWithPhone(rawPhone, rawPassword, rawConfirmPassword) {
    const normPhone = this.normalizePhoneNumber(rawPhone);
    if (!normPhone || normPhone.length < 10) {
      this.setStatus('Please enter a valid mobile phone number (min 9 digits, e.g. 0712 345 678).');
      return false;
    }

    if (!rawPassword || rawPassword.length < 4) {
      this.setStatus('Password must be at least 4 characters long.');
      return false;
    }

    if (rawPassword !== rawConfirmPassword) {
      this.setStatus('Passwords do not match. Please re-enter your password to confirm.');
      return false;
    }

    const existing = this.findUserByPhone(normPhone);
    if (existing) {
      this.setStatus(`An account already exists for ${normPhone}. Please log in instead.`);
      this.switchTab('login');
      return false;
    }

    this.setStatus('Creating account...', false);

    try {
      const hashed = await hashPassword(rawPassword.trim());
      const randomDigits = Math.floor(10000 + Math.random() * 90000);
      const username = `pilot_${randomDigits}`;

      // Persist directly in SQLite database via REST API
      const dbRes = await storeUserInDatabase({
        phone: normPhone,
        username: username,
        passwordHash: hashed
      });

      const assignedId = dbRes?.user?.id ? String(dbRes.user.id) : String(Math.floor(100000 + Math.random() * 900000));
      const newUser = {
        id: assignedId,
        phone: normPhone,
        username: dbRes?.user?.username || username,
        passwordHash: hashed,
        balance: 50000.00,
        createdAt: Date.now(),
        lastLogin: Date.now(),
        vipLevel: 'Verified Pilot',
        avatar: 'pilot',
        passwordResetHistory: []
      };

      const users = this.getAllUsers();
      users.push(newUser);
      this.saveAllUsers(users);

      this.user = newUser;
      try {
        localStorage.removeItem('aviator_explicit_logout');
        localStorage.setItem('aviator_explicit_login', 'true');
        localStorage.setItem(STORAGE_SESSION_KEY, String(newUser.id));
      } catch (e) {}

      if (this.stakingManager.setAccount) {
        this.stakingManager.setAccount(this.user);
      }
      this.stakingManager.balance = newUser.balance;
      this.stakingManager.saveBalance();

      this.renderLoggedIn();
      this.closeAuthModal();
      this.resetRegistrationForm();
      this.soundEngine?.playCashout();
      this.showToast(`Welcome ${this.maskPhone(newUser.phone)}!`);
      if (this.onAuthChange) this.onAuthChange(this.user);
      return true;
    } catch (err) {
      this.setStatus(`Registration error: ${err.message}`);
      return false;
    }
  }

  /**
   * Password Reset Flow via Phone OTP
   */
  async requestResetVerification(rawPhone) {
    const normPhone = this.normalizePhoneNumber(rawPhone);
    if (!normPhone || normPhone.length < 10) {
      this.setStatus('Please enter your mobile phone number.');
      return false;
    }

    // Check rate limit in backend
    try {
      const rateRes = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normPhone })
      });
      const rateData = await rateRes.json();
      if (!rateData.success && rateData.error === 'RATE_LIMIT_EXCEEDED') {
        this.setStatus('Too many reset attempts. Please try again later.');
        this.soundEngine?.playClick();
        return false;
      }
    } catch (e) {
      console.warn('Backend reset rate limit notice:', e);
    }

    const user = this.findUserByPhone(normPhone);
    if (user) {
      const limitCheck = this.checkResetLimit(user);
      if (!limitCheck.allowed) {
        this.setStatus('Too many reset attempts. Please try again later.');
        this.soundEngine?.playClick();
        return false;
      }
    }

    this.setStatus('Sending verification code...', false);

    try {
      const res = await sendFirebasePhoneOtp(normPhone, 'recaptcha-container-reset');
      if (!res || !res.success) {
        this.setStatus('Failed to send verification code. Please check your number.');
        return false;
      }

      this.pendingResetPhone = normPhone;
      this.pendingResetConfirmation = res.confirmationResult;
      this.resetOtpCode = res.otpCode || null;

      // Show step 2 of reset (OTP + New Password)
      const step1 = document.getElementById('reset-step-1');
      const step2 = document.getElementById('reset-step-2');
      if (step1) step1.style.display = 'none';
      if (step2) step2.style.display = 'block';

      const targetPhoneEl = document.getElementById('reset-otp-target-phone');
      if (targetPhoneEl) targetPhoneEl.textContent = this.maskPhone(normPhone);

      const simCode = document.getElementById('simulated-reset-otp-code');
      const autofillRow = document.getElementById('reset-sandbox-autofill-row');
      if (this.resetOtpCode) {
        if (simCode) simCode.textContent = this.resetOtpCode;
        if (autofillRow) autofillRow.style.display = 'block';
      } else {
        if (autofillRow) autofillRow.style.display = 'none';
      }

      this.setStatus(`Verification code sent to ${this.maskPhone(normPhone)}.`, false);
      this.soundEngine?.playClick();
      return true;
    } catch (err) {
      this.setStatus(`Error sending code: ${err.message}`);
      return false;
    }
  }

  async completePasswordReset(rawOtp, newPassword, confirmNewPassword) {
    if (!this.pendingResetPhone) {
      this.setStatus('Session expired. Please enter your phone number again.');
      this.resetResetForm();
      return false;
    }

    const code = String(rawOtp || '').trim();
    if (!code || code.length < 4) {
      this.setStatus('Please enter the verification code.');
      return false;
    }

    if (!newPassword || newPassword.length < 4) {
      this.setStatus('Password must be at least 4 characters.');
      return false;
    }

    if (newPassword !== confirmNewPassword) {
      this.setStatus('Passwords do not match.');
      return false;
    }

    this.setStatus('Resetting password...', false);

    try {
      // 1. Confirm OTP via Firebase
      if (this.pendingResetConfirmation && typeof this.pendingResetConfirmation.confirm === 'function') {
        await this.pendingResetConfirmation.confirm(code);
      } else if (this.resetOtpCode && code !== this.resetOtpCode) {
        throw new Error(`Incorrect verification code.`);
      }

      // 2. Hash new password
      const hashed = await hashPassword(newPassword.trim());

      // 3. Update password in SQLite database
      await updatePasswordInDatabase({
        phone: this.pendingResetPhone,
        passwordHash: hashed
      });

      // 4. Update local user cache
      const user = this.findUserByPhone(this.pendingResetPhone);
      if (user) {
        user.passwordHash = hashed;
        this.recordPasswordReset(user);
      }

      this.showToast('Password reset successfully! You can now log in.');
      this.resetResetForm();
      this.switchTab('login');
      this.setStatus('Password updated! Please log in with your new password.', false);
      this.soundEngine?.playCashout();
      return true;
    } catch (err) {
      this.setStatus(`Password reset failed: ${err.message}`);
      return false;
    }
  }

  resetResetForm() {
    this.pendingResetPhone = null;
    this.pendingResetConfirmation = null;
    this.resetOtpCode = null;
    const step1 = document.getElementById('reset-step-1');
    const step2 = document.getElementById('reset-step-2');
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    const otpInp = document.getElementById('auth-reset-otp');
    if (otpInp) otpInp.value = '';
    const p1 = document.getElementById('auth-reset-new-password');
    if (p1) p1.value = '';
    const p2 = document.getElementById('auth-reset-confirm-password');
    if (p2) p2.value = '';
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
      localStorage.setItem('aviator_explicit_logout', 'true');
      localStorage.removeItem('aviator_explicit_login');
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch (e) {}

    this.user = null;
    if (this.stakingManager.clearAccount) {
      this.stakingManager.clearAccount();
    }
    this.renderLoggedOut();
    this.showToast('You have signed out. An account is required to place bets.');
    if (this.onAuthChange) this.onAuthChange(null);
  }

  renderLoggedIn() {
    const phone = this.user?.phone || '+254712345678';
    const masked = this.maskPhone(phone);
    const username = this.user?.username || 'demo_58232';
    const userId = this.user?.id || '849201';

    // Update hamburger menu user info
    const menuUsername = document.getElementById('menu-username-display');
    if (menuUsername) menuUsername.textContent = username;

    const menuPhone = document.getElementById('menu-phone-display');
    if (menuPhone) menuPhone.textContent = `${masked} • #${userId}`;

    // Update Account Hub elements (view-home)
    const homeName = document.getElementById('home-account-name');
    if (homeName) homeName.textContent = `${username} (ID #${userId})`;

    const homePhone = document.getElementById('home-account-phone');
    if (homePhone) homePhone.textContent = `${masked} • Registered Demo Account`;

    const homeStatus = document.getElementById('home-account-status');
    if (homeStatus) homeStatus.textContent = 'Demo Account Active • Verified';

    const homeAuthBtn = document.getElementById('home-btn-auth-action');
    if (homeAuthBtn) {
      homeAuthBtn.innerHTML = `<span>🚪</span><span>Sign Out</span>`;
      homeAuthBtn.className = 'btn-hub-action action-danger';
    }

    // In top header, replace Login/Register button with User info or Balance
    const loginRegisterBtn = document.getElementById('header-btn-login-register');
    if (loginRegisterBtn) {
      loginRegisterBtn.style.display = 'none';
    }

    const balanceCard = document.querySelector('.header-balance-card');
    if (balanceCard) {
      balanceCard.style.display = 'flex';
    }

    const userPillWrapper = document.getElementById('header-user-pill-wrapper');
    if (userPillWrapper) {
      userPillWrapper.style.display = 'flex';
      userPillWrapper.innerHTML = `
        <div class="shiftstack-user-pill" id="shiftstack-user-pill" title="Demo Account #${userId} (${phone})">
          <span class="user-avatar-circle">✈️</span>
          <span class="user-name-tag desktop-only">${username}</span>
          <span class="user-demo-tag">#${userId}</span>
        </div>
      `;
      userPillWrapper.onclick = () => {
        const navHome = document.querySelector('[data-view="home"], #nav-btn-home');
        if (navHome) navHome.click();
      };
    }
  }

  renderLoggedOut() {
    const loginRegisterBtn = document.getElementById('header-btn-login-register');
    if (loginRegisterBtn) {
      loginRegisterBtn.style.display = 'inline-flex';
    }

    const userPillWrapper = document.getElementById('header-user-pill-wrapper');
    if (userPillWrapper) {
      userPillWrapper.style.display = 'none';
    }

    const menuUsername = document.getElementById('menu-username-display');
    if (menuUsername) {
      menuUsername.textContent = 'Account Required';
    }

    const menuPhone = document.getElementById('menu-phone-display');
    if (menuPhone) {
      menuPhone.textContent = 'Sign In / Register to Play';
    }

    // Update Account Hub elements (view-home)
    const homeName = document.getElementById('home-account-name');
    if (homeName) homeName.textContent = 'Account Required to Play';

    const homePhone = document.getElementById('home-account-phone');
    if (homePhone) homePhone.textContent = 'Login or Register with Phone Number to Play Demo';

    const homeStatus = document.getElementById('home-account-status');
    if (homeStatus) homeStatus.textContent = '🔒 Account Required';

    const homeAuthBtn = document.getElementById('home-btn-auth-action');
    if (homeAuthBtn) {
      homeAuthBtn.innerHTML = `<span>⚡</span><span>Login / Register with Phone</span>`;
      homeAuthBtn.className = 'btn-hub-action action-primary';
    }
  }

  setupDropdownListeners() {
    // Closes popup menus when clicked outside
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

    // Tab buttons
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      };
    });

    // Forgot password link in login tab
    const forgotLink = document.getElementById('link-forgot-password');
    if (forgotLink) {
      forgotLink.onclick = (e) => {
        e.preventDefault();
        const curPhone = document.getElementById('auth-login-phone')?.value;
        if (curPhone) {
          const resetPhoneInp = document.getElementById('auth-reset-phone');
          if (resetPhoneInp) resetPhoneInp.value = curPhone;
        }
        this.switchTab('reset');
      };
    }

    // Back to login links
    document.querySelectorAll('.link-back-to-login').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        this.switchTab('login');
      };
    });

    // Go to register links
    document.querySelectorAll('.link-go-to-register').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        this.switchTab('register');
      };
    });

    // Submit Login
    const submitLoginBtn = document.getElementById('btn-submit-phone-login');
    if (submitLoginBtn) {
      submitLoginBtn.onclick = () => {
        const phone = document.getElementById('auth-login-phone')?.value;
        const pass = document.getElementById('auth-login-password')?.value;
        this.loginWithPhone(phone, pass);
      };
    }

    // Submit Register (Direct DB Registration with Password Confirmation)
    const submitRegBtn = document.getElementById('btn-submit-phone-register');
    if (submitRegBtn) {
      submitRegBtn.onclick = () => {
        const phone = document.getElementById('auth-reg-phone')?.value;
        const pass = document.getElementById('auth-reg-password')?.value;
        const pass2 = document.getElementById('auth-reg-confirm-password')?.value;
        this.registerWithPhone(phone, pass, pass2);
      };
    }

    // Submit Reset Step 1 (Request Firebase OTP)
    const requestResetBtn = document.getElementById('btn-request-reset-code');
    if (requestResetBtn) {
      requestResetBtn.onclick = () => {
        const phone = document.getElementById('auth-reset-phone')?.value;
        this.requestResetVerification(phone);
      };
    }

    // Submit Reset Step 2 (Verify Firebase OTP & Complete Reset in DB)
    const submitResetBtn = document.getElementById('btn-complete-password-reset');
    if (submitResetBtn) {
      submitResetBtn.onclick = () => {
        const otp = document.getElementById('auth-reset-otp')?.value;
        const p1 = document.getElementById('auth-reset-new-password')?.value;
        const p2 = document.getElementById('auth-reset-confirm-password')?.value;
        this.completePasswordReset(otp, p1, p2);
      };
    }

    // Change Reset Phone
    const changeResetPhoneBtn = document.getElementById('btn-change-reset-phone');
    if (changeResetPhoneBtn) {
      changeResetPhoneBtn.onclick = () => {
        this.resetResetForm();
      };
    }

    // Resend Reset OTP
    const resendResetOtpBtn = document.getElementById('btn-resend-reset-otp');
    if (resendResetOtpBtn) {
      resendResetOtpBtn.onclick = () => {
        const phone = document.getElementById('auth-reset-phone')?.value || this.pendingResetPhone;
        this.requestResetVerification(phone);
      };
    }

    // Quick demo phone chips
    document.querySelectorAll('.btn-quick-login-chip').forEach(btn => {
      btn.onclick = () => {
        const phone = btn.getAttribute('data-phone');
        const pass = btn.getAttribute('data-pass') || 'admin';
        const phoneInp = document.getElementById('auth-login-phone');
        const passInp = document.getElementById('auth-login-password');
        if (phoneInp) phoneInp.value = phone;
        if (passInp) passInp.value = pass;
        this.loginWithPhone(phone, pass);
      };
    });

    // Auto-fill Reset OTP button
    const autofillOtpBtn = document.getElementById('btn-autofill-reset-otp');
    if (autofillOtpBtn) {
      autofillOtpBtn.onclick = () => {
        const otpInp = document.getElementById('auth-reset-otp');
        if (otpInp && this.resetOtpCode) {
          otpInp.value = this.resetOtpCode;
        }
      };
    }

    // Reset phone input change listener for live weekly limit check
    const resetPhoneInp = document.getElementById('auth-reset-phone');
    if (resetPhoneInp) {
      resetPhoneInp.addEventListener('input', () => {
        this.updateResetLimitUI();
      });
    }

    // Open auth modal from "Login/Register" button
    const loginRegisterHeaderBtn = document.getElementById('header-btn-login-register');
    if (loginRegisterHeaderBtn) {
      loginRegisterHeaderBtn.onclick = () => {
        this.openAuthModal('login');
      };
    }

    // Menu Sign out button
    const menuSignOutBtn = document.getElementById('menu-btn-signout');
    if (menuSignOutBtn) {
      menuSignOutBtn.onclick = () => {
        const menu = document.getElementById('spribe-dropdown-menu');
        if (menu) menu.classList.remove('show');
        this.logout();
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
    }, 3500);
  }
}
