'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AppPageFrame } from '@/components/layout/AppPageFrame';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/contexts/AuthContext';

type Mode = 'REAL' | 'DEMO';
interface LiquidityData {
  mode: Mode;
  pool: { name: string; enabled: boolean; totalValueLocked: number; apyPercent: number; totalStakers: number; volume24h: number };
  position: { principal: number; accruedYield: number };
  transactions: { reference: string; type: string; amount: number; createdAt: number }[];
}
const money = (value: number) => Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LiquidityPage() {
  const { user, token, isAuthenticated, login, signup, updateBalance } = useAuth();
  const [mode, setMode] = useState<Mode>('DEMO');
  const [data, setData] = useState<LiquidityData | null>(null);
  const [amount, setAmount] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const current = localStorage.getItem('shiftstack_game_mode');
    setMode(current === 'REAL' ? 'REAL' : 'DEMO');
    const onMode = (event: Event) => setMode((event as CustomEvent<Mode>).detail);
    window.addEventListener('aviator:game-mode', onMode);
    return () => window.removeEventListener('aviator:game-mode', onMode);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) { setData(null); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/liquidity?mode=${mode}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not load the vault');
      setData(result);
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load the vault' });
    } finally { setLoading(false); }
  }, [token, mode]);

  useEffect(() => { void refresh(); }, [refresh]);

  const submit = async (event: FormEvent<HTMLFormElement>, action: 'stake' | 'unstake' | 'claim') => {
    event.preventDefault();
    if (!token) { setShowAuth(true); return; }
    setBusy(action); setMessage(null);
    try {
      const response = await fetch('/api/liquidity', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, mode, amount: action === 'claim' ? undefined : Number(amount) }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Action could not be completed');
      updateBalance(Number(result.wallet.realBalance), Number(result.wallet.demoBalance));
      setMessage({ tone: 'success', text: `${action === 'stake' ? 'Stake added' : action === 'unstake' ? 'Capital returned' : 'Yield claimed'} · Ref ${result.reference}` });
      await refresh();
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Action could not be completed' });
    } finally { setBusy(''); }
  };

  return <AppPageFrame>
    <section className="app-feature-page">
      <header className="feature-page-hero">
        <span className="feature-eyebrow">SHIFTSTACK POOL</span>
        <h1>Liquidity Vault</h1>
        <p>Manage your capital position, review pool activity, and track claimable yield from one account.</p>
      </header>
      {!isAuthenticated ? <div className="feature-card feature-login-card"><h2>Sign in to view your position</h2><p>Your balance and liquidity activity are tied to your account.</p><button className="feature-primary-button" onClick={() => setShowAuth(true)}>Login / Register</button></div> : <>
        <div className="feature-metric-grid">
          <div className="feature-metric"><span>POOL VALUE</span><strong>{loading ? '—' : `KES ${money(data?.pool.totalValueLocked || 0)}`}</strong></div>
          <div className="feature-metric"><span>ESTIMATED APY</span><strong>{loading ? '—' : `${Number(data?.pool.apyPercent || 0).toFixed(1)}%`}</strong></div>
          <div className="feature-metric"><span>ACTIVE POSITIONS</span><strong>{loading ? '—' : (data?.pool.totalStakers || 0).toLocaleString()}</strong></div>
          <div className="feature-metric"><span>24H BET VOLUME</span><strong>{loading ? '—' : `KES ${money(data?.pool.volume24h || 0)}`}</strong></div>
        </div>
        <div className="feature-columns">
          <section className="feature-card">
            <div className="feature-card-heading"><div><h2>My liquidity position</h2><p>{user?.phone || 'Account'} · {mode === 'REAL' ? 'Real wallet' : 'Play wallet'}</p></div><span className={`feature-status ${data?.pool.enabled ? 'online' : 'paused'}`}>{data?.pool.enabled ? 'OPEN' : 'PAUSED'}</span></div>
            <div className="position-summary"><div><span>Principal</span><strong>KES {money(data?.position.principal || 0)}</strong></div><div><span>Accrued yield</span><strong className="positive-value">KES {money(data?.position.accruedYield || 0)}</strong></div></div>
            {message && <div className={`feature-message ${message.tone}`} role="status">{message.text}</div>}
            <form className="feature-form" onSubmit={(event) => void submit(event, 'stake')}>
              <label>Amount to stake<input type="number" min="100" max="100000" step="100" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
              <button className="feature-primary-button" type="submit" disabled={!!busy || (mode === 'REAL' && !data?.pool.enabled)}>{busy === 'stake' ? 'Processing…' : 'Stake capital'}</button>
            </form>
            <form className="feature-inline-form" onSubmit={(event) => void submit(event, 'unstake')}>
              <label>Amount to return<input type="number" min="100" max="100000" step="100" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
              <button className="feature-secondary-button" type="submit" disabled={!!busy || (mode === 'REAL' && !data?.pool.enabled)}>{busy === 'unstake' ? 'Processing…' : 'Unstake'}</button>
            </form>
            <form onSubmit={(event) => void submit(event, 'claim')}><button className="feature-secondary-button full-width" type="submit" disabled={!!busy || (data?.position.accruedYield || 0) <= 0}>{busy === 'claim' ? 'Processing…' : 'Claim accrued yield'}</button></form>
          </section>
          <section className="feature-card">
            <div className="feature-card-heading"><div><h2>Recent activity</h2><p>Latest position movements</p></div><button className="icon-refresh" type="button" onClick={() => void refresh()} aria-label="Refresh activity">↻</button></div>
            {data?.transactions.length ? <div className="activity-list">{data.transactions.map((item) => <div className="activity-row" key={item.reference}><div><strong>{item.type.replace('_', ' ')}</strong><small>{new Date(item.createdAt).toLocaleString()}</small><code>{item.reference}</code></div><b>KES {money(item.amount)}</b></div>)}</div> : <div className="empty-activity">No liquidity activity recorded yet.</div>}
          </section>
        </div>
        <p className="feature-footnote">Live-wallet deposits and yield actions follow the pool’s configured availability and rate.</p>
      </>}
    </section>
    <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onLogin={login} onSignup={signup} />
  </AppPageFrame>;
}
