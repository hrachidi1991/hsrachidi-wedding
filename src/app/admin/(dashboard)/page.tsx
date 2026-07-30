'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { guestRsvpStatus } from '@/lib/rsvpStatus';

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
  const responded = groups.filter((g) => g.rsvpResponse);
  // Per-GUEST counts (not per-group), matching the Guest List.
  const allGuests = groups.flatMap((g) => (g.guests || []).map((gu: any) => ({ gu, g })));
  const statusOf = (x: { gu: any; g: GroupData }) => guestRsvpStatus(x.gu, x.g);
  const totalGuests = allGuests.length;
  const comingCount = allGuests.filter((x) => statusOf(x) === 'Coming').length;
  const notComingCount = allGuests.filter((x) => statusOf(x) === 'Not coming').length;
  const pendingCount = allGuests.filter((x) => statusOf(x) === 'Pending').length;
  const brideG = allGuests.filter((x) => x.g.side === 'bride');
  const groomG = allGuests.filter((x) => x.g.side === 'groom');
  const brideComing = brideG.filter((x) => statusOf(x) === 'Coming').length;
  const groomComing = groomG.filter((x) => statusOf(x) === 'Coming').length;
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

      <style>{`.ad-stat--link{cursor:pointer;transition:transform .12s ease, box-shadow .12s ease;text-decoration:none;}
        .ad-stat--link:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,0.09);}`}</style>

      {/* Guests by RSVP status (per guest) — click any card to open the filtered list */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-5">
        <StatCard label="Total Guests" value={totalGuests} href="/admin/guest-list" />
        <StatCard label="Attending" value={comingCount} tone="ok" href="/admin/guest-list?status=coming" />
        <StatCard label="Not Coming" value={notComingCount} numTone="bad" href="/admin/guest-list?status=notcoming" />
        <StatCard label="Pending" value={pendingCount} numTone="warn" href="/admin/guest-list?status=pending" />
      </div>

      {/* Attending, by side (per guest) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5">
        <StatCard label="Bride — Attending" value={brideComing} sub={`/ ${brideG.length} guests`} tone="accent" href="/admin/guest-list?side=bride&status=coming" />
        <StatCard label="Groom — Attending" value={groomComing} sub={`/ ${groomG.length} guests`} tone="accent" href="/admin/guest-list?side=groom&status=coming" />
      </div>

      {/* Invites sent vs not sent (per group) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard label="Invites Sent" value={linksSent} sub={`/ ${totalGroups} groups`} href="/admin/guest-list?sent=sent" />
        <StatCard label="Not Sent Yet" value={linksNotSent} sub="groups" numTone={linksNotSent > 0 ? 'warn' : 'muted'} href="/admin/guest-list?sent=notsent" />
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
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'accent' | 'ok';
  numTone?: 'ok' | 'bad' | 'warn' | 'muted';
  href?: string;
}) {
  const cardTone = tone === 'accent' ? 'ad-stat--accent' : tone === 'ok' ? 'ad-stat--ok' : '';
  const valueClass = numTone ? numToneClass[numTone] : '';
  const mutedNum = numTone === 'muted';
  const inner = (
    <>
      <span className="ad-stat__label">{label}</span>
      <span
        className={`ad-stat__value ${valueClass}`}
        style={mutedNum ? { color: 'var(--ad-muted)' } : undefined}
      >
        {value}
        {sub && <span className="ad-stat__sub">{sub}</span>}
      </span>
    </>
  );
  if (href) {
    return <Link href={href} className={`ad-stat ${cardTone} ad-stat--link`}>{inner}</Link>;
  }
  return <div className={`ad-stat ${cardTone}`}>{inner}</div>;
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
