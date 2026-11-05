/**
 * Aviator Phone Authentication & Session Manager (TypeScript Version)
 * Integrates with Next.js API routes for authentication
 */

export interface User {
  id: string;
  phone: string;
  username: string;
  passwordHash?: string;
  balance: number;
  realBalance: number;
  demoBalance: number;
  createdAt: number;
  lastLogin?: number;
  vipLevel?: string;
  avatar?: string;
  passwordResetHistory?: number[];
}

export interface ResetLimitCheck {
  allowed: boolean;
  usedCount: number;
  maxCount: number;
  nextAllowedDate: Date | null;
  msRemaining: number;
}

const STORAGE_SESSION_KEY = 'aviator_active_session_spark';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RESETS_PER_WEEK = 2;

export class AuthManager {
  user: User | null;
  onAuthChange: ((user: User | null) => void) | null;

  constructor(onAuthChange?: (user: User | null) => void) {
    this.user = null;
    this.onAuthChange = onAuthChange || null;
    this.restoreSession();
  }

  normalizePhoneNumber(raw: string): string {
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

  maskPhone(phone: string): string {
    if (!phone) return 'Pilot';
    const norm = this.normalizePhoneNumber(phone);
    if (norm.length >= 10) {
      const prefix = norm.slice(0, 7);
      const suffix = norm.slice(-3);
      return `${prefix}•••${suffix}`;
    }
    return norm;
  }

  restoreSession(): void {
    try {
      const sessionId = localStorage.getItem(STORAGE_SESSION_KEY);
      if (sessionId) {
        // In production, this would validate the session with the API
        // For now, we'll store minimal session data
        const userData = localStorage.getItem('aviator_user_data');
        if (userData) {
          this.user = JSON.parse(userData);
          if (this.onAuthChange) this.onAuthChange(this.user);
        }
      }
    } catch (e) {
      console.warn('[AuthManager] Session restore notice:', e);
    }
  }

  async loginWithPhone(rawPhone: string, rawPassword: string): Promise<{ success: boolean; error?: string }> {
    const normPhone = this.normalizePhoneNumber(rawPhone);
    if (!normPhone || normPhone.length < 10) {
      return { success: false, error: 'Please enter a valid mobile phone number (e.g. 0712 345 678).' };
    }

    if (!rawPassword || rawPassword.trim().length < 4) {
      return { success: false, error: 'Please enter your password (minimum 4 characters).' };
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normPhone, password: rawPassword })
      });

      const data = await res.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Login failed' };
      }

      this.user = data.user;
      this.saveSession();
      if (this.onAuthChange) this.onAuthChange(this.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  async registerWithPhone(rawPhone: string, rawPassword: string, rawConfirmPassword: string): Promise<{ success: boolean; error?: string }> {
    const normPhone = this.normalizePhoneNumber(rawPhone);
    if (!normPhone || normPhone.length < 10) {
      return { success: false, error: 'Please enter a valid mobile phone number (min 9 digits, e.g. 0712 345 678).' };
    }

    if (!rawPassword || rawPassword.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long.' };
    }

    if (rawPassword !== rawConfirmPassword) {
      return { success: false, error: 'Passwords do not match. Please re-enter your password to confirm.' };
    }

    try {
      const res = await fetch('/api/auth/phone-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normPhone, password: rawPassword })
      });

      const data = await res.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      this.user = data.user;
      this.saveSession();
      if (this.onAuthChange) this.onAuthChange(this.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  async requestPasswordReset(rawPhone: string): Promise<{ success: boolean; error?: string }> {
    const normPhone = this.normalizePhoneNumber(rawPhone);
    if (!normPhone || normPhone.length < 10) {
      return { success: false, error: 'Please enter your mobile phone number.' };
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normPhone })
      });

      const data = await res.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Failed to request reset' };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  async updatePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!this.user) {
      return { success: false, error: 'Not logged in' };
    }

    if (!newPassword || newPassword.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters.' };
    }

    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: this.user.phone,
          oldPassword,
          newPassword
        })
      });

      const data = await res.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Password update failed' };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  logout(): void {
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      localStorage.removeItem('aviator_user_data');
    } catch (e) {}

    this.user = null;
    if (this.onAuthChange) this.onAuthChange(null);
  }

  saveSession(): void {
    if (this.user) {
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, this.user.id);
        localStorage.setItem('aviator_user_data', JSON.stringify(this.user));
      } catch (e) {
        console.warn('[AuthManager] Failed to save session:', e);
      }
    }
  }

  checkResetLimit(user: User): ResetLimitCheck {
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

  recordPasswordReset(user: User): void {
    if (!Array.isArray(user.passwordResetHistory)) {
      user.passwordResetHistory = [];
    }
    user.passwordResetHistory.push(Date.now());

    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
    user.passwordResetHistory = user.passwordResetHistory.filter(ts => ts > twoWeeksAgo);
  }
}
