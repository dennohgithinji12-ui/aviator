'use client';

import { ReactNode } from 'react';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';

export function AppPageFrame({ children }: { children: ReactNode }) {
  return <div className="aviator-app">
    <Header />
    <main className="app-main app-content-page">{children}</main>
    <MobileBottomNav />
  </div>;
}
