'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type ModuleKey = 'home' | 'sports' | 'casino' | 'aviator' | 'me';
type ModuleSettings = Record<ModuleKey, boolean>;
const defaultModules: ModuleSettings = { home: true, sports: true, casino: true, aviator: true, me: true };
const items: { key: ModuleKey; href: string; label: string; icon: ReactNode }[] = [
  { key: 'home', href: '/home', label: 'Home', icon: <svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-7v6h-4A1.5 1.5 0 0 1 3 19.5z" /></svg> },
  { key: 'sports', href: '/sports', label: 'Sports', icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m12 3 2.3 5.1 5.7.8-4.1 4 .9 5.6-4.8-2.7-4.8 2.7.9-5.6-4.1-4 5.7-.8z" /></svg> },
  { key: 'casino', href: '/casino', label: 'Casino', icon: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1" /><circle cx="16" cy="8" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="8" cy="16" r="1" /><circle cx="16" cy="16" r="1" /></svg> },
  { key: 'aviator', href: '/', label: 'Aviator', icon: <svg viewBox="0 0 40 32"><path d="M4 18C12 16 22 14 38 7c-6 8-12 14-20 17-6 1-12-1-14-6Z" /></svg> },
  { key: 'me', href: '/account', label: 'Me', icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg> }
];

export function MobileBottomNav() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [modules, setModules] = useState(defaultModules);
  useEffect(() => {
    let current = true;
    fetch('/api/modules', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((result) => {
      if (current && result?.success && result.modules) setModules({ ...defaultModules, ...result.modules });
    }).catch(() => undefined);
    const refresh = () => {
      fetch('/api/modules', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((result) => {
        if (current && result?.success && result.modules) setModules({ ...defaultModules, ...result.modules });
      }).catch(() => undefined);
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('aviator:modules-updated', refresh);
    return () => { current = false; window.removeEventListener('focus', refresh); window.removeEventListener('aviator:modules-updated', refresh); };
  }, []);
  return <nav className="app-mobile-nav" aria-label="Main navigation">
    {items.filter((item) => modules[item.key]).map((item) => {
      const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
      return <Link key={item.href} href={item.href} onClick={(event) => { if (item.key === 'me' && !isAuthenticated) { event.preventDefault(); window.dispatchEvent(new CustomEvent('aviator:open-auth')); } }} className={`app-mobile-nav-item nav-${item.key}${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
        {item.key === 'aviator' && <span className="bnav-badge-pill">● LIVE</span>}
        <span aria-hidden="true">{item.icon}</span><small>{item.label}</small>
      </Link>;
    })}
  </nav>;
}
