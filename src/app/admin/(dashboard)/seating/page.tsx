'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SEATS,
  PLAN_IMAGE,
  VIEWBOX,
  SEAT_COUNT,
  SEAT_BY_CODE,
  type SeatDef,
} from '@/lib/seatLayout';
import { SNAIL_ROW_OF_CODE } from '@/lib/snails';

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

// ── Table grouping helpers (Edit-tables mode) ────────────────────────────────
type TableDef = { name: string; codes: string[] };
const TABLE_COLORS = ['#e5484d', '#4593e5', '#45c07a', '#e0a83b', '#a259e5', '#e5629a', '#37b7c0', '#c0693a', '#7a9a3c', '#d24bd2', '#5a6ee0', '#b7912b', '#ff8c42', '#2dd4bf', '#f43f9d', '#84cc16', '#eab308', '#8b5cf6', '#14b8a6', '#f97316'];
function tableColor(name: string, order: string[]): string {
  const i = order.indexOf(name);
  return TABLE_COLORS[(i < 0 ? 0 : i) % TABLE_COLORS.length];
}
function nextLetter(existing: string[]): string {
  for (let i = 0; i < 26; i++) { const L = String.fromCharCode(65 + i); if (!existing.includes(L)) return L; }
  for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) { const L = String.fromCharCode(65 + i) + String.fromCharCode(65 + j); if (!existing.includes(L)) return L; }
  return 'A1';
}
// The built-in (divider-based) grouping, as a { name, codes } list.
function defaultTableList(): TableDef[] {
  const m = new Map<string, string[]>();
  for (const s of SEATS) { const a = m.get(s.table) || []; a.push(s.code); m.set(s.table, a); }
  return [...m.entries()].map(([name, codes]) => ({ name, codes }));
}
// code -> table name from a list.
function codeToName(list: TableDef[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const t of list) for (const c of t.codes) m[c] = t.name;
  return m;
}
// Group a code->name map back into a reading-order-sorted table list (+ centroids).
function mapToTables(map: Record<string, string>): (TableDef & { cx: number; cy: number })[] {
  const by: Record<string, string[]> = {};
  for (const [code, name] of Object.entries(map)) { if (!name) continue; (by[name] = by[name] || []).push(code); }
  const out = Object.entries(by).map(([name, codes]) => {
    const pts = codes.map((c) => SEAT_BY_CODE[c]).filter(Boolean);
    const cx = pts.reduce((s, p) => s + p.x, 0) / (pts.length || 1);
    const cy = pts.reduce((s, p) => s + p.y, 0) / (pts.length || 1);
    return { name, codes, cx, cy };
  });
  out.sort((a, b) => (Math.round(a.cy / 90) - Math.round(b.cy / 90)) || a.cx - b.cx);
  return out;
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function SeatingPage() {
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(false); // Seat table not migrated
  const [loadError, setLoadError] = useState<string | null>(null);
  const [guests, setGuests] = useState<SeatGuest[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [moveGuest, setMoveGuest] = useState<SeatGuest | null>(null);
  const [search, setSearch] = useState('');
  const [pickerSide, setPickerSide] = useState<'all' | 'groom' | 'bride'>('all');
  const [zoom, setZoom] = useState(1);
  const [tip, setTip] = useState<{ code: string; left: number; top: number } | null>(null);
  const [focusedCode, setFocusedCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // "Unseated groom / bride" stat cards open a list popup.
  const [unseatedModal, setUnseatedModal] = useState<'groom' | 'bride' | null>(null);
  // When a move lands on an already-taken seat: offer swap / push-right / push-left.
  const [placeChoice, setPlaceChoice] = useState<{ targetCode: string; occupant: SeatGuest } | null>(null);
  // Right-click context menu on a chair (push right/left, move, clear, assign).
  const [menu, setMenu] = useState<{ code: string; x: number; y: number } | null>(null);

  // Edit-tables mode (draw your own table grouping)
  const [customTables, setCustomTables] = useState<TableDef[] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editMap, setEditMap] = useState<Record<string, string>>({});
  const [activeTable, setActiveTable] = useState('A');
  const [savingTables, setSavingTables] = useState(false);

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
      // Only guests who CONFIRMED attendance may be seated — derive that set from RSVP data.
      try {
        const gr = await fetch('/api/groups');
        if (gr.ok) {
          const groups = await gr.json();
          const conf = new Set<string>();
          for (const grp of (Array.isArray(groups) ? groups : [])) {
            const gn = grp.rsvpResponse?.guestNames;
            const nameMap = new Map<string, boolean>();
            if (Array.isArray(gn) && gn.length && typeof gn[0] === 'object' && gn[0] && 'name' in gn[0]) {
              for (const x of gn) nameMap.set(String(x.name).toLowerCase(), !!x.attending);
            }
            for (const gu of (grp.guests || [])) {
              const online = nameMap.get(String(gu.name).toLowerCase());
              const attending =
                online !== undefined ? online
                : gu.rsvpManual === 'Coming' ? true
                : gu.rsvpManual === 'Not coming' ? false
                : grp.rsvpResponse ? !!grp.rsvpResponse.attending
                : false;
              if (attending) conf.add(gu.id);
            }
          }
          setConfirmedIds(conf);
        }
      } catch { /* leave confirmed set empty */ }
      // Custom table grouping drawn in Edit-tables mode (overrides the default).
      try {
        const sr = await fetch('/api/settings');
        if (sr.ok) {
          const raw = await sr.json();
          const st = (raw?.settings || raw || {}).seatTables;
          if (Array.isArray(st) && st.length) setCustomTables(st);
        }
      } catch { /* use the built-in grouping */ }
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

  // Dismiss the right-click / long-press menu on outside click, scroll, resize, or Escape.
  useEffect(() => {
    if (!menu) return;
    const t0 = Date.now();
    const close = () => { if (Date.now() - t0 < 350) return; setMenu(null); }; // ignore the opening tap
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

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

  // ── Table grouping (custom drawn tables override the built-in divider tables) ──
  const baseTables = useMemo<TableDef[]>(() => (customTables && customTables.length ? customTables : defaultTableList()), [customTables]);
  const liveTables = useMemo(() => (editMode ? mapToTables(editMap) : mapToTables(codeToName(baseTables))), [editMode, editMap, baseTables]);
  const codeName = useMemo<Record<string, string>>(() => (editMode ? editMap : codeToName(baseTables)), [editMode, editMap, baseTables]);
  const tableNames = useMemo(() => liveTables.map((t) => t.name), [liveTables]);
  const zoneOf = (code: string) => {
    const name = codeName[code];
    if (name) {
      const t = liveTables.find((x) => x.name === name);
      const idx = t ? t.codes.indexOf(code) + 1 : 0;
      return `${name}${String(idx).padStart(2, '0')}`;
    }
    return SEAT_BY_CODE[code]?.zone || code;
  };

  const enterEditMode = () => {
    setEditMap(codeToName(baseTables));
    setActiveTable(baseTables[0]?.name || 'A');
    setSelectedCode(null); setMoveGuest(null);
    setEditMode(true);
  };
  const assignToActive = (code: string) => setEditMap((m) => ({ ...m, [code]: activeTable }));
  const addNewTable = () => setActiveTable(nextLetter([...new Set(Object.values(editMap))].filter(Boolean)));
  const deleteActiveTable = () => setEditMap((m) => { const n = { ...m }; for (const c of Object.keys(n)) if (n[c] === activeTable) delete n[c]; return n; });
  const clearAllTables = () => {
    if (!window.confirm('Remove ALL table markings so you can start from a blank plan? (Nothing is saved until you press “Save tables”.)')) return;
    setEditMap({});
    setActiveTable('A');
  };
  const saveTables = async () => {
    setSavingTables(true);
    const tables = mapToTables(editMap).map((t) => ({ name: t.name, codes: t.codes }));
    try {
      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seatTables: tables }) });
      if (!res.ok) throw new Error();
      setCustomTables(tables); setEditMode(false); flash(`Saved ${tables.length} tables.`);
    } catch { flash('Could not save tables — please try again.'); }
    setSavingTables(false);
  };
  const resetTablesToDefault = async () => {
    if (!window.confirm('Reset to the built-in divider tables and discard your custom grouping?')) return;
    setSavingTables(true);
    try {
      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seatTables: [] }) });
      if (!res.ok) throw new Error();
      setCustomTables(null); setEditMode(false); flash('Reset to the default tables.');
    } catch { flash('Could not reset — please try again.'); }
    setSavingTables(false);
  };

  // Only CONFIRMED (attending) guests can be seated, so the picker + "still need a seat" count use this.
  const unseated = useMemo(() => guests.filter((g) => !g.seatCode && confirmedIds.has(g.id)), [guests, confirmedIds]);
  const unseatedGroom = useMemo(() => unseated.filter((g) => g.side === 'groom'), [unseated]);
  const unseatedBride = useMemo(() => unseated.filter((g) => g.side === 'bride'), [unseated]);
  const seatedCount = guests.filter((g) => g.seatCode).length;

  // Ordered seat codes of the table a given seat belongs to (for push direction).
  const tableCodesOf = (code: string): string[] | null => {
    const name = codeName[code];
    const t = liveTables.find((x) => x.name === name);
    if (!t) return null;
    // Canonical left→right / seat-number order so "push right" is consistent.
    return [...t.codes].sort((a, b) => (SEAT_BY_CODE[a]?.seatNo ?? 0) - (SEAT_BY_CODE[b]?.seatNo ?? 0));
  };

  // The row a push should traverse: a snail seat pushes along its whole bench row
  // (outer or inner arc, across every sub-table); anything else uses its table.
  const pushRowOf = (code: string): string[] | null => SNAIL_ROW_OF_CODE[code] || tableCodesOf(code);

  // Map "right"/"left" to a chain step (+1/-1) using the seats' actual x-positions.
  // Looks several seats ahead in each chain direction (not just the immediate
  // neighbours) so the direction is robust even at a row's end or where the bench
  // runs vertically — pushing always shifts toward the spatial side the user picked.
  const spatialStep = (codes: string[], t: number, dir: 'right' | 'left'): 1 | -1 => {
    const xAt = (i: number) => SEAT_BY_CODE[codes[i]]?.x ?? 0;
    const aheadX = (step: number): number | null => {
      let j = t;
      for (let k = 1; k <= 5; k++) { const jj = t + step * k; if (jj < 0 || jj >= codes.length) break; j = jj; }
      return j === t ? null : xAt(j);
    };
    const here = xAt(t);
    const fX = aheadX(1);   // x looking toward higher indices
    const bX = aheadX(-1);  // x looking toward lower indices
    let rightStep: 1 | -1;
    if (fX !== null && bX !== null) rightStep = fX > bX ? 1 : -1;
    else if (fX !== null) rightStep = fX >= here ? 1 : -1;
    else if (bX !== null) rightStep = bX >= here ? -1 : 1;
    else rightStep = 1;
    return dir === 'right' ? rightStep : (-rightStep as 1 | -1);
  };

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

  // Apply several assignments at once (swap / push). Optimistic, then persisted atomically.
  const doBatch = async (moves: { code: string; guestId: string }[]) => {
    const moveMap = new Map(moves.map((m) => [m.guestId, m.code]));
    const takenCodes = new Set(moves.map((m) => m.code));
    setGuests((prev) =>
      prev.map((g) => {
        if (moveMap.has(g.id)) return { ...g, seatCode: moveMap.get(g.id)! };
        if (g.seatCode && takenCodes.has(g.seatCode)) return { ...g, seatCode: null }; // displaced
        return g;
      })
    );
    try {
      const res = await fetch('/api/seats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || 'update failed');
      }
    } catch (e: any) {
      flash(e?.message ? `Could not update seats: ${e.message}` : 'Could not update seats — reloading.');
      loadData();
    }
  };

  // Swap the moving guest with the seat's current occupant.
  // If the moving guest has no seat yet, this simply replaces (unseats) the occupant.
  const doSwap = (targetCode: string, occupant: SeatGuest) => {
    if (!moveGuest) return;
    const moves: { code: string; guestId: string }[] = [{ code: targetCode, guestId: moveGuest.id }];
    if (moveGuest.seatCode && moveGuest.seatCode !== targetCode) {
      moves.push({ code: moveGuest.seatCode, guestId: occupant.id });
    }
    doBatch(moves);
    finishPlacement(targetCode);
  };

  // Insert the moving guest at targetCode, pushing occupants one seat toward `dir`
  // until an empty seat absorbs the shift. Warns if that direction is already full.
  const doPush = (targetCode: string, dir: 'right' | 'left') => {
    if (!moveGuest) return;
    const codes = pushRowOf(targetCode);
    if (!codes) { flash('This seat is not part of a table row.'); return; }
    const t = codes.indexOf(targetCode);
    if (t < 0) return;
    // Treat the moving guest's own seat (if in this row) as an empty gap, so the
    // shift stops there and the guest never appears twice in the batch.
    const occ = (c: string) => {
      const g = assignments[c];
      return g && g.id === moveGuest.id ? undefined : g;
    };
    const step = spatialStep(codes, t, dir);
    const moves: { code: string; guestId: string }[] = [];
    if (step > 0) {
      let e = -1;
      for (let i = t + 1; i < codes.length; i++) { if (!occ(codes[i])) { e = i; break; } }
      if (e < 0) { flash(`No empty seat to the ${dir} to push into — that end of the bench is full.`); return; }
      for (let i = e; i > t; i--) moves.push({ code: codes[i], guestId: occ(codes[i - 1])!.id });
    } else {
      let e = -1;
      for (let i = t - 1; i >= 0; i--) { if (!occ(codes[i])) { e = i; break; } }
      if (e < 0) { flash(`No empty seat to the ${dir} to push into — that end of the bench is full.`); return; }
      for (let i = e; i < t; i++) moves.push({ code: codes[i], guestId: occ(codes[i + 1])!.id });
    }
    moves.push({ code: targetCode, guestId: moveGuest.id });
    doBatch(moves);
    finishPlacement(targetCode);
  };

  const finishPlacement = (code: string) => {
    setPlaceChoice(null);
    setMoveGuest(null);
    setSelectedCode(code);
    setSearch('');
  };

  // ── Chair interaction ─────────────────────────────────────────────────────
  const onChairActivate = (code: string) => {
    if (editMode) { assignToActive(code); return; }
    if (moveGuest) {
      const occ = assignments[code];
      if (occ && occ.id === moveGuest.id) { finishPlacement(code); return; } // dropped on own seat
      if (occ) { setPlaceChoice({ targetCode: code, occupant: occ }); return; } // taken → swap/push
      doAssign(code, moveGuest);
      finishPlacement(code);
      return;
    }
    setSelectedCode(code);
    setSearch('');
  };

  // Start placing a guest (from a stat-card popup or the panel) — user then clicks a chair.
  const startPlacement = (g: SeatGuest) => {
    setUnseatedModal(null);
    setSelectedCode(null);
    setPlaceChoice(null);
    setMoveGuest(g);
  };

  // Open the assign picker for a seat (used by the context menu + after a push).
  const openAssignPicker = (code: string) => {
    setMenu(null);
    setMoveGuest(null);
    setSelectedCode(code);
    setSearch('');
  };

  // Right-click → "push right / left": shift the clicked seat's occupant and every
  // consecutive occupied seat toward `dir` until the first empty seat absorbs them,
  // freeing the clicked seat. Then open the picker so a guest can be inserted there.
  const pushInsert = (code: string, dir: 'right' | 'left') => {
    setMenu(null);
    const codes = pushRowOf(code);
    if (!codes) { flash('This seat is not part of a table row.'); return; }
    const t = codes.indexOf(code);
    if (t < 0) return;
    if (!assignments[code]) { openAssignPicker(code); return; } // already empty → just assign
    const step = spatialStep(codes, t, dir);
    const moves: { code: string; guestId: string }[] = [];
    if (step > 0) {
      let e = -1;
      for (let i = t + 1; i < codes.length; i++) { if (!assignments[codes[i]]) { e = i; break; } }
      if (e < 0) { flash(`No empty seat to the ${dir} to push into — that end of the bench is full.`); return; }
      for (let i = e; i > t; i--) moves.push({ code: codes[i], guestId: assignments[codes[i - 1]].id });
    } else {
      let e = -1;
      for (let i = t - 1; i >= 0; i--) { if (!assignments[codes[i]]) { e = i; break; } }
      if (e < 0) { flash(`No empty seat to the ${dir} to push into — that end of the bench is full.`); return; }
      for (let i = e; i < t; i++) moves.push({ code: codes[i], guestId: assignments[codes[i + 1]].id });
    }
    doBatch(moves);
    // clicked seat is now free — open the picker to seat someone there
    setMoveGuest(null);
    setSelectedCode(code);
    setSearch('');
  };

  const openMenu = (code: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (editMode) return;
    setMoveGuest(null);
    setSelectedCode(null);
    setPlaceChoice(null);
    setMenu({ code, x: e.clientX, y: e.clientY });
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

  const startMove = (guest: SeatGuest) => {
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
        <StatCard
          label="Unseated Groom"
          value={unseatedGroom.length}
          sub="tap to view"
          numTone={unseatedGroom.length > 0 ? 'warn' : 'muted'}
          onClick={() => setUnseatedModal('groom')}
        />
        <StatCard
          label="Unseated Bride"
          value={unseatedBride.length}
          sub="tap to view"
          numTone={unseatedBride.length > 0 ? 'warn' : 'muted'}
          onClick={() => setUnseatedModal('bride')}
        />
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
                <span className="seat-legend__item"><span className="seat-swatch seat-swatch--empty" />Empty seat</span>
                <span className="seat-legend__item"><span className="seat-swatch seat-swatch--filled" />Seated guest</span>
                <span className="seat-legend__hint">Tap a seat to assign · right-click or long-press for push / swap · pinch to zoom</span>
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

            {editMode ? (
              <div className="seat-editbar">
                <div className="seat-editbar__row">
                  <span className="seat-editbar__label">Adding chairs to</span>
                  <span className="seat-edit-active" style={{ background: tableColor(activeTable, tableNames) }}>{activeTable}</span>
                  <button type="button" className="ad-btn ad-btn--outline seat-editbar__btn" onClick={addNewTable}>+ New table</button>
                  <button type="button" className="ad-btn ad-btn--outline seat-editbar__btn" onClick={deleteActiveTable}>Clear {activeTable}</button>
                  <span className="seat-editbar__hint">Tap chairs on the plan to put them in <strong>{activeTable}</strong>. Pick another table below to edit it.</span>
                </div>
                {tableNames.length > 0 && (
                  <div className="seat-edit-chips">
                    {tableNames.map((n) => (
                      <button key={n} type="button" className={`seat-chip${n === activeTable ? ' is-active' : ''}`} style={{ ['--chip' as string]: tableColor(n, tableNames) } as React.CSSProperties} onClick={() => setActiveTable(n)}>{n}</button>
                    ))}
                  </div>
                )}
                <div className="seat-editbar__row seat-editbar__actions">
                  <button type="button" className="ad-btn ad-btn--primary" disabled={savingTables} onClick={saveTables}>{savingTables ? 'Saving…' : 'Save tables'}</button>
                  <button type="button" className="ad-btn ad-btn--outline" onClick={() => setEditMode(false)}>Cancel</button>
                  <button type="button" className="ad-btn ad-btn--outline seat-btn-danger" onClick={clearAllTables}>Clear all</button>
                  <button type="button" className="ad-btn ad-btn--outline" onClick={resetTablesToDefault} disabled={savingTables}>Reset to default</button>
                </div>
              </div>
            ) : (
              <div className="seat-editbar seat-editbar--collapsed">
                <button type="button" className="ad-btn ad-btn--outline" onClick={enterEditMode}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  Edit tables
                </button>
                <span className="seat-editbar__hint">Draw your own tables — tap chairs to group them, name each one.</span>
              </div>
            )}

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
                    editMode={editMode}
                    codeName={codeName}
                    tableNames={tableNames}
                    tables={liveTables}
                    onActivate={onChairActivate}
                    onContext={openMenu}
                    onLongPress={(code, x, y) => { if (editMode) return; setMoveGuest(null); setSelectedCode(null); setPlaceChoice(null); setMenu({ code, x, y }); }}
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
                    {editMode ? (
                      <>
                        <span className="seat-tip__name">{codeName[tip.code] ? `Table ${codeName[tip.code]}` : 'No table'}</span>
                        <span className="seat-tip__meta">Tap to add to {activeTable}</span>
                      </>
                    ) : occ ? (
                      <>
                        <span className="seat-tip__name">{occ.name}</span>
                        <span className="seat-tip__meta">{zoneOf(tip.code)} &middot; {cap(occ.side)}</span>
                      </>
                    ) : (
                      <>
                        <span className="seat-tip__name">{zoneOf(tip.code)}</span>
                        <span className="seat-tip__meta">Empty</span>
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
                  zone={zoneOf(selectedSeat.code)}
                  guest={selectedOccupant}
                  onMove={() => startMove(selectedOccupant)}
                  onClear={() => { doClear(selectedSeat.code); }}
                  onClose={closePanel}
                />
              ) : (
                <EmptyPanel
                  seat={selectedSeat}
                  zone={zoneOf(selectedSeat.code)}
                  unseated={unseated}
                  search={search}
                  setSearch={setSearch}
                  pickerSide={pickerSide}
                  setPickerSide={setPickerSide}
                  onPick={(g) => { doAssign(selectedSeat.code, g); closePanel(); }}
                  onClose={closePanel}
                />
              )
            ) : (
              <div className="seat-panel__idle">
                <h3 className="ad-section-title">Plan the room</h3>
                <p className="ad-page-desc" style={{ marginTop: '0.4rem' }}>
                  Select any chair on the plan to seat a guest. Red (filled) chairs are already
                  taken — click one to move or clear it.
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

      {/* Unseated groom / bride list popup */}
      {unseatedModal && (
        <UnseatedModal
          side={unseatedModal}
          guests={unseatedModal === 'groom' ? unseatedGroom : unseatedBride}
          onPick={startPlacement}
          onClose={() => setUnseatedModal(null)}
        />
      )}

      {/* Swap / push choice when a move lands on a taken seat */}
      {placeChoice && moveGuest && (
        <PlaceChoiceModal
          movingName={moveGuest.name}
          movingHasSeat={!!moveGuest.seatCode}
          occupant={placeChoice.occupant}
          zone={zoneOf(placeChoice.targetCode)}
          onSwap={() => doSwap(placeChoice.targetCode, placeChoice.occupant)}
          onPushRight={() => doPush(placeChoice.targetCode, 'right')}
          onPushLeft={() => doPush(placeChoice.targetCode, 'left')}
          onClose={() => setPlaceChoice(null)}
        />
      )}

      {/* Right-click chair context menu */}
      {menu && (
        <ChairMenu
          x={menu.x}
          y={menu.y}
          zone={zoneOf(menu.code)}
          occupant={assignments[menu.code] || null}
          onAssign={() => openAssignPicker(menu.code)}
          onMove={() => { const o = assignments[menu.code]; setMenu(null); if (o) startMove(o); }}
          onPushRight={() => pushInsert(menu.code, 'right')}
          onPushLeft={() => pushInsert(menu.code, 'left')}
          onClear={() => { setMenu(null); doClear(menu.code); }}
        />
      )}

      {toast && <div className="seat-toast ad-notice ad-notice--bad" role="alert">{toast}</div>}
    </div>
  );
}

// Right-click chair menu. Positioned at the cursor, clamped to the viewport.
function ChairMenu({ x, y, zone, occupant, onAssign, onMove, onPushRight, onPushLeft, onClear }: {
  x: number; y: number; zone: string; occupant: SeatGuest | null;
  onAssign: () => void; onMove: () => void; onPushRight: () => void; onPushLeft: () => void; onClear: () => void;
}) {
  const W = 236, H = occupant ? 232 : 96;
  const left = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - W - 8) : x;
  const top = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - H - 8) : y;
  return (
    <div
      className="seat-menu"
      style={{ left, top }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="seat-menu__head">{zone}{occupant ? ` · ${occupant.name}` : ' · Empty'}</div>
      {occupant ? (
        <>
          <button type="button" role="menuitem" className="seat-menu__item" onClick={onPushRight}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            <span>Push right<em>insert here, shift others right →</em></span>
          </button>
          <button type="button" role="menuitem" className="seat-menu__item" onClick={onPushLeft}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            <span>Push left<em>insert here, shift others left ←</em></span>
          </button>
          <div className="seat-menu__sep" />
          <button type="button" role="menuitem" className="seat-menu__item" onClick={onMove}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
            <span>Move / swap guest…</span>
          </button>
          <button type="button" role="menuitem" className="seat-menu__item seat-menu__item--danger" onClick={onClear}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
            <span>Clear seat</span>
          </button>
        </>
      ) : (
        <button type="button" role="menuitem" className="seat-menu__item" onClick={onAssign}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
          <span>Assign a guest here</span>
        </button>
      )}
    </div>
  );
}

