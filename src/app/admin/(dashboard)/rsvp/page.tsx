'use client';

import { useEffect, useState } from 'react';
import { useIsMobile } from '@/lib/useIsMobile';

interface GuestAttendance {
  name: string;
  attending: boolean;
}

interface GroupWithRsvp {
  id: string;
  groupCode: string;
  maxGuests: number;
  side: string;
  token: string;
  inRsvp: boolean;
  guests: { name: string; phone: string | null; rsvpManual?: string | null }[];
  rsvpResponse: {
    attending: boolean;
    numberAttending: number;
    guestNames: any;
    language: string;
    updatedAt: string;
  } | null;
}

// Per-guest attendance: prefer the online RSVP submission, then the manual override,
// then the group-level response. Returns true/false/'pending'/null(no response).
function guestStatus(group: GroupWithRsvp, name: string): boolean | 'pending' | null {
  const gn = group.rsvpResponse?.guestNames;
  if (Array.isArray(gn) && gn.length && typeof gn[0] === 'object' && gn[0] !== null && 'name' in gn[0]) {
    const hit = (gn as GuestAttendance[]).find((x) => x.name?.toLowerCase() === name.toLowerCase());
    if (hit) return hit.attending;
  }
  const g = group.guests.find((x) => x.name === name);
  if (g?.rsvpManual === 'Coming') return true;
  if (g?.rsvpManual === 'Not coming') return false;
  if (g?.rsvpManual === 'Pending') return 'pending';
  if (group.rsvpResponse) return group.rsvpResponse.attending;
  return null;
}

function renderGuestNames(guestNames: any): React.ReactNode {
  if (!Array.isArray(guestNames) || guestNames.length === 0) return '-';
  // New format: objects with { name, attending }
  if (typeof guestNames[0] === 'object' && guestNames[0] !== null && 'name' in guestNames[0]) {
    return (
      <div className="space-y-0.5">
        {(guestNames as GuestAttendance[]).map((g, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`ad-dot ${g.attending ? 'ad-dot--ok' : 'ad-dot--bad'}`} />
            <span>{g.name}</span>
          </div>
        ))}
      </div>
    );
  }
  // Legacy format: string[]
  return (guestNames as string[]).filter(Boolean).join(', ') || '-';
}

function getSearchableNames(guestNames: any): string {
  if (!Array.isArray(guestNames)) return '';
  if (typeof guestNames[0] === 'object' && guestNames[0] !== null && 'name' in guestNames[0]) {
    return (guestNames as GuestAttendance[]).map((g) => g.name).join(' ').toLowerCase();
  }
  return (guestNames as string[]).join(' ').toLowerCase();
}

