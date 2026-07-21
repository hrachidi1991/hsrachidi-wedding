'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface Msg { id: string; sender: string; body: string; createdAt: string }
interface Thread { groupCode: string; label: string; side: string; messages: Msg[]; lastAt: string | null }

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const SEEN_KEY = 'msgSeen'; // localStorage: { [groupCode]: epoch-ms last seen }

// newest GUEST message time in a thread (couple/own replies don't count as unread)
const latestGuestAt = (t: Thread) =>
  t.messages.reduce((mx, m) => {
    if (m.sender !== 'guest') return mx;
    const ts = new Date(m.createdAt).getTime();
    return ts > mx ? ts : mx;
  }, 0);

export default function MessagesPage() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');
  const initialSeen = useRef<Record<string, number>>({}); // snapshot at load → keeps order stable this visit

  useEffect(() => {
    let stored: Record<string, number> = {};
    try { const s = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); if (s && typeof s === 'object') stored = s; } catch { /* ignore */ }
    initialSeen.current = stored;
    setSeen(stored);
    fetch('/api/messages?all=1')
      .then((r) => r.json())
      .then((d) => setThreads(Array.isArray(d.threads) ? d.threads : []))
      .catch(() => setThreads([]));
  }, []);

  const persistSeen = (next: Record<string, number>) => {
    setSeen(next);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const newCount = (t: Thread, ref: Record<string, number>) =>
    t.messages.filter((m) => m.sender === 'guest' && new Date(m.createdAt).getTime() > (ref[t.groupCode] || 0)).length;

  const unreadNow = (t: Thread) => latestGuestAt(t) > (seen[t.groupCode] || 0);

  const markRead = (t: Thread) => {
    const at = latestGuestAt(t) || Date.now();
    if ((seen[t.groupCode] || 0) >= at) return;
    persistSeen({ ...seen, [t.groupCode]: at });
  };
  const markAllRead = () => {
    const next = { ...seen };
    (threads || []).forEach((t) => { next[t.groupCode] = Math.max(next[t.groupCode] || 0, latestGuestAt(t) || Date.now()); });
    persistSeen(next);
  };

  const filtered = useMemo(() => {
    if (!threads) return [];
    const s = q.trim().toLowerCase();
    if (!s) return threads;
    return threads.filter(
      (t) => t.label.toLowerCase().includes(s) || t.groupCode.toLowerCase().includes(s) || t.messages.some((m) => m.body.toLowerCase().includes(s)),
    );
  }, [threads, q]);

  // Order: threads that were unread WHEN THE PAGE OPENED come first (stable within
  // the visit even after you read them), then by most recent activity.
  const ordered = useMemo(() => {
    const wasUnread = (t: Thread) => latestGuestAt(t) > (initialSeen.current[t.groupCode] || 0);
    return filtered.slice().sort((a, b) => {
      const d = (wasUnread(b) ? 1 : 0) - (wasUnread(a) ? 1 : 0);
      if (d !== 0) return d;
      return new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime();
    });
  }, [filtered]);

  const unreadThreads = (threads || []).filter(unreadNow);
  const totalNew = unreadThreads.reduce((n, t) => n + newCount(t, seen), 0);
  const totalMsgs = threads ? threads.reduce((n, t) => n + t.messages.length, 0) : 0;

  return (
    <div>
      <header className="ad-header">
        <div>
          <div className="ad-eyebrow" style={{ marginBottom: '0.4rem' }}>Inbox</div>
          <h1 className="ad-title">Messages</h1>
          <p className="ad-page-desc">
            Every wish guests have left, grouped by their invitation link. Reply from here, or remove any message.
          </p>
        </div>
      </header>

      {/* New-message notification */}
      {unreadThreads.length > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
            background: 'rgba(31,74,58,0.08)', border: '1px solid rgba(31,74,58,0.25)',
            borderRadius: 12, padding: '0.7rem 0.95rem', marginBottom: '1rem',
          }}
        >
          <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>🔔</span>
          <span style={{ fontSize: '0.9rem', color: 'var(--ad-ink)' }}>
            <strong>{totalNew} new message{totalNew === 1 ? '' : 's'}</strong> from{' '}
            {unreadThreads.slice(0, 4).map((t) => t.label).join(', ')}
            {unreadThreads.length > 4 ? ` +${unreadThreads.length - 4} more` : ''}
          </span>
          <button className="ad-link-btn" style={{ marginLeft: 'auto' }} onClick={markAllRead}>Mark all as read</button>
        </div>
      )}

      {threads === null ? (
        <div className="ad-card" style={{ padding: '1.25rem' }}>Loading…</div>
      ) : threads.length === 0 ? (
        <div className="ad-empty">No messages yet. When guests write on their link, their notes appear here.</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <input
              className="ad-input"
              type="search"
              placeholder="Search messages, names, or group…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ maxWidth: 360, width: '100%', flex: '1 1 240px' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--ad-muted)' }}>
              {threads.length} thread{threads.length === 1 ? '' : 's'} · {totalMsgs} message{totalMsgs === 1 ? '' : 's'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {ordered.map((t) => (
              <ThreadCard key={t.groupCode} thread={t} unread={unreadNow(t)} newCount={newCount(t, seen)} onMarkRead={() => markRead(t)} />
            ))}
            {ordered.length === 0 && <div className="ad-empty">No matches.</div>}
          </div>
        </>
      )}
    </div>
  );
}

