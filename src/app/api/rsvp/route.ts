import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET: load RSVP data for a group
export async function GET(request: NextRequest) {
  const groupCode = request.nextUrl.searchParams.get('g') || request.nextUrl.searchParams.get('token');
  if (!groupCode) {
    return NextResponse.json({ error: 'Group code required' }, { status: 400 });
  }
  try {
    // Try groupCode first, fall back to token for legacy links
    let group = await prisma.guestGroup.findUnique({
      where: { groupCode },
      include: { rsvpResponse: true },
    });
    if (!group) {
      group = await prisma.guestGroup.findUnique({
        where: { token: groupCode },
        include: { rsvpResponse: true },
      });
    }
    if (!group) {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 });
    }
    // Get guest records for this group
    const guests = await prisma.guest.findMany({
      where: { groupCode: group.groupCode },
    });
    return NextResponse.json({
      groupCode: group.groupCode,
      maxGuests: group.maxGuests,
      side: group.side,
      guests,
      rsvp: group.rsvpResponse
        ? {
            attending: group.rsvpResponse.attending,
            numberAttending: group.rsvpResponse.numberAttending,
            guestNames: group.rsvpResponse.guestNames,
            language: group.rsvpResponse.language,
            submittedAt: group.rsvpResponse.submittedAt,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST: submit or update RSVP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupCode, token, language } = body;
    const identifier = groupCode || token;

    if (!identifier) {
      return NextResponse.json({ error: 'Group code required' }, { status: 400 });
    }

    // Try groupCode first, fall back to token for legacy
    let group = await prisma.guestGroup.findUnique({
      where: { groupCode: identifier },
      include: { rsvpResponse: true },
    });
    if (!group) {
      group = await prisma.guestGroup.findUnique({
        where: { token: identifier },
        include: { rsvpResponse: true },
      });
    }

    if (!group) {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 });
    }

    let attending: boolean;
    let actualAttending: number;
    let names: any;

    // New format: guestAttendance array of { name, attending }
    if (Array.isArray(body.guestAttendance)) {
      const ga = body.guestAttendance.slice(0, group.maxGuests);
      attending = ga.some((g: { attending: boolean }) => g.attending);
      actualAttending = ga.filter((g: { attending: boolean }) => g.attending).length;
      names = ga;
    } else {
      // Legacy format: attending, numberAttending, guestNames[]
      attending = body.attending;
      actualAttending = attending ? Math.min(body.numberAttending || 1, group.maxGuests) : 0;
      names = Array.isArray(body.guestNames) ? body.guestNames.slice(0, group.maxGuests) : [];
    }

    if (group.rsvpResponse) {
      // Update existing
      await prisma.rsvpResponse.update({
        where: { id: group.rsvpResponse.id },
        data: {
          attending,
          numberAttending: actualAttending,
          guestNames: names as any,
          language: language || 'en',
        },
      });
      return NextResponse.json({ success: true, updated: true });
    } else {
      // Create new
      await prisma.rsvpResponse.create({
        data: {
          groupId: group.id,
          attending,
          numberAttending: actualAttending,
          guestNames: names as any,
          language: language || 'en',
        },
      });
      return NextResponse.json({ success: true, updated: false });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
