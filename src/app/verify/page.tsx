'use client';

import { FormEvent, useState } from 'react';
import { AppPageFrame } from '@/components/layout/AppPageFrame';

interface ProofResult {
  commitment: string;
  hmac: string;
  entropy: string;
  multiplier: number;
  bust: boolean;
  commitmentMatches: boolean | null;
  multiplierMatches: boolean | null;
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function digest(text: string) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

async function calculateProof(serverSeed: string, clientSeed: string, nonce: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(serverSeed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${clientSeed}:${nonce}`));
  const hmac = toHex(signature);
  const entropy = hmac.slice(0, 13);
  const h = Number.parseInt(entropy, 16);
  const bust = h % 33 === 0;
  const e = 2 ** 52;
  const multiplier = bust ? 1 : Math.max(1, Math.floor((100 * e - h) / (e - h))) / 100;
  return { commitment: await digest(serverSeed), hmac, entropy, multiplier, bust };
}

function randomHex(bytes: number) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

export default function VerifyPage() {
  const [serverSeed, setServerSeed] = useState('');
  const [clientSeed, setClientSeed] = useState('');
  const [nonce, setNonce] = useState('');
  const [expectedCommitment, setExpectedCommitment] = useState('');
  const [expectedMultiplier, setExpectedMultiplier] = useState('');
  const [result, setResult] = useState<ProofResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setResult(null);
    const parsedNonce = Number(nonce);
    if (!serverSeed.trim() || !clientSeed.trim() || !Number.isSafeInteger(parsedNonce) || parsedNonce < 0) {
      setError('Enter a server seed, client seed, and a whole-number round nonce.');
      return;
    }
    setBusy(true);
    try {
      const calculated = await calculateProof(serverSeed.trim(), clientSeed.trim(), parsedNonce);
      const expected = Number(expectedMultiplier);
      setResult({
        ...calculated,
        commitmentMatches: expectedCommitment.trim() ? calculated.commitment.toLowerCase() === expectedCommitment.trim().toLowerCase() : null,
        multiplierMatches: expectedMultiplier.trim() ? Math.abs(calculated.multiplier - expected) < 0.005 : null
      });
    } catch {
      setError('This browser could not calculate the cryptographic proof.');
    } finally {
      setBusy(false);
    }
  };

  const generateInputs = () => {
    setServerSeed(randomHex(32));
    setClientSeed(`client-${randomHex(16)}`);
    setNonce(String(crypto.getRandomValues(new Uint32Array(1))[0]));
    setExpectedCommitment('');
    setExpectedMultiplier('');
    setResult(null);
    setError('');
  };

  return <AppPageFrame>
    <section className="app-feature-page verifier-page">
      <header className="feature-page-hero">
        <span className="feature-eyebrow">ROUND INTEGRITY</span>
        <h1>Seed Verifier</h1>
        <p>Recalculate a round result from its server seed, client seed, and nonce. Compare the result against the original commitment and multiplier.</p>
      </header>
      <div className="feature-card verifier-card">
        <div className="feature-card-heading"><div><h2>Verify a round</h2><p>Proof calculation runs in this browser.</p></div><button type="button" className="feature-secondary-button" onClick={generateInputs}>Generate random inputs</button></div>
        <form className="feature-form" onSubmit={verify}>
          <label>Revealed server seed<input value={serverSeed} onChange={(event) => setServerSeed(event.target.value)} placeholder="Paste the revealed seed" autoComplete="off" required /></label>
          <label>Client seed<input value={clientSeed} onChange={(event) => setClientSeed(event.target.value)} placeholder="Paste the round client seed" autoComplete="off" required /></label>
          <label>Round nonce<input type="number" min="0" step="1" value={nonce} onChange={(event) => setNonce(event.target.value)} placeholder="e.g. 12480" required /></label>
          <label>Original SHA-256 commitment <span className="optional-label">Optional</span><input value={expectedCommitment} onChange={(event) => setExpectedCommitment(event.target.value)} placeholder="64-character hash" autoComplete="off" /></label>
          <label>Recorded multiplier <span className="optional-label">Optional</span><input type="number" min="1" step="0.01" value={expectedMultiplier} onChange={(event) => setExpectedMultiplier(event.target.value)} placeholder="e.g. 2.37" /></label>
          {error && <p className="feature-error" role="alert">{error}</p>}
          <button className="feature-primary-button" type="submit" disabled={busy}>{busy ? 'Calculating…' : 'Verify round'}</button>
        </form>
        {result && <div className="proof-result" role="status">
          <div className={`proof-result-banner ${result.commitmentMatches === false || result.multiplierMatches === false ? 'failed' : 'passed'}`}>
            {result.commitmentMatches === false || result.multiplierMatches === false ? 'The supplied proof does not match' : result.commitmentMatches === true && result.multiplierMatches === true ? 'Round proof verified' : 'Proof calculated'}
          </div>
          <div className="proof-result-grid">
            <div><span>Calculated multiplier</span><strong>{result.multiplier.toFixed(2)}x</strong></div>
            <div><span>Bust gate</span><strong>{result.bust ? 'Triggered' : 'Passed'}</strong></div>
            <div><span>Commitment check</span><strong>{result.commitmentMatches === null ? 'Not supplied' : result.commitmentMatches ? 'Matched' : 'Mismatch'}</strong></div>
            <div><span>Multiplier check</span><strong>{result.multiplierMatches === null ? 'Not supplied' : result.multiplierMatches ? 'Matched' : 'Mismatch'}</strong></div>
          </div>
          <details className="proof-details"><summary>Cryptographic details</summary><p><b>SHA-256 commitment</b><code>{result.commitment}</code></p><p><b>HMAC-SHA256</b><code>{result.hmac}</code></p><p><b>52-bit entropy</b><code>{result.entropy}</code></p></details>
        </div>}
      </div>
    </section>
  </AppPageFrame>;
}