// ── Floor plan SVG ───────────────────────────────────────────────────────────
function FloorPlan({
  assignments,
  selectedCode,
  focusedCode,
  moveActive,
  editMode,
  codeName,
  tableNames,
  tables,
  onActivate,
  onContext,
  onLongPress,
  onHover,
  onLeave,
  onFocusChair,
  onBlurChair,
}: {
  assignments: Record<string, SeatGuest>;
  selectedCode: string | null;
  focusedCode: string | null;
  moveActive: boolean;
  editMode: boolean;
  codeName: Record<string, string>;
  tableNames: string[];
  tables: { name: string; cx: number; cy: number }[];
  onActivate: (code: string) => void;
  onContext: (code: string, e: React.MouseEvent) => void;
  onLongPress: (code: string, x: number, y: number) => void;
  onHover: (code: string, el: SVGGElement | null) => void;
  onLeave: () => void;
  onFocusChair: (code: string, el: SVGGElement | null) => void;
  onBlurChair: () => void;
}) {
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpFired = useRef(false);
  return (
    <svg
      className="seat-svg"
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      role="group"
      aria-label={`Venue floor plan with ${SEAT_COUNT} chairs`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* exact venue floor plan rendered from the CAD (walls, aisles, tables, stage, theater, trees) */}
      <image href={PLAN_IMAGE} x={0} y={0} width={VIEWBOX.w} height={VIEWBOX.h} preserveAspectRatio="none" />

      {/* interactive chairs — invisible overlays sitting exactly on the plan's seats */}
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
          ? `${s.zone}, seated: ${occ.name}. Activate to manage.`
          : `${s.zone}, empty. Activate to assign a guest.`;
        const hw = Math.max(s.w, s.h) / 2 + 1;
        return (
          <g
            key={s.code}
            className={cls}
            transform={`translate(${s.x} ${s.y}) rotate(${s.rot})`}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={selectedCode === s.code}
            onClick={(e) => {
              if (lpFired.current) { lpFired.current = false; return; } // long-press already handled it
              onActivate(s.code); (e.currentTarget as SVGGElement).blur?.();
            }}
            onContextMenu={(e) => onContext(s.code, e)}
            onTouchStart={(e) => {
              lpFired.current = false;
              const tch = e.touches[0];
              const cx = tch?.clientX ?? 0, cy = tch?.clientY ?? 0;
              if (lpTimer.current) clearTimeout(lpTimer.current);
              lpTimer.current = setTimeout(() => { lpFired.current = true; onLongPress(s.code, cx, cy); }, 500);
            }}
            onTouchMove={() => { if (lpTimer.current) clearTimeout(lpTimer.current); }}
            onTouchEnd={(e) => {
              if (lpTimer.current) clearTimeout(lpTimer.current);
              if (lpFired.current) e.preventDefault(); // swallow the emulated click after a long-press
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(s.code); }
            }}
            onMouseEnter={(e) => onHover(s.code, e.currentTarget)}
            onMouseLeave={onLeave}
            onFocus={(e) => onFocusChair(s.code, e.currentTarget)}
            onBlur={onBlurChair}
          >
            {/* enlarged transparent hit area for pointer/touch */}
            <rect className="seat-chair-hit" x={-hw - 3} y={-hw - 3} width={2 * hw + 6} height={2 * hw + 6} />
            {/* seat body: invisible when empty (the plan image shows the seat), coloured when filled/hovered.
                In Edit-tables mode every chair is tinted by its table colour instead. */}
            <rect
              className="seat-chair-body"
              x={-s.w / 2}
              y={-s.h / 2}
              width={s.w}
              height={s.h}
              rx={1.6}
              style={editMode ? { fill: codeName[s.code] ? tableColor(codeName[s.code], tableNames) : '#5a5550', stroke: 'rgba(0,0,0,0.35)' } : undefined}
            />
          </g>
        );
      })}

      {/* table letters — float over each table's centre. pointer-events:none so
          chairs underneath stay clickable. Reflects custom/edited tables live. */}
      {tables.map((t) => (
        <g key={`tl-${t.name}`} className="seat-tablelabel" aria-hidden="true">
          <circle cx={t.cx} cy={t.cy} r={9.5} />
          <text x={t.cx} y={t.cy} textAnchor="middle" dominantBaseline="central">{t.name}</text>
        </g>
      ))}

      {/* selection / focus ring drawn on top */}
      {[selectedCode, focusedCode].map((code, i) => {
        if (!code || (i === 1 && code === selectedCode)) return null;
        const s = SEAT_BY_CODE[code];
        if (!s) return null;
        const r = Math.max(s.w, s.h) / 2 + 4;
        return (
          <rect
            key={`ring-${i}-${code}`}
            className={i === 0 ? 'seat-ring seat-ring--sel' : 'seat-ring seat-ring--focus'}
            x={s.x - r}
            y={s.y - r}
            width={2 * r}
            height={2 * r}
            rx={4}
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

function FilledPanel({ seat, zone, guest, onMove, onClear, onClose }: {
  seat: SeatDef; zone: string; guest: SeatGuest; onMove: () => void; onClear: () => void; onClose: () => void;
}) {
  return (
    <div className="seat-panel__body">
      <PanelHead title={zone} sub="Seated guest" onClose={onClose} />
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

function EmptyPanel({ seat, zone, unseated, search, setSearch, pickerSide, setPickerSide, onPick, onClose }: {
  seat: SeatDef; zone: string; unseated: SeatGuest[]; search: string; setSearch: (v: string) => void;
  pickerSide: 'all' | 'groom' | 'bride'; setPickerSide: (v: 'all' | 'groom' | 'bride') => void;
  onPick: (g: SeatGuest) => void; onClose: () => void;
}) {
  const q = search.toLowerCase().trim();
  const bySide = pickerSide === 'all' ? unseated : unseated.filter((g) => g.side === pickerSide);
  const list = q
    ? bySide.filter((g) => g.name.toLowerCase().includes(q) || g.groupCode.toLowerCase().includes(q) || g.side.toLowerCase().includes(q))
    : bySide;
  const counts = {
    all: unseated.length,
    groom: unseated.filter((g) => g.side === 'groom').length,
    bride: unseated.filter((g) => g.side === 'bride').length,
  };
  return (
    <div className="seat-panel__body">
      <PanelHead title={zone} sub="Empty seat" onClose={onClose} />
      <p style={{ fontSize: '0.74rem', color: 'var(--ad-muted)', margin: '-0.25rem 0 0.65rem' }}>
        Only guests who confirmed attendance can be seated.
      </p>
      <div className="seat-sidetabs" role="tablist" aria-label="Filter unseated guests by side">
        {(['all', 'groom', 'bride'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={pickerSide === s}
            className={`seat-sidetab${pickerSide === s ? ' is-active' : ''}`}
            onClick={() => setPickerSide(s)}
          >
            {s === 'all' ? 'All' : cap(s)}
            <span className="seat-sidetab__count">{counts[s]}</span>
          </button>
        ))}
      </div>
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
        <p className="ad-empty">No confirmed guests are waiting for a seat.</p>
      ) : bySide.length === 0 ? (
        <p className="ad-empty">No unseated {pickerSide} guests.</p>
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

// ── Modals ────────────────────────────────────────────────────────────────
function UnseatedModal({ side, guests, onPick, onClose }: {
  side: 'groom' | 'bride'; guests: SeatGuest[]; onPick: (g: SeatGuest) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const query = q.toLowerCase().trim();
  const list = query
    ? guests.filter((g) => g.name.toLowerCase().includes(query) || g.groupCode.toLowerCase().includes(query))
    : guests;
  return (
    <div className="seat-modal-scrim" onClick={onClose} role="presentation">
      <div className="seat-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Unseated ${side} guests`}>
        <div className="seat-panel__head" style={{ marginBottom: '0.75rem' }}>
          <div>
            <div className="ad-eyebrow">{cap(side)} side</div>
            <h3 className="ad-section-title" style={{ fontSize: '1.2rem' }}>Unseated &middot; {guests.length}</h3>
          </div>
          <button type="button" className="ad-icon-btn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {guests.length > 6 && (
          <div className="ad-search" style={{ marginBottom: '0.7rem' }}>
            <span className="ad-search__icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </span>
            <input type="text" className="ad-input ad-input--search" placeholder="Search by name or group…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search unseated guests" autoFocus />
            {q && <button className="ad-search__clear" onClick={() => setQ('')} aria-label="Clear search">&times;</button>}
          </div>
        )}
        {guests.length === 0 ? (
          <p className="ad-empty">Every confirmed {side} guest has a seat. 🎉</p>
        ) : list.length === 0 ? (
          <p className="ad-empty">No {side} guests match &ldquo;{q}&rdquo;.</p>
        ) : (
          <ul className="seat-picker" aria-label={`Unseated ${side} guests`}>
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
        <p style={{ fontSize: '0.72rem', color: 'var(--ad-muted)', margin: '0.7rem 0 0' }}>
          Tap a guest, then click a chair on the plan to seat them.
        </p>
      </div>
    </div>
  );
}

function PlaceChoiceModal({ movingName, movingHasSeat, occupant, zone, onSwap, onPushRight, onPushLeft, onClose }: {
  movingName: string; movingHasSeat: boolean; occupant: SeatGuest; zone: string;
  onSwap: () => void; onPushRight: () => void; onPushLeft: () => void; onClose: () => void;
}) {
  return (
    <div className="seat-modal-scrim" onClick={onClose} role="presentation">
      <div className="seat-modal seat-modal--choice" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Seat already taken">
        <div className="seat-panel__head" style={{ marginBottom: '0.6rem' }}>
          <div>
            <div className="ad-eyebrow">{zone}</div>
            <h3 className="ad-section-title" style={{ fontSize: '1.15rem' }}>Seat taken by {occupant.name}</h3>
          </div>
          <button type="button" className="ad-icon-btn" onClick={onClose} aria-label="Cancel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--ad-body)', margin: '0 0 0.9rem' }}>
          Where should <strong>{movingName}</strong> go?
        </p>
        <div className="seat-choice-grid">
          <button type="button" className="seat-choice" onClick={onSwap}>
            <span className="seat-choice__icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
            </span>
            <span className="seat-choice__title">{movingHasSeat ? 'Swap seats' : `Take seat`}</span>
            <span className="seat-choice__desc">{movingHasSeat ? `${movingName} ⇄ ${occupant.name}` : `Move ${occupant.name} out`}</span>
          </button>
          <button type="button" className="seat-choice" onClick={onPushLeft}>
            <span className="seat-choice__icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            </span>
            <span className="seat-choice__title">Push left</span>
            <span className="seat-choice__desc">Shift this seat &amp; those left ←</span>
          </button>
          <button type="button" className="seat-choice" onClick={onPushRight}>
            <span className="seat-choice__icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </span>
            <span className="seat-choice__title">Push right</span>
            <span className="seat-choice__desc">Shift this seat &amp; those right →</span>
          </button>
        </div>
        <button type="button" className="ad-btn ad-btn--outline" style={{ width: '100%', marginTop: '0.9rem' }} onClick={onClose}>Cancel</button>
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
function StatCard({ label, value, sub, tone, numTone, onClick }: {
  label: string; value: string | number; sub?: string; tone?: 'accent' | 'ok'; numTone?: 'ok' | 'bad' | 'warn' | 'muted';
  onClick?: () => void;
}) {
  const cardTone = tone === 'accent' ? 'ad-stat--accent' : tone === 'ok' ? 'ad-stat--ok' : '';
  const valueClass = numTone ? numToneClass[numTone] : '';
  const mutedNum = numTone === 'muted';
  const inner = (
    <>
      <span className="ad-stat__label">{label}</span>
      <span className={`ad-stat__value ${valueClass}`} style={mutedNum ? { color: 'var(--ad-muted)' } : undefined}>
        {value}
        {sub && <span className="ad-stat__sub">{sub}</span>}
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`ad-stat seat-stat-btn ${cardTone}`} onClick={onClick} aria-label={`${label}: ${value}. Tap to view the list.`}>
        {inner}
      </button>
    );
  }
  return <div className={`ad-stat ${cardTone}`}>{inner}</div>;
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
    .seat-swatch--empty { background: #efece6; border: 1px solid #b3a89a; }
    .seat-swatch--filled { background: #e5484d; }
    .seat-legend__hint { color: var(--ad-muted); font-size: 0.72rem; }
    @media (max-width: 560px) { .seat-legend__hint { display: none; } }

    .seat-zoom { display: inline-flex; align-items: center; gap: 0.25rem; }
    .seat-zoom__val { font-size: 0.76rem; color: var(--ad-muted); min-width: 42px; text-align: center; }

    .seat-movebar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem; }

    /* Edit-tables mode bar */
    .seat-editbar { display: flex; flex-direction: column; gap: 0.55rem; margin-bottom: 0.75rem; padding: 0.7rem 0.85rem; background: var(--ad-raised); border: 1px solid var(--ad-border); border-radius: var(--ad-r-ctrl); }
    .seat-editbar--collapsed { flex-direction: row; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .seat-editbar__row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .seat-editbar__actions { margin-top: 0.15rem; }
    .seat-editbar__label { font-size: 0.8rem; color: var(--ad-body); }
    .seat-editbar__btn { padding: 0.32rem 0.55rem; font-size: 0.78rem; }
    .seat-editbar__hint { font-size: 0.74rem; color: var(--ad-muted); flex: 1 1 200px; min-width: 0; }
    .seat-edit-active { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 26px; padding: 0 0.5rem; border-radius: 7px; color: #fff; font-weight: 700; font-family: var(--ad-font-serif, Georgia, serif); }
    .seat-edit-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; max-height: 96px; overflow-y: auto; }
    .seat-chip { min-width: 28px; height: 26px; padding: 0 0.35rem; border-radius: 6px; border: 2px solid transparent; background: var(--ad-surface); color: var(--ad-ink); font-weight: 700; font-size: 0.78rem; cursor: pointer; box-shadow: inset 0 0 0 2px var(--chip); }
    .seat-chip.is-active { border-color: var(--chip); background: var(--chip); color: #fff; box-shadow: none; }

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
    .seat-svg image { image-rendering: auto; }

    /* interactive chairs (overlay the CAD plan image) */
    .seat-chair { cursor: pointer; }
    .seat-chair:focus { outline: none; }
    .seat-chair-hit { fill: transparent; }
    .seat-chair-body { fill: transparent; stroke: transparent; stroke-width: 0.8; transition: fill 0.14s ease, stroke 0.14s ease; }
    .seat-chair.is-filled .seat-chair-body { fill: #e5484d; stroke: #b42318; }
    .seat-chair.is-empty:hover .seat-chair-body { fill: var(--ad-accent-soft); stroke: var(--ad-accent); }
    .seat-chair.is-filled:hover .seat-chair-body { fill: #c0362f; stroke: #8a1c14; }
    .seat-chair.is-target .seat-chair-body { fill: var(--ad-accent-soft); stroke: var(--ad-accent); stroke-width: 1; stroke-dasharray: 2.4 1.8; animation: seat-pulse 1.4s ease-in-out infinite; }
    @keyframes seat-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    /* table letters over the plan */
    .seat-tablelabel { pointer-events: none; }
    .seat-tablelabel circle { fill: rgba(15, 13, 10, 0.64); stroke: rgba(255, 255, 255, 0.55); stroke-width: 0.8; }
    .seat-tablelabel text { fill: #fff; font-size: 12px; font-weight: 700; font-family: var(--ad-font-serif, Georgia, serif); }

    .seat-ring { fill: none; pointer-events: none; }
    .seat-ring--sel { stroke: var(--ad-accent); stroke-width: 1.6; }
    .seat-ring--focus { stroke: var(--ad-accent-strong); stroke-width: 1.4; stroke-dasharray: 3 2.4; }

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

    /* clickable stat cards (unseated groom / bride) */
    .seat-stat-btn { cursor: pointer; text-align: left; font: inherit; width: 100%; transition: border-color 0.14s ease, box-shadow 0.14s ease, background-color 0.14s ease; }
    .seat-stat-btn:hover { border-color: var(--ad-accent); box-shadow: var(--ad-shadow); }
    .seat-stat-btn:focus-visible { outline: 2px solid var(--ad-accent); outline-offset: 2px; }
    .seat-stat-btn .ad-stat__sub { text-transform: uppercase; letter-spacing: 0.03em; }

    /* side-filter tabs in the picker */
    .seat-sidetabs { display: inline-flex; gap: 0.25rem; padding: 0.2rem; background: var(--ad-raised); border: 1px solid var(--ad-border); border-radius: 999px; margin-bottom: 0.7rem; }
    .seat-sidetab { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.32rem 0.7rem; border: none; background: transparent; border-radius: 999px; font-size: 0.78rem; font-weight: 600; color: var(--ad-muted); cursor: pointer; transition: background-color 0.14s ease, color 0.14s ease; }
    .seat-sidetab:hover { color: var(--ad-ink); }
    .seat-sidetab.is-active { background: var(--ad-surface); color: var(--ad-ink); box-shadow: var(--ad-shadow); }
    .seat-sidetab__count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--ad-border); color: var(--ad-body); font-size: 0.68rem; }
    .seat-sidetab.is-active .seat-sidetab__count { background: var(--ad-accent-soft); color: var(--ad-accent-strong); }

    /* centred modals (unseated list + swap/push choice) */
    .seat-modal-scrim { position: fixed; inset: 0; z-index: 80; background: rgba(20, 18, 15, 0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .seat-modal { width: 100%; max-width: 420px; max-height: 84vh; overflow-y: auto; background: var(--ad-surface); border: 1px solid var(--ad-border); border-radius: var(--ad-r-card); box-shadow: var(--ad-shadow); padding: 1.15rem 1.2rem 1.25rem; }
    .seat-modal--choice { max-width: 460px; }
    .seat-choice-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; }
    @media (max-width: 480px) { .seat-choice-grid { grid-template-columns: 1fr; } }
    .seat-choice { display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem; text-align: left; padding: 0.7rem 0.75rem; background: var(--ad-surface); border: 1px solid var(--ad-border); border-radius: var(--ad-r-ctrl); cursor: pointer; transition: background-color 0.14s ease, border-color 0.14s ease, transform 0.08s ease; }
    .seat-choice:hover { background: var(--ad-accent-soft); border-color: var(--ad-accent); }
    .seat-choice:active { transform: translateY(1px); }
    .seat-choice__icon { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 9px; background: var(--ad-accent-soft); color: var(--ad-accent-strong); margin-bottom: 0.15rem; }
    .seat-choice__title { font-size: 0.86rem; font-weight: 700; color: var(--ad-ink); }
    .seat-choice__desc { font-size: 0.7rem; color: var(--ad-muted); line-height: 1.25; }

    /* right-click chair context menu */
    .seat-menu { position: fixed; z-index: 90; width: 236px; background: var(--ad-surface); border: 1px solid var(--ad-border); border-radius: 12px; box-shadow: var(--ad-shadow); padding: 0.3rem; }
    .seat-menu__head { font-size: 0.7rem; font-weight: 600; color: var(--ad-muted); padding: 0.4rem 0.5rem 0.35rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .seat-menu__sep { height: 1px; background: var(--ad-border); margin: 0.25rem 0.3rem; }
    .seat-menu__item { width: 100%; display: flex; align-items: center; gap: 0.55rem; text-align: left; padding: 0.5rem 0.55rem; background: transparent; border: none; border-radius: 8px; cursor: pointer; color: var(--ad-ink); transition: background-color 0.12s ease; }
    .seat-menu__item:hover { background: var(--ad-accent-soft); }
    .seat-menu__item svg { flex: 0 0 auto; color: var(--ad-accent-strong); }
    .seat-menu__item span { display: flex; flex-direction: column; font-size: 0.84rem; font-weight: 600; line-height: 1.25; min-width: 0; }
    .seat-menu__item span em { font-style: normal; font-size: 0.68rem; font-weight: 400; color: var(--ad-muted); }
    .seat-menu__item--danger { color: var(--ad-bad); }
    .seat-menu__item--danger svg { color: var(--ad-bad); }
    .seat-menu__item--danger:hover { background: var(--ad-bad-soft); }

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
