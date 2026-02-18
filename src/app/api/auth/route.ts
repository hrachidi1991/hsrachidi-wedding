import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCredentials, createAdminToken, verifyAdminToken, getTokenFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const valid = await verifyAdminCredentials(username, password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const token = createAdminToken();
    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('admin_token');
  return response;
}
