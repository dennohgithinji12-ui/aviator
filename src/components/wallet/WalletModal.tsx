'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type WalletTab = 'deposit' | 'withdraw';

const amountOptions = [100, 500, 1000, 2500];
const money = (value: number) => `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function WalletModal({ isOpen, onClose, initialTab = 'deposit' }: { isOpen: boolean; onClose: () => void; initialTab?: WalletTab }) {
  const { user, token, updateBalance, refreshBalance } = useAuth();
  const [tab, setTab] = useState<WalletTab>(initialTab);
  const [amount, setAmount] = useState('100');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'pending' | 'success' | 'error'>('pending');
  const [pendingReference, setPendingReference] = useState('');
  const [receipt, setReceipt] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setMessage('');
      setPendingReference('');
      setReceipt('');
      void refreshBalance().catch(() => undefined);
    }
  }, [isOpen, initialTab, refreshBalance]);

  useEffect(() => {
    if (!isOpen || !pendingReference || !token) return;
    let stopped = false;
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/payhero/status?reference=${encodeURIComponent(pendingReference)}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to check payment status');
        if (result.status === 'SUCCESS') {
          setMessageKind('success');
          setMessage(`Deposit received. ${money(Number(result.amount))} has been added to your real balance.`);
          setReceipt(result.receiptNumber || '');
          updateBalance(Number(result.realBalance), Number(result.demoBalance));
          setPendingReference('');
        } else if (result.status === 'FAILED') {
          setMessageKind('error');
          setMessage('The deposit was not completed. Please try again.');
          setPendingReference('');
        } else if (!stopped) {
          setMessageKind('pending');
          setMessage('Waiting for M-PESA confirmation. Keep this window open while the payment is being confirmed.');
        }
      } catch (error) {
        if (!stopped) {
          setMessageKind('error');
          setMessage(error instanceof Error ? error.message : 'Unable to check payment status');
        }
      }
    };
    void checkStatus();
    const timer = window.setInterval(() => void checkStatus(), 2500);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [isOpen, pendingReference, token, updateBalance]);

  if (!isOpen) return null;

  const submitDeposit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount < 49) {
      setMessageKind('error');
      setMessage('Enter a whole KES amount of at least KES 49.');
      return;
    }
    setBusy(true);
    setMessage('');
    setReceipt('');
    try {
      const response = await fetch('/api/payhero/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: numericAmount })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to start the deposit');
      setPendingReference(result.reference);
      setMessageKind('pending');
      setMessage(result.isSandbox ? 'Development sandbox: a simulated deposit confirmation will arrive shortly.' : result.message || 'M-PESA payment prompt sent. Enter your PIN to continue.');
    } catch (error) {
      setMessageKind('error');
      setMessage(error instanceof Error ? error.message : 'Unable to start the deposit');
    } finally {
      setBusy(false);
    }
  };

  const submitWithdrawal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 25 || Math.round(numericAmount * 100) !== numericAmount * 100) {
      setMessageKind('error');
      setMessage('Enter at least KES 25, with up to two decimal places.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: numericAmount })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to submit withdrawal');
      updateBalance(Number(result.realBalance), Number(result.demoBalance));
      setMessageKind('pending');
      setMessage(`Request ${result.reference} · ${result.status}. Tax: ${money(Number(result.taxAmount))}; net payout: ${money(Number(result.netDisbursement))}.`);
    } catch (error) {
      setMessageKind('error');
      setMessage(error instanceof Error ? error.message : 'Unable to submit withdrawal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wallet-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title">
        <header className="wallet-modal-header">
          <div><span>SHIFTSTACK WALLET</span><h2 id="wallet-modal-title">Manage funds</h2></div>
          <button type="button" className="wallet-modal-close" onClick={onClose} aria-label="Close wallet">×</button>
        </header>
        <div className="wallet-modal-balance"><span>Real balance</span><strong>{money(user?.realBalance || 0)}</strong></div>
        <div className="wallet-modal-tabs" role="tablist" aria-label="Wallet action">
          <button type="button" role="tab" aria-selected={tab === 'deposit'} className={tab === 'deposit' ? 'active' : ''} onClick={() => { setTab('deposit'); setMessage(''); setPendingReference(''); }}>Deposit</button>
          <button type="button" role="tab" aria-selected={tab === 'withdraw'} className={tab === 'withdraw' ? 'active' : ''} disabled={!!pendingReference} onClick={() => { setTab('withdraw'); setMessage(''); }}>Withdraw</button>
        </div>
        {tab === 'deposit' ? <form onSubmit={submitDeposit} className="wallet-modal-form">
          <p>M-PESA prompt will be sent to <strong>{user?.phone}</strong>.</p>
          <label htmlFor="wallet-deposit-amount">Amount (KES)</label>
          <input id="wallet-deposit-amount" inputMode="numeric" type="number" min="49" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          <div className="wallet-amount-options">{amountOptions.map((value) => <button type="button" key={value} onClick={() => setAmount(String(value))}>{value.toLocaleString('en-KE')}</button>)}</div>
          <button type="submit" className="wallet-submit" disabled={busy || !!pendingReference}>{busy ? 'Starting…' : pendingReference ? 'Awaiting payment…' : 'Send M-PESA prompt'}</button>
        </form> : <form onSubmit={submitWithdrawal} className="wallet-modal-form">
          <p>Withdraw to your account phone: <strong>{user?.phone}</strong>. Requests may be held for review.</p>
          <label htmlFor="wallet-withdraw-amount">Amount (KES)</label>
          <input id="wallet-withdraw-amount" inputMode="decimal" type="number" min="25" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          <div className="wallet-tax-note">A 5% tax is reserved from the amount requested.</div>
          <button type="submit" className="wallet-submit" disabled={busy}>{busy ? 'Submitting…' : 'Request withdrawal'}</button>
        </form>}
        {message && <div className={`wallet-modal-message ${messageKind}`} role={messageKind === 'error' ? 'alert' : 'status'}>{message}{receipt && <span>Receipt: {receipt}</span>}</div>}
        {tab === 'withdraw' && <button type="button" className="wallet-refresh" onClick={() => void refreshBalance().catch((error) => { setMessageKind('error'); setMessage(error.message); })}>Refresh balance</button>}
      </section>
    </div>
  );
}