export default function RsvpTracking() {
  const [groups, setGroups] = useState<GroupWithRsvp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'attending' | 'not_attending' | 'no_response'>('all');
  const [sideFilter, setSideFilter] = useState<'all' | 'bride' | 'groom'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GroupWithRsvp | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // The couple's "update link" re-enables editing for a group that already responded.
  const copyUpdateLink = (g: GroupWithRsvp) => {
    const url = `${window.location.origin}/?g=${g.groupCode}&edit=${g.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(g.id);
      setTimeout(() => setCopiedLink(null), 2500);
    }).catch(() => {});
  };

  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setGroups(data);
      })
      .finally(() => setLoading(false));
  }, []);

  // Only groups that are in RSVP tracking (invite sent, or added manually) appear here.
  const tracked = groups.filter((g) => g.inRsvp);
  const filtered = tracked.filter((g) => {
    // Status filter
    if (filter === 'attending' && (!g.rsvpResponse || !g.rsvpResponse.attending)) return false;
    if (filter === 'not_attending' && (!g.rsvpResponse || g.rsvpResponse.attending)) return false;
    if (filter === 'no_response' && g.rsvpResponse) return false;

    // Side filter
    if (sideFilter !== 'all' && g.side !== sideFilter) return false;

    // Search
    if (search) {
      const s = search.toLowerCase();
      const match =
        g.groupCode.toLowerCase().includes(s) ||
        g.guests?.some((guest) => guest.name.toLowerCase().includes(s) || guest.phone?.includes(s)) ||
        (g.rsvpResponse?.guestNames ? getSearchableNames(g.rsvpResponse.guestNames).includes(s) : false);
      if (!match) return false;
    }

    return true;
  });

  const exportCsv = () => {
    window.open('/api/export', '_blank');
  };

  if (loading) {
    return (
      <div>
        <div className="ad-skel" style={{ height: 34, width: 220, marginBottom: 24 }} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="ad-stat">
              <div className="ad-skel" style={{ height: 12, width: '55%' }} />
              <div className="ad-skel" style={{ height: 30, width: '40%', marginTop: 10 }} />
            </div>
          ))}
        </div>
        <div className="ad-card">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ad-skel" style={{ height: 16, width: '100%', marginBottom: 12 }} />
          ))}
        </div>
      </div>
    );
  }

  const totalAttending = filtered
    .filter((g) => g.rsvpResponse?.attending)
    .reduce((s, g) => s + (g.rsvpResponse?.numberAttending || 0), 0);

  return (
    <div>
      <header className="ad-header">
        <div>
          <div className="ad-eyebrow" style={{ marginBottom: '0.4rem' }}>Responses</div>
          <h1 className="ad-title">RSVP Tracking</h1>
          <p className="ad-page-desc">Only groups you&rsquo;ve invited appear here. Click a group to see who&rsquo;s inside.</p>
        </div>
        <div className="ad-header__actions">
          <button onClick={exportCsv} className="ad-btn ad-btn--accent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        </div>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <div className="ad-stat">
          <span className="ad-stat__label">Invited Groups</span>
          <span className="ad-stat__value">{tracked.length}</span>
        </div>
        <div className="ad-stat ad-stat--ok">
          <span className="ad-stat__label">Total Attending</span>
          <span className="ad-stat__value">{totalAttending}</span>
        </div>
        <div className="ad-stat">
          <span className="ad-stat__label">Not Attending</span>
          <span className="ad-stat__value" style={{ color: 'var(--ad-bad)' }}>{tracked.filter((g) => g.rsvpResponse && !g.rsvpResponse.attending).length}</span>
        </div>
        <div className="ad-stat">
          <span className="ad-stat__label">No Response</span>
          <span className="ad-stat__value" style={{ color: 'var(--ad-muted)' }}>{tracked.filter((g) => !g.rsvpResponse).length}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="ad-search" style={{ flex: '1 1 220px', minWidth: 0 }}>
          <span className="ad-search__icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, group..."
            className="ad-input ad-input--search"
            aria-label="Search RSVPs"
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="ad-select" aria-label="Filter by status" style={{ width: 'auto', flex: '0 0 auto' }}>
          <option value="all">All Statuses</option>
          <option value="attending">Attending</option>
          <option value="not_attending">Not Attending</option>
          <option value="no_response">No Response</option>
        </select>
        <select value={sideFilter} onChange={(e) => setSideFilter(e.target.value as any)} className="ad-select" aria-label="Filter by side" style={{ width: 'auto', flex: '0 0 auto' }}>
          <option value="all">Both Sides</option>
          <option value="bride">Bride</option>
          <option value="groom">Groom</option>
        </select>
      </div>

      {/* Table (desktop) / cards (mobile) */}
      <div className="ad-card ad-card--flush">
        {isMobile ? (
          <div className="rsvp-cards">
            {filtered.map((g) => {
              const att = g.rsvpResponse;
              const label = att ? (att.attending ? 'Attending' : 'Not Attending') : 'No Response';
              const tone = att ? (att.attending ? 'ok' : 'bad') : 'neutral';
              return (
                <button key={g.id} className="rsvp-mcard" onClick={() => setSelected(g)}>
                  <div className="rsvp-mcard__top">
                    <span className="rsvp-mcard__code">{g.groupCode}</span>
                    <span className="ad-cap rsvp-mcard__side">{g.side}</span>
                    <span className={`ad-pill ad-pill--${tone}`}>{label}</span>
                    <span className="rsvp-mcard__chev" aria-hidden="true">›</span>
                  </div>
                  <div className="rsvp-mcard__meta">
                    <span>{g.guests?.length || 0} guest{(g.guests?.length || 0) === 1 ? '' : 's'}</span>
                    {att && <span>&middot; {att.numberAttending} attending</span>}
                    {att?.updatedAt && <span>&middot; {new Date(att.updatedAt).toLocaleDateString()}</span>}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="ad-empty">{tracked.length === 0 ? 'No invited groups yet. Send a group’s invite link (or add one from Guest List) and it will appear here.' : 'No results match your filters.'}</p>
            )}
          </div>
        ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Group Code</th>
                <th>Side</th>
                <th>Max</th>
                <th>Status</th>
                <th># Att.</th>
                <th>Guest Names (RSVP)</th>
                <th>Registered Guests</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} onClick={() => setSelected(g)} style={{ cursor: 'pointer' }}>
                  <td className="ad-cell-strong">{g.groupCode}</td>
                  <td className="ad-cap">{g.side}</td>
                  <td>{g.maxGuests}</td>
                  <td>
                    {g.rsvpResponse ? (
                      <span className={`ad-pill ${g.rsvpResponse.attending ? 'ad-pill--ok' : 'ad-pill--bad'}`}>
                        {g.rsvpResponse.attending ? 'Attending' : 'Not Attending'}
                      </span>
                    ) : (
                      <span className="ad-pill ad-pill--neutral">No Response</span>
                    )}
                  </td>
                  <td>{g.rsvpResponse?.numberAttending || '-'}</td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {g.rsvpResponse?.guestNames ? renderGuestNames(g.rsvpResponse.guestNames) : '-'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--ad-muted)' }}>
                    {g.guests?.map((guest) => guest.name).join(', ') || '-'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--ad-muted)' }}>
                    {g.rsvpResponse?.updatedAt
                      ? new Date(g.rsvpResponse.updatedAt).toLocaleDateString()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="ad-empty">
              {tracked.length === 0
                ? 'No invited groups yet. Send a group’s invite link (or right-click a group in Guest List → "Add to RSVP tracking") and it will appear here.'
                : 'No results match your filters.'}
            </p>
          )}
        </div>
        )}
        <div style={{ padding: '0.85rem 1.25rem', fontSize: '0.78rem', color: 'var(--ad-muted)', borderTop: '1px solid var(--ad-border)' }}>
          Showing {filtered.length} of {tracked.length} invited groups
        </div>
      </div>

      <style>{`
        .rsvp-cards { display: flex; flex-direction: column; }
        .rsvp-mcard { display: flex; flex-direction: column; gap: 0.35rem; width: 100%; text-align: left; padding: 0.8rem 0.9rem; background: transparent; border: none; border-bottom: 1px solid var(--ad-border); cursor: pointer; font: inherit; }
        .rsvp-mcard:last-child { border-bottom: none; }
        .rsvp-mcard:active { background: var(--ad-raised); }
        .rsvp-mcard__top { display: flex; align-items: center; gap: 0.5rem; }
        .rsvp-mcard__code { font-family: var(--ad-font-serif); font-weight: 700; color: var(--ad-ink); font-size: 1.05rem; }
        .rsvp-mcard__side { font-size: 0.8rem; color: var(--ad-muted); }
        .rsvp-mcard__chev { margin-inline-start: auto; color: var(--ad-muted); font-size: 1.3rem; line-height: 1; }
        .rsvp-mcard__meta { display: flex; flex-wrap: wrap; gap: 0.3rem; font-size: 0.78rem; color: var(--ad-muted); }
      `}</style>

      {/* Group guests popup */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,15,0.44)', display: 'grid', placeItems: 'center', zIndex: 80, padding: '1rem' }}
        >
          <div className="ad-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, width: '100%', maxHeight: '82vh', overflow: 'auto' }}>
            <div className="ad-header" style={{ marginBottom: '0.9rem' }}>
              <div>
                <div className="ad-eyebrow" style={{ marginBottom: '0.3rem' }}>Group {selected.groupCode} &middot; {cap(selected.side)}</div>
                <h2 className="ad-section-title" style={{ fontSize: '1.15rem' }}>
                  {selected.rsvpResponse
                    ? (selected.rsvpResponse.attending ? `${selected.rsvpResponse.numberAttending} attending` : 'Not attending')
                    : 'No response yet'}
                </h2>
              </div>
              <button className="ad-icon-btn" onClick={() => setSelected(null)} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <button className="ad-btn ad-btn--outline" style={{ width: '100%', marginBottom: '1rem' }} onClick={() => copyUpdateLink(selected)}>
              {copiedLink === selected.id ? (
                <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> Update link copied</>
              ) : (
                <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg> Copy update link</>
              )}
            </button>
            <p style={{ fontSize: '0.74rem', color: 'var(--ad-muted)', margin: '-0.5rem 0 0.9rem' }}>
              Send this only if a guest asks to change their reply — it re-opens editing for this group.
            </p>
            {selected.guests?.length ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {selected.guests.map((guest, i) => {
                  const att = guestStatus(selected, guest.name);
                  const label = att === true ? 'Coming' : att === false ? 'Not coming' : att === 'pending' ? 'Pending' : 'No response';
                  const tone = att === true ? 'ok' : att === false ? 'bad' : 'muted';
                  return (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.7rem', background: 'var(--ad-raised)', border: '1px solid var(--ad-border)', borderRadius: 'var(--ad-r-ctrl)' }}>
                      <span className={`ad-dot ad-dot--${tone === 'muted' ? '' : tone}`} style={tone === 'muted' ? { background: 'var(--ad-border-strong)' } : undefined} />
                      <span style={{ fontWeight: 500, color: 'var(--ad-ink)' }}>{guest.name}</span>
                      <span className={`ad-pill ad-pill--${tone === 'ok' ? 'ok' : tone === 'bad' ? 'bad' : 'neutral'}`} style={{ marginInlineStart: 'auto' }}>{label}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="ad-empty">No registered guests in this group.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
