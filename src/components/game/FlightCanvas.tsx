'use client';

import { useEffect, useRef } from 'react';
import { FlightCanvasEngine } from '@/lib/engine/flight-canvas';
import { GlobalRoundSyncEngine, RoundState } from '@/lib/engine/global-sync';
import { SoundEngine } from '@/lib/engine/audio';

type CashoutNotice = { id: number; terminalId: 1 | 2; multiplier: number; payout: number };

export function FlightCanvas({ syncRef: sharedSyncRef, cashoutNotices = [], onDismissCashout }: {
  syncRef?: { current: GlobalRoundSyncEngine | null };
  cashoutNotices?: CashoutNotice[];
  onDismissCashout?: (id: number) => void;
} = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FlightCanvasEngine | null>(null);
  const internalSyncRef = useRef<GlobalRoundSyncEngine | null>(null);
  const syncRef = sharedSyncRef ?? internalSyncRef;
  const soundRef = useRef<SoundEngine | null>(null);
  const lastTickRef = useRef(0);
  
  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize global sync engine
    if (!syncRef.current) syncRef.current = new GlobalRoundSyncEngine();
    soundRef.current = new SoundEngine();
    if (localStorage.getItem('shiftstack_sound_enabled') === 'false') soundRef.current.toggleSound();
    if (localStorage.getItem('shiftstack_music_enabled') === 'false') soundRef.current.toggleMusic();
    const onSetting = (event: Event) => {
      const { setting, value } = (event as CustomEvent<{ setting: string; value: boolean }>).detail;
      if (setting === 'animation') {
        engineRef.current?.setAnimationEnabled(value);
        return;
      }
      const sound = soundRef.current;
      if (!sound) return;
      if (setting === 'sound' && sound.soundMuted === value) sound.toggleSound();
      if (setting === 'music' && sound.musicMuted === value) sound.toggleMusic();
    };
    const onCashoutSuccess = () => soundRef.current?.playCashout();
    window.addEventListener('aviator:setting', onSetting);
    window.addEventListener('aviator:cashout-success', onCashoutSuccess);

    // Initialize flight canvas engine
    const engine = new FlightCanvasEngine(
      canvasRef.current,
      (mult: number, remaining: number) => {
        const sound = soundRef.current;
        if (sound && mult > 1) sound.updateEnginePitch(mult);
        const tick = Math.ceil(remaining);
        if (sound && remaining > 0 && tick !== lastTickRef.current) {
          lastTickRef.current = tick;
          sound.playCountdownTick(tick);
        }
      },
      (state: 'WAITING' | 'FLYING' | 'CRASHED', data: any) => {
        const sound = soundRef.current;
        if (!sound) return;
        if (state === 'FLYING') {
          lastTickRef.current = 0;
          sound.playTakeoff();
          sound.startEngine();
        } else if (state === 'CRASHED') {
          sound.playCrash();
        } else {
          sound.stopEngine();
        }
      },
      syncRef.current
    );

    engineRef.current = engine;
    engine.setAnimationEnabled(localStorage.getItem('shiftstack_animation_enabled') !== 'false');

    return () => {
      window.removeEventListener('aviator:setting', onSetting);
      window.removeEventListener('aviator:cashout-success', onCashoutSuccess);
      syncRef.current?.stop();
      syncRef.current = null;
      soundRef.current?.stopEngine();
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="flight-canvas-container" id="flight-canvas-container">
      <canvas ref={canvasRef} id="flight-canvas" />
      <div className="cashout-popup-stack" aria-live="polite">
        {cashoutNotices.map((notice) => <div className="cashout-popup" role="status" key={notice.id}>
          <div className="cashout-popup-result"><span>You cashed out · Bet {notice.terminalId}</span><strong>{notice.multiplier.toFixed(2)}x</strong></div>
          <div className="cashout-popup-winnings"><span>WIN, KES</span><strong>{notice.payout.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
          <button type="button" className="cashout-popup-close" aria-label="Dismiss cashout result" onClick={() => onDismissCashout?.(notice.id)}>×</button>
        </div>)}
      </div>
      <div className="ufc-partners-overlay">
        <span className="ufc-logo-tag">UFC</span><span>|</span>
        <span className="partner-mark"><svg width="14" height="12" viewBox="0 0 40 32" fill="#ff003b"><path d="M4 18 C 12 16, 22 14, 38 7 C 32 15, 26 21, 18 24 C 12 25, 6 23, 4 18 Z" /></svg> OFFICIAL PARTNERS</span>
      </div>
      <div className="spribe-verified-badge"><div className="spribe-verified-top"><span>SPRIBE</span><span>✓ Official Game</span></div><span className="spribe-verified-sub">Since 2019</span></div>
      <div className="canvas-stakers-badge"><div className="avatar-cluster"><span>🍀</span><span>👑</span><span>💵</span></div><span>200</span></div>
    </div>
  );
}
