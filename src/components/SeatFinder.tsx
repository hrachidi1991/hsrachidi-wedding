'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SEAT_BY_CODE, PLAN_IMAGE, VIEWBOX } from '@/lib/seatLayout';

// ── Types ──────────────────────────────────────────────────────────────────
interface Guest {
  id: string;
  name: string;
  displayName?: string | null;
  phone?: string | null;
  side: string;
  groupCode: string;
  seatCode: string | null;
  seatLabel: string | null;
  tableName: string | null;
  tableNum: string | null;
  present: boolean;
}
interface GroupResult {
  groupCode: string;
  side: string;
  members: Guest[];
}

type Role = 'admin' | 'hostess' | 'viewer' | null;

// Shared seat-finder UI. variant "admin" = staff tool (check-in toggle when the
// signed-in role allows it); variant "public" = guest-facing lookup (read-only).
export default function SeatFinder({ variant = 'admin' }: { variant?: 'admin' | 'public' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [tableCodes, setTableCodes] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState('');
  const [highlight, setHighlight] = useState<Guest | null>(null);
  const [role, setRole] = useState<Role>(null);
  const canMark = variant === 'admin' && (role === 'admin' || role === 'hostess');
  const showPresent = variant === 'admin';

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/seat-finder');
      if (!r.ok) throw new Error('load failed');
      const data = await r.json();
      setRole(data.role ?? null);
      const tblCodes: Record<string, string[]> = {};
      for (const t of (data.tables || [])) tblCodes[t.name] = t.codes;
      setTableCodes(tblCodes);
      setGuests(Array.isArray(data.guests) ? data.guests : []);
    } catch {
      setError('Could not load seating data. Please try again.');
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const togglePresent = async (g: Guest) => {
    if (!canMark || !g.seatCode) return;
    const next = !g.present;
    setGuests((prev) => prev.map((x) => (x.id === g.id ? { ...x, present: next } : x)));
    if (highlight?.id === g.id) setHighlight({ ...g, present: next });
    try {
      const res = await fetch('/api/seat-finder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: g.seatCode, present: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setGuests((prev) => prev.map((x) => (x.id === g.id ? { ...x, present: !next } : x)));
    }
  };

  const results = useMemo<GroupResult[]>(() => {
    const q = search.toLowerCase().trim();
    if (q.length < 2) return [];
    const norm = (s?: string | null) => (s || '').toLowerCase();
    const hitGroups = new Set<string>();
    for (const g of guests) {
      if (norm(g.name).includes(q) || norm(g.displayName).includes(q) ||
          norm(g.groupCode) === q || norm(g.groupCode).includes(q)) {
        hitGroups.add(g.groupCode);
      }
    }
    const byGroup: Record<string, Guest[]> = {};
    for (const g of guests) if (hitGroups.has(g.groupCode)) (byGroup[g.groupCode] ||= []).push(g);
    return Object.entries(byGroup)
      .map(([groupCode, members]) => ({ groupCode, side: members[0]?.side || 'groom', members }))
      .sort((a, b) => a.groupCode.localeCompare(b.groupCode, undefined, { numeric: true }));
  }, [guests, search]);

  const totalMatched = results.reduce((n, r) => n + r.members.length, 0);

  return (
    <div>
      <FindSeatStyles />
      <header className="ad-header">
        <div>
          {variant === 'public' ? (
            <>
              <div className="ad-eyebrow" style={{ marginBottom: '0.4rem' }}>Hussein &amp; Suzan</div>
              <h1 className="ad-title">Find Your Seat</h1>
              <p className="ad-page-desc">Type your name to find your table, then tap the seat to see exactly where it is.</p>
            </>
          ) : (
            <>
              <div className="ad-eyebrow" style={{ marginBottom: '0.4rem' }}>Hostess</div>
              <h1 className="ad-title">Find a Guest&rsquo;s Seat</h1>
              <p className="ad-page-desc">Search a guest by name to see their whole group and seats. Tap a seat for the plan.{canMark ? ' As guests arrive, tap “Present?” to check them in — their seat turns green.' : ''}</p>
            </>
          )}
        </div>
      </header>

      <div className="fs-searchwrap">
        <span className="fs-search-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        </span>
        <input
          type="text"
          className="fs-search"
          placeholder={variant === 'public' ? 'Type your name…' : 'Type a guest name or group code…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search guests"
          autoFocus
        />
        {search && <button className="fs-clear" onClick={() => setSearch('')} aria-label="Clear">&times;</button>}
      </div>

      {loading ? (
        <div className="fs-hint">Loading…</div>
      ) : error ? (
        <div className="ad-notice ad-notice--bad" role="alert">{error} <button className="ad-link-btn" onClick={load}>Retry</button></div>
      ) : search.trim().length < 2 ? (
        <div className="fs-empty">
          <div className="fs-empty-icon" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          </div>
          <h2 className="ad-section-title" style={{ marginTop: '0.9rem' }}>{variant === 'public' ? 'Search for your name' : 'Search for a guest'}</h2>
          <p className="ad-page-desc" style={{ margin: '0.4rem auto 0', maxWidth: 380 }}>Start typing a name — you&rsquo;ll see everyone in the group and their seats.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="fs-empty">
          <p className="ad-empty">No guest matches &ldquo;{search}&rdquo;.</p>
        </div>
      ) : (
        <>
          <div className="fs-count">{results.length} group{results.length > 1 ? 's' : ''} · {totalMatched} guest{totalMatched > 1 ? 's' : ''}</div>
          <div className="fs-results">
            {results.map((grp) => {
              const counts: Record<string, number> = {};
              for (const m of grp.members) if (m.tableNum) counts[m.tableNum] = (counts[m.tableNum] || 0) + 1;
              const distinct = Object.keys(counts);
              const mainTable = distinct.length
                ? distinct.sort((a, b) => (counts[b] - counts[a]) || (parseInt(a) - parseInt(b)))[0]
                : null;
              const split = distinct.length > 1;
              return (
                <div key={grp.groupCode} className="fs-group">
                  <div className="fs-group__head">
                    <span className={`ad-pill ${grp.side === 'bride' ? 'ad-pill--accent' : 'ad-pill--neutral'}`}>{cap(grp.side)}</span>
                    <span className="fs-group__code">Group {grp.groupCode}</span>
                    {split && (
                      <span className="fs-split" title="This group is seated across more than one table">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
                        split tables
                      </span>
                    )}
                    <span className="fs-group__count">{grp.members.length} {grp.members.length > 1 ? 'guests' : 'guest'}</span>
                  </div>
                  <ul className="fs-members">
                    {grp.members.map((m) => {
                      const off = !!(m.seatCode && m.tableNum && mainTable && m.tableNum !== mainTable);
                      const isPresent = showPresent && m.present;
                      return (
                        <li key={m.id} className="fs-member">
                          <span className="fs-avatar" aria-hidden="true">{initials(m.displayName || m.name)}</span>
                          <span className="fs-member__text">
                            <span className="fs-member__display">{m.displayName || m.name}</span>
                            {m.displayName && m.displayName !== m.name && <span className="fs-member__name">{m.name}</span>}
                          </span>
                          <span className="fs-actions">
                            {m.seatCode && canMark && (
                              <button type="button" className={`fs-present-btn${m.present ? ' is-on' : ''}`} onClick={() => togglePresent(m)} title={m.present ? 'Arrived — tap to undo' : 'Mark as arrived'}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                {m.present ? 'Present' : 'Present?'}
                              </button>
                            )}
                            {m.seatCode && showPresent && !canMark && m.present && (
                              <span className="fs-present-chip"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Present</span>
                            )}
                            {m.seatCode ? (
                              <button type="button" className={`fs-seat${isPresent ? ' fs-seat--present' : off ? ' fs-seat--other' : ''}`} onClick={() => setHighlight(m)} title={off && !isPresent ? `Seated at table ${m.tableNum}, apart from the rest of the group (table ${mainTable})` : undefined}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                <span className="fs-seat__label">{m.seatLabel}</span>
                              </button>
                            ) : (
                              <span className="fs-seat fs-seat--none">No seat yet</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}

      {highlight && highlight.seatCode && (
        <SeatMapModal guest={highlight} tableCodes={tableCodes} onClose={() => setHighlight(null)} />
      )}
    </div>
  );
}

// ── Map highlight modal ──────────────────────────────────────────────────────
function SeatMapModal({ guest, tableCodes, onClose }: { guest: Guest; tableCodes: Record<string, string[]>; onClose: () => void }) {
  const seat = guest.seatCode ? SEAT_BY_CODE[guest.seatCode] : null;
  const areaCodes = guest.tableName ? (tableCodes[guest.tableName] || []) : [];
  const escRef = useRef(onClose);
  escRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') escRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tableCentroids = useMemo(() => {
    const groups: Record<string, { x: number; y: number; n: number }> = {};
    for (const [name, codes] of Object.entries(tableCodes)) {
      const num = (name.match(/^\d+/) || [name])[0];
      for (const c of codes) {
        const s = SEAT_BY_CODE[c]; if (!s) continue;
        const g = (groups[num] ||= { x: 0, y: 0, n: 0 }); g.x += s.x; g.y += s.y; g.n++;
      }
    }
    return Object.entries(groups).map(([num, g]) => ({ num, cx: g.x / g.n, cy: g.y / g.n }));
  }, [tableCodes]);

  if (!seat) return null;

  const W = 620, H = W * (VIEWBOX.h / VIEWBOX.w);
  const x0 = Math.max(0, Math.min(seat.x - W / 2, VIEWBOX.w - W));
  const y0 = Math.max(0, Math.min(seat.y - H / 2, VIEWBOX.h - H));

  return (
    <div className="fs-modal-scrim" onClick={onClose} role="presentation">
      <div className="fs-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Seat ${guest.seatLabel}`}>
        <div className="fs-modal__head">
          <div style={{ minWidth: 0 }}>
            <div className="ad-eyebrow">{guest.displayName || guest.name}</div>
            <h3 className="fs-modal__seat">Seat {guest.seatLabel}</h3>
          </div>
          <button type="button" className="ad-icon-btn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="fs-map">
          <svg className="fs-map__zoom" viewBox={`${x0} ${y0} ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Zoomed seating area">
            <image href={PLAN_IMAGE} x={0} y={0} width={VIEWBOX.w} height={VIEWBOX.h} preserveAspectRatio="none" />
            {areaCodes.map((c) => {
              const s = SEAT_BY_CODE[c]; if (!s) return null;
              return <rect key={c} x={s.x - 7} y={s.y - 7} width={14} height={14} rx={3} className="fs-area" />;
            })}
            {tableCentroids.map((t) => (
              <g key={t.num} className="fs-tnum" aria-hidden="true">
                <circle cx={t.cx} cy={t.cy} r={13} />
                <text x={t.cx} y={t.cy} textAnchor="middle" dominantBaseline="central">{t.num}</text>
              </g>
            ))}
            <circle cx={seat.x} cy={seat.y} r={20} className="fs-ping" />
            <circle cx={seat.x} cy={seat.y} r={10} className="fs-dot" />
          </svg>

          <div className="fs-mini">
            <span className="fs-mini__cap">Where in the room</span>
            <svg viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Full plan overview">
              <image href={PLAN_IMAGE} x={0} y={0} width={VIEWBOX.w} height={VIEWBOX.h} preserveAspectRatio="none" />
              <rect x={x0} y={y0} width={W} height={H} className="fs-mini__box" />
              <circle cx={seat.x} cy={seat.y} r={34} className="fs-mini__mark" />
            </svg>
          </div>
        </div>
        <p className="fs-modal__hint">The glowing seat is <strong>{guest.seatLabel}</strong>{guest.tableName ? ` at table ${(guest.tableName.match(/^\d+/) || [''])[0]}` : ''}. The small map shows which part of the room.</p>
      </div>
    </div>
  );
}

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

function FindSeatStyles() {
  return (
    <style>{`
    .fs-searchwrap { position: relative; margin-bottom: 1.25rem; }
    .fs-search-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--ad-muted); pointer-events: none; }
    .fs-search {
      width: 100%; padding: 0.95rem 2.6rem 0.95rem 2.9rem; font-size: 1.05rem;
      border: 1px solid var(--ad-border); border-radius: 14px; background: var(--ad-surface);
      color: var(--ad-ink); box-shadow: var(--ad-shadow);
    }
    .fs-search:focus { outline: none; border-color: var(--ad-accent); box-shadow: 0 0 0 3px var(--ad-accent-soft); }
    .fs-clear { position: absolute; right: 0.7rem; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; border: none; background: var(--ad-raised); border-radius: 50%; font-size: 1.2rem; line-height: 1; color: var(--ad-muted); cursor: pointer; }

    .fs-hint, .fs-count { color: var(--ad-muted); font-size: 0.85rem; margin-bottom: 0.75rem; }
    .fs-empty { text-align: center; padding: 3rem 1.5rem; color: var(--ad-muted); }
    .fs-empty-icon { display: inline-flex; align-items: center; justify-content: center; width: 62px; height: 62px; border-radius: 50%; background: var(--ad-accent-soft); color: var(--ad-accent-strong); }

    .fs-results { display: flex; flex-direction: column; gap: 1rem; }
    .fs-group { background: var(--ad-surface); border: 1px solid var(--ad-border); border-radius: var(--ad-r-card); box-shadow: var(--ad-shadow); overflow: hidden; }
    .fs-group__head { display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1rem; border-bottom: 1px solid var(--ad-border); background: var(--ad-raised); }
    .fs-group__code { font-weight: 700; color: var(--ad-ink); font-family: var(--ad-font-serif, Georgia, serif); }
    .fs-group__count { margin-left: auto; font-size: 0.76rem; color: var(--ad-muted); }

    .fs-members { list-style: none; margin: 0; padding: 0.4rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .fs-member { display: flex; align-items: center; gap: 0.75rem; padding: 0.55rem 0.6rem; border-radius: var(--ad-r-ctrl); }
    .fs-member:hover { background: var(--ad-raised); }
    .fs-avatar { flex: 0 0 auto; width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--ad-accent-soft); color: var(--ad-accent-strong); font-weight: 600; font-family: var(--ad-font-serif); }
    .fs-member__text { min-width: 0; display: flex; flex-direction: column; flex: 1; }
    .fs-member__display { font-weight: 600; color: var(--ad-ink); font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fs-member__name { font-size: 0.78rem; color: var(--ad-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .fs-seat { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.7rem; border-radius: 999px; border: 1px solid var(--ad-accent); background: var(--ad-accent-soft); color: var(--ad-accent-strong); font-weight: 700; cursor: pointer; transition: background-color 0.14s ease, transform 0.08s ease; }
    .fs-seat:hover { background: var(--ad-accent); color: #fff; }
    .fs-seat:active { transform: translateY(1px); }
    .fs-seat__label { font-family: var(--ad-font-serif, Georgia, serif); letter-spacing: 0.02em; }
    .fs-seat--none { border-color: var(--ad-border); background: var(--ad-raised); color: var(--ad-muted); font-weight: 500; cursor: default; }
    .fs-seat--other { border-color: #7c5cd6; background: rgba(124,92,214,0.12); color: #6641c2; }
    .fs-seat--other:hover { background: #7c5cd6; color: #fff; }
    .fs-split { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem; border-radius: 999px; background: rgba(124,92,214,0.12); color: #6641c2; font-size: 0.7rem; font-weight: 700; }

    .fs-actions { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 0.4rem; }
    .fs-present-btn { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.45rem 0.65rem; border-radius: 999px; border: 1px solid var(--ad-border); background: var(--ad-surface); color: var(--ad-muted); font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease; }
    .fs-present-btn svg { opacity: 0.45; }
    .fs-present-btn:hover { border-color: #2f9e57; color: #2f9e57; }
    .fs-present-btn.is-on { background: #e7f8ee; border-color: #2f9e57; color: #1f7a41; }
    .fs-present-btn.is-on svg { opacity: 1; }
    .fs-present-chip { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.32rem 0.55rem; border-radius: 999px; background: #e7f8ee; color: #1f7a41; font-size: 0.74rem; font-weight: 700; }
    .fs-seat--present { border-color: #2f9e57; background: #e7f8ee; color: #1f7a41; }
    .fs-seat--present:hover { background: #2f9e57; color: #fff; }
    @media (max-width: 520px) { .fs-present-btn { font-size: 0; padding: 0.45rem; } .fs-present-btn svg { opacity: 0.7; } .fs-present-btn.is-on svg { opacity: 1; } }

    .fs-modal-scrim { position: fixed; inset: 0; z-index: 80; background: rgba(20,18,15,0.55); display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .fs-modal { width: 100%; max-width: 680px; max-height: 92vh; overflow-y: auto; background: var(--ad-surface); border: 1px solid var(--ad-border); border-radius: var(--ad-r-card); box-shadow: var(--ad-shadow); padding: 1.1rem 1.15rem 1.25rem; }
    .fs-modal__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.85rem; }
    .fs-modal__seat { font-size: 1.5rem; font-family: var(--ad-font-serif, Georgia, serif); font-weight: 600; color: var(--ad-ink); letter-spacing: 0.02em; }
    .fs-map { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
    @media (min-width: 620px) { .fs-map { grid-template-columns: 1.9fr 1fr; align-items: start; } }
    .fs-map__zoom { width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--ad-border); background: var(--ad-bg); display: block; }
    .fs-area { fill: rgba(169,133,69,0.28); stroke: var(--ad-accent); stroke-width: 1; }
    .fs-tnum circle { fill: rgba(15,13,10,0.6); stroke: rgba(255,255,255,0.5); stroke-width: 0.8; }
    .fs-tnum text { fill: #fff; font-size: 15px; font-weight: 700; font-family: var(--ad-font-serif, Georgia, serif); }
    .fs-dot { fill: #e5484d; stroke: #fff; stroke-width: 2.5; }
    .fs-ping { fill: none; stroke: #e5484d; stroke-width: 3; opacity: 0.9; transform-box: fill-box; transform-origin: center; animation: fs-ping 1.5s ease-out infinite; }
    @keyframes fs-ping { 0% { transform: scale(0.5); opacity: 0.95; } 100% { transform: scale(1.7); opacity: 0; } }
    .fs-mini { border: 1px solid var(--ad-border); border-radius: 12px; padding: 0.5rem; background: var(--ad-bg); }
    .fs-mini__cap { display: block; font-size: 0.72rem; color: var(--ad-muted); margin-bottom: 0.3rem; text-align: center; }
    .fs-mini svg { width: 100%; height: auto; display: block; }
    .fs-mini__box { fill: rgba(169,133,69,0.12); stroke: var(--ad-accent); stroke-width: 6; }
    .fs-mini__mark { fill: none; stroke: #e5484d; stroke-width: 10; }
    .fs-modal__hint { margin: 0.85rem 0 0; font-size: 0.85rem; color: var(--ad-body); }

    @media (prefers-reduced-motion: reduce) { .fs-ping { animation: none; opacity: 0.4; } }
    `}</style>
  );
}
