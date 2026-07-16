'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

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
  rsvpResponse: Rsvp | null;
  guests: Guest[];
}

const CIRCLES = ['Immediate Fam', 'Fathers', 'Mothers', 'Ghassan Guests', 'Ranas Guests', 'Friends', 'Social'];
const RSVP_OPTIONS = ['Pending', 'Coming', 'Not coming'];

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
        RSVP: gu.rsvpManual || autoRsvp(g), Notes: gu.notes || '',
      }))
    );
    const ws = XLSX.utils.json_to_sheet(rows, { header: ['Name', 'Phone', 'Side', 'Circle', 'Seats', 'Group ID', 'RSVP', 'Notes'] });
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
          ) : (
            <div className="ad-card gl-tablecard">
              <div className="gl-scroll">
                <table className="gl-table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Phone</th><th>Side</th><th>Circle</th>
                      <th className="gl-c-center">Seats</th><th>Group ID</th><th>RSVP</th><th>Notes</th><th aria-label="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {sideGroups.map((g, gi) => (
                      g.guests.map((gu, i) => {
                        const over = i >= g.maxGuests;
                        const rowCls = `gl-row${i === 0 ? ' gl-row--groupstart' : ''}${gi % 2 ? ' gl-row--band' : ''}${over ? ' gl-row--over' : ''}`;
                        return (
                          <tr key={gu.id} className={rowCls}>
                            <td><EditText value={gu.name} onSave={(v) => saveGuest(gu.id, 'name', v)} placeholder="Name" strong /></td>
                            <td><EditText value={gu.phone || ''} onSave={(v) => saveGuest(gu.id, 'phone', v)} placeholder="—" mono /></td>
                            {i === 0 && (
                              <td rowSpan={g.guests.length} className="gl-c-group">
                                <EditSelect value={g.side} options={['bride', 'groom']} onSave={(v) => setSide(g, v)} cap />
                              </td>
                            )}
                            <td><EditSelect value={gu.circle || ''} options={CIRCLES} onSave={(v) => saveGuest(gu.id, 'circle', v)} placeholder="—" allowBlank /></td>
                            {i === 0 && (
                              <td rowSpan={g.guests.length} className="gl-c-group gl-c-center">
                                <SeatsStepper seats={g.maxGuests} count={g.guests.length} onChange={(s) => setSeats(g, s)} />
                              </td>
                            )}
                            {i === 0 && (
                              <td rowSpan={g.guests.length} className="gl-c-group gl-c-gid">{g.groupCode}</td>
                            )}
                            <td><RsvpCell guest={gu} auto={autoRsvp(g)} onSave={(v) => saveGuest(gu.id, 'rsvpManual', v)} /></td>
                            <td><EditText value={gu.notes || ''} onSave={(v) => saveGuest(gu.id, 'notes', v)} placeholder="—" /></td>
                            <td className="gl-c-actions">
                              <button className="gl-del" onClick={() => deleteGuest(gu)} aria-label={`Remove ${gu.name}`} title="Remove">
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
function AddGuestModal({ defaultGroup, side, busy, onClose, onSave }: {
  defaultGroup: string; side: string; busy: boolean; onClose: () => void; onSave: (p: any) => void;
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
              {CIRCLES.map((c) => <option key={c} value={c}>{c}</option>)}
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

    .gl-c-actions { text-align: center; }
    .gl-del { border: none; background: transparent; color: var(--ad-muted); cursor: pointer; padding: 0.35rem; border-radius: 6px; display: inline-flex; }
    .gl-del:hover { color: var(--ad-bad); background: var(--ad-bad-soft); }

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
    `}</style>
  );
}
