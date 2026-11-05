'use client';

import { useCallback, useEffect, useState } from 'react';

type DashboardData = {
  generatedAt: number;
  summary: { users: number; bets: number; stakedKes: number; paidOutKes: number; deposits: number; depositedKes: number; withdrawals: number; withdrawnKes: number };
  recentBets: { id: number; phone: string; mode: string; terminalId: number; amount: number; roundNonce: number; multiplier: number; payout: number; status: string; createdAt: number }[];
};

const money = (amount: number) => `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminPage() {
  const [key, setKey] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (adminKey: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${adminKey}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load admin data');
      setData(result);
      sessionStorage.setItem('aviator_admin_key', adminKey);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Unable to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('aviator_admin_key');
    if (saved) {
      setKey(saved);
      void load(saved);
    }
  }, [load]);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><span className="admin-eyebrow">SHIFTSTACK / OPERATIONS</span><h1>Admin dashboard</h1><p>Live overview of users, wallet flows, and recorded bets.</p></div>
        {data && <button className="admin-refresh" onClick={() => void load(key)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh data'}</button>}
      </header>

      {!data ? (
        <form className="admin-access-card" onSubmit={(event) => { event.preventDefault(); void load(key); }}>
          <h2>Administrator access</h2><p>Enter the server admin key to view operational data.</p>
          <label htmlFor="admin-key">Admin key</label><input id="admin-key" type="password" autoComplete="current-password" value={key} onChange={(event) => setKey(event.target.value)} required />
          <button type="submit" disabled={loading || !key}>{loading ? 'Checking…' : 'Open dashboard'}</button>
          {error && <div className="admin-error" role="alert">{error}</div>}
        </form>
      ) : <>
        <section className="admin-metrics">
          {[
            ['Users', data.summary.users.toLocaleString()], ['Bets recorded', data.summary.bets.toLocaleString()], ['Total stakes', money(data.summary.stakedKes)],
            ['Payouts recorded', money(data.summary.paidOutKes)], ['Successful deposits', `${data.summary.deposits} · ${money(data.summary.depositedKes)}`],
            ['Withdrawals', `${data.summary.withdrawals} · ${money(data.summary.withdrawnKes)}`]
          ].map(([label, value]) => <article className="admin-metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}
        </section>
        <section className="admin-table-card"><div className="admin-table-title"><div><h2>Recent bets</h2><p>Phone numbers are masked. Refresh to fetch the latest records.</p></div><span>Updated {new Date(data.generatedAt).toLocaleTimeString()}</span></div>
          <div className="admin-table-scroll"><table><thead><tr><th>Player</th><th>Mode</th><th>Round</th><th>Stake</th><th>Result</th><th>Payout</th><th>Status</th></tr></thead><tbody>
            {data.recentBets.map((bet) => <tr key={bet.id}><td>{bet.phone}</td><td>{bet.mode}</td><td>#{bet.roundNonce}</td><td>{money(bet.amount)}</td><td>{bet.multiplier ? `${bet.multiplier.toFixed(2)}x` : '—'}</td><td>{money(bet.payout)}</td><td><span className={`admin-status status-${bet.status.toLowerCase()}`}>{bet.status}</span></td></tr>)}
            {!data.recentBets.length && <tr><td colSpan={7} className="admin-empty">No bets recorded yet.</td></tr>}
          </tbody></table></div>
        </section>
        <button className="admin-logout" onClick={() => { sessionStorage.removeItem('aviator_admin_key'); setKey(''); setData(null); }}>Lock dashboard</button>
      </>}
    </main>
  );
}
