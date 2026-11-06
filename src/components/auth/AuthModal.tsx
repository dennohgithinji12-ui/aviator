'use client';

import { FormEvent, useRef, useState } from 'react';
import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from '@firebase/auth';
import { getFirebaseClientAuth } from '@/lib/firebase-client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFirebaseAuth: (idToken: string, username?: string) => Promise<void>;
  mode?: 'login' | 'signup';
}

function toE164Kenya(input: string) {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `254${digits.slice(1)}`;
  else if (digits.startsWith('7') || digits.startsWith('1')) digits = `254${digits}`;
  if (!/^254[17]\d{8}$/.test(digits)) return '';
  return `+${digits}`;
}

export function AuthModal({ isOpen, onClose, onFirebaseAuth, mode = 'login' }: AuthModalProps) {
  const [currentMode, setCurrentMode] = useState<'login' | 'signup'>(mode);
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const recaptchaContainer = useRef<HTMLDivElement>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);

  if (!isOpen) return null;

  const clearVerifier = () => {
    verifier.current?.clear();
    verifier.current = null;
  };

  const handleSendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const e164Phone = toE164Kenya(phone);
    if (!e164Phone) {
      setError('Enter a valid Kenyan mobile number, such as 0712 345 678.');
      return;
    }
    setLoading(true);
    try {
      clearVerifier();
      const auth = await getFirebaseClientAuth();
      if (!recaptchaContainer.current) throw new Error('Phone verification could not start. Refresh and try again.');
      verifier.current = new RecaptchaVerifier(auth, recaptchaContainer.current, { size: 'normal' });
      await verifier.current.render();
      const result = await signInWithPhoneNumber(auth, e164Phone, verifier.current);
      setPhone(e164Phone);
      setConfirmation(result);
    } catch (cause) {
      clearVerifier();
      setError(cause instanceof Error ? cause.message : 'Could not send the verification code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confirmation) return;
    setError('');
    setLoading(true);
    try {
      const credential = await confirmation.confirm(code.trim());
      const idToken = await credential.user.getIdToken(true);
      await onFirebaseAuth(idToken, currentMode === 'signup' ? username.trim() || undefined : undefined);
      clearVerifier();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The code was not accepted. Check it and try again.');
    } finally {
      setLoading(false);
    }
  };

  const changeMode = (nextMode: 'login' | 'signup') => {
    setCurrentMode(nextMode);
    setError('');
  };

  const resetPhone = () => {
    setConfirmation(null);
    setCode('');
    setError('');
    clearVerifier();
  };

  const closeModal = () => {
    clearVerifier();
    onClose();
  };

  return (
    <div className="auth-modal-overlay" onClick={closeModal}>
      <div className="auth-modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="auth-modal-header">
          <h2>{confirmation ? 'Verify your phone' : currentMode === 'login' ? 'Login to ShiftStack' : 'Create Account'}</h2>
          <button type="button" className="auth-modal-close" onClick={closeModal} aria-label="Close">×</button>
        </div>

        {!confirmation ? <form onSubmit={handleSendCode} className="auth-modal-form">
          {error && <div className="auth-error-message" role="alert">{error}</div>}
          {currentMode === 'signup' && <div className="auth-form-group">
            <label htmlFor="auth-username">Username (optional)</label>
            <input id="auth-username" className="auth-input" type="text" maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Your display name" />
          </div>}
          <div className="auth-form-group">
            <label htmlFor="auth-phone">Phone Number</label>
            <input id="auth-phone" className="auth-input" type="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(event) => setPhone(event.target.value)} required />
            <span className="auth-input-hint">We’ll send a one-time code by SMS. Standard message rates may apply.</span>
          </div>
          <div ref={recaptchaContainer} className="auth-recaptcha-container" />
          <button type="submit" className="auth-submit-btn" disabled={loading || phone.length < 9}>{loading ? 'Sending code…' : 'Send verification code'}</button>
          <div className="auth-mode-switch">
            {currentMode === 'login' ? <p>New here? <button type="button" onClick={() => changeMode('signup')}>Create an account</button></p> : <p>Already registered? <button type="button" onClick={() => changeMode('login')}>Login</button></p>}
          </div>
        </form> : <form onSubmit={handleVerifyCode} className="auth-modal-form">
          {error && <div className="auth-error-message" role="alert">{error}</div>}
          <p className="auth-otp-hint">Enter the 6-digit code sent to <strong>{phone}</strong>.</p>
          <div className="auth-form-group">
            <label htmlFor="auth-otp-code">Verification code</label>
            <input id="auth-otp-code" className="auth-input auth-otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
          </div>
          <button type="submit" className="auth-submit-btn" disabled={loading || code.length !== 6}>{loading ? 'Verifying…' : 'Verify and continue'}</button>
          <div className="auth-mode-switch"><p><button type="button" onClick={resetPhone}>Change phone or resend a code</button></p></div>
        </form>}
      </div>
    </div>
  );
}
