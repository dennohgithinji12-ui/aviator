'use client';

import { useState } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (phone: string, password?: string) => void;
  onSignup: (phone: string, username?: string, password?: string) => void;
  mode?: 'login' | 'signup';
}

export function AuthModal({ isOpen, onClose, onLogin, onSignup, mode = 'login' }: AuthModalProps) {
  const [currentMode, setCurrentMode] = useState<'login' | 'signup'>(mode);
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (currentMode === 'login') {
        await onLogin(phone, password);
      } else {
        await onSignup(phone, username, password);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const normalizePhone = (input: string): string => {
    const cleaned = input.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      return '254' + cleaned.substring(1);
    }
    if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      return '254' + cleaned;
    }
    if (cleaned.startsWith('254')) {
      return cleaned;
    }
    return cleaned;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizePhone(e.target.value);
    setPhone(normalized);
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h2>{currentMode === 'login' ? 'Login to ShiftStack' : 'Create Account'}</h2>
          <button className="auth-modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-modal-form">
          {error && (
            <div className="auth-error-message">
              {error}
            </div>
          )}

          <div className="auth-form-group">
            <label htmlFor="auth-phone">Phone Number</label>
            <input
              type="tel"
              id="auth-phone"
              className="auth-input"
              placeholder="2547XXXXXXXX"
              value={phone}
              onChange={handlePhoneChange}
              required
            />
            <span className="auth-input-hint">Format: 2547XXXXXXXX or 07XXXXXXXX</span>
          </div>

          {currentMode === 'signup' && (
            <div className="auth-form-group">
              <label htmlFor="auth-username">Username (Optional)</label>
              <input
                type="text"
                id="auth-username"
                className="auth-input"
                placeholder="Your display name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          <div className="auth-form-group">
            <label htmlFor="auth-password">Password {currentMode === 'signup' ? '(Optional)' : ''}</label>
            <input
              type="password"
              id="auth-password"
              className="auth-input"
              placeholder={currentMode === 'signup' ? 'Set a password' : 'Enter your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={currentMode === 'login'}
            />
            {currentMode === 'signup' && (
              <span className="auth-input-hint">Leave empty for phone-only login</span>
            )}
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading || phone.length < 12}
          >
            {loading ? 'Processing...' : currentMode === 'login' ? 'Login' : 'Create Account'}
          </button>

          <div className="auth-mode-switch">
            {currentMode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button type="button" onClick={() => setCurrentMode('signup')}>
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button type="button" onClick={() => setCurrentMode('login')}>
                  Login
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
