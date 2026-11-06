'use client';

import { useEffect, useState } from 'react';

interface RoundHistoryItem { nonce: number; multiplier: number; commitment: string; serverSeed: string | null; clientSeed: string; timestamp: number }

export function RoundHistoryRibbon() {
  const [rounds, setRounds] = useState<RoundHistoryItem[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/round-history');
        const result = await response.json();
        if (active && response.ok && result.success) setRounds(result.rounds);
      } catch { /* Retain the last saved history while offline. */ }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  return <div className="history-scroll-container" aria-label="Recent completed round multipliers">
    {rounds.map((round) => {
      const tier = round.multiplier >= 10 ? 'badge-legendary' : round.multiplier >= 2 ? 'badge-high' : 'badge-low';
      return <span key={round.nonce} className={`history-pill ${tier}`} title={`Round #${round.nonce} • ${new Date(round.timestamp).toLocaleString()} • Commitment ${round.commitment}`}>
        {round.multiplier.toFixed(2)}x
      </span>;
    })}
    {rounds.length === 0 && <span className="round-history-empty">Completed round history will appear here.</span>}
  </div>;
}
