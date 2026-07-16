import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import prisma from '@/lib/db';
import { SEAT_BY_CODE } from '@/lib/seatLayout';

export const dynamic = 'force-dynamic';

// Prisma throws these when the `Seat` table/columns have not been migrated yet.
function isMissingTable(e: any): boolean {
  return e?.code === 'P2021' || e?.code === 'P2022';
}

const MISSING_TABLE_BODY = {
  error: 'Seating storage not initialized yet.',
  code: 'SEAT_TABLE_MISSING',
};

// GET — current assignments + every guest (with their seat, if any)
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const [guests, seats] = await Promise.all([
      prisma.guest.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, side: true, groupCode: true },
      }),
      prisma.seat.findMany({
        where: { guestId: { not: null } },
        select: {
          code: true,
          guest: { select: { id: true, name: true, side: true, groupCode: true } },
        },
      }),
    ]);

    const seatByGuestId = new Map<string, string>();
    const assignments: { code: string; guest: { id: string; name: string; side: string; groupCode: string } }[] = [];
    for (const s of seats) {
      if (s.guest) {
        seatByGuestId.set(s.guest.id, s.code);
        assignments.push({ code: s.code, guest: s.guest });
      }
    }

    const guestsOut = guests.map((g) => ({
      id: g.id,
      name: g.name,
      side: g.side,
      groupCode: g.groupCode,
      seatCode: seatByGuestId.get(g.id) ?? null,
    }));

    return NextResponse.json({ assignments, guests: guestsOut });
  } catch (e: any) {
    if (isMissingTable(e)) {
      return NextResponse.json(MISSING_TABLE_BODY, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to load seating data.' }, { status: 500 });
  }
}

// POST — assign a guest to a seat (moving them off any previous seat)
export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { code, guestId } = await request.json();

    if (typeof code !== 'string' || !SEAT_BY_CODE[code]) {
      return NextResponse.json({ error: `Unknown seat code "${code}".` }, { status: 400 });
    }
    if (typeof guestId !== 'string' || !guestId) {
      return NextResponse.json({ error: 'A guestId is required.' }, { status: 400 });
    }

    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      select: { id: true, name: true, side: true, groupCode: true },
    });
    if (!guest) {
      return NextResponse.json({ error: 'That guest no longer exists.' }, { status: 404 });
    }

    // guestId is unique on Seat — free the guest's current seat first so the
    // assignment acts as a move, then place them on the target chair.
    await prisma.seat.deleteMany({ where: { guestId, code: { not: code } } });
    const seat = await prisma.seat.upsert({
      where: { code },
      create: { code, guestId },
      update: { guestId },
    });

    return NextResponse.json({ assignment: { code: seat.code, guest } });
  } catch (e: any) {
    if (isMissingTable(e)) {
      return NextResponse.json(MISSING_TABLE_BODY, { status: 503 });
    }
    return NextResponse.json({ error: e?.message || 'Failed to assign seat.' }, { status: 500 });
  }
}

// DELETE — clear a seat
export async function DELETE(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { code } = await request.json();
    if (typeof code !== 'string' || !SEAT_BY_CODE[code]) {
      return NextResponse.json({ error: `Unknown seat code "${code}".` }, { status: 400 });
    }
    await prisma.seat.deleteMany({ where: { code } });
    return NextResponse.json({ success: true, code });
  } catch (e: any) {
    if (isMissingTable(e)) {
      return NextResponse.json(MISSING_TABLE_BODY, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to clear seat.' }, { status: 500 });
  }
}
