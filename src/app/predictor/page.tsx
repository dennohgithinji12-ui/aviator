'use client';

import { useEffect, useState } from 'react';

type PredictorState = {
  round: { nonce: number; phase: 'WAITING' | 'FLYING' | 'CRASHED'; currentMultiplier: number; remainingSeconds: number; crashMultiplier: number | null; commitment: string; revealedSeed: string | null };
  forecast: null;
  message: string;
};

export default function PredictorPage() {
  const [state, setState] = useState<PredictorState | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/predictor', { cache: 'no-store' });
        const result = await response.json();
        if (active && response.ok) setState(result);
      } catch { /* The next poll retries when the connection returns. */ }
    };
    void refresh();
    const timer = setInterval(refresh, 500);
    return () => { active = false; clearInterval(timer); };
  }, []);

  return <main className="predictor-shell">
    <a href="/" className="predictor-back">← Return to game</a>
    <section className="predictor-card">
      <span className="admin-eyebrow">ROUND MONITOR</span>
      <h1>Live round monitor</h1>
      <p className="predictor-disclaimer">{state?.message || 'Loading current round…'}</p>
      {state && <div className="predictor-readout">
        <div><span>Round</span><strong>#{state.round.nonce}</strong></div>
        <div><span>Phase</span><strong>{state.round.phase}</strong></div>
        <div><span>Current multiplier</span><strong>{state.round.currentMultiplier.toFixed(2)}x</strong></div>
        {state.round.phase === 'WAITING' && <div><span>Takeoff in</span><strong>{state.round.remainingSeconds.toFixed(1)}s</strong></div>}
        {state.round.phase === 'CRASHED' && <div><span>Round ended at</span><strong>{state.round.crashMultiplier?.toFixed(2)}x</strong></div>}
      </div>}
      {state?.round.commitment && <details className="predictor-proof"><summary>Round commitment{state.round.revealedSeed ? ' and revealed seed' : ''}</summary><span>Commitment</span><code>{state.round.commitment}</code>{state.round.revealedSeed && <><span>Revealed round seed</span><code>{state.round.revealedSeed}</code></>}</details>}
      <p className="predictor-note">The former APK showed the server’s unrevealed crash value as a “100% prediction.” This Next.js monitor only shows public round data and reveals the outcome after the round ends.</p>
    </section>
  </main>;
}
