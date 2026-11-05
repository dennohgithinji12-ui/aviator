'use client';

import { useState, useEffect, useRef } from 'react';

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
}

interface HistoryEntry {
  id: number;
  stake: number;
  cashedOut: boolean;
  multiplier: number;
  payout: number;
  profit: number;
  time: string;
}

interface TopWin {
  user: string;
  stake: number;
  multiplier: number;
  payout: number;
  time: string;
}

interface LiveStakersProps {
  terminal1Staked: boolean;
  terminal1Amount: number;
  terminal1CashedOut: boolean;
  terminal1AutoCashoutMultiplier: number;
  terminal2Staked: boolean;
  terminal2Amount: number;
  terminal2CashedOut: boolean;
  terminal2AutoCashoutMultiplier: number;
  gameState: 'WAITING' | 'FLYING' | 'CRASHED';
  currentMultiplier: number;
  countdownSeconds: number;
  roundNonce: number;
}

export function LiveStakers({
  terminal1Staked,
  terminal1Amount,
  terminal1CashedOut,
  terminal1AutoCashoutMultiplier,
  terminal2Staked,
  terminal2Amount,
  terminal2CashedOut,
  terminal2AutoCashoutMultiplier,
  gameState,
  currentMultiplier,
  countdownSeconds,
  roundNonce
}: LiveStakersProps) {
  const [currentTab, setCurrentTab] = useState<'all' | 'my' | 'top'>('all');
  const [activeStakers, setActiveStakers] = useState<Staker[]>([]);
  const [myHistory, setMyHistory] = useState<HistoryEntry[]>([]);
  const [topWins, setTopWins] = useState<TopWin[]>([]);

  const lastRoundNonce = useRef<number | null>(null);

  const getBadgeClass = (multiplier: number): string => {
    if (multiplier >= 10.0) return 'badge-legendary';
    if (multiplier >= 2.0) return 'badge-high';
    return 'badge-low';
  };

  // Show recorded bets for the actual server round.
  useEffect(() => {
    if (roundNonce === lastRoundNonce.current) return;
    lastRoundNonce.current = roundNonce;
    let active = true;
    const loadBets = async () => {
      try {
        const response = await fetch(`/api/live-bets?roundNonce=${roundNonce}`, { cache: 'no-store' });
        const result = await response.json();
        if (!active || !response.ok || !result.success) return;
        const rows: Staker[] = result.bets.map((bet: { id: number; player: string; stake: number; multiplier: number; payout: number; status: string; terminalId: number }) => ({
          user: bet.player, stake: bet.stake, targetMultiplier: 0, cashedOut: bet.status === 'WON',
          cashedMultiplier: bet.multiplier, payout: bet.payout, isUser: false, terminalId: bet.terminalId,
          color: bet.status === 'WON' ? '#2ecc71' : bet.status === 'LOST' ? '#e74c3c' : '#57606f', status: bet.status
        }));
        setActiveStakers(rows);
        setTopWins(rows.filter((bet) => bet.cashedOut).map((bet) => ({ user: bet.user, stake: bet.stake, multiplier: bet.cashedMultiplier, payout: bet.payout, time: 'This round' })).sort((a, b) => b.payout - a.payout).slice(0, 20));
      } catch { /* The next round refresh retries. */ }
    };
    void loadBets();
    return () => { active = false; };
  }, [roundNonce]);

  // Refresh recorded cashout state while the round is live.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/live-bets?roundNonce=${roundNonce}`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) return;
        const rows: Staker[] = result.bets.map((bet: { id: number; player: string; stake: number; multiplier: number; payout: number; status: string; terminalId: number }) => ({
          user: bet.player, stake: bet.stake, targetMultiplier: 0, cashedOut: bet.status === 'WON',
          cashedMultiplier: bet.multiplier, payout: bet.payout, isUser: false, terminalId: bet.terminalId,
          color: bet.status === 'WON' ? '#2ecc71' : bet.status === 'LOST' ? '#e74c3c' : '#57606f', status: bet.status
        }));
        setActiveStakers(rows);
        setTopWins(rows.filter((bet) => bet.cashedOut).map((bet) => ({ user: bet.user, stake: bet.stake, multiplier: bet.cashedMultiplier, payout: bet.payout, time: 'This round' })).sort((a, b) => b.payout - a.payout).slice(0, 20));
      } catch { /* Keep the most recent successful snapshot on temporary network errors. */ }
    }, 1500);
    return () => clearInterval(interval);
  }, [roundNonce]);

  // Add user bets to history on crash
  useEffect(() => {
    if (gameState === 'CRASHED') {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const newHistory: HistoryEntry[] = [];

      if (terminal1Staked) {
        newHistory.push({
          id: 1,
          stake: terminal1Amount,
          cashedOut: terminal1CashedOut,
          multiplier: terminal1CashedOut ? terminal1AutoCashoutMultiplier : currentMultiplier,
          payout: terminal1CashedOut ? terminal1Amount * terminal1AutoCashoutMultiplier : 0,
          profit: terminal1CashedOut ? terminal1Amount * terminal1AutoCashoutMultiplier - terminal1Amount : -terminal1Amount,
          time: now
        });
      }

      if (terminal2Staked) {
        newHistory.push({
          id: 2,
          stake: terminal2Amount,
          cashedOut: terminal2CashedOut,
          multiplier: terminal2CashedOut ? terminal2AutoCashoutMultiplier : currentMultiplier,
          payout: terminal2CashedOut ? terminal2Amount * terminal2AutoCashoutMultiplier : 0,
          profit: terminal2CashedOut ? terminal2Amount * terminal2AutoCashoutMultiplier - terminal2Amount : -terminal2Amount,
          time: now
        });
      }

      if (newHistory.length > 0) {
        setMyHistory(prev => [...newHistory, ...prev].slice(0, 50));
      }
    }
  }, [gameState, terminal1Staked, terminal1Amount, terminal1CashedOut, terminal1AutoCashoutMultiplier, terminal2Staked, terminal2Amount, terminal2CashedOut, terminal2AutoCashoutMultiplier, currentMultiplier]);

  const totalBets = activeStakers.length;
  const totalStaked = activeStakers.reduce((sum, s) => sum + s.stake, 0);
  const totalCashedOut = activeStakers.filter(s => s.cashedOut).length;
  const betsByStake = [...activeStakers].sort((a, b) => b.stake - a.stake);

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
          className={`stakers-tab-btn ${currentTab === 'my' ? 'active' : ''}`}
          onClick={() => setCurrentTab('my')}
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
              {betsByStake.length === 0 ? <div className="empty-state">No recorded bets in this round yet.</div> : betsByStake.map((s, idx) => (
                <div
                  key={idx}
                  className={`staker-row ${s.cashedOut ? 'row-cashed' : s.status === 'LOST' ? 'row-lost' : ''} ${s.isUser ? 'row-user-highlight' : ''}`}
                  style={{ gridTemplateColumns: '1.1fr 1fr 0.8fr 1.1fr' }}
                >
                  <div className="staker-user-cell">
                    <span className="avatar-dot" style={{ background: s.cashedOut ? '#2ecc71' : s.color }}></span>
                    <span className={`staker-name ${s.isUser ? 'font-bold font-crimson' : ''}`}>{s.user}</span>
                  </div>
                  <div className="staker-stake-cell">{s.stake.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  <div style={{ textAlign: 'center' }}>
                    {s.status === 'LOST' ? <span className="font-crimson">LOST</span> : s.cashedOut ? (
                      <span className={`history-pill ${getBadgeClass(s.cashedMultiplier)}`} style={{ padding: '1px 6px', fontSize: '10px', fontWeight: 800 }}>
                        {s.cashedMultiplier.toFixed(2)}x
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>-</span>
                    )}
                  </div>
                  <div className="staker-payout-cell">
                    {s.status === 'LOST' ? <span className="font-crimson">Lost</span> : s.cashedOut ? (
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

        {currentTab === 'my' && (
          <>
            <div className="stakers-table-header" style={{ gridTemplateColumns: '1fr 0.8fr 1fr 1fr' }}>
              <span>TIME</span>
              <span>PANEL</span>
              <span style={{ textAlign: 'right' }}>BET</span>
              <span style={{ textAlign: 'right' }}>WIN / LOSS</span>
            </div>
            <div className="stakers-list-body custom-scroll">
              {myHistory.length === 0 ? (
                <div className="empty-state">No bets placed yet in this session. Place a bet on Panel 1 or 2 (Min KES 200)!</div>
              ) : (
                myHistory.map((h, idx) => (
                  <div
                    key={idx}
                    className={`staker-row ${h.cashedOut ? 'row-cashed' : 'row-lost'}`}
                    style={{ gridTemplateColumns: '1fr 0.8fr 1fr 1fr' }}
                  >
                    <div className="staker-user-cell">
                      <span className="staker-name" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{h.time}</span>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 700 }}>#{h.id}</div>
                    <div className="staker-stake-cell">{h.stake.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    <div className="staker-payout-cell">
                      {h.cashedOut ? (
                        <span className="font-emerald font-bold">
                          +{h.payout.toLocaleString('en-US', { minimumFractionDigits: 2 })} KES ({h.multiplier.toFixed(2)}x)
                        </span>
                      ) : (
                        <span className="font-crimson font-bold">
                          -{h.stake.toLocaleString('en-US', { minimumFractionDigits: 2 })} KES
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {currentTab === 'top' && (
          <>
            <div className="stakers-table-header" style={{ gridTemplateColumns: '1.1fr 0.9fr 0.9fr 1.1fr' }}>
              <span>USER</span>
              <span>TIME</span>
              <span style={{ textAlign: 'center' }}>X</span>
              <span style={{ textAlign: 'right' }}>WIN (KES)</span>
            </div>
            <div className="stakers-list-body custom-scroll">
              {topWins.map((w, idx) => (
                <div
                  key={idx}
                  className="staker-row row-cashed"
                  style={{ gridTemplateColumns: '1.1fr 0.9fr 0.9fr 1.1fr' }}
                >
                  <div className="staker-user-cell">
                    <span className={`rank-badge rank-${idx + 1}`} style={{ fontSize: '9px', fontWeight: 900 }}>{idx + 1}</span>
                    <span className="staker-name">{w.user}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{w.time}</div>
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
