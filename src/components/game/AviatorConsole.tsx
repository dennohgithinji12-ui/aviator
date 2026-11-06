'use client';

import { useState, useEffect, useRef } from 'react';
import { FlightCanvas } from './FlightCanvas';
import { DualBettingTerminals } from './DualBettingTerminals';
import { LiveStakers } from './LiveStakers';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/contexts/AuthContext';

interface TerminalState {
  amount: number;
  mode: 'manual' | 'auto';
  autoStakeEnabled: boolean;
  autoCashoutEnabled: boolean;
  autoCashoutMultiplier: number;
  staked: boolean;
  cashedOut: boolean;
}

export function AviatorConsole() {
  const { user, token, isAuthenticated, completeFirebaseAuth, logout, updateBalance } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [gameState, setGameState] = useState<'WAITING' | 'FLYING' | 'CRASHED'>('WAITING');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [balance, setBalance] = useState(user?.realBalance || 50000);
  const [terminal2Visible, setTerminal2Visible] = useState(false);
  const [gameMode, setGameMode] = useState<'REAL' | 'DEMO'>(isAuthenticated ? 'REAL' : 'DEMO');
  const [serverNonce, setServerNonce] = useState(0);
  const [actionMessage, setActionMessage] = useState('');
  const betIds = useRef<Record<1 | 2, number | null>>({ 1: null, 2: null });
  const automaticAction = useRef<Record<1 | 2, boolean>>({ 1: false, 2: false });

  // Update balance when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      setBalance(user.realBalance);
      setGameMode('REAL');
    } else {
      setBalance(50000);
      setGameMode('DEMO');
    }
  }, [isAuthenticated, user]);

  const [terminal1, setTerminal1] = useState<TerminalState>({
    amount: 100,
    mode: 'manual',
    autoStakeEnabled: false,
    autoCashoutEnabled: false,
    autoCashoutMultiplier: 2.0,
    staked: false,
    cashedOut: false
  });

  const [terminal2, setTerminal2] = useState<TerminalState>({
    amount: 100,
    mode: 'manual',
    autoStakeEnabled: false,
    autoCashoutEnabled: false,
    autoCashoutMultiplier: 1.5,
    staked: false,
    cashedOut: false
  });

  // Fetch round state from API
  useEffect(() => {
    const fetchRoundState = async () => {
      try {
        const response = await fetch('/api/round-state');
        const data = await response.json();
        setGameState(data.phase);
        setCurrentMultiplier(data.currentMultiplier);
        setServerNonce(data.nonce);
      } catch (error) {
        console.error('Failed to fetch round state:', error);
      }
    };

    fetchRoundState();
    const interval = setInterval(fetchRoundState, 200);
    return () => clearInterval(interval);
  }, []);

  const roundNonce = serverNonce;
  const [countdownSeconds, setCountdownSeconds] = useState(5);

  // Track round nonce for stakers
  useEffect(() => {
    if (gameState === 'WAITING') {
      setCountdownSeconds(5);
    }
  }, [gameState]);

  // Countdown timer
  useEffect(() => {
    if (gameState === 'WAITING' && countdownSeconds > 0) {
      const timer = setInterval(() => {
        setCountdownSeconds(prev => Math.max(0, prev - 0.1));
      }, 100);
      return () => clearInterval(timer);
    }
  }, [gameState, countdownSeconds]);

  const handleBet = async (terminalId: 1 | 2, amount: number) => {
    if (balance < amount || gameState !== 'WAITING') return;
    setActionMessage('');
    try {
      if (isAuthenticated && token) {
        const response = await fetch('/api/wallet/bet', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ amount, mode: gameMode, terminalId, roundNonce: serverNonce }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || result.error || 'Bet could not be placed');
        betIds.current[terminalId] = result.betId;
        const nextBalance = gameMode === 'REAL' ? result.realBalance : result.demoBalance;
        setBalance(nextBalance);
        updateBalance(result.realBalance, result.demoBalance);
      } else {
        setBalance((current) => current - amount);
      }
      if (terminalId === 1) setTerminal1((state) => ({ ...state, staked: true, amount }));
      else setTerminal2((state) => ({ ...state, staked: true, amount }));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Bet could not be placed');
    }
  };

  const handleCashout = async (terminalId: 1 | 2) => {
    const terminal = terminalId === 1 ? terminal1 : terminal2;
    if (!terminal.staked || terminal.cashedOut || gameState !== 'FLYING') return;
    try {
      if (isAuthenticated && token && betIds.current[terminalId]) {
        const response = await fetch('/api/wallet/cashout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ betId: betIds.current[terminalId], mode: gameMode }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || result.error || 'Cashout failed');
        setBalance(gameMode === 'REAL' ? result.realBalance : result.demoBalance);
        updateBalance(result.realBalance, result.demoBalance);
      } else setBalance((current) => current + terminal.amount * currentMultiplier);
      if (terminalId === 1) setTerminal1((state) => ({ ...state, cashedOut: true }));
      else setTerminal2((state) => ({ ...state, cashedOut: true }));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Cashout failed');
    }
  };

  const handleCancel = async (terminalId: 1 | 2) => {
    const terminal = terminalId === 1 ? terminal1 : terminal2;
    if (!terminal.staked || terminal.cashedOut || gameState !== 'WAITING') return;
    try {
      if (isAuthenticated && token && betIds.current[terminalId]) {
        const response = await fetch('/api/wallet/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ betId: betIds.current[terminalId] }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Bet could not be cancelled');
        setBalance(gameMode === 'REAL' ? result.realBalance : result.demoBalance);
        updateBalance(result.realBalance, result.demoBalance);
        betIds.current[terminalId] = null;
      } else setBalance((current) => current + terminal.amount);
      if (terminalId === 1) setTerminal1((state) => ({ ...state, staked: false }));
      else setTerminal2((state) => ({ ...state, staked: false }));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Bet could not be cancelled');
    }
  };

  const handleTerminal1Bet = (amount: number) => handleBet(1, amount);
  const handleTerminal2Bet = (amount: number) => handleBet(2, amount);
  const handleTerminal1Cashout = () => handleCashout(1);
  const handleTerminal2Cashout = () => handleCashout(2);
  const handleTerminal1Cancel = () => handleCancel(1);
  const handleTerminal2Cancel = () => handleCancel(2);

  useEffect(() => {
    if (gameState === 'WAITING') {
      automaticAction.current = { 1: false, 2: false };
      if (terminal1.mode === 'auto' && terminal1.autoStakeEnabled && !terminal1.staked) void handleBet(1, terminal1.amount);
      if (terminal2.mode === 'auto' && terminal2.autoStakeEnabled && !terminal2.staked) void handleBet(2, terminal2.amount);
    }
  }, [gameState, serverNonce, terminal1.mode, terminal1.autoStakeEnabled, terminal1.staked, terminal1.amount, terminal2.mode, terminal2.autoStakeEnabled, terminal2.staked, terminal2.amount]);

  useEffect(() => {
    if (gameState !== 'FLYING') return;
    if (terminal1.staked && !terminal1.cashedOut && terminal1.mode === 'auto' && terminal1.autoCashoutEnabled && currentMultiplier >= terminal1.autoCashoutMultiplier && !automaticAction.current[1]) {
      automaticAction.current[1] = true;
      void handleCashout(1);
    }
    if (terminal2.staked && !terminal2.cashedOut && terminal2.mode === 'auto' && terminal2.autoCashoutEnabled && currentMultiplier >= terminal2.autoCashoutMultiplier && !automaticAction.current[2]) {
      automaticAction.current[2] = true;
      void handleCashout(2);
    }
  }, [gameState, currentMultiplier, terminal1, terminal2]);

  // Reset terminals on crash
  useEffect(() => {
    if (gameState === 'CRASHED') {
      setTimeout(() => {
        setTerminal1({ ...terminal1, staked: false, cashedOut: false });
        setTerminal2({ ...terminal2, staked: false, cashedOut: false });
        betIds.current = { 1: null, 2: null };
      }, 3000);
    }
  }, [gameState]);

  return (
    <section className="view-section active" id="view-terminal">
      {/* Top Go Back & Fullscreen Header */}
      <div className="aviator-top-nav-bar">
        <button type="button" className="btn-aviator-back" id="btn-aviator-back" title="Go Back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>Go Back</span>
        </button>
        <button type="button" className="btn-aviator-fullscreen" id="btn-aviator-fullscreen" title="Toggle Fullscreen">
          <span>View Fullscreen</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
        </button>
      </div>

      {/* Promo Banner */}
      <div className="aviator-promo-banner" id="aviator-daily-crown-banner">
        <div className="promo-badge-live">
          <span className="pulse-dot"></span>
          <span>LIVE</span>
        </div>
        <div className="promo-banner-text">Mfalme Wa Anga KES 400,000 Daily Crown</div>
        <button type="button" className="promo-banner-btn" id="btn-promo-banner-action" title="View Daily Crown Leaderboard">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>

      {/* Multiplier History Bar */}
      <div className="arena-history-bar" id="arena-history-bar">
        <div className="history-ribbon-wrapper" id="history-ribbon">
          {/* History items will be injected here */}
        </div>
        <button className="btn-round-history" id="btn-open-round-history" title="Round History & Multipliers">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '3px' }}>
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>•••</span>
        </button>
      </div>

      <div className="aviator-console-layout">
        {/* Main Flight Stage */}
        <div className="console-main-stage">
          {/* FUN MODE Banner */}
          <div className={`shiftstack-fun-banner ${gameMode === 'DEMO' ? 'kessbet-fun-banner' : 'kessbet-real-banner'}`}>
            {gameMode === 'DEMO' ? 'FUN MODE' : 'REAL MODE'}
          </div>

          {/* Flight Canvas Component */}
          <FlightCanvas />

          {/* UFC & Aviator Partners Overlay */}
          <div className="ufc-partners-overlay">
            <span className="ufc-logo-tag">UFC</span>
            <span>|</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <svg width="14" height="12" viewBox="0 0 40 32" fill="#ff003b">
                <path d="M4 18 C 12 16, 22 14, 38 7 C 32 15, 26 21, 18 24 C 12 25, 6 23, 4 18 Z" />
              </svg>
              OFFICIAL PARTNERS
            </span>
          </div>

          {/* SPRIBE Verified Badge */}
          <div className="spribe-verified-badge">
            <div className="spribe-verified-top">
              <span>SPRIBE</span>
              <span style={{ color: '#2ecc71' }}>✓ Official Game</span>
            </div>
            <span className="spribe-verified-sub">Since 2019</span>
          </div>

          {/* Live Stakers */}
          <div className="canvas-stakers-badge">
            <div className="avatar-cluster">
              <span>🍀</span>
              <span>👑</span>
              <span>💵</span>
            </div>
            <span id="canvas-stakers-count">200</span>
          </div>

          {/* Real Mode Badge */}
          {isAuthenticated ? (
            <span className="badge-real-mode" id="btn-real-mode-toggle" title="Switch between Fun Mode and Real Mode" onClick={() => setGameMode(gameMode === 'REAL' ? 'DEMO' : 'REAL')}>
              {gameMode === 'REAL' ? 'Demo &gt;' : 'Real &gt;'}
            </span>
          ) : (
            <span className="badge-real-mode" id="btn-login-toggle" title="Login to play for real money" onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}>
              Login &gt;
            </span>
          )}

          {/* Real Mode Deposit Alert */}
          <div id="real-mode-deposit-alert" className="real-mode-deposit-alert" style={{ display: 'none' }}>
            <div className="alert-content">
              <span className="alert-icon">⚡</span>
              <span className="alert-text"><strong>Real Money Mode:</strong> Balance is 0 KES. Deposit min 49 Bob via PayHero to place real bets!</span>
            </div>
            <button type="button" className="btn-alert-deposit" id="btn-quick-deposit-alert">⚡ Deposit 49 Bob+</button>
          </div>

          <div className="canvas-watermark">AVIATOR</div>
          <button id="btn-skip-countdown" className="canvas-skip-btn" title="Universal Synchronized Flight" style={{ display: 'none !important' }}>
            <span>▶ Take Off</span>
          </button>

          {/* Dual Betting Terminals */}
          <DualBettingTerminals
            terminal1={terminal1}
            terminal2={terminal2}
            terminal2Visible={terminal2Visible}
            balance={balance}
            gameState={gameState}
            currentMultiplier={currentMultiplier}
            onTerminal1Change={(state) => setTerminal1({ ...terminal1, ...state })}
            onTerminal2Change={(state) => setTerminal2({ ...terminal2, ...state })}
            onTerminal1Bet={handleTerminal1Bet}
            onTerminal2Bet={handleTerminal2Bet}
            onTerminal1Cashout={handleTerminal1Cashout}
            onTerminal2Cashout={handleTerminal2Cashout}
            onTerminal1Cancel={handleTerminal1Cancel}
            onTerminal2Cancel={handleTerminal2Cancel}
            onToggleTerminal2={() => setTerminal2Visible(!terminal2Visible)}
          />
        </div>

        {/* LEFT COLUMN / BOTTOM MOBILE: Community Live Bets Sidebar */}
        <LiveStakers
          terminal1Staked={terminal1.staked}
          terminal1Amount={terminal1.amount}
          terminal1CashedOut={terminal1.cashedOut}
          terminal1AutoCashoutMultiplier={terminal1.autoCashoutMultiplier}
          terminal2Staked={terminal2.staked}
          terminal2Amount={terminal2.amount}
          terminal2CashedOut={terminal2.cashedOut}
          terminal2AutoCashoutMultiplier={terminal2.autoCashoutMultiplier}
          gameState={gameState}
          currentMultiplier={currentMultiplier}
          countdownSeconds={countdownSeconds}
          roundNonce={roundNonce}
        />
      </div>
      {actionMessage && <div role="status" className="bet-action-message">{actionMessage}</div>}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onFirebaseAuth={completeFirebaseAuth}
        mode={authMode}
      />
    </section>
  );
}
