'use client';

import { useEffect, useRef } from 'react';
import { FlightCanvasEngine } from '@/lib/engine/flight-canvas';
import { GlobalRoundSyncEngine, RoundState } from '@/lib/engine/global-sync';
import { SoundEngine } from '@/lib/engine/audio';

export function FlightCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FlightCanvasEngine | null>(null);
  const syncRef = useRef<GlobalRoundSyncEngine | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const lastTickRef = useRef(0);
  
  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize global sync engine
    syncRef.current = new GlobalRoundSyncEngine();
    soundRef.current = new SoundEngine();
    const onSetting = (event: Event) => {
      const { setting, value } = (event as CustomEvent<{ setting: string; value: boolean }>).detail;
      const sound = soundRef.current;
      if (!sound) return;
      if (setting === 'sound' && sound.soundMuted === value) sound.toggleSound();
      if (setting === 'music' && sound.musicMuted === value) sound.toggleMusic();
    };
    window.addEventListener('aviator:setting', onSetting);

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

    // Periodic state sync
    const interval = setInterval(() => {
      // GlobalRoundSyncEngine owns ordered server snapshots and smooth clock interpolation.
    }, 250);

    return () => {
      clearInterval(interval);
      window.removeEventListener('aviator:setting', onSetting);
      if (syncRef.current?.syncTimer) clearInterval(syncRef.current.syncTimer);
      soundRef.current?.stopEngine();
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="flight-canvas-container" id="flight-canvas-container">
      <canvas ref={canvasRef} id="flight-canvas" />
      <div className="ufc-partners-overlay">
        <span className="ufc-logo-tag">UFC</span><span>|</span>
        <span className="partner-mark"><svg width="14" height="12" viewBox="0 0 40 32" fill="#ff003b"><path d="M4 18 C 12 16, 22 14, 38 7 C 32 15, 26 21, 18 24 C 12 25, 6 23, 4 18 Z" /></svg> OFFICIAL PARTNERS</span>
      </div>
      <div className="spribe-verified-badge"><div className="spribe-verified-top"><span>SPRIBE</span><span>✓ Official Game</span></div><span className="spribe-verified-sub">Since 2019</span></div>
      <div className="canvas-stakers-badge"><div className="avatar-cluster"><span>🍀</span><span>👑</span><span>💵</span></div><span>200</span></div>
    </div>
  );
}
