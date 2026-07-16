import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import prisma from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Accepts an array of guests. Backward compatible with the old importer
// ({ name, phone, side, relation, groupCode, maxGuests }) and supports the new
// Guest List columns ({ circle, notes, rsvpManual } + seats via maxGuests).
export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { guests } = await request.json();
    if (!Array.isArray(guests)) {
      return NextResponse.json({ error: 'Expected guests array' }, { status: 400 });
    }

    let created = 0;
    let groupsCreated = 0;
    const existingGroupCodes: string[] = [];

    // seats/side/circle we want each group to end up with (first non-empty wins)
    const groupSeats: Record<string, number> = {};
    const groupSide: Record<string, string> = {};
    for (const g of guests) {
      if (!g.groupCode) continue;
      const seats = parseInt(g.maxGuests ?? g.seats) || 0;
      if (seats && !groupSeats[g.groupCode]) groupSeats[g.groupCode] = seats;
      if (g.side && !groupSide[g.groupCode]) groupSide[g.groupCode] = g.side;
    }

    let order = 0;
    for (const g of guests) {
      if (!g.name || !g.groupCode) continue;

      const existing = await prisma.guestGroup.findUnique({ where: { groupCode: g.groupCode } });
      if (!existing) {
        await prisma.guestGroup.create({
          data: {
            groupCode: g.groupCode,
            maxGuests: groupSeats[g.groupCode] || 2,
            side: groupSide[g.groupCode] || g.side || 'groom',
            token: uuidv4(),
          },
        });
        groupsCreated++;
      } else if (!existingGroupCodes.includes(g.groupCode)) {
        existingGroupCodes.push(g.groupCode);
      }

      await prisma.guest.create({
        data: {
          name: String(g.name).trim(),
          phone: g.phone ? String(g.phone).trim() : null,
          side: g.side || groupSide[g.groupCode] || 'groom',
          relation: g.relation || 'Friend',
          circle: g.circle ? String(g.circle).trim() : null,
          rsvpManual: g.rsvpManual ? String(g.rsvpManual).trim() : null,
          notes: g.notes ? String(g.notes).trim() : null,
          groupCode: g.groupCode,
          sortOrder: order++,
        },
      });
      created++;
    }

    // Set each affected group's seats: explicit seats if given, else the number
    // of guests now in the group (never below the actual headcount unless the
    // user explicitly asked for fewer via the Seats column).
    const affected = [...new Set(guests.map((g: any) => g.groupCode).filter(Boolean))] as string[];
    for (const code of affected) {
      const count = await prisma.guest.count({ where: { groupCode: code } });
      const seats = groupSeats[code] || count;
      await prisma.guestGroup.update({ where: { groupCode: code }, data: { maxGuests: seats } });
    }

    return NextResponse.json({ created, groupsCreated, existingGroupCodes });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
