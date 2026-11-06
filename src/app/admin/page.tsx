'use client';

import { useCallback, useEffect, useState } from 'react';

type DashboardData = {
  generatedAt: number;
  summary: { users: number; bets: number; stakedKes: number; paidOutKes: number; deposits: number; depositedKes: number; withdrawals: number; withdrawnKes: number };
  recentBets: { id: number; phone: string; mode: string; terminalId: number; amount: number; roundNonce: number; multiplier: number; payout: number; status: string; createdAt: number }[];
  withdrawalQueue: { id: number; phone: string; targetPhone: string | null; amount: number; taxAmount: number; netAmount: number; reference: string; status: string; riskReason: string | null; createdAt: number }[];
};

const money = (amount: number) => `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [adminName, setAdminName] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (sessionToken: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${sessionToken}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load admin data');
      setData(result);
      sessionStorage.setItem('aviator_admin_session', sessionToken);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Unable to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Admin login failed');
      setToken(result.token);
      setAdminName(result.admin.name);
      setPassword('');
      sessionStorage.setItem('aviator_admin_session', result.token);
      await load(result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  const decideWithdrawal = async (id: number, decision: 'approve' | 'reject') => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/withdrawals/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, decision })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to update withdrawal');
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update withdrawal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('aviator_admin_session');
    if (saved) {
      setToken(saved);
      void load(saved);
    }
  }, [load]);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><span className="admin-eyebrow">SHIFTSTACK / OPERATIONS</span><h1>Admin dashboard</h1><p>Live overview of users, wallet flows, and recorded bets{adminName ? ` · ${adminName}` : ''}.</p></div>
        {data && <button className="admin-refresh" onClick={() => void load(token)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh data'}</button>}
      </header>

      {!data ? (
        <form className="admin-access-card" onSubmit={login}>
          <h2>Administrator sign in</h2><p>Use the admin account configured for this deployment.</p>
          <label htmlFor="admin-email">Email</label><input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <button type="submit" disabled={loading || !email || !password}>{loading ? 'Checking…' : 'Open dashboard'}</button>
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
        <section className="admin-table-card"><div className="admin-table-title"><div><h2>Withdrawal queue</h2><p>Review held requests. Approved withdrawals are sent through the protected PayHero payout scheduler.</p></div></div>
          <div className="admin-table-scroll"><table><thead><tr><th>Player</th><th>Destination</th><th>Gross</th><th>Tax</th><th>Net</th><th>Reference / status</th><th>Action</th></tr></thead><tbody>
            {data.withdrawalQueue.map((withdrawal) => {
              const held = withdrawal.status.startsWith('MANUAL_HOLD_');
              return <tr key={withdrawal.id}><td>{withdrawal.phone}</td><td>{withdrawal.targetPhone || withdrawal.phone}</td><td>{money(withdrawal.amount)}</td><td>{money(withdrawal.taxAmount)}</td><td>{money(withdrawal.netAmount)}</td><td><code>{withdrawal.reference}</code><br /><span className={`admin-status status-${withdrawal.status.toLowerCase()}`}>{withdrawal.status}</span>{withdrawal.riskReason && <small>{withdrawal.riskReason}</small>}</td><td>{held ? <div className="admin-actions"><button disabled={loading} onClick={() => void decideWithdrawal(withdrawal.id, 'approve')}>Approve</button><button disabled={loading} onClick={() => void decideWithdrawal(withdrawal.id, 'reject')}>Reject / refund</button></div> : '—'}</td></tr>;
            })}
            {!data.withdrawalQueue.length && <tr><td colSpan={7} className="admin-empty">No withdrawals awaiting settlement.</td></tr>}
          </tbody></table></div>
        </section>
        {error && <div className="admin-error" role="alert">{error}</div>}
        <button className="admin-logout" onClick={() => { sessionStorage.removeItem('aviator_admin_session'); setToken(''); setAdminName(''); setData(null); }}>Lock dashboard</button>
      </>}
    </main>
  );
}
