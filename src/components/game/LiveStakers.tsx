'use client';

import { useState, useEffect } from 'react';
import { realtimeConnected, subscribeRealtime } from '@/lib/realtime/client';

interface Staker {
  user: string;
  stake: number;
  targetMultiplier: number;
  cashedOut: boolean;
  cashedMultiplier: number;
  payout: number;
  isUser: boolean;
  terminalId?: number;
  color: string;
  status?: string;
  visibleAt?: number;
}

interface HistoryEntry {
  id: number;
  player: string;
  terminalId: number;
  stake: number;
  multiplier: number;
  payout: number;
  status: string;
  timestamp: number;
}

interface TopWin {
  id: number;
  player: string;
  stake: number;
  multiplier: number;
  payout: number;
  timestamp: number;
}

type ServerFeedBet = { id: string; player: string; stake: number; multiplier: number; visibleAt: number; status: 'ACTIVE' | 'WON' | 'LOST'; cashedMultiplier: number; payout: number };

function mapServerFeedBets(bets: ServerFeedBet[]): Staker[] {
  return bets.map((bet) => {
    const cashedOut = bet.status === 'WON';
    return {
      user: bet.player,
      stake: bet.stake,
      targetMultiplier: bet.multiplier,
      cashedOut,
      cashedMultiplier: cashedOut ? bet.cashedMultiplier : 0,
      payout: cashedOut ? bet.payout : 0,
      isUser: false,
      color: cashedOut ? '#2ecc71' : '#64748b',
      // A crash ends the round internally, but the public feed keeps
      // uncashout rows in the same neutral state they had during flight.
      status: cashedOut ? 'WON' : 'ACTIVE',
      visibleAt: bet.visibleAt
    };
  });
}

interface LiveStakersProps {
  gameState: 'WAITING' | 'FLYING' | 'CRASHED';
  roundNonce: number;
  serverTime: number;
  gameMode: 'REAL' | 'DEMO';
}

