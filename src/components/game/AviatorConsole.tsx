'use client';

import { useState, useEffect, useRef } from 'react';
import { FlightCanvas } from './FlightCanvas';
import { DualBettingTerminals } from './DualBettingTerminals';
import { LiveStakers } from './LiveStakers';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { RoundHistoryRibbon } from './RoundHistoryRibbon';
import { GlobalRoundSyncEngine } from '@/lib/engine/global-sync';
import { realtimeConnected, sendRealtimeCommand, subscribeRealtime } from '@/lib/realtime/client';

interface TerminalState {
  amount: number;
  mode: 'manual' | 'auto';
  autoStakeEnabled: boolean;
  autoCashoutEnabled: boolean;
  autoCashoutMultiplier: number;
  staked: boolean;
  cashedOut: boolean;
  queued: boolean;
  placing: boolean;
  cashedOutMultiplier: number;
  payout: number;
  cashoutPending: boolean;
  cashoutRequestedMultiplier: number;
  betMode: 'REAL' | 'DEMO' | null;
  queuedMode: 'REAL' | 'DEMO' | null;
  queueForNonce: number | null;
}

async function walletAction(action: 'bet' | 'cancel' | 'cashout', token: string, body: Record<string, unknown>) {
  const realtime = sendRealtimeCommand(action, token, body);
  if (realtime) {
    try { const reply = await realtime; return { ok: reply.status >= 200 && reply.status < 300, result: reply.data as Record<string, any> }; }
    catch { /* Retry through the idempotent account routes if the socket closes. */ }
  }
  const response = await fetch(`/api/wallet/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return { ok: response.ok, result: await response.json() };
}

export function AviatorConsole() {
  const { user, token, isAuthenticated, isLoading: authLoading, login, signup, updateBalance } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [gameState, setGameState] = useState<'WAITING' | 'FLYING' | 'CRASHED'>('WAITING');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [balance, setBalance] = useState(user?.realBalance || 0);
  // Keep both independent betting panels visible, matching the legacy layout.
  const [terminal2Visible, setTerminal2Visible] = useState(true);
  const [gameMode, setGameMode] = useState<'REAL' | 'DEMO'>('REAL');
  const [serverNonce, setServerNonce] = useState(0);
  const [serverTime, setServerTime] = useState(0);
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [actionMessage, setActionMessage] = useState('');
  const [roundServiceError, setRoundServiceError] = useState('');
  const [roundHistoryOpen, setRoundHistoryOpen] = useState(false);
  const [cashoutNotices, setCashoutNotices] = useState<{ id: number; terminalId: 1 | 2; multiplier: number; payout: number }[]>([]);
  const betIds = useRef<Record<1 | 2, number | null>>({ 1: null, 2: null });
  const betNonces = useRef<Record<1 | 2, number | null>>({ 1: null, 2: null });
  const localBetMutationAt = useRef(0);
  const roundSyncRef = useRef<GlobalRoundSyncEngine | null>(null);
  const automaticAction = useRef<Record<1 | 2, boolean>>({ 1: false, 2: false });
  const betRequestInFlight = useRef<Record<1 | 2, boolean>>({ 1: false, 2: false });
  const cashoutRequestInFlight = useRef<Record<1 | 2, boolean>>({ 1: false, 2: false });
  const cancelRequestInFlight = useRef<Record<1 | 2, boolean>>({ 1: false, 2: false });
  const lastBetAttemptAt = useRef<Record<1 | 2, number>>({ 1: 0, 2: 0 });
  const autoBetSkipRound = useRef<Record<1 | 2, number | null>>({ 1: null, 2: null });
  const cancelAfterPlace = useRef<Record<1 | 2, boolean>>({ 1: false, 2: false });
  const previousRoundNonce = useRef(0);

  // Update balance when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      const savedMode = localStorage.getItem('shiftstack_game_mode');
      const selectedMode = savedMode === 'DEMO' ? 'DEMO' : 'REAL';
      setGameMode(selectedMode);
      setBalance(selectedMode === 'REAL' ? user.realBalance : user.demoBalance);
      window.dispatchEvent(new CustomEvent('aviator:game-mode', { detail: selectedMode }));
    } else {
      setBalance(0);
      setGameMode('REAL');
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
    placing: false,
    cashedOutMultiplier: 0,
    payout: 0,
    cashoutPending: false,
    cashoutRequestedMultiplier: 1,
    betMode: null,
    queuedMode: null,
    queueForNonce: null
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
    placing: false,
    cashedOutMultiplier: 0,
    payout: 0,
    cashoutPending: false,
    cashoutRequestedMultiplier: 1,
    betMode: null,
    queuedMode: null,
    queueForNonce: null
  });

  // Read the same interpolated engine state that drives the canvas. This keeps
  // betting controls, community feed timing, and the flight visually aligned.
  useEffect(() => {
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type === 'round-unavailable') setRoundServiceError(event.message);
      if (event.type === 'round') setRoundServiceError('');
    });
    const timeout = window.setTimeout(() => {
      if (!roundSyncRef.current?.lastState) setRoundServiceError('Live rounds are temporarily unavailable. Betting is paused until the connection recovers.');
    }, 6000);
    return () => { unsubscribe(); window.clearTimeout(timeout); };
  }, []);

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

  // Restore the signed-in player's current round positions from the database.
  // This runs on initial sync, after a round change, and periodically so a
  // second tab/device can observe the same active/cashed state.
  useEffect(() => {
    if (!isAuthenticated || !token || serverNonce <= 0) return;
    let active = true;
    let inFlight = false;
    const refreshMyRoundBets = async () => {
      if (inFlight) return;
      inFlight = true;
      const startedAt = Date.now();
      try {
        const response = await fetch(`/api/wallet/bets?roundNonce=${serverNonce}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const result = await response.json();
        if (!active || !response.ok || !result.success || startedAt < localBetMutationAt.current) return;
        const currentBets = (result.bets || [])
          .filter((bet: { status: string }) => bet.status === 'ACTIVE' || bet.status === 'WON')
          .sort((a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt);
        const byTerminal = new Map<number, (typeof currentBets)[number]>();
        for (const bet of currentBets) if (!byTerminal.has(bet.terminalId)) byTerminal.set(bet.terminalId, bet);

        const restore = (terminalId: 1 | 2, setTerminal: typeof setTerminal1) => {
          if (betNonces.current[terminalId] && betNonces.current[terminalId] !== serverNonce) return;
          const bet = byTerminal.get(terminalId);
          if (!bet) {
            betIds.current[terminalId] = null;
            betNonces.current[terminalId] = null;
            setTerminal((state) => state.staked || state.cashedOut
              ? { ...state, staked: false, betMode: null, cashedOut: false, cashoutPending: false, cashedOutMultiplier: 0, payout: 0 }
              : state);
            return;
          }
          betIds.current[terminalId] = bet.id;
          betNonces.current[terminalId] = serverNonce;
          setTerminal((state) => {
            // A WON record belongs to the settled bet, while the queued flag
            // represents a newer player action for the next round. Never let
            // a status refresh overwrite that pending action.
            if (state.placing || state.queued) return state;
            return {
              ...state,
              amount: bet.amount,
              staked: true,
              betMode: bet.mode,
              queued: false,
              queuedMode: null,
              queueForNonce: null,
              cashedOut: bet.status === 'WON',
              cashoutPending: false,
              cashedOutMultiplier: bet.status === 'WON' ? bet.multiplier : 0,
              payout: bet.status === 'WON' ? bet.payout : 0
            };
          });
        };
        restore(1, setTerminal1);
        restore(2, setTerminal2);
      } catch {
        // Retain the last known panel state when the database is temporarily unavailable.
      } finally {
        inFlight = false;
      }
    };
    void refreshMyRoundBets();
    let lastSocketRefresh = 0;
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type !== 'bets-changed' || Date.now() - lastSocketRefresh < 2500) return;
      lastSocketRefresh = Date.now();
      void refreshMyRoundBets();
    });
    const timer = window.setInterval(() => { if (!realtimeConnected()) void refreshMyRoundBets(); }, 10000);
    return () => { active = false; window.clearInterval(timer); unsubscribe(); };
  }, [isAuthenticated, token, serverNonce]);

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
    const liveRound = roundSyncRef.current?.getGlobalRoundState();
    const phase = liveRound?.phase || gameState;
    const activeNonce = liveRound?.nonce || serverNonce;
    if (roundServiceError || !roundSyncRef.current?.lastState || activeNonce <= 0 || performance.now() - roundSyncRef.current.lastSyncReceivedAt > 10_000) {
      setActionMessage('Live rounds are unavailable. Please wait for the connection to recover.');
      return;
    }
    window.dispatchEvent(new CustomEvent('aviator:audio-unlock'));
    if (!isAuthenticated || !token) {
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }
    const currentTerminal = terminalId === 1 ? terminal1 : terminal2;
    if (currentTerminal.staked && !currentTerminal.cashedOut) return;
    if (amount > balance) {
      const pause = (state: TerminalState): TerminalState => ({ ...state, queued: false, placing: false, queuedMode: null, queueForNonce: null, autoStakeEnabled: false });
      if (terminalId === 1) setTerminal1(pause); else setTerminal2(pause);
      setActionMessage(`Insufficient funds for Bet ${terminalId}.`);
      return;
    }
    const targetNonce = phase === 'WAITING' && activeNonce > 0 ? activeNonce : Math.max(1, activeNonce + 1);
    if (!currentTerminal.queued && phase !== 'WAITING') {
      const queue = (state: TerminalState): TerminalState => ({ ...state, amount, staked: false, betMode: null, cashedOut: false, cashoutPending: false, cashedOutMultiplier: 0, payout: 0, queued: true, queuedMode: modeOverride, queueForNonce: targetNonce });
      if (terminalId === 1) setTerminal1(queue); else setTerminal2(queue);
    }
    if (phase !== 'WAITING' || activeNonce <= 0 || (currentTerminal.queued && (currentTerminal.queueForNonce || 0) > activeNonce)) {
      setActionMessage(`Bet ${terminalId} queued for the next round.`);
      return;
    }
    setActionMessage('');
    betRequestInFlight.current[terminalId] = true;
    if (terminalId === 1) setTerminal1((state) => ({ ...state, placing: true }));
    else setTerminal2((state) => ({ ...state, placing: true }));
    try {
      const { ok, result } = await walletAction('bet', token, { amount, mode: modeOverride, terminalId, roundNonce: activeNonce });
      if (!ok || !result.success) {
        if (result.code === 'INSUFFICIENT_FUNDS') {
          const pause = (state: TerminalState): TerminalState => ({ ...state, queued: false, placing: false, queuedMode: null, queueForNonce: null, autoStakeEnabled: false });
          if (terminalId === 1) setTerminal1(pause); else setTerminal2(pause);
          setActionMessage(`Insufficient funds for Bet ${terminalId}. Auto Bet paused.`);
          return;
        }
        if (result.code === 'ROUND_CLOSED') {
          try {
            const historyResponse = await fetch(`/api/wallet/bets?roundNonce=${activeNonce}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
            if (historyResponse.ok) {
              const history = await historyResponse.json();
              const placed = history.bets?.find((bet: { terminalId: number; mode: string }) => bet.terminalId === terminalId && bet.mode === modeOverride);
              if (placed) {
                betIds.current[terminalId] = placed.status === 'ACTIVE' || placed.status === 'WON' ? placed.id : null;
                betNonces.current[terminalId] = betIds.current[terminalId] ? activeNonce : null;
                const currentNonce = roundSyncRef.current?.getGlobalRoundState().nonce;
                if (cancelAfterPlace.current[terminalId]) {
                  cancelAfterPlace.current[terminalId] = false;
                  const cancelled = await walletAction('cancel', token, { betId: placed.id });
                  if (cancelled.ok && cancelled.result.success) {
                    betIds.current[terminalId] = null;
                    betNonces.current[terminalId] = null;
                    autoBetSkipRound.current[terminalId] = activeNonce;
                    updateBalance(cancelled.result.realBalance, cancelled.result.demoBalance);
                    setBalance(gameMode === 'REAL' ? cancelled.result.realBalance : cancelled.result.demoBalance);
                    const clear = (state: TerminalState): TerminalState => ({ ...state, queued: false, queuedMode: null, queueForNonce: null, staked: false, betMode: null });
                    if (terminalId === 1) setTerminal1(clear); else setTerminal2(clear);
                    setActionMessage('Bet cancelled.');
                    return;
                  }
                }
                const restored = (state: TerminalState): TerminalState => ({ ...state, queued: false, queuedMode: null, queueForNonce: null, staked: currentNonce === activeNonce && (placed.status === 'ACTIVE' || placed.status === 'WON'), betMode: modeOverride, cashedOut: placed.status === 'WON', cashedOutMultiplier: placed.status === 'WON' ? Number(placed.multiplier) : 0, payout: placed.status === 'WON' ? Number(placed.payout) : 0 });
                if (terminalId === 1) setTerminal1(restored); else setTerminal2(restored);
                setActionMessage(currentNonce === activeNonce ? 'Bet placed.' : 'Your bet was recorded for the previous round.');
                return;
              }
            }
          } catch { /* Queue the next round if history is unavailable. */ }
          if (cancelAfterPlace.current[terminalId]) {
            cancelAfterPlace.current[terminalId] = false;
            setActionMessage('Queued bet cancelled.');
            return;
          }
          const defer = (state: TerminalState): TerminalState => ({ ...state, queued: true, queueForNonce: activeNonce + 1 });
          if (terminalId === 1) setTerminal1(defer); else setTerminal2(defer);
          setActionMessage(`Bet ${terminalId} queued for the next round.`);
          return;
        }
        throw new Error(result.message || result.error || 'Bet could not be placed');
      }
      betIds.current[terminalId] = result.betId;
      betNonces.current[terminalId] = activeNonce;
      const nextBalance = gameMode === 'REAL' ? result.realBalance : result.demoBalance;
      setBalance(nextBalance);
      updateBalance(result.realBalance, result.demoBalance);
      if ((roundSyncRef.current?.getGlobalRoundState().nonce || activeNonce) !== activeNonce) {
        betIds.current[terminalId] = null;
        betNonces.current[terminalId] = null;
        cancelAfterPlace.current[terminalId] = false;
        const clear = (state: TerminalState): TerminalState => ({ ...state, queued: false, queuedMode: null, queueForNonce: null, staked: false, betMode: null });
        if (terminalId === 1) setTerminal1(clear); else setTerminal2(clear);
        setActionMessage('Bet was recorded for the previous round.');
        return;
      }
      const update = (state: TerminalState): TerminalState => ({ ...state, staked: true, queued: false, queuedMode: null, queueForNonce: null, betMode: modeOverride, cashedOut: false, cashoutPending: false, cashoutRequestedMultiplier: 1, cashedOutMultiplier: 0, payout: 0, amount });
      if (terminalId === 1) setTerminal1(update); else setTerminal2(update);
      localBetMutationAt.current = Date.now();
      window.dispatchEvent(new CustomEvent('aviator:bet-success'));
      setActionMessage('');
      if (cancelAfterPlace.current[terminalId]) {
        cancelAfterPlace.current[terminalId] = false;
        const cancelled = await walletAction('cancel', token, { betId: result.betId });
        if (cancelled.ok && cancelled.result.success) {
          betIds.current[terminalId] = null;
          betNonces.current[terminalId] = null;
          autoBetSkipRound.current[terminalId] = activeNonce;
          updateBalance(cancelled.result.realBalance, cancelled.result.demoBalance);
          setBalance(gameMode === 'REAL' ? cancelled.result.realBalance : cancelled.result.demoBalance);
          const clear = (state: TerminalState): TerminalState => ({ ...state, staked: false, betMode: null });
          if (terminalId === 1) setTerminal1(clear); else setTerminal2(clear);
          setActionMessage('Bet cancelled.');
        } else setActionMessage('Bet was placed, but takeoff began before it could be cancelled.');
      }
    } catch (error) {
      cancelAfterPlace.current[terminalId] = false;
      const unqueue = (state: TerminalState): TerminalState => ({ ...state, queued: false, queuedMode: null, queueForNonce: null });
      if (terminalId === 1) setTerminal1(unqueue); else setTerminal2(unqueue);
      setActionMessage(error instanceof Error ? error.message : 'Bet could not be placed');
    } finally {
      betRequestInFlight.current[terminalId] = false;
      if (terminalId === 1) setTerminal1((state) => ({ ...state, placing: false }));
      else setTerminal2((state) => ({ ...state, placing: false }));
    }
  };

  const handleCashout = async (terminalId: 1 | 2, automatic = false) => {
    if (cashoutRequestInFlight.current[terminalId]) return;
    const liveRound = roundSyncRef.current?.getGlobalRoundState();
    const phase = liveRound?.phase || gameState;
    const liveMultiplier = liveRound?.currentMultiplier || currentMultiplier;
    const terminal = terminalId === 1 ? terminal1 : terminal2;
    const autoTarget = automatic && terminal.autoCashoutEnabled ? terminal.autoCashoutMultiplier : null;
    const autoAlreadyReached = autoTarget !== null && liveMultiplier >= autoTarget;
    if (!terminal.staked || terminal.cashedOut || (phase !== 'FLYING' && !(phase === 'CRASHED' && autoAlreadyReached))) return;
    cashoutRequestInFlight.current[terminalId] = true;
    setActionMessage('');
    const settlementMode = terminal.betMode || gameMode;
    try {
      let settledMultiplier: number;
      let settledPayout: number;
      if (isAuthenticated && token) {
        if (!betIds.current[terminalId]) throw new Error('This bet is not linked to a recorded account bet. Refresh before trying again.');
        const { ok, result } = await walletAction('cashout', token, { betId: betIds.current[terminalId], mode: settlementMode, ...(autoTarget !== null ? { autoCashoutMultiplier: autoTarget } : {}) });
        if (!ok || !result.success) throw new Error(result.message || result.error || 'Cashout failed');
        settledMultiplier = Number(result.multiplier);
        settledPayout = Number(result.payout);
        setBalance(gameMode === 'REAL' ? result.realBalance : result.demoBalance);
        updateBalance(result.realBalance, result.demoBalance);
    } else throw new Error('Please log in again to cash out this bet.');
      const update = (state: TerminalState) => ({ ...state, cashoutPending: false, cashedOut: true, cashedOutMultiplier: settledMultiplier, payout: settledPayout });
      if (terminalId === 1) setTerminal1(update); else setTerminal2(update);
      localBetMutationAt.current = Date.now();
      setCashoutNotices((current) => [...current, { id: Date.now() + terminalId, terminalId, multiplier: settledMultiplier, payout: settledPayout }]);
      window.dispatchEvent(new CustomEvent('aviator:cashout-success'));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Cashout failed');
    } finally {
      cashoutRequestInFlight.current[terminalId] = false;
    }
  };

  const handleCancel = async (terminalId: 1 | 2) => {
    const terminal = terminalId === 1 ? terminal1 : terminal2;
    if (terminal.placing) return;
    if (terminal.queued && !terminal.staked) {
      if (betRequestInFlight.current[terminalId]) cancelAfterPlace.current[terminalId] = true;
      const update = (state: TerminalState): TerminalState => ({ ...state, queued: false, queuedMode: null, queueForNonce: null });
      if (terminalId === 1) setTerminal1(update); else setTerminal2(update);
      if (terminal.mode === 'auto' && terminal.autoStakeEnabled) autoBetSkipRound.current[terminalId] = serverNonce + 1;
      setActionMessage('Queued bet cancelled.');
      return;
    }
    if (!terminal.staked || terminal.cashedOut) return;
    const liveRound = roundSyncRef.current?.getGlobalRoundState();
    const phase = liveRound?.phase || gameState;
    if (phase === 'FLYING') { void handleCashout(terminalId); return; }
    if (phase !== 'WAITING') return;
    if (cancelRequestInFlight.current[terminalId]) return;
    cancelRequestInFlight.current[terminalId] = true;
    try {
      if (isAuthenticated && token && betIds.current[terminalId]) {
        const { ok, result } = await walletAction('cancel', token, { betId: betIds.current[terminalId] });
        if (!ok || !result.success) throw new Error(result.message || 'Bet could not be cancelled');
        setBalance(gameMode === 'REAL' ? result.realBalance : result.demoBalance);
        updateBalance(result.realBalance, result.demoBalance);
        localBetMutationAt.current = Date.now();
        betIds.current[terminalId] = null;
        betNonces.current[terminalId] = null;
        autoBetSkipRound.current[terminalId] = liveRound?.nonce || serverNonce;
      } else throw new Error('Please log in again to cancel this bet.');
      if (terminalId === 1) setTerminal1((state) => ({ ...state, staked: false }));
      else setTerminal2((state) => ({ ...state, staked: false }));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Bet could not be cancelled');
    } finally { cancelRequestInFlight.current[terminalId] = false; }
  };

  const handleTerminal1Bet = (amount: number) => handleBet(1, amount);
  const handleTerminal2Bet = (amount: number) => handleBet(2, amount);
  const handleTerminal1Cashout = () => handleCashout(1);
  const handleTerminal2Cashout = () => handleCashout(2);
  const handleTerminal1Cancel = () => handleCancel(1);
  const handleTerminal2Cancel = () => handleCancel(2);

  useEffect(() => {
    if (gameState !== 'WAITING') return;
    automaticAction.current = { 1: false, 2: false };
    const attempt = () => {
      if (serverNonce <= 0 || !isAuthenticated || !token) return;
      for (const [id, terminal] of [[1, terminal1], [2, terminal2]] as const) {
        if (!(terminal.queued || (terminal.mode === 'auto' && terminal.autoStakeEnabled)) || terminal.staked || betRequestInFlight.current[id] || autoBetSkipRound.current[id] === serverNonce || (terminal.queueForNonce || 0) > serverNonce || Date.now() - lastBetAttemptAt.current[id] < 1000) continue;
        lastBetAttemptAt.current[id] = Date.now();
        void handleBet(id, terminal.amount, terminal.queued ? terminal.queuedMode || gameMode : gameMode);
      }
    };
    attempt();
    const timer = window.setInterval(attempt, 250);
    return () => window.clearInterval(timer);
  }, [gameState, serverNonce, gameMode, terminal1, terminal2, isAuthenticated, token]);

  useEffect(() => {
    if (gameState !== 'FLYING' && gameState !== 'CRASHED') return;
    if (terminal1.staked && !terminal1.cashedOut && terminal1.autoCashoutEnabled && currentMultiplier >= terminal1.autoCashoutMultiplier && !automaticAction.current[1]) {
      automaticAction.current[1] = true;
      void handleCashout(1, true);
    }
    if (terminal2.staked && !terminal2.cashedOut && terminal2.autoCashoutEnabled && currentMultiplier >= terminal2.autoCashoutMultiplier && !automaticAction.current[2]) {
      automaticAction.current[2] = true;
      void handleCashout(2, true);
    }
  }, [gameState, currentMultiplier, terminal1, terminal2]);

  // Clear the previous round only when the server advances to a new nonce.
  // A crash timeout could otherwise erase a bet placed in the next countdown.
  useEffect(() => {
    if (serverNonce <= 0) return;
    const previous = previousRoundNonce.current;
    previousRoundNonce.current = serverNonce;
    if (!previous || previous === serverNonce) return;
    const clear = (state: TerminalState): TerminalState => ({ ...state, staked: false, betMode: null, cashedOut: false, cashoutPending: false, cashedOutMultiplier: 0, payout: 0 });
    if (betNonces.current[1] !== serverNonce) { betIds.current[1] = null; betNonces.current[1] = null; setTerminal1(clear); }
    if (betNonces.current[2] !== serverNonce) { betIds.current[2] = null; betNonces.current[2] = null; setTerminal2(clear); }
  }, [serverNonce]);

  useEffect(() => {
    if (!cashoutNotices.length) return;
    const timers = cashoutNotices.map((notice) => setTimeout(() => setCashoutNotices((current) => current.filter((item) => item.id !== notice.id)), 3500));
    return () => timers.forEach(clearTimeout);
  }, [cashoutNotices]);

  return (
    <section className="view-section active" id="view-terminal">
      {roundServiceError && <div role="alert" className="round-service-error">{roundServiceError}</div>}
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
          {/* Game banner */}
          <div className={`shiftstack-fun-banner ${gameMode === 'DEMO' ? 'kessbet-fun-banner' : 'kessbet-real-banner'}`}>
            AVIATOR
          </div>

          {/* Flight Canvas Component */}
          <FlightCanvas syncRef={roundSyncRef} cashoutNotices={cashoutNotices} onDismissCashout={(id) => setCashoutNotices((current) => current.filter((item) => item.id !== id))} />

          {/* Real Mode Deposit Alert */}
          <div id="real-mode-deposit-alert" className="real-mode-deposit-alert" style={{ display: 'none' }}>
            <div className="alert-content">
              <span className="alert-icon">⚡</span>
              <span className="alert-text"><strong>Wallet balance is 0 KES.</strong> Deposit at least 49 KES via PayHero to continue.</span>
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
            onTerminal1Change={(state) => setTerminal1((current) => ({ ...current, ...state }))}
            onTerminal2Change={(state) => setTerminal2((current) => ({ ...current, ...state }))}
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
              <span>Sign in or create an account to place a bet.</span>
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
