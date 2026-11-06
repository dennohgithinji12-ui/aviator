'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminPredictor } from '@/components/admin/AdminPredictor';

type DashboardData = {
  generatedAt: number;
  summary: { users: number; activeUsers24h: number; completedRounds: number; bets: number; stakedKes: number; paidOutKes: number; deposits: number; depositedKes: number; withdrawals: number; withdrawnKes: number; pendingWithdrawals: number };
  daily: { date: string; games: number; bets: number; stakedKes: number; depositedKes: number; payoutsKes: number }[];
  recentBets: { id: number; phone: string; mode: string; terminalId: number; amount: number; roundNonce: number; multiplier: number; payout: number; status: string; createdAt: number }[];
  withdrawalQueue: { id: number; phone: string; targetPhone: string | null; amount: number; taxAmount: number; netAmount: number; reference: string; status: string; riskReason: string | null; createdAt: number }[];
};

const money = (amount: number) => `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function MoneyFlowChart({ daily }: { daily: DashboardData['daily'] }) {
  const width = 900, height = 250, left = 48, right = 18, top = 18, bottom = 36;
  const max = Math.max(1, ...daily.flatMap((day) => [day.stakedKes, day.depositedKes, day.payoutsKes]));
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const x = (index: number) => left + (daily.length <= 1 ? plotWidth / 2 : (index / (daily.length - 1)) * plotWidth);
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight;
  const series = [
    { label: 'Stakes', key: 'stakedKes' as const, color: '#e8b840' },
    { label: 'Deposits', key: 'depositedKes' as const, color: '#38d49a' },
    { label: 'Payouts', key: 'payoutsKes' as const, color: '#8b9cff' }
  ];
  return <section className="admin-chart-card"><div className="admin-chart-heading"><div><h2>Money flow · last 14 days</h2><p>Successful deposits, recorded stakes, and player payouts</p></div><div className="admin-chart-legend">{series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}</div></div>
    <div className="admin-chart-scroll"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily money flow chart">
      {[0, .25, .5, .75, 1].map((fraction) => <g key={fraction}><line x1={left} x2={width - right} y1={top + plotHeight * fraction} y2={top + plotHeight * fraction} stroke="#252a35" /><text x={left - 8} y={top + plotHeight * fraction + 4} textAnchor="end" fill="#8992a2" fontSize="10">{money(max * (1 - fraction)).replace('KES ', '')}</text></g>)}
      {series.map((item) => <polyline key={item.key} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={daily.map((day, index) => `${x(index)},${y(day[item.key])}`).join(' ')} />)}
      {daily.filter((_, index) => index % 2 === 0 || index === daily.length - 1).map((day) => { const index = daily.indexOf(day); return <text key={day.date} x={x(index)} y={height - 10} textAnchor="middle" fill="#8992a2" fontSize="10">{day.date.slice(5)}</text>; })}
    </svg></div>
  </section>;
}

function ActivityBars({ daily }: { daily: DashboardData['daily'] }) {
  const width = 900, height = 220, left = 35, right = 16, top = 14, bottom = 34;
  const max = Math.max(1, ...daily.flatMap((day) => [day.games, day.bets]));
  const plotHeight = height - top - bottom, groupWidth = (width - left - right) / Math.max(1, daily.length);
  return <section className="admin-chart-card"><div className="admin-chart-heading"><div><h2>Game activity · last 14 days</h2><p>Settled rounds and recorded bets</p></div><div className="admin-chart-legend"><span><i style={{ background: '#e8b840' }} />Games</span><span><i style={{ background: '#38d49a' }} />Bets</span></div></div>
    <div className="admin-chart-scroll"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily games and bets chart">
      {[0, .5, 1].map((fraction) => <g key={fraction}><line x1={left} x2={width - right} y1={top + plotHeight * fraction} y2={top + plotHeight * fraction} stroke="#252a35" /><text x={left - 7} y={top + plotHeight * fraction + 4} textAnchor="end" fill="#8992a2" fontSize="10">{Math.round(max * (1 - fraction))}</text></g>)}
      {daily.map((day, index) => { const x = left + index * groupWidth + groupWidth * .18, barWidth = Math.max(2, groupWidth * .28); return <g key={day.date}><rect x={x} y={top + plotHeight - (day.games / max) * plotHeight} width={barWidth} height={(day.games / max) * plotHeight} fill="#e8b840" rx="2"><title>{day.date}: {day.games} games</title></rect><rect x={x + barWidth + 2} y={top + plotHeight - (day.bets / max) * plotHeight} width={barWidth} height={(day.bets / max) * plotHeight} fill="#38d49a" rx="2"><title>{day.date}: {day.bets} bets</title></rect>{(index % 2 === 0 || index === daily.length - 1) && <text x={left + index * groupWidth + groupWidth / 2} y={height - 10} textAnchor="middle" fill="#8992a2" fontSize="10">{day.date.slice(5)}</text>}</g>; })}
    </svg></div>
  </section>;
}

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [adminName, setAdminName] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'predictor'>('overview');
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
        <nav className="admin-tabs" aria-label="Admin sections"><button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Overview</button><button className={activeTab === 'predictor' ? 'active' : ''} onClick={() => setActiveTab('predictor')}>Predictor</button><span>Updated {new Date(data.generatedAt).toLocaleTimeString()}</span></nav>
        {activeTab === 'overview' ? <>
        <section className="admin-metrics">
          {[
            ['Registered users', data.summary.users.toLocaleString()], ['Active users · 24h', data.summary.activeUsers24h.toLocaleString()], ['Games played', data.summary.completedRounds.toLocaleString()],
            ['Bets placed', data.summary.bets.toLocaleString()], ['Total stakes', money(data.summary.stakedKes)], ['Total payouts', money(data.summary.paidOutKes)],
            ['Successful deposits', `${data.summary.deposits.toLocaleString()} · ${money(data.summary.depositedKes)}`], ['Paid withdrawals', `${data.summary.withdrawals.toLocaleString()} · ${money(data.summary.withdrawnKes)}`], ['Pending withdrawals', data.summary.pendingWithdrawals.toLocaleString()]
          ].map(([label, value]) => <article className="admin-metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}
        </section>
        <MoneyFlowChart daily={data.daily} /><ActivityBars daily={data.daily} />
        <section className="admin-table-card"><div className="admin-table-title"><div><h2>Recent bets</h2><p>Phone numbers are masked. Refresh to fetch the latest records.</p></div></div>
          <div className="admin-table-scroll"><table><thead><tr><th>Player</th><th>Mode</th><th>Round</th><th>Stake</th><th>Result</th><th>Payout</th><th>Status</th></tr></thead><tbody>
            {data.recentBets.map((bet) => <tr key={bet.id}><td>{bet.phone}</td><td>{bet.mode}</td><td>#{bet.roundNonce}</td><td>{money(bet.amount)}</td><td>{bet.multiplier ? `${bet.multiplier.toFixed(2)}x` : '—'}</td><td>{money(bet.payout)}</td><td><span className={`admin-status status-${bet.status.toLowerCase()}`}>{bet.status}</span></td></tr>)}
            {!data.recentBets.length && <tr><td colSpan={7} className="admin-empty">No bets recorded yet.</td></tr>}
          </tbody></table></div>
        </section>
        </> : <AdminPredictor token={token} />}
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
        <Link className="admin-testing-link" href="/admin/predictor">Open dedicated predictor page ↗</Link>
        <button className="admin-logout" onClick={() => { sessionStorage.removeItem('aviator_admin_session'); setToken(''); setAdminName(''); setData(null); }}>Lock dashboard</button>
      </>}
    </main>
  );
}
