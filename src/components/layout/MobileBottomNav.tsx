'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Aviator', icon: '✈' },
  { href: '/liquidity', label: 'Liquidity', icon: '◈' },
  { href: '/rollover', label: 'Rollover', icon: '↗' },
  { href: '/verify', label: 'Verify', icon: '✓' }
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return <nav className="app-mobile-nav" aria-label="Main navigation">
    {items.map((item) => {
      const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
      return <Link key={item.href} href={item.href} className={`app-mobile-nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
        <span aria-hidden="true">{item.icon}</span><small>{item.label}</small>
      </Link>;
    })}
  </nav>;
}
