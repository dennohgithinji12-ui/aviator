'use client';

import { useCallback, useEffect, useState } from 'react';

type Settings = { enabled: boolean; effectiveFromNonce: number; targetPercent: number };

export function AdminOddsSettings({ token }: { token: string }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/settings/odds', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load odds settings');
      setSettings({ enabled: result.enabled, effectiveFromNonce: result.effectiveFromNonce, targetPercent: result.targetPercent });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load odds settings');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const toggle = async () => {
    if (!settings || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/settings/odds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !settings.enabled })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to save odds settings');
      setSettings({ enabled: result.enabled, effectiveFromNonce: result.effectiveFromNonce, targetPercent: result.targetPercent });
      setMessage(`Setting saved. It applies from round #${result.effectiveFromNonce.toLocaleString()}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save odds settings');
    } finally {
      setSaving(false);
    }
  };

  return <section className="admin-module-settings">
    <div className="admin-table-title"><div><h2>Round odds</h2><p>Choose the multiplier distribution used for upcoming rounds.</p></div></div>
    {loading && <p className="admin-module-message">Loading saved settings…</p>}
    {!loading && settings && <div className="admin-module-row">
      <div>
        <strong>Increase 2.00x+ frequency</strong>
        <small>{settings.enabled
          ? `On: targets about ${settings.targetPercent}% of rounds at 2.01x or higher over time. Frequency varies from run to run.`
          : 'Off: uses the existing round odds distribution.'}</small>
      </div>
      <label className="admin-module-switch">
        <span>{settings.enabled ? 'On' : 'Off'}</span>
        <input type="checkbox" checked={settings.enabled} disabled={saving} onChange={() => void toggle()} aria-label="Increase 2.00x or higher frequency" />
        <i />
      </label>
    </div>}
    <p className="admin-module-message">The change applies from the next round, and all game clients use the same saved schedule. At a 65% reach rate, a bet set to cash out at 2.00x has an approximate 130% long-run return before other rules. Review this payout impact before enabling it.</p>
    {message && <p className="admin-module-message success" role="status">{message}</p>}
    {error && <p className="admin-module-message error" role="alert">{error}</p>}
  </section>;
}
