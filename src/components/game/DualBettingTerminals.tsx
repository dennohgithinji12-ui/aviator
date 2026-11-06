'use client';

import { BettingTerminal } from './BettingTerminal';

interface TerminalState {
  amount: number;
  mode: 'manual' | 'auto';
  autoStakeEnabled: boolean;
  autoCashoutEnabled: boolean;
  autoCashoutMultiplier: number;
  staked: boolean;
  cashedOut: boolean;
}

interface DualBettingTerminalsProps {
  terminal1: TerminalState;
  terminal2: TerminalState;
  terminal2Visible: boolean;
  balance: number;
  gameState: 'WAITING' | 'FLYING' | 'CRASHED';
  currentMultiplier: number;
  onTerminal1Change: (state: Partial<TerminalState>) => void;
  onTerminal2Change: (state: Partial<TerminalState>) => void;
  onTerminal1Bet: (amount: number) => void;
  onTerminal2Bet: (amount: number) => void;
  onTerminal1Cashout: () => void;
  onTerminal2Cashout: () => void;
  onTerminal1Cancel: () => void;
  onTerminal2Cancel: () => void;
  onToggleTerminal2: () => void;
}

export function DualBettingTerminals({
  terminal1,
  terminal2,
  terminal2Visible,
  balance,
  gameState,
  currentMultiplier,
  onTerminal1Change,
  onTerminal2Change,
  onTerminal1Bet,
  onTerminal2Bet,
  onTerminal1Cashout,
  onTerminal2Cashout,
  onTerminal1Cancel,
  onTerminal2Cancel,
  onToggleTerminal2
}: DualBettingTerminalsProps) {
  return (
    <div className="dual-betting-terminals" id="dual-terminals-wrapper">
      <BettingTerminal
        terminalId={1}
        amount={terminal1.amount}
        mode={terminal1.mode}
        autoStakeEnabled={terminal1.autoStakeEnabled}
        autoCashoutEnabled={terminal1.autoCashoutEnabled}
        autoCashoutMultiplier={terminal1.autoCashoutMultiplier}
        staked={terminal1.staked}
        cashedOut={terminal1.cashedOut}
        onAmountChange={(id, amount) => {
          if (id === 1) onTerminal1Change({ amount });
        }}
        onBet={(id, amount) => {
          if (id === 1) onTerminal1Bet(amount);
        }}
        onCashout={(id) => {
          if (id === 1) onTerminal1Cashout();
        }}
        onCancel={(id) => {
          if (id === 1) onTerminal1Cancel();
        }}
        onToggleMode={(id, mode) => {
          if (id === 1) onTerminal1Change({ mode });
        }}
        onToggleAutoStake={(id, enabled) => {
          if (id === 1) onTerminal1Change({ autoStakeEnabled: enabled });
        }}
        onToggleAutoCashout={(id, enabled) => {
          if (id === 1) onTerminal1Change({ autoCashoutEnabled: enabled });
        }}
        onAutoCashoutChange={(id, multiplier) => {
          if (id === 1) onTerminal1Change({ autoCashoutMultiplier: multiplier });
        }}
        balance={balance}
        gameState={gameState}
        currentMultiplier={currentMultiplier}
      />

      {terminal2Visible && (
        <BettingTerminal
          terminalId={2}
          amount={terminal2.amount}
          mode={terminal2.mode}
          autoStakeEnabled={terminal2.autoStakeEnabled}
          autoCashoutEnabled={terminal2.autoCashoutEnabled}
          autoCashoutMultiplier={terminal2.autoCashoutMultiplier}
          staked={terminal2.staked}
          cashedOut={terminal2.cashedOut}
          onAmountChange={(id, amount) => {
            if (id === 2) onTerminal2Change({ amount });
          }}
          onBet={(id, amount) => {
            if (id === 2) onTerminal2Bet(amount);
          }}
          onCashout={(id) => {
            if (id === 2) onTerminal2Cashout();
          }}
          onCancel={(id) => {
            if (id === 2) onTerminal2Cancel();
          }}
          onToggleMode={(id, mode) => {
            if (id === 2) onTerminal2Change({ mode });
          }}
          onToggleAutoStake={(id, enabled) => {
            if (id === 2) onTerminal2Change({ autoStakeEnabled: enabled });
          }}
          onToggleAutoCashout={(id, enabled) => {
            if (id === 2) onTerminal2Change({ autoCashoutEnabled: enabled });
          }}
          onAutoCashoutChange={(id, multiplier) => {
            if (id === 2) onTerminal2Change({ autoCashoutMultiplier: multiplier });
          }}
          balance={balance}
          gameState={gameState}
          currentMultiplier={currentMultiplier}
          onClose={() => onToggleTerminal2()}
        />
      )}

      {!terminal2Visible && (
        <button
          className="btn-toggle-second-terminal"
          id="btn-show-terminal-2"
          title="Add Second Bet Panel"
          onClick={onToggleTerminal2}
        >
          <span>+</span> Add Bet
        </button>
      )}
    </div>
  );
}
