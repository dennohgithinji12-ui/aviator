'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppPageFrame } from '@/components/layout/AppPageFrame';
import { useAuth } from '@/contexts/AuthContext';

const formatKes = (amount: number) => `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AccountPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [gameMode, setGameMode] = useState<'REAL' | 'DEMO'>('REAL');
  useEffect(() => {
    const readMode = () => setGameMode(localStorage.getItem('shiftstack_game_mode') === 'DEMO' ? 'DEMO' : 'REAL');
    readMode();
    window.addEventListener('aviator:game-mode', readMode);
    return () => window.removeEventListener('aviator:game-mode', readMode);
  }, []);

  return <AppPageFrame><section className="shiftstack-wallet-page account-profile-page">
    <div className="wallet-profile-bar">
      <div className="wallet-avatar-circle" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
      <div><div className="wallet-phone-number">{isAuthenticated ? user?.username || 'Player' : 'Guest Player'}</div><div className="account-profile-subtitle">{isLoading ? 'Loading account…' : isAuthenticated ? user?.phone : 'Sign in to access your profile and wallet'}</div></div>
      {isAuthenticated ? <button className="wallet-btn-pill" type="button" onClick={logout}>Log Out</button> : <button className="wallet-btn-pill" type="button" onClick={() => window.dispatchEvent(new CustomEvent('aviator:open-auth'))}>Log In</button>}
    </div>

    <div className="wallet-card-grid wallet-balance-card">
      <div className={`wallet-col account-balance ${gameMode === 'REAL' ? 'selected' : ''}`}><div className="wallet-col-icon">◉</div><div className="wallet-col-info"><span className="wallet-col-label">Wallet balance</span><span className="wallet-col-val">{formatKes(Number(user?.realBalance || 0))}</span></div></div>
      <div className={`wallet-col account-balance ${gameMode === 'DEMO' ? 'selected' : ''}`}><div className="wallet-col-icon">◈</div><div className="wallet-col-info"><span className="wallet-col-label">Practice balance</span><span className="wallet-col-val">{formatKes(Number(user?.demoBalance || 0))}</span></div></div>
    </div>

    <section className="wallet-section-card">
      <div className="wallet-section-header"><h3>Wallet</h3><p>Deposit and manage your available balance.</p></div>
      <div className="account-action-row"><button className="wallet-btn-action wallet-btn-mpesa" type="button" onClick={() => window.dispatchEvent(new CustomEvent('aviator:open-wallet', { detail: { tab: 'deposit' } }))}>Deposit with M-PESA</button><button className="wallet-btn-action" type="button" onClick={() => window.dispatchEvent(new CustomEvent('aviator:open-wallet', { detail: { tab: 'withdraw' } }))}>Withdraw</button></div>
    </section>

    <section className="wallet-section-card">
      <div className="wallet-section-header"><h3>Free bets &amp; promotions</h3><p>View available offers and account rewards.</p></div>
      <button className="wallet-btn-pill" type="button" onClick={() => window.dispatchEvent(new CustomEvent('aviator:open-freebets'))}>View promotions</button>
    </section>

    <div className="account-profile-links">
      <button type="button" className="account-profile-link" onClick={() => window.dispatchEvent(new CustomEvent('aviator:open-history'))}><span>🕒</span><span><strong>My bet history</strong><small>Review your previous rounds and bets</small></span><b>›</b></button>
      <Link href="/verify" className="account-profile-link"><span>🛡️</span><span><strong>Provably fair verifier</strong><small>Verify a round seed and result</small></span><b>›</b></Link>
      <Link href="/liquidity" className="account-profile-link"><span>◈</span><span><strong>Liquidity vault</strong><small>View your liquidity position</small></span><b>›</b></Link>
      <Link href="/rollover" className="account-profile-link"><span>↗</span><span><strong>Rollover strategy</strong><small>Manage your rollover settings</small></span><b>›</b></Link>
    </div>
  </section></AppPageFrame>;
}
