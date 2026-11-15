'use client';

import { useState } from 'react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);
  return <div className="password-input-wrap">
    <input {...props} type={visible ? 'text' : 'password'} />
    <button type="button" className="password-visibility" onClick={() => setVisible((current) => !current)} aria-label={`${visible ? 'Hide' : 'Show'} ${props['aria-label'] || 'password'}`} aria-pressed={visible}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{!visible && <path d="m3 21 18-18"/>}</svg>
    </button>
  </div>;
}
