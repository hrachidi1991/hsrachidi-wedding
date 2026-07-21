import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { decodeGroupCode } from '@/lib/linkCode';

// GET: load RSVP data for a group
export async function GET(request: NextRequest) {
  const groupCode = request.nextUrl.searchParams.get('g') || request.nextUrl.searchParams.get('token');
  if (!groupCode) {
    return NextResponse.json({ error: 'Group code required' }, { status: 400 });
  }
  try {
    // Short code → plaintext group code (legacy) → token (legacy)
    const decoded = decodeGroupCode(groupCode);
    let group = decoded
      ? await prisma.guestGroup.findFirst({ where: { groupCode: { equals: decoded, mode: 'insensitive' } }, include: { rsvpResponse: true } })
      : null;
    if (!group) {
      group = await prisma.guestGroup.findUnique({
        where: { groupCode },
        include: { rsvpResponse: true },
      });
    }
    if (!group) {
      group = await prisma.guestGroup.findUnique({
        where: { token: groupCode },
        include: { rsvpResponse: true },
      });
    }
    if (!group) {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 });
    }
    // Public read — expose ONLY names (never phone/relation/circle/notes/rsvpManual).
    const guests = await prisma.guest.findMany({
      where: { groupCode: group.groupCode },
      select: { id: true, name: true, displayName: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
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

    // Short code → plaintext group code (legacy) → token (legacy)
    const decoded = decodeGroupCode(identifier);
    let group = decoded
      ? await prisma.guestGroup.findFirst({ where: { groupCode: { equals: decoded, mode: 'insensitive' } }, include: { rsvpResponse: true } })
      : null;
    if (!group) {
      group = await prisma.guestGroup.findUnique({
        where: { groupCode: identifier },
        include: { rsvpResponse: true },
      });
    }
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
      // Submit-once: an existing response is locked. Only the couple's update
      // link (which carries the group token) may change it.
      if (!body.editToken || body.editToken !== group.token) {
        return NextResponse.json(
          { error: 'This RSVP is already submitted and locked. Please contact the couple for an update link.', code: 'RSVP_LOCKED' },
          { status: 403 }
        );
      }
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
      if (!group.inRsvp) await prisma.guestGroup.update({ where: { id: group.id }, data: { inRsvp: true } });
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
      // A submitted response always belongs in RSVP tracking.
      if (!group.inRsvp) await prisma.guestGroup.update({ where: { id: group.id }, data: { inRsvp: true } });
      return NextResponse.json({ success: true, updated: false });
    }
  } catch (e: any) {
    console.error('RSVP POST error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
