import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getSettings, updateSettings } from '@/lib/settings';

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await request.json();
    const updated = await updateSettings(data);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
