import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getSiteStats() {
  const base = process.env.BACKEND_URL || 'http://localhost:3000';
  try {
    const response = await fetch(`${base}/api/database/stats`, { cache: 'no-store' });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export default async function AdminPage() {
  const stats = await getSiteStats();
  const users = stats?.totalUsers ?? 0;
  const deposits = stats?.successfulDepositsCount ?? 0;
  const withdrawals = stats?.withdrawalsCount ?? 0;
  return (
    <main className="admin-page">
      <div className="admin-wrap">
        <header className="admin-header">
          <div>
            <h1>Site control</h1>
            <p>Admin subdomain · payments, wallet, and site health overview</p>
          </div>
          <Link className="balance" href="/">Open player site</Link>
        </header>
        <section className="admin-grid" aria-label="Site metrics">
          <article className="admin-card"><span>Registered users</span><strong>{users}</strong></article>
          <article className="admin-card"><span>Payment rail</span><strong>Mobile money</strong></article>
          <article className="admin-card"><span>Deposits</span><strong>{deposits}</strong></article>
          <article className="admin-card"><span>Withdrawals</span><strong>{withdrawals}</strong></article>
        </section>
        <section className="admin-card admin-table">
          <h2>Sites and services</h2>
          <div className="row"><strong>Player site</strong><span>aviator.shiftstack.com</span><span className="warning">Next.js</span><span>Online</span></div>
          <div className="row"><strong>Admin site</strong><span>admin.shiftstack.com</span><span>Restricted</span><span>Online</span></div>
          <div className="row"><strong>Payment service</strong><span>Mobile money</span><span>Prompts + callbacks</span><span>Connected via backend</span></div>
          <div className="row"><strong>User creation</strong><span>Idempotent</span><span>One account per phone</span><span>Database enforced</span></div>
          <div className="row"><strong>Staking volume</strong><span>KES {Number(stats?.totalStakingVolumeKes || 0).toLocaleString('en-KE')}</span><span>{stats?.totalBetsPlaced ?? 0} bets</span><span>Live database</span></div>
        </section>
      </div>
    </main>
  );
}
