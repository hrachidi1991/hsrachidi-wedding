import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const items = await prisma.timelineItem.findMany({ orderBy: { sortOrder: 'asc' } });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: 'Failed to load timeline' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await request.json();
    const count = await prisma.timelineItem.count();
    const item = await prisma.timelineItem.create({
      data: {
        time: data.time,
        labelEn: data.labelEn,
        labelAr: data.labelAr,
        sortOrder: data.sortOrder ?? count,
      },
    });
    return NextResponse.json(item);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await request.json();
    const item = await prisma.timelineItem.update({
      where: { id: data.id },
      data: {
        time: data.time,
        labelEn: data.labelEn,
        labelAr: data.labelAr,
        sortOrder: data.sortOrder,
      },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await request.json();
    await prisma.timelineItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
