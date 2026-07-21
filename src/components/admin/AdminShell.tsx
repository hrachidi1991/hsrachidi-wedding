'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

type IconProps = { className?: string };

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function DashboardIcon({ className }: IconProps) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" className={className} {...stroke}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function ContentIcon({ className }: IconProps) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function GuestListIcon({ className }: IconProps) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function SeatingIcon({ className }: IconProps) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M4 18v-6a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v1h6v-1a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v6" />
      <path d="M6 13V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7" />
      <path d="M4 18h16" />
      <path d="M6 18v2M18 18v2" />
    </svg>
  );
}

function RsvpIcon({ className }: IconProps) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" className={className} {...stroke}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}

function MessagesIcon({ className }: IconProps) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6a8.5 8.5 0 0 1-.9-3.9A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />
    </svg>
  );
}

function GlobeIcon({ className }: IconProps) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </svg>
  );
}

function LogoutIcon({ className }: IconProps) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

const navItems = [
  { href: '/admin', label: 'Dashboard', Icon: DashboardIcon },
  { href: '/admin/content', label: 'Content & Settings', Icon: ContentIcon },
  { href: '/admin/guest-list', label: 'Guest List', Icon: GuestListIcon },
  { href: '/admin/seating', label: 'Seating Map', Icon: SeatingIcon },
  { href: '/admin/rsvp', label: 'RSVP Tracking', Icon: RsvpIcon },
  { href: '/admin/messages', label: 'Messages', Icon: MessagesIcon },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/admin/login');
  };

  return (
    <div className="admin-root admin-shell">
      {/* Mobile top bar */}
      <header className="ad-topbar">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="ad-hamburger"
          aria-label="Open navigation menu"
          aria-expanded={sidebarOpen}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="ad-topbar__brand">Hussein &amp; Suzan</span>
      </header>

      {/* Mobile scrim */}
      {sidebarOpen && (
        <div className="ad-scrim md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar */}
      <aside className={`ad-sidebar${sidebarOpen ? ' is-open' : ''}`} aria-label="Admin navigation">
        <div className="ad-brand">
          <div className="ad-brand__names">Hussein &amp; Suzan</div>
          <div className="ad-brand__label">Wedding Admin</div>
        </div>

        <nav className="ad-nav">
          {navItems.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`ad-nav-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ad-sidebar-foot">
          <Link href="/" target="_blank" className="ad-foot-link">
            <GlobeIcon />
            View website
          </Link>
          <button onClick={handleLogout} className="ad-foot-link ad-foot-link--danger">
            <LogoutIcon />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ad-main">
        <div className="ad-main__inner">{children}</div>
      </main>
    </div>
  );
}
