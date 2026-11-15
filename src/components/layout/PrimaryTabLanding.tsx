'use client';

import Link from 'next/link';
import { useState } from 'react';

const fixtures = [
  { league: '🏴 Premier League', home: 'Arsenal', homeOdds: '2.10', draw: '3.40', away: 'Chelsea', awayOdds: '3.25' },
  { league: '🏴 Premier League', home: 'Manchester City', homeOdds: '1.78', draw: '3.80', away: 'Liverpool', awayOdds: '4.10' },
  { league: '🇪🇺 UEFA Champions League', home: 'Real Madrid', homeOdds: '2.05', draw: '3.50', away: 'Bayern Munich', awayOdds: '3.30' },
  { league: '🇰🇪 FKF Premier League', home: 'Gor Mahia', homeOdds: '1.95', draw: '3.10', away: 'AFC Leopards', awayOdds: '3.65' }
];
const games = [
  ['💣', 'Mines', '98% RTP', 'Navigate a 5×5 grid, reveal gems, and cash out before finding a mine.', 'art-mines'],
  ['⚪', 'Plinko', '99% RTP', 'Drop a token through the pins and follow it to a multiplier pocket.', 'art-plinko'],
  ['🎲', 'Turbo Dice', '99% RTP', 'Choose a probability and predict whether the dice roll goes over or under.', 'art-dice'],
  ['🚀', 'Crash X', '97% RTP', 'Watch the multiplier climb and choose when to cash out.', 'art-crash'],
  ['🎯', 'Mini Roulette', '97.3% RTP', 'A quick twelve-number wheel with inside and color bets.', 'art-roulette'],
  ['🎰', 'Mega Slots', '96.5% RTP', 'Five reels with scatter symbols, wilds, and free spins.', 'art-slots'],
  ['🃏', 'Blackjack Pro', '99.5% RTP', 'Play a single-deck table against the dealer.', 'art-blackjack'],
  ['👑', 'Hi-Lo', '98% RTP', 'Guess whether the next card is higher or lower.', 'art-hilo']
];

export function PrimaryTabLanding({ section }: { section: 'home' | 'sports' | 'casino' }) {
  const [notice, setNotice] = useState('');
  const notify = (feature: string) => {
    setNotice(`You’re on the list. We’ll let you know when ${feature} is available.`);
    window.setTimeout(() => setNotice(''), 4000);
  };

  if (section === 'sports') return <div className="sports-container">
    <header className="sports-hero">
      <div className="sports-badge">⚽ SHIFTSTACK SPORTSBOOK</div>
      <h1>Sports Betting Launching Soon</h1>
      <p>High-speed in-play betting with competitive live odds on Premier League, Champions League, AFCON, and NBA.</p>
      <div className="sports-hero-actions"><button className="btn-sports-notify" onClick={() => notify('the sportsbook')}>🔔 Notify Me on Launch</button><Link className="btn-sports-back" href="/">✈️ Return to Aviator Flight</Link></div>
    </header>
    <div className="sports-fixtures-grid">{fixtures.map((fixture) => <article className="fixture-card" key={fixture.home}>
      <div className="fixture-header"><span className="league-tag">{fixture.league}</span><span className="match-time">Coming Soon</span></div>
      <div className="match-teams"><div className="team-row"><span>{fixture.home}</span><strong className="odds-val">{fixture.homeOdds}</strong></div><div className="team-row draw"><span>Draw</span><strong className="odds-val">{fixture.draw}</strong></div><div className="team-row"><span>{fixture.away}</span><strong className="odds-val">{fixture.awayOdds}</strong></div></div>
    </article>)}</div>
    {notice && <div className="sports-notice" role="status">{notice}</div>}
  </div>;

  if (section === 'casino') return <div className="casino-container">
    <header className="casino-hero"><div className="casino-badge">🎲 SHIFTSTACK CASINO LOBBY</div><h1>Next-Gen Provably Fair Games</h1><p>Explore upcoming instant-win games powered by cryptographic SHA-256 random number generation.</p><div className="casino-hero-actions"><Link className="btn-casino-back" href="/">✈️ Return to Aviator Flight</Link></div></header>
    <div className="casino-games-grid">{games.map(([icon, name, rtp, description, art]) => <article className="casino-game-card" key={name}>
      <div className={`game-card-art ${art}`}>{icon}</div><div className="game-card-content"><div className="game-meta-tags"><span className="rtp-tag">{rtp}</span><span className="status-tag soon">Launching Soon</span></div><h3>{name}</h3><p>{description}</p><button className="btn-game-preview" onClick={() => notify(name)}>Notify Me</button></div>
    </article>)}</div>
    {notice && <div className="sports-notice" role="status">{notice}</div>}
  </div>;

  return <section className="app-feature-page primary-tab-page">
    <header className="feature-page-hero"><span className="feature-eyebrow">SHIFTSTACK LOBBY</span><h1>Welcome</h1><p>Choose a section to continue.</p></header>
    <div className="primary-tab-cards">
      <Link href="/sports" className="primary-tab-card"><span>⚽</span><div><strong>Sports</strong><small>Browse the sportsbook fixtures and launch updates.</small></div><b>›</b></Link>
      <Link href="/casino" className="primary-tab-card"><span>🎲</span><div><strong>Casino</strong><small>Browse the casino games lobby.</small></div><b>›</b></Link>
      <Link href="/" className="primary-tab-card"><span>✈</span><div><strong>Aviator</strong><small>Open the live Aviator game.</small></div><b>›</b></Link>
      <Link href="/account" className="primary-tab-card"><span>◉</span><div><strong>My account</strong><small>Open your profile and wallet.</small></div><b>›</b></Link>
    </div>
  </section>;
}
