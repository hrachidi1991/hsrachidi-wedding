import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import prisma from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const guests = await prisma.guest.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(guests);
  } catch {
    return NextResponse.json({ error: 'Failed to load guests' }, { status: 500 });
  }
}

// Create a guest (manual add). Ensures the group exists first.
export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await request.json();
    if (!data.name || !data.groupCode) {
      return NextResponse.json({ error: 'Name and Group ID are required' }, { status: 400 });
    }

    const group = await prisma.guestGroup.findUnique({ where: { groupCode: data.groupCode } });
    if (!group) {
      await prisma.guestGroup.create({
        data: {
          groupCode: data.groupCode,
          maxGuests: parseInt(data.seats) || 2,
          side: data.side || 'groom',
          token: uuidv4(),
        },
      });
    }

    const last = await prisma.guest.findFirst({
      where: { groupCode: data.groupCode },
      orderBy: { sortOrder: 'desc' },
    });

    const guest = await prisma.guest.create({
      data: {
        name: String(data.name).trim(),
        phone: data.phone ? String(data.phone).trim() : null,
        side: data.side || group?.side || 'groom',
        relation: data.relation || 'Friend',
        circle: data.circle || null,
        rsvpManual: data.rsvpManual || null,
        notes: data.notes || null,
        groupCode: data.groupCode,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json(guest);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Inline edit — update any subset of a guest's editable fields.
export async function PATCH(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await request.json();
    if (!data.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const patch: Record<string, any> = {};
    for (const f of ['name', 'phone', 'side', 'relation', 'circle', 'rsvpManual', 'notes', 'groupCode'] as const) {
      if (f in data) patch[f] = data[f] === '' ? null : data[f];
    }
    if ('name' in patch && !patch.name) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }

    // Moving a guest into a group that doesn't exist yet? create it.
    if (patch.groupCode) {
      const g = await prisma.guestGroup.findUnique({ where: { groupCode: patch.groupCode } });
      if (!g) {
        const cur = await prisma.guest.findUnique({ where: { id: data.id } });
        await prisma.guestGroup.create({
          data: { groupCode: patch.groupCode, maxGuests: 2, side: patch.side || cur?.side || 'groom', token: uuidv4() },
        });
      }
    }

    const guest = await prisma.guest.update({ where: { id: data.id }, data: patch });
    return NextResponse.json(guest);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await request.json();
    await prisma.guest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete guest' }, { status: 500 });
  }
}
