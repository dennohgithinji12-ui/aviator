'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthModal } from '@/components/auth/AuthModal';
import { WalletModal } from '@/components/wallet/WalletModal';
import { MenuModals } from './MenuModals';
import { useAuth } from '@/contexts/AuthContext';

export function Header() {
  const { user, token, isAuthenticated, isLoading, login, signup, logout, refreshBalance } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [walletInitialTab, setWalletInitialTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [pendingWalletOpen, setPendingWalletOpen] = useState(false);
  const [pendingWalletTab, setPendingWalletTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [infoPanel, setInfoPanel] = useState<{ title: string; body: string } | null>(null);
  const [menuModal, setMenuModal] = useState<'freebets' | 'history' | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [gameMode, setGameMode] = useState<'REAL' | 'DEMO'>('REAL');
  const [menuFeatures, setMenuFeatures] = useState({ communityChat: false, roomTwo: false });
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    const refresh = () => {
      fetch('/api/modules', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((result) => {
        if (active && result?.modules) setMenuFeatures({ communityChat: result.modules.communityChat === true, roomTwo: result.modules.roomTwo === true });
      }).catch(() => undefined);
    };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('aviator:modules-updated', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); window.removeEventListener('aviator:modules-updated', refresh); };
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    const savedMode = localStorage.getItem('shiftstack_game_mode');
    if (savedMode === 'REAL' || savedMode === 'DEMO') setGameMode(savedMode);
    const savedSound = localStorage.getItem('shiftstack_sound_enabled');
    const savedMusic = localStorage.getItem('shiftstack_music_enabled');
    const savedAnimation = localStorage.getItem('shiftstack_animation_enabled');
    if (savedSound !== null) setSoundEnabled(savedSound === 'true');
    if (savedMusic !== null) setMusicEnabled(savedMusic === 'true');
    if (savedAnimation !== null) setAnimationEnabled(savedAnimation === 'true');
    const onModeChange = (event: Event) => setGameMode((event as CustomEvent<'REAL' | 'DEMO'>).detail);
    window.addEventListener('aviator:game-mode', onModeChange);
    const onOpenWallet = (event: Event) => openWallet((event as CustomEvent<{ tab?: 'deposit' | 'withdraw' }>).detail?.tab || 'deposit');
    const onOpenAuth = () => setShowAuth(true);
    const onOpenFreebets = () => setMenuModal('freebets');
    const onOpenHistory = () => setMenuModal('history');
    window.addEventListener('aviator:open-wallet', onOpenWallet);
    window.addEventListener('aviator:open-auth', onOpenAuth);
    window.addEventListener('aviator:open-freebets', onOpenFreebets);
    window.addEventListener('aviator:open-history', onOpenHistory);
    return () => {
      window.removeEventListener('aviator:game-mode', onModeChange);
      window.removeEventListener('aviator:open-wallet', onOpenWallet);
      window.removeEventListener('aviator:open-auth', onOpenAuth);
      window.removeEventListener('aviator:open-freebets', onOpenFreebets);
      window.removeEventListener('aviator:open-history', onOpenHistory);
    };
  }, [isAuthenticated]);

  const changeGameMode = (mode: 'REAL' | 'DEMO') => {
    if (!isAuthenticated && mode === 'REAL') { setShowAuth(true); return; }
    setGameMode(mode);
    localStorage.setItem('shiftstack_game_mode', mode);
    window.dispatchEvent(new CustomEvent('aviator:game-mode', { detail: mode }));
  };
  const openWallet = (tab: 'deposit' | 'withdraw' = 'deposit') => {
    setWalletInitialTab(tab);
    if (isAuthenticated) setShowWallet(true);
    else {
      setPendingWalletTab(tab);
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
      setWalletInitialTab(pendingWalletTab);
      setShowWallet(true);
    }
  }, [isAuthenticated, pendingWalletOpen, pendingWalletTab]);

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
          <Link className={`nav-tab-btn ${pathname === '/' ? 'active' : ''}`} href="/" id="nav-btn-terminal">
            <span>Aviator</span>
          </Link>
          <Link className={`nav-tab-btn ${pathname === '/liquidity' ? 'active' : ''}`} href="/liquidity" id="nav-btn-liquidity">
            <span>Liquidity</span>
          </Link>
          <Link className={`nav-tab-btn ${pathname === '/rollover' ? 'active' : ''}`} href="/rollover" id="nav-btn-rollover">
            <span>Rollover</span>
          </Link>
          <Link className={`nav-tab-btn ${pathname === '/verify' ? 'active' : ''}`} href="/verify"><span>Verifier</span></Link>
        </nav>
      </div>

      <div className="header-right">
        {/* User Wallet Balance */}
        <div className="header-balance-card" id="header-balance-card" title="Selected wallet balance">
          <span className={`badge-mode-indicator ${gameMode === 'REAL' ? 'badge-mode-real' : 'badge-mode-demo'}`} id="header-mode-badge">{isAuthenticated ? (gameMode === 'REAL' ? 'WALLET' : 'PRACTICE') : 'LOGIN'}</span>
          <span className="bal-amount user-balance-value">{displayedBalance.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KES</span>
          <div className="header-mode-toggle" role="group" aria-label="Wallet mode">
            <button type="button" className={gameMode === 'DEMO' ? 'active' : ''} aria-pressed={gameMode === 'DEMO'} onClick={() => changeGameMode('DEMO')}>Practice</button>
            <button type="button" className={gameMode === 'REAL' ? 'active' : ''} aria-pressed={gameMode === 'REAL'} onClick={() => changeGameMode('REAL')}>Wallet</button>
          </div>
        </div>

        {/* User Account Pill */}
        <div className="header-user-pill-wrapper" id="header-user-pill-wrapper" style={{ display: isAuthenticated ? 'flex' : 'none' }}>
          <span>{user?.username || 'Pilot'}</span>
        </div>

        {/* Login/Register Button */}
        {isAuthenticated ? (
          <Link className="header-btn-login-register" id="header-btn-login-register" href="/account" title="Open your account">
            <span>Account</span>
          </Link>
        ) : (
          <button className="header-btn-login-register" id="header-btn-login-register" title="Sign in or create an account" onClick={() => setShowAuth(true)}>
            <span>Login/Register</span>
          </button>
        )}

        {/* Deposit Button */}
        <button className="btn-deposit-header" id="btn-open-deposit" title="Open wallet" onClick={() => openWallet()}>
          <span className="dep-text">Deposit</span>
        </button>

        {/* Sound Toggle */}
        <button className={`header-btn-icon ${soundEnabled ? '' : 'muted'}`} id="btn-toggle-sound" title="Toggle Sound Effects" aria-label="Toggle Sound" aria-pressed={soundEnabled} onClick={() => { const value = !soundEnabled; setSoundEnabled(value); localStorage.setItem('shiftstack_sound_enabled', String(value)); dispatchSetting('sound', value); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        </button>

        {/* Chat Button */}
        {menuFeatures.communityChat && <button className="header-btn-icon" id="btn-header-chat" title="Community Chat & Pilot Signals" aria-label="Game Chat" onClick={() => openInfo('Pilot signals', 'Community chat is not connected yet. There are no live messages to display.')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>}

        {/* Hamburger Menu */}
        <div className="menu-dropdown-wrapper" ref={menuRef}>
          <button className={`btn-hamburger ${menuOpen ? 'active' : ''}`} id="btn-hamburger" aria-label="Open Settings Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <span></span>
            <span></span>
            <span></span>
          </button>

          {/* Dropdown Menu */}
          <div className={`spribe-dropdown-menu ${menuOpen ? 'open' : ''}`} id="spribe-dropdown-menu" onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest('button, a, input, label')) setMenuOpen(false);
          }}>
            {/* Profile Card */}
            <div className="shiftstack-menu-user-card kessbet-menu-user-card">
              <div className="user-avatar-circle" id="menu-avatar-circle">
                ✈️
              </div>
              <div className="user-info-text">
                <span className="user-handle" id="menu-username-display">{user?.username || 'Guest Pilot'}</span>
                <span className="user-phone-sub" id="menu-phone-display">{user?.phone || 'Tap to Log In'}</span>
              </div>
              {isAuthenticated ? <Link className="btn-change-avatar" id="menu-account" href="/account" onClick={() => setMenuOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Account</span>
              </Link> : <button type="button" className="btn-change-avatar" id="menu-account" onClick={() => setShowAuth(true)}><span>Sign in</span></button>}
            </div>

            {/* Audio & Animation Toggles */}
            <div className="menu-item-row" id="menu-item-sound">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>🔊</span>
                <span>Sound</span>
              </div>
              <label className="spribe-switch" aria-label="Toggle Sound">
                <input type="checkbox" id="menu-switch-sound" title="Toggle Sound" aria-label="Toggle Sound" checked={soundEnabled} onChange={(e) => { setSoundEnabled(e.target.checked); localStorage.setItem('shiftstack_sound_enabled', String(e.target.checked)); dispatchSetting('sound', e.target.checked); }} />
                <span className="switch-slider"></span>
              </label>
            </div>
            <div className="menu-item-row" id="menu-item-music">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>🎵</span>
                <span>Music</span>
              </div>
              <label className="spribe-switch" aria-label="Toggle Music">
                <input type="checkbox" id="menu-switch-music" title="Toggle Music" aria-label="Toggle Music" checked={musicEnabled} onChange={(e) => { setMusicEnabled(e.target.checked); localStorage.setItem('shiftstack_music_enabled', String(e.target.checked)); dispatchSetting('music', e.target.checked); }} />
                <span className="switch-slider"></span>
              </label>
            </div>
            <div className="menu-item-row" id="menu-item-anim">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>🌀</span>
                <span>Animation</span>
              </div>
              <label className="spribe-switch" aria-label="Toggle Animation">
                <input type="checkbox" id="menu-switch-anim" title="Toggle Animation" aria-label="Toggle Animation" checked={animationEnabled} onChange={(e) => { const value = e.target.checked; setAnimationEnabled(value); localStorage.setItem('shiftstack_animation_enabled', String(value)); dispatchSetting('animation', value); }} />
                <span className="switch-slider"></span>
              </label>
            </div>

            <div className="menu-divider"></div>

            {/* Menu Nav Links */}
            <button type="button" className="menu-link-btn" id="menu-btn-free-bets" onClick={() => { setMenuOpen(false); setMenuModal('freebets'); }}>
              <span className="menu-link-icon">⭐</span>
              <span>Free Bets</span>
            </button>
            <button type="button" className="menu-link-btn" id="menu-btn-history" onClick={() => { setMenuOpen(false); setMenuModal('history'); }}>
              <span className="menu-link-icon">🕒</span>
              <span>My Bet History</span>
            </button>
            <Link className="menu-link-btn" id="menu-btn-limits" href="/guide#game-limits" onClick={() => setMenuOpen(false)}>
              <span className="menu-link-icon">💵</span>
              <span>Game Limits</span>
            </Link>
            <Link className="menu-link-btn" id="menu-btn-how" href="/guide#how-to-play" onClick={() => setMenuOpen(false)}>
              <span className="menu-link-icon">❓</span>
              <span>How To Play</span>
            </Link>
          <Link className="menu-link-btn" id="menu-btn-rules" href="/guide#game-rules" onClick={() => setMenuOpen(false)}>
              <span className="menu-link-icon">📄</span>
              <span>Game Rules</span>
            </Link>
            <Link className="menu-link-btn" id="menu-btn-pf" href="/verify" onClick={() => setMenuOpen(false)}>
              <span className="menu-link-icon">🛡️</span>
              <span>Provably Fair Settings</span>
            </Link>
            <Link className="menu-link-btn" href="/liquidity" onClick={() => setMenuOpen(false)}><span className="menu-link-icon">◈</span><span>Liquidity Vault</span></Link>
            <Link className="menu-link-btn" href="/rollover" onClick={() => setMenuOpen(false)}><span className="menu-link-icon">↗</span><span>Rollover Strategy</span></Link>
            <Link className="menu-link-btn" href="/verify" onClick={() => setMenuOpen(false)}><span className="menu-link-icon">🛡️</span><span>Seed Verifier</span></Link>
            {menuFeatures.roomTwo ? <Link className="menu-link-btn" id="menu-btn-gameroom" href="/room/2" onClick={() => setMenuOpen(false)}><span className="menu-link-icon">🗂️</span><span>Game Room: Room #2</span></Link>
              : <button type="button" className="menu-link-btn" id="menu-btn-gameroom" disabled aria-disabled="true" title="Room 2 is disabled by the administrator"><span className="menu-link-icon">🗂️</span><span>Game Room: Room #2 · Unavailable</span></button>}

            <div className="menu-divider"></div>

            <button type="button" className="menu-link-btn" id="menu-btn-deposit" style={{ color: '#2ecc71' }} onClick={() => openWallet()}>
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
    <WalletModal isOpen={showWallet} onClose={() => setShowWallet(false)} initialTab={walletInitialTab} />
    {menuModal && <MenuModals kind={menuModal} token={token} onClose={() => setMenuModal(null)} onLogin={() => setShowAuth(true)} onBalanceChanged={refreshBalance} />}
    {infoPanel && <div className="simple-modal-backdrop" role="presentation" onClick={() => setInfoPanel(null)}><section className="simple-modal" role="dialog" aria-modal="true" aria-labelledby="header-info-title" onClick={(e) => e.stopPropagation()}><button type="button" className="simple-modal-close" aria-label="Close" onClick={() => setInfoPanel(null)}>×</button><h2 id="header-info-title">{infoPanel.title}</h2><p>{infoPanel.body}</p><button type="button" className="simple-modal-action" onClick={() => setInfoPanel(null)}>Close</button></section></div>}
    </>
  );
}
