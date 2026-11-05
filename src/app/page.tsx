'use client';

import { Header } from '@/components/layout/Header';
import { AviatorConsole } from '@/components/game/AviatorConsole';

export default function Home() {
  return (
    <div className="aviator-app">
      <Header />
      <main className="app-main">
        <AviatorConsole />
      </main>
    </div>
  );
}
