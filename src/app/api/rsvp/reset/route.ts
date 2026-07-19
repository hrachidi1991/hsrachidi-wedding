import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import prisma from '@/lib/db';

// Admin only: remove a group's RSVP submission so its invite link is no longer
// locked — resending the link lets the group confirm again from scratch.
export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id, groupCode } = await request.json();
    if (!id && !groupCode) {
      return NextResponse.json({ error: 'Group id or code required' }, { status: 400 });
    }
    const group = id
      ? await prisma.guestGroup.findUnique({ where: { id } })
      : await prisma.guestGroup.findUnique({ where: { groupCode } });
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    const { count } = await prisma.rsvpResponse.deleteMany({ where: { groupId: group.id } });
    return NextResponse.json({ success: true, removed: count });
  } catch (e) {
    console.error('RSVP reset error:', e);
    return NextResponse.json({ error: 'Failed to reset submission' }, { status: 500 });
  }
}
