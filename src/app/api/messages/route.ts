import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { decodeGroupCode } from '@/lib/linkCode';

const MAX_LEN = 2000;

// Resolve a group by opaque short code, plaintext groupCode, OR legacy token.
async function resolveGroupCode(identifier: string): Promise<string | null> {
  if (!identifier) return null;
  const decoded = decodeGroupCode(identifier);
  if (decoded) {
    const g = await prisma.guestGroup.findFirst({ where: { groupCode: { equals: decoded, mode: 'insensitive' } }, select: { groupCode: true } });
    if (g) return g.groupCode;
  }
  let g = await prisma.guestGroup.findUnique({ where: { groupCode: identifier }, select: { groupCode: true } });
  if (!g) g = await prisma.guestGroup.findUnique({ where: { token: identifier }, select: { groupCode: true } });
  return g?.groupCode ?? null;
}

// GET ?g=<groupCode|token> — the group's chat thread (public, per link).
// GET ?all=1 — every thread across all groups (admin only), for the Messages inbox.
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('all')) {
    if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const all = await prisma.guestMessage.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, groupCode: true, sender: true, body: true, createdAt: true },
    });
    const codes = [...new Set(all.map((m) => m.groupCode))];
    const [guests, groups] = await Promise.all([
      prisma.guest.findMany({ where: { groupCode: { in: codes } }, select: { name: true, groupCode: true, side: true, sortOrder: true } }),
      prisma.guestGroup.findMany({ where: { groupCode: { in: codes } }, select: { groupCode: true, side: true } }),
    ]);
    const threads = codes.map((code) => {
      const gs = guests.filter((x) => x.groupCode === code).sort((a, b) => a.sortOrder - b.sortOrder);
      const grp = groups.find((x) => x.groupCode === code);
      const msgs = all.filter((m) => m.groupCode === code);
      return {
        groupCode: code,
        label: gs.map((x) => x.name).join(', ') || code,
        side: grp?.side || gs[0]?.side || '',
        messages: msgs.map((m) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt })),
        lastAt: msgs[msgs.length - 1]?.createdAt ?? null,
      };
    });
    // most recently active thread first
    threads.sort((a, b) => new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime());
    return NextResponse.json({ threads });
  }
  const id = request.nextUrl.searchParams.get('g') || request.nextUrl.searchParams.get('token') || '';
  const groupCode = await resolveGroupCode(id);
  if (!groupCode) return NextResponse.json({ messages: [] });
  const messages = await prisma.guestMessage.findMany({
    where: { groupCode },
    orderBy: { createdAt: 'asc' },
    select: { id: true, sender: true, body: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ messages });
}

// POST { groupCode, body } — admin (couple) reply if authed, else a guest message.
export async function POST(request: NextRequest) {
  try {
    const { groupCode: rawCode, body } = await request.json();
    const text = String(body || '').trim().slice(0, MAX_LEN);
    if (!text) return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    const groupCode = await resolveGroupCode(rawCode);
    if (!groupCode) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    const sender = requireAdmin(request) ? 'couple' : 'guest';
    const msg = await prisma.guestMessage.create({
      data: { groupCode, sender, body: text },
      select: { id: true, sender: true, body: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ message: msg });
  } catch (e) {
    console.error('message POST error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT { id, groupCode, body } — edit. Admin may edit any; a guest only 'guest' msgs.
export async function PUT(request: NextRequest) {
  try {
    const { id, groupCode: rawCode, body } = await request.json();
    const text = String(body || '').trim().slice(0, MAX_LEN);
    if (!id || !text) return NextResponse.json({ error: 'Missing id or body' }, { status: 400 });
    const groupCode = await resolveGroupCode(rawCode);
    const existing = await prisma.guestMessage.findUnique({ where: { id } });
    if (!existing || existing.groupCode !== groupCode) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const isAdmin = requireAdmin(request);
    if (!isAdmin && existing.sender !== 'guest') return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    const msg = await prisma.guestMessage.update({
      where: { id },
      data: { body: text },
      select: { id: true, sender: true, body: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ message: msg });
  } catch (e) {
    console.error('message PUT error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE { id, groupCode } — delete. Admin may delete any; a guest only 'guest' msgs.
export async function DELETE(request: NextRequest) {
  try {
    const { id, groupCode: rawCode } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const groupCode = await resolveGroupCode(rawCode);
    const existing = await prisma.guestMessage.findUnique({ where: { id } });
    if (!existing || existing.groupCode !== groupCode) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const isAdmin = requireAdmin(request);
    if (!isAdmin && existing.sender !== 'guest') return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    await prisma.guestMessage.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('message DELETE error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
