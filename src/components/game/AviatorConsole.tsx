'use client';

import { useState, useEffect, useRef } from 'react';
import { FlightCanvas } from './FlightCanvas';
import { DualBettingTerminals } from './DualBettingTerminals';
import { LiveStakers } from './LiveStakers';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { RoundHistoryRibbon } from './RoundHistoryRibbon';
import { GlobalRoundSyncEngine } from '@/lib/engine/global-sync';

interface TerminalState {
  amount: number;
  mode: 'manual' | 'auto';
  autoStakeEnabled: boolean;
  autoCashoutEnabled: boolean;
  autoCashoutMultiplier: number;
  staked: boolean;
  cashedOut: boolean;
  queued: boolean;
  cashedOutMultiplier: number;
  payout: number;
  cashoutPending: boolean;
  cashoutRequestedMultiplier: number;
  betMode: 'REAL' | 'DEMO' | null;
  queuedMode: 'REAL' | 'DEMO' | null;
}

export function AviatorConsole() {
  const { user, token, isAuthenticated, isLoading: authLoading, login, signup, updateBalance } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [gameState, setGameState] = useState<'WAITING' | 'FLYING' | 'CRASHED'>('WAITING');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [balance, setBalance] = useState(user?.demoBalance || 0);
  // Keep both independent betting panels visible, matching the legacy layout.
  const [terminal2Visible, setTerminal2Visible] = useState(true);
  const [gameMode, setGameMode] = useState<'REAL' | 'DEMO'>('DEMO');
  const [serverNonce, setServerNonce] = useState(0);
  const [serverTime, setServerTime] = useState(0);
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [actionMessage, setActionMessage] = useState('');
  const [roundHistoryOpen, setRoundHistoryOpen] = useState(false);
  const [cashoutNotices, setCashoutNotices] = useState<{ id: number; terminalId: 1 | 2; multiplier: number; payout: number }[]>([]);
  const betIds = useRef<Record<1 | 2, number | null>>({ 1: null, 2: null });
  const roundSyncRef = useRef<GlobalRoundSyncEngine | null>(null);
  const automaticAction = useRef<Record<1 | 2, boolean>>({ 1: false, 2: false });
  const betRequestInFlight = useRef<Record<1 | 2, boolean>>({ 1: false, 2: false });
  const cashoutRequestInFlight = useRef<Record<1 | 2, boolean>>({ 1: false, 2: false });
  const autoBetRoundAttempt = useRef<Record<1 | 2, number | null>>({ 1: null, 2: null });
  const autoBetSkipRound = useRef<Record<1 | 2, number | null>>({ 1: null, 2: null });

  // Update balance when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      const savedMode = localStorage.getItem('shiftstack_game_mode');
      const selectedMode = savedMode === 'REAL' ? 'REAL' : 'DEMO';
      setGameMode(selectedMode);
      setBalance(selectedMode === 'REAL' ? user.realBalance : user.demoBalance);
      window.dispatchEvent(new CustomEvent('aviator:game-mode', { detail: selectedMode }));
    } else {
      setBalance(0);
      setGameMode('DEMO');
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    const onModeChange = (event: Event) => {
      const mode = (event as CustomEvent<'REAL' | 'DEMO'>).detail;
      setGameMode(mode);
      setBalance(mode === 'REAL' ? Number(user?.realBalance || 0) : Number(user?.demoBalance || 0));
    };
    window.addEventListener('aviator:game-mode', onModeChange);
    return () => window.removeEventListener('aviator:game-mode', onModeChange);
  }, [user]);

  const [terminal1, setTerminal1] = useState<TerminalState>({
    amount: 100,
    mode: 'manual',
    autoStakeEnabled: false,
    autoCashoutEnabled: false,
    autoCashoutMultiplier: 2.0,
    staked: false,
    cashedOut: false,
    queued: false,
    cashedOutMultiplier: 0,
    payout: 0,
    cashoutPending: false,
    cashoutRequestedMultiplier: 1,
    betMode: null,
    queuedMode: null
  });

  const [terminal2, setTerminal2] = useState<TerminalState>({
    amount: 100,
    mode: 'manual',
    autoStakeEnabled: false,
    autoCashoutEnabled: false,
    autoCashoutMultiplier: 1.5,
    staked: false,
    cashedOut: false,
    queued: false,
    cashedOutMultiplier: 0,
    payout: 0,
    cashoutPending: false,
    cashoutRequestedMultiplier: 1,
    betMode: null,
    queuedMode: null
  });

  // Read the same interpolated engine state that drives the canvas. This keeps
  // betting controls, community feed timing, and the flight visually aligned.
  useEffect(() => {
    const syncUiState = () => {
      const sync = roundSyncRef.current;
      if (!sync) return;
      const state = sync.getGlobalRoundState();
      setGameState(state.phase);
      setCurrentMultiplier(state.currentMultiplier);
      setServerNonce(state.nonce);
      setServerTime(state.serverTime);
      setCountdownSeconds(state.remainingSeconds);
    };
    const interval = setInterval(syncUiState, 100);
    syncUiState();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const openHistory = () => setRoundHistoryOpen(true);
    window.addEventListener('aviator:open-history', openHistory);
    return () => window.removeEventListener('aviator:open-history', openHistory);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { setActionMessage('Fullscreen is not available in this browser.'); }
  };

  const roundNonce = serverNonce;

  const handleBet = async (terminalId: 1 | 2, amount: number, modeOverride: 'REAL' | 'DEMO' = gameMode) => {
    if (betRequestInFlight.current[terminalId]) return;
    if (!isAuthenticated || !token) {
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }
    const availableBalance = modeOverride === 'REAL' ? Number(user?.realBalance || 0) : Number(user?.demoBalance || 0);
    if (availableBalance < amount) { setActionMessage('Insufficient balance for this bet.'); return; }
    const currentTerminal = terminalId === 1 ? terminal1 : terminal2;
    if (gameState === 'FLYING') {
      if ((!currentTerminal.staked || currentTerminal.cashedOut) && !currentTerminal.queued) {
        const update = (state: TerminalState) => ({ ...state, amount, staked: false, betMode: null, cashedOut: false, cashoutPending: false, cashedOutMultiplier: 0, payout: 0, queued: true, queuedMode: modeOverride });
        if (terminalId === 1) setTerminal1(update); else setTerminal2(update);
        setActionMessage(`Bet ${terminalId} queued for the next round.`);
      }
      return;
    }
    if (gameState !== 'WAITING' || currentTerminal.staked) return;
    setActionMessage('');
    betRequestInFlight.current[terminalId] = true;
    try {
      const response = await fetch('/api/wallet/bet', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ amount, mode: modeOverride, terminalId, roundNonce: serverNonce }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || result.error || 'Bet could not be placed');
      betIds.current[terminalId] = result.betId;
      const nextBalance = gameMode === 'REAL' ? result.realBalance : result.demoBalance;
      setBalance(nextBalance);
      updateBalance(result.realBalance, result.demoBalance);
      const update = (state: TerminalState) => ({ ...state, staked: true, queued: false, queuedMode: null, betMode: modeOverride, cashedOut: false, cashoutPending: false, cashoutRequestedMultiplier: 1, cashedOutMultiplier: 0, payout: 0, amount });
      if (terminalId === 1) setTerminal1(update); else setTerminal2(update);
      setActionMessage('');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Bet could not be placed');
    } finally {
      betRequestInFlight.current[terminalId] = false;
    }
  };

  const handleCashout = async (terminalId: 1 | 2) => {
    if (cashoutRequestInFlight.current[terminalId]) return;
    const terminal = terminalId === 1 ? terminal1 : terminal2;
    const autoTarget = terminal.autoCashoutEnabled ? terminal.autoCashoutMultiplier : null;
    const autoAlreadyReached = autoTarget !== null && currentMultiplier >= autoTarget;
    if (!terminal.staked || terminal.cashedOut || (gameState !== 'FLYING' && !(gameState === 'CRASHED' && autoAlreadyReached))) return;
    cashoutRequestInFlight.current[terminalId] = true;
    setActionMessage('');
    const settlementMode = terminal.betMode || gameMode;
    const requestedAtMultiplier = autoTarget !== null && terminal.mode === 'auto' ? autoTarget : Math.floor(currentMultiplier * 100) / 100;
    const markPending = (state: TerminalState) => ({ ...state, cashoutPending: true, cashoutRequestedMultiplier: requestedAtMultiplier });
    if (terminalId === 1) setTerminal1(markPending); else setTerminal2(markPending);
    try {
      let settledMultiplier: number;
      let settledPayout: number;
      if (isAuthenticated && token) {
        if (!betIds.current[terminalId]) throw new Error('This bet is not linked to a recorded account bet. Refresh before trying again.');
        const response = await fetch('/api/wallet/cashout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000), body: JSON.stringify({ betId: betIds.current[terminalId], mode: settlementMode, ...(terminal.mode === 'auto' && terminal.autoCashoutEnabled ? { autoCashoutMultiplier: terminal.autoCashoutMultiplier } : {}) }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || result.error || 'Cashout failed');
        settledMultiplier = Number(result.multiplier);
        settledPayout = Number(result.payout);
        setBalance(gameMode === 'REAL' ? result.realBalance : result.demoBalance);
        updateBalance(result.realBalance, result.demoBalance);
    } else throw new Error('Please log in again to cash out this bet.');
      const update = (state: TerminalState) => ({ ...state, cashoutPending: false, cashedOut: true, cashedOutMultiplier: settledMultiplier, payout: settledPayout });
      if (terminalId === 1) setTerminal1(update); else setTerminal2(update);
      setCashoutNotices((current) => [...current, { id: Date.now() + terminalId, terminalId, multiplier: settledMultiplier, payout: settledPayout }]);
      window.dispatchEvent(new CustomEvent('aviator:cashout-success'));
    } catch (error) {
      const clearPending = (state: TerminalState) => ({ ...state, cashoutPending: false });
      if (terminalId === 1) setTerminal1(clearPending); else setTerminal2(clearPending);
      setActionMessage(error instanceof DOMException && error.name === 'TimeoutError'
        ? 'Cashout confirmation is taking longer than expected. Press Cash Out again to check the settlement.'
        : error instanceof Error ? error.message : 'Cashout failed');
    } finally {
      cashoutRequestInFlight.current[terminalId] = false;
    }
  };

  const handleCancel = async (terminalId: 1 | 2) => {
    const terminal = terminalId === 1 ? terminal1 : terminal2;
    if (terminal.queued && !terminal.staked) {
      const update = (state: TerminalState) => ({ ...state, queued: false, queuedMode: null });
      if (terminalId === 1) setTerminal1(update); else setTerminal2(update);
      if (terminal.mode === 'auto' && terminal.autoStakeEnabled) autoBetSkipRound.current[terminalId] = serverNonce + 1;
      setActionMessage('Queued bet cancelled.');
      return;
    }
    if (!terminal.staked || terminal.cashedOut || gameState !== 'WAITING') return;
    try {
      if (isAuthenticated && token && betIds.current[terminalId]) {
        const response = await fetch('/api/wallet/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ betId: betIds.current[terminalId] }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Bet could not be cancelled');
        setBalance(gameMode === 'REAL' ? result.realBalance : result.demoBalance);
        updateBalance(result.realBalance, result.demoBalance);
        betIds.current[terminalId] = null;
      } else throw new Error('Please log in again to cancel this bet.');
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
      if (serverNonce > 0 && autoBetSkipRound.current[1] !== serverNonce && (terminal1.queued || (terminal1.mode === 'auto' && terminal1.autoStakeEnabled)) && !terminal1.staked && autoBetRoundAttempt.current[1] !== serverNonce) {
        autoBetRoundAttempt.current[1] = serverNonce;
        void handleBet(1, terminal1.amount, terminal1.queued ? terminal1.queuedMode || gameMode : gameMode);
      }
      if (serverNonce > 0 && autoBetSkipRound.current[2] !== serverNonce && (terminal2.queued || (terminal2.mode === 'auto' && terminal2.autoStakeEnabled)) && !terminal2.staked && autoBetRoundAttempt.current[2] !== serverNonce) {
        autoBetRoundAttempt.current[2] = serverNonce;
        void handleBet(2, terminal2.amount, terminal2.queued ? terminal2.queuedMode || gameMode : gameMode);
      }
    }
  }, [gameState, serverNonce, gameMode, terminal1.mode, terminal1.autoStakeEnabled, terminal1.staked, terminal1.queued, terminal1.queuedMode, terminal1.amount, terminal2.mode, terminal2.autoStakeEnabled, terminal2.staked, terminal2.queued, terminal2.queuedMode, terminal2.amount]);

  useEffect(() => {
    if (gameState !== 'FLYING' && gameState !== 'CRASHED') return;
    if (terminal1.staked && !terminal1.cashedOut && terminal1.autoCashoutEnabled && currentMultiplier >= terminal1.autoCashoutMultiplier && !automaticAction.current[1]) {
      automaticAction.current[1] = true;
      void handleCashout(1);
    }
    if (terminal2.staked && !terminal2.cashedOut && terminal2.autoCashoutEnabled && currentMultiplier >= terminal2.autoCashoutMultiplier && !automaticAction.current[2]) {
      automaticAction.current[2] = true;
      void handleCashout(2);
    }
  }, [gameState, currentMultiplier, terminal1, terminal2]);

  // Reset terminals on crash
  useEffect(() => {
    if (gameState === 'CRASHED') {
      setTimeout(() => {
        setTerminal1((state) => ({ ...state, staked: false, betMode: null, cashedOut: false, cashoutPending: false, cashedOutMultiplier: 0, payout: 0 }));
        setTerminal2((state) => ({ ...state, staked: false, betMode: null, cashedOut: false, cashoutPending: false, cashedOutMultiplier: 0, payout: 0 }));
        betIds.current = { 1: null, 2: null };
      }, 3000);
    }
  }, [gameState]);

  useEffect(() => {
    if (!cashoutNotices.length) return;
    const timers = cashoutNotices.map((notice) => setTimeout(() => setCashoutNotices((current) => current.filter((item) => item.id !== notice.id)), 3500));
    return () => timers.forEach(clearTimeout);
  }, [cashoutNotices]);

  return (
    <section className="view-section active" id="view-terminal">
      {/* Top Go Back & Fullscreen Header */}
      <div className="aviator-top-nav-bar">
        <button type="button" className="btn-aviator-back" id="btn-aviator-back" title="Go Back" onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.href = '/'; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>Go Back</span>
        </button>
        <button type="button" className="btn-aviator-fullscreen" id="btn-aviator-fullscreen" title="Toggle Fullscreen" onClick={() => void toggleFullscreen()}>
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
        <button type="button" className="promo-banner-btn" id="btn-promo-banner-action" title="View Daily Crown Leaderboard" onClick={() => setActionMessage('The Daily Crown leaderboard is not connected yet.')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>

      {/* Multiplier History Bar */}
      <div className="arena-history-bar" id="arena-history-bar">
        <div className="history-ribbon-wrapper" id="history-ribbon"><RoundHistoryRibbon /></div>
        <button className="btn-round-history" id="btn-open-round-history" title="Round History & Multipliers" onClick={() => setRoundHistoryOpen((open) => !open)} aria-expanded={roundHistoryOpen}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '3px' }}>
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>•••</span>
        </button>
      </div>
      {roundHistoryOpen && <div className="round-history-popover"><strong>Recent completed rounds</strong><RoundHistoryRibbon /><button type="button" onClick={() => setRoundHistoryOpen(false)}>Close</button></div>}

      <div className="aviator-console-layout">
        {/* Main Flight Stage */}
        <div className="console-main-stage">
          {/* FUN MODE Banner */}
          <div className={`shiftstack-fun-banner ${gameMode === 'DEMO' ? 'kessbet-fun-banner' : 'kessbet-real-banner'}`}>
            {gameMode === 'DEMO' ? 'FUN MODE' : 'REAL MODE'}
          </div>

          {/* Flight Canvas Component */}
          <FlightCanvas syncRef={roundSyncRef} cashoutNotices={cashoutNotices} onDismissCashout={(id) => setCashoutNotices((current) => current.filter((item) => item.id !== id))} />

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
          <div className="betting-auth-gate">
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
          {!isAuthenticated && !authLoading && <div className="auth-required-overlay">
            <div className="auth-required-card">
              <strong>Login required to play</strong>
              <span>Sign in or create an account to place Demo or Real bets.</span>
              <button type="button" className="auth-submit-btn" onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}>Login / Register</button>
            </div>
          </div>}
          </div>
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
          serverTime={serverTime}
        />
      </div>
      {actionMessage && <div role="status" className="bet-action-message">{actionMessage}</div>}

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
