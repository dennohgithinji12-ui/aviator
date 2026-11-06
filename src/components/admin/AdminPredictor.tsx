'use client';

import { useEffect, useState } from 'react';

type PredictorData = {
  generatedAt: number;
  oddsPrecision: 2;
  source: 'game-engine-schedule';
  current: { nonce: number; phase: 'WAITING' | 'FLYING' | 'CRASHED'; currentMultiplier: number; scheduledMultiplier: number; remainingSeconds: number; roundStartTime: number; flightDuration: number };
  upcoming: { nonce: number; crashMultiplier: number; roundStartTime: number; roundEndTime: number; flightDuration: number }[];
};

const money = (amount: number) => `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AdminPredictor({ token }: { token: string }) {
  const [data, setData] = useState<PredictorData | null>(null);
  const [stakeInput, setStakeInput] = useState('1000');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch('/api/admin/predictor/rounds', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to read upcoming rounds');
        if (active) { setData(result); setError(''); }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to read upcoming rounds');
      } finally { inFlight = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => { active = false; clearInterval(timer); };
  }, [token]);

  const parsedStake = Number(stakeInput);
  const stake = Number.isFinite(parsedStake) && parsedStake > 0 ? parsedStake : 0;

  return <section className="admin-predictor-panel">
    <div className="admin-predictor-heading"><div><span className="admin-eyebrow">DETERMINISTIC GAME SCHEDULE</span><h2>Current and upcoming rounds</h2><p>Odds are calculated by the same server-side outcome function the game uses.</p></div>
      <label>Example stake (KES)<input type="number" min="1" max="1000000" step="1" value={stakeInput} onChange={(event) => setStakeInput(event.target.value)} /></label>
    </div>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {data?.current && (() => { const scheduledOdds = data.current.scheduledMultiplier.toFixed(2); const estimatedReturn = Math.floor(stake * Number(scheduledOdds) * 100) / 100; return <section className="admin-predictor-current"><div className="admin-predictor-current-title"><div><span>CURRENT ROUND</span><h3>#{data.current.nonce}</h3></div><b>{data.current.phase}{data.current.phase === 'WAITING' ? ` · ${data.current.remainingSeconds.toFixed(1)}s to takeoff` : ''}</b></div><div className="admin-predictor-current-metrics"><div><span>Live multiplier</span><strong>{data.current.currentMultiplier.toFixed(2)}x</strong></div><div><span>Scheduled outcome odds</span><strong>{scheduledOdds}x</strong></div><div><span>Estimated return at outcome odds</span><strong>{money(estimatedReturn)}</strong></div></div></section>; })()}
    <h3 className="admin-predictor-next-heading">Next round and the three after</h3>
    <div className="admin-predictor-table-wrap"><table className="admin-predictor-table"><thead><tr><th>Round</th><th>Scheduled start</th><th>Odds</th><th>Example stake</th><th>Estimated return</th><th>Estimated profit</th></tr></thead><tbody>
      {data?.upcoming.map((round) => {
        const odds = round.crashMultiplier.toFixed(2);
        const estimatedReturn = Math.floor(stake * Number(odds) * 100) / 100;
        return <tr key={round.nonce}><td>#{round.nonce}</td><td>{new Date(round.roundStartTime).toLocaleTimeString()}</td><td><strong className="admin-predictor-odds">{odds}x</strong></td><td>{money(stake)}</td><td>{money(estimatedReturn)}</td><td>{money(Math.max(0, estimatedReturn - stake))}</td></tr>;
      })}
      {!data?.upcoming.length && !error && <tr><td colSpan={6} className="admin-empty">Loading the next scheduled rounds…</td></tr>}
    </tbody></table></div>
    <p className="admin-predictor-note">The current round stays visible as it moves out of the upcoming list. The four following rounds use scheduled engine outcomes, rounded to two decimal places. Returns use the game’s cent rounding rule; they are estimates, not placed bets or guaranteed cashouts.</p>
    {data && <small className="admin-predictor-updated">Schedule refreshed {new Date(data.generatedAt).toLocaleTimeString()}</small>}
  </section>;
}
