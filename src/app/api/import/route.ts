import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import prisma from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { guests } = await request.json();
    // Expected format: [{ name, phone, side, relation, groupCode, maxGuests }]
    if (!Array.isArray(guests)) {
      return NextResponse.json({ error: 'Expected guests array' }, { status: 400 });
    }

    let created = 0;
    let groupsCreated = 0;
    const existingGroupCodes: string[] = [];

    for (const g of guests) {
      if (!g.name || !g.groupCode) continue;

      // Ensure group exists
      const existing = await prisma.guestGroup.findUnique({ where: { groupCode: g.groupCode } });
      if (!existing) {
        await prisma.guestGroup.create({
          data: {
            groupCode: g.groupCode,
            maxGuests: g.maxGuests || 2,
            side: g.side || 'groom',
            token: uuidv4(),
          },
        });
        groupsCreated++;
      } else if (!existingGroupCodes.includes(g.groupCode)) {
        existingGroupCodes.push(g.groupCode);
      }

      await prisma.guest.create({
        data: {
          name: g.name,
          phone: g.phone || null,
          side: g.side || 'groom',
          relation: g.relation || 'friend',
          groupCode: g.groupCode,
        },
      });
      created++;
    }

    // Update maxGuests for groups that had guests added
    const allAffectedCodes = [...new Set(guests.map((g: any) => g.groupCode).filter(Boolean))];
    for (const code of allAffectedCodes) {
      const count = await prisma.guest.count({ where: { groupCode: code } });
      await prisma.guestGroup.update({
        where: { groupCode: code },
        data: { maxGuests: count },
      });
    }

    return NextResponse.json({ created, groupsCreated, existingGroupCodes });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
