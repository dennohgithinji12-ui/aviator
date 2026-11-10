import Link from 'next/link';
import { AppPageFrame } from '@/components/layout/AppPageFrame';

export default function GameGuidePage() {
  return <AppPageFrame>
    <div className="game-guide">
      <header className="game-guide-hero">
        <span className="feature-eyebrow">AVIATOR / PLAYER GUIDE</span>
        <h1>Know the game before you fly</h1>
        <p>Find the stake limits, betting steps, and round rules in one place.</p>
        <nav className="game-guide-links" aria-label="Guide sections">
          <a href="#game-limits">Game Limits</a>
          <a href="#how-to-play">How to Play</a>
          <a href="#game-rules">Game Rules</a>
        </nav>
      </header>

      <section id="game-limits" className="game-guide-section">
        <div className="game-guide-heading"><span>01</span><div><h2>Game Limits</h2><p>What each round and wallet allows.</p></div></div>
        <div className="game-guide-grid">
          <article><strong>Stake per bet</strong><b>KES 100–100,000</b><p>Enter a whole stake within this range on either betting card.</p></article>
          <article><strong>Bet positions</strong><b>Two per round</b><p>You may place one recorded bet on each of the two betting cards in a round.</p></article>
          <article><strong>Betting window</strong><b>Before takeoff</b><p>Bets for the current round are accepted during its countdown. A bet pressed during flight is queued for the next round.</p></article>
          <article><strong>Available balance</strong><b>Required</b><p>Your selected Wallet or Practice balance must cover the stake. An insufficient balance stops Auto Bet.</p></article>
        </div>
      </section>

      <section id="how-to-play" className="game-guide-section">
        <div className="game-guide-heading"><span>02</span><div><h2>How to Play</h2><p>From choosing a stake to cashing out.</p></div></div>
        <ol className="game-guide-steps">
          <li><strong>Choose a balance.</strong> Select Wallet for real money or Practice for demo play in the top bar.</li>
          <li><strong>Enter a stake.</strong> Set the amount on a betting card, then press Bet. During a flight, your bet waits for the next round.</li>
          <li><strong>Watch the multiplier.</strong> During the countdown, a placed bet can be canceled. Once the plane takes off, the multiplier rises until the round ends.</li>
          <li><strong>Cash out.</strong> Press Cash Out while the plane is flying. The server confirms the multiplier and credits your selected balance when the cashout succeeds.</li>
          <li><strong>Use Auto if you prefer.</strong> Turn on Auto Bet to attempt a stake each round. Set Auto Cash to request a cashout at your chosen multiplier. You can still press Cash Out manually.</li>
        </ol>
      </section>

      <section id="game-rules" className="game-guide-section">
        <div className="game-guide-heading"><span>03</span><div><h2>Game Rules</h2><p>How bets, cashouts, and round results are handled.</p></div></div>
        <div className="game-guide-rules">
          <p>Each round has a server-determined crash multiplier. The plane may end at any multiplier, including before an Auto Cash target. A bet that has not cashed out before the crash loses its stake.</p>
          <p>Cashout requests are decided by the server using the live round state. The amount shown in your browser is a live display; the server-confirmed result is final. Winnings are the stake multiplied by the confirmed cashout multiplier, rounded down to cents.</p>
          <p>Wallet and Practice balances are separate. Wallet play requires a signed-in account and enough real balance. Practice bets use the demo balance and do not pay real money.</p>
          <p>Queued bets can be canceled before they are placed. A placed bet can be canceled during the countdown. Auto Bet pauses when a stake cannot be covered by the selected balance.</p>
        </div>
        <div className="game-guide-actions"><Link href="/">Return to Aviator</Link><Link href="/verify">Check round fairness</Link></div>
      </section>
    </div>
  </AppPageFrame>;
}
