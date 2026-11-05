'use client';

import { useRef, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
}

async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  return response.json();
}

function formatKes(value) {
  return `KES ${Number(value || 0).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function HomePage() {
  const [notice, setNotice] = useState('');
  const [withdrawal, setWithdrawal] = useState('');
  const [phone, setPhone] = useState('');
  const [depositAmount, setDepositAmount] = useState('500');
  const [withdrawalAmount, setWithdrawalAmount] = useState('25');
  const [wallet, setWallet] = useState({ realBalance: 0, totalDeposits: 0, totalTurnover: 0 });
  const [paymentState, setPaymentState] = useState(null);
  const createdUser = useRef(false);
  const statusPollRef = useRef(null);

  async function refreshWallet() {
    if (!phone.trim()) return;
    try {
      const result = await getJson(`/api/wallet?phone=${encodeURIComponent(phone.trim())}`);
      if (result.success) setWallet(result);
    } catch {
      setNotice('Wallet data is temporarily unavailable.');
    }
  }

  async function pollPayment(reference) {
    if (statusPollRef.current) clearTimeout(statusPollRef.current);
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      try {
        const result = await getJson(`/api/payhero/status?reference=${encodeURIComponent(reference)}`);
        setPaymentState(result);
        if (result.status === 'SUCCESS') {
          setNotice(`Deposit confirmed: ${formatKes(result.amount)} added to your wallet.`);
          await refreshWallet();
          return;
        }
        if (['FAILED', 'CANCELLED', 'NOT_FOUND'].includes(result.status) || attempts >= 12) {
          setNotice(result.status === 'PENDING'
            ? 'Payment is still pending. You can refresh this screen to check again.'
            : 'Payment could not be confirmed.');
          return;
        }
      } catch {
        if (attempts >= 12) {
          setNotice('Payment status is taking longer than expected.');
          return;
        }
      }
      statusPollRef.current = setTimeout(check, 2500);
    };
    await check();
  }

  async function createUserOnce() {
    if (createdUser.current) return;
    if (!phone.trim()) {
      setNotice('Enter your registered M-PESA phone number first.');
      return;
    }
    createdUser.current = true;
    setNotice('Creating your account…');
    try {
      const result = await postJson('/api/auth/register', { phone: phone.trim(), username: 'Pilot' });
      setNotice(result.message || 'Account is ready for this session.');
      await refreshWallet();
    } catch {
      createdUser.current = false;
      setNotice('Could not create the account. Check the phone number and try again.');
    }
  }

  async function requestDeposit() {
    if (!phone.trim()) {
      setNotice('Enter your registered M-PESA phone number first.');
      return;
    }
    setNotice('Sending mobile money prompt…');
    try {
      const result = await postJson('/api/payhero/stk-push', {
        phone: phone.trim(),
        amount: Number(depositAmount) || 0,
        customerName: 'Pilot',
      });
      if (!result.success) {
        setNotice(result.error || 'Payment request could not be started.');
        return;
      }
      setPaymentState(result);
      setNotice(result.message || 'Payment request sent. Approve it on your phone.');
      if (result.reference) await pollPayment(result.reference);
    } catch {
      setNotice('Could not reach the payment service. Please try again.');
    }
  }

  async function requestWithdrawal() {
    if (!phone.trim()) {
      setWithdrawal('Enter your registered M-PESA phone number first.');
      return;
    }
    setWithdrawal('Sending withdrawal request…');
    try {
      const amount = Number(withdrawalAmount);
      const result = await postJson('/api/wallet/withdraw', { phone: phone.trim(), amount });
      setWithdrawal(result.message || result.error || 'Withdrawal request updated.');
      if (result.success) await refreshWallet();
    } catch {
      setWithdrawal('Could not reach the wallet service. Please try again.');
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/">SHIFT<span>STACK</span></a>
        <nav className="topnav" aria-label="Primary">
          <button className="navlink active">Aviator</button>
          <button className="navlink">Sports</button>
          <button className="navlink">Casino</button>
          <button className="balance">{formatKes(wallet.realBalance)}</button>
        </nav>
      </header>
      <div className="page">
        <aside className="rail">
          <h3>LIVE GAMES</h3>
          <a className="active" href="#aviator">Aviator <span className="live">LIVE</span></a>
          <a href="#crash">Crash <span>›</span></a>
          <a href="#mines">Mines <span>›</span></a>
          <h3 style={{ marginTop: 38 }}>ACCOUNT</h3>
          <a href="#wallet">Wallet <span>›</span></a>
          <a href="#history">Bet history <span>›</span></a>
          <a href="https://admin.localhost" target="_blank" rel="noreferrer">Admin <span>›</span></a>
        </aside>
        <section className="main" id="aviator">
          <div className="welcome">
            <div>
              <h1>Good evening, Pilot</h1>
              <p>Fast games. Clear odds. Simple mobile money deposits and withdrawals.</p>
            </div>
            <section className="wallet-strip" aria-label="Wallet summary">
              <div><span>Available</span><strong>{formatKes(wallet.realBalance)}</strong></div>
              <div><span>Deposited</span><strong>{formatKes(wallet.totalDeposits)}</strong></div>
              <div><span>Turnover</span><strong>{formatKes(wallet.totalTurnover)}</strong></div>
            </section>
            <button className="status" onClick={createUserOnce}>● Create / open account</button>
          </div>
          <section className="chart" aria-label="Live Aviator chart">
            <div className="chart-head">
              <div><h2>Aviator</h2><small>Round #2418 · Betting open</small></div>
              <span className="live">● LIVE</span>
            </div>
            <div className="multiplier">2.47x</div>
            <small>Current multiplier</small>
            <div className="flight-path" />
            <div className="plane" aria-hidden="true">✈</div>
          </section>
          <div className="betgrid">
            <article className="betcard">
              <h3>Bet slip</h3>
              <div className="field"><input aria-label="Bet amount" defaultValue="100" /><button aria-label="Decrease bet">−</button><button aria-label="Increase bet">+</button></div>
              <button className="primary" onClick={() => setNotice('Bet placed. Cash out before the flight ends.')}>PLACE BET</button>
              <div className="notice">{notice}</div>
            </article>
            <article className="betcard">
              <h3>Wallet actions</h3>
              <div className="field"><input aria-label="M-PESA phone number" placeholder="2547XXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
              <div className="field"><input aria-label="Deposit amount" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} /><span style={{ paddingRight: 14, color: 'var(--muted)' }}>KES</span></div>
              <button className="secondary" onClick={requestDeposit}>DEPOSIT</button>
              <div className="field"><input aria-label="Withdrawal amount" value={withdrawalAmount} onChange={(event) => setWithdrawalAmount(event.target.value)} /><span style={{ paddingRight: 14, color: 'var(--muted)' }}>KES</span></div>
              <button className="ghost" style={{ width: '100%', marginTop: 8 }} onClick={requestWithdrawal}>WITHDRAW TO M-PESA</button>
              {paymentState?.status === 'PENDING' && <div className="payment-status"><span className="status-dot" /> Waiting for confirmation · {formatKes(paymentState.amount)}</div>}
              {paymentState?.status === 'SUCCESS' && <div className="payment-status success">Confirmed · {paymentState.receiptNumber || 'receipt received'}</div>}
              <div className="notice">{withdrawal}</div>
            </article>
          </div>
        </section>
        <aside className="chat">
          <h3>LIVE CHAT</h3>
          <p><strong>mikepilot</strong><br />Nice run!</p>
          <p><strong>Aisha</strong><br />Cashed out at 4.12x</p>
          <p><strong>njeri</strong><br />Good luck pilots</p>
          <p>Payment status and withdrawal responses are surfaced here after the backend confirms them.</p>
        </aside>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <a className="active" href="#aviator">✈<span>Aviator</span></a>
        <a href="#sports">◉<span>Sports</span></a>
        <a href="#wallet">▣<span>Wallet</span></a>
        <a href="#account">◯<span>Me</span></a>
      </nav>
    </main>
  );
}
