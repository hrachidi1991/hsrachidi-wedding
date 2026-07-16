'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SEATS,
  STAGE,
  TABLES,
  ROOM,
  VIEWBOX,
  SEAT_COUNT,
  SEAT_BY_CODE,
  type SeatDef,
} from '@/lib/seatLayout';

// ── Types ──────────────────────────────────────────────────────────────────
interface GuestLite {
  id: string;
  name: string;
  side: string;
  groupCode: string;
}
interface SeatGuest extends GuestLite {
  seatCode: string | null;
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function SeatingPage() {
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(false); // Seat table not migrated
  const [loadError, setLoadError] = useState<string | null>(null);
  const [guests, setGuests] = useState<SeatGuest[]>([]);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [moveGuest, setMoveGuest] = useState<GuestLite | null>(null);
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(1);
  const [tip, setTip] = useState<{ code: string; left: number; top: number } | null>(null);
  const [focusedCode, setFocusedCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    setInitError(false);
    setLoadError(null);
    try {
      const res = await fetch('/api/seats');
      if (res.status === 503) {
        const d = await res.json().catch(() => null);
        if (d?.code === 'SEAT_TABLE_MISSING') {
          setInitError(true);
          setLoading(false);
          return;
        }
      }
      if (!res.ok) {
        setLoadError('Could not load seating data. Please try again.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setGuests(Array.isArray(data.guests) ? data.guests : []);
    } catch {
      setLoadError('Could not load seating data. Please try again.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  // Seat code -> guest currently in it (derived from guests, single source of truth)
  const assignments = useMemo(() => {
    const m: Record<string, SeatGuest> = {};
    for (const g of guests) if (g.seatCode && SEAT_BY_CODE[g.seatCode]) m[g.seatCode] = g;
    return m;
  }, [guests]);

  const unseated = useMemo(() => guests.filter((g) => !g.seatCode), [guests]);
  const seatedCount = guests.length - unseated.length;
  const seatedBride = guests.filter((g) => g.seatCode && g.side === 'bride').length;
  const seatedGroom = guests.filter((g) => g.seatCode && g.side === 'groom').length;

  // ── Mutations (optimistic) ────────────────────────────────────────────────
  const doAssign = async (code: string, guest: GuestLite) => {
    setGuests((prev) =>
      prev.map((g) => {
        if (g.id === guest.id) return { ...g, seatCode: code };
        if (g.seatCode === code) return { ...g, seatCode: null }; // bump any prior occupant
        return g;
      })
    );
    try {
      const res = await fetch('/api/seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, guestId: guest.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || 'save failed');
      }
    } catch (e: any) {
      flash(e?.message ? `Could not save seat: ${e.message}` : 'Could not save seat — reloading.');
      loadData();
    }
  };

  const doClear = async (code: string) => {
    setGuests((prev) => prev.map((g) => (g.seatCode === code ? { ...g, seatCode: null } : g)));
    try {
      const res = await fetch('/api/seats', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error('clear failed');
    } catch {
      flash('Could not clear seat — reloading.');
      loadData();
    }
  };

  // ── Chair interaction ─────────────────────────────────────────────────────
  const onChairActivate = (code: string) => {
    if (moveGuest) {
      doAssign(code, moveGuest);
      setMoveGuest(null);
      setSelectedCode(code);
      setSearch('');
      return;
    }
    setSelectedCode(code);
    setSearch('');
  };

  const showTip = (code: string, el: SVGGElement | null) => {
    const wrap = stageRef.current;
    if (!wrap || !el) return;
    const wr = wrap.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    setTip({
      code,
      left: er.left - wr.left + er.width / 2,
      top: er.top - wr.top,
    });
  };

  const closePanel = () => {
    setSelectedCode(null);
    setMoveGuest(null);
    setSearch('');
  };

  const startMove = (guest: GuestLite) => {
    setMoveGuest(guest);
    setSelectedCode(null);
  };

  // ── Render: loading ───────────────────────────────────────────────────────
  if (loading) return <SeatingSkeleton />;

  // ── Render: seat table not initialized ────────────────────────────────────
  if (initError) {
    return (
      <div>
        <SeatingStyles />
        <PageHeader />
        <div className="ad-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div className="seat-empty-icon" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18v-6a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v1h6v-1a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v6" />
              <path d="M6 13V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7" />
              <path d="M4 18h16" />
            </svg>
          </div>
          <h2 className="ad-section-title" style={{ marginTop: '1rem' }}>Seating storage not initialized yet</h2>
          <p className="ad-page-desc" style={{ margin: '0.5rem auto 0' }}>
            The seating table hasn&rsquo;t been created in the database yet. Once the schema is
            migrated, chairs can be assigned here.
          </p>
          <button className="ad-btn ad-btn--outline" style={{ marginTop: '1.25rem' }} onClick={loadData}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Render: hard load error ───────────────────────────────────────────────
  if (loadError) {
    return (
      <div>
        <SeatingStyles />
        <PageHeader />
        <div className="ad-notice ad-notice--bad" role="alert">{loadError}</div>
        <button className="ad-btn ad-btn--outline" style={{ marginTop: '1rem' }} onClick={loadData}>Try again</button>
      </div>
    );
  }

  // ── Render: no guests ─────────────────────────────────────────────────────
  const noGuests = guests.length === 0;

  const selectedSeat = selectedCode ? SEAT_BY_CODE[selectedCode] : null;
  const selectedOccupant = selectedCode ? assignments[selectedCode] : null;
  const panelOpen = !!selectedCode || !!moveGuest;

  return (
    <div>
      <SeatingStyles />
      <PageHeader />

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-5">
        <StatCard label="Seated" value={seatedCount} sub={`/ ${SEAT_COUNT}`} tone="accent" />
        <StatCard label="Bride Seated" value={seatedBride} sub="guests" />
        <StatCard label="Groom Seated" value={seatedGroom} sub="guests" />
        <StatCard label="Unseated" value={unseated.length} sub="guests" numTone={unseated.length > 0 ? 'warn' : 'muted'} />
      </div>

      {noGuests ? (
        <div className="ad-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div className="seat-empty-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="ad-section-title" style={{ marginTop: '1rem' }}>No guests yet</h2>
          <p className="ad-page-desc" style={{ margin: '0.5rem auto 0' }}>
            Add guests under <strong>Guests &amp; Groups</strong> first, then come back to place
            them on the floor plan.
          </p>
        </div>
      ) : (
        <div className={`seat-layout${panelOpen ? ' has-panel' : ''}`}>
          {/* ── Floor plan ── */}
          <div className="ad-card seat-floor-card">
            {/* Legend + zoom controls */}
            <div className="seat-toolbar">
              <div className="seat-legend" aria-hidden="true">
                <span className="seat-legend__item"><span className="seat-swatch seat-swatch--empty" />Empty</span>
                <span className="seat-legend__item"><span className="seat-swatch seat-swatch--filled" />Seated</span>
                <span className="seat-legend__item"><span className="seat-swatch seat-swatch--stage" />Stage</span>
                <span className="seat-legend__item"><span className="seat-swatch seat-swatch--table" />Table</span>
              </div>
              <div className="seat-zoom" role="group" aria-label="Zoom the floor plan">
                <button type="button" className="ad-icon-btn" onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} disabled={zoom <= 1} aria-label="Zoom out">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </button>
                <span className="seat-zoom__val ad-nums">{Math.round(zoom * 100)}%</span>
                <button type="button" className="ad-icon-btn" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} disabled={zoom >= 3} aria-label="Zoom in">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </button>
                <button type="button" className="ad-icon-btn" onClick={() => setZoom(1)} disabled={zoom === 1} aria-label="Reset zoom" title="Fit">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3" /></svg>
                </button>
              </div>
            </div>

            {moveGuest && (
              <div className="ad-notice ad-notice--info seat-movebar" role="status">
                <span>Click a chair to move <strong>{moveGuest.name}</strong>.</span>
                <button type="button" className="ad-link-btn" onClick={() => setMoveGuest(null)}>Cancel</button>
              </div>
            )}

            <div className="seat-stage-wrap" ref={stageRef}>
              <div className="seat-scroll">
                <div className="seat-canvas" style={{ width: `${zoom * 100}%`, minWidth: 560 * zoom }}>
                  <FloorPlan
                    assignments={assignments}
                    selectedCode={selectedCode}
                    focusedCode={focusedCode}
                    moveActive={!!moveGuest}
                    onActivate={onChairActivate}
                    onHover={(code, el) => { setFocusedCode(code); showTip(code, el); }}
                    onLeave={() => { setTip(null); }}
                    onFocusChair={(code, el) => { setFocusedCode(code); showTip(code, el); }}
                    onBlurChair={() => { setFocusedCode(null); setTip(null); }}
                  />
                </div>
              </div>

              {/* Tooltip */}
              {tip && (() => {
                const s = SEAT_BY_CODE[tip.code];
                const occ = assignments[tip.code];
                if (!s) return null;
                return (
                  <div className="seat-tip" style={{ left: tip.left, top: tip.top }} role="tooltip">
                    {occ ? (
                      <>
                        <span className="seat-tip__name">{occ.name}</span>
                        <span className="seat-tip__meta">{cap(occ.side)} &middot; {occ.groupCode}</span>
                      </>
                    ) : (
                      <>
                        <span className="seat-tip__name">{s.zone}</span>
                        <span className="seat-tip__meta">Seat {s.num} &middot; {s.code}</span>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Assign panel / bottom sheet ── */}
          {panelOpen && <div className="seat-sheet-scrim" onClick={closePanel} aria-hidden="true" />}
          <aside
            className={`seat-panel${panelOpen ? ' is-open' : ''}`}
            aria-label="Seat assignment"
          >
            {moveGuest ? (
              <MovePanel guest={moveGuest} onCancel={() => setMoveGuest(null)} />
            ) : selectedSeat ? (
              selectedOccupant ? (
                <FilledPanel
                  seat={selectedSeat}
                  guest={selectedOccupant}
                  onMove={() => startMove(selectedOccupant)}
                  onClear={() => { doClear(selectedSeat.code); }}
                  onClose={closePanel}
                />
              ) : (
                <EmptyPanel
                  seat={selectedSeat}
                  unseated={unseated}
                  search={search}
                  setSearch={setSearch}
                  onPick={(g) => doAssign(selectedSeat.code, g)}
                  onClose={closePanel}
                />
              )
            ) : (
              <div className="seat-panel__idle">
                <h3 className="ad-section-title">Plan the room</h3>
                <p className="ad-page-desc" style={{ marginTop: '0.4rem' }}>
                  Select any chair to seat a guest. Green chairs are already taken — click one to
                  move or clear it.
                </p>
                <div className="seat-idle-stat">
                  <span className="ad-stat__value" style={{ fontSize: '1.9rem', color: unseated.length ? 'var(--ad-warn)' : 'var(--ad-ok)' }}>{unseated.length}</span>
                  <span className="ad-stat__label">guests still need a seat</span>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {toast && <div className="seat-toast ad-notice ad-notice--bad" role="alert">{toast}</div>}
    </div>
  );
}

// ── Floor plan SVG ───────────────────────────────────────────────────────────
function FloorPlan({
  assignments,
  selectedCode,
  focusedCode,
  moveActive,
  onActivate,
  onHover,
  onLeave,
  onFocusChair,
  onBlurChair,
}: {
  assignments: Record<string, SeatGuest>;
  selectedCode: string | null;
  focusedCode: string | null;
  moveActive: boolean;
  onActivate: (code: string) => void;
  onHover: (code: string, el: SVGGElement | null) => void;
  onLeave: () => void;
  onFocusChair: (code: string, el: SVGGElement | null) => void;
  onBlurChair: () => void;
}) {
  return (
    <svg
      className="seat-svg"
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      role="group"
      aria-label={`Venue floor plan with ${SEAT_COUNT} chairs`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* floor backdrop */}
      <rect className="seat-floor-bg" x={2} y={2} width={VIEWBOX.w - 4} height={VIEWBOX.h - 4} rx={18} />

      {/* hall outline (octagon) */}
      <polygon className="seat-room" points={ROOM} />

      {/* tables */}
      {TABLES.map((t) => (
        <g key={`table-${t.n}`}>
          <circle className="seat-table" cx={t.cx} cy={t.cy} r={t.r} />
          <text className="seat-table-label" x={t.cx} y={t.cy} textAnchor="middle" dominantBaseline="central">T{t.n}</text>
        </g>
      ))}

      {/* stage */}
      <circle className="seat-stagedisc" cx={STAGE.x} cy={STAGE.y} r={STAGE.r} />
      <text className="seat-stagedisc-label" x={STAGE.x} y={STAGE.y} textAnchor="middle" dominantBaseline="central">STAGE</text>

      {/* chairs */}
      {SEATS.map((s) => {
        const occ = assignments[s.code];
        const filled = !!occ;
        const cls = [
          'seat-chair',
          filled ? 'is-filled' : 'is-empty',
          selectedCode === s.code ? 'is-selected' : '',
          moveActive && !filled ? 'is-target' : '',
        ].filter(Boolean).join(' ');
        const label = filled
          ? `Seat ${s.code}, ${s.zone}, seated: ${occ.name}. Activate to manage.`
          : `Seat ${s.code}, ${s.zone} seat ${s.num}, empty. Activate to assign a guest.`;
        return (
          <g
            key={s.code}
            className={cls}
            transform={`translate(${s.x} ${s.y}) rotate(${s.rot})`}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={selectedCode === s.code}
            onClick={(e) => { onActivate(s.code); (e.currentTarget as SVGGElement).blur?.(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(s.code); }
            }}
            onMouseEnter={(e) => onHover(s.code, e.currentTarget)}
            onMouseLeave={onLeave}
            onFocus={(e) => onFocusChair(s.code, e.currentTarget)}
            onBlur={onBlurChair}
          >
            {/* enlarged transparent hit area for touch */}
            <rect className="seat-chair-hit" x={-9} y={-9} width={18} height={18} />
            <rect className="seat-chair-back" x={-6.5} y={2.2} width={13} height={4} rx={2} />
            <rect className="seat-chair-body" x={-6.5} y={-6} width={13} height={9} rx={2.8} />
          </g>
        );
      })}

      {/* selection / focus ring drawn on top */}
      {[selectedCode, focusedCode].map((code, i) => {
        if (!code || (i === 1 && code === selectedCode)) return null;
        const s = SEAT_BY_CODE[code];
        if (!s) return null;
        return (
          <rect
            key={`ring-${i}-${code}`}
            className={i === 0 ? 'seat-ring seat-ring--sel' : 'seat-ring seat-ring--focus'}
            x={s.x - 10}
            y={s.y - 10}
            width={20}
            height={20}
            rx={6}
          />
        );
      })}
    </svg>
  );
}

// ── Panels ────────────────────────────────────────────────────────────────
function PanelHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="seat-panel__head">
      <div>
        <div className="ad-eyebrow">{sub}</div>
        <h3 className="ad-section-title" style={{ fontSize: '1.2rem' }}>{title}</h3>
      </div>
      <button type="button" className="ad-icon-btn" onClick={onClose} aria-label="Close panel">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  );
}

function SidePill({ side }: { side: string }) {
  return <span className={`ad-pill ${side === 'bride' ? 'ad-pill--accent' : 'ad-pill--neutral'}`}>{cap(side)}</span>;
}

function FilledPanel({ seat, guest, onMove, onClear, onClose }: {
  seat: SeatDef; guest: SeatGuest; onMove: () => void; onClear: () => void; onClose: () => void;
}) {
  return (
    <div className="seat-panel__body">
      <PanelHead title={seat.code} sub={seat.zone} onClose={onClose} />
      <div className="seat-guestcard">
        <div className="seat-guestcard__avatar" aria-hidden="true">{initials(guest.name)}</div>
        <div style={{ minWidth: 0 }}>
          <div className="seat-guestcard__name">{guest.name}</div>
          <div className="seat-guestcard__meta">
            <SidePill side={guest.side} />
            <span className="ad-count">{guest.groupCode}</span>
          </div>
        </div>
      </div>
      <div className="seat-panel__actions">
        <button type="button" className="ad-btn ad-btn--outline" onClick={onMove}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" /></svg>
          Move to another seat
        </button>
        <button type="button" className="ad-btn ad-btn--outline seat-btn-danger" onClick={onClear}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          Clear seat
        </button>
      </div>
    </div>
  );
}

function EmptyPanel({ seat, unseated, search, setSearch, onPick, onClose }: {
  seat: SeatDef; unseated: SeatGuest[]; search: string; setSearch: (v: string) => void;
  onPick: (g: SeatGuest) => void; onClose: () => void;
}) {
  const q = search.toLowerCase().trim();
  const list = q
    ? unseated.filter((g) => g.name.toLowerCase().includes(q) || g.groupCode.toLowerCase().includes(q) || g.side.toLowerCase().includes(q))
    : unseated;
  return (
    <div className="seat-panel__body">
      <PanelHead title={seat.code} sub={`${seat.zone} · empty`} onClose={onClose} />
      <div className="ad-search" style={{ marginBottom: '0.75rem' }}>
        <span className="ad-search__icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        </span>
        <input
          type="text"
          className="ad-input ad-input--search"
          placeholder="Search unseated guests..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search unseated guests"
          autoFocus
        />
        {search && <button className="ad-search__clear" onClick={() => setSearch('')} aria-label="Clear search">&times;</button>}
      </div>

      {unseated.length === 0 ? (
        <p className="ad-empty">Everyone has a seat.</p>
      ) : list.length === 0 ? (
        <p className="ad-empty">No unseated guests match &ldquo;{search}&rdquo;.</p>
      ) : (
        <ul className="seat-picker" aria-label="Unseated guests">
          {list.map((g) => (
            <li key={g.id}>
              <button type="button" className="seat-picker__item" onClick={() => onPick(g)}>
                <span className="seat-picker__avatar" aria-hidden="true">{initials(g.name)}</span>
                <span className="seat-picker__text">
                  <span className="seat-picker__name">{g.name}</span>
                  <span className="seat-picker__meta">{g.groupCode} &middot; {cap(g.side)}</span>
                </span>
                <span className="seat-picker__go" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MovePanel({ guest, onCancel }: { guest: GuestLite; onCancel: () => void }) {
  return (
    <div className="seat-panel__body">
      <div className="seat-panel__head">
        <div>
          <div className="ad-eyebrow">Moving guest</div>
          <h3 className="ad-section-title" style={{ fontSize: '1.2rem' }}>{guest.name}</h3>
        </div>
        <button type="button" className="ad-icon-btn" onClick={onCancel} aria-label="Cancel move">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      <div className="ad-notice ad-notice--info" style={{ marginTop: '0.25rem' }}>
        Now click any chair on the floor plan to place <strong>{guest.name}</strong> there.
      </div>
      <div className="seat-panel__actions">
        <button type="button" className="ad-btn ad-btn--outline" onClick={onCancel}>Cancel move</button>
      </div>
    </div>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────
function PageHeader() {
  return (
    <header className="ad-header">
      <div>
        <div className="ad-eyebrow" style={{ marginBottom: '0.4rem' }}>Venue</div>
        <h1 className="ad-title">Seating Map</h1>
        <p className="ad-page-desc">Place each guest on the venue floor plan. Click a chair to seat, move, or clear a guest.</p>
      </div>
    </header>
  );
}

const numToneClass: Record<string, string> = { ok: 'ad-stat--ok', bad: 'ad-stat--bad', warn: 'ad-stat--warn', muted: '' };
function StatCard({ label, value, sub, tone, numTone }: {
  label: string; value: string | number; sub?: string; tone?: 'accent' | 'ok'; numTone?: 'ok' | 'bad' | 'warn' | 'muted';
}) {
  const cardTone = tone === 'accent' ? 'ad-stat--accent' : tone === 'ok' ? 'ad-stat--ok' : '';
  const valueClass = numTone ? numToneClass[numTone] : '';
  const mutedNum = numTone === 'muted';
  return (
    <div className={`ad-stat ${cardTone}`}>
      <span className="ad-stat__label">{label}</span>
      <span className={`ad-stat__value ${valueClass}`} style={mutedNum ? { color: 'var(--ad-muted)' } : undefined}>
        {value}
        {sub && <span className="ad-stat__sub">{sub}</span>}
      </span>
    </div>
  );
}

function SeatingSkeleton() {
  return (
    <div>
      <div className="ad-skel" style={{ height: 20, width: 80, marginBottom: 12 }} />
      <div className="ad-skel" style={{ height: 34, width: 210, marginBottom: 24 }} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ad-stat">
            <div className="ad-skel" style={{ height: 12, width: '60%' }} />
            <div className="ad-skel" style={{ height: 32, width: '45%', marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className="ad-card">
        <div className="ad-skel" style={{ height: 420, width: '100%', borderRadius: 14 }} />
      </div>
    </div>
  );
}

// ── Utils ─────────────────────────────────────────────────────────────────
function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

// ── Scoped styles (reference admin.css tokens only) ─────────────────────────
function SeatingStyles() {
  return (
    <style>{`
    .seat-layout { display: grid; gap: 1.25rem; grid-template-columns: minmax(0, 1fr); align-items: start; }
    @media (min-width: 1024px) {
      .seat-layout { grid-template-columns: minmax(0, 1fr) 344px; }
    }

    .seat-floor-card { padding: 0.9rem; min-width: 0; }
    .seat-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 0.75rem; }
    .seat-legend { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; font-size: 0.76rem; color: var(--ad-body); }
    .seat-legend__item { display: inline-flex; align-items: center; gap: 0.4rem; }
    .seat-swatch { width: 14px; height: 14px; border-radius: 4px; flex: 0 0 auto; display: inline-block; }
    .seat-swatch--empty { background: var(--ad-surface); border: 1px solid var(--ad-border-strong); }
    .seat-swatch--filled { background: var(--ad-accent); }
    .seat-swatch--stage { background: var(--ad-accent-soft); border: 1px solid var(--ad-accent); }
    .seat-swatch--table { background: var(--ad-raised); border: 1px solid var(--ad-border-strong); }

    .seat-zoom { display: inline-flex; align-items: center; gap: 0.25rem; }
    .seat-zoom__val { font-size: 0.76rem; color: var(--ad-muted); min-width: 42px; text-align: center; }

    .seat-movebar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem; }

    .seat-stage-wrap { position: relative; }
    .seat-scroll {
      width: 100%; overflow: auto; -webkit-overflow-scrolling: touch;
      touch-action: pan-x pan-y pinch-zoom;
      border-radius: var(--ad-r-ctrl); background: var(--ad-bg);
      border: 1px solid var(--ad-border);
      max-height: 74vh;
    }
    .seat-canvas { min-width: 0; }
    .seat-svg { display: block; width: 100%; height: auto; }

    /* floor + furniture */
    .seat-floor-bg { fill: var(--ad-raised); stroke: var(--ad-border); stroke-width: 1.5; }
    .seat-room { fill: var(--ad-surface); stroke: var(--ad-border-strong); stroke-width: 2; stroke-linejoin: round; }
    .seat-stagedisc { fill: var(--ad-accent-soft); stroke: var(--ad-accent); stroke-width: 1.6; }
    .seat-stagedisc-label { fill: var(--ad-accent-strong); font-family: var(--ad-font-serif); font-weight: 600; font-size: 24px; letter-spacing: 0.16em; }
    .seat-table { fill: var(--ad-raised); stroke: var(--ad-border-strong); stroke-width: 1.2; }
    .seat-table-label { fill: var(--ad-muted); font-family: var(--ad-font-ui); font-weight: 600; font-size: 12px; }

    /* chairs */
    .seat-chair { cursor: pointer; }
    .seat-chair:focus { outline: none; }
    .seat-chair-hit { fill: transparent; }
    .seat-chair-body { fill: var(--ad-surface); stroke: var(--ad-border-strong); stroke-width: 1; transition: fill 0.14s ease, stroke 0.14s ease; }
    .seat-chair-back { fill: var(--ad-border-strong); transition: fill 0.14s ease; }
    .seat-chair.is-filled .seat-chair-body { fill: var(--ad-accent); stroke: var(--ad-accent-strong); }
    .seat-chair.is-filled .seat-chair-back { fill: var(--ad-accent-strong); }
    .seat-chair.is-empty:hover .seat-chair-body { fill: var(--ad-accent-soft); stroke: var(--ad-accent); }
    .seat-chair.is-filled:hover .seat-chair-body { fill: #2a2724; }
    .seat-chair.is-target .seat-chair-body { fill: var(--ad-accent-soft); stroke: var(--ad-accent); stroke-width: 1.4; stroke-dasharray: 2.4 1.8; animation: seat-pulse 1.4s ease-in-out infinite; }
    @keyframes seat-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

    .seat-ring { fill: none; pointer-events: none; }
    .seat-ring--sel { stroke: var(--ad-accent); stroke-width: 2.2; }
    .seat-ring--focus { stroke: var(--ad-accent-strong); stroke-width: 2; stroke-dasharray: 3 2.4; }

    /* tooltip */
    .seat-tip {
      position: absolute; z-index: 20; transform: translate(-50%, calc(-100% - 9px));
      background: var(--ad-ink); color: #fff; border-radius: 9px; padding: 0.4rem 0.6rem;
      pointer-events: none; box-shadow: var(--ad-shadow); max-width: 220px; white-space: nowrap;
      display: flex; flex-direction: column; gap: 1px;
    }
    .seat-tip::after { content: ''; position: absolute; left: 50%; top: 100%; transform: translateX(-50%); border: 5px solid transparent; border-top-color: var(--ad-ink); }
    .seat-tip__name { font-size: 0.8rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
    .seat-tip__meta { font-size: 0.7rem; color: #d8d3c8; }

    /* panel (desktop) */
    .seat-panel {
      background: var(--ad-surface); border: 1px solid var(--ad-border);
      border-radius: var(--ad-r-card); box-shadow: var(--ad-shadow);
      position: sticky; top: 1rem; min-width: 0;
    }
    .seat-panel__body { padding: 1.1rem 1.15rem 1.25rem; }
    .seat-panel__idle { padding: 1.4rem 1.2rem; }
    .seat-panel__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; margin-bottom: 1rem; }
    .seat-panel__actions { display: flex; flex-direction: column; gap: 0.55rem; margin-top: 1.1rem; }
    .seat-panel__actions .ad-btn { width: 100%; }
    .seat-btn-danger { color: var(--ad-bad); }
    .seat-btn-danger:hover:not(:disabled) { background: var(--ad-bad-soft); border-color: rgba(192, 82, 79, 0.35); color: var(--ad-bad); }

    .seat-idle-stat { margin-top: 1.25rem; padding: 1rem; background: var(--ad-raised); border: 1px solid var(--ad-border); border-radius: var(--ad-r-ctrl); display: flex; flex-direction: column; gap: 0.2rem; }
    .seat-idle-stat .ad-stat__value { font-family: var(--ad-font-serif); font-weight: 600; line-height: 1; }

    .seat-guestcard { display: flex; align-items: center; gap: 0.8rem; padding: 0.85rem; background: var(--ad-raised); border: 1px solid var(--ad-border); border-radius: var(--ad-r-ctrl); }
    .seat-guestcard__avatar, .seat-picker__avatar {
      flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%; background: var(--ad-accent-soft); color: var(--ad-accent-strong);
      font-weight: 600; font-family: var(--ad-font-serif);
    }
    .seat-guestcard__avatar { width: 44px; height: 44px; font-size: 1rem; }
    .seat-guestcard__name { font-weight: 600; color: var(--ad-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .seat-guestcard__meta { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.35rem; flex-wrap: wrap; }

    /* picker */
    .seat-picker { list-style: none; margin: 0; padding: 0; max-height: 340px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.3rem; }
    .seat-picker__item {
      width: 100%; display: flex; align-items: center; gap: 0.7rem; text-align: left;
      padding: 0.5rem 0.6rem; background: var(--ad-surface); border: 1px solid var(--ad-border);
      border-radius: var(--ad-r-ctrl); cursor: pointer; transition: background-color 0.14s ease, border-color 0.14s ease;
    }
    .seat-picker__item:hover { background: var(--ad-accent-soft); border-color: rgba(169, 133, 69, 0.35); }
    .seat-picker__avatar { width: 34px; height: 34px; font-size: 0.82rem; }
    .seat-picker__text { min-width: 0; display: flex; flex-direction: column; flex: 1; }
    .seat-picker__name { font-size: 0.875rem; font-weight: 500; color: var(--ad-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .seat-picker__meta { font-size: 0.74rem; color: var(--ad-muted); }
    .seat-picker__go { color: var(--ad-muted); flex: 0 0 auto; }

    .seat-empty-icon { display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; background: var(--ad-accent-soft); color: var(--ad-accent-strong); margin: 0 auto; }

    .seat-sheet-scrim { display: none; }

    .seat-toast { position: fixed; left: 50%; bottom: 1.25rem; transform: translateX(-50%); z-index: 70; box-shadow: var(--ad-shadow); max-width: min(92vw, 460px); }

    /* mobile: panel becomes a bottom sheet */
    @media (max-width: 1023px) {
      .seat-sheet-scrim { display: block; position: fixed; inset: 0; z-index: 55; background: rgba(20, 18, 15, 0.42); }
      .seat-panel {
        position: fixed; left: 0; right: 0; bottom: 0; top: auto; z-index: 60;
        border-radius: 16px 16px 0 0; max-height: 82vh; overflow-y: auto;
        transform: translateY(100%); transition: transform 0.26s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .seat-panel.is-open { transform: translateY(0); }
      .seat-panel::before { content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 40px; height: 4px; border-radius: 999px; background: var(--ad-border-strong); }
      .seat-panel__body, .seat-panel__idle { padding-top: 1.5rem; }
      .seat-picker { max-height: 46vh; }
    }

    @media (prefers-reduced-motion: reduce) {
      .seat-chair.is-target .seat-chair-body { animation: none; }
      .seat-panel { transition: none; }
    }
    `}</style>
  );
}
