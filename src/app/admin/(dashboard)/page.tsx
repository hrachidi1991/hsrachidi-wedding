'use client';

import { useEffect, useState } from 'react';

interface GroupData {
  id: string;
  groupCode: string;
  maxGuests: number;
  side: string;
  token: string;
  guests: any[];
  rsvpResponse: {
    attending: boolean;
    numberAttending: number;
    guestNames: string[];
    updatedAt: string;
  } | null;
}

export default function AdminDashboard() {
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setGroups(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalGroups = groups.length;
  const totalMaxGuests = groups.reduce((s, g) => s + g.maxGuests, 0);
  const responded = groups.filter((g) => g.rsvpResponse);
  const attending = responded.filter((g) => g.rsvpResponse?.attending);
  const notAttending = responded.filter((g) => !g.rsvpResponse?.attending);
  const noResponse = groups.filter((g) => !g.rsvpResponse);
  const totalAttending = attending.reduce((s, g) => s + (g.rsvpResponse?.numberAttending || 0), 0);
  const brideGroups = groups.filter((g) => g.side === 'bride');
  const groomGroups = groups.filter((g) => g.side === 'groom');
  // "Sent" = the invite link was actually sent to at least one guest in the group.
  const linksSent = groups.filter((g) => (g.guests || []).some((x: any) => (x.waSentCount || 0) > 0)).length;
  const linksNotSent = totalGroups - linksSent;

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div>
      <header className="ad-header">
        <div>
          <div className="ad-eyebrow" style={{ marginBottom: '0.4rem' }}>Overview</div>
          <h1 className="ad-title">Dashboard</h1>
          <p className="ad-page-desc">A live snapshot of your guest list and RSVP responses.</p>
        </div>
      </header>

      {/* Headline stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-5">
        <StatCard label="Total Groups" value={totalGroups} />
        <StatCard label="Max Capacity" value={totalMaxGuests} />
        <StatCard label="Confirmed Attending" value={totalAttending} tone="ok" />
        <StatCard label="Response Rate" value={`${totalGroups > 0 ? Math.round((responded.length / totalGroups) * 100) : 0}%`} tone="accent" />
      </div>

      {/* Invite links sent vs not sent */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5">
        <StatCard label="Invites Sent" value={linksSent} sub={`/ ${totalGroups} groups`} tone="accent" />
        <StatCard label="Not Sent Yet" value={linksNotSent} sub="groups" numTone={linksNotSent > 0 ? 'warn' : 'muted'} />
      </div>

      {/* Response breakdown */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-5">
        <StatCard label="Attending" value={attending.length} sub="groups" numTone="ok" />
        <StatCard label="Not Attending" value={notAttending.length} sub="groups" numTone="bad" />
        <StatCard label="No Response" value={noResponse.length} sub="groups" numTone="muted" />
      </div>

      {/* Sides */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard label="Bride Side" value={brideGroups.length} sub="groups" />
        <StatCard label="Groom Side" value={groomGroups.length} sub="groups" />
      </div>

      {/* Recent RSVPs */}
      <section className="ad-card ad-card--flush">
        <div style={{ padding: '1.15rem 1.25rem 0' }}>
          <h2 className="ad-section-title">Recent RSVPs</h2>
        </div>
        {responded.length === 0 ? (
          <p className="ad-empty">No responses yet.</p>
        ) : (
          <div className="ad-table-wrap" style={{ marginTop: '0.75rem' }}>
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Side</th>
                  <th>Status</th>
                  <th># Attending</th>
                  <th>Names</th>
                </tr>
              </thead>
              <tbody>
                {responded.sort((a, b) =>
                  new Date(b.rsvpResponse!.updatedAt).getTime() - new Date(a.rsvpResponse!.updatedAt).getTime()
                ).slice(0, 10).map((g) => (
                  <tr key={g.id}>
                    <td className="ad-cell-strong">{g.groupCode}</td>
                    <td className="ad-cap">{g.side}</td>
                    <td>
                      <span className={`ad-pill ${g.rsvpResponse?.attending ? 'ad-pill--ok' : 'ad-pill--bad'}`}>
                        {g.rsvpResponse?.attending ? 'Attending' : 'Not Attending'}
                      </span>
                    </td>
                    <td>{g.rsvpResponse?.numberAttending || 0}</td>
                    <td>{(g.rsvpResponse?.guestNames as string[])?.join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const numToneClass: Record<string, string> = {
  ok: 'ad-stat--ok',
  bad: 'ad-stat--bad',
  warn: 'ad-stat--warn',
  muted: '',
};

function StatCard({
  label,
  value,
  sub,
  tone,
  numTone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'accent' | 'ok';
  numTone?: 'ok' | 'bad' | 'warn' | 'muted';
}) {
  const cardTone = tone === 'accent' ? 'ad-stat--accent' : tone === 'ok' ? 'ad-stat--ok' : '';
  const valueClass = numTone ? numToneClass[numTone] : '';
  const mutedNum = numTone === 'muted';
  return (
    <div className={`ad-stat ${cardTone}`}>
      <span className="ad-stat__label">{label}</span>
      <span
        className={`ad-stat__value ${valueClass}`}
        style={mutedNum ? { color: 'var(--ad-muted)' } : undefined}
      >
        {value}
        {sub && <span className="ad-stat__sub">{sub}</span>}
      </span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <div className="ad-skel" style={{ height: 20, width: 90, marginBottom: 12 }} />
      <div className="ad-skel" style={{ height: 34, width: 220, marginBottom: 24 }} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ad-stat">
            <div className="ad-skel" style={{ height: 12, width: '60%' }} />
            <div className="ad-skel" style={{ height: 32, width: '45%', marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="ad-stat">
            <div className="ad-skel" style={{ height: 12, width: '55%' }} />
            <div className="ad-skel" style={{ height: 32, width: '40%', marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className="ad-card">
        <div className="ad-skel" style={{ height: 22, width: 160, marginBottom: 18 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="ad-skel" style={{ height: 16, width: '100%', marginBottom: 12 }} />
        ))}
      </div>
    </div>
  );
}
