'use client';

import { useEffect, useState } from 'react';
import { AuthModal } from '@/components/auth/AuthModal';
import { WalletModal } from '@/components/wallet/WalletModal';
import { useAuth } from '@/contexts/AuthContext';

export function Header() {
  const { user, token, isAuthenticated, isLoading, login, signup, logout, refreshBalance } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [pendingWalletOpen, setPendingWalletOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoPanel, setInfoPanel] = useState<{ title: string; body: string } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [gameMode, setGameMode] = useState<'REAL' | 'DEMO'>('DEMO');

  useEffect(() => {
    const savedMode = localStorage.getItem('shiftstack_game_mode');
    if (savedMode === 'REAL' || savedMode === 'DEMO') setGameMode(savedMode);
    const onModeChange = (event: Event) => setGameMode((event as CustomEvent<'REAL' | 'DEMO'>).detail);
    window.addEventListener('aviator:game-mode', onModeChange);
    return () => window.removeEventListener('aviator:game-mode', onModeChange);
  }, []);
  const openWallet = () => {
    if (isAuthenticated) setShowWallet(true);
    else {
      setPendingWalletOpen(true);
      setShowAuth(true);
    }
  };

  useEffect(() => {
    if (token && !isLoading) void refreshBalance().catch(() => undefined);
  }, [token, isLoading, refreshBalance]);

  useEffect(() => {
    if (isAuthenticated && pendingWalletOpen) {
      setPendingWalletOpen(false);
      setShowWallet(true);
    }
  }, [isAuthenticated, pendingWalletOpen]);

  const displayedBalance = isAuthenticated ? Number(gameMode === 'REAL' ? user?.realBalance || 0 : user?.demoBalance || 0) : 0;
  const openInfo = (title: string, body: string) => { setInfoPanel({ title, body }); setMenuOpen(false); };
  const dispatchSetting = (setting: string, value: boolean) => window.dispatchEvent(new CustomEvent('aviator:setting', { detail: { setting, value } }));
  return (
    <>
    <header className="app-header">
      <div className="header-left">
        {/* Authentic ShiftStack Brand Logo */}
        <button type="button" className="shiftstack-brand" id="brand-home-link" title="ShiftStack Aviator" onClick={() => { window.location.href = '/'; }}>
          <div className="shiftstack-logo-badge">
            <svg width="22" height="20" viewBox="0 0 40 32" fill="none">
              <path d="M4 18 C 12 16, 22 14, 38 7 C 32 15, 26 21, 18 24 C 12 25, 6 23, 4 18 Z" fill="#ff003b" />
              <path d="M16 16 L 24 3 L 28 4 L 21 16 Z" fill="#ff3366" />
              <circle cx="36" cy="7.5" r="2.5" fill="#ffffff" />
            </svg>
          </div>
          <div className="shiftstack-logo-text-group">
            <span className="shiftstack-logo-shift">Shift</span>
            <span className="shiftstack-logo-stack">Stack</span>
          </div>
        </button>

        {/* Header Search Icon Button */}
        <button className="shiftstack-search-btn" id="btn-header-search" title="Search Games & Sports" aria-label="Search" onClick={() => openInfo('Search', 'Search is not connected to a game catalog yet. Aviator is available from the top navigation.')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>

        {/* Sub-Nav Mode Tabs (Desktop Only) */}
        <nav className="main-nav-tabs desktop-only" aria-label="Main Navigation">
          <button className="nav-tab-btn active" data-view="terminal" id="nav-btn-terminal" onClick={() => { window.location.href = '/'; }}>
            <span>Aviator</span>
          </button>
          <button className="nav-tab-btn" data-view="liquidity" id="nav-btn-liquidity" onClick={() => openInfo('Liquidity vault', 'Liquidity vault deposits and withdrawals are not enabled yet. No funds can be staked here.')}>
            <span>Liquidity</span>
            <span className="badge-pill">28.4%</span>
          </button>
          <button className="nav-tab-btn" data-view="rollover" id="nav-btn-rollover" onClick={() => openInfo('Rollover challenges', 'Rollover challenges are not enabled yet.')}>
            <span>Rollover</span>
          </button>
          <a className="nav-tab-btn" href="/predictor"><span>Round monitor</span></a>
        </nav>
      </div>

      <div className="header-right">
        {/* User Wallet Balance */}
        <div className="header-balance-card" id="header-balance-card" title="Wallet Balance (Real vs Demo)">
          <span className={`badge-mode-indicator ${gameMode === 'REAL' ? 'badge-mode-real' : 'badge-mode-demo'}`} id="header-mode-badge">{isAuthenticated ? gameMode : 'LOGIN'}</span>
          <span className="bal-amount user-balance-value">{displayedBalance.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KES</span>
        </div>

        {/* User Account Pill */}
        <div className="header-user-pill-wrapper" id="header-user-pill-wrapper" style={{ display: isAuthenticated ? 'flex' : 'none' }}>
          <span>{user?.username || 'Pilot'}</span>
        </div>

        {/* Login/Register Button */}
        <button className="header-btn-login-register" id="header-btn-login-register" title="Sign in or create an account" onClick={() => isAuthenticated ? openInfo('Account', `${user?.username || 'Pilot'} · ${user?.phone || ''}`) : setShowAuth(true)}>
          <span>{isAuthenticated ? 'Account' : 'Login/Register'}</span>
        </button>

        {/* Deposit Button */}
        <button className="btn-deposit-header" id="btn-open-deposit" title="Open wallet" onClick={openWallet}>
          <span className="dep-text">Deposit</span>
        </button>

        {/* Sound Toggle */}
        <button className={`header-btn-icon ${soundEnabled ? '' : 'muted'}`} id="btn-toggle-sound" title="Toggle Sound Effects" aria-label="Toggle Sound" aria-pressed={soundEnabled} onClick={() => { const value = !soundEnabled; setSoundEnabled(value); dispatchSetting('sound', value); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        </button>

        {/* Chat Button */}
        <button className="header-btn-icon" id="btn-header-chat" title="Community Chat & Pilot Signals" aria-label="Game Chat" onClick={() => openInfo('Pilot signals', 'Community chat is not connected yet. There are no live messages to display.')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>

        {/* Hamburger Menu */}
        <div className="menu-dropdown-wrapper">
          <button className={`btn-hamburger ${menuOpen ? 'active' : ''}`} id="btn-hamburger" aria-label="Open Settings Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <span></span>
            <span></span>
            <span></span>
          </button>

          {/* Dropdown Menu */}
          <div className={`spribe-dropdown-menu ${menuOpen ? 'open' : ''}`} id="spribe-dropdown-menu">
            {/* Profile Card */}
            <div className="shiftstack-menu-user-card kessbet-menu-user-card">
              <div className="user-avatar-circle" id="menu-avatar-circle">
                ✈️
              </div>
              <div className="user-info-text">
                <span className="user-handle" id="menu-username-display">{user?.username || 'Guest Pilot'}</span>
                <span className="user-phone-sub" id="menu-phone-display">{user?.phone || 'Tap to Log In'}</span>
              </div>
              <button type="button" className="btn-change-avatar" id="btn-change-avatar" onClick={() => isAuthenticated ? openInfo('Profile', 'Profile photo settings are not available yet.') : setShowAuth(true)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Change Avatar</span>
              </button>
            </div>

            {/* Audio & Animation Toggles */}
            <div className="menu-item-row" id="menu-item-sound">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>🔊</span>
                <span>Sound</span>
              </div>
              <label className="spribe-switch" aria-label="Toggle Sound">
                <input type="checkbox" id="menu-switch-sound" title="Toggle Sound" aria-label="Toggle Sound" checked={soundEnabled} onChange={(e) => { setSoundEnabled(e.target.checked); dispatchSetting('sound', e.target.checked); }} />
                <span className="switch-slider"></span>
              </label>
            </div>
            <div className="menu-item-row" id="menu-item-music">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>🎵</span>
                <span>Music</span>
              </div>
              <label className="spribe-switch" aria-label="Toggle Music">
                <input type="checkbox" id="menu-switch-music" title="Toggle Music" aria-label="Toggle Music" checked={musicEnabled} onChange={(e) => { setMusicEnabled(e.target.checked); dispatchSetting('music', e.target.checked); }} />
                <span className="switch-slider"></span>
              </label>
            </div>
            <div className="menu-item-row" id="menu-item-anim">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>🌀</span>
                <span>Animation</span>
              </div>
              <label className="spribe-switch" aria-label="Toggle Animation">
                <input type="checkbox" id="menu-switch-anim" title="Toggle Animation" aria-label="Toggle Animation" checked={animationEnabled} onChange={(e) => { setAnimationEnabled(e.target.checked); dispatchSetting('animation', e.target.checked); }} />
                <span className="switch-slider"></span>
              </label>
            </div>

            <div className="menu-divider"></div>

            {/* Menu Nav Links */}
            <button type="button" className="menu-link-btn" id="menu-btn-free-bets" onClick={() => openInfo('Free bets', 'There are no free bets available on this account right now.')}>
              <span className="menu-link-icon">⭐</span>
              <span>Free Bets</span>
            </button>
            <button type="button" className="menu-link-btn" id="menu-btn-history" onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event('aviator:open-history')); }}>
              <span className="menu-link-icon">🕒</span>
              <span>My Bet History</span>
            </button>
            <button type="button" className="menu-link-btn" id="menu-btn-limits" onClick={() => openInfo('Game limits', 'Stake limits: KES 100–100,000 per terminal. Each terminal can place one bet per round.')}>
              <span className="menu-link-icon">💵</span>
              <span>Game Limits</span>
            </button>
            <button type="button" className="menu-link-btn" id="menu-btn-how" onClick={() => openInfo('How to play', 'Place a bet during the five-second countdown. During flight, cash out before the crash to receive your stake multiplied by the displayed odds. Auto Bet and Auto Cash can be configured on each terminal.')}>
              <span className="menu-link-icon">❓</span>
              <span>How To Play</span>
            </button>
            <button type="button" className="menu-link-btn" id="menu-btn-rules" onClick={() => openInfo('Game rules', 'The server determines each round outcome. Cashouts are processed by the server using its current round state. Demo play uses a simulated balance; real-money features require an authenticated account and configured payments.')}>
              <span className="menu-link-icon">📄</span>
              <span>Game Rules</span>
            </button>
            <button type="button" className="menu-link-btn" id="menu-btn-pf" onClick={() => openInfo('Provably fair', 'Each round is determined by the same public round schedule and multiplier formula as the legacy game. The round history records its commitment and final multiplier after the crash.')}>
              <span className="menu-link-icon">🛡️</span>
              <span>Provably Fair Settings</span>
            </button>
            <button type="button" className="menu-link-btn" id="menu-btn-gameroom" onClick={() => openInfo('Game room', 'You are viewing the shared Aviator room.')}>
              <span className="menu-link-icon">🗂️</span>
              <span>Game Room: Room #2</span>
            </button>

            <div className="menu-divider"></div>

            <button type="button" className="menu-link-btn" id="menu-btn-deposit" style={{ color: '#2ecc71' }} onClick={openWallet}>
              <span className="menu-link-icon">⚡</span>
              <span>Deposit Funds (Min 49 Bob)</span>
            </button>
            <button type="button" className="menu-link-btn" id="menu-btn-home" style={{ justifyContent: 'center', fontWeight: 700, color: '#9aa1ad' }} onClick={() => { window.location.href = '/'; }}>
              <span className="menu-link-icon">🏠</span>
              <span>Home</span>
            </button>
            {isAuthenticated && <button type="button" className="menu-link-btn text-danger" id="menu-btn-signout" style={{ justifyContent: 'center', fontWeight: 700 }} onClick={() => { setMenuOpen(false); logout(); }}>
              <span className="menu-link-icon">🚪</span>
              <span>Sign Out</span>
            </button>}
          </div>
        </div>
      </div>
    </header>
    <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onLogin={login} onSignup={signup} />
    <WalletModal isOpen={showWallet} onClose={() => setShowWallet(false)} />
    {infoPanel && <div className="simple-modal-backdrop" role="presentation" onClick={() => setInfoPanel(null)}><section className="simple-modal" role="dialog" aria-modal="true" aria-labelledby="header-info-title" onClick={(e) => e.stopPropagation()}><button type="button" className="simple-modal-close" aria-label="Close" onClick={() => setInfoPanel(null)}>×</button><h2 id="header-info-title">{infoPanel.title}</h2><p>{infoPanel.body}</p><button type="button" className="simple-modal-action" onClick={() => setInfoPanel(null)}>Close</button></section></div>}
    </>
  );
}
