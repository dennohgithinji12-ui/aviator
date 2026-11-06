'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AppPageFrame } from '@/components/layout/AppPageFrame';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/contexts/AuthContext';

type Mode = 'REAL' | 'DEMO';
interface Stage { stageNumber: number; roundNonce: number | null; stake: number; targetMultiplier: number; resultMultiplier: number | null; payout: number; status: string }
interface Challenge { id: string; reference: string; mode: Mode; baseStake: number; targetMultiplier: number; totalStages: number; currentStage: number; currentStake: number; accumulatedProfit: number; status: string; stages: Stage[] }
interface PageData { active: Challenge | null; history: Challenge[] }
const money = (value: number) => Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RolloverPage() {
  const { token, isAuthenticated, login, signup, refreshBalance, updateBalance } = useAuth();
  const [mode, setMode] = useState<Mode>('DEMO');
  const [pageData, setPageData] = useState<PageData>({ active: null, history: [] });
  const [baseStake, setBaseStake] = useState('500');
  const [targetMultiplier, setTargetMultiplier] = useState('1.25');
  const [totalStages, setTotalStages] = useState('5');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const syncInFlight = useRef(false);
  const active = pageData.active;

  useEffect(() => {
    const saved = localStorage.getItem('shiftstack_game_mode');
    setMode(saved === 'REAL' ? 'REAL' : 'DEMO');
    const listener = (event: Event) => setMode((event as CustomEvent<Mode>).detail);
    window.addEventListener('aviator:game-mode', listener);
    return () => window.removeEventListener('aviator:game-mode', listener);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    const response = await fetch('/api/rollover', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load rollover strategies');
    setPageData({ active: result.active, history: result.history || [] });
  }, [token]);

  useEffect(() => { if (token) void load().catch((error) => setMessage({ tone: 'error', text: error.message })); }, [token, load]);

  useEffect(() => {
    if (!token || !active) return;
    const sync = async () => {
      if (syncInFlight.current) return;
      syncInFlight.current = true;
      try {
        const response = await fetch('/api/rollover', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'sync' }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to update current stage');
        setPageData({ active: result.active, history: result.history || [] });
        if (!result.active) await refreshBalance();
      } catch (error) { setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to update current stage' }); }
      finally { syncInFlight.current = false; }
    };
    void sync();
    const timer = setInterval(() => void sync(), 900);
    return () => clearInterval(timer);
  }, [token, active?.id, refreshBalance]);

  const start = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) { setShowAuth(true); return; }
    setBusy(true); setMessage(null);
    try {
      const response = await fetch('/api/rollover', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'start', mode, baseStake: Number(baseStake), targetMultiplier: Number(targetMultiplier), totalStages: Number(totalStages) }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not launch strategy');
      setPageData((current) => ({ ...current, active: result.active }));
      setMessage({ tone: 'success', text: `Strategy ${result.active.reference} launched.` });
      await refreshBalance();
    } catch (error) { setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not launch strategy' }); }
    finally { setBusy(false); }
  };

  const stop = async () => {
    if (!active || !token) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch('/api/rollover', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'stop', challengeId: active.id }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not stop strategy');
      updateBalance(Number(result.realBalance), Number(result.demoBalance));
      setPageData((current) => ({ active: null, history: current.history }));
      setMessage({ tone: 'success', text: result.message });
      await load();
    } catch (error) { setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not stop strategy' }); }
    finally { setBusy(false); }
  };

  const projected = Array.from({ length: Number(totalStages) || 0 }, (_, index) => ({ stageNumber: index + 1, stake: Number(baseStake) * Number(targetMultiplier) ** index, targetMultiplier: Number(targetMultiplier) }));
  const stages = active ? active.stages : projected.map((stage) => ({ ...stage, status: 'PROJECTED', roundNonce: null, resultMultiplier: null, payout: stage.stake * stage.targetMultiplier }));

  return <AppPageFrame>
    <section className="app-feature-page">
      <header className="feature-page-hero rollover-hero">
        <span className="feature-eyebrow">AUTOMATED STRATEGY</span>
        <h1>Compounding Rollover</h1>
        <p>Set a starting stake, stage target, and progression length. Each cleared stage carries its full return into the next eligible round.</p>
        {active && <div className="rollover-live-banner"><span className="status-pulse" /> Strategy {active.reference} · Stage {active.currentStage} of {active.totalStages} · Target {active.targetMultiplier.toFixed(2)}x</div>}
      </header>
      <div className="feature-columns rollover-columns">
        <section className="feature-card">
          <div className="feature-card-heading"><div><h2>Strategy settings</h2><p>Selected wallet: {mode === 'REAL' ? 'Real' : 'Play'} · KES</p></div><span className={`feature-status ${active ? 'online' : 'paused'}`}>{active ? 'ACTIVE' : 'READY'}</span></div>
          <form className="feature-form" onSubmit={(event) => void start(event)}>
            <label>Starting stake<input type="number" min="100" max="25000" step="50" value={baseStake} onChange={(event) => setBaseStake(event.target.value)} disabled={!!active} /></label>
            <label>Target multiplier<input type="number" min="1.1" max="5" step="0.05" value={targetMultiplier} onChange={(event) => setTargetMultiplier(event.target.value)} disabled={!!active} /></label>
            <label>Number of stages<select value={totalStages} onChange={(event) => setTotalStages(event.target.value)} disabled={!!active}>{Array.from({ length: 9 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count} stages</option>)}</select></label>
            {message && <div className={`feature-message ${message.tone}`} role="status">{message.text}</div>}
            {!isAuthenticated ? <button className="feature-primary-button" type="button" onClick={() => setShowAuth(true)}>Login / Register</button> : active
              ? <button className="feature-stop-button" type="button" onClick={() => void stop()} disabled={busy}>{busy ? 'Processing…' : 'Stop and return open capital'}</button>
              : <button className="feature-primary-button" type="submit" disabled={busy}>{busy ? 'Launching…' : 'Launch strategy'}</button>}
            {active && <p className="feature-footnote">The open stage stake is held in your selected wallet strategy. Stopping returns its remaining value.</p>}
          </form>
        </section>
        <section className="feature-card">
          <div className="feature-card-heading"><div><h2>Stage ladder</h2><p>{active ? `Current stake KES ${money(active.currentStake)}` : 'Projected progression'}</p></div><span className="feature-status online">AUTO COMPOUND</span></div>
          <div className="rollover-ladder">{stages.map((stage) => <article className={`rollover-stage ${stage.status.toLowerCase()}`} key={stage.stageNumber}>
            <div className="rollover-stage-number">{String(stage.stageNumber).padStart(2, '0')}</div>
            <div className="rollover-stage-main"><strong>Stage {stage.stageNumber}</strong><small>{stage.status === 'ACTIVE' ? `Round ${stage.roundNonce ?? '—'} · in progress` : stage.status === 'WON' ? `${Number(stage.resultMultiplier).toFixed(2)}x reached` : stage.status === 'BUSTED' ? `${Number(stage.resultMultiplier).toFixed(2)}x ended` : stage.status === 'PENDING' ? 'Waiting for next round' : stage.status}</small></div>
            <div className="rollover-stage-amount"><span>Stake</span><b>KES {money(stage.stake)}</b><small>Target {stage.targetMultiplier.toFixed(2)}x</small></div>
          </article>)}</div>
        </section>
      </div>
      {!!pageData.history.length && <section className="feature-card rollover-history"><div className="feature-card-heading"><div><h2>Completed strategies</h2><p>Reference-backed account history</p></div></div><div className="activity-list">{pageData.history.map((item) => <div className="activity-row" key={item.id}><div><strong>{item.status} · {item.reference}</strong><small>{item.totalStages} stages · target {item.targetMultiplier.toFixed(2)}x</small></div><b>KES {money(item.accumulatedProfit)} profit</b></div>)}</div></section>}
    </section>
    <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onLogin={login} onSignup={signup} />
  </AppPageFrame>;
}
