import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import prisma from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const groups = await prisma.guestGroup.findMany({
      include: { rsvpResponse: true },
      orderBy: { createdAt: 'desc' },
    });
    // Also load guests for each group
    const guests = await prisma.guest.findMany();
    const groupsWithGuests = groups.map((g) => ({
      ...g,
      guests: guests.filter((guest) => guest.groupCode === g.groupCode),
    }));
    return NextResponse.json(groupsWithGuests);
  } catch {
    return NextResponse.json({ error: 'Failed to load groups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await request.json();
    const group = await prisma.guestGroup.create({
      data: {
        groupCode: data.groupCode,
        maxGuests: data.maxGuests || 2,
        side: data.side || 'groom',
        token: uuidv4(),
      },
    });
    return NextResponse.json(group);
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Group code already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await request.json();
    await prisma.guestGroup.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await request.json();
    const group = await prisma.guestGroup.update({
      where: { id: data.id },
      data: {
        maxGuests: data.maxGuests,
        side: data.side,
      },
    });
    return NextResponse.json(group);
  } catch {
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}
