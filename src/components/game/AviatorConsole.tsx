'use client';

import { useState, useEffect } from 'react';
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
  const { user, isAuthenticated, login, signup, logout, updateBalance } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [gameState, setGameState] = useState<'WAITING' | 'FLYING' | 'CRASHED'>('WAITING');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [balance, setBalance] = useState(user?.realBalance || 50000);
  const [terminal2Visible, setTerminal2Visible] = useState(false);
  const [gameMode, setGameMode] = useState<'REAL' | 'DEMO'>(isAuthenticated ? 'REAL' : 'DEMO');

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
    amount: 10,
    mode: 'manual',
    autoStakeEnabled: false,
    autoCashoutEnabled: false,
    autoCashoutMultiplier: 2.0,
    staked: false,
    cashedOut: false
  });

  const [terminal2, setTerminal2] = useState<TerminalState>({
    amount: 10,
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
        setGameState(data.state);
        setCurrentMultiplier(data.crashMultiplier);
      } catch (error) {
        console.error('Failed to fetch round state:', error);
      }
    };

    fetchRoundState();
    const interval = setInterval(fetchRoundState, 100);
    return () => clearInterval(interval);
  }, []);

  const [roundNonce, setRoundNonce] = useState(0);
  const [countdownSeconds, setCountdownSeconds] = useState(5);

  // Track round nonce for stakers
  useEffect(() => {
    if (gameState === 'WAITING') {
      setRoundNonce(prev => prev + 1);
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

  const handleTerminal1Bet = (amount: number) => {
    if (balance >= amount && gameState === 'WAITING') {
      setBalance(balance - amount);
      setTerminal1({ ...terminal1, staked: true, amount });
    }
  };

  const handleTerminal2Bet = (amount: number) => {
    if (balance >= amount && gameState === 'WAITING') {
      setBalance(balance - amount);
      setTerminal2({ ...terminal2, staked: true, amount });
    }
  };

  const handleTerminal1Cashout = () => {
    if (terminal1.staked && !terminal1.cashedOut) {
      const payout = terminal1.amount * currentMultiplier;
      setBalance(balance + payout);
      setTerminal1({ ...terminal1, cashedOut: true });
    }
  };

  const handleTerminal2Cashout = () => {
    if (terminal2.staked && !terminal2.cashedOut) {
      const payout = terminal2.amount * currentMultiplier;
      setBalance(balance + payout);
      setTerminal2({ ...terminal2, cashedOut: true });
    }
  };

  const handleTerminal1Cancel = () => {
    if (terminal1.staked && !terminal1.cashedOut && gameState === 'WAITING') {
      setBalance(balance + terminal1.amount);
      setTerminal1({ ...terminal1, staked: false });
    }
  };

  const handleTerminal2Cancel = () => {
    if (terminal2.staked && !terminal2.cashedOut && gameState === 'WAITING') {
      setBalance(balance + terminal2.amount);
      setTerminal2({ ...terminal2, staked: false });
    }
  };

  // Reset terminals on crash
  useEffect(() => {
    if (gameState === 'CRASHED') {
      setTimeout(() => {
        setTerminal1({ ...terminal1, staked: false, cashedOut: false });
        setTerminal2({ ...terminal2, staked: false, cashedOut: false });
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

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={login}
        onSignup={signup}
        mode={authMode}
      />
    </section>
  );
}
