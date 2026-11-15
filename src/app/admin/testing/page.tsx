'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminPredictor } from '@/components/admin/AdminPredictor';

export default function AdminTestingPage() {
  const [token, setToken] = useState('');
  useEffect(() => setToken(sessionStorage.getItem('aviator_admin_session') || ''), []);
  return <main className="admin-shell">
    <header className="admin-header"><div><span className="admin-eyebrow">SHIFTSTACK / PREDICTOR</span><h1>Round predictor</h1><p>Next four scheduled rounds, their engine outcomes, and estimated returns.</p></div><Link className="admin-refresh" href="/admin">Back to admin dashboard</Link></header>
    {token ? <AdminPredictor token={token} /> : <section className="admin-testing-locked"><h2>Admin sign-in required</h2><p>Sign in to the admin dashboard first, then reopen this predictor page.</p><Link href="/admin">Go to admin sign in</Link></section>}
  </main>;
}
