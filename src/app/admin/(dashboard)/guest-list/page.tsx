'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { SEAT_BY_CODE } from '@/lib/seatLayout';
import { useIsMobile } from '@/lib/useIsMobile';

// ── Types ────────────────────────────────────────────────────────────────────
interface Guest {
  id: string;
  name: string;
  phone: string | null;
  side: string;
  relation: string;
  circle: string | null;
  rsvpManual: string | null;
  notes: string | null;
  waSentCount: number;
  waSentAt: string | null;
  groupCode: string;
  sortOrder: number;
}
interface Rsvp { attending: boolean; numberAttending: number }
interface Group {
  id: string;
  groupCode: string;
  maxGuests: number;
  side: string;
  token: string;
  inRsvp: boolean;
  rsvpResponse: Rsvp | null;
  guests: Guest[];
}

const CIRCLES = ['Immediate Fam', 'Fathers', 'Mothers', 'Ghassan Guests', 'Ranas Guests', 'Friends', 'Social'];
const RSVP_OPTIONS = ['Pending', 'Coming', 'Not coming'];

// Same invite-link format as the old section: a short link off the site root, keyed by group code.
// An Arabic link carries ?lang=ar so the page opens directly in Arabic.
const inviteLink = (groupCode: string, lang: 'en' | 'ar' = 'en') =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}/?g=${groupCode}${lang === 'ar' ? '&lang=ar' : ''}`;

// Normalize a phone for wa.me (default Lebanon +961), then strip the leading + so wa.me gets pure digits.
function formatPhoneForWhatsApp(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('0') && !p.startsWith('+')) p = '+961' + p.slice(1);
  if (!p.startsWith('+') && p.length <= 8) p = '+961' + p;
  if (!p.startsWith('+')) p = '+' + p;
  return p.replace('+', '');
}

interface EventInfo { date: string; time: string; venue: string; dateAr: string; timeAr: string; venueAr: string }
function whatsAppUrl(phone: string, name: string, link: string, ev: EventInfo, lang: 'en' | 'ar' = 'en'): string {
  const msg =
    lang === 'ar'
      ? `مرحباً ${name}! يسعدنا دعوتكم لحضور حفل زفاف حسين وسوزان 💍\n` +
        `📅 ${ev.dateAr}\n` +
        `🕐 ${ev.timeAr}\n` +
        `📍 ${ev.venueAr}\n` +
        `نرجو تأكيد الحضور من هنا: ${link}`
      : `Hello ${name}! You're warmly invited to Hussein & Suzan's wedding 💍\n` +
        `📅 ${ev.date}\n` +
        `🕐 ${ev.time}\n` +
        `📍 ${ev.venue}\n` +
        `Kindly RSVP here: ${link}`;
  return `https://wa.me/${formatPhoneForWhatsApp(phone)}?text=${encodeURIComponent(msg)}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function GuestListPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaOutdated, setSchemaOutdated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<'bride' | 'groom'>('bride');
  const [toast, setToast] = useState<{ msg: string; bad?: boolean } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState<{ count: number; groups: number; rows: any[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [seatByGuestId, setSeatByGuestId] = useState<Record<string, string>>({});
  const [notePopup, setNotePopup] = useState<Guest | null>(null);
  const [waBlock, setWaBlock] = useState<string | null>(null);
  const [waLang, setWaLang] = useState<{ group: Group; guest: Guest } | null>(null);
  const [eventInfo, setEventInfo] = useState<EventInfo>({ date: '25 August', time: '8:00 PM', venue: 'Pleine Nature', dateAr: '٢٥ آب', timeAr: '٨:٠٠ مساءً', venueAr: 'Pleine Nature' });
  const [menu, setMenu] = useState<{ group: Group; x: number; y: number } | null>(null);
  const [circles, setCircles] = useState<string[]>(CIRCLES);
  const [showSettings, setShowSettings] = useState(false);
  const isMobile = useIsMobile();
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (msg: string, bad = false) => {
    setToast({ msg, bad });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3400);
  };

  const load = async () => {
    setLoading(true); setSchemaOutdated(false); setLoadError(null);
    try {
      const res = await fetch('/api/groups');
      if (res.status === 503) {
        const d = await res.json().catch(() => null);
        if (d?.code === 'SCHEMA_OUTDATED') { setSchemaOutdated(true); setLoading(false); return; }
      }
      if (!res.ok) { setLoadError('Could not load the guest list.'); setLoading(false); return; }
      setGroups(await res.json());
      // event details for the WhatsApp invite message (falls back to defaults)
      try {
        const raw = await (await fetch('/api/settings')).json();
        const st = raw?.settings || raw || {};
        const d = new Date(st.eventDate);
        const validD = !isNaN(d.getTime());
        setEventInfo({
          date: validD ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : (st.eventDate || '25 August'),
          time: st.eventTime || '8:00 PM',
          venue: st.venueNameEn || 'Pleine Nature',
          dateAr: validD ? d.toLocaleDateString('ar', { day: 'numeric', month: 'long' }) : (st.eventDate || '٢٥ آب'),
          timeAr: st.eventTimeAr || st.eventTime || '٨:٠٠ مساءً',
          venueAr: st.venueNameAr || st.venueNameEn || 'Pleine Nature',
        });
        if (Array.isArray(st.circles) && st.circles.length) setCircles(st.circles);
      } catch { /* keep defaults */ }
      // seat assignments (from the seating map) — optional; column just shows — if unavailable
      try {
        const sres = await fetch('/api/seats');
        if (sres.ok) {
          const sd = await sres.json();
          const map: Record<string, string> = {};
          for (const g of (sd.guests || [])) if (g.seatCode) map[g.id] = g.seatCode;
          setSeatByGuestId(map);
        }
      } catch { /* leave seat map empty */ }
    } catch { setLoadError('Could not load the guest list.'); }
    setLoading(false);
  };
  useEffect(() => { load(); return () => { if (toastTimer.current) clearTimeout(toastTimer.current); }; }, []);

  // groups for the active side, ordered by group code (b001, b002 …)
  const sideGroups = useMemo(() =>
    groups
      .filter((g) => g.side === tab && g.guests.length > 0)
      .map((g) => ({ ...g, guests: [...g.guests].sort((a, b) => a.sortOrder - b.sortOrder) }))
      .sort((a, b) => a.groupCode.localeCompare(b.groupCode, undefined, { numeric: true })),
  [groups, tab]);

  const totalGuests = sideGroups.reduce((s, g) => s + g.guests.length, 0);
  const overCount = sideGroups.reduce((s, g) => s + Math.max(0, g.guests.length - g.maxGuests), 0);
  const brideCount = groups.filter((g) => g.side === 'bride').reduce((s, g) => s + g.guests.length, 0);
  const groomCount = groups.filter((g) => g.side === 'groom').reduce((s, g) => s + g.guests.length, 0);

  const nextGroupCode = () => {
    const prefix = tab === 'bride' ? 'b' : 'g';
    let max = 0;
    for (const g of groups) {
      const m = g.groupCode.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
      if (m) max = Math.max(max, parseInt(m[1]));
    }
    return prefix + String(max + 1).padStart(3, '0');
  };

  // ── Local optimistic mutation helpers ──────────────────────────────────────
  const patchGuestLocal = (id: string, patch: Partial<Guest>) =>
    setGroups((prev) => prev.map((g) => ({ ...g, guests: g.guests.map((x) => (x.id === id ? { ...x, ...patch } : x)) })));

  const saveGuest = async (id: string, field: keyof Guest, value: string) => {
    const prev = groups;
    patchGuestLocal(id, { [field]: value } as Partial<Guest>);
    try {
      const res = await fetch('/api/guests', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'save failed');
    } catch (e: any) { setGroups(prev); flash(e.message || 'Could not save', true); }
  };

  const setSeats = async (group: Group, seats: number) => {
    const s = Math.max(1, seats);
    const prev = groups;
    setGroups((g) => g.map((x) => (x.id === group.id ? { ...x, maxGuests: s } : x)));
    try {
      const res = await fetch('/api/groups', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: group.id, maxGuests: s }),
      });
      if (!res.ok) throw new Error('seat update failed');
    } catch { setGroups(prev); flash('Could not update seats', true); }
  };

  const setSide = async (group: Group, side: string) => {
    const prev = groups;
    setGroups((g) => g.map((x) => (x.id === group.id ? { ...x, side, guests: x.guests.map((gg) => ({ ...gg, side })) } : x)));
    try {
      const res = await fetch('/api/groups', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: group.id, side }),
      });
      if (!res.ok) throw new Error('side update failed');
      flash(`Moved ${group.groupCode} to ${side}`);
    } catch { setGroups(prev); flash('Could not move group', true); }
  };

  const deleteGuest = async (g: Guest) => {
    if (!confirm(`Remove ${g.name}?`)) return;
    const prev = groups;
    setGroups((gs) => gs.map((x) => ({ ...x, guests: x.guests.filter((y) => y.id !== g.id) })));
    try {
      const res = await fetch('/api/guests', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id }) });
      if (!res.ok) throw new Error();
    } catch { setGroups(prev); flash('Could not delete', true); }
  };

  // seat assigned to a guest (from the seating map) -> friendly label
  const seatLabel = (guestId: string) => {
    const code = seatByGuestId[guestId];
    if (!code) return '—';
    const s = SEAT_BY_CODE[code];
    return s ? s.zone : code;
  };

  // WhatsApp: one shared invite link per group. Blocked unless the group's guest count == its seats.
  // Validates, then asks whether to send the Arabic or English invite link.
  const sendWhatsApp = (group: Group, guest: Guest) => {
    const n = group.guests.length, seats = group.maxGuests;
    if (n !== seats) {
      setWaBlock(
        `The invite link for group ${group.groupCode} can’t be generated yet — this group has ${n} guest${n === 1 ? '' : 's'} but ${seats} seat${seats === 1 ? '' : 's'}. ` +
        (n > seats
          ? `Please remove ${n - seats} guest${n - seats === 1 ? '' : 's'}, or raise the seats to ${n}, so the numbers match — then send the link.`
          : `Please add ${seats - n} more guest${seats - n === 1 ? '' : 's'}, or lower the seats to ${n}, so the numbers match — then send the link.`)
      );
      return;
    }
    if (!guest.phone) {
      setWaBlock(`${guest.name} has no phone number yet. Add a phone number to this guest to send the invite link on WhatsApp.`);
      return;
    }
    setWaLang({ group, guest }); // open the Arabic / English chooser
  };

  // Actually open WhatsApp with the chosen-language invite link + message.
  const doSendWhatsApp = (group: Group, guest: Guest, lang: 'en' | 'ar') => {
    setWaLang(null);
    if (!guest.phone) return;
    window.open(whatsAppUrl(guest.phone, guest.name, inviteLink(group.groupCode, lang), eventInfo, lang), '_blank', 'noopener,noreferrer');
    markWaSent(guest);
    if (!group.inRsvp) setGroupInRsvp(group, true); // sending the link adds the group to RSVP tracking
  };

  // add/remove a group from RSVP tracking (also set by right-clicking a group)
  const setGroupInRsvp = async (group: Group, inRsvp: boolean) => {
    const prev = groups;
    setGroups((g) => g.map((x) => (x.id === group.id ? { ...x, inRsvp } : x)));
    try {
      const res = await fetch('/api/groups', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: group.id, inRsvp }),
      });
      if (!res.ok) throw new Error();
      flash(inRsvp ? `${group.groupCode} added to RSVP tracking` : `${group.groupCode} removed from RSVP tracking`);
    } catch { setGroups(prev); flash('Could not update RSVP tracking', true); }
  };

  // Save the managed circle list; renames cascade to every guest in that circle.
  const saveCircles = async (newCircles: string[], renames: { from: string; to: string }[]) => {
    setBusy(true);
    try {
      for (const r of renames) {
        if (r.from !== r.to) {
          await fetch('/api/guests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ renameCircle: r }) });
        }
      }
      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ circles: newCircles }) });
      if (!res.ok) throw new Error('save failed');
      setCircles(newCircles);
      setShowSettings(false);
      await load();
      flash('Circles saved');
    } catch { flash('Could not save circles', true); }
    setBusy(false);
  };

  // record that the invite link was sent to this guest (increments the counter)
  const markWaSent = async (guest: Guest) => {
    patchGuestLocal(guest.id, { waSentCount: (guest.waSentCount || 0) + 1, waSentAt: new Date().toISOString() });
    try {
      await fetch('/api/guests', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: guest.id, markWaSent: true }),
      });
    } catch { /* non-critical; local count stays optimistic */ }
  };

  const addGuest = async (payload: any) => {
    setBusy(true);
    try {
      const res = await fetch('/api/guests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, side: tab }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'add failed');
      await load();
      setShowAdd(false);
      flash('Guest added');
    } catch (e: any) { flash(e.message || 'Could not add guest', true); }
    setBusy(false);
  };

  // ── Import ──────────────────────────────────────────────────────────────────
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      let h = raw.findIndex((r) => r.map((c) => String(c).toLowerCase().trim()).includes('name'));
      if (h < 0) { flash('No "Name" column found in the file.', true); return; }
      const headers = raw[h].map((c) => String(c).toLowerCase().trim());
      const col = (names: string[]) => headers.findIndex((x) => names.includes(x));
      const ci = {
        name: col(['name']), phone: col(['phone', 'phone number']), side: col(['side']),
        circle: col(['circle']), seats: col(['seats', 'gt', 'max guests']),
        group: col(['group id', 'group code', 'group #', 'group']),
        rsvp: col(['rsvp']), notes: col(['notes']),
      };
      const at = (r: any[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '');
      const rows = raw.slice(h + 1)
        .filter((r) => r.some((c) => String(c).trim() !== ''))
        .map((r) => {
          const rv = at(r, ci.rsvp);
          return {
            name: at(r, ci.name), phone: at(r, ci.phone),
            side: at(r, ci.side).toLowerCase() || tab,
            circle: at(r, ci.circle),
            maxGuests: parseInt(at(r, ci.seats)) || 0,
            groupCode: at(r, ci.group),
            rsvpManual: RSVP_OPTIONS.includes(rv) ? rv : '',
            notes: at(r, ci.notes),
          };
        })
        .filter((x) => x.name && x.groupCode);
      if (rows.length === 0) { flash('No valid rows (need Name + Group ID).', true); return; }
      setImporting({ count: rows.length, groups: new Set(rows.map((r) => r.groupCode)).size, rows });
    } catch (err: any) { flash('Could not read file: ' + err.message, true); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };

  const confirmImport = async () => {
    if (!importing) return;
    setBusy(true);
    try {
      const res = await fetch('/api/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: importing.rows }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'import failed');
      setImporting(null);
      await load();
      flash(`Imported ${d.created} guests · ${d.groupsCreated} new groups`);
    } catch (e: any) { flash(e.message || 'Import failed', true); }
    setBusy(false);
  };

  // ── Export (client-side, current tab) ──────────────────────────────────────
  const exportList = () => {
    const rows = sideGroups.flatMap((g) =>
      g.guests.map((gu) => ({
        Name: gu.name, Phone: gu.phone || '', Side: g.side,
        Circle: gu.circle || '', Seats: g.maxGuests, 'Group ID': g.groupCode,
        RSVP: gu.rsvpManual || autoRsvp(g), Seat: seatByGuestId[gu.id] ? seatLabel(gu.id) : '',
        Sent: gu.waSentCount || '', Notes: gu.notes || '',
      }))
    );
    const ws = XLSX.utils.json_to_sheet(rows, { header: ['Name', 'Phone', 'Side', 'Circle', 'Seats', 'Group ID', 'RSVP', 'Seat', 'Sent', 'Notes'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab === 'bride' ? 'Bride' : 'Groom');
    XLSX.writeFile(wb, `${tab}-guest-list.xlsx`);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <GuestListStyles />
      <header className="ad-header">
        <div>
          <div className="ad-eyebrow" style={{ marginBottom: '0.4rem' }}>Guests</div>
          <h1 className="ad-title">Guest List</h1>
          <p className="ad-page-desc">Manage everyone by side. Click any cell to edit. Names past a group&rsquo;s seats show in red.</p>
        </div>
        <button className="ad-icon-btn gl-gear" onClick={() => setShowSettings(true)} aria-label="Circle settings" title="Settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      {/* Tabs */}
      <div className="gl-tabs" role="tablist" aria-label="Guest side">
        <button role="tab" aria-selected={tab === 'bride'} className={`gl-tab${tab === 'bride' ? ' is-active' : ''}`} onClick={() => setTab('bride')}>
          Bride <span className="gl-tab__count">{brideCount}</span>
        </button>
        <button role="tab" aria-selected={tab === 'groom'} className={`gl-tab${tab === 'groom' ? ' is-active' : ''}`} onClick={() => setTab('groom')}>
          Groom <span className="gl-tab__count">{groomCount}</span>
        </button>
      </div>

      {schemaOutdated ? (
        <SchemaNotice onRetry={load} />
      ) : loadError ? (
        <div className="ad-card" style={{ padding: '1.25rem' }}>
          <div className="ad-notice ad-notice--bad">{loadError}</div>
          <button className="ad-btn ad-btn--outline" style={{ marginTop: '1rem' }} onClick={load}>Try again</button>
        </div>
      ) : loading ? (
        <div className="ad-card"><div className="ad-skel" style={{ height: 360, borderRadius: 12 }} /></div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="gl-toolbar">
            <div className="gl-stats">
              <span><strong className="ad-nums">{totalGuests}</strong> guests</span>
              <span className="gl-dot">·</span>
              <span><strong className="ad-nums">{sideGroups.length}</strong> groups</span>
              {overCount > 0 && (<><span className="gl-dot">·</span><span className="gl-over-badge">{overCount} over capacity</span></>)}
            </div>
            <div className="gl-actions">
              <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={onFile} />
              <button className="ad-btn ad-btn--outline ad-btn--sm" onClick={() => fileRef.current?.click()}>
                <UploadIcon /> Import
              </button>
              <button className="ad-btn ad-btn--outline ad-btn--sm" onClick={exportList} disabled={totalGuests === 0}>
                <DownloadIcon /> Export
              </button>
              <button className="ad-btn ad-btn--primary ad-btn--sm" onClick={() => setShowAdd(true)}>
                <PlusIcon /> Add guest
              </button>
            </div>
          </div>

          {sideGroups.length === 0 ? (
            <div className="ad-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <h2 className="ad-section-title">No {tab} guests yet</h2>
              <p className="ad-page-desc" style={{ margin: '0.5rem auto 0' }}>
                Import a list or add guests manually to get started.
              </p>
            </div>
          ) : isMobile ? (
            <div className="gl-cards">
              {sideGroups.map((g) => (
                <div key={g.id} className="gl-mcard">
                  <div className="gl-mcard__head">
                    <span className="gl-mcard__gid">{g.groupCode}</span>
                    <EditSelect value={g.side} options={['bride', 'groom']} onSave={(v) => setSide(g, v)} cap />
                    <div className="gl-mcard__spacer" />
                    <span className="gl-mcard__lbl">Seats</span>
                    <SeatsStepper seats={g.maxGuests} count={g.guests.length} onChange={(s) => setSeats(g, s)} />
                    <button
                      className={`gl-track${g.inRsvp ? ' is-on' : ''}`}
                      onClick={() => setGroupInRsvp(g, !g.inRsvp)}
                      title={g.inRsvp ? 'In RSVP tracking — tap to remove' : 'Add to RSVP tracking'}
                      aria-pressed={g.inRsvp}
                    >
                      {g.inRsvp
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        : <span className="gl-track-dot" />}
                    </button>
                  </div>
                  <div className="gl-mcard__body">
                    {g.guests.map((gu, i) => (
                      <div key={gu.id} className={`gl-mguest${i >= g.maxGuests ? ' is-over' : ''}`}>
                        <div className="gl-mguest__info">
                          <EditText value={gu.name} onSave={(v) => saveGuest(gu.id, 'name', v)} placeholder="Name" strong />
                          <div className="gl-mguest__line">
                            <EditText value={gu.phone || ''} onSave={(v) => saveGuest(gu.id, 'phone', v)} placeholder="+ add phone" mono />
                            <EditSelect value={gu.circle || ''} options={circles} onSave={(v) => saveGuest(gu.id, 'circle', v)} placeholder="circle" allowBlank />
                          </div>
                          <div className="gl-mguest__line gl-mguest__meta">
                            <RsvpCell guest={gu} auto={autoRsvp(g)} onSave={(v) => saveGuest(gu.id, 'rsvpManual', v)} />
                            {seatByGuestId[gu.id] && <span className="gl-mguest__seat ad-nums">{seatLabel(gu.id)}</span>}
                            {gu.waSentCount > 0 && (
                              <span className="gl-sent ad-nums"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>{gu.waSentCount}</span>
                            )}
                          </div>
                        </div>
                        <div className="gl-mguest__acts">
                          <button className="gl-act gl-act--wa" onClick={() => sendWhatsApp(g, gu)} aria-label={`Send WhatsApp invite to ${gu.name}`}><WaIcon /></button>
                          <button className={`gl-act gl-note-btn${gu.notes ? ' has-note' : ''}`} onClick={() => setNotePopup(gu)} aria-label={`Note for ${gu.name}`}><NoteIcon filled={!!gu.notes} /></button>
                          <button className="gl-act gl-del" onClick={() => deleteGuest(gu)} aria-label={`Remove ${gu.name}`}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2m-9 0v14a2 2 0 002 2h6a2 2 0 002-2V6" /></svg></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ad-card gl-tablecard">
              <div className="gl-scroll">
                <table className="gl-table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Phone</th><th>Side</th><th>Circle</th>
                      <th className="gl-c-center">Seats</th><th>Group ID</th><th className="gl-c-center">In RSVP</th><th>RSVP</th><th className="gl-c-center">Seat</th><th className="gl-c-center">Sent</th><th aria-label="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {sideGroups.map((g, gi) => (
                      g.guests.map((gu, i) => {
                        const over = i >= g.maxGuests;
                        const rowCls = `gl-row${i === 0 ? ' gl-row--groupstart' : ''}${gi % 2 ? ' gl-row--band' : ''}${over ? ' gl-row--over' : ''}`;
                        return (
                          <tr key={gu.id} className={rowCls} onContextMenu={(e) => { e.preventDefault(); setMenu({ group: g, x: e.clientX, y: e.clientY }); }}>
                            <td><EditText value={gu.name} onSave={(v) => saveGuest(gu.id, 'name', v)} placeholder="Name" strong /></td>
                            <td><EditText value={gu.phone || ''} onSave={(v) => saveGuest(gu.id, 'phone', v)} placeholder="—" mono /></td>
                            {i === 0 && (
                              <td rowSpan={g.guests.length} className="gl-c-group">
                                <EditSelect value={g.side} options={['bride', 'groom']} onSave={(v) => setSide(g, v)} cap />
                              </td>
                            )}
                            <td><EditSelect value={gu.circle || ''} options={circles} onSave={(v) => saveGuest(gu.id, 'circle', v)} placeholder="—" allowBlank /></td>
                            {i === 0 && (
                              <td rowSpan={g.guests.length} className="gl-c-group gl-c-center">
                                <SeatsStepper seats={g.maxGuests} count={g.guests.length} onChange={(s) => setSeats(g, s)} />
                              </td>
                            )}
                            {i === 0 && (
                              <td rowSpan={g.guests.length} className="gl-c-group gl-c-gid">{g.groupCode}</td>
                            )}
                            {i === 0 && (
                              <td rowSpan={g.guests.length} className="gl-c-group gl-c-center">
                                <button className={`gl-track${g.inRsvp ? ' is-on' : ''}`} onClick={() => setGroupInRsvp(g, !g.inRsvp)} title={g.inRsvp ? 'In RSVP tracking — click to remove' : 'Add to RSVP tracking'} aria-pressed={g.inRsvp}>
                                  {g.inRsvp
                                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                    : <span className="gl-track-dot" />}
                                </button>
                              </td>
                            )}
                            <td><RsvpCell guest={gu} auto={autoRsvp(g)} onSave={(v) => saveGuest(gu.id, 'rsvpManual', v)} /></td>
                            <td className="gl-c-center"><span className={`gl-seatlbl ad-nums${seatByGuestId[gu.id] ? '' : ' gl-seatlbl--empty'}`}>{seatLabel(gu.id)}</span></td>
                            <td className="gl-c-center">
                              {gu.waSentCount > 0 ? (
                                <span className="gl-sent ad-nums" title={`Invite link sent ${gu.waSentCount} time${gu.waSentCount === 1 ? '' : 's'}${gu.waSentAt ? ' · last on ' + new Date(gu.waSentAt).toLocaleDateString() : ''}`}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                  {gu.waSentCount}
                                </span>
                              ) : <span className="gl-sent-none">—</span>}
                            </td>
                            <td className="gl-c-actions">
                              <button className="gl-act gl-act--wa" onClick={() => sendWhatsApp(g, gu)} title="Send invite link on WhatsApp" aria-label={`Send invite link to ${gu.name} on WhatsApp`}>
                                <WaIcon />
                              </button>
                              <button className={`gl-act gl-note-btn${gu.notes ? ' has-note' : ''}`} onClick={() => setNotePopup(gu)} title={gu.notes ? 'View / edit note' : 'Add a note'} aria-label={`Note for ${gu.name}`}>
                                <NoteIcon filled={!!gu.notes} />
                              </button>
                              <button className="gl-act gl-del" onClick={() => deleteGuest(gu)} aria-label={`Remove ${gu.name}`} title="Remove">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2m-9 0v14a2 2 0 002 2h6a2 2 0 002-2V6" /></svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showAdd && (
        <AddGuestModal
          defaultGroup={nextGroupCode()}
          side={tab}
          busy={busy}
          circles={circles}
          onClose={() => setShowAdd(false)}
          onSave={addGuest}
        />
      )}

      {importing && (
        <div className="gl-modal-scrim" onClick={() => !busy && setImporting(null)}>
          <div className="gl-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="ad-section-title">Import guests</h3>
            <p className="ad-page-desc" style={{ marginTop: '0.4rem' }}>
              Ready to import <strong>{importing.count}</strong> guests across <strong>{importing.groups}</strong> groups.
              New group IDs will be created; existing ones get the new guests added.
            </p>
            <div className="gl-modal__actions">
              <button className="ad-btn ad-btn--outline" onClick={() => setImporting(null)} disabled={busy}>Cancel</button>
              <button className="ad-btn ad-btn--primary" onClick={confirmImport} disabled={busy}>{busy ? 'Importing…' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}

      {notePopup && (
        <NoteModal
          key={notePopup.id}
          guest={notePopup}
          onClose={() => setNotePopup(null)}
          onSave={(v) => { saveGuest(notePopup.id, 'notes', v); setNotePopup(null); }}
        />
      )}

      {showSettings && (
        <CircleSettingsModal circles={circles} busy={busy} onClose={() => setShowSettings(false)} onSave={saveCircles} />
      )}

      {menu && (
        <>
          <div className="gl-menu-scrim" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div className="gl-menu" style={{ left: Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 230), top: menu.y }} role="menu">
            <div className="gl-menu-head">Group {menu.group.groupCode}</div>
            <button className="gl-menu-item" onClick={() => { setGroupInRsvp(menu.group, !menu.group.inRsvp); setMenu(null); }}>
              {menu.group.inRsvp ? (
                <><span className="gl-menu-ic">✕</span> Remove from RSVP tracking</>
              ) : (
                <><span className="gl-menu-ic gl-menu-ic--ok">✓</span> Add to RSVP tracking</>
              )}
            </button>
          </div>
        </>
      )}

      {waBlock && (
        <div className="gl-modal-scrim" onClick={() => setWaBlock(null)}>
          <div className="gl-modal gl-modal--alert" onClick={(e) => e.stopPropagation()}>
            <div className="gl-alert-icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h3 className="ad-section-title" style={{ textAlign: 'center' }}>Can&rsquo;t send the link yet</h3>
            <p className="ad-page-desc" style={{ textAlign: 'center', marginTop: '0.5rem' }}>{waBlock}</p>
            <div className="gl-modal__actions" style={{ justifyContent: 'center' }}>
              <button className="ad-btn ad-btn--primary" onClick={() => setWaBlock(null)}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {waLang && (
        <div className="gl-modal-scrim" onClick={() => setWaLang(null)}>
          <div className="gl-modal gl-modal--alert" onClick={(e) => e.stopPropagation()}>
            <h3 className="ad-section-title" style={{ textAlign: 'center' }}>Which language?</h3>
            <p className="ad-page-desc" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              Send {waLang.guest.name} the invite in&hellip; The link opens the page directly in that language.
            </p>
            <div className="gl-modal__actions" style={{ justifyContent: 'center', gap: '0.75rem' }}>
              <button className="ad-btn ad-btn--primary" onClick={() => doSendWhatsApp(waLang.group, waLang.guest, 'ar')}>🇱🇧 عربي</button>
              <button className="ad-btn ad-btn--primary" onClick={() => doSendWhatsApp(waLang.group, waLang.guest, 'en')}>🇬🇧 English</button>
            </div>
            <div className="gl-modal__actions" style={{ justifyContent: 'center', marginTop: '0.6rem' }}>
              <button className="ad-btn" onClick={() => setWaLang(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`gl-toast ad-notice ${toast.bad ? 'ad-notice--bad' : 'ad-notice--ok'}`} role="status">{toast.msg}</div>}
    </div>
  );
}

function autoRsvp(g: Group) {
  if (!g.rsvpResponse) return 'Pending';
  return g.rsvpResponse.attending ? 'Coming' : 'Not coming';
}

// ── Inline editors ───────────────────────────────────────────────────────────
function EditText({ value, onSave, placeholder, strong, mono }: {
  value: string; onSave: (v: string) => void; placeholder?: string; strong?: boolean; mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const commit = () => { setEditing(false); if (draft !== value) onSave(draft.trim()); };
  if (editing) {
    return (
      <input
        className="gl-edit-input" value={draft} autoFocus
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
      />
    );
  }
  return (
    <button className={`gl-cell${strong ? ' gl-cell--strong' : ''}${mono ? ' ad-nums' : ''}${!value ? ' gl-cell--empty' : ''}`} onClick={() => setEditing(true)}>
      {value || placeholder || '—'}
    </button>
  );
}

function EditSelect({ value, options, onSave, placeholder, cap, allowBlank }: {
  value: string; options: string[]; onSave: (v: string) => void; placeholder?: string; cap?: boolean; allowBlank?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <select
        className="gl-edit-input gl-edit-select" value={value} autoFocus
        onChange={(e) => { onSave(e.target.value); setEditing(false); }}
        onBlur={() => setEditing(false)}
      >
        {allowBlank && <option value="">—</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <button className={`gl-cell${cap ? ' gl-cell--cap' : ''}${!value ? ' gl-cell--empty' : ''}`} onClick={() => setEditing(true)}>
      {value || placeholder || '—'}
    </button>
  );
}

function RsvpCell({ guest, auto, onSave }: { guest: Guest; auto: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const manual = guest.rsvpManual;
  const shown = manual || auto;
  const tone = shown === 'Coming' ? 'ok' : shown === 'Not coming' ? 'bad' : 'muted';
  if (editing) {
    return (
      <select
        className="gl-edit-input gl-edit-select" defaultValue={manual || '__auto'} autoFocus
        onChange={(e) => { onSave(e.target.value === '__auto' ? '' : e.target.value); setEditing(false); }}
        onBlur={() => setEditing(false)}
      >
        <option value="__auto">Auto ({auto})</option>
        {RSVP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <button className={`gl-rsvp gl-rsvp--${tone}`} onClick={() => setEditing(true)} title={manual ? 'Manual override' : 'From online RSVP'}>
      <span className="gl-rsvp__dot" />{shown}{!manual && <span className="gl-rsvp__auto">auto</span>}
    </button>
  );
}

function SeatsStepper({ seats, count, onChange }: { seats: number; count: number; onChange: (s: number) => void }) {
  const over = count > seats;
  return (
    <div className={`gl-seats${over ? ' gl-seats--over' : ''}`} title={over ? `${count} guests exceed ${seats} seats` : `${seats} seats`}>
      <button className="gl-seats__btn" onClick={() => onChange(seats - 1)} disabled={seats <= 1} aria-label="Fewer seats">−</button>
      <span className="gl-seats__val ad-nums">{seats}</span>
      <button className="gl-seats__btn" onClick={() => onChange(seats + 1)} aria-label="More seats">+</button>
    </div>
  );
}

// ── Add modal ────────────────────────────────────────────────────────────────
function AddGuestModal({ defaultGroup, side, busy, circles, onClose, onSave }: {
  defaultGroup: string; side: string; busy: boolean; circles: string[]; onClose: () => void; onSave: (p: any) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [circle, setCircle] = useState('');
  const [groupCode, setGroupCode] = useState(defaultGroup);
  const [seats, setSeats] = useState(2);
  const canSave = name.trim() && groupCode.trim();
  return (
    <div className="gl-modal-scrim" onClick={() => !busy && onClose()}>
      <div className="gl-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="ad-section-title">Add {side} guest</h3>
        <div className="gl-form">
          <label className="gl-field"><span>Name *</span><input className="ad-input" value={name} autoFocus onChange={(e) => setName(e.target.value)} /></label>
          <label className="gl-field"><span>Phone</span><input className="ad-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <label className="gl-field"><span>Circle</span>
            <select className="ad-input" value={circle} onChange={(e) => setCircle(e.target.value)}>
              <option value="">—</option>
              {circles.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="gl-form-row">
            <label className="gl-field"><span>Group ID *</span><input className="ad-input ad-nums" value={groupCode} onChange={(e) => setGroupCode(e.target.value)} /></label>
            <label className="gl-field gl-field--sm"><span>Seats</span><input className="ad-input ad-nums" type="number" min={1} value={seats} onChange={(e) => setSeats(parseInt(e.target.value) || 1)} /></label>
          </div>
          <p className="gl-hint">Use an existing Group ID to add this person to that invitation, or a new one to start a group.</p>
        </div>
        <div className="gl-modal__actions">
          <button className="ad-btn ad-btn--outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="ad-btn ad-btn--primary" disabled={!canSave || busy} onClick={() => onSave({ name: name.trim(), phone: phone.trim(), circle, groupCode: groupCode.trim(), seats })}>
            {busy ? 'Adding…' : 'Add guest'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteModal({ guest, onClose, onSave }: { guest: Guest; onClose: () => void; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(guest.notes || '');
  return (
    <div className="gl-modal-scrim" onClick={onClose}>
      <div className="gl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ad-eyebrow">Note</div>
        <h3 className="ad-section-title" style={{ fontSize: '1.15rem' }}>{guest.name}</h3>
        <textarea
          className="ad-input gl-note-area" value={draft} autoFocus rows={5}
          placeholder="Write a note about this guest (dietary needs, travel, seating wishes…)"
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="gl-modal__actions">
          {guest.notes && <button className="ad-btn ad-btn--outline gl-danger" style={{ marginRight: 'auto' }} onClick={() => onSave('')}>Clear</button>}
          <button className="ad-btn ad-btn--outline" onClick={onClose}>Cancel</button>
          <button className="ad-btn ad-btn--primary" onClick={() => onSave(draft.trim())}>Save note</button>
        </div>
      </div>
    </div>
  );
}

function CircleSettingsModal({ circles, busy, onClose, onSave }: {
  circles: string[]; busy: boolean; onClose: () => void; onSave: (c: string[], renames: { from: string; to: string }[]) => void;
}) {
  const [items, setItems] = useState(() => circles.map((c, i) => ({ key: `c${i}-${c}`, name: c, original: c as string | null })));
  const [newName, setNewName] = useState('');
  const addCircle = () => {
    const n = newName.trim();
    if (!n || items.some((i) => i.name.toLowerCase() === n.toLowerCase())) return;
    setItems([...items, { key: `new-${items.length}-${n}`, name: n, original: null }]);
    setNewName('');
  };
  const save = () => {
    const cleaned = items.map((i) => ({ ...i, name: i.name.trim() })).filter((i) => i.name);
    const newCircles = Array.from(new Set(cleaned.map((i) => i.name)));
    const renames = cleaned.filter((i) => i.original && i.original !== i.name).map((i) => ({ from: i.original as string, to: i.name }));
    onSave(newCircles, renames);
  };
  return (
    <div className="gl-modal-scrim" onClick={() => !busy && onClose()}>
      <div className="gl-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(94vw, 460px)' }}>
        <div className="gl-settings-tabs" role="tablist">
          <span className="gl-settings-tab is-active" role="tab" aria-selected="true">Circles</span>
        </div>
        <p className="ad-page-desc" style={{ marginTop: '0.6rem', fontSize: '0.82rem' }}>
          Add, rename, or remove the circles used to group guests. Renaming updates every guest in that circle.
        </p>
        <div className="gl-circle-list">
          {items.map((it) => (
            <div key={it.key} className="gl-circle-row">
              <input className="ad-input" value={it.name} onChange={(e) => setItems((arr) => arr.map((x) => (x.key === it.key ? { ...x, name: e.target.value } : x)))} />
              <button className="ad-icon-btn gl-danger" onClick={() => setItems((arr) => arr.filter((x) => x.key !== it.key))} aria-label={`Remove ${it.name}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2m-9 0v14a2 2 0 002 2h6a2 2 0 002-2V6" /></svg>
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="ad-empty">No circles yet — add one below.</p>}
        </div>
        <div className="gl-circle-add">
          <input className="ad-input" value={newName} placeholder="New circle name…" onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCircle(); } }} />
          <button className="ad-btn ad-btn--outline" onClick={addCircle} disabled={!newName.trim()}>Add</button>
        </div>
        <div className="gl-modal__actions">
          <button className="ad-btn ad-btn--outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="ad-btn ad-btn--primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function SchemaNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="ad-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
      <h2 className="ad-section-title">One quick database update needed</h2>
      <p className="ad-page-desc" style={{ margin: '0.6rem auto 0', maxWidth: 460 }}>
        The Guest List uses a few new fields (Circle, RSVP override, Notes). Run the migration once, then reload:
      </p>
      <code className="gl-code">npx prisma db push</code>
      <button className="ad-btn ad-btn--outline" style={{ marginTop: '1.25rem' }} onClick={onRetry}>Reload</button>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────
const UploadIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>);
const WaIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.2 1.87.12.57-.09 1.76-.72 2-1.4.25-.7.25-1.28.17-1.4-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.5 9.5 0 0 1-4.84-1.33l-.35-.2-3.6.94.96-3.5-.23-.36a9.46 9.46 0 0 1-1.45-5.05c0-5.24 4.27-9.5 9.52-9.5 2.54 0 4.93.99 6.73 2.79a9.44 9.44 0 0 1 2.78 6.72c0 5.24-4.27 9.5-9.52 9.5zm8.1-17.6A11.36 11.36 0 0 0 12.04.5C5.75.5.63 5.62.63 11.9c0 2 .52 3.96 1.52 5.68L.5 23.5l6.06-1.59a11.34 11.34 0 0 0 5.48 1.4h.01c6.28 0 11.4-5.12 11.4-11.4 0-3.05-1.19-5.91-3.34-8.06z" /></svg>);
const NoteIcon = ({ filled }: { filled: boolean }) => filled
  ? (<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" /><path d="M8 8h6M8 12h8M8 16h5" stroke="var(--ad-surface)" strokeWidth="1.5" strokeLinecap="round" /></svg>)
  : (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>);
const DownloadIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>);
const PlusIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);

// ── Scoped styles ────────────────────────────────────────────────────────────
function GuestListStyles() {
  return (
    <style>{`
    .gl-tabs { display: inline-flex; gap: 0.25rem; padding: 0.25rem; background: var(--ad-raised); border: 1px solid var(--ad-border); border-radius: 999px; margin-bottom: 1.1rem; }
    .gl-tab { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.15rem; border-radius: 999px; font-size: 0.9rem; font-weight: 600; color: var(--ad-muted); background: transparent; border: none; cursor: pointer; transition: all 0.15s ease; }
    .gl-tab:hover { color: var(--ad-ink); }
    .gl-tab.is-active { background: var(--ad-surface); color: var(--ad-ink); box-shadow: var(--ad-shadow); }
    .gl-tab__count { font-size: 0.74rem; padding: 0.1rem 0.45rem; border-radius: 999px; background: var(--ad-accent-soft); color: var(--ad-accent-strong); font-variant-numeric: tabular-nums; }

    .gl-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
    .gl-stats { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--ad-body); font-size: 0.9rem; }
    .gl-stats strong { color: var(--ad-ink); }
    .gl-dot { color: var(--ad-border-strong); }
    .gl-over-badge { color: var(--ad-bad); font-weight: 600; font-size: 0.82rem; }
    .gl-actions { display: inline-flex; gap: 0.5rem; flex-wrap: wrap; }

    .gl-tablecard { padding: 0; overflow: hidden; }
    .gl-scroll { overflow-x: auto; }
    .gl-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .gl-table thead th { text-align: left; font-size: 0.72rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ad-muted); font-weight: 600; padding: 0.7rem 0.7rem; border-bottom: 1px solid var(--ad-border-strong); white-space: nowrap; background: var(--ad-raised); position: sticky; top: 0; z-index: 1; }
    .gl-table td { padding: 0.15rem 0.4rem; border-bottom: 1px solid var(--ad-border); vertical-align: middle; }
    .gl-c-center { text-align: center; }
    .gl-row--band td { background: color-mix(in srgb, var(--ad-raised) 45%, transparent); }
    .gl-row--groupstart td { border-top: 2px solid var(--ad-border-strong); }
    .gl-c-group { background: color-mix(in srgb, var(--ad-accent-soft) 55%, transparent) !important; vertical-align: middle; }
    .gl-c-gid { font-family: var(--ad-font-serif); font-weight: 600; color: var(--ad-accent-strong); text-align: center; letter-spacing: 0.02em; white-space: nowrap; }
    .gl-row--over td:not(.gl-c-group) { background: var(--ad-bad-soft) !important; }
    .gl-row--over .gl-cell--strong { color: var(--ad-bad); }

    .gl-cell { display: inline-block; width: 100%; text-align: left; background: transparent; border: 1px solid transparent; border-radius: 6px; padding: 0.4rem 0.5rem; cursor: text; color: var(--ad-ink); font: inherit; transition: background 0.12s, border-color 0.12s; min-height: 30px; white-space: nowrap; }
    .gl-cell:hover { background: var(--ad-surface); border-color: var(--ad-border-strong); }
    .gl-cell--strong { font-weight: 600; }
    .gl-cell--cap { text-transform: capitalize; }
    .gl-cell--empty { color: var(--ad-muted); }
    .gl-edit-input { width: 100%; min-width: 90px; padding: 0.38rem 0.5rem; border: 1.5px solid var(--ad-accent); border-radius: 6px; font: inherit; color: var(--ad-ink); background: var(--ad-surface); outline: none; }
    .gl-edit-select { cursor: pointer; }

    .gl-rsvp { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.28rem 0.55rem; border-radius: 999px; border: 1px solid transparent; background: transparent; cursor: pointer; font: inherit; font-size: 0.8rem; white-space: nowrap; }
    .gl-rsvp:hover { border-color: var(--ad-border-strong); }
    .gl-rsvp__dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; }
    .gl-rsvp--ok { color: var(--ad-ok); } .gl-rsvp--ok .gl-rsvp__dot { background: var(--ad-ok); }
    .gl-rsvp--bad { color: var(--ad-bad); } .gl-rsvp--bad .gl-rsvp__dot { background: var(--ad-bad); }
    .gl-rsvp--muted { color: var(--ad-muted); } .gl-rsvp--muted .gl-rsvp__dot { background: var(--ad-border-strong); }
    .gl-rsvp__auto { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; margin-left: 0.1rem; }

    .gl-seats { display: inline-flex; align-items: center; gap: 0.15rem; border: 1px solid var(--ad-border); border-radius: 8px; padding: 0.1rem; background: var(--ad-surface); }
    .gl-seats--over { border-color: var(--ad-bad); }
    .gl-seats__btn { width: 22px; height: 22px; border: none; background: transparent; border-radius: 5px; cursor: pointer; color: var(--ad-body); font-size: 1rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; }
    .gl-seats__btn:hover:not(:disabled) { background: var(--ad-accent-soft); color: var(--ad-accent-strong); }
    .gl-seats__btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .gl-seats__val { min-width: 20px; text-align: center; font-weight: 700; color: var(--ad-ink); }

    .gl-c-actions { text-align: right; white-space: nowrap; }
    .gl-act { border: none; background: transparent; color: var(--ad-muted); cursor: pointer; padding: 0.35rem; border-radius: 6px; display: inline-flex; vertical-align: middle; }
    .gl-act--wa { color: #25a866; }
    .gl-act--wa:hover { background: rgba(37,168,102,0.12); color: #1c8f54; }
    .gl-note-btn:hover { color: var(--ad-accent-strong); background: var(--ad-accent-soft); }
    .gl-note-btn.has-note { color: var(--ad-accent-strong); }
    .gl-del:hover { color: var(--ad-bad); background: var(--ad-bad-soft); }
    .gl-seatlbl { font-size: 0.82rem; color: var(--ad-ink); }
    .gl-seatlbl--empty { color: var(--ad-muted); }
    .gl-sent { display: inline-flex; align-items: center; gap: 0.22rem; padding: 0.14rem 0.5rem; border-radius: 999px; background: rgba(37,168,102,0.12); color: #1c8f54; font-size: 0.8rem; font-weight: 700; }
    .gl-sent-none { color: var(--ad-muted); }
    .gl-track { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--ad-border-strong); background: var(--ad-surface); color: var(--ad-muted); cursor: pointer; transition: all 0.14s ease; }
    .gl-track:hover { border-color: var(--ad-ok); }
    .gl-track.is-on { background: var(--ad-ok, #1c8f54); border-color: var(--ad-ok, #1c8f54); color: #fff; }
    .gl-track-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ad-border-strong); }
    .gl-menu-scrim { position: fixed; inset: 0; z-index: 85; }
    .gl-menu { position: fixed; z-index: 86; min-width: 220px; background: var(--ad-surface); border: 1px solid var(--ad-border); border-radius: 10px; box-shadow: var(--ad-shadow); padding: 0.3rem; overflow: hidden; }
    .gl-menu-head { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ad-muted); padding: 0.4rem 0.6rem 0.3rem; }
    .gl-menu-item { display: flex; align-items: center; gap: 0.55rem; width: 100%; text-align: left; padding: 0.55rem 0.6rem; background: transparent; border: none; border-radius: 7px; cursor: pointer; font: inherit; font-size: 0.88rem; color: var(--ad-ink); }
    .gl-menu-item:hover { background: var(--ad-accent-soft); }
    .gl-menu-ic { display: inline-flex; width: 18px; height: 18px; align-items: center; justify-content: center; border-radius: 50%; background: var(--ad-bad-soft); color: var(--ad-bad); font-size: 0.7rem; }
    .gl-menu-ic--ok { background: rgba(37,168,102,0.14); color: #1c8f54; }
    .gl-danger { color: var(--ad-bad); }
    .gl-modal--alert { width: min(94vw, 430px); }
    .gl-alert-icon { width: 52px; height: 52px; border-radius: 50%; background: var(--ad-bad-soft); color: var(--ad-bad); display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 0.7rem; }
    .gl-note-area { width: 100%; margin-top: 0.9rem; resize: vertical; font: inherit; line-height: 1.5; }
    .gl-gear { margin-inline-start: auto; align-self: flex-start; }
    .gl-settings-tabs { display: flex; gap: 0.75rem; border-bottom: 1px solid var(--ad-border); }
    .gl-settings-tab { padding: 0.4rem 0.15rem; font-size: 0.92rem; font-weight: 600; color: var(--ad-ink); border-bottom: 2px solid var(--ad-accent-strong); }
    .gl-circle-list { display: flex; flex-direction: column; gap: 0.45rem; margin: 0.9rem 0; max-height: 46vh; overflow-y: auto; }
    .gl-circle-row { display: flex; align-items: center; gap: 0.5rem; }
    .gl-circle-row .ad-input { flex: 1; }
    .gl-circle-add { display: flex; gap: 0.5rem; margin-top: 0.2rem; }
    .gl-circle-add .ad-input { flex: 1; }

    .gl-modal-scrim { position: fixed; inset: 0; z-index: 80; background: rgba(20,18,15,0.44); display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .gl-modal { background: var(--ad-surface); border: 1px solid var(--ad-border); border-radius: var(--ad-r-card); box-shadow: var(--ad-shadow); padding: 1.4rem; width: min(94vw, 440px); }
    .gl-modal__actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.3rem; }
    .gl-form { display: flex; flex-direction: column; gap: 0.8rem; margin-top: 1rem; }
    .gl-form-row { display: flex; gap: 0.7rem; }
    .gl-field { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; }
    .gl-field span { font-size: 0.78rem; font-weight: 600; color: var(--ad-body); }
    .gl-field--sm { max-width: 90px; }
    .gl-hint { font-size: 0.76rem; color: var(--ad-muted); margin: 0; }
    .gl-code { display: inline-block; margin-top: 1rem; padding: 0.55rem 0.9rem; background: var(--ad-ink); color: #fff; border-radius: 8px; font-family: var(--ad-font-mono, monospace); font-size: 0.85rem; }

    .gl-toast { position: fixed; left: 50%; bottom: 1.25rem; transform: translateX(-50%); z-index: 90; box-shadow: var(--ad-shadow); max-width: min(92vw, 460px); }

    @media (max-width: 720px) {
      .gl-table { font-size: 0.82rem; }
      .gl-cell { white-space: normal; }
    }

    /* ── Mobile: group cards instead of the wide table ── */
    .gl-cards { display: flex; flex-direction: column; gap: 0.85rem; }
    .gl-mcard { background: var(--ad-surface); border: 1px solid var(--ad-border); border-radius: var(--ad-r-card); box-shadow: var(--ad-shadow); overflow: hidden; }
    .gl-mcard__head { display: flex; align-items: center; gap: 0.5rem; padding: 0.55rem 0.7rem; background: color-mix(in srgb, var(--ad-accent-soft) 55%, transparent); border-bottom: 1px solid var(--ad-border); flex-wrap: wrap; }
    .gl-mcard__gid { font-family: var(--ad-font-serif); font-weight: 700; color: var(--ad-accent-strong); font-size: 1.05rem; letter-spacing: 0.02em; }
    .gl-mcard__head .gl-cell--cap { padding: 0.2rem 0.4rem; font-size: 0.85rem; }
    .gl-mcard__spacer { flex: 1; }
    .gl-mcard__lbl { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ad-muted); }
    .gl-mcard__body { display: flex; flex-direction: column; }
    .gl-mguest { display: flex; align-items: flex-start; gap: 0.35rem; padding: 0.5rem 0.55rem 0.5rem 0.7rem; border-bottom: 1px solid var(--ad-border); }
    .gl-mguest:last-child { border-bottom: none; }
    .gl-mguest.is-over { background: var(--ad-bad-soft); }
    .gl-mguest.is-over .gl-cell--strong { color: var(--ad-bad); }
    .gl-mguest__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
    .gl-mguest__info .gl-cell { padding: 0.28rem 0.4rem; white-space: normal; min-height: 34px; }
    .gl-mguest__line { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
    .gl-mguest__meta { margin-top: 0.05rem; padding-inline-start: 0.4rem; }
    .gl-mguest__seat { font-size: 0.74rem; color: var(--ad-body); background: var(--ad-raised); border: 1px solid var(--ad-border); border-radius: 6px; padding: 0.12rem 0.4rem; }
    .gl-mguest__acts { display: flex; flex-direction: column; gap: 0.2rem; flex: 0 0 auto; }
    .gl-mguest__acts .gl-act { width: 36px; height: 36px; border: 1px solid var(--ad-border); }
    @media (max-width: 720px) {
      .gl-toolbar { gap: 0.6rem; }
      .gl-actions { width: 100%; }
      .gl-actions .ad-btn { flex: 1; justify-content: center; }
    }
    `}</style>
  );
}