function ThreadCard({ thread, unread, newCount, onMarkRead }: { thread: Thread; unread: boolean; newCount: number; onMarkRead: () => void }) {
  const [messages, setMessages] = useState<Msg[]>(thread.messages);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const del = async (id: string) => {
    if (!window.confirm('Delete this message? This cannot be undone.')) return;
    setMessages((m) => m.filter((x) => x.id !== id));
    try {
      await fetch('/api/messages', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, groupCode: thread.groupCode }) });
    } catch { /* ignore */ }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupCode: thread.groupCode, body }) });
      if (res.ok) {
        const d = await res.json();
        if (d.message) setMessages((m) => [...m, d.message]);
        setText('');
        onMarkRead(); // replying means you've read it
      }
    } catch { /* ignore */ }
    setBusy(false);
  };

  return (
    <div className="ad-card" style={unread ? { borderColor: 'rgba(31,74,58,0.45)', boxShadow: '0 0 0 1px rgba(31,74,58,0.25)' } : undefined}>
      <div className="ad-header" style={{ marginBottom: '0.7rem', alignItems: 'flex-start' }}>
        <div>
          <div className="ad-eyebrow" style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Group {thread.groupCode}{thread.side ? ` · ${cap(thread.side)}` : ''}
            {unread && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#1F4A3A', color: '#fff', borderRadius: 999, padding: '1px 8px', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.02em' }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: '#fff' }} />
                {newCount} NEW
              </span>
            )}
          </div>
          <div className="ad-section-title">{thread.label}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          {unread && <button className="ad-link-btn" onClick={onMarkRead}>Mark read</button>}
          <a className="ad-link-btn" href={`/?g=${thread.groupCode}`} target="_blank" rel="noopener noreferrer">Open link ↗</a>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.7rem' }}>
        {messages.length === 0 ? (
          <div className="ad-empty" style={{ padding: '0.6rem' }}>All messages removed.</div>
        ) : (
          messages.map((m) => {
            const couple = m.sender === 'couple';
            return (
              <div key={m.id} style={{ alignSelf: couple ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div
                  style={{
                    borderRadius: 12, padding: '0.4rem 0.6rem', fontSize: '0.85rem', lineHeight: 1.4,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: couple ? '#1F4A3A' : 'var(--ad-raised)', color: couple ? '#fff' : 'var(--ad-ink)',
                    border: couple ? 'none' : '1px solid var(--ad-border)',
                  }}
                >
                  <span style={{ display: 'block', fontSize: '0.62rem', fontWeight: 600, opacity: 0.75, marginBottom: 2 }}>
                    {couple ? 'You' : 'Guest'}
                  </span>
                  {m.body}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 2, justifyContent: couple ? 'flex-end' : 'flex-start', fontSize: '0.62rem', color: 'var(--ad-muted)' }}>
                  <span>{new Date(m.createdAt).toLocaleString()}</span>
                  <button className="ad-link-btn" style={{ fontSize: '0.62rem' }} onClick={() => del(m.id)}>Delete</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder="Reply to this group…"
          className="ad-input"
          style={{ flex: 1, resize: 'none', maxHeight: 80 }}
        />
        <button className="ad-btn ad-btn--primary" disabled={busy || !text.trim()} onClick={send} style={{ flexShrink: 0 }}>Send</button>
      </div>
    </div>
  );
}
