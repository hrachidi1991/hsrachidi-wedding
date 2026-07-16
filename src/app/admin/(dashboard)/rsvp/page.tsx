'use client';

import { useEffect, useState } from 'react';

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
  guests: { name: string; phone: string | null }[];
  rsvpResponse: {
    attending: boolean;
    numberAttending: number;
    guestNames: any;
    language: string;
    updatedAt: string;
  } | null;
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

  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setGroups(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = groups.filter((g) => {
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
          <p className="ad-page-desc">Filter, search and export every reply from your guests.</p>
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
          <span className="ad-stat__label">Total Groups</span>
          <span className="ad-stat__value">{groups.length}</span>
        </div>
        <div className="ad-stat ad-stat--ok">
          <span className="ad-stat__label">Total Attending</span>
          <span className="ad-stat__value">{totalAttending}</span>
        </div>
        <div className="ad-stat">
          <span className="ad-stat__label">Not Attending</span>
          <span className="ad-stat__value" style={{ color: 'var(--ad-bad)' }}>{groups.filter((g) => g.rsvpResponse && !g.rsvpResponse.attending).length}</span>
        </div>
        <div className="ad-stat">
          <span className="ad-stat__label">No Response</span>
          <span className="ad-stat__value" style={{ color: 'var(--ad-muted)' }}>{groups.filter((g) => !g.rsvpResponse).length}</span>
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

      {/* Table */}
      <div className="ad-card ad-card--flush">
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
                <tr key={g.id}>
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
            <p className="ad-empty">No results found.</p>
          )}
        </div>
        <div style={{ padding: '0.85rem 1.25rem', fontSize: '0.78rem', color: 'var(--ad-muted)', borderTop: '1px solid var(--ad-border)' }}>
          Showing {filtered.length} of {groups.length} groups
        </div>
      </div>
    </div>
  );
}
