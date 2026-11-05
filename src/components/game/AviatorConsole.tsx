'use client';

import { FlightCanvas } from './FlightCanvas';

export function AviatorConsole() {
  return (
    <section className="view-section active" id="view-terminal">
      {/* Top Go Back & Fullscreen Header */}
      <div className="aviator-top-nav-bar">
        <button type="button" className="btn-aviator-back" id="btn-aviator-back" title="Go Back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>Go Back</span>
        </button>
        <button type="button" className="btn-aviator-fullscreen" id="btn-aviator-fullscreen" title="Toggle Fullscreen">
          <span>View Fullscreen</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
        </button>
      </div>

      {/* Promo Banner */}
      <div className="aviator-promo-banner" id="aviator-daily-crown-banner">
        <div className="promo-badge-live">
          <span className="pulse-dot"></span>
          <span>LIVE</span>
        </div>
        <div className="promo-banner-text">Mfalme Wa Anga KES 400,000 Daily Crown</div>
        <button type="button" className="promo-banner-btn" id="btn-promo-banner-action" title="View Daily Crown Leaderboard">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>

      {/* Multiplier History Bar */}
      <div className="arena-history-bar" id="arena-history-bar">
        <div className="history-ribbon-wrapper" id="history-ribbon">
          {/* History items will be injected here */}
        </div>
        <button className="btn-round-history" id="btn-open-round-history" title="Round History & Multipliers">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '3px' }}>
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>•••</span>
        </button>
      </div>

      <div className="aviator-console-layout">
        {/* Main Flight Stage */}
        <div className="console-main-stage">
          {/* FUN MODE Banner */}
          <div className="shiftstack-fun-banner kessbet-fun-banner">FUN MODE</div>

          {/* Flight Canvas Component */}
          <FlightCanvas />

          {/* UFC & Aviator Partners Overlay */}
          <div className="ufc-partners-overlay">
            <span className="ufc-logo-tag">UFC</span>
            <span>|</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <svg width="14" height="12" viewBox="0 0 40 32" fill="#ff003b">
                <path d="M4 18 C 12 16, 22 14, 38 7 C 32 15, 26 21, 18 24 C 12 25, 6 23, 4 18 Z" />
              </svg>
              OFFICIAL PARTNERS
            </span>
          </div>

          {/* SPRIBE Verified Badge */}
          <div className="spribe-verified-badge">
            <div className="spribe-verified-top">
              <span>SPRIBE</span>
              <span style={{ color: '#2ecc71' }}>✓ Official Game</span>
            </div>
            <span className="spribe-verified-sub">Since 2019</span>
          </div>

          {/* Live Stakers */}
          <div className="canvas-stakers-badge">
            <div className="avatar-cluster">
              <span>🍀</span>
              <span>👑</span>
              <span>💵</span>
            </div>
            <span id="canvas-stakers-count">200</span>
          </div>

          {/* Real Mode Badge */}
          <span className="badge-real-mode" id="btn-real-mode-toggle" title="Switch between Fun Mode and Real Mode">Real &gt;</span>

          {/* Real Mode Deposit Alert */}
          <div id="real-mode-deposit-alert" className="real-mode-deposit-alert" style={{ display: 'none' }}>
            <div className="alert-content">
              <span className="alert-icon">⚡</span>
              <span className="alert-text"><strong>Real Money Mode:</strong> Balance is 0 KES. Deposit min 49 Bob via PayHero to place real bets!</span>
            </div>
            <button type="button" className="btn-alert-deposit" id="btn-quick-deposit-alert">⚡ Deposit 49 Bob+</button>
          </div>

          <div className="canvas-watermark">AVIATOR</div>
          <button id="btn-skip-countdown" className="canvas-skip-btn" title="Universal Synchronized Flight" style={{ display: 'none !important' }}>
            <span>▶ Take Off</span>
          </button>

          {/* Dual Betting Terminals */}
          <div className="dual-betting-terminals" id="dual-terminals-wrapper">
            {/* Terminal 1 and 2 will be added here */}
            <p style={{ padding: '20px', textAlign: 'center', color: '#8c9ba5' }}>
              Betting terminals will be integrated here
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
