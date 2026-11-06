'use client';

import { useEffect, useRef, useState } from 'react';
import { FlightCanvasEngine } from '@/lib/engine/flight-canvas';
import { GlobalRoundSyncEngine, RoundState } from '@/lib/engine/global-sync';
import { SoundEngine } from '@/lib/engine/audio';

export function FlightCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FlightCanvasEngine | null>(null);
  const syncRef = useRef<GlobalRoundSyncEngine | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const lastTickRef = useRef(0);
  
  const [multiplier, setMultiplier] = useState(1.00);
  const [phase, setPhase] = useState<'WAITING' | 'FLYING' | 'CRASHED'>('WAITING');

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize global sync engine
    syncRef.current = new GlobalRoundSyncEngine();
    soundRef.current = new SoundEngine();

    // Initialize flight canvas engine
    const engine = new FlightCanvasEngine(
      canvasRef.current,
      (mult: number, remaining: number) => {
        setMultiplier(mult);
        const sound = soundRef.current;
        if (sound && mult > 1) sound.updateEnginePitch(mult);
        const tick = Math.ceil(remaining);
        if (sound && remaining > 0 && tick !== lastTickRef.current) {
          lastTickRef.current = tick;
          sound.playCountdownTick(tick);
        }
      },
      (state: 'WAITING' | 'FLYING' | 'CRASHED', data: any) => {
        setPhase(state);
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
      if (syncRef.current) {
        const state = syncRef.current.getGlobalRoundState();
        // Update UI based on server state
      }
    }, 250);

    return () => {
      clearInterval(interval);
      soundRef.current?.stopEngine();
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="flight-canvas-container" id="flight-canvas-container">
      <canvas ref={canvasRef} id="flight-canvas" />
    </div>
  );
}
