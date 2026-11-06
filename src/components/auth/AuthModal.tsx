'use client';

import { FormEvent, useEffect, useState } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (phone: string, password: string) => Promise<void>;
  onSignup: (phone: string, username: string | undefined, password: string) => Promise<void>;
  mode?: 'login' | 'signup';
}

function normalizeKenyanPhone(input: string) {
  let digits = input.trim().replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `254${digits.slice(1)}`;
  else if (digits.startsWith('7') || digits.startsWith('1')) digits = `254${digits}`;
  return /^254[17]\d{8}$/.test(digits) ? `+${digits}` : '';
}

export function AuthModal({ isOpen, onClose, onLogin, onSignup, mode = 'login' }: AuthModalProps) {
  const [currentMode, setCurrentMode] = useState<'login' | 'signup'>(mode);
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCurrentMode(mode);
      setError('');
      setSuccess('');
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const changeMode = (nextMode: 'login' | 'signup') => {
    setCurrentMode(nextMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const normalizedPhone = normalizeKenyanPhone(phone);
    if (!normalizedPhone) {
      setError('Enter a valid Kenyan phone number, such as 0712 345 678.');
      return;
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (currentMode === 'signup' && password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (currentMode === 'signup') {
        await onSignup(normalizedPhone, username.trim() || undefined, password);
        setCurrentMode('login');
        setPassword('');
        setConfirmPassword('');
        setSuccess('Account created. Log in with your phone number and password to start playing.');
      } else {
        await onLogin(normalizedPhone, password);
        onClose();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : currentMode === 'login' ? 'Login failed. Try again.' : 'Account could not be created. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="auth-modal-header">
          <h2>{currentMode === 'login' ? 'Login to ShiftStack' : 'Create Account'}</h2>
          <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit} className="auth-modal-form">
          {error && <div className="auth-error-message" role="alert">{error}</div>}
          {success && <div className="auth-success-message" role="status">{success}</div>}
          {currentMode === 'signup' && <div className="auth-form-group">
            <label htmlFor="auth-username">Username (optional)</label>
            <input id="auth-username" className="auth-input" type="text" maxLength={32} autoComplete="nickname" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Your display name" />
          </div>}
          <div className="auth-form-group">
            <label htmlFor="auth-phone">Phone Number</label>
            <input id="auth-phone" className="auth-input" type="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          </div>
          <div className="auth-form-group">
            <label htmlFor="auth-password">Password</label>
            <input id="auth-password" className="auth-input" type="password" autoComplete={currentMode === 'login' ? 'current-password' : 'new-password'} minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {currentMode === 'signup' && <div className="auth-form-group">
            <label htmlFor="auth-confirm-password">Confirm Password</label>
            <input id="auth-confirm-password" className="auth-input" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            <span className="auth-input-hint">Use at least 8 characters.</span>
          </div>}
          <button type="submit" className="auth-submit-btn" disabled={loading || !phone || !password || (currentMode === 'signup' && !confirmPassword)}>
            {loading ? 'Please wait…' : currentMode === 'login' ? 'Login' : 'Create account'}
          </button>
          <div className="auth-mode-switch">
            {currentMode === 'login' ? <p>New here? <button type="button" onClick={() => changeMode('signup')}>Create an account</button></p> : <p>Already registered? <button type="button" onClick={() => changeMode('login')}>Login</button></p>}
          </div>
        </form>
      </div>
    </div>
  );
}
