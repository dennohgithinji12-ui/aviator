'use client';

import { useEffect, useState } from 'react';

type ModuleKey = 'home' | 'sports' | 'casino' | 'aviator' | 'me';
type Modules = Record<ModuleKey, boolean>;
const defaults: Modules = { home: true, sports: true, casino: true, aviator: true, me: true };
const labels: { key: ModuleKey; title: string; description: string }[] = [
  { key: 'home', title: 'Home', description: 'Lobby and featured sections' },
  { key: 'sports', title: 'Sports', description: 'Sportsbook fixtures and launch page' },
  { key: 'casino', title: 'Casino', description: 'Casino games lobby' },
  { key: 'aviator', title: 'Aviator', description: 'Aviator game page' },
  { key: 'me', title: 'Me', description: 'Player profile and wallet page' }
];

export function AdminModuleSettings({ token }: { token: string }) {
  const [modules, setModules] = useState<Modules>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ModuleKey | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/admin/settings/modules', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load module settings');
        if (active) setModules({ ...defaults, ...result.modules });
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load module settings'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const toggle = async (key: ModuleKey) => {
    if (saving || loading) return;
    setSaving(key);
    setError('');
    setMessage('');
    const next = { ...modules, [key]: !modules[key] };
    try {
      const response = await fetch('/api/admin/settings/modules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ modules: next })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to save module settings');
      setModules({ ...defaults, ...result.modules });
      setMessage(`${labels.find((item) => item.key === key)?.title} ${next[key] ? 'shown' : 'hidden'} in navigation.`);
      window.dispatchEvent(new Event('aviator:modules-updated'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save module settings');
    } finally {
      setSaving(null);
    }
  };

  return <section className="admin-module-settings">
    <div className="admin-table-title"><div><h2>Navigation modules</h2><p>Choose which tabs players see in the fixed navigation bar.</p></div></div>
    <div className="admin-module-list">{labels.map(({ key, title, description }) => <div className="admin-module-row" key={key}>
      <div><strong>{title}</strong><small>{description}</small></div>
      <label className="admin-module-switch"><span>{modules[key] ? 'Shown' : 'Hidden'}</span><input type="checkbox" checked={modules[key]} disabled={loading || saving !== null} onChange={() => void toggle(key)} aria-label={`${title} tab ${modules[key] ? 'shown' : 'hidden'}`} /><i /></label>
    </div>)}</div>
    {loading && <p className="admin-module-message">Loading saved settings…</p>}
    {message && <p className="admin-module-message success" role="status">{message}</p>}
    {error && <p className="admin-module-message error" role="alert">{error}</p>}
  </section>;
}
