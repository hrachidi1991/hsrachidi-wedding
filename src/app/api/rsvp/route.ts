import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET: load RSVP data for a token
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }
  try {
    const group = await prisma.guestGroup.findUnique({
      where: { token },
      include: { rsvpResponse: true },
    });
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
    const { token, attending, numberAttending, guestNames, language } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const group = await prisma.guestGroup.findUnique({
      where: { token },
      include: { rsvpResponse: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 });
    }

    const actualAttending = attending ? Math.min(numberAttending || 1, group.maxGuests) : 0;
    const names = Array.isArray(guestNames) ? guestNames.slice(0, group.maxGuests) : [];

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
