'use client';

import { AppPageFrame } from '@/components/layout/AppPageFrame';
import { AviatorConsole } from '@/components/game/AviatorConsole';

export default function Home() {
  return (
    <AppPageFrame>
        <AviatorConsole />
    </AppPageFrame>
  );
}
