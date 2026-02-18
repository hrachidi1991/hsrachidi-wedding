import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import prisma from '@/lib/db';

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

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await request.json();
    const guest = await prisma.guest.create({
      data: {
        firstName: data.firstName,
        familyName: data.familyName,
        phone: data.phone || null,
        side: data.side || 'groom',
        relation: data.relation || 'friend',
        groupCode: data.groupCode,
      },
    });
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
