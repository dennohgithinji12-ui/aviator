'use client';

import { useEffect, useState } from 'react';

type Settings = { username: string; channelId: string; payoutAccountId: string; networkCode: string; payoutsEnabled: boolean; passwordSaved: boolean; callbackSecretSaved: boolean };
const empty: Settings = { username: '', channelId: '', payoutAccountId: '', networkCode: '', payoutsEnabled: false, passwordSaved: false, callbackSecretSaved: false };

export function AdminPayHeroSettings({ token }: { token: string }) {
  const [settings, setSettings] = useState<Settings>(empty);
  const [password, setPassword] = useState('');
  const [callbackSecret, setCallbackSecret] = useState('');
  const [basicAuthToken, setBasicAuthToken] = useState('');
  const [source, setSource] = useState<'database' | 'environment'>('environment');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/admin/settings/payhero', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); if (active) { setSettings(result.settings); setSource(result.source); } })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load settings'); });
    return () => { active = false; };
  }, [token]);
  const change = (key: keyof Settings, value: string | boolean) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/admin/settings/payhero', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...settings, password, callbackSecret, basicAuthToken }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save settings');
      setSettings((current) => ({ ...current, passwordSaved: true, callbackSecretSaved: true }));
      setPassword(''); setCallbackSecret(''); setBasicAuthToken(''); setSource('database'); setMessage('PayHero settings saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save settings'); }
    finally { setSaving(false); }
  };
  const useEnvironment = async () => {
    if (!window.confirm('Remove saved PayHero settings and use the deployment environment values?')) return;
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/admin/settings/payhero', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to restore environment settings');
      const reload = await fetch('/api/admin/settings/payhero', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const current = await reload.json();
      if (!reload.ok) throw new Error(current.error || 'Unable to reload settings');
      setSettings(current.settings); setSource('environment'); setPassword(''); setCallbackSecret(''); setBasicAuthToken('');
      setMessage('Saved settings removed. Environment values are now active.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to restore environment settings'); }
    finally { setSaving(false); }
  };
  return <form className="admin-access-card" onSubmit={(event) => void save(event)}>
    <h2>PayHero payment settings</h2><p>Active source: <strong>{source === 'database' ? 'Saved admin settings' : 'Deployment environment'}</strong>. Saved credentials are encrypted in the database. Leave secret fields blank to keep the current values.</p>
    <p>In PayHero, open <strong>API Keys</strong> and create a key. Paste its Basic Authorization token below, or enter the API username and password separately. Find the channel ID under <strong>Payment Channels → My Payment Channels</strong>. <a href="https://docs.payhero.co.ke/docs/authorization" target="_blank" rel="noreferrer">PayHero API key guide ↗</a></p>
    <p>For deposits, add credentials, channel ID, and a site callback secret. Automatic payouts additionally need your PayHero account ID and network code. This site also needs its public URL configured as <code>APP_BASE_URL</code> in the deployment.</p>
    <label htmlFor="ph-token">Basic Authorization token (optional alternative to username and password)</label><input id="ph-token" type="password" autoComplete="off" value={basicAuthToken} onChange={(e) => setBasicAuthToken(e.target.value)} placeholder="Paste the token from PayHero API Keys" />
    <label htmlFor="ph-user">API username</label><input id="ph-user" value={settings.username} onChange={(e) => change('username', e.target.value)} />
    <label htmlFor="ph-password">API password {settings.passwordSaved ? '(saved)' : ''}</label><input id="ph-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={settings.passwordSaved ? 'Leave blank to keep saved password' : ''} />
    <label htmlFor="ph-channel">M-Pesa channel ID</label><input id="ph-channel" inputMode="numeric" value={settings.channelId} onChange={(e) => change('channelId', e.target.value)} required />
    <label htmlFor="ph-callback">Callback secret for this site {settings.callbackSecretSaved ? '(saved)' : ''}</label><input id="ph-callback" type="password" autoComplete="new-password" value={callbackSecret} onChange={(e) => setCallbackSecret(e.target.value)} placeholder={settings.callbackSecretSaved ? 'Leave blank to keep saved secret' : 'Create a random secret of at least 16 characters'} />
    <label htmlFor="ph-account">Payout account ID</label><input id="ph-account" inputMode="numeric" value={settings.payoutAccountId} onChange={(e) => change('payoutAccountId', e.target.value)} />
    <label htmlFor="ph-network">Payout network code</label><input id="ph-network" value={settings.networkCode} onChange={(e) => change('networkCode', e.target.value)} />
    <label><input type="checkbox" checked={settings.payoutsEnabled} onChange={(e) => change('payoutsEnabled', e.target.checked)} /> Enable automatic payouts</label>
    <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save PayHero settings'}</button>
    {source === 'database' && <button type="button" disabled={saving} onClick={() => void useEnvironment()}>Remove saved settings and use environment</button>}
    {message && <p role="status">{message}</p>}
  </form>;
}
