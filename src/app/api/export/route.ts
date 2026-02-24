import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const groups = await prisma.guestGroup.findMany({
      include: { rsvpResponse: true },
      orderBy: { createdAt: 'asc' },
    });
    const guests = await prisma.guest.findMany();

    const rows: string[] = [
      'Group Code,Side,Max Guests,RSVP Status,Number Attending,Guest Names,Guests in Group,Token,Last Updated',
    ];

    for (const group of groups) {
      const groupGuests = guests.filter((g) => g.groupCode === group.groupCode);
      const guestNamesList = groupGuests.map((g) => g.name).join('; ');
      const rsvp = group.rsvpResponse;
      const status = rsvp ? (rsvp.attending ? 'Attending' : 'Not Attending') : 'No Response';
      const numAttending = rsvp?.numberAttending || 0;
      let submittedNames = '';
      if (rsvp && Array.isArray(rsvp.guestNames)) {
        const names = rsvp.guestNames as any[];
        if (names.length > 0 && typeof names[0] === 'object' && names[0] !== null && 'name' in names[0]) {
          // New format: { name, attending }
          submittedNames = names.map((g: any) => `${g.name}(${g.attending ? 'Y' : 'N'})`).join('; ');
        } else {
          // Legacy format: string[]
          submittedNames = (names as string[]).join('; ');
        }
      }
      const lastUpdated = rsvp?.updatedAt?.toISOString() || '';

      rows.push(
        [
          group.groupCode,
          group.side,
          group.maxGuests,
          status,
          numAttending,
          `"${submittedNames}"`,
          `"${guestNamesList}"`,
          group.token,
          lastUpdated,
        ].join(',')
      );
    }

    const csv = rows.join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="rsvp-export.csv"',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
