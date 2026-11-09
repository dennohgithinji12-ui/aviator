'use client';

import { useEffect, useState } from 'react';

type Settings = { username: string; channelId: string; payoutAccountId: string; networkCode: string; payoutsEnabled: boolean; passwordSaved: boolean; callbackSecretSaved: boolean };
const empty: Settings = { username: '', channelId: '', payoutAccountId: '', networkCode: '', payoutsEnabled: false, passwordSaved: false, callbackSecretSaved: false };

export function AdminPayHeroSettings({ token }: { token: string }) {
  const [settings, setSettings] = useState<Settings>(empty);
  const [password, setPassword] = useState('');
  const [callbackSecret, setCallbackSecret] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/admin/settings/payhero', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); if (active) setSettings(result.settings); })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load settings'); });
    return () => { active = false; };
  }, [token]);
  const change = (key: keyof Settings, value: string | boolean) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/admin/settings/payhero', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...settings, password, callbackSecret }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save settings');
      setSettings((current) => ({ ...current, passwordSaved: true, callbackSecretSaved: true }));
      setPassword(''); setCallbackSecret(''); setMessage('PayHero settings saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save settings'); }
    finally { setSaving(false); }
  };
  return <form className="admin-access-card" onSubmit={(event) => void save(event)}>
    <h2>PayHero payments</h2><p>Update payment credentials here. Saved secrets are hidden for security; leave those fields blank to keep them.</p>
    <label htmlFor="ph-user">API username</label><input id="ph-user" value={settings.username} onChange={(e) => change('username', e.target.value)} required />
    <label htmlFor="ph-password">API password {settings.passwordSaved ? '(saved)' : ''}</label><input id="ph-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={settings.passwordSaved ? 'Leave blank to keep saved password' : ''} />
    <label htmlFor="ph-channel">M-Pesa channel ID</label><input id="ph-channel" inputMode="numeric" value={settings.channelId} onChange={(e) => change('channelId', e.target.value)} required />
    <label htmlFor="ph-callback">Callback secret {settings.callbackSecretSaved ? '(saved)' : ''}</label><input id="ph-callback" type="password" autoComplete="new-password" value={callbackSecret} onChange={(e) => setCallbackSecret(e.target.value)} placeholder={settings.callbackSecretSaved ? 'Leave blank to keep saved secret' : 'At least 16 characters'} />
    <label htmlFor="ph-account">Payout account ID</label><input id="ph-account" inputMode="numeric" value={settings.payoutAccountId} onChange={(e) => change('payoutAccountId', e.target.value)} />
    <label htmlFor="ph-network">Payout network code</label><input id="ph-network" value={settings.networkCode} onChange={(e) => change('networkCode', e.target.value)} />
    <label><input type="checkbox" checked={settings.payoutsEnabled} onChange={(e) => change('payoutsEnabled', e.target.checked)} /> Enable automatic payouts</label>
    <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save PayHero settings'}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
