'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/content', label: 'Content & Settings', icon: '✏️' },
  { href: '/admin/guests', label: 'Guests & Groups', icon: '👥' },
  { href: '/admin/rsvp', label: 'RSVP Tracking', icon: '✉️' },
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
    <div className="admin-layout flex min-h-screen bg-gray-50" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-[#1a1a2e] text-white flex items-center justify-between px-4 py-3 md:hidden">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="text-sm font-bold">HSRachidi Admin</h1>
        <div className="w-6" />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar flex flex-col w-64 flex-shrink-0 fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-5 border-b border-white/10">
          <h1 className="text-lg font-bold">HSRachidi</h1>
          <p className="text-xs text-gray-400 mt-0.5">Wedding Admin</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                pathname === item.href
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <Link href="/" target="_blank" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition">
            🌐 View Website
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-red-300 rounded-lg hover:bg-white/5 transition mt-1"
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto text-gray-900 pt-14 md:pt-0">
        <div className="p-4 sm:p-6 max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