export function LiveStakers({
  gameState,
  roundNonce,
  serverTime,
  gameMode
}: LiveStakersProps) {
  const [currentTab, setCurrentTab] = useState<'all' | 'previous' | 'top'>('all');
  const [activeStakers, setActiveStakers] = useState<Staker[]>([]);
  const [previousBets, setPreviousBets] = useState<HistoryEntry[]>([]);
  const [previousNonce, setPreviousNonce] = useState<number | null>(null);
  const [topWins, setTopWins] = useState<TopWin[]>([]);
  const [simulatedBets, setSimulatedBets] = useState<Staker[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => subscribeRealtime((event) => {
    if (event.type !== 'bets') return;
    const result = event.data as { roundNonce: number; bets: Array<{ player: string; mode: string; stake: number; multiplier: number; payout: number; status: string; terminalId: number }>; simulatedBets: Parameters<typeof mapServerFeedBets>[0] };
    if (result.roundNonce !== roundNonce) return;
    const rows: Staker[] = result.bets.filter((bet) => bet.mode === gameMode).map((bet) => {
      const cashedOut = bet.status === 'WON';
      return { user: bet.player, stake: bet.stake, targetMultiplier: 0, cashedOut, cashedMultiplier: cashedOut ? bet.multiplier : 0, payout: cashedOut ? bet.payout : 0, isUser: false, terminalId: bet.terminalId, color: cashedOut ? '#2ecc71' : '#57606f', status: cashedOut ? 'WON' : 'ACTIVE' };
    });
    setActiveStakers(rows);
    setSimulatedBets(gameMode === 'DEMO' ? mapServerFeedBets(result.simulatedBets || []) : []);
  }), [roundNonce, gameMode]);

  const getBadgeClass = (multiplier: number): string => {
    if (multiplier >= 10.0) return 'badge-legendary';
    if (multiplier >= 2.0) return 'badge-high';
    return 'badge-low';
  };

  // Show recorded bets for the actual server round.
  useEffect(() => {
    let active = true;
    setActiveStakers([]);
    setSimulatedBets([]);
    const loadBets = async () => {
      try {
        const response = await fetch(`/api/live-bets?roundNonce=${roundNonce}`, { cache: 'no-store' });
        const result = await response.json();
        if (!active || !response.ok || !result.success) return;
        const rows: Staker[] = result.bets.filter((bet: { mode: string }) => bet.mode === gameMode).map((bet: { id: number; player: string; stake: number; multiplier: number; payout: number; status: string; terminalId: number }) => {
          const cashedOut = bet.status === 'WON';
          return {
            user: bet.player, stake: bet.stake, targetMultiplier: 0, cashedOut,
            cashedMultiplier: cashedOut ? bet.multiplier : 0, payout: cashedOut ? bet.payout : 0, isUser: false, terminalId: bet.terminalId,
            color: cashedOut ? '#2ecc71' : '#57606f', status: cashedOut ? 'WON' : 'ACTIVE'
          };
        });
        setActiveStakers(rows);
        setSimulatedBets(gameMode === 'DEMO' ? mapServerFeedBets(result.simulatedBets || []) : []);
      } catch { /* The next round refresh retries. */ }
    };
    void loadBets();
    return () => { active = false; };
  }, [roundNonce, gameMode]);

  // Refresh recorded cashout state while the round is live.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (realtimeConnected()) return;
      try {
        const response = await fetch(`/api/live-bets?roundNonce=${roundNonce}`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) return;
        const rows: Staker[] = result.bets.filter((bet: { mode: string }) => bet.mode === gameMode).map((bet: { id: number; player: string; stake: number; multiplier: number; payout: number; status: string; terminalId: number }) => {
          const cashedOut = bet.status === 'WON';
          return {
            user: bet.player, stake: bet.stake, targetMultiplier: 0, cashedOut,
            cashedMultiplier: cashedOut ? bet.multiplier : 0, payout: cashedOut ? bet.payout : 0, isUser: false, terminalId: bet.terminalId,
            color: cashedOut ? '#2ecc71' : '#57606f', status: cashedOut ? 'WON' : 'ACTIVE'
          };
        });
        setActiveStakers(rows);
        setSimulatedBets(gameMode === 'DEMO' ? mapServerFeedBets(result.simulatedBets || []) : []);
      } catch { /* Keep the most recent successful snapshot on temporary network errors. */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [roundNonce, gameMode]);

  // The two history tabs show confirmed database bets, not session guesses
  // or generated sample activity from the current feed.
  useEffect(() => {
    if (currentTab === 'all') return;
    let active = true;
    setHistoryLoading(true);
    setHistoryError('');
    fetch(`/api/bet-feed-history?mode=${gameMode}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Bet history is unavailable');
        if (active) { setPreviousBets(result.previous || []); setPreviousNonce(result.previousRound?.nonce ?? null); setTopWins(result.top || []); }
      })
      .catch((error) => { if (active) setHistoryError(error instanceof Error ? error.message : 'Bet history is unavailable'); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [currentTab, gameMode, roundNonce]);

  const visibleGeneratedBets = gameState === 'WAITING'
    ? simulatedBets.filter((bet) => (bet.visibleAt ?? 0) <= serverTime)
    : simulatedBets;
  const displayedBets = [...activeStakers, ...visibleGeneratedBets].sort((a, b) => b.stake - a.stake);
  const totalBets = displayedBets.length;
  const totalStaked = displayedBets.reduce((sum, s) => sum + s.stake, 0);
  const totalCashedOut = displayedBets.filter(s => s.cashedOut).length;
  const betsByStake = displayedBets;
  const displayedTopWins = topWins;

  return (
    <aside className="console-sidebar" id="console-sidebar">
      <div className="sidebar-tabs-header">
        <button
          className={`stakers-tab-btn ${currentTab === 'all' ? 'active' : ''}`}
          onClick={() => setCurrentTab('all')}
        >
          All Bets {totalBets}
        </button>
        <button
          className={`stakers-tab-btn ${currentTab === 'previous' ? 'active' : ''}`}
          onClick={() => setCurrentTab('previous')}
        >
          Previous
        </button>
        <button
          className={`stakers-tab-btn ${currentTab === 'top' ? 'active' : ''}`}
          onClick={() => setCurrentTab('top')}
        >
          Top
        </button>
      </div>

      <div className="sidebar-feed-container" id="live-stakers-container">
        {currentTab === 'all' && (
          <>
            {gameMode === 'DEMO' && <div className="stakers-feed-note">Practice feed includes sample activity. Previous and Top show confirmed player bets.</div>}
            <div className="stakers-summary-bar">
              <div className="summary-metric">
                <span className="metric-label">TOTAL BETS</span>
                <span className="metric-value font-bold">{totalBets}</span>
              </div>
              <div className="summary-metric">
                <span className="metric-label">ROUND POOL</span>
                <span className="metric-value font-gold">KES {totalStaked.toLocaleString()}</span>
              </div>
              <div className="summary-metric">
                <span className="metric-label">CASHED</span>
                <span className="metric-value font-emerald">{totalCashedOut} / {totalBets}</span>
              </div>
            </div>
            <div className="stakers-table-header" style={{ gridTemplateColumns: '1.1fr 1fr 0.8fr 1.1fr' }}>
              <span>USER</span>
              <span style={{ textAlign: 'right' }}>BET (KES)</span>
              <span style={{ textAlign: 'center' }}>X</span>
              <span style={{ textAlign: 'right' }}>CASHOUT</span>
            </div>
            <div className="stakers-list-body custom-scroll">
              {betsByStake.length === 0 ? <div className="staker-skeleton-list" role="status" aria-label="Loading placed bets">
                {Array.from({ length: 9 }, (_, index) => <div className="staker-skeleton-row" key={index} aria-hidden="true">
                  <div className="staker-skeleton-user"><i className="staker-skeleton-dot" /><i className="staker-skeleton-bar" style={{ width: `${42 + (index * 13) % 30}px` }} /></div>
                  <i className="staker-skeleton-bar staker-skeleton-amount" style={{ width: `${44 + (index * 9) % 32}px` }} />
                  <i className="staker-skeleton-bar staker-skeleton-odds" />
                  <i className="staker-skeleton-bar staker-skeleton-cashout" />
                </div>)}
              </div> : betsByStake.map((s, idx) => (
                <div
                  key={idx}
                  className={`staker-row ${s.cashedOut ? 'row-cashed' : ''} ${s.isUser ? 'row-user-highlight' : ''}`}
                  style={{ gridTemplateColumns: '1.1fr 1fr 0.8fr 1.1fr' }}
                >
                  <div className="staker-user-cell">
                    <span className="avatar-dot" style={{ background: s.cashedOut ? '#2ecc71' : s.color }}></span>
                    <span className={`staker-name ${s.isUser ? 'font-bold font-crimson' : ''}`}>{s.user}</span>
                  </div>
                  <div className="staker-stake-cell">{s.stake.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  <div style={{ textAlign: 'center' }}>
                    {s.cashedOut ? (
                      <span className={`history-pill ${getBadgeClass(s.cashedMultiplier)}`} style={{ padding: '1px 6px', fontSize: '10px', fontWeight: 800 }}>
                        {s.cashedMultiplier.toFixed(2)}x
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>-</span>
                    )}
                  </div>
                  <div className="staker-payout-cell">
                    {s.cashedOut ? (
                      <span className="cashout-amount font-emerald" style={{ fontSize: '11px', fontWeight: 800 }}>
                        {s.payout.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="waiting-badge">-</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {currentTab === 'previous' && (
          <>
            <div className="stakers-table-header" style={{ gridTemplateColumns: '1fr 0.8fr 1fr 1fr' }}>
              <span>PLAYER</span>
              <span>ROUND</span>
              <span style={{ textAlign: 'right' }}>BET</span>
              <span style={{ textAlign: 'right' }}>RESULT</span>
            </div>
            <div className="stakers-list-body custom-scroll">
              {historyLoading ? <div className="empty-state">Loading the last round…</div> : historyError ? <div className="empty-state" role="status">{historyError}</div> : previousBets.length === 0 ? (
                <div className="empty-state">{previousNonce === null ? 'No completed round is recorded yet.' : `No ${gameMode === 'REAL' ? 'real' : 'practice'} player bets were recorded in round #${previousNonce}.`}</div>
              ) : (
                previousBets.map((h) => (
                  <div
                    key={h.id}
                    className={`staker-row ${h.status === 'WON' ? 'row-cashed' : h.status === 'LOST' ? 'row-lost' : ''}`}
                    style={{ gridTemplateColumns: '1fr 0.8fr 1fr 1fr' }}
                  >
                    <div className="staker-user-cell">
                      <span className="staker-name" style={{ fontSize: '10px' }}>{h.player}</span>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 700 }}>#{previousNonce}</div>
                    <div className="staker-stake-cell">{h.stake.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    <div className="staker-payout-cell">
                      {h.status === 'WON' ? (
                        <span className="font-emerald font-bold">
                          +{h.payout.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({h.multiplier.toFixed(2)}x)
                        </span>
                      ) : h.status === 'LOST' ? (
                        <span className="font-crimson font-bold">
                          -{h.stake.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : <span>{h.status}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {currentTab === 'top' && (
          <>
            <div className="stakers-feed-note">Largest confirmed {gameMode === 'REAL' ? 'wallet' : 'practice'} cashouts from the last 30 days.</div>
            <div className="stakers-table-header" style={{ gridTemplateColumns: '1.1fr 0.9fr 0.9fr 1.1fr' }}>
              <span>USER</span>
              <span>TIME</span>
              <span style={{ textAlign: 'center' }}>X</span>
              <span style={{ textAlign: 'right' }}>WIN (KES)</span>
            </div>
            <div className="stakers-list-body custom-scroll">
              {historyLoading ? <div className="empty-state">Loading top cashouts…</div> : historyError ? <div className="empty-state" role="status">{historyError}</div> : displayedTopWins.length === 0 ? <div className="empty-state">No confirmed {gameMode === 'REAL' ? 'real' : 'practice'} cashouts in the last 30 days.</div> : displayedTopWins.map((w, idx) => (
                <div
                  key={w.id}
                  className="staker-row row-cashed"
                  style={{ gridTemplateColumns: '1.1fr 0.9fr 0.9fr 1.1fr' }}
                >
                  <div className="staker-user-cell">
                    <span className={`rank-badge rank-${idx + 1}`} style={{ fontSize: '9px', fontWeight: 900 }}>{idx + 1}</span>
                    <span className="staker-name">{w.player}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(w.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                  <div style={{ textAlign: 'center' }}>
                    <span className="badge-legendary" style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                      {w.multiplier.toFixed(2)}x
                    </span>
                  </div>
                  <div className="staker-payout-cell">
                    <span className="font-emerald font-bold" style={{ fontSize: '11px' }}>
                      {w.payout.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
