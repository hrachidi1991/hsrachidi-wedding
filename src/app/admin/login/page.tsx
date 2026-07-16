'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.push('/admin');
        router.refresh();
      } else {
        setError('Invalid credentials');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-root" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
      <div style={{ width: '100%', maxWidth: '25rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div className="ad-eyebrow" style={{ marginBottom: '0.5rem' }}>Wedding Admin</div>
          <h1 className="ad-title">Hussein &amp; Suzan</h1>
          <p className="ad-page-desc" style={{ marginInline: 'auto' }}>Sign in to manage your wedding website.</p>
        </div>
        <form onSubmit={handleLogin} className="ad-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="ad-field">
            <label className="ad-label" htmlFor="admin-username">Username</label>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="ad-input"
              autoComplete="username"
              required
            />
          </div>
          <div className="ad-field">
            <label className="ad-label" htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ad-input"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <div className="ad-notice ad-notice--bad">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="ad-btn ad-btn--primary"
            style={{ width: '100%' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
