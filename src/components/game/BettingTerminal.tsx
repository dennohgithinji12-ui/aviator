'use client';

import { useState } from 'react';

interface BettingTerminalProps {
  terminalId: 1 | 2;
  amount: number;
  mode: 'manual' | 'auto';
  autoStakeEnabled: boolean;
  autoCashoutEnabled: boolean;
  autoCashoutMultiplier: number;
  staked: boolean;
  cashedOut: boolean;
  onAmountChange: (id: 1 | 2, amount: number) => void;
  onBet: (id: 1 | 2, amount: number) => void;
  onCashout: (id: 1 | 2) => void;
  onCancel: (id: 1 | 2) => void;
  onToggleMode: (id: 1 | 2, mode: 'manual' | 'auto') => void;
  onToggleAutoStake: (id: 1 | 2, enabled: boolean) => void;
  onToggleAutoCashout: (id: 1 | 2, enabled: boolean) => void;
  onAutoCashoutChange: (id: 1 | 2, multiplier: number) => void;
  balance: number;
  gameState: 'WAITING' | 'FLYING' | 'CRASHED';
  currentMultiplier: number;
  onClose?: () => void;
}

export function BettingTerminal({
  terminalId,
  amount,
  mode,
  autoStakeEnabled,
  autoCashoutEnabled,
  autoCashoutMultiplier,
  staked,
  cashedOut,
  onAmountChange,
  onBet,
  onCashout,
  onCancel,
  onToggleMode,
  onToggleAutoStake,
  onToggleAutoCashout,
  onAutoCashoutChange,
  balance,
  gameState,
  currentMultiplier,
  onClose
}: BettingTerminalProps) {
  const [localAmount, setLocalAmount] = useState(amount);
  const [localAutoCashout, setLocalAutoCashout] = useState(autoCashoutMultiplier);

  const quickChips = [100, 250, 1000, 25000];

  const handleChipClick = (value: number) => {
    const newAmount = localAmount + value;
    setLocalAmount(newAmount);
    onAmountChange(terminalId, newAmount);
  };

  const handleStep = (delta: number) => {
    const newAmount = Math.max(100, localAmount + delta);
    setLocalAmount(newAmount);
    onAmountChange(terminalId, newAmount);
  };

  const handleBet = () => {
    onBet(terminalId, localAmount);
  };

  const handleCashout = () => {
    onCashout(terminalId);
  };

  const handleCancel = () => {
    onCancel(terminalId);
  };

  const isDisabled = gameState !== 'WAITING' || balance < localAmount;
  const canCashout = staked && !cashedOut && gameState === 'FLYING';
  const canCancel = staked && !cashedOut && gameState === 'WAITING';

  return (
    <div className="betting-terminal" id={`terminal-${terminalId}`}>
      <div className="terminal-tab-bar">
        <div className="tab-pill-switch">
          <button
            className={`tab-btn tab-manual ${mode === 'manual' ? 'active' : ''}`}
            onClick={() => onToggleMode(terminalId, 'manual')}
          >
            Bet
          </button>
          <button
            className={`tab-btn tab-auto ${mode === 'auto' ? 'active' : ''}`}
            onClick={() => onToggleMode(terminalId, 'auto')}
          >
            Auto
          </button>
        </div>
        {terminalId === 2 && (
          <button
            className="btn-close-terminal"
            id="btn-hide-terminal-2"
            title="Close Second Bet Panel"
            aria-label="Minimize terminal"
            onClick={onClose}
          >
            <span style={{ fontWeight: 900, fontSize: '14px' }}>⊟</span>
          </button>
        )}
      </div>

      <div className="terminal-grid-content">
        <div className="terminal-left-controls">
          {mode === 'manual' ? (
            <>
              <div className="stepper-row">
                <button
                  className="btn-step btn-step-minus"
                  title="Decrease stake"
                  onClick={() => handleStep(-100)}
                >
                  −
                </button>
                <div className="input-display-box">
                  <input
                    type="number"
                    className="terminal-stake-input"
                    value={localAmount}
                    min="100"
                    max="100000"
                    step="100"
                    title="Stake Amount"
                    aria-label="Stake Amount"
                    placeholder="10.00"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 100;
                      setLocalAmount(val);
                      onAmountChange(terminalId, val);
                    }}
                    onBlur={() => setLocalAmount((current) => Math.min(100000, Math.max(100, Math.floor(current / 100) * 100)))}
                  />
                  <span className="currency-tag">KES</span>
                </div>
                <button
                  className="btn-step btn-step-plus"
                  title="Increase stake"
                  onClick={() => handleStep(100)}
                >
                  +
                </button>
              </div>

              <div className="quick-chips-grid">
                {quickChips.map((chip) => (
                  <button
                    key={chip}
                    className="chip-btn"
                    data-val={chip}
                    onClick={() => handleChipClick(chip)}
                  >
                    {chip.toLocaleString()}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="auto-controls-panel" style={{ display: 'block' }}>
              <label className="auto-toggle-row">
                <input
                  type="checkbox"
                  className="check-auto-stake"
                  checked={autoStakeEnabled}
                  onChange={(e) => onToggleAutoStake(terminalId, e.target.checked)}
                />
                <span className="toggle-track"></span>
                <span className="toggle-name">Auto Bet</span>
              </label>
              <div className="auto-cashout-box">
                <label className="auto-toggle-row">
                  <input
                    type="checkbox"
                    className="check-auto-cashout"
                    checked={autoCashoutEnabled}
                    onChange={(e) => onToggleAutoCashout(terminalId, e.target.checked)}
                  />
                  <span className="toggle-track"></span>
                  <span className="toggle-name">Auto Cash</span>
                </label>
                <div className="mult-input-group">
                  <input
                    type="number"
                    className="input-auto-cashout"
                    value={localAutoCashout}
                    min="1.05"
                    step="0.1"
                    title="Auto Cashout Multiplier"
                    aria-label="Auto Cashout Multiplier"
                    placeholder="2.00"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 1.50;
                      setLocalAutoCashout(val);
                      onAutoCashoutChange(terminalId, val);
                    }}
                  />
                  <span className="mult-suffix">x</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="terminal-right-action">
          {!staked ? (
            <button
              className="btn-terminal-action state-stake"
              onClick={handleBet}
              disabled={isDisabled}
            >
              <div className="action-btn-main">Bet</div>
              <div className="action-btn-sub">{localAmount.toFixed(2)} KES</div>
            </button>
          ) : canCancel ? (
            <button
              className="btn-terminal-action state-cancel"
              onClick={handleCancel}
            >
              <div className="action-btn-main">Cancel</div>
              <div className="action-btn-sub">{localAmount.toFixed(2)} KES</div>
            </button>
          ) : canCashout ? (
            <button
              className="btn-terminal-action state-cashout"
              onClick={handleCashout}
            >
              <div className="action-btn-main">Cash Out</div>
              <div className="action-btn-sub">
                {(localAmount * currentMultiplier).toFixed(2)} KES
              </div>
            </button>
          ) : (
            <button
              className="btn-terminal-action state-waiting"
              disabled
            >
              <div className="action-btn-main">
                {cashedOut ? 'Cashed Out' : gameState === 'WAITING' ? 'WAITING' : 'FLYING'}
              </div>
              <div className="action-btn-sub">
                {cashedOut
                  ? (localAmount * currentMultiplier).toFixed(2) + ' KES'
                  : localAmount.toFixed(2) + ' KES'}
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
