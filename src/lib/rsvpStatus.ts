// Effective RSVP status for a single guest — shared by the Guest List and the
// Dashboard so both count/filter identically. Manual override wins; otherwise the
// guest's own answer from the online submission (per-guest guestNames); otherwise
// the group-level attending flag; otherwise Pending.
export type RsvpStatus = 'Coming' | 'Not coming' | 'Pending';

interface GuestLike { name: string; rsvpManual?: string | null }
interface GroupLike { rsvpResponse?: { attending: boolean; guestNames?: any } | null }

const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export function guestRsvpStatus(guest: GuestLike, group: GroupLike): RsvpStatus {
  const m = (guest.rsvpManual || '').trim();
  if (m === 'Coming' || m === 'Not coming' || m === 'Pending') return m;
  const resp = group.rsvpResponse;
  if (!resp) return 'Pending';
  const gn = resp.guestNames;
  if (Array.isArray(gn) && gn.length && typeof gn[0] === 'object' && gn[0] !== null && 'name' in gn[0]) {
    const hit = (gn as { name?: string; attending?: boolean }[]).find((x) => norm(x.name || '') === norm(guest.name));
    if (hit) return hit.attending ? 'Coming' : 'Not coming';
  }
  return resp.attending ? 'Coming' : 'Not coming';
}
