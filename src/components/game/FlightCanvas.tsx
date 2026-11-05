'use client';

import { useEffect, useRef, useState } from 'react';
import { FlightCanvasEngine } from '@/lib/engine/flight-canvas';
import { GlobalRoundSyncEngine, RoundState } from '@/lib/engine/global-sync';

export function FlightCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FlightCanvasEngine | null>(null);
  const syncRef = useRef<GlobalRoundSyncEngine | null>(null);
  
  const [multiplier, setMultiplier] = useState(1.00);
  const [phase, setPhase] = useState<'WAITING' | 'FLYING' | 'CRASHED'>('WAITING');

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize global sync engine
    syncRef.current = new GlobalRoundSyncEngine();

    // Initialize flight canvas engine
    const engine = new FlightCanvasEngine(
      canvasRef.current,
      (mult: number, remaining: number) => {
        setMultiplier(mult);
      },
      (state: 'WAITING' | 'FLYING' | 'CRASHED', data: any) => {
        setPhase(state);
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
