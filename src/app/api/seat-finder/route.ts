import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { SEAT_BY_CODE } from '@/lib/seatLayout';
import { guestRsvpStatus } from '@/lib/rsvpStatus';

export const dynamic = 'force-dynamic';

function isMissingTable(e: any): boolean {
  return e?.code === 'P2021' || e?.code === 'P2022';
}

// Build code -> { label, table } from the live grouping (custom seatTables), with a
// fallback to the built-in layout labels.
async function labelMaps() {
  const codeLabel: Record<string, string> = {};
  const codeTable: Record<string, string> = {};
  try {
    const settings: any = await getSettings();
    const st = (settings?.settings || settings || {})?.seatTables;
    if (Array.isArray(st)) {
      for (const t of st) {
        (t.codes || []).forEach((c: string, i: number) => {
          codeLabel[c] = `${t.name}${String(i + 1).padStart(2, '0')}`;
          codeTable[c] = t.name;
        });
      }
    }
  } catch { /* fall back to layout labels */ }
  return { codeLabel, codeTable };
}

// GET — minimal seating lookup for the seat finder (any signed-in role).
// Returns ONLY name/display/group/side/seat + present; no phone/notes/RSVP.
export async function GET(request: NextRequest) {
  // Public read: guests can look up their seat with no login (the /seats page).
  // Signed-in staff also get their role back (drives the check-in toggle).
  const role = requireRole(request, ['admin', 'hostess', 'viewer']);
  try {
    const settings: any = await getSettings();
    const tables = (settings?.settings || settings || {})?.seatTables;
    const [guests, seats, groups, maps] = await Promise.all([
      prisma.guest.findMany({ select: { id: true, name: true, displayName: true, groupCode: true, side: true, rsvpManual: true } }),
      prisma.seat.findMany({ where: { guestId: { not: null } }, select: { code: true, guestId: true, present: true } }),
      prisma.guestGroup.findMany({ select: { groupCode: true, rsvpResponse: { select: { attending: true, guestNames: true } } } }),
      labelMaps(),
    ]);
    const seatByGuest: Record<string, { code: string; present: boolean }> = {};
    for (const s of seats) if (s.guestId) seatByGuest[s.guestId] = { code: s.code, present: s.present };
    const groupByCode = new Map(groups.map((g) => [g.groupCode, g]));

    const out = guests
      .map((g) => {
        const grp = groupByCode.get(g.groupCode);
        const rsvp = guestRsvpStatus({ name: g.name, rsvpManual: g.rsvpManual }, { rsvpResponse: grp?.rsvpResponse ?? null });
        const sc = seatByGuest[g.id];
        const code = sc?.code || null;
        const tableName = code ? (maps.codeTable[code] || SEAT_BY_CODE[code]?.table || null) : null;
        return {
          id: g.id,
          name: g.name,
          displayName: g.displayName,
          groupCode: g.groupCode,
          side: g.side,
          rsvp,
          seatCode: code,
          seatLabel: code ? (maps.codeLabel[code] || SEAT_BY_CODE[code]?.zone || code) : null,
          tableName,
          tableNum: tableName ? (tableName.match(/^\d+/) || [null])[0] : null,
          present: sc?.present || false,
        };
      })
      // Hide guests who declined; keep "Coming" and not-yet-answered ("Pending").
      .filter((g) => g.rsvp !== 'Not coming');
    return NextResponse.json({ guests: out, tables: Array.isArray(tables) ? tables : [], role });
  } catch (e: any) {
    if (isMissingTable(e)) return NextResponse.json({ guests: [] });
    return NextResponse.json({ error: 'Failed to load seating data.' }, { status: 500 });
  }
}

// POST — mark a seated guest present / not present (admin or hostess only).
export async function POST(request: NextRequest) {
  if (!requireRole(request, ['admin', 'hostess'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { code, present } = await request.json();
    if (typeof code !== 'string' || !SEAT_BY_CODE[code]) {
      return NextResponse.json({ error: `Unknown seat code "${code}".` }, { status: 400 });
    }
    const res = await prisma.seat.updateMany({ where: { code }, data: { present: !!present } });
    if (res.count === 0) {
      return NextResponse.json({ error: 'That seat is empty.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, code, present: !!present });
  } catch (e: any) {
    if (isMissingTable(e)) return NextResponse.json({ error: 'Seating not initialized.' }, { status: 503 });
    return NextResponse.json({ error: e?.message || 'Failed to update.' }, { status: 500 });
  }
}
