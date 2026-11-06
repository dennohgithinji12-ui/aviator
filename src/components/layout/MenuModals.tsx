'use client';

import { useCallback, useEffect, useState } from 'react';

type BetRow = { id: number; mode: string; terminalId: number; amount: number; roundNonce: number; multiplier: number; payout: number; profit: number; status: string; createdAt: number };
type PromoState = { deposit100Claimed: boolean; deposit500Claimed: boolean; successfulDepositAmount: number };
type ModalProps = { kind: 'freebets' | 'history'; token: string | null; onClose: () => void; onLogin: () => void; onBalanceChanged: () => Promise<void> };

const money = (amount: number) => `KES ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function MenuModals({ kind, token, onClose, onLogin, onBalanceChanged }: ModalProps) {
  const [bets, setBets] = useState<BetRow[]>([]);
  const [promo, setPromo] = useState<PromoState | null>(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      if (kind === 'history') {
        const response = await fetch('/api/wallet/bets', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load bet history');
        setBets(result.bets || []);
      } else {
        const response = await fetch('/api/promos/status', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load promotions');
        setPromo({ deposit100Claimed: result.deposit100Claimed, deposit500Claimed: result.deposit500Claimed, successfulDepositAmount: Number(result.successfulDepositAmount || 0) });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this information');
    }
  }, [kind, token]);

  useEffect(() => { void load(); }, [load]);

  const claim = async (tier: 100 | 500) => {
    if (!token) { onLogin(); return; }
    setBusy(String(tier)); setError(''); setMessage('');
    try {
      const response = await fetch('/api/promos/claim-deposit', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || result.error || 'Unable to claim this promotion');
      setMessage(result.message || 'Promotion credited.');
      await Promise.all([onBalanceChanged(), load()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to claim this promotion');
    } finally { setBusy(''); }
  };

  return <div className="menu-tools-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="menu-tools-modal" role="dialog" aria-modal="true" aria-labelledby="menu-tools-title">
      <header><div><span>{kind === 'history' ? 'ACCOUNT ACTIVITY' : 'ACCOUNT OFFERS'}</span><h2 id="menu-tools-title">{kind === 'history' ? 'My bet history' : 'Free bets & promotions'}</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></header>
      {!token ? <div className="menu-tools-empty"><p>Sign in to see your account information.</p><button type="button" onClick={onLogin}>Login / Register</button></div> : kind === 'history' ? <>
        {error && <p className="menu-tools-error" role="alert">{error}</p>}
        {!error && bets.length === 0 && <div className="menu-tools-empty">No recorded bets yet.</div>}
        {!!bets.length && <div className="menu-tools-list">{bets.map((bet) => <article className="menu-tools-bet" key={bet.id}><div><strong>Round #{bet.roundNonce} · Bet {bet.terminalId}</strong><small>{new Date(bet.createdAt).toLocaleString()} · {bet.mode === 'REAL' ? 'Real wallet' : 'Practice wallet'}</small></div><div className="menu-tools-bet-result"><b>{money(bet.amount)}</b><small>{bet.status === 'WON' ? `${bet.multiplier.toFixed(2)}x · ${money(bet.payout)} payout` : bet.status}</small></div></article>)}</div>}
        <button className="menu-tools-secondary" type="button" onClick={() => void load()} disabled={busy !== ''}>Refresh history</button>
      </> : <>
        {error && <p className="menu-tools-error" role="alert">{error}</p>}
        {[{ tier: 100 as const, amount: 50, claimed: promo?.deposit100Claimed }, { tier: 500 as const, amount: 100, claimed: promo?.deposit500Claimed }].map((offer) => {
          const deposits = promo?.successfulDepositAmount || 0;
          const unlocked = deposits >= offer.tier;
          const progress = Math.min(100, (deposits / offer.tier) * 100);
          return <article className="menu-tools-promo" key={offer.tier}><div><span>DEPOSIT REWARD</span><h3>KES {offer.amount} free bet</h3><p>Make successful deposits totaling KES {offer.tier} to unlock this one-time free bet.</p><div className="menu-tools-progress"><i style={{ width: `${progress}%` }} /></div><small>{money(Math.min(deposits, offer.tier))} / {money(offer.tier)} · {offer.claimed ? 'Claimed' : unlocked ? 'Ready to claim' : 'In progress'}</small></div><button type="button" disabled={busy !== '' || !!offer.claimed || !unlocked} onClick={() => void claim(offer.tier)}>{busy === String(offer.tier) ? 'Claiming…' : offer.claimed ? 'Claimed' : unlocked ? `Claim KES ${offer.amount}` : 'Locked'}</button></article>;
        })}
        {message && <p className="menu-tools-success" role="status">{message}</p>}
      </>}
    </section>
  </div>;
}
