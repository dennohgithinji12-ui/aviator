'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminPayHeroSettings } from '@/components/admin/AdminPayHeroSettings';

export default function AdminPaymentsPage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(sessionStorage.getItem('aviator_admin_session') || '');
  }, []);

  return <main className="admin-shell">
    <header className="admin-header">
      <div><span className="admin-eyebrow">SHIFTSTACK / OPERATIONS</span><h1>Payment settings</h1><p>Manage PayHero deposits and payouts.</p></div>
      <Link className="admin-refresh" href="/admin">Back to dashboard</Link>
    </header>
    {token === null ? <p>Loading payment settings…</p> : token ? <AdminPayHeroSettings token={token} /> : <section className="admin-access-card"><h2>Administrator sign in required</h2><p>Open the admin dashboard and sign in to manage payment settings.</p><Link href="/admin">Go to admin sign in</Link></section>}
  </main>;
}
