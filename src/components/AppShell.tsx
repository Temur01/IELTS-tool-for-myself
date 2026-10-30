'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { flushOutbox } from '@/lib/data';

const NAV = [
  { href: '/', label: 'Today', icon: <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" /> },
  { href: '/add', label: 'Add', icon: <path d="M12 5v14M5 12h14" /> },
  { href: '/words', label: 'Words', icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
  { href: '/settings', label: 'Settings', icon: <path d="M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6m-4 4v6" /> },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) flushOutbox();
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const bare = pathname === '/login' || pathname === '/reset-password';

  return (
    <div className="shell">
      {!online && (
        <div className="offline-bar" role="status">
          You&apos;re offline. Ratings are kept on this device and sync when you reconnect.
        </div>
      )}
      {!bare && (
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">F</span>
              Fara
            </Link>
            <nav className="nav" aria-label="Main">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? 'page' : undefined}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {item.icon}
                  </svg>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
      )}
      <main className="container" id="main">
        {children}
      </main>
    </div>
  );
}
