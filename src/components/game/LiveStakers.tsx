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
  const [topWins, setTopWins] = useState<TopWin[]>([
    { user: 's***8', stake: 10000, multiplier: 84.50, payout: 845000, time: '3m ago' },
    { user: 'k***2', stake: 5000, multiplier: 42.10, payout: 210500, time: '7m ago' },
    { user: 'w***7', stake: 8000, multiplier: 24.80, payout: 198400, time: '11m ago' },
    { user: 'o***9', stake: 2500, multiplier: 33.40, payout: 83500, time: '18m ago' },
    { user: 'a***5', stake: 3000, multiplier: 21.05, payout: 63150, time: '26m ago' },
    { user: 'm***4', stake: 15000, multiplier: 18.20, payout: 273000, time: '34m ago' },
    { user: 'j***1', stake: 2000, multiplier: 67.80, payout: 135600, time: '41m ago' },
    { user: 'b***6', stake: 6000, multiplier: 16.40, payout: 98400, time: '52m ago' }
  ]);

  const simulatedNames = [
    'b***3', 'w***1', 'k***8', 'a***9', 'o***4',
    'd***2', 'f***7', 'm***0', 'j***5', 'v***1',
    'n***6', 'h***2', 'g***8', 'c***4', 'p***9',
    'e***1', 'r***5', 't***8', 'l***2', 's***6',
    'z***3', 'y***7', 'x***4', 'u***9', 'i***2',
    'q***5', 'k***4', 'm***9', 'j***7', 'b***8',
    'o***2', 'w***5', 'd***9', 'f***3', 's***1',
    'a***4', 'c***7', 'p***2', 'v***6', 't***1',
    'r***8', 'e***4', 'l***9', 'g***3', 'n***5',
    'h***8', 'z***7', 'y***2', 'x***8', 'u***3'
  ];

  const avatarColors = [
    '#e74c3c', '#3498db', '#9b59b6', '#1abc9c',
    '#f39c12', '#2ecc71', '#e67e22', '#16a085',
    '#2980b9', '#8e44ad', '#d35400', '#27ae60'
  ];

  const lastRoundNonce = useRef<number | null>(null);

  const getBadgeClass = (multiplier: number): string => {
    if (multiplier >= 10.0) return 'badge-legendary';
    if (multiplier >= 2.0) return 'badge-high';
    return 'badge-low';
  };

  // Generate simulated stakers for each round
  useEffect(() => {
    if (roundNonce !== lastRoundNonce.current) {
      lastRoundNonce.current = roundNonce;
      generateRoundStakers();
    }
  }, [roundNonce]);

  // Simulate cashouts during flight
  useEffect(() => {
    if (gameState === 'FLYING') {
      const interval = setInterval(() => {
        setActiveStakers(prev => {
          const updated = prev.map(staker => {
            if (!staker.cashedOut && currentMultiplier >= staker.targetMultiplier) {
              const cashedMultiplier = staker.targetMultiplier;
              const payout = Math.floor(staker.stake * cashedMultiplier * 100) / 100;

              if (cashedMultiplier >= 15.0 && !staker.isUser) {
                setTopWins(prevTop => {
                  const newWin = {
                    user: staker.user,
                    stake: staker.stake,
                    multiplier: cashedMultiplier,
                    payout,
                    time: 'Just now'
                  };
                  return [newWin, ...prevTop].slice(0, 20);
                });
              }

              return { ...staker, cashedOut: true, cashedMultiplier, payout };
            }
            return staker;
          });
          return updated;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [currentMultiplier, gameState]);

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

  const generateRoundStakers = () => {
    const stakers: Staker[] = [];
    const count = 75 + Math.floor(Math.random() * 21);
    const stakes = [200, 300, 400, 500, 750, 1000, 1500, 2000, 3500, 5000, 10000, 25000, 50000];

    // Add user bets
    if (terminal1Staked) {
      stakers.push({
        user: 'YOU (#1)',
        stake: terminal1Amount,
        targetMultiplier: terminal1AutoCashoutMultiplier || 999.0,
        cashedOut: terminal1CashedOut,
        cashedMultiplier: terminal1CashedOut ? terminal1AutoCashoutMultiplier : 0,
        payout: terminal1CashedOut ? terminal1Amount * terminal1AutoCashoutMultiplier : 0,
        isUser: true,
        terminalId: 1,
        color: '#ff003b'
      });
    }

    if (terminal2Staked) {
      stakers.push({
        user: 'YOU (#2)',
        stake: terminal2Amount,
        targetMultiplier: terminal2AutoCashoutMultiplier || 999.0,
        cashedOut: terminal2CashedOut,
        cashedMultiplier: terminal2CashedOut ? terminal2AutoCashoutMultiplier : 0,
        payout: terminal2CashedOut ? terminal2Amount * terminal2AutoCashoutMultiplier : 0,
        isUser: true,
        terminalId: 2,
        color: '#ff003b'
      });
    }

    // Add simulated stakers
    for (let i = 0; i < count; i++) {
      const name = simulatedNames[Math.floor(Math.random() * simulatedNames.length)];
      let stake;
      const r = Math.random();
      if (r < 0.45) stake = stakes[Math.floor(Math.random() * 3)];
      else if (r < 0.80) stake = stakes[3 + Math.floor(Math.random() * 4)];
      else if (r < 0.95) stake = stakes[7 + Math.floor(Math.random() * 3)];
      else stake = stakes[10 + Math.floor(Math.random() * 3)];

      let target;
      const targetRoll = Math.random();
      if (targetRoll < 0.50) {
        target = 1.15 + Math.random() * 1.05;
      } else if (targetRoll < 0.80) {
        target = 2.21 + Math.random() * 2.80;
      } else if (targetRoll < 0.94) {
        target = 5.02 + Math.random() * 9.50;
      } else {
        target = 15.0 + Math.random() * 55.0;
      }

      const color = avatarColors[i % avatarColors.length];

      stakers.push({
        user: name,
        stake,
        targetMultiplier: Math.round(target * 100) / 100,
        cashedOut: false,
        cashedMultiplier: 0,
        payout: 0,
        isUser: false,
        color
      });
    }

    setActiveStakers(stakers);
  };

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
              {betsByStake.map((s, idx) => (
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
